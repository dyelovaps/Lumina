# Lumina — Grok & Google Flow

Lot Imagine pour [grok.com/imagine](https://grok.com/imagine).

## Agnes : Styles de prompt, séries débloquées (1.13.7, 01/10/2026)

Copie `agnes/` mise à jour (`npm run sync:agnes`). Agnes 3.12, détail dans `agnes/docs/29-styles.md`.

**Le problème.** Les règles marketing s'appliquaient à **tous** les projets et bloquaient les séries :
- compteur de répliques Anthony (150 à 180 caractères) ;
- jeu subtil ;
- « No text » et « No music ».

Les textes écrits entre guillemets (la tasse “TOUT VA BIEN”) étaient aussi pris pour des répliques.

**Ce qui change :**
- **Extension Styles de prompt** (`plugins/plugin-styles.js`). Onglet Projet → **Style des prompts** :
  - les 3 styles d'origine sont Réaliste — Marketing (inchangé), Série réaliste et Cartoon / satire ;
  - on peut ajouter, modifier, dupliquer et supprimer des styles ;
  - chaque style règle les règles images et vidéos, les textes écrits gardés, la musique permise et le compteur de répliques.
- **`plugin-moteurs.js` :** `quality` passe par `styleRule` et `textRule` du style du projet. Sans l'extension, les règles d'origine s'appliquent.
- **`js/dialogue-propre.js` → `estReplique` :** distingue une réplique (verbe de parole, deux-points) d'un texte écrit ou d'un bruitage (reads, labeled, marked…). Elle sert au compteur des cartes, au nettoyage avant Grok et à `set_replique` du Chef.
- **`plugin-repliques.js` :** le réglage du projet vient du style. Sinon c'est Anthony si le nom du projet contient « Marketing », et Série pour les autres.
- **Atelier IA :**
  - les consignes communes (`common()`) et celles du Chef suivent le style ;
  - `mesurer_replique` prend le réglage du projet.
- **Pack de skills « Cartoon & satire (master prompt) »** dans `js/skill-packs.js`.
- **Commandes pour Claude :** `agnes.py styles`, `agnes.py style nom=…` ; `importer_image` est maintenant dans l'aide.

Tests : `tests/agnes-styles.test.cjs` (3 tests), et `agnes-atelier-clarte` adapté (Série par défaut hors Marketing), soit 197 tests au total.
Pas encore essayé dans le vrai Agnes de Lumina : il faut recharger Lumina (↻) puis choisir le style dans l'onglet Projet.

## Agnes : Google Flow, troisième moteur vidéo (1.13.6, 30/09/2026)

Copie `agnes/` mise à jour (`npm run sync:agnes`) :
- **Moteur vidéo « flow »** dans `plugins/plugin-moteurs.js`, en plus d'Agnes et Grok (rien de retiré) : ⚙ → Moteurs → Vidéos,
  ou badge des cartes (Agnes → Grok → Flow). Agnes (ouverte depuis Lumina) appelle directement l'API HTTP du service FlowKit local
  (`http://127.0.0.1:8100/api/flow/…` : `status`, `upload-image` en base64, `generate-video`, `generate-video-refs`,
  `generate-video-omni-text`, `check-status`, `check-omni-status`, `credits`) ; Lumina exécute dans l'onglet flow.google.com
  comme pour son onglet Google Flow. Aucun changement dans `flowkit-local/` (ni son tableau de bord), aucun code FlowKit
  copié dans Agnes.
- **Liste de projets Flow partagée** (clé `chrome.storage.local` « luminaFlowProjects » : `{ list: [{ id, nom, url, compte, tier }],
  actif }`), éditable des deux côtés : onglet Google Flow de Lumina (`flow/side_panel.*`, remplace le champ « ID du projet ») et
  ⚙ → Moteurs d'Agnes. Ajouter (nom, lien ou identifiant, compte Google, abonnement Gratuit / Pro), Retirer, **Ouvrir** (dans
  l'onglet Flow existant, jamais un deuxième). Le projet actif est le même partout ; chaque génération part avec son
  `project_id` et son `user_paygate_tier`. Aucune génération sans projet choisi ni abonnement précisé.
- **Vérification avant tout envoi** (`flow/background.js`, messages `FLOW_CHECK` et `FLOW_OPEN_PROJECT`) : pages Flow de ce
  navigateur (plus d'une, ou aucune : bloqué), autre navigateur relié à FlowKit (`/health` → plus d'une connexion : bloqué), compte
  lu dans la page Flow comparé à celui du projet (différent : bloqué ; illisible : avertissement seulement). Avertissement en texte
  simple sous la liste. Panneau : toute requête `generate`, `edit-image` et `upload-image` passe par `flowGuard()`.
- **Rôle de ce navigateur** (`role.js`, petite fenêtre Lumina) — deux profils Chrome avec deux comptes Google, sans doublon :
  « **Tout** » (défaut, comme avant), « **Principal** » (Grok, Agnes, pilote, file ; Flow coupé) et « **Flow seulement** »
  (Grok, Agnes, pilote et file coupés : rien n'est pris au pont). La fenêtre affiche le compte du profil (`chrome.identity`,
  autorisations `identity` et `identity.email`) et grise les boutons interdits. Blocages réels : `SEND_TO_TAB` et
  `ENSURE_IMAGINE` (background.js), `runBatch`, `runLuminaQueue`, `pilotTick` (sidepanel.js), `openAgnes`, connexion FlowKit,
  `OPEN_FLOW_TAB` et `FLOW_OPEN_PROJECT` (flow/background.js), `flowGuard` (flow/side_panel.js).
- **Pont local** (`prod-fruits/flow_pont.py`, relancer `lancer_pont.bat`) : `GET/POST /flow/projets` = liste de référence des
  projets (commune aux deux profils et à Agnes ; `chrome.storage.local` en garde une copie de secours) ; `GET/POST /flow/etat` =
  bilan déposé par le profil Flow (pages Flow, compte, connexions FlowKit, pause anti-restriction), toutes les ~25 s et à chaque
  changement d'onglet. Agnes en rôle Principal le lit avant chaque envoi : absent ou de plus de 60 s, Flow désactivé, deux pages
  Flow, mauvais compte ou pause = rien n'est envoyé. Ces routes ne distribuent aucun travail.
- **Flow manuel** (défaut depuis le 30/09/2026) : depuis le 22/09, Google refuse les générations lancées par une extension
  (`PUBLIC_ERROR_UNUSUAL_ACTIVITY` ; FlowKit amont contourne ce blocage, **pas repris ici**). Agnes envoie l'image dans le
  projet Flow et copie le prompt ; l'utilisatrice clique Générer puis Télécharger ; le pont (`POST /flow/recuperer`,
  `prod-fruits/classement_pont.py`) déplace la vidéo de Téléchargements vers `Production/<thématique>/…/Video` et Agnes la
  range dans la carte. Mode automatique gardé (réglage « Mode Flow »).
- **Classement local** (extension Classement d'Agnes) : `Production/<Thématique>/…` via le pont (`/classement/thematiques`,
  `/classement/thematique`, `/classement/fichier`, `/classement/lire`), écriture limitée à Production.
- Réglages Agnes : Omni Flash / Veo 3.1, 360p / 720p, adresse FlowKit, **Tester FlowKit**, **Voir mes crédits Flow** (le solde
  n'est plus lisible par FlowKit depuis flow.google.com : le bouton le dit).
- Garde-fous : une vidéo à la fois, 1 vidéo par envoi, jamais de renvoi ; **Flow bloqué** si plusieurs vidéos pour un envoi ou si
  l'envoi est coupé en route (on ne sait pas s'il est parti) ; attente 15 min au plus. Avant chaque envoi, Agnes lit le rythme
  anti-restriction de Lumina (`PACE_STATUS`) et **n'envoie rien pendant une pause** ; `FLOW_COOLDOWN` renvoyé par FlowKit =
  message clair, sans blocage. Sondage toutes les 15 s, puis 20 s après 2 min.
- Chef de l'Atelier / `agnes.py moteurs video=flow` : Flow accepté, garde-fou « Flow bloqué » respecté par `generate_shots`.
- Badges et boutons des moteurs sans emojis.
- Prérequis : les modifications locales de `flowkit-local` (upload `image_base64`) — ne pas les perdre.
- Tests : `tests/agnes-flow.test.cjs` (faux FlowKit, aucune génération). **Aucune génération Flow réelle testée à ce jour.**

## Dossiers, rythme anti-restriction Flow, Raccourcis (1.13, branche `claude/amazing-allen-dug6x3` récupérée le 30/09/2026)

#### Classement dans les dossiers de votre choix

Dans **Réglages**, chaque type de fichier (Images, Clips vidéo, Vidéo complète,
Script) a un bouton **Choisir…** qui ouvre l’explorateur Windows. Les fichiers
de ce type sont alors écrits directement dans ce dossier (n’importe où, pas
seulement sous Téléchargements). Même chose dans l’onglet **Google Flow**
(« Dossiers de classement Flow » : images et vidéos). **Retirer** revient à
Téléchargements. Chrome redemande l’accès après un redémarrage : il est
redonné au clic sur « Lancer » ou via **Réautoriser** ; choisir « Autoriser à chaque
visite » évite la question. Si un dossier choisi a été assemblé, `concat.txt`
et `assembler.bat` sont écrits à côté des clips.

#### Rythme anti-restriction Google Flow

Google Flow restreignait le compte car les générations (chacune avec un
reCAPTCHA neuf) partaient en rafale et l’état des vidéos était sondé toutes les
5 s. Désormais :

- toutes les requêtes Flow passent par une **file unique** (jamais deux en même temps) ;
- **écart minimal entre deux générations**, avec une part d’aléa : Prudent ~30 s,
  Normal ~18 s (défaut), Rapide ~9 s — réglable dans l’onglet Google Flow ;
- sondage des vidéos toutes les 6–15 s selon le rythme, ralenti après 2 min ;
- dès que Flow signale une limite (429, `RESOURCE_EXHAUSTED`, reCAPTCHA refusé…),
  **pause automatique** de 1 min, puis 2, 4… jusqu’à 15 min ; aucune
  génération n’est envoyée pendant la pause, le lot reprend seul et retente
  le prompt concerné une fois. « Reprendre maintenant » annule la pause.

Conseils : laissez l’onglet flow.google.com ouvert et visible de temps en
temps, n’enchaînez pas des centaines de générations d’affilée, et passez en
**Prudent** si le compte a déjà été restreint.

#### Onglet Raccourcis (commandes au clic)

Boutons qui lancent vos outils locaux (pont prod-fruits, FlowKit, Agnes
production, agent Marketing, Claude Code) et ouvrent vos dossiers de projet.
Une extension Chrome ne peut pas lancer de programme elle-même : c’est le petit
serveur `outils/lanceur/lumina_lanceur.py` (Python 3, sans dépendance) qui le
fait, uniquement pour les commandes listées dans `outils/lanceur/lanceur.json`,
et uniquement à la demande de l’extension.

1. Double-cliquez sur `outils/lanceur/Lancer_lanceur.bat` (ou mettez un raccourci
   dans `shell:startup` pour le démarrage avec Windows).
2. Complétez les lignes `A_COMPLETER` de `lanceur.json` (commande qui démarre
   Agnes, l’agent Marketing, FlowKit), puis **Actualiser** dans l’onglet.

## Agnes : Chef plus clair, notes, classement, calculateur de répliques (1.13.5, 29–30/09/2026)

Copie `agnes/` mise à jour (`npm run sync:agnes`) :
- **Atelier IA** : blocs de code avec bouton **📋 Copier** ; adresses `C:\…` / `D:\…` cliquables (**📂** → route `POST /ouvrir` du
  pont, qui montre le dossier dans l'Explorateur sans rien exécuter ; sinon l'adresse est copiée). Consignes du Chef : adresses
  complètes, commandes prêtes à coller, pas de noms d'outils. Nouveaux outils `marketing_fiches`, `marketing_fiche`,
  `marketing_decider_fiche` (autorisation avec les notions = décision de l'utilisatrice), `marketing_notes_cartes` ;
  `marketing_generate_day` accepte `garder`.
- **Storyboard** : champ **Notes** de la carte (Plus d'options) ; résumé « 📝 Notes » / « 📁 Classée ».
- **Calculateur de répliques** (`plugins/plugin-repliques.js`, onglet Répliques, actif par défaut) : caractères, durée, réglages
  modifiables + calibrage ; outil du Chef `mesurer_replique` (sans autorisation). **Compteur sur les cartes** (répliques entre
  guillemets du prompt) via le nouvel événement du cœur `shots:render` ; « Corriger ici » ou « Demander au Chef » (`ask`,
  outil `set_replique` sous autorisation).
- **Extension Classement** (`plugins/plugin-classement.js`, active par défaut) : bouton **📁 Classer** → image, vidéo et `fiche.md`
  dans `<dossier choisi>/Projet/Saison NN/Episode NN/Carte NN - titre/` (File System Access API ; sinon téléchargements).
- **Télécharger l'image** de départ (cartes Texte → Image → Vidéo) ; garde-fou du Chef avant autorisation (`repliqueHorsReglage`) ;
  correctif du premier démarrage de l'Atelier avec des clés .env.
- Tests : `tests/agnes-atelier-clarte.test.cjs`. Après mise à jour : relancer le pont (`lancer_pont.bat`), ↻ sur Lumina, F5 dans Agnes.

## Agnes : Studio (ex-« Création d'avatar », 1.13.8, 01–02/10/2026)
Nouvelle extension d'Agnes **Création d'avatar** (`agnes/plugins/plugin-avatar.js`, notice `agnes/docs/30-creation-avatar.md`, test `tests/agnes-avatar.test.cjs`) : onglet de fiches d'avatar, personnage, tenue, lieu et objet (listes déroulantes modifiables, dictionnaire FR → EN, 3 niveaux, prompt anglais, aperçu 9:16 / 16:9), **Envoyer à l'Atelier** (le Chef crée la Bible et rattache l'image validée avec le nouvel outil `bible_attacher_image`, avec autorisation), pastille Bible sur les cartes, filtres de la Bible, `moteurs.genererImage`, commandes Claude `avatars` / `avatar` / `avatar_prompt` / `envoyer_avatar`. Vérifié dans le navigateur intégré (1440, 1100, 800 et 375 px) ; **pas testé en réel** : génération ChatGPT et Chef avec une vraie IA.

Retouches du 02/10 :
- **Disposition de Création d'avatar :** l'écran de visualisation est au centre, avec le format, les essais, les actions et les prompts. La colonne de droite ne contient plus que les réglages de la fiche.
- **Débordements des cartes :** une section `/* Débordements des cartes (02/10/2026) */` est ajoutée en fin de `agnes/css/studio.css`. Elle corrige :
  - la colonne des champs du Storyboard, qui ne rétrécissait pas : elle est maintenant en `minmax(0, 1fr)`, et passe sur une seule colonne sous 720 px (l'ancienne règle `180px 1fr` écrasait celle du téléphone) ;
  - les listes trop larges ;
  - les libellés de cases à cocher qui ne passaient pas à la ligne (`nowrap`) dans l'Atelier et le Montage ;
  - les lignes `.ext-row` (Voix…).
- **Vérification :** les 22 onglets à 375, 470, 704, 1024 et 1440 px, aucun débordement ; test ajouté dans `agnes-avatar.test.cjs`.
- **« Création d'avatar » devient « Studio » :** onglet, extension et documents « Studio — Nom » envoyés au Chef. L'identifiant interne `avatar` et les commandes `avatars` / `avatar` ne changent pas.
- **Nouveaux outils du Chef** (`plugin-atelier.js`, `outilsExtensions`) :
  - `studio_fiches` et `studio_fiche`, en lecture ;
  - `style_projet` en lecture, et `choisir_style` avec autorisation ;
  - `classer_cartes`, avec autorisation.
- **Classement sans fenêtre :**
  - `classement.classerLocal(shot, options)` fait les mêmes dossiers et les mêmes fichiers que le bouton Classer en mode local ;
  - Claude : `python agnes.py classer cartes=… thematique=… nom=… episode=…`.
- **Prompts du Studio :** majuscule après un point, « and » dans les listes, plus de « fabric fabrics » ; le prénom sert de nom.
- **Essai de la chaîne sur l'Agnes réelle, via le pont :**
  - ce qui a été fait : projet « Test chaîne 02-10 », style automatique Série réaliste, 2 cartes par `lot` (sans génération), document à l'Atelier, puis le Chef qui mesure les répliques avec le réglage Série et liste ses outils ;
  - autorisation donnée à la place de l'utilisatrice : `set_replique` puis `autoriser`, carte modifiée ;
  - lectures Montage et Studio : OK.
- **Ponts :** 8177 (`/health`, `/codex`, `/classement/thematiques`, `/marketing`) et FlowKit 8100 répondent. Tests : `tests/agnes-chaine-outils.test.cjs`, 217 au total.
- **Outils du Chef pour Voix, Son, Étalonnage et AutoCaption :** `voix_etat`, `son_pistes`, `etalonnage_etat` et `soustitres_modeles` en lecture ; `voix_generer` et `son_generer` (payants), `etalonnage_regler` et `soustitres_appliquer` avec autorisation. Claude utilise les mêmes outils avec `agnes.py outil nom=…`. Épisodes, Planning et Stills restent dans leur onglet.
- **Google Flow passé en mode « Agent » (nouvelle page Flow, 01–02/10) :** `flow/background.js` (`prepareFlowComposer`) s'arrête quand le menu « Vidéo · 720p · 8 s » est absent, avec un message clair (« cliquez sur Agent pour revenir au mode normal ») au lieu d'écrire le prompt dans l'agent. Le diagnostic relève maintenant l'état des boutons bascule (`aria-pressed`, `data-state`…). Le 02/10, Google affichait aussi « Image uploads are failing for some users » : c'est une panne chez Google.
- **219 tests.**

## Agnes : Chef de l'Atelier et ressources locales (1.13.4, 01/10/2026)

Copie `agnes/` mise à jour depuis Agnes_production (`npm run sync:agnes`) :
- **Journée renvoyée sans doublon** : le Chef met à jour les cartes existantes (`update_shots` avec `document` + `cartes`,
  fonctions `parseLot` / `applyLotToCards` de `plugin-atelier.js`) au lieu de renvoyer le lot. Testé en réel (cartes #4-#6).
- **Ressources locales** : outils du Chef `marketing_ressources`, `transcrire_ressource` (vidéo servie par le pont →
  Extraire/Whisper → contrôle de la transcription par l'agent Marketing → fiche + document) et `marketing_extraire_fiche`.
- **Extraire** : API `transcribeBlob(blob, nom)` sans dépendance ; le Chef affiche un message si Extraire est désactivée.
- **Sujet cherché sur internet** : outil du Chef `marketing_recherche_sujet` (Codex, Hacker News, Reddit → fiche à valider).
- Consignes du Chef : seules les règles marketing ont changé (un test vérifie que celles des histoires sont intactes).
- Tests : `tests/agnes-chef-marketing.test.cjs` (renvoi, ressources avec et sans Extraire). Après mise à jour : relancer le
  pont (`lancer_pont.bat`), ↻ sur Lumina, F5 dans Agnes.

## Corrections Grok du 28–30/09/2026 (testées en réel)

- **Cause des vidéos en double trouvée** : le bouton « Valider » de Grok est un `submit` dans un formulaire ; un clic simulé
  (`button.click()`) lançait **2 générations**. Lumina valide maintenant par `form.requestSubmit()` (1 seule) — vérifié en réel.
- **Garde-fou « surplus » toutes conversations** : un `PerformanceObserver` compte les `POST /rest/app-chat/conversations/new`
  depuis le début de l'envoi ; plus d'un = surplus (lot arrêté, Grok bloqué dans Agnes), même si la 2e vidéo part ailleurs.
- **Toujours depuis l'accueil** : avant chaque envoi, `background.js` ramène l'onglet sur `grok.com/imagine`. Depuis la page
  d'une ancienne vidéo (`/imagine/post/…`), l'import échouait (« Import de Scène 1 non confirmé ») **et une vidéo partait quand même**.
- **Rôles d'image Grok** « **Boucle** » (début + fin) et « **Image intermédiaire** » ajoutés (`content.js → ROLE_RE`) ; Agnes :
  « Scène verrouillée » = Boucle, menu « Image intermédiaire » sur les cartes (recette arc face → profil → face).
- **Par défaut** : « 1 image = 1 clip » et « Aucune référence » dans « Par lot » (migration `soloV3`).
- Agnes (copie `agnes/`) : nouveaux projets 9:16 / 10 s ; « Mettre en file tout de suite » décoché ; consigne du Chef :
  une journée renvoyée remplace la précédente (relire le document avant chaque étape).

## Anti-doublon Grok (1.13.1)

Une vidéo ne doit partir qu'**une fois** vers Grok, même si la page change pendant la génération.

- **Plus de renvoi automatique** : si Grok change de page après « Générer », `background.js` ne renvoie plus le prompt ;
  il demande au script de la nouvelle page de **reprendre l'attente** (`RESUME_WAIT`, état dans `sessionStorage.luminaPending`).
- **Même prompt bloqué 90 s** dans un onglet Grok (`sessionStorage.luminaLastSubmit`), quel que soit l'envoyeur (lot, File, Agnes).
- **Passage en mode vidéo** : l'onglet « Vidéo » est cliqué au plus 2 fois ; « Créer une vidéo / Animer » (qui peut lancer
  une génération) **au plus une fois**, et seulement s'il n'y a pas d'onglet de mode. Une vidéo lancée pendant ces clics compte en surplus.
- **Journal** : chaque échec de lot est écrit (`✖ scène : raison`). Vérifiez l'onglet Grok avant de relancer.
- **Une seule Lumina active** : l'extension activée dans deux navigateurs/profils envoie chaque requête deux fois
  au même onglet Grok et au même pont. Désactivez-la partout sauf un.

## Agnes Studio Pro (1.13)

Onglet **Agnes** : l'app Agnes Studio Pro (écriture, Bible, storyboard, montage) est embarquée dans `agnes/`
et s'ouvre dans un onglet de l'extension. Les plans d'un projet Agnes deviennent des cartes **Stills → Clips**
(image validée dans Agnes) ou des paires du **Lot mixte**, avec leurs références et l'ADN de la Bible ; chaque rendu
Grok revient dans Agnes comme prise du plan. Le panneau et Agnes se parlent par `BroadcastChannel("lumina-agnes")`
(`agnes-bridge.js` côté panneau, `agnes/plugins/plugin-lumina.js` côté Agnes).

- **Source d'Agnes** : le dossier `Agnes_production` (hors de ce dépôt). Après l'avoir modifié :
  `npm run sync:agnes` (ou `AGNES_SRC=… npm run sync:agnes`), puis rechargez l'extension. Ne modifiez pas `agnes/` à la main.
- **Transfert des projets** : Agnes dans l'extension a son propre stockage. Ancienne Agnes → Projet →
  « Sauvegarde complète (.zip) », puis Agnes dans Lumina → Projet → « Restaurer une sauvegarde… ».
- **Pilote auto** : `python pilote.py lancer-agnes "Projet"` (prod-fruits) → demande `{ agnes: { projet } }` sur le pont.
- Limite : Whisper dans le navigateur (onglet Extraire d'Agnes) est indisponible dans l'extension (code distant interdit).

## Google Flow (1.9.1)

Le panneau réunit les onglets **Grok**, **Google Flow**, **File** et **Réglages**.
Google Flow intègre la connexion Chrome et le journal de FlowKit : il n’est plus
nécessaire de charger son extension séparée. Le service Python local FlowKit
reste nécessaire ; il n’est ni installé ni lancé par Lumina. La connexion est
désactivée par défaut et s’active dans le panneau Flow.

### Automatisation Image/Vidéo reconstruite (1.9.1)

L’onglet Flow a été reconstruit : chaque fetch de l’automatisation appelait le
service local sur `/flow/...` alors que ses routes sont montées sous
`/api/flow/...` — toutes les générations échouaient silencieusement (404). Les
autres bugs corrigés : la liste de modèles mélangeait image et vidéo sous des
noms erronés (« Imagen 3 / GemPix 2 » alors que GemPix 2 est le nom interne de
Nano Banana Pro), les images et lieux/personnages importés dans « Ingrédients »
n’étaient jamais envoyés à la génération, et les durées/résolutions proposées
ne correspondaient à aucune valeur acceptée par Google Flow.

L’onglet distingue maintenant **Image** et **Vidéo** :

- **Image** — Texte → Image ou Image → Image (édition), modèles réels (Nano
  Banana Pro / 2 / 2 Lite), format 16:9 / 9:16 / 1:1, 1 à 4 variantes, seed, et
  les références sélectionnées dans « Ingrédients » sont réellement importées
  puis jointes à la génération.
- **Vidéo** — Texte → Vidéo (Omni Flash), Image → Vidéo (Omni Flash ou Veo
  3.1), Début + Fin → Vidéo et Ingrédients → Vidéo (jusqu’à 7 références) ;
  chaque mode n’affiche que les réglages réellement pris en compte par Google
  Flow (Veo n’a ni durée ni résolution réglables ; le chaînage début/fin et les
  références multiples ne sont disponibles qu’avec Omni Flash, Veo ne les
  supportant pas sur l’API actuelle de Flow).

Chaque génération est suivie jusqu’à son résultat (interrogation du statut
Google Flow) et affichée dans une galerie de résultats avec export 2K/4K pour
les images. L’upscale vidéo automatique a été retiré du panneau : Google Flow
ne propose aucune route pour cette opération sur son API actuelle, l’ancienne
case à cocher ne faisait donc rien.

Le guide [Installation Google Flow](flow/setup.html) détaille le démarrage du
service et du tableau de bord. Les générations Flow sont pilotées depuis ce
tableau de bord ou son API ; les formulaires Grok ne sont pas convertis en
formulaires Flow. Les données et messages Grok restent séparés du module Flow.

Après rechargement de Lumina, actualisez aussi les pages Grok/Flow ouvertes.
Désactivez l’extension FlowKit séparée si elle est installée. Cette version ajoute
les accès aux domaines Google Flow et au service local, ainsi que les permissions
utilisées par la connexion FlowKit. La licence et la provenance sont conservées
dans [flow/UPSTREAM.md](flow/UPSTREAM.md) et [flow/LICENSE](flow/LICENSE).

Tests d’intégration locaux : routage des messages, activation persistante,
reconnexion, chemins des scripts et coexistence du panneau. L’authentification et
la génération sur un compte Google Flow réel ne sont pas validées par ces tests.

## Windows 11

Aucun build. pnpm n’est pas requis.

Chrome **refuse le fichier .zip** (« manifeste manquant »). Il faut le dossier extrait.

1. Clic droit sur `lumina-extension.zip` → **Extraire tout**
2. Ouvrez le dossier : vous devez voir **`manifest.json`**
   - Si vous voyez seulement un sous-dossier `lumina-extension`, entrez dedans
3. `chrome://extensions`
4. **Mode développeur** (haut droite)
5. **Charger l’extension non empaquetée** → ce dossier (celui du `manifest.json`)
6. Ouvrez grok.com/imagine, puis le panneau latéral Lumina

## Lot mixte

Mode **Lot mixte** : un prompt image est classé avec le prompt vidéo du même rang. L’extension génère l’image, puis lance la vidéo à partir de ce plan.

CSV à deux colonnes : `prompt image, prompt vidéo`.

La vidéo utilise la première image générée de sa paire, même si plusieurs variantes
sont demandées. La passe **Vidéos** réutilise les images de la passe **Images**
conservées dans la file pour ces mêmes paires et prompts. Sans image correspondante,
le lancement est refusé. Les anciens lots doivent être recréés après la mise à jour.

## Modes et limites de l’automatisation (1.8.7)

Les personnages, lieux et accessoires de la bibliothèque sont désormais joints en
plus des images de scène. Le sélecteur **Références à joindre à chaque scène** propose :
toutes (par défaut), seulement les noms cités, ou aucune. En lot mixte, la sélection
par nom consulte les prompts image et vidéo de la paire. La sélection est conservée
dans chaque tâche au lancement. Le journal liste les références prévues.

Pour les vidéos, chaque fichier est importé séparément et son menu de vignette reçoit
le rôle **Première image**, **Dernière image** ou **Référence**. La sélection du rôle
est vérifiée avant la saisie du prompt. Les anciens fichiers du formulaire sont retirés
via leurs boutons de retrait ; si l’import, le retrait ou le rôle ne peuvent être
confirmés, l’envoi s’arrête avec une erreur. Aucune référence n’est tronquée à une
limite arbitraire de quatre ; un import refusé par le site interrompt l’envoi.

| Mode | Sources et comportement |
| --- | --- |
| Texte → Vidéo | Prompt et références sélectionnées ; pas d’image de scène héritée d’un autre mode. |
| Image → Vidéo | Une image commune ou une par prompt ; en Début + fin, deux images communes ou deux par prompt. Les références s’ajoutent avec leur rôle distinct. |
| Ingrédients → Vidéo | Images de départ et références de bibliothèque avec le rôle Référence dans le mode Vidéo ; aucun onglet Ingrédients séparé requis. |
| Texte → Image | Prompt et références sélectionnées ; pas d’image de scène héritée d’un autre mode. |
| Image → Image | Une image commune ou une par prompt, plus les références. Le prompt attend la détection de l’éditeur. |
| Lot mixte | Chaque vidéo reçoit l’image de sa paire et ses références. Les références accompagnent aussi la génération de l’image. Un échec de l’image bloque la vidéo correspondante. |
| Stills → Clips | Une première image par clip, plus les références sélectionnées. |

Un seul travail pilote l’onglet à la fois. Les tâches conservent leur mode et leurs
réglages de génération au lancement. La continuité entre scènes, auparavant affichée
sans implémentation, est désactivée. Les réglages vidéo ne sont plus appliqués aux images.
Les demandes de plusieurs variantes échouent explicitement si le sélecteur est absent.
L’attente d’un résultat a désormais une durée maximale, sans prolongation indéfinie.

Les tests locaux utilisent une interface simulée, y compris les menus de rôles observés
sur la capture fournie : ils ne valident pas les sélecteurs
sur une session Grok réelle. La disponibilité des modes, l’import effectif des références,
les réglages durée/qualité/définition/format et la détection des résultats restent à vérifier
sur le site. Les réglages dont les boutons ne sont pas reconnus peuvent conserver la valeur du site.

Après une mise à jour : rechargez Lumina dans `chrome://extensions`, actualisez Imagine
avec F5, puis recréez un petit lot pour le tester.

Tests sans dépendances : `npm test` (Node.js 22).

JSON (lot mixte) :

```json
{
  "pairs": [
    {
      "image": { "scene": "...", "subject": "...", "lighting": "..." },
      "video": { "motion": "...", "camera": "...", "mood": "..." }
    }
  ]
}
```
