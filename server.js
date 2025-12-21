const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const PORT = 3000;
const HOSTNAME = '0.0.0.0';
const EBUSD_HOST = 'localhost';
const EBUSD_PORT = 8889;

// Configuration GPIO relais
const GPIO_CHIP = 'gpiochip0';
const GPIO_LINE = 14;
const ACTIVE_LOW = true; // 0 = ON, 1 = OFF

// Fonctions de contrôle du relais
async function setRelay(on) {
    const value = ACTIVE_LOW ? (on ? 0 : 1) : (on ? 1 : 0);
    try {
        await execFileAsync('gpioset', ['-m', 'exit', GPIO_CHIP, `${GPIO_LINE}=${value}`]);
        console.log(`Relais ${on ? 'ON' : 'OFF'} (GPIO${GPIO_LINE}=${value})`);
        return true;
    } catch (error) {
        console.error('Erreur GPIO:', error.message);
        throw error;
    }
}

async function getRelayState() {
    try {
        const { stdout } = await execFileAsync('gpioget', [GPIO_CHIP, String(GPIO_LINE)]);
        const value = parseInt(stdout.trim());
        const isOn = ACTIVE_LOW ? (value === 0) : (value === 1);
        return isOn;
    } catch (error) {
        console.error('Erreur lecture GPIO:', error.message);
        return null;
    }
}

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

    // Routes API - Contrôle relais
    if (req.url === '/api/relay/on') {
        setRelay(true)
            .then(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, state: 'ON' }));
            })
            .catch((error) => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });
        return;
    }

    if (req.url === '/api/relay/off') {
        setRelay(false)
            .then(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, state: 'OFF' }));
            })
            .catch((error) => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            });
        return;
    }

    if (req.url === '/api/relay/status') {
        getRelayState()
            .then((isOn) => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    state: isOn ? 'ON' : 'OFF',
                    isOn: isOn
                }));
            })
            .catch((error) => {
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
    console.log(`\n🔌 Proxy ebusd:`);
    console.log(`   http://localhost:${PORT}/api/data/`);
    console.log(`\n💡 Test: curl http://localhost:${PORT}/api/data/boiler_status`);
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
