# 🔥 Schéma Complet du Système de Contrôle Chaudière

## 📊 Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VOTRE SYSTÈME COMPLET                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│  Navigateur │◄────►│  Raspberry   │◄────►│   Adaptateur │
│   Web/Mobile│ WiFi │      Pi      │ USB  │  eBUS C6     │
│             │      │              │      │    Stick     │
└─────────────┘      └──────────────┘      └──────────────┘
                            │                      │
                            │                      │ eBUS
                            │                      │ (2 fils)
                            │                      ▼
                            │              ┌──────────────┐
                            │              │  Chaudière   │
                            │              │  Chaffoteaux │
                            │              │  MIRA C      │
                            │              │  GREEN 25    │
                            │              └──────────────┘
                            │
                   ┌────────┴────────┐
                   │                 │
              ┌────▼────┐      ┌────▼────┐
              │  ebusd  │      │  Node   │
              │ (daemon)│      │  Server │
              │Port 8889│      │Port 3000│
              └─────────┘      └─────────┘
```

## 🔄 Flux de communication détaillé

### 1️⃣ Requête utilisateur : "Changer température à 21°C"

```
┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 1 : Interface Web → Serveur Node.js                   │
└──────────────────────────────────────────────────────────────┘

Navigateur
  │
  │ HTTP GET
  │ http://raspberry:8889/data/Hc1HeatSetTemp/write?21.0
  ▼
Serveur Node.js (port 3000)
  │
  │ Proxy/Redirect
  ▼
ebusd API (port 8889)


┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 2 : ebusd traite la requête                           │
└──────────────────────────────────────────────────────────────┘

ebusd reçoit : "Hc1HeatSetTemp/write?21.0"
  │
  │ 1. Cherche dans fichiers CSV
  │    → /etc/ebusd/en/chaffoteaux/15.mira-c-green.csv
  │
  │ 2. Trouve la définition :
  │    w,,Hc1HeatSetTemp,Heating circuit 1 heat setpoint,,,2B00,,temp1c,
  │         │                                             ││
  │         │                                             │└─ Type: temp1c
  │         │                                             └─── Commande: 2B00
  │         └───────────────────────────────────────────────── Type: write
  │
  │ 3. Convertit 21.0°C en format eBUS
  │    21.0 → 0x2A 0x01 (hexadécimal)
  │
  │ 4. Construit le message eBUS complet
  │    QQ  ZZ  PB  SB  NN  DATA    CRC
  │    10  08  2B  00  02  2A 01   [calculé]
  │    │   │   │   │   │   │   │
  │    │   │   │   │   │   │   └─ Checksum
  │    │   │   │   │   │   └───── 21.0°C en hex
  │    │   │   │   │   └────────── 2 octets de données
  │    │   │   │   └────────────── Sous-commande 00
  │    │   │   └────────────────── Commande principale 2B
  │    │   └────────────────────── Destination : chaudière (08)
  │    └────────────────────────── Source : PC/adaptateur (10)
  │
  ▼
Message hex complet : 10 08 2B 00 02 2A 01 [CRC]


┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 3 : Transmission USB → Adaptateur eBUS                │
└──────────────────────────────────────────────────────────────┘

ebusd
  │
  │ Envoi via /dev/ttyUSB0
  │ Vitesse : 115200 bauds
  │ Voltage : 5V (TTL)
  │ Message : 10 08 2B 00 02 2A 01 [CRC]
  ▼
┌─────────────────────────────────┐
│   Adaptateur eBUS C6 Stick      │
│                                 │
│  ┌────────────────────────────┐ │
│  │  1. Réception USB          │ │
│  │     115200 bauds, 5V       │ │
│  │         │                  │ │
│  │         ▼                  │ │
│  │  2. Isolation galvanique   │ │
│  │     (Protection)           │ │
│  │         │                  │ │
│  │         ▼                  │ │
│  │  3. Conversion voltage     │ │
│  │     5V → 15-24V            │ │
│  │         │                  │ │
│  │         ▼                  │ │
│  │  4. Adaptation vitesse     │ │
│  │     115200 → 2400 bauds    │ │
│  │         │                  │ │
│  │         ▼                  │ │
│  │  5. Attente du bus libre   │ │
│  │     (arbitrage eBUS)       │ │
│  │         │                  │ │
│  │         ▼                  │ │
│  │  6. Émission sur eBUS      │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
  │
  │ Bus eBUS (2 fils)
  │ Voltage : 15-24V DC
  │ Vitesse : 2400 bauds
  │ Message : 10 08 2B 00 02 2A 01 [CRC]
  ▼


┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 4 : Chaudière reçoit et traite                        │
└──────────────────────────────────────────────────────────────┘

Chaudière Chaffoteaux MIRA C GREEN 25
  │
  │ 1. Carte électronique reçoit le signal eBUS
  │
  │ 2. Décode le message
  │    10 08 2B 00 02 2A 01 [CRC]
  │    │  │  │  │  │  │  │
  │    │  │  │  │  │  │  └─ Vérifie CRC → OK
  │    │  │  │  │  │  └──── Décode 2A 01 → 21.0°C
  │    │  │  │  │  └─────── 2 octets attendus
  │    │  │  │  └────────── Commande : Set température
  │    │  │  └───────────── Fonction : Chauffage
  │    │  └──────────────── Pour moi (adresse 08)
  │    └───────────────────── De l'adaptateur (adresse 10)
  │
  │ 3. Applique la consigne
  │    → Mémoire interne : Hc1SetTemp = 21.0°C
  │    → Régulation thermique ajustée
  │
  │ 4. Prépare la réponse (ACK)
  │    08 00 00  (OK, pas d'erreur)
  │    │  │  │
  │    │  │  └─ ACK : 00 = succès
  │    │  └──── Pas de données en retour
  │    └─────── De la chaudière
  │
  ▼
Réponse : 08 00 00


┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 5 : Retour de la réponse                              │
└──────────────────────────────────────────────────────────────┘

Chaudière
  │ Bus eBUS
  │ 08 00 00
  ▼
Adaptateur eBUS C6
  │ Reconversion : 24V → 5V, 2400 → 115200 bauds
  │ USB
  ▼
ebusd
  │ Décode : 00 = succès
  │ HTTP Response
  ▼
Serveur Node.js
  │ JSON Response
  ▼
Navigateur
  │ Affiche : "✓ Température réglée à 21.0°C"
  └──


┌──────────────────────────────────────────────────────────────┐
│ ÉTAPE 6 : Vérification (lecture)                            │
└──────────────────────────────────────────────────────────────┘

2 secondes plus tard, l'interface lit la température :

HTTP GET http://raspberry:8889/data/Hc1HeatSetTemp
  │
  ▼
ebusd construit : 10 08 2B 00 00 [CRC] (lecture, 0 octet de données)
  │
  ▼
Adaptateur → eBUS → Chaudière
  │
  ▼
Chaudière répond : 08 10 2B 00 02 2A 01 [CRC] 00
                    │  │  │  │  │  │  │      │
                    │  │  │  │  │  │  │      └─ ACK
                    │  │  │  │  │  │  └──────── Valeur : 21.0°C
                    │  │  │  │  │  └─────────── Valeur : 21.0°C
                    │  │  │  │  └────────────── 2 octets
                    │  │  │  └───────────────── Commande
                    │  │  └──────────────────── Fonction
                    │  └─────────────────────── Vers adaptateur
                    └────────────────────────── De la chaudière
  │
  ▼
eBUS → Adaptateur → ebusd
  │
  │ Décode : 2A 01 → 21.0°C
  ▼
Interface affiche : "Température cible : 21.0°C"
```

## 📋 Résumé des conversions

```
┌──────────────────────────────────────────────────────────────┐
│           CONVERSIONS À CHAQUE ÉTAPE                         │
└──────────────────────────────────────────────────────────────┘

Utilisateur tape : "21°C"
        │
        │ JavaScript
        ▼
API : "Hc1HeatSetTemp/write?21.0"
        │
        │ ebusd (fichiers CSV)
        ▼
Commande eBUS : "2B 00" + données
        │
        │ Encodage température
        ▼
Hexadécimal : "2A 01" (21.0°C = 420/20 = 0x01A4)
        │
        │ Protocole eBUS
        ▼
Message complet : "10 08 2B 00 02 2A 01 [CRC]"
        │
        │ Adaptateur
        ▼
Signal électrique : modulation 24V DC à 2400 bauds
        │
        │ Bus eBUS (2 fils)
        ▼
Chaudière reçoit et décode
```

## 🎯 Points clés à retenir

1. **Les fichiers CSV** : Contiennent la "traduction" entre noms lisibles et codes hexadécimaux
2. **L'adaptateur C6** : Fait SEULEMENT la conversion électrique (voltage, vitesse)
3. **ebusd** : Fait TOUT le travail intelligent (protocole, encodage, décodage)
4. **Le protocole eBUS** : Système maître-esclave avec arbitrage du bus
5. **BridgeNet** : Variante Chaffoteaux avec commandes supplémentaires

## 🔐 Sécurité du système

```
Protection multi-niveaux :

1. Isolation galvanique dans l'adaptateur
   → Protège le Raspberry Pi des surtensions

2. Checksums dans tous les messages
   → Détecte les erreurs de transmission

3. ACK/NACK de la chaudière
   → Confirme la bonne réception

4. Limites dans ebusd
   → Empêche les valeurs aberrantes

5. Sécurités de la chaudière
   → Refuse les commandes dangereuses
```

## 📚 Glossaire

- **eBUS** : Energy Bus, protocole série 2400 bauds
- **BridgeNet** : Variante propriétaire Chaffoteaux du protocole eBUS
- **ebusd** : Daemon (service) qui gère la communication eBUS
- **CSV** : Fichiers de configuration (commandes disponibles)
- **QQ** : Adresse source du message
- **ZZ** : Adresse destination
- **PBSB** : Primary/Secondary Byte (commande)
- **CRC** : Checksum pour vérifier l'intégrité
- **ACK** : Acknowledgment (accusé de réception)
- **TTL** : Transistor-Transistor Logic (signaux 5V)
- **Arbitrage** : Mécanisme pour éviter les collisions sur le bus

---

Ce schéma vous montre exactement comment votre simple clic "Appliquer" se transforme en signaux électriques compréhensibles par votre chaudière ! 🔥
