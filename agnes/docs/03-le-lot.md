# 03 — Le lot (traitement par lot)

Deux façons de créer beaucoup de plans d'un coup :
- **Script numéroté** : vous écrivez, pour chaque numéro (01, 02, 03…), un **prompt IMAGE** et/ou un **prompt VIDÉO**. L'app classe tout par numéro et crée les plans dans l'ordre.
- **Opérations sur des fichiers** : un plan (ou un ingrédient) par image ou vidéo déposée, avec le même prompt pour tous.

[← Retour au README](../README.md)

---

## Script numéroté (choix par défaut)

### En bref
1. Écrivez ou collez le script : un bloc par plan, avec son numéro, une ligne `IMAGE :` et/ou une ligne `VIDÉO :`, et si besoin une ligne `RÉF :`.
2. *(Facultatif)* Déposez les images déjà faites ailleurs, nommées `01.png`, `02.png`…
3. Vérifiez la liste, réglez l'enchaînement, puis **Créer les plans**.

### Le script
```
01 — Arrivée
IMAGE : Léa, plan large, entre dans un hall administratif, néons froids
VIDÉO : Elle avance lentement vers le comptoir, la porte se referme derrière elle

02
IMAGE : Gros plan d'un agent derrière son écran, regard fatigué
VIDÉO : Il lève les yeux de son écran sans se lever
RÉF : Marc

03
VIDÉO : Très gros plan, une main pose un dossier sur le comptoir

04
IMAGE : Le comptoir vide, le néon grésille
```
Le bouton **Voir un exemple** remplit la zone avec ce modèle.

**Ce que chaque numéro devient** (toujours **une seule carte** par numéro)
| Dans le script | Image déposée `NN.png` | Carte créée |
|---|---|---|
| IMAGE + VIDÉO | non | **Texte → Image → Vidéo** : l'image est générée avec les références du numéro, vous la validez, puis la même carte l'anime ([02](02-storyboard.md#texte--image--vidéo-une-seule-carte)) |
| IMAGE seule | non | **Texte → Image** (image fixe dans le film) |
| VIDÉO seule | non | **Texte → Vidéo** |
| VIDÉO (IMAGE ignorée) | oui | **Image → Vidéo** qui anime l'image déposée |
| VIDÉO | `NNa` + `NNb` (ou `_debut` / `_fin`) | **Première + dernière frame** |

Les cartes sont ajoutées **à la fin du Storyboard, dans l'ordre des numéros**, avec une étiquette **N° 01**, **N° 02**…

### Références par numéro
Chaque numéro a **ses propres références** (images de la Bibliothèque envoyées avec le prompt IMAGE, ou avec le prompt VIDÉO seul) :
- une ligne **`RÉF : Léa, Marc`** (aussi `Références :`, `Personnages :`, `Avec :`) : les noms sont cherchés dans la Bibliothèque, sans tenir compte des accents ni des majuscules ;
- **sans ligne RÉF**, les noms de la Bibliothèque **cités dans les prompts** sont repris automatiquement (« Léa au comptoir » → Léa) ;
- dans la vérification, retirez une référence (✕) ou ajoutez-en une (**+ ajouter**). Un nom introuvable apparaît en rouge avec « ? » : ajoutez l'image à la Bibliothèque sous ce nom, ou corrigez le script.

Après création, les références se modifient normalement sur chaque carte.

**Formats reconnus** (ils se mélangent)
| Format | Exemple |
|---|---|
| Blocs | `01` puis `IMAGE : …` et `VIDÉO : …` sur les lignes suivantes |
| Titre de plan | `Plan 02 — Le couloir`, `Scène 3`, `**04**`, `[05]` : le texte après le numéro sert de titre |
| Tout sur une ligne | `05 IMAGE : …` · `IMAGE 05 : …` |
| Références | `RÉF : Léa, Marc` · `Personnages : Léa et Marc` |
| Skills | `SKILLS : Voiture — conducteur, UGC smartphone` : skills appliqués au plan, par leur nom ([04](04-skills.md)) |
| Étiquettes | `IMAGE`, `IMG`, `PHOTO`, `VISUEL`, `Prompt image` · `VIDÉO`, `VIDEO`, `ANIMATION`, `MOUVEMENT`, `Prompt vidéo` (majuscules ou non, puces et emojis acceptés) |
| Ancienne liste Stills | `06 : Pluie sur la vitre` : un texte sans étiquette devient le **prompt vidéo** |
| Tableau Markdown | `| 01 | prompt image | prompt vidéo | Léa |` (les colonnes Image / Vidéo / Réf sont reconnues par leur titre) |
| `.csv` | `01;prompt image;prompt vidéo` (séparateur `;`, `,` ou tabulation) |
| `.json` | `[{"n": 1, "image": "…", "video": "…", "refs": ["Léa"]}]` ou `{"01": {"image": "…", "video": "…"}}` |

Un prompt peut s'étaler sur plusieurs lignes : il continue jusqu'à la ligne vide ou l'étiquette suivante.

> ✍️ Dans le prompt **VIDÉO**, décrivez le **mouvement**, pas l'image : elle existe déjà.

### Vérification
La liste montre chaque numéro avec sa miniature (ou « image à générer »), le type de carte, ses deux prompts **modifiables** et ses **références**. Décochez un numéro pour ne pas le créer. En haut, le résumé signale **en rouge** les images sans prompt vidéo, les numéros en double, les images sans numéro et les références introuvables.

> Modifier le script au-dessus met la liste à jour et **efface les corrections** faites dans la liste.

### Réglages du script
| Réglage | Détail |
|---|---|
| **Plans Texte → Image → Vidéo** | **Générer l'image, puis attendre ma validation** (conseillé) : la carte s'arrête sur « image à valider » ; choisissez la variante, puis **Animer cette image →**. **Animer automatiquement** : la vidéo part dès que l'image est prête |
| Variantes par image générée | 2 par défaut : de quoi choisir avant d'animer |
| Tenue de la scène, Mouvement | Pour les plans Image → Vidéo (*Scène verrouillée* + *subtil* par défaut, voir [02](02-storyboard.md#image--vidéo--tenir-la-scène)) |
| Verrou d'identité | Coché par défaut |
| Texte ajouté à chaque prompt vidéo | Ex. `realistic handheld feel` |
| Format, résolution, durée, sorties, skill | Communs à tous les plans. Les images déposées gardent leur propre format (le format Agnes le plus proche) |

**Bon à savoir**
- L'image de départ reste dans sa carte : l'Assemblage n'utilise que la vidéo.
- La Bible ajoute l'ADN des personnages cités, comme pour tout autre plan ([11](11-bible.md)).

## Opérations sur des fichiers
Les fichiers sont toujours traités dans l'**ordre de leur nom** (01, 02, 10… dans l'ordre naturel).

| Opération | Ce qui est créé |
|---|---|
| **Image → Vidéo** | Un plan Image → Vidéo par image |
| **Image → Image** | Un plan Image → Image par image (variantes, changement de style) |
| **Première + dernière frame** | Les images sont prises **par paires** (01+02, 03+04…) : un plan par paire |
| **Ajouter comme ingrédients** | Les images vont dans la Bibliothèque, avec le *Type d'ingrédient* choisi |
| **Vidéo → ingrédients** | La première et la dernière image de chaque vidéo vont dans la Bibliothèque |
| **Vidéo → suite** | La dernière image de chaque vidéo devient la source d'un nouveau plan vidéo, qui prolonge l'action |

Le **prompt commun** s'applique à tous les plans ; `{nom}` est remplacé par le nom du fichier (ex. `Léa_bureau.png` → « Léa_bureau »).

## Lot, Stills → Clip : lequel choisir ?
| Vous avez… | Utilisez |
|---|---|
| Un script avec prompts image **et** vidéo, avec ou sans images | **Le lot → Script numéroté** |
| Seulement des images numérotées et un prompt vidéo par image | Le lot → Script numéroté, ou **Stills → Clip** ([09](09-stills-clip.md)), qui propose en plus le numéro modifiable et le format automatique par image |
| Des fichiers à traiter tous pareil | **Le lot → une opération sur fichiers** |

## Astuces
- Déposer un fichier `.txt`, `.md`, `.csv` ou `.json` dans la zone le charge dans le script.
- Demandez à ChatGPT ou Claude le découpage « sous forme de tableau N° | Prompt image | Prompt vidéo » : il se colle tel quel.
- **Vidéo → suite** permet d'allonger une scène clip par clip en gardant la continuité.
