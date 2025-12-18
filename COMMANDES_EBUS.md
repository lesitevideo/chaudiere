# 📋 Commandes eBUS pour Mira C Green BridgeNET

Ce document liste toutes les commandes eBUS utilisées dans l'interface web, basées sur le fichier CSV de configuration `mira_c_green.csv`.

## 🔥 Chauffage - Zone 1

### Lecture (Read)
| Commande | Description | Type |
|----------|-------------|------|
| `water_temp_out` | Température de départ du circuit | Read |
| `water_temp_in` | Température de retour du circuit | Read |
| `ext_temp` | Température extérieure | Read |
| `z1_room_temp` | Température pièce zone 1 | Read |
| `z1_target_temp` | Température cible zone 1 | Read |
| `z1_heating_activation` | État activation chauffage zone 1 | Read |
| `z1_water_max_temp` | Température eau max zone 1 | Read |

### Écriture (Write)
| Commande | Description | Plage | Unité |
|----------|-------------|-------|-------|
| `z1_fixed_temp` | Température eau fixe zone 1 (mode fixe) | 35-65* | °C |
| `z1_day_temp` | Température ambiante jour zone 1 (thermorégulation) | 5-35 | °C |
| `z1_night_temp` | Température ambiante nuit zone 1 (thermorégulation) | 5-35 | °C |

**Important :** L'interface utilise `z1_fixed_temp` pour contrôler directement la température de l'eau de chauffage en mode fixe (sans thermorégulation). La plage recommandée est 35-65°C pour des radiateurs classiques. Pour un mode basse température (plancher chauffant), utiliser 20-45°C.

## 💧 Eau Chaude Sanitaire (DHW)

### Lecture (Read)
| Commande | Description | Type |
|----------|-------------|------|
| `dhw_status` | État activation ECS | Read |
| `dhw_real_temp` | Température réelle ECS | Read |
| `dhw_target_temp` | Température cible ECS | Read |
| `dhw_antifreeze_temp` | Température antigel ECS | Read |
| `dhw_comfort_mode_status` | État mode confort | Read |

### Écriture (Write)
| Commande | Description | Plage | Unité |
|----------|-------------|-------|-------|
| `dhw_target_temp` | Température cible ECS | 35-65 | °C |
| `dhw_comfort_mode_status_w` | Activer/désactiver mode confort | 0/1 | booléen |

## 📊 État de la Chaudière

### Informations Générales
| Commande | Description | Type |
|----------|-------------|------|
| `boiler_status` | État général de la chaudière | Read |
| `heating_status` | État du chauffage | Read |
| `heating_flame` | État de la flamme | Read |
| `fan_speed` | Vitesse du ventilateur | Read (rpm) |
| `ignition_cycles` | Nombre de cycles d'allumage | Read |

## ⚙️ Paramètres Avancés

### Thermorégulation Zone 1
| Commande | Description | Type |
|----------|-------------|------|
| `z1_thermoreg_slope` | Pente thermorégulation | Read |
| `z1_thermoreg_offset` | Décalage thermorégulation | Read |

### Système SRA
| Commande | Description | Type |
|----------|-------------|------|
| `sra_status` | État du système SRA | Read |
| `boost_time` | Temps boost (secondes) | Read |

### Erreurs
| Commande | Description | Type |
|----------|-------------|------|
| `error_code` | Code d'erreur actuel | Read |

## 🔧 Utilisation avec ebusd

### Format de lecture
```bash
# Via ebusctl
ebusctl read water_temp_out

# Via HTTP API (port 8889)
curl http://localhost:8889/data/water_temp_out
```

### Format d'écriture
```bash
# Via ebusctl
ebusctl write z1_day_temp 21.5

# Via HTTP API (port 8889)
curl http://localhost:8889/data/z1_day_temp/write?21.5
```

## 📝 Notes Importantes

1. **Configuration ebusd** : Assurez-vous que ebusd est configuré avec le fichier CSV `mira_c_green.csv` du dépôt [ebusd_configuration_chaffoteaux_bridgenet](https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet)

2. **Port HTTP** : L'interface web utilise le port **8889** pour communiquer avec ebusd

3. **Actualisation** : Les données sont automatiquement actualisées toutes les 30 secondes

4. **Commandes non supportées** : Si une commande retourne "-" ou une erreur, elle peut ne pas être supportée par votre modèle de chaudière

## 🔍 Commandes Supplémentaires Disponibles

Le fichier CSV contient d'autres commandes non utilisées dans l'interface actuelle :

### Zones supplémentaires (Z2-Z7)
- `z2_room_temp`, `z3_room_temp`, etc.
- `z2_target_temp`, `z3_target_temp`, etc.
- `z2_heating_activation`, `z3_heating_activation`, etc.

### Temporisation
- `timer_day_part_1` à `timer_day_part_14`
- Configuration des plages horaires

### Historique d'erreurs
- `error_slot_1_code` à `error_slot_10_code`
- `error_slot_1_date` à `error_slot_10_date`

## 🎯 Pour Aller Plus Loin

Si vous souhaitez ajouter d'autres fonctionnalités :

1. **Multi-zones** : Ajouter le support des zones 2-7
2. **Programmation horaire** : Implémenter les timer_day_part
3. **Historique d'erreurs** : Afficher les 10 dernières erreurs
4. **Graphiques** : Ajouter des graphiques de température
5. **Notifications** : Alertes en cas d'erreur

## 📚 Référence

- [Dépôt ebusd_configuration_chaffoteaux_bridgenet](https://github.com/ysard/ebusd_configuration_chaffoteaux_bridgenet)
- [Documentation ebusd](https://github.com/john30/ebusd)
- [Wiki ebusd](https://github.com/john30/ebusd/wiki)
