#!/bin/bash

# Script d'installation des configurations eBUS pour Chaffoteaux BridgeNet
# Source: https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet

set -e

echo "══════════════════════════════════════════════════════════════"
echo "   Installation configuration eBUS Chaffoteaux BridgeNet"
echo "══════════════════════════════════════════════════════════════"
echo ""

# Vérification que le script n'est pas lancé en root
if [ "$EUID" -eq 0 ]; then 
    echo "⚠️  Ne lancez pas ce script en tant que root"
    echo "   Utilisez : ./install-bridgenet-config.sh"
    exit 1
fi

# Vérification que ebusd est installé
if ! command -v ebusctl &> /dev/null; then
    echo "❌ ebusd n'est pas installé !"
    echo "   Installez d'abord ebusd avec le script install.sh"
    exit 1
fi

# Vérification que git est installé
if ! command -v git &> /dev/null; then
    echo "📦 Installation de git..."
    sudo apt update
    sudo apt install -y git
fi

echo "📊 État actuel d'ebusd:"
sudo systemctl status ebusd --no-pager | head -5
echo ""

# Arrêt d'ebusd
echo "⏸️  Arrêt d'ebusd..."
sudo systemctl stop ebusd
sleep 2

# Sauvegarde de la configuration actuelle
BACKUP_DIR="/etc/ebusd.backup.$(date +%Y%m%d_%H%M%S)"
echo "💾 Sauvegarde de la configuration actuelle dans $BACKUP_DIR..."
sudo cp -r /etc/ebusd "$BACKUP_DIR"
echo "✅ Sauvegarde créée"

# Téléchargement du repository BridgeNet
echo ""
echo "⬇️  Téléchargement des configurations BridgeNet..."
cd /tmp
rm -rf ebusd_configuration_chaffoteaux_bridgenet
git clone https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet.git

# Vérification de la version d'ebusd
EBUSD_VERSION=$(ebusctl --version | grep -oP '\d+\.\d+' | head -1)
echo "   Version ebusd détectée: $EBUSD_VERSION"

# Déterminer le bon répertoire de configuration
CONFIG_SOURCE=""
if [ -d "ebusd_configuration_chaffoteaux_bridgenet/ebusd-2.1.x" ]; then
    CONFIG_SOURCE="ebusd_configuration_chaffoteaux_bridgenet/ebusd-2.1.x/en"
    echo "   Utilisation config pour ebusd 2.1.x+"
elif [ -d "ebusd_configuration_chaffoteaux_bridgenet/en" ]; then
    CONFIG_SOURCE="ebusd_configuration_chaffoteaux_bridgenet/en"
    echo "   Utilisation config générique"
else
    echo "❌ Structure du repository inattendue"
    exit 1
fi

# Copie des fichiers de configuration
echo ""
echo "📁 Installation des fichiers de configuration..."

# Créer le répertoire chaffoteaux s'il n'existe pas
sudo mkdir -p /etc/ebusd/en/chaffoteaux

# Copier les fichiers
if [ -d "$CONFIG_SOURCE/chaffoteaux" ]; then
    sudo cp -v "$CONFIG_SOURCE/chaffoteaux/"* /etc/ebusd/en/chaffoteaux/ 2>/dev/null || true
    echo "✅ Fichiers Chaffoteaux copiés"
fi

# Copier les templates si disponibles
if [ -f "$CONFIG_SOURCE/_templates.csv" ]; then
    sudo cp -v "$CONFIG_SOURCE/_templates.csv" /etc/ebusd/en/
    echo "✅ Templates copiés"
fi

# Lister les fichiers installés
echo ""
echo "📄 Fichiers de configuration Chaffoteaux installés:"
ls -lh /etc/ebusd/en/chaffoteaux/

# Nettoyage
echo ""
echo "🧹 Nettoyage des fichiers temporaires..."
cd ~
rm -rf /tmp/ebusd_configuration_chaffoteaux_bridgenet

# Redémarrage d'ebusd
echo ""
echo "🚀 Redémarrage d'ebusd avec la nouvelle configuration..."
sudo systemctl start ebusd

echo ""
echo "⏳ Attente de la détection de la chaudière (30 secondes)..."
for i in {30..1}; do
    echo -ne "   $i secondes restantes...\r"
    sleep 1
done
echo ""

# Vérification
echo ""
echo "🔍 Vérification de la connexion..."
echo ""

if sudo systemctl is-active --quiet ebusd; then
    echo "✅ ebusd est actif"
    
    echo ""
    echo "📊 Informations eBUS:"
    ebusctl info
    
    echo ""
    echo "📋 Premières commandes disponibles (échantillon):"
    ebusctl find | head -20
    
    echo ""
    echo "💡 Pour voir toutes les commandes disponibles:"
    echo "   ebusctl find"
    
    echo ""
    echo "💡 Pour voir les commandes spécifiques au chauffage:"
    echo "   ebusctl find -c heating"
    
    echo ""
    echo "💡 Test rapide - lire la température:"
    echo "   ebusctl read FlowTemp"
    
else
    echo "❌ ebusd n'a pas démarré correctement"
    echo ""
    echo "Vérification des logs:"
    sudo journalctl -u ebusd -n 30 --no-pager
    
    echo ""
    echo "💡 Pour restaurer l'ancienne configuration:"
    echo "   sudo systemctl stop ebusd"
    echo "   sudo rm -rf /etc/ebusd"
    echo "   sudo cp -r $BACKUP_DIR /etc/ebusd"
    echo "   sudo systemctl start ebusd"
    
    exit 1
fi

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "   ✅ Configuration BridgeNet installée avec succès !"
echo "══════════════════════════════════════════════════════════════"
echo ""
echo "📚 Documentation du projet:"
echo "   https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet"
echo ""
echo "🔧 Commandes utiles:"
echo ""
echo "   Lister toutes les commandes:"
echo "   $ ebusctl find"
echo ""
echo "   Lire une valeur:"
echo "   $ ebusctl read FlowTemp"
echo ""
echo "   Écrire une valeur (température de consigne):"
echo "   $ ebusctl write -c Hc1HeatSetTemp 21.5"
echo ""
echo "   Voir les logs:"
echo "   $ sudo journalctl -u ebusd -f"
echo ""
echo "💾 Sauvegarde de l'ancienne config:"
echo "   $BACKUP_DIR"
echo ""
echo "══════════════════════════════════════════════════════════════"
