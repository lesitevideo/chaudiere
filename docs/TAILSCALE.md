# 🔐 Accès à distance sécurisé avec Tailscale

Ce guide explique comment configurer **Tailscale** pour accéder à votre interface de contrôle de chaudière depuis n'importe où, de manière sécurisée.

## 🎯 Pourquoi Tailscale ?

Tailscale est une solution VPN moderne qui offre :

✅ **Sécurité maximale** : Chiffrement de bout en bout (WireGuard)
✅ **Configuration simple** : Aucun port à ouvrir sur votre box
✅ **Zero Trust** : Authentification intégrée
✅ **Gratuit** : Pour usage personnel (jusqu'à 100 appareils)
✅ **Multi-plateforme** : Windows, macOS, Linux, iOS, Android

### Comparaison avec port forwarding

| Critère | Port Forwarding Freebox | Tailscale |
|---------|------------------------|-----------|
| Exposition | ❌ Exposé publiquement | ✅ Réseau privé |
| Chiffrement | ⚠️ HTTPS à configurer | ✅ Automatique |
| Authentification | ❌ À ajouter manuellement | ✅ Intégrée |
| Configuration | ⚠️ Complexe | ✅ Simple |
| Sécurité | ⚠️ Risques d'attaques | ✅ Zero Trust |

## 📋 Prérequis

- Raspberry Pi avec l'interface de contrôle installée
- Compte gratuit Tailscale (création lors de l'installation)
- Appareils clients (téléphone, ordinateur) pour l'accès distant

## 🚀 Installation sur le Raspberry Pi

### Méthode automatique (recommandée)

```bash
# Télécharger et exécuter le script d'installation Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
```

### Méthode manuelle

```bash
# Ajouter le dépôt Tailscale
curl -fsSL https://pkgs.tailscale.com/stable/raspbian/bullseye.noarmor.gpg | sudo tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
curl -fsSL https://pkgs.tailscale.com/stable/raspbian/bullseye.tailscale-keyring.list | sudo tee /etc/apt/sources.list.d/tailscale.list

# Installer Tailscale
sudo apt update
sudo apt install -y tailscale
```

## ⚙️ Configuration

### 1. Démarrer Tailscale sur le Raspberry Pi

```bash
# Démarrer et connecter le Raspberry Pi à Tailscale
sudo tailscale up
```

Cette commande affichera un lien d'authentification. Ouvrez-le dans un navigateur pour :
1. Créer un compte Tailscale (ou vous connecter)
2. Autoriser le Raspberry Pi à rejoindre votre réseau

### 2. Vérifier la connexion

```bash
# Voir l'état de Tailscale
sudo tailscale status

# Récupérer l'adresse IP Tailscale du Raspberry Pi
sudo tailscale ip -4
```

Exemple de sortie :
```
100.xx.xx.xx
```

Cette IP `100.xx.xx.xx` est l'adresse Tailscale de votre Raspberry Pi.

### 3. Activer le démarrage automatique

```bash
# Activer Tailscale au démarrage
sudo systemctl enable tailscaled
sudo systemctl start tailscaled
```

## 📱 Installation sur vos appareils

### Téléphone (iOS / Android)

1. Télécharger l'application Tailscale :
   - **iOS** : [App Store](https://apps.apple.com/app/tailscale/id1470499037)
   - **Android** : [Play Store](https://play.google.com/store/apps/details?id=com.tailscale.ipn)

2. Ouvrir l'application et se connecter avec le même compte

3. Activer la connexion Tailscale

### Ordinateur (Windows / macOS / Linux)

Télécharger et installer depuis : https://tailscale.com/download

## 🌐 Accès à l'interface

Une fois Tailscale configuré sur vos appareils :

```
http://100.xx.xx.xx:3000
```

Remplacez `100.xx.xx.xx` par l'IP Tailscale de votre Raspberry Pi (obtenue avec `tailscale ip -4`).

### Créer un nom personnalisé (MagicDNS)

Tailscale attribue automatiquement un nom DNS à vos appareils :

```
http://nom-raspberry-pi.tail-scale.ts.net:3000
```

Pour voir le nom de votre Raspberry Pi :
```bash
sudo tailscale status | grep $(hostname)
```

## 🔒 Configuration avancée (optionnel)

### Donner un nom personnalisé au Raspberry Pi

1. Aller sur https://login.tailscale.com/admin/machines
2. Trouver votre Raspberry Pi dans la liste
3. Cliquer sur les trois points → **Edit name**
4. Choisir un nom comme `chaudiere`

Vous pourrez alors accéder via :
```
http://chaudiere.tail-scale.ts.net:3000
```

### Désactiver l'expiration de la clé

Par défaut, Tailscale déconnecte les appareils après 180 jours. Pour éviter cela :

1. Aller sur https://login.tailscale.com/admin/machines
2. Trouver votre Raspberry Pi
3. Cliquer sur les trois points → **Disable key expiry**

### Partager l'accès avec d'autres personnes

Vous pouvez inviter d'autres utilisateurs à votre réseau Tailscale :

1. Aller sur https://login.tailscale.com/admin/settings/users
2. Cliquer sur **Invite users**
3. Entrer l'email de la personne

## 🧪 Tests

### Tester depuis votre téléphone

1. Activer Tailscale sur votre téléphone
2. Désactiver le WiFi (utiliser 4G/5G)
3. Ouvrir le navigateur et aller sur `http://100.xx.xx.xx:3000`

Si l'interface s'affiche, tout fonctionne ! 🎉

### Vérifier la sécurité

```bash
# Sur le Raspberry Pi, vérifier les appareils connectés
sudo tailscale status
```

Seuls les appareils autorisés dans votre compte Tailscale peuvent accéder à votre réseau.

## 🐛 Dépannage

### Tailscale ne démarre pas

```bash
# Vérifier les logs
sudo journalctl -u tailscaled -n 50

# Redémarrer le service
sudo systemctl restart tailscaled
```

### Impossible de se connecter à l'interface

1. Vérifier que Tailscale est actif :
```bash
sudo tailscale status
```

2. Vérifier que le serveur web est démarré :
```bash
sudo systemctl status chaudiere-control
```

3. Vérifier l'IP Tailscale :
```bash
sudo tailscale ip -4
```

### Déconnexion fréquente

Si Tailscale se déconnecte souvent :

```bash
# Vérifier les paramètres réseau
sudo tailscale status

# Forcer la reconnexion
sudo tailscale down
sudo tailscale up
```

### Connexion lente

Tailscale essaie d'établir une connexion directe (peer-to-peer). Si cela échoue, il utilise des relais.

Pour vérifier :
```bash
# Voir les connexions actives
sudo tailscale status
```

Si vous voyez "relay", la connexion passe par un serveur intermédiaire. C'est normal dans certains réseaux.

## 📊 Utilisation avancée

### Accès depuis un réseau professionnel

Certains réseaux d'entreprise bloquent le VPN. Tailscale utilise plusieurs techniques pour contourner cela :
- Port 443 (HTTPS)
- Relais DERP
- Tunneling

### ACL (Access Control Lists)

Pour un contrôle fin des accès, consultez :
https://tailscale.com/kb/1018/acls

### Subnet routing

Pour exposer tout votre réseau local via Tailscale :
```bash
sudo tailscale up --advertise-routes=192.168.1.0/24
```

Puis approuver sur https://login.tailscale.com/admin/machines

## 📚 Ressources

- [Documentation officielle Tailscale](https://tailscale.com/kb)
- [FAQ Tailscale](https://tailscale.com/kb/1009/faq)
- [Communauté Tailscale](https://forum.tailscale.com)

## 🔐 Sécurité et confidentialité

### Ce que Tailscale peut voir

- Vos appareils connectés
- Métadonnées de connexion (quand, durée)

### Ce que Tailscale NE PEUT PAS voir

- Le contenu de vos communications (chiffrement E2E)
- Les données de votre chaudière
- Votre trafic Internet normal

### Modèle de sécurité

Tailscale utilise :
- **WireGuard** : Protocole VPN moderne et audité
- **HTTPS** : Pour l'authentification
- **Zero Trust** : Aucune confiance implicite

## ⚠️ Important

- Ne partagez jamais vos identifiants Tailscale
- Vérifiez régulièrement les appareils connectés sur https://login.tailscale.com/admin/machines
- Supprimez les appareils que vous n'utilisez plus
- Activez l'authentification à deux facteurs sur votre compte Tailscale

---

Développé avec ❤️ pour un accès distant sécurisé à votre chaudière
