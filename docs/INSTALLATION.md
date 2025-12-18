# Guide d'Installation - Contrôle Chaudière Chaffoteaux via eBUS

## 📋 Prérequis

- Raspberry Pi (3, 4, ou Zero 2 W recommandé)
- eBUS Adapter Shield C6 Stick Edition
- Chaudière Chaffoteaux MIRA C GREEN 25
- Carte SD avec Raspberry Pi OS
- Connexion Internet

## 🔌 Étape 1 : Connexion physique

1. Branchez l'adaptateur eBUS C6 Stick sur un port USB du Raspberry Pi
2. Connectez l'adaptateur à votre chaudière Chaffoteaux (bornes eBUS)
   - Respectez la polarité (+ et -)
   - Généralement, les bornes eBUS sont étiquetées sur la carte électronique

## 💻 Étape 2 : Installation du système

### 2.1 Mise à jour du Raspberry Pi

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.2 Installation d'ebusd

```bash
# Télécharger et installer ebusd
wget https://github.com/john30/ebusd/releases/download/v23.3/ebusd-23.3-raspberrypi_bookworm_arm64.deb
sudo dpkg -i ebusd-23.3-raspberrypi_bookworm_arm64.deb

# Si erreurs de dépendances :
sudo apt --fix-broken install
```

### 2.3 Installation de Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

## ⚙️ Étape 3 : Configuration d'ebusd

### 3.1 Identifier le port USB

```bash
# Lister les ports USB
ls -la /dev/ttyUSB*

# Normalement, vous devriez voir /dev/ttyUSB0
```

### 3.2 Configurer ebusd

```bash
sudo nano /etc/default/ebusd
```

Modifier la ligne EBUSD_OPTS :

```
EBUSD_OPTS="--device=/dev/ttyUSB0 --scanconfig --latency=10 --port=8888 --httpport=8889 --log=all:error --log=network:notice --log=bus:notice"
```

### 3.3 Démarrer ebusd

```bash
sudo systemctl enable ebusd
sudo systemctl start ebusd
sudo systemctl status ebusd
```

### 3.4 Vérifier la connexion

```bash
# Tester la connexion au bus eBUS
ebusctl info

# Lister les commandes disponibles pour votre chaudière
ebusctl find

# Lire la température actuelle
ebusctl read FlowTemp
```

## 🌐 Étape 4 : Installation de l'interface web

### 4.1 Créer le répertoire

```bash
mkdir -p /home/pi/chaudiere-control
cd /home/pi/chaudiere-control
```

### 4.2 Copier les fichiers

Copiez les fichiers fournis :
- `chaudiere-control.html`
- `server.js`

```bash
# Si vous avez les fichiers sur votre ordinateur, utilisez scp :
scp chaudiere-control.html pi@[IP_RASPBERRY]:/home/pi/chaudiere-control/
scp server.js pi@[IP_RASPBERRY]:/home/pi/chaudiere-control/
```

### 4.3 Tester le serveur

```bash
cd /home/pi/chaudiere-control
node server.js
```

Ouvrez votre navigateur et accédez à : `http://[IP_RASPBERRY]:3000`

### 4.4 Installer le service systemd (démarrage automatique)

```bash
# Copier le fichier service
sudo cp chaudiere-control.service /etc/systemd/system/

# Recharger systemd
sudo systemctl daemon-reload

# Activer et démarrer le service
sudo systemctl enable chaudiere-control
sudo systemctl start chaudiere-control

# Vérifier le statut
sudo systemctl status chaudiere-control
```

## 🌍 Étape 5 : Accès depuis Internet via Freebox

### Option 1 : Redirection de port (recommandé)

1. Connectez-vous à l'interface Freebox : http://mafreebox.freebox.fr
2. Allez dans **Paramètres de la Freebox** > **Mode avancé** > **Gestion des ports**
3. Ajoutez une redirection :
   - **Protocole** : TCP
   - **Port externe** : 8080 (ou autre de votre choix)
   - **Port interne** : 3000
   - **IP de destination** : IP locale de votre Raspberry Pi
   - **Commentaire** : Contrôle Chaudière

4. Accédez depuis l'extérieur via : `http://[VOTRE_IP_PUBLIQUE]:8080`

### Option 2 : VPN (plus sécurisé)

Utilisez WireGuard ou OpenVPN pour créer un tunnel sécurisé.

### ⚠️ Sécurité importante

Pour un accès depuis Internet, il est **fortement recommandé** d'ajouter :

1. **Authentification** (login/mot de passe)
2. **HTTPS** (certificat SSL)
3. **Pare-feu** (limiter les IP autorisées)

## 🔧 Étape 6 : Personnalisation

### Adapter les commandes eBUS

Les commandes dans `chaudiere-control.html` peuvent varier selon votre installation.

Pour trouver les bonnes commandes :

```bash
# Lister toutes les commandes disponibles
ebusctl find

# Exemples de commandes utiles :
ebusctl read Hc1HeatSetTemp    # Température de consigne chauffage
ebusctl read FlowTemp          # Température départ
ebusctl read ReturnTemp        # Température retour
ebusctl read Status01          # État chaudière
ebusctl read Hc1DayTemp        # Température jour
ebusctl read Hc1NightTemp      # Température nuit

# Écrire une valeur (changer température) :
ebusctl write -c Hc1HeatSetTemp 21.5
```

Modifiez les lignes dans `chaudiere-control.html` si nécessaire.

## 📊 Commandes utiles

```bash
# Logs ebusd
sudo journalctl -u ebusd -f

# Logs interface web
sudo journalctl -u chaudiere-control -f

# Redémarrer ebusd
sudo systemctl restart ebusd

# Redémarrer l'interface web
sudo systemctl restart chaudiere-control

# Trouver l'IP du Raspberry Pi
hostname -I
```

## 🐛 Dépannage

### Problème : ebusd ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u ebusd -n 50

# Vérifier que le port USB est accessible
ls -la /dev/ttyUSB0

# Ajouter l'utilisateur au groupe dialout
sudo usermod -a -G dialout ebusd
```

### Problème : Pas de communication avec la chaudière

```bash
# Tester manuellement
ebusctl info
ebusctl state

# Vérifier le câblage eBUS (polarité correcte)
# Attendre quelques minutes après le démarrage
```

### Problème : Interface web ne se charge pas

```bash
# Vérifier que le serveur est lancé
sudo systemctl status chaudiere-control

# Vérifier que le port 3000 est ouvert
sudo netstat -tuln | grep 3000

# Tester localement
curl http://localhost:3000
```

### Problème : CORS ou erreur de connexion à ebusd

Assurez-vous que ebusd est configuré avec `--httpport=8889` et accessible.

```bash
# Tester l'API ebusd
curl http://localhost:8889/data/FlowTemp
```

## 🎨 Fonctionnalités de l'interface

- ✅ Affichage de la température actuelle
- ✅ Affichage de la température cible
- ✅ Réglage de la température (15-30°C)
- ✅ Contrôle via boutons +/-
- ✅ Contrôle via slider
- ✅ Actualisation automatique toutes les 30 secondes
- ✅ Indicateur de connexion
- ✅ Interface responsive (mobile friendly)

## 📱 Utilisation mobile

L'interface est optimisée pour mobile. Ajoutez-la à l'écran d'accueil de votre smartphone :

- **iOS** : Safari > Partager > Sur l'écran d'accueil
- **Android** : Chrome > Menu > Ajouter à l'écran d'accueil

## 🔐 Amélioration de la sécurité (optionnel)

Pour sécuriser l'accès, vous pouvez ajouter :

1. **Authentification HTTP basique**
2. **Reverse proxy avec Nginx + SSL**
3. **Limitation d'accès par IP**

Exemple avec nginx :

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/chaudiere
```

## 📚 Ressources

- Documentation ebusd : https://github.com/john30/ebusd
- Wiki ebusd : https://github.com/john30/ebusd/wiki
- Forum ebusd : https://github.com/john30/ebusd/discussions
- Configurations eBUS : https://github.com/john30/ebusd-configuration

## 🆘 Support

En cas de problème :
1. Vérifiez les logs : `sudo journalctl -u ebusd -f`
2. Consultez le wiki ebusd
3. Vérifiez que votre modèle de chaudière est supporté

## ⚠️ Avertissements

- Assurez-vous que les modifications de température respectent les limites de votre installation
- Ne modifiez pas les paramètres avancés de la chaudière sans connaissance
- Utilisez cette interface à vos propres risques
- Maintenez votre système à jour pour la sécurité

## 📝 Notes

- La première connexion au bus eBUS peut prendre quelques minutes
- Certaines commandes peuvent varier selon la version de votre chaudière
- Consultez le manuel de votre chaudière pour les limites de température
