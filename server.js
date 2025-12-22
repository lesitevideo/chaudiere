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

// Cache données thermostat
let thermostatData = {
    temperature: null,
    humidity: null,
    timestamp: null,
    status: 'disconnected',
    error: null
};

// Fonctions de contrôle du relais - utilise raspi-gpio directement
function setRelay(on) {
    // Active-low: ON => drive low (dl), OFF => drive high (dh)
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
        // Format: "GPIO 14: level=0 fsel=1 func=OUTPUT"
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
            timeout: 5000 // Timeout 5 secondes
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
        });
}

// Démarrer la lecture périodique du thermostat
updateThermostatData(); // Lecture immédiate
setInterval(updateThermostatData, THERMOSTAT_REFRESH_INTERVAL);

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

    // Routes API - Contrôle relais
    if (req.url === '/api/relay/on') {
        try {
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
    console.log(`\n🔌 Proxy ebusd:`);
    console.log(`   http://localhost:${PORT}/api/data/`);
    console.log(`\n💡 Test: curl http://localhost:${PORT}/api/thermostat/ambient`);
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
