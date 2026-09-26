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

---

## Mode tout gratuit (Agnes Image + Agnes Video) — ce que l'app fait pour la qualité
- **Images avec références** : le prompt nomme chaque image envoyée, dans l'ordre (`<Picture 1> = Léa (character), <Picture 2> = Café Rivoli (place)`), comme le recommande la fiche Agnes 2.5 ([structure des prompts](structure_prompt_agnes2.5flash.md)). Sans cela, le modèle ne sait pas quelle photo correspond à quel personnage.
- **Vos règles fixes sur tous les moteurs** : jeu subtil, regard vers l'interlocuteur, image nette sans grain, sans texte (sauf bandeau nom d'une planche), sans musique. Ajoutées seulement si le prompt ne les contient pas déjà.
- **Agents de l'Atelier** : ils écrivent dans l'ordre de la fiche Agnes 2.5 (image : sujet → décor → style → lumière → composition → qualité ; vidéo : sujet → action → caméra → style → cohérence).
- **Montage** : sortie 1080p par défaut avec agrandissement « net » des vidéos 720P (Agnes Video Flash) ; bouton **⬇ 1080p** sur chaque carte vidéo.

**Conseils pour tirer le maximum du gratuit**
- Passez par l'**image validée** (Texte → Image → Vidéo) : 2 à 4 variantes, choisissez la meilleure, puis animez. C'est le levier n°1 de netteté et de cohérence.
- Une **planche par personnage** dans la Bibliothèque, sous le même nom que dans la Bible et les mentions `@[Nom]`.
- **Scène verrouillée** + mouvement **subtil** pour les dialogues ; « Standard » seulement pour les plans d'action.
- Plans de **6 à 8 s** : au-delà, Agnes Video Flash dérive plus souvent (visages, décor).
- Contrôle : en mode manager, Claude exporte les rendus (`agnes.py exporter_prises`) et les regarde un par un avant l'animation.

