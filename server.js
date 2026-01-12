const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3000;
const HOSTNAME = '0.0.0.0';
const EBUSD_HOST = 'localhost';
const EBUSD_PORT = 8889;

// Configuration GPIO relais
const GPIO_PIN = 14;

// Configuration thermostat
const THERMOSTAT_BASE_URL = 'http://thermostat-salon.local';
const THERMOSTAT_DATA_URL = `${THERMOSTAT_BASE_URL}/data`;
const THERMOSTAT_LED_URL = `${THERMOSTAT_BASE_URL}/api/led/heating`;
const THERMOSTAT_REFRESH_INTERVAL = 60000; // 60 secondes
const THERMOSTAT_CONFIG_FILE = path.join(__dirname, 'thermostat-config.json');

// Cache données thermostat
let thermostatData = {
    temperature: null,
    humidity: null,
    timestamp: null,
    status: 'disconnected',
    error: null
};

// Configuration thermostat (chargée depuis fichier)
let thermostatConfig = {
    mode: 'auto',  // 'manual', 'auto', 'programmed'
    enabled: false,
    targetTemp: 20.0,
    hysteresis: 1.0,
    minCycleDuration: 600,
    programmedMode: {
        activePreset: 'confort',
        override: null  // { temp, expiresAt }
    },
    presets: {}
};

// État thermostat
let thermostatState = {
    lastRelayChange: null,
    currentAction: 'idle',  // 'heating', 'idle', 'waiting'
    lastError: null
};

// Charger configuration thermostat
function loadThermostatConfig() {
    try {
        if (fs.existsSync(THERMOSTAT_CONFIG_FILE)) {
            const data = fs.readFileSync(THERMOSTAT_CONFIG_FILE, 'utf8');
            thermostatConfig = JSON.parse(data);
            console.log('📋 Configuration thermostat chargée:', thermostatConfig);
        } else {
            saveThermostatConfig();
            console.log('📋 Configuration thermostat initialisée par défaut');
        }
    } catch (error) {
        console.error('❌ Erreur chargement config thermostat:', error.message);
    }
}

// Sauvegarder configuration thermostat
function saveThermostatConfig() {
    try {
        fs.writeFileSync(THERMOSTAT_CONFIG_FILE, JSON.stringify(thermostatConfig, null, 2));
        console.log('💾 Configuration thermostat sauvegardée');
    } catch (error) {
        console.error('❌ Erreur sauvegarde config thermostat:', error.message);
    }
}

// Fonctions de contrôle du relais
function setRelay(on) {
    const level = on ? 'dl' : 'dh';
    try {
        execSync(`sudo raspi-gpio set ${GPIO_PIN} op ${level}`, { stdio: 'inherit' });
        console.log(`Relais ${on ? 'ON' : 'OFF'} (GPIO${GPIO_PIN}=${level})`);
        return true;
    } catch (error) {
        console.error('Erreur relais:', error.message);
        throw error;
    }
}

function getRelayState() {
    try {
        const output = execSync(`sudo raspi-gpio get ${GPIO_PIN}`).toString();
        const match = output.match(/level=(\d+)/);
        if (match) {
            const level = parseInt(match[1]);
            const isOn = (level === 0); // Active-low: 0 = ON
            return isOn;
        }
        return null;
    } catch (error) {
        console.error('Erreur lecture GPIO:', error.message);
        return null;
    }
}

// Fonction pour mettre à jour la LED du thermostat
function updateThermostatLED(state) {
    const ledState = state ? 'on' : 'off';
    const url = new URL(THERMOSTAT_LED_URL);

    const postData = JSON.stringify({ state: ledState });
    const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 3000
    };

    const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
            console.log(`💡 LED thermostat: ${ledState.toUpperCase()}`);
        }
    });

    req.on('error', (err) => {
        // Ne pas bloquer si la LED ne répond pas
        console.warn(`⚠️  LED thermostat non disponible: ${err.message}`);
    });

    req.on('timeout', () => {
        req.destroy();
    });

    req.write(postData);
    req.end();
}

// Fonction pour interroger ebusd
function fetchEbusdData(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: EBUSD_HOST,
            port: EBUSD_PORT,
            path: path,
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (err) {
                    reject(new Error('Invalid JSON from ebusd'));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.end();
    });
}

// Nettoyer les overrides expirés
function cleanExpiredOverride() {
    if (thermostatConfig.programmedMode.override) {
        const now = Date.now();
        if (now >= thermostatConfig.programmedMode.override.expiresAt) {
            console.log('⏱️  Override expiré, retour au planning');
            thermostatConfig.programmedMode.override = null;
            saveThermostatConfig();
        }
    }
}

// Vérifier si un override est actif
function hasActiveOverride() {
    cleanExpiredOverride();
    return thermostatConfig.programmedMode.override !== null;
}

// Obtenir la température de l'override
function getOverrideTemp() {
    if (hasActiveOverride()) {
        return thermostatConfig.programmedMode.override.temp;
    }
    return null;
}

// Convertir "HH:MM" en minutes depuis minuit
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Obtenir la température programmée pour un moment donné
function getScheduledTemp(date) {
    const preset = thermostatConfig.presets[thermostatConfig.programmedMode.activePreset];
    if (!preset || !preset.schedule || preset.schedule.length === 0) {
        console.warn('⚠️  Pas de planning trouvé, utilisation température par défaut');
        return thermostatConfig.targetTemp;
    }

    const now = date.getHours() * 60 + date.getMinutes();

    // Chercher la plage horaire active
    for (let i = 0; i < preset.schedule.length; i++) {
        const slot = preset.schedule[i];
        const fromMin = timeToMinutes(slot.from);
        const toMin = timeToMinutes(slot.to);

        // Cas spécial: plage 00:00-00:00 = toute la journée
        if (slot.from === '00:00' && slot.to === '00:00') {
            return slot.temp;
        }

        // Cas normal: vérifier si l'heure actuelle est dans la plage
        if (toMin > fromMin) {
            // Plage normale (ex: 08:00-18:00)
            if (now >= fromMin && now < toMin) {
                return slot.temp;
            }
        } else {
            // Plage qui traverse minuit (ex: 23:00-06:00)
            if (now >= fromMin || now < toMin) {
                return slot.temp;
            }
        }
    }

    // Si aucune plage trouvée, utiliser température par défaut
    console.warn(`⚠️  Aucune plage horaire trouvée pour ${date.getHours()}:${date.getMinutes()}`);
    return thermostatConfig.targetTemp;
}

// Obtenir la température cible actuelle selon le mode
function getCurrentTargetTemp() {
    // Mode manuel : pas de consigne auto
    if (thermostatConfig.mode === 'manual' || !thermostatConfig.enabled) {
        return null;
    }

    // Mode auto : consigne fixe
    if (thermostatConfig.mode === 'auto') {
        return thermostatConfig.targetTemp;
    }

    // Mode programmé : vérifier override puis planning
    if (thermostatConfig.mode === 'programmed') {
        if (hasActiveOverride()) {
            const overrideTemp = getOverrideTemp();
            console.log(`🔄 Override actif: ${overrideTemp}°C`);
            return overrideTemp;
        }

        const scheduledTemp = getScheduledTemp(new Date());
        return scheduledTemp;
    }

    return thermostatConfig.targetTemp;
}

// Fonction pour récupérer les données du thermostat
function fetchThermostatData() {
    return new Promise((resolve, reject) => {
        const url = new URL(THERMOSTAT_DATA_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname,
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

// Boucle de lecture du thermostat
function updateThermostatData() {
    fetchThermostatData()
        .then(data => {
            thermostatData = {
                temperature: data.temperature,
                humidity: data.humidity,
                timestamp: data.timestamp,
                status: data.status,
                error: null
            };
            console.log(`📡 Thermostat: ${data.temperature}°C, ${data.humidity}% (${data.status})`);
        })
        .catch(err => {
            thermostatData.status = 'error';
            thermostatData.error = err.message;
            console.error(`❌ Erreur thermostat: ${err.message}`);

            // Si mode auto et capteur HS > 5 min, désactiver mode auto
            if (thermostatConfig.enabled && thermostatData.timestamp) {
                const age = Date.now() - (thermostatData.timestamp * 1000);
                if (age > 300000) { // 5 minutes
                    console.error('⚠️  Capteur HS depuis > 5 min, désactivation mode auto');
                    thermostatConfig.enabled = false;
                    saveThermostatConfig();
                }
            }
        });
}

// Régulation thermostat automatique
function regulateThermostat() {
    // Si mode auto désactivé, ne rien faire
    if (!thermostatConfig.enabled) {
        thermostatState.currentAction = 'disabled';
        return;
    }

    // Si pas de données température, ne rien faire
    if (thermostatData.temperature === null || thermostatData.status !== 'ok') {
        thermostatState.currentAction = 'error';
        return;
    }

    const currentTemp = thermostatData.temperature;
    const target = getCurrentTargetTemp();

    // Si pas de cible (mode manuel), ne rien faire
    if (target === null) {
        thermostatState.currentAction = 'manual';
        return;
    }

    const hysteresis = thermostatConfig.hysteresis;

    const now = Date.now();
    const timeSinceChange = thermostatState.lastRelayChange
        ? (now - thermostatState.lastRelayChange) / 1000
        : Infinity;

    const relayState = getRelayState();

    // Vérifier délai minimum
    const canChange = timeSinceChange >= thermostatConfig.minCycleDuration;

    // Logique d'hystérésis asymétrique :
    // - Démarrage chauffage si temp < (target - hysteresis)
    // - Arrêt chauffage si temp >= target
    // Cela évite de chauffer au-dessus de la consigne

    // Demande de chauffage
    if (currentTemp < (target - hysteresis)) {
        if (!relayState && canChange) {
            setRelay(true);
            updateThermostatLED(true);
            thermostatState.lastRelayChange = now;
            thermostatState.currentAction = 'heating';
            console.log(`🔥 Thermostat AUTO: Chauffe (${currentTemp.toFixed(1)}°C < ${(target - hysteresis).toFixed(1)}°C, cible ${target.toFixed(1)}°C)`);
        } else if (!relayState && !canChange) {
            thermostatState.currentAction = 'waiting';
        } else {
            thermostatState.currentAction = 'heating';
        }
    }
    // Arrêt chauffage - dès qu'on atteint ou dépasse la cible
    else if (currentTemp >= target) {
        if (relayState && canChange) {
            setRelay(false);
            updateThermostatLED(false);
            thermostatState.lastRelayChange = now;
            thermostatState.currentAction = 'idle';
            console.log(`✓ Thermostat AUTO: Arrêt (${currentTemp.toFixed(1)}°C >= ${target.toFixed(1)}°C)`);
        } else if (relayState && !canChange) {
            thermostatState.currentAction = 'waiting';
        } else {
            thermostatState.currentAction = 'idle';
        }
    }
    // Zone d'hystérésis - maintenir chauffage entre (target - hysteresis) et target
    else {
        if (!canChange) {
            thermostatState.currentAction = 'waiting';
        } else {
            thermostatState.currentAction = relayState ? 'heating' : 'idle';
        }
    }
}

// Charger config au démarrage
loadThermostatConfig();

// Démarrer la lecture périodique du thermostat
updateThermostatData();
setInterval(updateThermostatData, THERMOSTAT_REFRESH_INTERVAL);

// Démarrer la régulation thermostat (vérification toutes les 10s)
setInterval(regulateThermostat, 10000);

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Routes API - Thermostat
    if (req.url === '/api/thermostat/ambient') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(thermostatData));
        return;
    }

    if (req.url === '/api/thermostat/config') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(thermostatConfig));
            return;
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const update = JSON.parse(body);

                    // Mise à jour config
                    if (update.enabled !== undefined) thermostatConfig.enabled = update.enabled;
                    if (update.mode !== undefined && ['manual', 'auto', 'programmed'].includes(update.mode)) {
                        thermostatConfig.mode = update.mode;
                    }
                    if (update.targetTemp !== undefined) {
                        thermostatConfig.targetTemp = Math.max(15, Math.min(25, parseFloat(update.targetTemp)));
                    }
                    if (update.hysteresis !== undefined) {
                        thermostatConfig.hysteresis = Math.max(0.5, Math.min(3, parseFloat(update.hysteresis)));
                    }
                    if (update.minCycleDuration !== undefined) {
                        thermostatConfig.minCycleDuration = Math.max(60, parseInt(update.minCycleDuration));
                    }

                    saveThermostatConfig();

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, config: thermostatConfig }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
    }

    if (req.url === '/api/thermostat/preset') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const { preset } = JSON.parse(body);

                    if (!preset || !thermostatConfig.presets[preset]) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Preset invalide' }));
                        return;
                    }

                    thermostatConfig.programmedMode.activePreset = preset;
                    thermostatConfig.programmedMode.override = null; // Annuler override
                    saveThermostatConfig();

                    console.log(`📅 Preset changé: ${preset}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        preset: preset,
                        currentTemp: getCurrentTargetTemp()
                    }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        }
    }

    if (req.url === '/api/thermostat/override') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', () => {
                try {
                    const { temp, durationMinutes } = JSON.parse(body);

                    if (!temp || !durationMinutes) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Paramètres manquants' }));
                        return;
                    }

                    const tempValue = Math.max(15, Math.min(25, parseFloat(temp)));
                    const expiresAt = Date.now() + (durationMinutes * 60 * 1000);

                    thermostatConfig.programmedMode.override = {
                        temp: tempValue,
                        expiresAt: expiresAt
                    };
                    saveThermostatConfig();

                    console.log(`🔄 Override: ${tempValue}°C pendant ${durationMinutes}min`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        override: thermostatConfig.programmedMode.override
                    }));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            });
            return;
        } else if (req.method === 'DELETE') {
            thermostatConfig.programmedMode.override = null;
            saveThermostatConfig();
            console.log(`🔄 Override annulé`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            return;
        }
    }

    if (req.url === '/api/thermostat/schedule') {
        if (req.method === 'GET') {
            const preset = thermostatConfig.presets[thermostatConfig.programmedMode.activePreset];
            const currentTemp = getCurrentTargetTemp();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                activePreset: thermostatConfig.programmedMode.activePreset,
                preset: preset,
                currentTargetTemp: currentTemp,
                override: thermostatConfig.programmedMode.override,
                allPresets: Object.keys(thermostatConfig.presets).map(key => ({
                    id: key,
                    name: thermostatConfig.presets[key].name,
                    description: thermostatConfig.presets[key].description
                }))
            }));
            return;
        }
    }

    if (req.url === '/api/thermostat/state') {
        const state = {
            ...thermostatState,
            relayOn: getRelayState(),
            tempDiff: thermostatData.temperature !== null
                ? (thermostatData.temperature - thermostatConfig.targetTemp).toFixed(1)
                : null
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(state));
        return;
    }

    // Routes API - Contrôle relais
    if (req.url === '/api/relay/on') {
        try {
            // Si mode auto activé, refuser commande manuelle
            if (thermostatConfig.enabled) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Mode automatique activé' }));
                return;
            }
            setRelay(true);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, state: 'ON' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    if (req.url === '/api/relay/off') {
        try {
            // Si mode auto activé, refuser commande manuelle
            if (thermostatConfig.enabled) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Mode automatique activé' }));
                return;
            }
            setRelay(false);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, state: 'OFF' }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    if (req.url === '/api/relay/status') {
        try {
            const isOn = getRelayState();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                state: isOn ? 'ON' : 'OFF',
                isOn: isOn
            }));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // Fonction helper pour extraire valeurs ebusd
    function getEbusValue(data, messageName, fieldName) {
        try {
            return data?.boiler?.messages?.[messageName]?.fields?.[fieldName]?.value;
        } catch (e) {
            return null;
        }
    }

    // Route API - Régulation climatique Zone 1
    if (req.url === '/api/climate/zone1') {
        fetchEbusdData('/data/')
            .then(allData => {
                const climateData = {
                    ext_temp: { value: getEbusValue(allData, 'ext_temp', '0') },
                    z1_thermoreg_slope: { value: getEbusValue(allData, 'z1_thermoreg_slope', '0') },
                    z1_thermoreg_offset: { value: getEbusValue(allData, 'z1_thermoreg_offset', '0') },
                    z1_thermoreg_type: { value: getEbusValue(allData, 'z1_thermoreg_type', 'thermoreg_type') },
                    z1_target_temp: { value: getEbusValue(allData, 'z1_target_temp', '0') },
                    z1_water_max_temp: { value: getEbusValue(allData, 'z1_water_max_temp', '0') },
                    z1_water_min_temp: { value: getEbusValue(allData, 'z1_water_min_temp', '0') },
                    z1_day_temp: { value: getEbusValue(allData, 'z1_day_temp', '0') },
                    z1_night_temp: { value: getEbusValue(allData, 'z1_night_temp', '0') },
                    z1_fixed_temp: { value: getEbusValue(allData, 'z1_fixed_temp', '0') }
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(climateData));
            })
            .catch(error => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });
        return;
    }

    // Route API - Diagnostics chaudière
    if (req.url === '/api/boiler/diagnostics') {
        fetchEbusdData('/data/')
            .then(allData => {
                const diagnosticData = {
                    // Ces messages ne sont pas disponibles (lastup = 0)
                    heating_flame: { value: null },
                    ignition_cycles: { value: null },
                    fan_speed: { value: null },
                    flame_active: { value: null },
                    boiler_life_time: { value: null },
                    burner_heat_life_time: { value: null },
                    // Ces messages sont disponibles
                    water_temp_out: { value: getEbusValue(allData, 'water_temp_out', '0') },
                    water_temp_in: { value: getEbusValue(allData, 'water_temp_in', '0') },
                    boost_time: { value: getEbusValue(allData, 'boost_time', '0') }
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(diagnosticData));
            })
            .catch(error => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });
        return;
    }

    // Route API - Erreurs chaudière
    if (req.url === '/api/boiler/errors') {
        fetchEbusdData('/data/')
            .then(allData => {
                // error_slot_9 a un decodeerror, utiliser error_code à la place
                const errorCodeMsg = allData?.boiler?.messages?.error_code;
                const errorData = {
                    error_code: { value: errorCodeMsg?.fields?.error_code?.value || null },
                    zone: { value: errorCodeMsg?.fields?.zone_status?.value || null },
                    year: { value: null },
                    month: { value: null },
                    day: { value: null },
                    time: { value: null }
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(errorData));
            })
            .catch(error => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });
        return;
    }

    // Routes API - Proxy vers ebusd
    if (req.url.startsWith('/api/')) {
        const ebusPath = req.url.replace('/api', '');

        const options = {
            hostname: EBUSD_HOST,
            port: EBUSD_PORT,
            path: ebusPath,
            method: req.method
        };

        const proxyReq = http.request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error('Erreur ebusd:', err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ebusd non disponible' }));
        });

        req.pipe(proxyReq);
        return;
    }

    // Servir les fichiers statiques
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(path.join(__dirname, 'public', 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Erreur serveur');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Page non trouvée');
    }
});

server.listen(PORT, HOSTNAME, () => {
    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`🔥 Serveur de contrôle chaudière démarré !`);
    console.log(`═══════════════════════════════════════════════════════`);
    console.log(`\n📍 Accès local:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`\n🌐 Accès réseau:`);
    console.log(`   http://mira-c-green.local:${PORT}`);
    console.log(`\n🌡️  Thermostat:`);
    console.log(`   ${THERMOSTAT_DATA_URL}`);
    console.log(`   Rafraîchissement: ${THERMOSTAT_REFRESH_INTERVAL / 1000}s`);
    console.log(`   Mode auto: ${thermostatConfig.enabled ? 'ACTIVÉ' : 'désactivé'}`);
    console.log(`   Consigne: ${thermostatConfig.targetTemp}°C`);
    console.log(`   Hystérésis: -${thermostatConfig.hysteresis.toFixed(1)}°C (arrêt à consigne)`);
    console.log(`   Délai min: ${thermostatConfig.minCycleDuration}s`);
    console.log(`\n🔌 Proxy ebusd:`);
    console.log(`   http://localhost:${PORT}/api/data/`);
    console.log(`\n💡 Test: curl http://localhost:${PORT}/api/thermostat/state`);
    console.log(`\n✅ ebusd: http://${EBUSD_HOST}:${EBUSD_PORT}`);
    console.log(`\n═══════════════════════════════════════════════════════\n`);
});

process.on('SIGTERM', () => {
    console.log('Arrêt du serveur...');
    server.close(() => {
        console.log('Serveur arrêté');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nArrêt demandé (Ctrl+C)');
    server.close(() => {
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('Erreur non gérée:', error);
    process.exit(1);
});
