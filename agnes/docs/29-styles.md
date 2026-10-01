# 29 — Styles de prompt (01/10/2026)

Extension **Styles de prompt** (`plugins/plugin-styles.js`, active par défaut). Où la régler : **onglet Projet → carte
« Style des prompts »**.

## À quoi ça sert

À chaque envoi (ChatGPT, Grok, Agnes, Flow), Agnes ajoute des règles au prompt. Avant le 01/10, c'étaient les règles
d'Anthony pour **tous** les projets : jeu subtil, « aucun texte » dans l'image, « No music », et un compteur de répliques
de 150 à 180 caractères. Elles bloquaient les séries et le cartoon. Désormais, ces règles dépendent du **style du projet**.

| Style d'origine | Règles images / vidéos | Textes écrits | Musique | Compteur de répliques |
|---|---|---|---|---|
| Réaliste — Marketing (avatar) | jeu subtil (règles d'avant) | non (« No text ») | non | Anthony |
| Série réaliste | jeu subtil | non | non | Série (0 à 140, pas de minimum) |
| Cartoon / satire | jeu cartoon expressif, satire inoffensive | **gardés** | **permise** | Série |

**Style automatique** (projet sans style choisi) : « Réaliste — Marketing » si le nom du projet contient *Marketing*,
sinon « Série réaliste ».

## Modifier les styles

Dans la carte, ouvrez **« Modifier les styles »** :
- **Nouveau / Dupliquer / Supprimer** ;
- pour chaque style : nom, règles images, règles vidéos (en anglais), case « Garder les textes écrits », case
  « Musique et bruitages permis », compteur de répliques, note ;
- **Rétablir les styles d'origine** : remet les 3 styles d'origine et garde les vôtres.

La liste est commune à tous les projets. Le choix vaut pour un projet. Choisir un style règle aussi le compteur de
répliques du projet.

Règles **toujours** ajoutées, quel que soit le style : image nette sans grain ; « no subtitles, no watermark ».

## Répliques et textes écrits (js/dialogue-propre.js → `estReplique`)

Un texte entre guillemets est une **réplique** s'il suit un verbe de parole (says, asks, replies, shouts, dit,
répond…), le mot voice ou dialogue, ou deux-points. C'est un **texte écrit** (ou un bruitage) s'il suit reads, labeled,
marked, written, displays… ou s'il n'y a pas de verbe de parole avant les guillemets “ ” ou " ". Les « … » restent des
répliques par défaut (prompts marketing). Les textes entre apostrophes 'TOUT VA BIEN' ne sont jamais des répliques.
Utilisé par le compteur des cartes, le nettoyage des répliques avant Grok et `set_replique` du Chef.

## Pour Claude

`python agnes.py styles` (style du projet + liste) · `python agnes.py style nom="Cartoon / satire"`.

## Pack de skills « Cartoon & satire (master prompt) »

Skills → Import en masse → Packs : fiction cartoon (ouverture), satire inoffensive (fin), textes écrits exacts, fumée
cartoon (au lieu d'explosion), surprise comique (au lieu de panique), une seule action, répliques françaises bien jouées.
Fiche complète : `Production\Serie\_MASTER_PROMPT_images_videos.md`.

Tests : `tests/agnes-styles.test.cjs` (Lumina).

## Atelier IA

Les consignes communes des agents (`common()` de plugin-atelier.js) et celles du Chef indiquent le style du projet :
- textes écrits permis ou interdits ;
- musique permise ou interdite ;
- jeu subtil ou cartoon.

`mesurer_replique` sans réglage prend le réglage du projet. Voir [21](21-atelier.md).
