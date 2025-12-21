const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOSTNAME = '0.0.0.0';
const EBUSD_HOST = 'localhost';
const EBUSD_PORT = 8889;

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
