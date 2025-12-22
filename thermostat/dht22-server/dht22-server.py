#!/usr/bin/env python3
"""
Serveur DHT22 pour thermostat salon - VERSION PIGPIO
Utilise pigpio pour meilleur timing
"""

from flask import Flask, jsonify
import pigpio
import time
from threading import Thread, Lock

app = Flask(__name__)

# Configuration
DHT_PIN = 4  # GPIO4
READING_INTERVAL = 60
MAX_RETRIES = 3

# État global
sensor_data = {
    'temperature': None,
    'humidity': None,
    'timestamp': None,
    'status': 'starting'
}
data_lock = Lock()

# Initialiser pigpio
pi = pigpio.pi()
if not pi.connected:
    print("ERREUR: pigpiod non démarré. Lancer: sudo systemctl start pigpiod")
    exit(1)

def read_dht22():
    """Lit DHT22 via pigpio"""
    pi.write(DHT_PIN, 0)  # Pull down
    time.sleep(0.02)      # 20ms
    pi.set_mode(DHT_PIN, pigpio.INPUT)
    pi.set_pull_up_down(DHT_PIN, pigpio.PUD_UP)
    
    time.sleep(0.0003)    # 300µs
    
    # Lire les bits
    bits = []
    timeout = 0
    last_tick = pi.get_current_tick()
    
    # Attendre réponse DHT22
    while pi.read(DHT_PIN) == 1 and timeout < 100:
        timeout += 1
        time.sleep(0.00001)
    
    if timeout >= 100:
        return None, None
    
    # Lecture simplifiée - utiliser bibliothèque DHT
    # Cette approche bas niveau est complexe, revenons à une lib
    return None, None

def read_sensor_pigpio():
    """Lit le capteur avec pigpio (approche simplifiée)"""
    # Note: pigpio n'a pas de lib DHT22 directe simple
    # On va utiliser une autre approche
    return None, None

def read_sensor_subprocess():
    """Lit DHT22 via utilitaire système"""
    import subprocess
    try:
        # Utilise l'outil pigpiod DHT
        result = subprocess.run(
            ['python3', '-c', 
             'import pigpio; import DHT22; pi=pigpio.pi(); s=DHT22.sensor(pi,4); s.trigger(); import time; time.sleep(0.2); print(f"{s.temperature()},{s.humidity()}")'],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            temp, hum = result.stdout.strip().split(',')
            return float(temp), float(hum)
    except Exception as e:
        print(f"Erreur: {e}")
    return None, None

def sensor_loop():
    """Boucle de lecture du capteur"""
    global sensor_data
    
    print("Démarrage lecture DHT22 (pigpio)...")
    
    # Importer la classe DHT22 pour pigpio
    try:
        import DHT22
        dht = DHT22.sensor(pi, DHT_PIN)
    except ImportError:
        print("ERREUR: Module DHT22 pour pigpio non trouvé")
        print("Installation: wget http://abyz.me.uk/rpi/pigpio/code/DHT22_py.zip && unzip DHT22_py.zip")
        return
    
    while True:
        try:
            dht.trigger()
            time.sleep(0.2)  # Attendre lecture
            
            temp = dht.temperature()
            hum = dht.humidity()
            
            with data_lock:
                if temp > -40 and temp < 80 and hum > 0 and hum < 100:
                    sensor_data['temperature'] = round(temp, 1)
                    sensor_data['humidity'] = round(hum, 1)
                    sensor_data['timestamp'] = int(time.time())
                    sensor_data['status'] = 'ok'
                    print(f"Lecture: {temp:.1f}°C, {hum:.1f}%")
                else:
                    sensor_data['status'] = 'error'
                    print(f"Valeurs aberrantes: {temp}°C, {hum}%")
        except Exception as e:
            print(f"Erreur lecture: {e}")
            with data_lock:
                sensor_data['status'] = 'error'
        
        time.sleep(READING_INTERVAL)

@app.route('/')
@app.route('/data')
def get_data():
    with data_lock:
        data = sensor_data.copy()
    
    if data['timestamp']:
        age = int(time.time()) - data['timestamp']
        if age > READING_INTERVAL * 3:
            data['status'] = 'stale'
    
    return jsonify(data)

@app.route('/health')
def health():
    return jsonify({'status': 'running', 'timestamp': int(time.time())})

if __name__ == '__main__':
    sensor_thread = Thread(target=sensor_loop, daemon=True)
    sensor_thread.start()
    time.sleep(3)
    
    print("Serveur DHT22 démarré sur http://thermostat-salon.local:5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
