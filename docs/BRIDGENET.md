# Configuration eBUS BridgeNet pour Chaffoteaux

## 🎯 Pourquoi utiliser la configuration BridgeNet ?

Les chaudières Chaffoteaux modernes, comme votre **MIRA C GREEN 25**, utilisent le système **BridgeNet** qui est une variante propriétaire du protocole eBUS standard.

### Différences clés :

| Configuration standard | Configuration BridgeNet |
|------------------------|-------------------------|
| Messages eBUS génériques | Messages spécifiques Chaffoteaux |
| Commandes de base uniquement | Accès aux fonctions avancées |
| Peut avoir des valeurs incorrectes | Décodage précis des valeurs |
| Fonctions limitées | Accès complet à la chaudière |

## 📦 Qu'apporte la configuration BridgeNet ?

### 1. **Messages spécifiques Chaffoteaux**
Accès à des commandes qui n'existent que sur les chaudières Chaffoteaux :
- Paramètres de la pompe
- Configuration du brûleur
- Diagnostics avancés
- Statistiques détaillées

### 2. **Décodage correct des valeurs**
Les valeurs sont interprétées correctement selon les spécifications Chaffoteaux :
- Températures avec la bonne précision
- Pressions correctement calibrées
- États et codes d'erreur spécifiques

### 3. **Fonctions avancées**
- Modes de fonctionnement spéciaux
- Paramètres d'entretien
- Historique des erreurs
- Compteurs d'utilisation

## 🔍 Ce qui est inclus dans le repository ysard

D'après le repository, voici ce qu'on peut trouver :

### Fichiers de configuration disponibles :

```
chaffoteaux/
├── 08.chaffoteaux.csv           # Configuration de base
├── broadcast.chaffoteaux.csv    # Messages broadcast
├── bridgenet.chaffoteaux.csv    # Spécifique BridgeNet
└── ...                          # Autres fichiers spécifiques
```

### Exemples de commandes disponibles avec BridgeNet :

**Températures :**
- `FlowTemp` - Température départ
- `ReturnTemp` - Température retour
- `DHWTemp` - Température eau chaude sanitaire
- `OutsideTemp` - Température extérieure (si sonde)

**Consignes :**
- `Hc1HeatSetTemp` - Consigne chauffage circuit 1
- `DHWSetTemp` - Consigne eau chaude
- `Hc1DayTemp` - Température jour
- `Hc1NightTemp` - Température nuit

**États et modes :**
- `Status01` / `Status02` - États de la chaudière
- `OperatingMode` - Mode de fonctionnement
- `BurnerStatus` - État du brûleur
- `PumpStatus` - État de la pompe

**Diagnostics :**
- `Pressure` - Pression du circuit
- `FlowRate` - Débit d'eau
- `FanSpeed` - Vitesse du ventilateur
- `ErrorHistory` - Historique des erreurs

**Compteurs :**
- `BurnerStarts` - Nombre de démarrages du brûleur
- `BurnerHours` - Heures de fonctionnement
- `MaintenanceData` - Données d'entretien

## 🔧 Installation

### Prérequis :
1. ebusd déjà installé
2. Adaptateur eBUS C6 connecté
3. Connexion à la chaudière fonctionnelle

### Installation automatique :

```bash
# Télécharger le script
wget [URL_DU_SCRIPT]/install-bridgenet-config.sh

# Rendre exécutable
chmod +x install-bridgenet-config.sh

# Lancer l'installation
./install-bridgenet-config.sh
```

### Installation manuelle :

```bash
# 1. Arrêter ebusd
sudo systemctl stop ebusd

# 2. Sauvegarder la config actuelle
sudo cp -r /etc/ebusd /etc/ebusd.backup

# 3. Cloner le repository
cd /tmp
git clone https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet.git

# 4. Copier les fichiers
sudo cp -r ebusd_configuration_chaffoteaux_bridgenet/ebusd-2.1.x/en/chaffoteaux/* \
    /etc/ebusd/en/chaffoteaux/

# 5. Redémarrer
sudo systemctl start ebusd

# 6. Attendre 2-3 minutes et vérifier
ebusctl info
ebusctl find
```

## 🧪 Tester la nouvelle configuration

### 1. Vérifier la détection

```bash
ebusctl info
```

Vous devriez voir :
```
signal: acquired
messages: [nombre élevé, ex: 400+]
```

### 2. Lister les commandes disponibles

```bash
# Toutes les commandes
ebusctl find

# Commandes de chauffage uniquement
ebusctl find -c heating

# Commandes d'eau chaude
ebusctl find -c dhw

# Commandes en écriture (modifiables)
ebusctl find -w
```

### 3. Tester des lectures

```bash
# Température départ
ebusctl read FlowTemp

# Température de consigne
ebusctl read Hc1HeatSetTemp

# Pression
ebusctl read Pressure

# État de la chaudière
ebusctl read Status01
```

### 4. Tester une écriture

```bash
# Changer la température de consigne (ATTENTION !)
ebusctl write -c Hc1HeatSetTemp 21.0

# Vérifier
ebusctl read Hc1HeatSetTemp
```

## 📊 Comparaison avant/après

### Avec configuration standard :
```bash
$ ebusctl find | wc -l
87  # Seulement 87 commandes

$ ebusctl read FlowTemp
55.0  # Valeur peut-être approximative
```

### Avec configuration BridgeNet :
```bash
$ ebusctl find | wc -l
427  # 427 commandes disponibles !

$ ebusctl read FlowTemp
55.5  # Valeur plus précise

$ ebusctl read BurnerModulation
45%  # Nouvelles données disponibles !
```

## ⚙️ Adapter l'interface web

Maintenant que vous avez plus de commandes disponibles, vous pouvez enrichir l'interface web.

### Nouvelles données à afficher :

```javascript
// Dans chaudiere-control.html, ajouter :

// Pression du circuit
const pressure = await ebusCommand('Pressure');

// État du brûleur
const burnerStatus = await ebusCommand('BurnerStatus');

// Modulation du brûleur (puissance)
const modulation = await ebusCommand('BurnerModulation');

// Température eau chaude
const dhwTemp = await ebusCommand('DHWTemp');
```

## 🐛 Dépannage

### Problème : ebusd ne démarre plus après installation

```bash
# Restaurer l'ancienne configuration
sudo systemctl stop ebusd
sudo rm -rf /etc/ebusd
sudo cp -r /etc/ebusd.backup /etc/ebusd
sudo systemctl start ebusd
```

### Problème : Moins de commandes qu'avant

```bash
# Vérifier quelle configuration est chargée
ebusctl info

# Forcer le scan complet
sudo systemctl stop ebusd
sudo ebusd -f --scanconfig --loglevel=debug
# Observer les logs, puis Ctrl+C
sudo systemctl start ebusd
```

### Problème : Certaines commandes ne fonctionnent pas

Toutes les commandes du repository ne fonctionnent peut-être pas avec votre modèle exact :

```bash
# Tester une commande
ebusctl read CommandName

# Si erreur "not found" ou "no data", cette commande n'existe pas
# sur votre modèle de chaudière
```

## 📚 Ressources

- **Repository BridgeNet** : https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet
- **Documentation ebusd** : https://github.com/john30/ebusd/wiki
- **Forum ebusd** : https://github.com/john30/ebusd/discussions
- **Spécifications eBUS** : https://github.com/john30/ebusd/wiki/Protocol-specification

## 🎓 Aller plus loin

### Analyser les messages

```bash
# Écouter tous les messages en temps réel
ebusctl listen

# Filtrer par circuit
ebusctl listen -c heating

# Format hexadécimal détaillé
ebusctl listen -f
```

### Créer vos propres commandes

Si vous trouvez des messages non documentés :

1. Observez avec `ebusctl listen`
2. Identifiez les patterns
3. Créez un fichier CSV personnalisé dans `/etc/ebusd/en/chaffoteaux/`
4. Testez avec `ebusctl read`

### Contribuer au projet

Si vous découvrez de nouvelles commandes ou corrections :
1. Documentez-les
2. Créez une issue ou pull request sur GitHub
3. Aidez la communauté !

## ⚠️ Avertissements

- **Ne modifiez pas** les paramètres avancés sans connaître leur fonction
- **Sauvegardez** toujours votre configuration avant modification
- **Testez** les nouvelles commandes progressivement
- **Consultez** le manuel de votre chaudière pour les limites
- **Attention** aux paramètres qui peuvent affecter la garantie

## ✅ Recommandations

Pour votre **Chaffoteaux MIRA C GREEN 25** :

1. ✅ **Installez** la configuration BridgeNet (plus complète)
2. ✅ **Testez** les commandes une par une
3. ✅ **Documentez** celles qui fonctionnent
4. ✅ **Adaptez** votre interface web avec les nouvelles données
5. ✅ **Partagez** vos découvertes avec la communauté

---

**Note** : Le repository BridgeNet est le résultat d'un travail de reverse-engineering approfondi. Il est maintenu par la communauté et peut ne pas couvrir 100% des fonctions de votre modèle exact, mais il est significativement plus complet que la configuration standard.
