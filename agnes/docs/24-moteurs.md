# 24 — Moteurs de génération (ChatGPT pour les images, Grok ou Google Flow pour les vidéos)

Agnes peut faire générer ses images par **ChatGPT** (votre abonnement, via Codex) au lieu d'Agnes Image, et ses vidéos par **Grok Imagine** (votre abonnement) ou **Google Flow** (vos crédits Google) au lieu d'Agnes Video. Tout le reste ne change pas : file d'attente, prises, image validée puis animation, montage. Si l'abonnement s'arrête, repassez sur **Agnes (gratuit)** : les projets restent identiques.

[← Retour au README](../README.md)

---

## Choisir le moteur
- **⚙ Réglages → Moteurs de génération → Images** : *Agnes Image 2.5 Flash (gratuit)* ou *ChatGPT (Codex)*.
- Ou le bouton **Images : …** du Storyboard (un clic change de moteur).

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
- **⚙ Réglages → Moteurs de génération → Vidéos** : *Agnes Video 2.5 (gratuit)*, *Grok Imagine* ou *Google Flow*. Ou le bouton **Vidéos : …** du Storyboard, ou le badge **Vidéo : …** des cartes vidéo (chaque clic passe au suivant : Agnes → Grok → Flow → Agnes).
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

## Vidéos par Google Flow
- **⚙ Réglages → Moteurs de génération → Vidéos → Google Flow**, ou le badge **Vidéo : …** des cartes (Agnes → Grok → Flow).
- **Mode Flow : Manuel (par défaut) ou Automatique.**
  - Depuis la mise à jour de Flow du 22/09/2026, Google **refuse les générations lancées par une extension** (erreur « PUBLIC_ERROR_UNUSUAL_ACTIVITY ») et accepte seulement le clic humain sur « Générer ». Constaté le 30/09 : tout marche à la main, rien ne passe depuis Lumina ou Agnes. Agnes **ne contourne pas** cette protection.
  - **Manuel** : au lancement de la carte, Agnes vérifie Flow (une seule page, bon compte), puis :
    1. elle envoie l'image de départ dans le projet Flow (sous le nom « Carte NN - titre ») ;
    2. elle copie le prompt vidéo (sinon : bouton « Prompt final » de la carte) ;
    3. elle affiche les réglages à choisir dans Flow.
  - **Vous**, dans Flow : l'image, le prompt (Ctrl + V), le modèle, la durée, le format, puis **Générer**, puis **Télécharger** quand la vidéo est prête.
  - Le **pont** repère la vidéo arrivée dans Téléchargements **après** le lancement. Il la **déplace** dans le dossier Production de la carte (`…\Video\Carte NN - titre.mp4`, voir [26](26-classement.md) ; sans thématique : `Production\_A_classer\<projet>\Video`), et Agnes la range dans la carte (prise « Flow »).
  - Une seule carte attend à la fois ; 45 minutes au plus. Aucune génération n'est lancée par Agnes : pas de risque pour le compte.
  - **Automatique** : gardé tel quel (tout ce qui suit), pour le jour où Flow l'accepterait à nouveau. Aujourd'hui, il est refusé.
- **Uniquement dans Agnes ouverte depuis Lumina**, comme Grok.
- **À lancer avant** :
  1. le service **FlowKit** (dossier `C:\Users\rmaop\Documents\lumina-extension\flowkit-local`, adresse `http://127.0.0.1:8100`) ;
  2. un onglet **flow.google.com** ouvert et connecté à votre compte Google ;
  3. **Flow activé dans Lumina** (onglet Google Flow du panneau : « Connecté »).
  
  Bouton **Tester FlowKit** dans ⚙ : il dit si tout est prêt et quel projet Flow sera utilisé.
- **Projets Flow : une liste partagée entre Agnes et l'onglet Google Flow de Lumina.** Choisir un projet d'un côté le choisit aussi de l'autre, donc Agnes et Lumina travaillent toujours sur le même projet.
  - **Ajouter un projet** : un nom, le lien du projet (copié dans la barre d'adresse de Flow) ou son identifiant, le compte Google du projet (adresse e-mail) et l'abonnement de ce compte (**Gratuit** ou **Pro**).
  - **Ouvrir** : ouvre le projet dans l'onglet Flow déjà ouvert, jamais dans un deuxième onglet.
  - **Retirer** : l'enlève de la liste. Rien n'est supprimé chez Google.
  - Aucune vidéo ne part sans un projet choisi et son abonnement précisé. L'ancien projet saisi à la main rejoint la liste une fois, avec l'abonnement à préciser : retirez-le puis ajoutez-le à nouveau avec l'abonnement.
- **Plusieurs comptes Google** : le compte utilisé est celui connecté dans l'onglet Flow. Pour changer, passez par l'avatar en haut à droite de Flow, puis choisissez dans la liste le projet de ce compte. Les comptes s'ajoutent ou se retirent dans Chrome (comptes Google), pas dans Agnes.
- **Deux navigateurs (deux profils Chrome, deux comptes Google)**. Par exemple : Grok et Agnes sur votre compte habituel, Google Flow sur un compte Pro.
  - Dans chaque profil, ouvrez la petite fenêtre Lumina (icône de l'extension). Elle affiche le compte du profil. Choisissez le **rôle** :
    - **Principal** dans le profil de Grok et d'Agnes ;
    - **Flow seulement** dans le profil du compte Flow Pro.
  - Les boutons interdits dans ce profil sont grisés, et les actions interdites sont refusées même si elles sont demandées autrement. Le profil « Flow seulement » ne prend jamais de travail au pont : aucune génération ne peut partir deux fois.
  - Dans le profil Flow : activez Flow (onglet Google Flow du panneau Lumina) et gardez **une seule** page flow.google.com ouverte.
  - La liste des projets est gardée par le **pont local** (`lancer_pont.bat`), commun aux deux profils : la même liste partout.
  - Le profil Flow dépose régulièrement son bilan au pont : pages Flow ouvertes, compte, pause anti-restriction. Avant chaque vidéo, Agnes lit ce bilan. S'il manque ou a plus d'une minute, si Flow n'est pas activé, si Flow est ouvert deux fois, si le compte ne correspond pas au projet, ou si une pause est en cours, **rien n'est envoyé** et Agnes dit quoi faire.
  - Par défaut, le rôle est **Tout** (Grok, Agnes et Flow dans le même navigateur), comme avant.
- **Vérification avant chaque envoi** (Agnes et Lumina) :
  - Google Flow doit être ouvert **une seule fois**, tous navigateurs confondus. Deux pages Flow (même compte ou non) font redemander la connexion et bloquent les générations.
  - Lumina compte les pages Flow de ce navigateur, repère un autre navigateur relié à FlowKit, et compare le compte ouvert dans Flow à celui du projet.
  - En cas de problème, un avertissement en texte simple s'affiche sous la liste et **rien n'est envoyé**.
  - Lumina ne voit pas un autre navigateur sans Lumina : fermez-y Flow vous-même.
- **Crédits** : chaque vidéo consomme des crédits Google. Depuis la nouvelle version de Flow (flow.google.com), FlowKit ne lit plus le solde : lisez-le sur flow.google.com (menu du compte). Agnes envoie avec chaque vidéo l'abonnement du compte du projet. **1 vidéo par envoi** : « Sorties » > 1 est ignoré.
- **Pas de clé Agnes ni d'imgbb** : les images partent directement à Flow (import sans crédit).

| Carte Agnes | Envoyé à Flow |
|---|---|
| Texte → Image → Vidéo (image validée) / Image → Vidéo | Image de départ (Omni Flash ou Veo 3.1) ; *Scène verrouillée* = même image au début et à la fin (Omni Flash) |
| Début + fin (frames) | Première et dernière image (Omni Flash) |
| Ingrédients → Vidéo, Texte → Vidéo avec références | Références cochées, **7 au plus** (Omni Flash) |
| Texte → Vidéo sans référence | Prompt seul (Omni Flash) |

- **Modèle** : *Omni Flash* (par défaut) ou *Veo 3.1*. Veo ne sait faire que « image de départ seule », en 8 s : pour les autres cartes, Agnes passe en Omni Flash et l'écrit sur la carte.
- **Durée** : Omni Flash arrondit à 4, 6, 8 ou 10 s (≤ 5 s → 4, ≤ 7 s → 6, ≤ 9 s → 8, au-delà 10). **Format** : 9:16 ou 16:9. **Résolution** : 360p ou 720p.
- L'**image intermédiaire** (recette arc face → profil → face) est propre à Grok : Flow l'ignore et le signale.
- Image de départ **et** références sur la même carte : Flow ne sait pas faire les deux, les références sont ignorées (signalé sur la carte).
- Vos règles fixes sont ajoutées au prompt, comme pour Grok. Les vidéos sont rangées comme prises « vidéo · Flow ».

**Garde-fous (pour ne jamais payer deux fois)**
- Une vidéo à la fois ; un envoi par vidéo, **jamais de renvoi automatique**.
- **Rythme anti-restriction** (Lumina, onglet Google Flow : Prudent / Normal / Rapide) : toutes les demandes passent une par une, au moins ~18 s entre deux générations en Normal (~30 s en Prudent). Si Flow signale une limite, Lumina se met en pause (1 min, puis 2, 4… jusqu'à 15 min). **Agnes n'envoie rien pendant cette pause** et vous dit dans combien de temps relancer. Pendant l'attente, Agnes n'interroge Flow que toutes les 15 s (20 s après 2 minutes). Si votre compte a déjà été restreint, passez en **Prudent**.
- **Flow bloqué** (message rouge dans ⚙, bouton *Réactiver Flow*) si :
  - Flow lance plusieurs vidéos pour un seul envoi ;
  - l'envoi est coupé en route ou la réponse est incompréhensible, car on ne sait pas si la vidéo est partie.
  
  Vérifiez le projet Flow, puis réactivez.
- Échec signalé par Flow (contenu refusé…) : la carte passe en erreur avec le motif, rien n'est renvoyé.
- Attente de 15 minutes au plus. En cas d'annulation dans Agnes, la vidéo peut quand même se terminer dans Flow (crédits décomptés) : récupérez-la dans le projet Flow.

**Licence** : FlowKit est un logiciel tiers (licence MIT, github.com/crisng95/flowkit), installé à part. Agnes ne contient aucun de son code : elle envoie seulement des demandes à son service local.

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

