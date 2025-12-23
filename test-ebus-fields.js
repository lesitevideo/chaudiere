const http = require('http');

function fetchEbusdData() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 8889,
            path: '/data/',
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (err) {
                    reject(err);
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

fetchEbusdData().then(data => {
    const boiler = data?.boiler?.messages || {};

    console.log('=== Messages disponibles (20 premiers) ===');
    const messageNames = Object.keys(boiler).slice(0, 20);
    messageNames.forEach(name => console.log(`- ${name}`));

    console.log('\n=== Recherche des messages ciblés ===');
    const targetMessages = [
        'heating_flame', 'flame_active', 'ignition_cycles', 'fan_speed',
        'water_temp_out', 'water_temp_in', 'ext_temp',
        'z1_thermoreg_slope', 'z1_target_temp', 'error_slot_9',
        'boiler_life_time', 'burner_heat_life_time'
    ];

    targetMessages.forEach(msgName => {
        if (boiler[msgName]) {
            const msg = boiler[msgName];
            const fields = msg.fields || {};
            console.log(`\n${msgName}:`);
            console.log(`  Fields:`, Object.keys(fields));
            Object.keys(fields).forEach(fieldName => {
                console.log(`  - ${fieldName}:`, fields[fieldName].value);
            });
        } else {
            console.log(`\n${msgName}: NON TROUVÉ`);
        }
    });

}).catch(err => {
    console.error('Erreur:', err.message);
});
