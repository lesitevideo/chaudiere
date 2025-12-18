# 🔥 Contrôle de Chaudière Chaffoteaux via eBUS

Interface web moderne pour contrôler votre chaudière **Chaffoteaux MIRA C GREEN 25** via un adaptateur **eBUS C6 Stick Edition** et un Raspberry Pi.

![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red)

## ✨ Fonctionnalités

- 📊 **Affichage en temps réel** de la température actuelle et cible
- 🎛️ **Réglage de la température** entre 15°C et 30°C
- ⚡ **Interface réactive** avec boutons +/- et slider
- 🔄 **Actualisation automatique** toutes les 30 secondes
- 📱 **Design responsive** optimisé pour mobile et desktop
- 🌐 **Accès à distance** via Internet (avec configuration Freebox)
- 🔌 **Indicateur de connexion** en temps réel
- 🎨 **Interface moderne** et intuitive

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
wget https://raw.githubusercontent.com/lesitevideo/chaudiere/main/install.sh

# Rendre le script exécutable
chmod +x install.sh

# Lancer l'installation
./install.sh
```

### Option 2 : Installation manuelle

Consultez le fichier [INSTALLATION.md](INSTALLATION.md) pour les instructions détaillées.

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

## 🌐 Accès depuis Internet

### Via Freebox Pop

1. Se connecter à l'interface Freebox : http://mafreebox.freebox.fr
2. Aller dans **Gestion des ports**
3. Ajouter une redirection :
   - Port externe : 8080
   - Port interne : 3000
   - IP : Adresse du Raspberry Pi

4. Accéder via : `http://[VOTRE_IP_PUBLIQUE]:8080`

⚠️ **Sécurité** : Pour un usage en production, utilisez HTTPS et une authentification.

## 📱 Utilisation Mobile

L'interface est optimisée pour mobile et peut être ajoutée à l'écran d'accueil :

- **iOS** : Safari → Partager → Sur l'écran d'accueil
- **Android** : Chrome → Menu → Ajouter à l'écran d'accueil

## 🧪 Commandes utiles

```bash
# Vérifier le statut d'ebusd
sudo systemctl status ebusd

# Lire la température actuelle
ebusctl read FlowTemp

# Changer la température de consigne
ebusctl write -c Hc1HeatSetTemp 21.5

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

- [Guide d'installation complet](INSTALLATION.md)
- [Documentation ebusd](https://github.com/john30/ebusd)
- [Wiki ebusd](https://github.com/john30/ebusd/wiki)
- [Configurations eBUS](https://github.com/john30/ebusd-configuration)

## 🔐 Sécurité

⚠️ **Important** : Cette interface est basique et n'inclut pas d'authentification par défaut.

Pour un usage en production :
- Ajoutez une authentification (login/mot de passe)
- Utilisez HTTPS avec un certificat SSL
- Limitez l'accès par IP
- Utilisez un VPN pour l'accès distant

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

- [ ] Authentification utilisateur
- [ ] Historique des températures avec graphiques
- [ ] Planification horaire (programmation)
- [ ] Notifications push
- [ ] Support multi-chaudières
- [ ] Application mobile native
- [ ] Mode économie d'énergie automatique
- [ ] Intégration Home Assistant

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
