#!/bin/bash

# Script d'installation automatique pour le contrôle de chaudière via eBUS
# Pour Raspberry Pi avec adaptateur eBUS C6 Stick Edition

set -e

echo "══════════════════════════════════════════════════════════════"
echo "   Installation du système de contrôle de chaudière eBUS"
echo "══════════════════════════════════════════════════════════════"
echo ""

# Vérification des privilèges root pour certaines opérations
if [ "$EUID" -eq 0 ]; then 
    echo "⚠️  Ne lancez pas ce script en tant que root"
    echo "   Utilisez : ./install.sh"
    echo "   Le script demandera sudo quand nécessaire"
    exit 1
fi

# Détection de l'architecture
ARCH=$(dpkg --print-architecture)
echo "📊 Architecture détectée : $ARCH"

# Mise à jour du système
echo ""
echo "📦 Mise à jour du système..."
sudo apt update
sudo apt upgrade -y

# Installation d'ebusd
echo ""
echo "🔧 Installation d'ebusd..."

# Déterminer la version d'OS
OS_VERSION=$(lsb_release -cs)
echo "   Version OS : $OS_VERSION"

# URL de téléchargement ebusd
EBUSD_VERSION="23.3"
EBUSD_URL="https://github.com/john30/ebusd/releases/download/v${EBUSD_VERSION}/ebusd-${EBUSD_VERSION}-raspberrypi_${OS_VERSION}_${ARCH}.deb"

echo "   Téléchargement depuis : $EBUSD_URL"

wget -q --show-progress "$EBUSD_URL" -O /tmp/ebusd.deb || {
    echo "❌ Erreur lors du téléchargement d'ebusd"
    echo "   Essayez de télécharger manuellement depuis :"
    echo "   https://github.com/john30/ebusd/releases"
    exit 1
}

sudo dpkg -i /tmp/ebusd.deb || sudo apt --fix-broken install -y
rm /tmp/ebusd.deb

# Vérification de l'installation ebusd
if ! command -v ebusctl &> /dev/null; then
    echo "❌ Erreur : ebusd n'a pas été installé correctement"
    exit 1
fi

echo "✅ ebusd installé avec succès"

# Installation de Node.js
echo ""
echo "🔧 Installation de Node.js..."

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "   Node.js est déjà installé ($(node --version))"
fi

# Détection du port USB
echo ""
echo "🔌 Détection de l'adaptateur eBUS..."

USB_DEVICE=""
if [ -e /dev/ttyUSB0 ]; then
    USB_DEVICE="/dev/ttyUSB0"
    echo "✅ Adaptateur trouvé : $USB_DEVICE"
elif [ -e /dev/ttyUSB1 ]; then
    USB_DEVICE="/dev/ttyUSB1"
    echo "✅ Adaptateur trouvé : $USB_DEVICE"
else
    echo "⚠️  Aucun adaptateur USB détecté automatiquement"
    echo "   Branchez l'adaptateur eBUS et relancez le script"
    echo "   Ou continuez et configurez manuellement dans /etc/default/ebusd"
    USB_DEVICE="/dev/ttyUSB0"
fi

# Configuration d'ebusd
echo ""
echo "⚙️  Configuration d'ebusd..."

sudo bash -c "cat > /etc/default/ebusd << EOF
# Configuration ebusd pour Chaffoteaux MIRA C GREEN 25 / BridgeNet
# Paramètres validés par https://pro-domo.ddns.net et GitHub ysard/ebusd_configuration_chaffoteaux_bridgenet
# IMPORTANT: --latency=200000 est CRUCIAL pour le protocole BridgeNet !
EBUSD_OPTS=\"--device=$USB_DEVICE --scanconfig --latency=200000 --enablehex --receivetimeout=100 --sendretries=2 --port=8888 --httpport=8889 --log=all:error --log=network:notice --log=bus:notice\"
EOF"

echo "✅ Configuration d'ebusd créée"

# Ajout de l'utilisateur au groupe dialout (nécessaire pour accéder au port série)
echo ""
echo "👤 Configuration des permissions..."
sudo usermod -a -G dialout $USER
sudo usermod -a -G dialout ebusd

# Démarrage d'ebusd
echo ""
echo "🚀 Démarrage d'ebusd..."
sudo systemctl enable ebusd
sudo systemctl restart ebusd

sleep 3

# Vérification du statut
if sudo systemctl is-active --quiet ebusd; then
    echo "✅ ebusd est actif"
else
    echo "⚠️  ebusd n'est pas actif, vérification des logs..."
    sudo journalctl -u ebusd -n 20 --no-pager
fi

# Création du répertoire de l'application
echo ""
echo "📁 Création du répertoire de l'application..."
APP_DIR="/home/$USER/chaudiere-control"
mkdir -p "$APP_DIR"

# Copie des fichiers (supposant qu'ils sont dans le répertoire courant)
echo ""
echo "📄 Installation des fichiers de l'application..."

if [ -f "server.js" ] && [ -f "package.json" ] && [ -d "public" ]; then
    cp server.js "$APP_DIR/"
    cp package.json "$APP_DIR/"
    cp -r public "$APP_DIR/"
    echo "✅ Fichiers copiés"
else
    echo "⚠️  Fichiers server.js, package.json et/ou dossier public/ introuvables"
    echo "   Assurez-vous d'exécuter le script depuis la racine du projet"
    echo "   Ou copiez-les manuellement dans $APP_DIR/"
fi

# Création du service systemd
echo ""
echo "🔧 Installation du service systemd..."

sudo bash -c "cat > /etc/systemd/system/chaudiere-control.service << EOF
[Unit]
Description=Interface Web Controle Chaudiere
After=network.target ebusd.service
Requires=ebusd.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable chaudiere-control
sudo systemctl start chaudiere-control

sleep 2

# Vérification du statut du service web
if sudo systemctl is-active --quiet chaudiere-control; then
    echo "✅ Service web actif"
else
    echo "⚠️  Service web inactif, vérification des logs..."
    sudo journalctl -u chaudiere-control -n 20 --no-pager
fi

# Récupération de l'IP
echo ""
echo "🌐 Configuration réseau..."
IP_ADDRESS=$(hostname -I | awk '{print $1}')

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "   ✅ Installation terminée !"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "📍 Accès à l'interface web :"
echo ""
echo "   Local :  http://localhost:3000"
echo "   Réseau : http://$IP_ADDRESS:3000"
echo ""
echo "🔧 Commandes utiles :"
echo ""
echo "   Tester la connexion eBUS :"
echo "   $ ebusctl info"
echo ""
echo "   Lire la température :"
echo "   $ ebusctl read FlowTemp"
echo ""
echo "   Voir les logs ebusd :"
echo "   $ sudo journalctl -u ebusd -f"
echo ""
echo "   Voir les logs interface web :"
echo "   $ sudo journalctl -u chaudiere-control -f"
echo ""
echo "   Redémarrer les services :"
echo "   $ sudo systemctl restart ebusd"
echo "   $ sudo systemctl restart chaudiere-control"
echo ""
echo "⚠️  IMPORTANT :"
echo "   - Reconnectez-vous ou redémarrez pour que les permissions"
echo "     du groupe dialout prennent effet"
echo "   - Attendez 2-3 minutes que ebusd détecte votre chaudière"
echo "   - Consultez INSTALLATION.md pour plus de détails"
echo ""
echo "══════════════════════════════════════════════════════════════"
echo ""

# Proposition de test
read -p "Voulez-vous tester la connexion eBUS maintenant ? (o/n) : " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo ""
    echo "🔍 Test de la connexion eBUS..."
    echo ""
    ebusctl info
    echo ""
    echo "📋 Recherche des commandes disponibles (peut prendre du temps)..."
    ebusctl find | head -20
    echo ""
    echo "... (liste tronquée)"
    echo ""
fi

# Proposition d'installation Tailscale
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "   🔐 Accès distant sécurisé avec Tailscale"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "Tailscale permet d'accéder à votre chaudière depuis n'importe où"
echo "de manière sécurisée (chiffrement, authentification, sans ouvrir de ports)."
echo ""
read -p "Voulez-vous installer Tailscale maintenant ? (o/n) : " -n 1 -r
echo
if [[ $REPLY =~ ^[Oo]$ ]]; then
    echo ""
    echo "📦 Installation de Tailscale..."
    echo ""

    # Installation via le script officiel
    if curl -fsSL https://tailscale.com/install.sh | sh; then
        echo ""
        echo "✅ Tailscale installé avec succès"
        echo ""
        echo "🔧 Configuration de Tailscale..."
        echo ""
        echo "Exécutez cette commande pour connecter votre Raspberry Pi :"
        echo ""
        echo "   sudo tailscale up"
        echo ""
        echo "Puis ouvrez le lien qui s'affichera pour authentifier l'appareil."
        echo ""
        echo "📖 Guide complet : docs/TAILSCALE.md"
        echo ""
    else
        echo ""
        echo "❌ Erreur lors de l'installation de Tailscale"
        echo "   Vous pouvez l'installer manuellement plus tard."
        echo "   Consultez docs/TAILSCALE.md pour les instructions."
        echo ""
    fi
else
    echo ""
    echo "💡 Vous pouvez installer Tailscale plus tard en suivant le guide :"
    echo "   docs/TAILSCALE.md"
    echo ""
    echo "   Ou en exécutant :"
    echo "   curl -fsSL https://tailscale.com/install.sh | sh"
    echo ""
fi

echo "══════════════════════════════════════════════════════════════"
echo "🎉 Installation terminée ! Accédez à l'interface via votre navigateur."
echo "══════════════════════════════════════════════════════════════"
