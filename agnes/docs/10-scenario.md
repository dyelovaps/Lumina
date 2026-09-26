# 10 — Scénario (import de script)

*Extension « Import de scénario » — à activer dans ⚙.*

Collez un scénario : l'app crée d'un coup les **plans** (actions), leurs **durées**, les **dialogues** (envoyés dans l'onglet Voix, jamais dans le prompt vidéo), le **casting vocal**, les **fiches personnages** de la Bible et les **transitions**.

[← Retour au README](../README.md)

---

## Formats reconnus
Vous pouvez mélanger les trois.

**1. Texte libre** : un plan par paragraphe.
```
Plan large d'une rue de Cergy, la nuit, sous la pluie.

Orangella traverse le parking, capuche relevée.
```

**2. Répliques « NOM : texte »**
```
LÉA : Tu savais depuis le début ?
MARC (à voix basse) : Je voulais te protéger.
Voix-off : Ce soir-là, tout a basculé.
```

**3. Scénario classique (format Fountain)**
```
INT. CABINET PRUNIER – NUIT

Léa referme le dossier, le regard dur.

LÉA
(murmurant)
Tu savais depuis le début ?

FONDU AU NOIR.
```

## Ce que l'analyse reconnaît
| Élément | Exemple | Devient |
|---|---|---|
| En-tête de scène | `INT.`, `EXT.`, `SCÈNE 3 –`, `# Titre` | Nouvelle scène, lieu ajouté au prompt (option) |
| Action | Paragraphe normal | Un plan (ou plusieurs selon le découpage) |
| Nom en majuscules seul sur sa ligne | `LÉA` | Personnage qui parle ; les lignes suivantes sont sa réplique |
| Réplique en ligne | `MARC : …` | Dialogue du plan |
| Voix-off | `Voix-off :`, `V.O. :`, `NARRATEUR :` | Réplique du narrateur |
| Didascalie | `(murmurant)`, `(en colère)` | Balise d'émotion pour la voix (option) |
| Transition | `FONDU AU NOIR`, `ENCHAÎNÉ`, `CUT TO` | Transition réglée dans l'Assemblage |
| Liste | `- …`, `1. …` | Un plan par ligne |

Une réplique s'attache au **plan d'action qui la précède** dans la même scène. Si ce plan a déjà une réplique d'un autre personnage, ou si l'option « plan dédié » est cochée, un **gros plan** du personnage qui parle est créé.

## Options
| Option | Effet |
|---|---|
| Mode des plans | Texte → Vidéo, Texte → Image, Ingrédients → Vidéo/Image |
| Découpage des actions | Un plan par **paragraphe**, par **ligne** ou par **phrase** |
| Un plan dédié pour chaque réplique | Chaque réplique a son gros plan (rythme « série verticale ») |
| Ajouter le lieu de la scène au prompt | Ex. « INT. CABINET PRUNIER – NUIT — Léa referme… » |
| Convertir les didascalies en balises | `(murmurant)` → `[whispers]`, `(en colère)` → `[angry]`, `(rire)` → `[laughs]`… Ces balises sont interprétées par **Eleven v3** |
| Créer les fiches personnages dans la Bible | Si l'extension Bible est active, une fiche est créée par personnage, à compléter |

## Étapes
1. Collez le texte, ou **Importer un fichier** (.txt, .md, .fountain, .docx).
2. **Analyser** : l'aperçu affiche le nombre de plans et de scènes, les personnages et la durée estimée.
3. Décochez les plans à ignorer.
4. **Créer les plans** (option : *Lancer la génération tout de suite*).

## Après l'import
- **Bible** : complétez l'ADN de chaque personnage ([11](11-bible.md)).
- **Voix** : choisissez une voix par personnage, puis *Générer les voix manquantes* ([12](12-voix.md)).
- **Durées** : estimées d'après la longueur des répliques, entre 4 et 15 s. Ajustez-les si besoin dans le Storyboard.
