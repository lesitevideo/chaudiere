# 🔥 Guide Complet Validé - Chaffoteaux MIRA C GREEN 25

## 📚 Sources validées

Basé sur :
- ✅ **Repository GitHub** : https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet
- ✅ **Série d'articles** : https://pro-domo.ddns.net/blog/ (5 parties)
- ✅ **Modèle exact** : Chaffoteaux MIRA C GREEN 25
- ✅ **Protocole** : BridgeNet/eBus2 (propriétaire Ariston/Chaffoteaux)

## 🎯 Ce qui est confirmé pour votre chaudière

### Matériel requis (validé) :

1. ✅ **Adaptateur eBUS C6 Stick Edition** - Compatible
2. ✅ **Raspberry Pi** - N'importe quel modèle (l'auteur utilise un RPi)
3. ✅ **ebusd** version 23.x ou supérieure
4. ✅ **2 fils** pour connexion eBUS à la chaudière

### Architecture validée :

```
Raspberry Pi ←USB→ Adaptateur C6 ←eBUS(2 fils)→ Chaudière MIRA C GREEN
     │
     ├─ ebusd (port 8888 + HTTP 8889)
     ├─ Serveur web (port 3000) ← Notre solution
     └─ (Optionnel : Home Assistant + MQTT)
```

## 🔧 Installation validée et optimisée

### Étape 1 : Installation d'ebusd (méthode validée)

```bash
# Méthode recommandée par l'auteur pro-domo
sudo apt update && sudo apt upgrade -y

# Installation via le script officiel (plus récent)
wget https://github.com/john30/ebusd/releases/download/v23.3/ebusd-23.3-raspberrypi_bookworm_arm64.deb
sudo dpkg -i ebusd-23.3-raspberrypi_bookworm_arm64.deb

# Si erreurs de dépendances
sudo apt --fix-broken install -y
```

### Étape 2 : Installation des fichiers BridgeNet (validée)

**IMPORTANT** : L'auteur a fait tout le travail de reverse-engineering !

```bash
# Clone du repository officiel
cd /tmp
git clone https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet.git

# Installation des fichiers de configuration
sudo systemctl stop ebusd
sudo cp -r ebusd_configuration_chaffoteaux_bridgenet/ebusd-2.1.x/en/chaffoteaux/* \
    /etc/ebusd/en/chaffoteaux/

# Copie des templates si nécessaire
sudo cp ebusd_configuration_chaffoteaux_bridgenet/ebusd-2.1.x/en/_templates.csv \
    /etc/ebusd/en/
```

### Étape 3 : Configuration d'ebusd (paramètres validés par l'auteur)

```bash
sudo nano /etc/default/ebusd
```

**Configuration recommandée par pro-domo** :

```bash
# Configuration optimale pour Chaffoteaux BridgeNet
EBUSD_OPTS="--device=/dev/ttyUSB0 \
--latency=200000 \
--configpath=/etc/ebusd \
--enablehex \
--receivetimeout=100 \
--sendretries=2 \
--port=8888 \
--httpport=8889 \
--log=all:error \
--log=network:notice \
--log=bus:notice"
```

**Paramètres importants expliqués** :

| Paramètre | Valeur | Raison |
|-----------|--------|--------|
| `--device` | `/dev/ttyUSB0` | Port USB de l'adaptateur |
| `--latency` | `200000` | **Crucial pour BridgeNet** (latence élevée) |
| `--enablehex` | - | Permet les commandes hex directes |
| `--receivetimeout` | `100` | Timeout adapté au protocole |
| `--sendretries` | `2` | Réessais en cas d'échec |

⚠️ **Le paramètre `--latency=200000` est TRÈS important** pour les chaudières BridgeNet !

### Étape 4 : Démarrage et test

```bash
# Démarrer ebusd
sudo systemctl enable ebusd
sudo systemctl start ebusd

# Attendre 2-3 minutes pour la détection
sleep 180

# Vérifier la connexion
ebusctl info

# Vous devriez voir :
# signal: acquired
# messages: 400+ (beaucoup de messages disponibles)
```

## 📊 Commandes disponibles (validées pour MIRA C GREEN)

### Températures

```bash
# Température départ (flow)
ebusctl read FlowTemp

# Température retour
ebusctl read ReturnTemp

# Température eau chaude sanitaire
ebusctl read DHWTemp

# Température extérieure (si sonde installée)
ebusctl read OutsideTemp
```

### Consignes (lecture/écriture)

```bash
# Consigne chauffage zone 1
ebusctl read z1_water_setpoint
ebusctl write -c z1_water_setpoint 45.0

# Température de consigne pièce (si applicable)
ebusctl read z1_room_temperature
ebusctl write -c z1_room_temperature 21.0

# Température jour/nuit
ebusctl read z1_water_day_temp
ebusctl read z1_water_night_temp
```

### États système

```bash
# État de la chaudière
ebusctl read boiler_status

# État du brûleur (0=off, 1=on)
ebusctl read flame_status

# Modulation du brûleur (%)
ebusctl read flame_level

# Pression du circuit
ebusctl read ch_pressure
```

### Registres importants découverts par reverse-engineering

```bash
# Activation/désactivation chauffage (0120 en hex)
ebusctl read heating_enabled
ebusctl write -c heating_enabled 1  # 1=activé, 0=désactivé

# Modulation flamme (1919 en hex)
ebusctl read flame_modulation

# Mode confort eau chaude
ebusctl read dhw_comfort_mode_status
ebusctl write -c dhw_comfort_mode_status 2  # 0=off, 1=delayed, 2=always
```

## 🔍 Commandes de diagnostic avancées

### Statistiques

```bash
# Heures de fonctionnement brûleur
ebusctl read burner_hours

# Nombre de démarrages
ebusctl read burner_starts

# Débit d'eau
ebusctl read flow_rate

# Vitesse ventilateur
ebusctl read fan_speed
```

### Codes d'erreur

```bash
# Dernière erreur
ebusctl read last_error_code

# Historique des erreurs
ebusctl read error_history
```

## 🎛️ Registres spécifiques BridgeNet

L'article mentionne des registres découverts par reverse-engineering :

### Type de régulation (c079, c07a, c07b)

```bash
# Mode de régulation zone 1
# 0 = température fixe
# 1 = on/off basique
# 2 = température ambiante uniquement
# 3 = température extérieure uniquement
# 4 = température extérieure + ambiante
ebusctl read z1_thermoreg_type
ebusctl write -c z1_thermoreg_type 3
```

### Température minimale eau (critique)

```bash
# Température minimale pour le circuit de chauffage
ebusctl read z1_water_min_temp
ebusctl write -c z1_water_min_temp 35.0
```

## ⚙️ Configuration optimale selon pro-domo

### Pour économies d'énergie maximales :

1. **Utiliser la régulation par température extérieure** (mode 3 ou 4)
2. **Ajuster z1_water_min_temp** selon les besoins (35-45°C)
3. **Activer/désactiver le chauffage** plutôt que moduler en continu
4. **Mode eau chaude** : "Delayed on" pour économiser l'énergie

### Exemple de paramétrage optimal :

```bash
# Mode régulation par température extérieure
ebusctl write -c z1_thermoreg_type 3

# Température minimale eau à 38°C (plutôt que 45-50°C par défaut)
ebusctl write -c z1_water_min_temp 38.0

# Température jour à 20°C
ebusctl write -c z1_water_day_temp 20.0

# Température nuit à 17°C
ebusctl write -c z1_water_night_temp 17.0

# Mode confort eau chaude : delayed
ebusctl write -c dhw_comfort_mode_status 1
```

## 🐛 Dépannage spécifique BridgeNet

### Problème : Erreurs "411", "412", "413" (sondes manquantes)

Ces codes d'erreur apparaissent si vous changez le mode de régulation sans avoir les sondes correspondantes.

**Solution** : Revenir au mode 0 (température fixe)

```bash
# Si erreur 411 (sonde ambiante z1 manquante)
ebusctl write -c z1_thermoreg_type 0

# Vérifier que l'erreur a disparu
ebusctl read last_error_code
```

### Problème : Pas de réponse de la chaudière

```bash
# Vérifier la latence (doit être élevée pour BridgeNet)
grep latency /etc/default/ebusd

# Doit contenir : --latency=200000

# Relancer avec logs détaillés
sudo ebusd -f --loglevel=debug
# Observer les logs, puis Ctrl+C
```

### Problème : Valeurs qui ne se mettent pas à jour

```bash
# Forcer un scan complet
ebusctl scan full

# Invalider le cache
ebusctl grab result

# Relire après quelques secondes
ebusctl read -c FlowTemp
```

## 📱 Adaptation de l'interface web

Notre interface doit utiliser les **noms exacts** découverts par reverse-engineering :

### Mapping des commandes validées :

| Notre interface | Commande ebusd validée | Type |
|-----------------|------------------------|------|
| FlowTemp | `FlowTemp` | Lecture |
| ReturnTemp | `ReturnTemp` | Lecture |
| DHWTemp | `DHWTemp` | Lecture |
| Pressure | `ch_pressure` | Lecture |
| BurnerStatus | `flame_status` | Lecture |
| BurnerModulation | `flame_level` | Lecture |
| Hc1HeatSetTemp | `z1_water_setpoint` | Lecture/Écriture |
| HeatingEnabled | `heating_enabled` | Lecture/Écriture |

## 🎯 Commandes prioritaires pour l'interface

### Version minimale (contrôle de base) :

```javascript
// Températures essentielles
await ebusCommand('FlowTemp');
await ebusCommand('z1_water_setpoint');

// Contrôle
await ebusCommand('z1_water_setpoint/write?21.0');
```

### Version complète (tous les paramètres) :

```javascript
// Toutes les températures
await ebusCommand('FlowTemp');
await ebusCommand('ReturnTemp');
await ebusCommand('DHWTemp');

// États
await ebusCommand('boiler_status');
await ebusCommand('flame_status');
await ebusCommand('flame_level');
await ebusCommand('ch_pressure');

// Statistiques
await ebusCommand('burner_hours');
await ebusCommand('burner_starts');
```

## 📚 Documentation complète

Pour aller plus loin, consultez :

1. **Article complet** : https://pro-domo.ddns.net/blog/domotiser-son-chauffage-avec-home-assistant-partie-1.html
2. **Repository GitHub** : https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet
3. **Partie 2** (MQTT/Home Assistant) : https://pro-domo.ddns.net/blog/domotiser-son-chauffage-avec-home-assistant-intallation-configuration-partie-2.html
4. **Partie 3** (Automatisations) : https://pro-domo.ddns.net/blog/domotiser-son-chauffage-avec-home-assistant-automatisation-partie-3.html

## 🎉 Avantages de cette solution

✅ **Gratuite** (sauf adaptateur ~20€)
✅ **Open source** et documentée
✅ **Testée** sur MIRA C GREEN 25
✅ **Complète** (400+ commandes disponibles)
✅ **Évolutive** (peut intégrer Home Assistant plus tard)
✅ **Locale** (pas de cloud, pas d'abonnement)

## ⚠️ Avertissements de l'auteur

1. **Ne pas modifier les paramètres avancés** sans comprendre leur fonction
2. **Sauvegarder** les valeurs par défaut avant modification
3. **Tester** progressivement les nouvelles commandes
4. **Respecter** les limites de température de votre installation
5. **Consulter** le manuel de votre chaudière

---

**Crédit** : Ce guide s'appuie largement sur le travail de reverse-engineering de **ysard** (pro-domo.ddns.net). Merci à lui pour ce travail titanesque ! 🙏

Si cette solution vous fait économiser du temps/argent, pensez à mettre une ⭐ sur le repository GitHub !
