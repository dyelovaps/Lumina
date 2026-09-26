# 04 — Skills

Un **skill** = un **nom visible** (ce que vous choisissez) + une **action cachée**, le texte technique ajouté au prompt final. Vous travaillez en langage simple, et l'app envoie la bonne formulation.

[← Retour au README](../README.md)

---

## Skills intégrés
| Catégorie | Skills |
|---|---|
| Mouvements de caméra | Travelling avant, Travelling arrière, Travelling latéral, Panoramique, Tilt, Orbite, Caméra épaule, Plan fixe, Grue / drone montant, Dolly zoom (vertigo) |
| Cadrages | Très gros plan, Gros plan, Plan américain, Plan large, Par-dessus l'épaule |
| Angles | Contre-plongée, Plongée, Angle droit (profil) |
| Lumière | Heure dorée, Néons nocturnes, Clair-obscur, Lumière naturelle |
| Styles | Réalisme brut, 3D style Pixar, Cyber-noir |
| Règles | Sans texte ni musique, Fiche personnage |

Survolez un skill pour lire son **explication**. Chaque skill vise l'image, la vidéo ou les deux. Un skill vidéo ajouté à un plan image est grisé et ignoré.

## Créer ou modifier un skill
| Champ | Rôle |
|---|---|
| Nom visible | Ce qui apparaît dans les menus |
| Catégories | Séparées par des virgules. Un skill peut être dans plusieurs catégories |
| Explication | Infobulle pour comprendre l'effet (utile pour débuter) |
| Action cachée | Le texte ajouté au prompt, de préférence en anglais (ex. `slow dolly-in camera move toward the subject, smooth and steady`) |
| S'applique à | Image et vidéo / Vidéo seulement / Image seulement |

Boutons : **Enregistrer le skill** · **Nouveau** · **Dupliquer** · **Supprimer**.

## Importer en masse
Dans la carte de création, section **Importer en masse** (le bouton **Importer en masse ↓** de la liste y mène).

1. Choisissez la source :
   - **Packs prêts à l'emploi** : un clic charge le pack ;
   - **fichiers** glissés dans la zone ou choisis (plusieurs à la fois) : `.md`, `.txt`, `.csv`, `.json` ;
   - **…ou collez du texte**, puis **Analyser le texte**.
2. Réglez les options :
   - **Catégorie ajoutée à tous** : par exemple « Position spatiale » pour tout le lot (liste des catégories existantes proposée) ;
   - **Remplacer les catégories des fichiers par celle-ci** ;
   - **Si un skill du même nom existe** : le garder tel quel, le **mettre à jour** (les plans qui l'utilisent suivent), ou ajouter une copie.
3. Vérifiez l'**aperçu** : chaque skill avec son état (*nouveau*, *mise à jour*, *existe déjà : ignoré*), ses catégories, sa cible et son action. Décochez ceux à laisser de côté.
4. **Importer**. La liste se filtre sur la catégorie importée. Les options sont remises à zéro pour le prochain import.

### Les packs
| Pack | Contenu |
|---|---|
| **Positions spatiales** (25) | Voiture (conducteur, face caméra au tableau de bord, passager, banquette arrière, vu à travers le pare-brise), selfie, face caméra, studio fond uni, bureau, comptoir, canapé, lit, cuisine, selfie miroir, marche et parle, rue, terrasse, métro/bus, ascenseur, couloir, fenêtre, abribus sous la pluie, parking souterrain, salle de sport, vue subjective |
| **Styles visuels** (20) | Animé japonais, Brainrot (et son rythme vidéo), UGC smartphone, publicité premium, vlog, documentaire, cinéma 35 mm, film noir, VHS années 90, soap/télénovela, cartoon 2D, bande dessinée, aquarelle, pâte à modeler, stop motion, pixel art, 3D low-poly, épuré, onirique |

Les mêmes packs existent en fichiers dans `skills-packs/` : ce sont aussi des exemples du format, à copier et modifier. Un pack déjà installé affiche ✓ ; le réinstaller ne crée pas de doublon.

### Formats de fichier
**Markdown / texte** (`.md`, `.txt`) : un titre `#` = la catégorie, un titre `##` = un skill.
```
# Position spatiale

## Voiture — conducteur
Explication : le personnage conduit, filmé depuis le siège passager.
Catégories : Position spatiale, Véhicule      (facultatif, sinon celle du #)
Cible : image et vidéo                        (image, vidéo, ou image et vidéo)
Action : the character sits in the driver's seat of a car,
hands on the steering wheel                   (l'action peut tenir sur plusieurs lignes)
```
Format court, un skill par ligne sous une catégorie :
```
# Lumière
- Néon rose : pink neon light, glowing reflections
- Contre-jour : strong backlight, rim light around the subject
```
Un fichier sans titre `##` ni ligne `- Nom : action` devient un seul skill (le fichier entier).

**CSV** (`.csv`, séparateur `;`, `,` ou tabulation) : une ligne par skill. En-tête facultatif, colonnes dans n'importe quel ordre : `nom;catégories;action;explication;cible` (plusieurs catégories séparées par `|` ou `,`).

**JSON** : l'export de l'app, un tableau de skills (`title`, `action`, `categories`, `description`, `target`), le format **AIStudioGuide** (`promptBlocks`) ou des tableaux imbriqués avec `prompt` / `name`.

**Modèle .md** et **Modèle .csv** téléchargent un exemple prêt à remplir.

## Exporter
**Exporter en JSON** : sauvegarde de tous vos skills, ou partage avec une autre installation (réimportable par l'import en masse).

## Les skills dans les scripts (automatisation)
Dans un script de **Le lot**, une ligne `SKILLS :` applique des skills au plan, par leur nom (sans tenir compte des accents ni des majuscules) :
```
01 — Pub café
IMAGE : a young woman holding a coffee cup
VIDÉO : she smiles and talks to camera
SKILLS : Voiture — face caméra (tableau de bord), UGC smartphone
```
Un nom inconnu apparaît en rouge dans la vérification. Les agents **Prompt Image** et **Storyboard → Le lot** de l'Atelier IA, ainsi que la conversion en prompts d'**Extraire**, connaissent la liste de vos skills et peuvent écrire cette ligne eux-mêmes ([21](21-atelier.md), [19](19-extracteur.md)).

## Skill → Clip
Pour **tester des mouvements de caméra** ou créer vite des plans à partir de skills.
1. Cochez un ou plusieurs skills.
2. Décrivez le **sujet / la scène**.
3. Choisissez le **mode** (et l'*image source* si le mode part d'une image).
4. Choisissez la **répartition** :
   - **Un clip combinant les skills** : un seul plan qui cumule tous les effets ;
   - **Un clip par skill** : un plan par skill, idéal pour **comparer** plusieurs mouvements sur la même image.
5. Réglez format, durée, sorties, puis **Créer le(s) clip(s)**.
