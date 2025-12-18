const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOSTNAME = '0.0.0.0'; // Écoute sur toutes les interfaces

const server = http.createServer((req, res) => {
    // CORS headers pour permettre les requêtes vers ebusd
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Servir le fichier HTML
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
    console.log(`   http://[IP_DU_RASPBERRY]:${PORT}`);
    console.log(`\n💡 Astuce: Pour trouver l'IP du Raspberry Pi, tapez: hostname -I`);
    console.log(`\n⚠️  Vérifiez que ebusd est démarré sur le port 8889`);
    console.log(`   Commande: sudo systemctl status ebusd`);
    console.log(`\n═══════════════════════════════════════════════════════\n`);
});

process.on('SIGTERM', () => {
    console.log('Arrêt du serveur...');
    server.close(() => {
        console.log('Serveur arrêté');
        process.exit(0);
    });
});
