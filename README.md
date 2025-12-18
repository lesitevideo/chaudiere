# 🔥 Contrôle de Chaudière Chaffoteaux via eBUS

Interface web moderne pour contrôler votre chaudière **Chaffoteaux MIRA C GREEN 25** via un adaptateur **eBUS C6 Stick Edition** et un Raspberry Pi.

![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red)

## ✨ Fonctionnalités

### 🔥 Chauffage
- 📊 **Affichage en temps réel** des températures (départ, retour, pièce, extérieure)
- 🎛️ **Réglage direct de la température de l'eau** en mode fixe entre 35°C et 65°C
- 🌡️ **Contrôle simple** sans thermorégulation ni sonde externe (comme un bouton de chaudière)
- 📈 **Informations avancées** : pente/décalage thermorégulation, paramètres de zone

### 💧 Eau Chaude Sanitaire (ECS)
- 🚰 **Contrôle température ECS** entre 35°C et 65°C
- 🛁 **Mode confort** activable/désactivable
- 🌡️ **Température antigel** en temps réel
- 📊 **Statut ECS** détaillé

### 📊 État et Diagnostics
- 🔥 **État flamme** et cycles d'allumage
- 💨 **Vitesse ventilateur** en RPM
- ⚙️ **Statut chaudière** complet (général, chauffage, SRA)
- ⚠️ **Codes d'erreur** en temps réel

### 🎨 Interface
- 📑 **Interface à onglets** (Chauffage, Eau Chaude, État, Avancé)
- ⚡ **Boutons +/-** et slider pour réglage précis
- 🔄 **Actualisation automatique** toutes les 30 secondes
- 📱 **Design responsive** optimisé pour mobile et desktop
- 🌐 **Accès à distance sécurisé** via Tailscale VPN
- 🔌 **Indicateur de connexion** en temps réel
- ✅ **Messages de confirmation** pour chaque action

## 📸 Aperçu

```
┌─────────────────────────────────┐
│  🔥 Contrôle Chaudière          │
│  Chaffoteaux MIRA C GREEN 25    │
├─────────────────────────────────┤
│  ● Connecté                     │
├─────────────────────────────────┤
│  Température actuelle    65°C   │
│  Température cible       21°C   │
│  État                    Actif  │
├─────────────────────────────────┤
│          21.0°C                 │
│         −     +                 │
│  ═════●═════════════            │
│  [Appliquer la température]    │
│  [🔄 Actualiser]                │
└─────────────────────────────────┘
```

## 🛠️ Matériel requis

- **Raspberry Pi** (modèle 3, 4, ou Zero 2 W)
- **eBUS Adapter Shield C6 Stick Edition** ([lien](https://adapter.ebusd.eu/v5-c6/stick.en.html))
- **Chaudière Chaffoteaux MIRA C GREEN 25** (ou compatible eBUS)
- Carte SD (8 Go minimum)
- Alimentation USB pour Raspberry Pi
- Câble USB pour l'adaptateur eBUS

## 🚀 Installation rapide

### Option 1 : Script automatique (recommandé)

```bash
# Télécharger le script d'installation
wget https://raw.githubusercontent.com/lesitevideo/chaudiere/main/scripts/install.sh

# Rendre le script exécutable
chmod +x install.sh

# Lancer l'installation
./install.sh
```

### Option 2 : Installation manuelle

Consultez le fichier [INSTALLATION.md](docs/INSTALLATION.md) pour les instructions détaillées.

## 📋 Configuration rapide

1. **Connecter l'adaptateur eBUS**
   - Brancher l'adaptateur C6 Stick sur le Raspberry Pi
   - Connecter les fils eBUS à la chaudière (respecter la polarité)

2. **Démarrer ebusd**
   ```bash
   sudo systemctl start ebusd
   sudo systemctl status ebusd
   ```

3. **Tester la connexion**
   ```bash
   ebusctl info
   ebusctl read FlowTemp
   ```

4. **Accéder à l'interface**
   - Ouvrir un navigateur
   - Aller sur `http://[IP_RASPBERRY]:3000`

## 🔧 Configuration

### ebusd

Le fichier de configuration se trouve dans `/etc/default/ebusd` :

```bash
EBUSD_OPTS="--device=/dev/ttyUSB0 --scanconfig --latency=10 --port=8888 --httpport=8889"
```

### Interface Web

Le serveur écoute par défaut sur le port **3000**. Pour changer le port, éditez `server.js` :

```javascript
const PORT = 3000; // Modifier ici
```

## 🌐 Accès à distance sécurisé avec Tailscale

**Recommandé** : Utilisez Tailscale pour un accès distant sécurisé sans ouvrir de ports sur votre box Internet.

### Installation rapide Tailscale

```bash
# Sur le Raspberry Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Puis installez l'application Tailscale sur votre téléphone/ordinateur et accédez via :
```
http://100.xx.xx.xx:3000
```

### Avantages de Tailscale

✅ **Sécurité maximale** - Chiffrement de bout en bout (WireGuard)
✅ **Configuration simple** - Aucun port à ouvrir
✅ **Authentification intégrée** - Zero Trust
✅ **Gratuit** - Pour usage personnel
✅ **Multi-plateforme** - iOS, Android, Windows, macOS, Linux

📖 **Guide complet** : Consultez [TAILSCALE.md](docs/TAILSCALE.md) pour les instructions détaillées.

## 📱 Utilisation Mobile

L'interface est optimisée pour mobile et peut être ajoutée à l'écran d'accueil :

- **iOS** : Safari → Partager → Sur l'écran d'accueil
- **Android** : Chrome → Menu → Ajouter à l'écran d'accueil

## 🧪 Commandes utiles

```bash
# Vérifier le statut d'ebusd
sudo systemctl status ebusd

# Lire la température de départ actuelle
ebusctl read water_temp_out

# Régler la température fixe de l'eau de chauffage
ebusctl write z1_fixed_temp 50.0

# Lister toutes les commandes disponibles
ebusctl find

# Voir les logs en temps réel
sudo journalctl -u ebusd -f
sudo journalctl -u chaudiere-control -f

# Redémarrer les services
sudo systemctl restart ebusd
sudo systemctl restart chaudiere-control
```

## 🐛 Dépannage

### ebusd ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u ebusd -n 50

# Vérifier le port USB
ls -la /dev/ttyUSB*

# Vérifier les permissions
sudo usermod -a -G dialout $USER
sudo usermod -a -G dialout ebusd
```

### Pas de communication avec la chaudière

- Vérifier le câblage eBUS (polarité correcte)
- Attendre 2-3 minutes après le démarrage
- Vérifier que la chaudière est allumée
- Consulter `ebusctl info` et `ebusctl state`

### Interface web inaccessible

```bash
# Vérifier que le service est actif
sudo systemctl status chaudiere-control

# Vérifier le port
sudo netstat -tuln | grep 3000

# Tester localement
curl http://localhost:3000
```

## 📚 Documentation

- [Guide d'installation complet](docs/INSTALLATION.md)
- [Accès à distance avec Tailscale](docs/TAILSCALE.md)
- [Liste des commandes eBUS](docs/COMMANDES_EBUS.md)
- [Configuration BridgeNET](https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet)
- [Documentation ebusd](https://github.com/john30/ebusd)
- [Wiki ebusd](https://github.com/john30/ebusd/wiki)
- [Configurations eBUS](https://github.com/john30/ebusd-configuration)

## ⚙️ Configuration BridgeNET

Cette interface utilise les commandes spécifiques au protocole **BridgeNET** de Chaffoteaux. Les noms de commandes sont basés sur le fichier CSV de [ysard/ebusd_configuration_chaffoteaux_bridgenet](https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet/blob/master/mira_c_green.csv).

**Important** : Si vous utilisez une configuration eBUS générique, les commandes peuvent être différentes. Consultez le fichier [COMMANDES_EBUS.md](docs/COMMANDES_EBUS.md) pour la liste complète des commandes utilisées.

## 🔐 Sécurité

⚠️ **Important** : Cette interface est basique et n'inclut pas d'authentification par défaut.

**Accès local uniquement** : Si vous n'accédez à l'interface que depuis votre réseau local (WiFi), aucune configuration supplémentaire n'est nécessaire.

**Accès distant sécurisé** : Utilisez **Tailscale** (recommandé) :
- ✅ Chiffrement de bout en bout automatique
- ✅ Authentification intégrée
- ✅ Aucun port exposé publiquement
- 📖 Voir le [guide Tailscale](docs/TAILSCALE.md)

**Alternative pour usage avancé** :
- Authentification (login/mot de passe) avec reverse proxy
- Certificat SSL/HTTPS avec Let's Encrypt
- Reverse proxy (nginx, Caddy) avec authentification basique

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Partager vos configurations

## 📝 Licence

MIT License - Libre d'utilisation et de modification

## ⚠️ Avertissements

- Utilisez cette interface à vos propres risques
- Vérifiez que les modifications de température respectent les limites de votre installation
- Ne modifiez pas les paramètres avancés de la chaudière sans connaissance
- Consultez le manuel de votre chaudière
- Maintenez votre système à jour

## 🎯 Roadmap

- [x] Correction commandes eBUS pour Mira C Green BridgeNET
- [x] Contrôle eau chaude sanitaire (DHW)
- [x] Interface à onglets
- [x] Informations avancées (flamme, ventilateur, thermorégulation)
- [ ] Authentification utilisateur
- [ ] Historique des températures avec graphiques
- [ ] Support zones multiples (Z2-Z7)
- [ ] Planification horaire (programmation timer)
- [ ] Historique des erreurs (10 dernières)
- [ ] Notifications push
- [ ] Application mobile native
- [ ] Intégration Home Assistant / MQTT

## 📞 Support

En cas de problème :
1. Consultez la section [Dépannage](#-dépannage)
2. Vérifiez les [issues GitHub](https://github.com/lesitevideo/chaudiere/issues)
3. Consultez le forum ebusd

## 🙏 Remerciements

- [john30](https://github.com/john30) pour ebusd
- La communauté eBUS
- Tous les contributeurs

---

Développé avec ❤️ pour faciliter le contrôle de votre chaudière
