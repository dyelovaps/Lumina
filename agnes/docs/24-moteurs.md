# 24 — Moteurs de génération (ChatGPT pour les images, Grok pour les vidéos)

Agnes peut faire générer ses images par **ChatGPT** (votre abonnement, via Codex) au lieu d'Agnes Image, et ses vidéos par **Grok Imagine** (votre abonnement) au lieu d'Agnes Video. Tout le reste ne change pas : file d'attente, prises, image validée puis animation, montage. Si l'abonnement s'arrête, repassez sur **Agnes (gratuit)** : les projets restent identiques.

[← Retour au README](../README.md)

---

## Choisir le moteur
- **⚙ Réglages → Moteurs de génération → Images** : *Agnes Image 2.5 Flash (gratuit)* ou *ChatGPT (Codex)*.
- Ou le bouton **🖼 Images : …** du Storyboard (un clic change de moteur).

Concerne toutes les images : plans Texte → Image / Image → Image, **image de départ** des plans Texte → Image → Vidéo, planches personnages.

## Pré-requis pour ChatGPT
1. L'app **Codex** installée et connectée à votre compte ChatGPT (comme pour prod-fruits).
2. Le **pont local** lancé : `lancer_pont.bat` dans le dossier prod-fruits (laissez la fenêtre ouverte). Bouton **Tester le pont** dans ⚙.
3. C'est tout : **pas de clé Agnes ni d'imgbb** pour les images ChatGPT (les références partent en fichiers, sur votre PC).

## Ce qui est envoyé à ChatGPT
- Le prompt final du plan (description, skills, style du projet, ADN de la Bible).
- Les **références** du plan (personnages, décors, objets de la bibliothèque), avec leur nom.
- Le format du plan : 9:16, 16:9, 3:4 (planche : le fond est prolongé, rien n'est coupé), 1:1…
- Vos règles fixes : image nette sans grain, aucun texte incrusté (sauf le bandeau nom d'une **planche**, détectée par le skill *Fiche personnage* ou un prompt « planche / character sheet »).

## À savoir
- Une image à la fois, **1 à 3 minutes** chacune ; plusieurs sorties = plusieurs images à la suite. La carte affiche la position dans la file.
- Les images ChatGPT sont marquées `source: "chatgpt"` dans les prises.
- Pour animer une image ChatGPT avec **Agnes Video**, la clé Agnes (et imgbb) reste nécessaire, comme avant.
- Si le pont redémarre pendant une génération, la carte passe en erreur : relancez le plan.

---

## Vidéos par Grok
- **⚙ Réglages → Moteurs de génération → Vidéos** : *Agnes Video 2.5 (gratuit)* ou *Grok Imagine*. Ou le bouton **🎬 Vidéos : …** du Storyboard, ou le badge 🎬 des cartes vidéo.
- **Uniquement dans Agnes ouverte depuis Lumina** (onglet Agnes du panneau → Ouvrir Agnes Studio) : c'est l'extension qui pilote l'onglet Grok. Dans l'`index.html` ouvert directement, le choix Grok est refusé.
- Gardez un onglet **grok.com/imagine** ouvert et connecté. Il passe au premier plan pendant chaque génération ; une vidéo à la fois (les suivantes attendent).
- **Pas de clé Agnes ni d'imgbb** : l'image de départ et les références partent en fichiers.

| Carte Agnes | Envoyé à Grok |
|---|---|
| Texte → Image → Vidéo (image validée) | Image → Vidéo depuis l'image validée ; *Scène verrouillée* = début et fin sur la même image |
| Image → Vidéo | Image source, ou **dernière image du plan précédent** |
| Début + fin (frames) | Première et dernière image |
| Texte → Vidéo | Prompt + références cochées |
| Ingrédients → Vidéo | Références cochées |

- **Durée** : arrondie aux durées de Grok (≤ 7 s → 6 s, ≤ 12 s → 10 s, au-delà 15 s). **Format** : 9:16, 16:9 ou 1:1 (le plus proche).
- **Résolution** (480p / 720p / 1080p) et **qualité** (Rapide / Qualité) dans ⚙. Si Grok ne propose pas 1080p à votre compte, il reste en 720p ; le bouton **⬇ 1080p** des cartes agrandit ensuite la vidéo.
- Vos règles fixes sont ajoutées au prompt : jeu subtil, regard vers l'interlocuteur, image nette, **pas de musique**.
- Les vidéos sont rangées comme prises (« vidéo · Grok ») et gardent le fichier : elles vont directement dans l'Assemblage.
- Si le panneau Lumina lance un lot Grok en même temps, l'onglet refuse la seconde génération (« déjà en cours ») : lancez l'une après l'autre.

