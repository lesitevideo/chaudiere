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
const THERMOSTAT_URL = 'http://thermostat-salon.local:5000/data';
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
    enabled: false,
    targetTemp: 20.0,
    hysteresis: 1.5,
    minCycleDuration: 450  // 7.5 minutes en secondes
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

// Fonction pour récupérer les données du thermostat
function fetchThermostatData() {
    return new Promise((resolve, reject) => {
        const url = new URL(THERMOSTAT_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 5000,
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
    const target = thermostatConfig.targetTemp;
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
            thermostatState.lastRelayChange = now;
            thermostatState.currentAction = 'heating';
            console.log(`🔥 Thermostat AUTO: Chauffe (${currentTemp.toFixed(1)}°C < ${(target - hysteresis).toFixed(1)}°C)`);
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
    console.log(`   ${THERMOSTAT_URL}`);
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
