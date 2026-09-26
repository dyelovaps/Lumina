# 08 — Projet

Réglages par défaut du projet actif, export, stockage et gestion des projets.
Un **projet = un épisode** (ou un court métrage). Le sélecteur en haut à droite change de projet ; **+** en crée un nouveau.

[← Retour au README](../README.md)

---

## Réglages du projet
| Champ | Détail |
|---|---|
| Nom du projet | Ex. « BlackLaw ép. 3 » |
| Style de base | Ajouté à **chaque** plan (ex. `cinematic, 35mm, natural skin texture`). Pour un style commun à **toute une série**, utilisez plutôt la Bible |
| Prompt négatif par défaut | Ex. `text, subtitles, watermark, extra fingers` |
| Format / Résolution par défaut | Pour les nouveaux plans |
| Seed du projet | Seed commun, pour des résultats plus homogènes (vide = hasard) |
| Durée vidéo / Sorties par défaut | Pour les nouveaux plans |
| Images / seconde (vidéo) | Envoyé à Agnes (24 conseillé) |
| Générations simultanées | 1 à 4 |

**Enregistrer le projet** applique les changements aux **nouveaux** plans. Les plans existants gardent leurs réglages : utilisez la sélection multiple du Storyboard pour les modifier.

## Export
**Exporter le projet en .zip** crée une archive qui contient :
- les plans numérotés dans l'ordre (`01_…mp4`, `02_…png`) ;
- `projet.json` (tous les réglages et prompts finaux) et `montage.txt` (déroulé) ;
- `ingredients/` (bibliothèque), `voix/` et `musique/` si ces extensions sont utilisées.

*Inclure toutes les prises* ajoute aussi les prises non sélectionnées.

## Stockage
- **Protéger le stockage contre le nettoyage du navigateur** : demande au navigateur de ne jamais effacer vos données tout seul. À faire une fois.
- **Supprimer les médias orphelins** : libère la place des fichiers qui ne sont plus utilisés par aucun plan.
- L'espace utilisé est affiché.

## Tous les projets
Liste de vos projets (nombre de plans et d'ingrédients). Le bouton **Activer** ouvre un projet.
**Dupliquer le projet actif** (ex. pour partir d'un épisode modèle) · **Supprimer le projet actif**.

> Pour une série, donnez à chaque épisode le **même nom de série** (onglets Publication, Épisodes ou Planning) : la Bible, le récap et le planning s'en servent pour relier les épisodes.
