const http = require('http');
const fs = require('fs');
const path = require('path');
const Gpio = require('onoff').Gpio;

const PORT = 3000;
const HOSTNAME = '0.0.0.0';
const EBUSD_HOST = 'localhost';
const EBUSD_PORT = 8889;

// Configuration GPIO relais
const GPIO_LINE = 14;
const ACTIVE_LOW = true; // 0 = ON, 1 = OFF

// Initialiser le GPIO en sortie
let relay;
try {
    relay = new Gpio(GPIO_LINE, 'out');
    console.log(`GPIO${GPIO_LINE} initialisé en mode sortie`);
} catch (error) {
    console.error(`Erreur initialisation GPIO${GPIO_LINE}:`, error.message);
    relay = null;
}

// Fonctions de contrôle du relais
function setRelay(on) {
    if (!relay) {
        throw new Error('GPIO non initialisé');
    }
    const value = ACTIVE_LOW ? (on ? 0 : 1) : (on ? 1 : 0);
    relay.writeSync(value);
    console.log(`Relais ${on ? 'ON' : 'OFF'} (GPIO${GPIO_LINE}=${value})`);
    return true;
}

function getRelayState() {
    if (!relay) {
        return null;
    }
    const value = relay.readSync();
    const isOn = ACTIVE_LOW ? (value === 0) : (value === 1);
    return isOn;
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
    console.log(`\n🔌 Proxy ebusd:`);
    console.log(`   http://localhost:${PORT}/api/data/`);
    console.log(`\n💡 Test: curl http://localhost:${PORT}/api/data/boiler_status`);
    console.log(`\n✅ ebusd: http://${EBUSD_HOST}:${EBUSD_PORT}`);
    console.log(`\n═══════════════════════════════════════════════════════\n`);
});

// Nettoyage du GPIO à l'arrêt
function cleanup() {
    if (relay) {
        console.log('Libération du GPIO...');
        relay.unexport();
    }
}

process.on('SIGTERM', () => {
    console.log('Arrêt du serveur...');
    cleanup();
    server.close(() => {
        console.log('Serveur arrêté');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nArrêt demandé (Ctrl+C)');
    cleanup();
    server.close(() => {
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('Erreur non gérée:', error);
    cleanup();
    process.exit(1);
});
