# Contrôle de Chaudière Chaffoteaux MIRA C GREEN

Interface web moderne avec **thermostat automatique** pour contrôler votre chaudière **Chaffoteaux MIRA C GREEN 25** via eBUS (lecture seule) et relais GPIO.

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red)
![Node](https://img.shields.io/badge/node-20.x-green)
![Bootstrap](https://img.shields.io/badge/bootstrap-5.3-purple)

## ✨ Fonctionnalités principales

### 🌡️ Thermostat Automatique (Nouveau !)

- **Capteur DHT22 déporté** - Température et humidité ambiante en temps réel
- **Régulation automatique** par hystérésis (±0.75°C par défaut)
- **Consigne réglable** de 15 à 25°C (interface web)
- **Protection anti-cycles** - Durée minimale configurable entre ON/OFF (7.5 min par défaut)
- **Mode manuel/automatique** - Switch entre contrôle manuel et régulation auto
- **Indicateurs visuels** - État en temps réel (En chauffe, Confort atteint, En attente)
- **Configuration persistante** - Sauvegarde automatique des réglages

### 📊 Monitoring eBUS (Lecture seule)

- **Températures en temps réel** - Départ, retour, ECS, zones
- **État chaudière** - Statut ON/OFF, demandes de chauffage Z1/Z2
- **Diagnostics** - Version ebusd, signal eBUS, maîtres détectés
- **Informations ECS** - Température réelle, mode Comfort

> **Note importante** : Le protocole eBUS sur Mira C Green est **en lecture seule**. L'écriture via BridgeNET n'est pas supportée. Le contrôle se fait exclusivement via le relais GPIO14.

### 🔌 Contrôle GPIO

- **Relais GPIO14** - Contrôle ON/OFF du chauffage via contact TA1 (thermostat)
- **Active-low** - 0 = chauffage ON, 1 = chauffage OFF
- **Mode manuel** - Switch ON/OFF direct depuis l'interface
- **Mode automatique** - Régulation par thermostat DHT22

### 🎨 Interface Web Bootstrap 5

- **Design moderne et responsive** - Optimisé mobile, tablette, desktop
- **Cards élégantes** - Organisation claire par sections
- **Actualisation automatique** - Données rafraîchies toutes les 10 secondes
- **Indicateurs visuels** - Badges colorés, icônes Bootstrap
- **Messages de confirmation** - Alerts Bootstrap pour chaque action

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Raspberry Pi Principal                     │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  ebusd     │  │  server.js   │  │   index.html     │    │
│  │  (lecture) │→ │  (Node.js)   │→ │  (Bootstrap 5)   │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
│        ↓               ↓                                     │
│   eBUS C6 Stick    GPIO14 (relais)                          │
└────────│───────────────│──────────────────────────────────┘
         │               │
         ↓               ↓
    Chaudière      Contact TA1
    Mira C Green   (thermostat)

┌─────────────────────────────────────────────────────────────┐
│              Raspberry Pi Zero W (Thermostat)               │
│  ┌─────────────────┐                                        │
│  │ dht22-server.py │ ← DHT22 (GPIO4)                       │
│  │   (Python)      │                                        │
│  └─────────────────┘                                        │
│         ↓                                                    │
│  HTTP :5000/data                                            │
└─────────│───────────────────────────────────────────────────┘
          │
          → Réseau local → Raspberry Pi Principal
```

## 🛠️ Matériel requis

### Raspberry Pi Principal

- **Raspberry Pi 3/4** (recommandé) ou Pi Zero 2 W
- **eBUS Adapter Shield C6 Stick Edition** ([lien](https://adapter.ebusd.eu/v5-c6/stick.en.html))
- **Relais 5V** - Module relais 1 canal (active-low compatible)
- **Câbles GPIO** - Connexion GPIO14 → relais → contact TA1 chaudière
- Carte SD 16 Go minimum
- Alimentation 5V 3A

### Raspberry Pi Zero W (Thermostat déporté)

- **Raspberry Pi Zero W** (WiFi intégré)
- **Capteur DHT22** (ou DHT11) - Température et humidité
- Carte SD 8 Go minimum
- Alimentation 5V 1A

### Chaudière

- **Chaffoteaux MIRA C GREEN 25** (ou compatible eBUS/BridgeNET)
- Accès au contact TA1 (thermostat)
- Accès au port eBUS

## 📦 Installation

### 1. Raspberry Pi Principal

```bash
# Cloner le repository
git clone https://github.com/lesitevideo/chaudiere.git
cd chaudiere

# Installer Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Installer ebusd
sudo apt install -y ebusd

# Configurer ebusd
sudo nano /etc/default/ebusd
# EBUSD_OPTS="--device=/dev/ttyUSB0 --scanconfig --latency=10 --port=8888 --httpport=8889"

sudo systemctl enable ebusd
sudo systemctl start ebusd

# Tester ebusd
ebusctl info

# Configurer sudo pour GPIO (nécessaire pour raspi-gpio)
sudo visudo -f /etc/sudoers.d/gpio
# Ajouter (remplacer 'pi' par votre utilisateur):
# pi ALL=(ALL) NOPASSWD: /usr/bin/raspi-gpio set 14 op *
# pi ALL=(ALL) NOPASSWD: /usr/bin/raspi-gpio get 14

# Lancer le serveur
node server.js
```

**Le serveur démarre sur http://[IP]:3000**

### 2. Raspberry Pi Zero W (Thermostat)

Consultez le dossier `thermostat/` pour les fichiers et instructions détaillées.

```bash
# Sur le Pi Zero W
mkdir -p ~/dht22-server
cd ~/dht22-server

# Installer dépendances
sudo apt update
sudo apt install -y python3-pip libgpiod2
sudo pip3 install Flask adafruit-circuitpython-dht adafruit-blinka --break-system-packages

# Créer dht22-server.py (voir thermostat/dht22-server.py)
nano dht22-server.py
chmod +x dht22-server.py

# Créer le service systemd (voir thermostat/thermostat-dht22.service)
sudo nano /etc/systemd/system/thermostat-dht22.service

# Activer et démarrer
sudo systemctl daemon-reload
sudo systemctl enable thermostat-dht22
sudo systemctl start thermostat-dht22

# Vérifier
sudo systemctl status thermostat-dht22
curl http://thermostat-salon.local:5000/data
```

**Configuration hostname du Pi Zero :**
```bash
sudo hostnamectl set-hostname thermostat-salon
```

### 3. Câblage GPIO14 (Relais)

```
Raspberry Pi         Relais 5V           Chaudière
GPIO14 ──────────→ IN
5V ──────────────→ VCC
GND ─────────────→ GND
                    NO ──────────────→ TA1 (contact 1)
                    COM ─────────────→ TA1 (contact 2)
```

**Important** : Utilisez un relais **active-low** ou configurez selon votre module.

## ⚙️ Configuration

### Thermostat (thermostat-config.json)

Créé automatiquement au premier lancement, modifiable via l'interface web :

```json
{
  "enabled": false,
  "targetTemp": 20.0,
  "hysteresis": 1.5,
  "minCycleDuration": 450
}
```

- `enabled` : Mode automatique ON/OFF
- `targetTemp` : Consigne de température (15-25°C)
- `hysteresis` : Écart total en °C (1.5 = ±0.75°C)
- `minCycleDuration` : Délai minimum entre cycles en secondes (450 = 7.5 min)

### ebusd

Fichier `/etc/default/ebusd` :

```bash
EBUSD_OPTS="--device=/dev/ttyUSB0 --scanconfig --latency=10 --port=8888 --httpport=8889"
```

### Serveur Web

Dans `server.js` :

```javascript
const PORT = 3000;
const THERMOSTAT_URL = 'http://thermostat-salon.local:5000/data';
const GPIO_PIN = 14;
```

## 🚀 Utilisation

### Interface Web

Accédez à **http://[IP_RASPBERRY]:3000**

**Sections disponibles :**

1. **Contrôles** :
   - **Thermostat Salon** : Température ambiante, humidité, consigne, mode auto
   - **Marche/Arrêt Chauffage** : Switch manuel (désactivé en mode auto)

2. **État Chaudière** : Statut, demandes Z1/Z2

3. **Températures** : ECS, consignes zones (lecture seule)

4. **Réglages Chaudière (Lecture seule)** : Températures Zone 1 et ECS (informatif)

5. **Informations Système** : Version ebusd, signal eBUS, maîtres

### Mode Thermostat Automatique

1. Régler la consigne (ex: 21°C) avec le slider
2. Activer le **switch "Mode automatique"**
3. Le système régule automatiquement :
   - Chauffe si T < (consigne - 0.75°C)
   - Arrêt si T > (consigne + 0.75°C)
   - Maintien dans la zone d'hystérésis

**Indicateurs d'état :**
- 🔥 **En chauffe** - Relais ON, température insuffisante
- ✅ **Confort atteint** - Relais OFF, température atteinte
- ⏰ **En attente** - Dans la période de protection anti-cycles
- ⚙️ **Mode manuel** - Régulation désactivée

## 🔧 Commandes utiles

```bash
# Vérifier ebusd
sudo systemctl status ebusd
ebusctl info
ebusctl read FlowTemp

# Voir les logs
sudo journalctl -u ebusd -f

# Thermostat Pi Zero W
ssh pi@thermostat-salon.local
sudo systemctl status thermostat-dht22
sudo journalctl -u thermostat-dht22 -f

# Tester thermostat
curl http://thermostat-salon.local:5000/data

# Tester GPIO relais
sudo raspi-gpio get 14
sudo raspi-gpio set 14 op dl  # ON (drive low)
sudo raspi-gpio set 14 op dh  # OFF (drive high)

# Tester API thermostat (depuis Pi principal)
curl http://localhost:3000/api/thermostat/ambient
curl http://localhost:3000/api/thermostat/config
curl http://localhost:3000/api/thermostat/state
curl http://localhost:3000/api/relay/status
```

## 🐛 Dépannage

### Thermostat ne répond pas

```bash
# Vérifier service sur Pi Zero W
ssh pi@thermostat-salon.local
sudo systemctl status thermostat-dht22

# Vérifier réseau
ping thermostat-salon.local

# Tester directement
curl http://thermostat-salon.local:5000/data
```

### Relais ne fonctionne pas

```bash
# Vérifier permissions sudo
sudo raspi-gpio get 14

# Tester manuellement
sudo raspi-gpio set 14 op dl  # ON
sudo raspi-gpio set 14 op dh  # OFF

# Vérifier câblage
# GPIO14 → IN relais
# Vérifier que le relais clique
```

### Erreur "Device or resource busy" (GPIO)

```bash
# Tuer les processus gpioset en conflit
sudo pkill -f gpioset

# Ou reboot
sudo reboot
```

### eBUS ne fonctionne pas

```bash
# Vérifier câblage eBUS (polarité correcte)
# Vérifier USB
ls -la /dev/ttyUSB*

# Permissions
sudo usermod -a -G dialout $USER
sudo usermod -a -G dialout ebusd

# Redémarrer
sudo systemctl restart ebusd
ebusctl info
```

## 🌐 Accès à distance avec Tailscale

**Recommandé** pour un accès distant sécurisé :

```bash
# Sur le Raspberry Pi principal
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# Sur le Pi Zero W (optionnel)
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Puis installez Tailscale sur votre smartphone/PC et accédez via :
```
http://100.xx.xx.xx:3000
```

**Avantages** :
- Chiffrement WireGuard
- Aucun port ouvert
- Gratuit usage personnel
- Multi-plateforme

## 📚 Documentation

- [ebusd Documentation](https://github.com/john30/ebusd)
- [Configuration BridgeNET](https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet)
- [Capteur DHT22](https://learn.adafruit.com/dht)
- [Bootstrap 5 Docs](https://getbootstrap.com/docs/5.3/)

## 🗺️ Roadmap

### Fait ✅

- [x] Monitoring eBUS (lecture seule)
- [x] Interface Bootstrap 5 responsive
- [x] Contrôle relais GPIO14
- [x] Thermostat DHT22 déporté (Pi Zero W)
- [x] Régulation automatique avec hystérésis
- [x] Mode manuel/automatique
- [x] Configuration persistante
- [x] Protection anti-cycles
- [x] Indicateurs d'état en temps réel

### À venir 🚧

- [ ] **Sonde température extérieure** - Pour modèle thermique prédictif
- [ ] **Historique et graphiques** - Températures, cycles de chauffe
- [ ] **Apprentissage/prédiction** - Calcul constante thermique, temps de chauffe
- [ ] **Programmation horaire** - Plages de température par jour/heure
- [ ] **Notifications** - Alertes email/push (erreurs, températures)
- [ ] **Authentification** - Login/mot de passe pour sécuriser l'interface
- [ ] **API REST complète** - Documentation OpenAPI/Swagger
- [ ] **Intégration Home Assistant** - Via MQTT ou API REST
- [ ] **Application mobile** - PWA ou native iOS/Android

## ⚠️ Avertissements

- **Utilisez à vos risques** - Modifications de chauffage sensibles
- **Vérifiez le câblage** - Erreur sur TA1 peut endommager la chaudière
- **eBUS lecture seule** - Pas d'écriture possible sur Mira C Green
- **Sécurité électrique** - Relais correctement isolé et dimensionné
- **Consultez le manuel** - De votre chaudière avant toute modification
- **Maintenez à jour** - Système et dépendances

## 📄 Licence

MIT License - Libre d'utilisation et de modification

## 🙏 Remerciements

- [john30](https://github.com/john30) - ebusd
- [ysard](https://github.com/ysard) - Configuration BridgeNET Chaffoteaux
- Communauté eBUS et Raspberry Pi
- Adafruit - Librairies DHT22

---

**Projet développé pour un contrôle moderne et économique de votre chauffage** 🔥

Pour toute question : [Issues GitHub](https://github.com/lesitevideo/chaudiere/issues)
