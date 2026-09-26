# Agnes Studio Pro — v3.10

Studio de production de **courts métrages et séries IA**, de l'idée à la publication. L'écriture est assistée par une équipe d'agents IA qui utilise, par défaut, les modèles de discussion d'**Agnes** avec la même clé (Gemini, Groq, OpenRouter ou Mistral en option), et les images et vidéos sont générées par **Agnes AI** (Image 2.5 Flash, Video 2.5 Flash).

L'application tourne entièrement dans le navigateur : pas de serveur, pas d'installation, et tout reste enregistré sur votre ordinateur.

**idée → écriture (Atelier IA) → bibles et références → plans → génération → voix et son → étalonnage → montage → publication → planning.**

---

## Démarrage en 5 minutes

1. **Ouvrir** `index.html` dans **Chrome** ou **Edge** récents. Firefox et Safari fonctionnent, mais l'assemblage vidéo y est moins fiable.
2. **Ouvrir ⚙ (Réglages)** en haut à droite :
   - collez votre **clé API Agnes** ;
   - ajoutez une **clé imgbb** gratuite (api.imgbb.com). Elle est **indispensable** pour animer une image et pour les images de référence, car Agnes n'accepte que des images en ligne ;
   - cochez les **extensions** voulues ;
   - *(conseillé)* en bas du panneau, **🧪 Tester la génération vidéo** vérifie que tout fonctionne avec votre compte.
3. **Choisissez votre point de départ** :
   - **une idée ou un script à écrire** → onglet **Atelier IA** : votre clé Agnes suffit, parlez directement au Chef de production ([21](docs/21-atelier.md)) ;
   - **un script déjà écrit** → onglet **Scénario** ([10](docs/10-scenario.md)), ou **Le lot** si vous avez des prompts image et vidéo numérotés ([03](docs/03-le-lot.md)) ;
   - **des images de plan faites ailleurs** (ChatGPT, Midjourney…) → **Stills → Clip** ([09](docs/09-stills-clip.md)) ;
   - **un simple essai** → **Storyboard** : écrivez un plan (« Plan large d'une rue sous la pluie, la nuit »), choisissez *Texte → Vidéo*, puis **Générer**.
4. Le résultat apparaît sur la carte du plan, et la **Liste d'attente** montre l'avancement.

➡️ Notice détaillée des réglages : [`docs/01-reglages.md`](docs/01-reglages.md)

---

## Méthode de travail conseillée pour un épisode

| Étape | Onglet | Ce que vous faites |
|---|---|---|
| 1 | **Atelier IA** | L'équipe d'agents écrit concept, bibles, épisodes, scénario et prompts. Le Chef de production range le travail dans l'app, avec votre autorisation |
| 1 bis | **Extraire** *(facultatif)* | Veille des meilleures vidéos de votre catégorie, puis une vidéo de référence : script, une image par plan, conversion en prompts pour Le lot |
| 2 | **Bible** | Vérifiez l'ADN des personnages et des lieux, ajoutez leurs images de référence |
| 3 | **Bibliothèque** | Préparez les références (personnages, décors), sous **les mêmes noms** que dans la Bible |
| 4 | **Scénario** ou **Le lot** | Le scénario devient des plans avec leurs dialogues ; le script numéroté devient une carte par plan avec ses références |
| 5 | **Storyboard** | Ajustez chaque plan : mode, format, durée, références, tenue de la scène, skills. Validez l'image avant de l'animer |
| 6 | **Liste d'attente** | Lancez et surveillez les générations |
| 7 | **Voix** | Une voix par personnage, puis génération des dialogues |
| 8 | **Son** | Musique, ambiances et bruitages |
| 8 bis | **AutoCaption** | Choisissez le style des sous-titres animés (ils suivent vos dialogues) |
| 9 | **Épisodes** | Récap « Précédemment dans… », cartons, raccord avec l'épisode d'avant |
| 10 | **Étalonnage** | Un look commun à tous les plans |
| 11 | **Assemblage** | Montez le film (aperçu, agrandissement 1080p), puis exportez le kit FFmpeg pour la qualité finale |
| 12 | **Publication** | Textes, couverture, kit de publication |
| 13 | **Planning** | Programmez la sortie, exportez vers votre agenda |

---

## Modèles Agnes utilisés

| Modèle | Rôle | À savoir |
|---|---|---|
| `agnes-image-2.5-flash` | Images (Texte → Image, Image → Image, Ingrédients) | Paliers 1K / 2K / 4K |
| `agnes-video-2.5-flash` | Vidéos | **720P**, **4 à 12 s**, 5 images de référence au maximum, 1 vidéo par minute en offre gratuite |
| `agnes-video-2.5` *(payant, en option)* | Vidéos | 720P, 1080P ou 2K, 8 images de référence au maximum |
| `agnes-2.5-flash` | Discussion : agents de l'Atelier IA | 20 requêtes/minute en offre gratuite ; `agnes-3.0-flash` aussi proposé |

> Agnes Video v2.0 a été retiré le 25/09/2026. L'app a migré automatiquement vos réglages vers la série 2.5.
> Les vidéos 720P peuvent être **agrandies en 1080p** : dans l'Assemblage, ou avec le bouton **⬇ 1080p** de chaque carte vidéo.

---

## Notices par section

### Onglets de base
| Notice | Contenu |
|---|---|
| [01 — Réglages (⚙)](docs/01-reglages.md) | Clés API, extensions, modèles, test vidéo, options avancées |
| [02 — Storyboard](docs/02-storyboard.md) | Plans, modes de génération, Texte → Image → Vidéo, Convertir (vidéo), prises, sélection multiple |
| [03 — Le lot](docs/03-le-lot.md) | Script numéroté (IMAGE / VIDÉO / RÉF par numéro), traitement de plusieurs fichiers d'un coup |
| [04 — Skills](docs/04-skills.md) | Mouvements de caméra, lumières, styles, positions ; import en masse (.md, .csv, .json), packs prêts à l'emploi, ligne SKILLS dans les scripts, Skill → Clip |
| [05 — Bibliothèque](docs/05-bibliotheque.md) | Ingrédients, recadrage, capture vidéo, fiche personnage |
| [06 — Liste d'attente](docs/06-liste-attente.md) | File de génération, pause, priorités, reprise |
| [07 — Assemblage](docs/07-assemblage.md) | Montage dans le navigateur, transitions, découpes, agrandissement 1080p |
| [08 — Projet](docs/08-projet.md) | Réglages par défaut, export .zip, stockage, projets |

### Extensions
| Notice | Contenu |
|---|---|
| [09 — Stills → Clip](docs/09-stills-clip.md) | Images numérotées + prompts → plans Image → Vidéo |
| [10 — Scénario](docs/10-scenario.md) | Import de script → plans + dialogues + casting |
| [11 — Bible](docs/11-bible.md) | Continuité des personnages et des lieux sur toute une série |
| [12 — Voix](docs/12-voix.md) | Voix-off et dialogues (ElevenLabs, OpenAI, micro), sous-titres .srt |
| [13 — Son](docs/13-son.md) | Musique, ambiances, bruitages, génération ElevenLabs |
| [14 — Épisodes](docs/14-episodes.md) | Récap, cartons d'ouverture et de fin, arrêt sur image, raccord |
| [15 — Étalonnage](docs/15-etalonnage.md) | Looks, grain, vignette, LUT .cube |
| [16 — Kit FFmpeg](docs/16-kit-ffmpeg.md) | Rendu final haute qualité sur votre PC |
| [17 — Publication](docs/17-publication.md) | Textes TikTok / Reels / Shorts / YouTube, couverture, kit |
| [18 — Planning](docs/18-planning.md) | Calendrier, rythme de diffusion, export agenda |
| [19 — Extraire](docs/19-extracteur.md) | Veille TikTok (meilleures vidéos d'une catégorie), TikTok par lien, kit yt-dlp, script (Whisper) converti en prompts pour Le lot, images d'une vidéo ; tout enregistré dans le projet |
| [22 — AutoCaption](docs/22-autocaption.md) | Sous-titres animés et stylés (TikTok, karaoké, mot par mot…) posés après la génération, dans l'Assemblage et le kit FFmpeg ; exports .srt / .ass |
| [25 — Mentions @ et #](docs/25-mentions.md) | `@[Personnage]` coche sa référence, `#[Skill]` place un skill dans le texte ; suggestions en tapant @ ou # |
| [24 — Moteurs de génération](docs/24-moteurs.md) | Images par ChatGPT (via le pont local) ou Agnes, vidéos par Grok (via Lumina) ou Agnes |
| [23 — Lumina et sauvegarde](docs/23-lumina.md) | Ouvrir Agnes dans l'extension Lumina, plans → Grok Imagine, rendus → prises, pilote auto ; sauvegarde complète et restauration |
| [21 — Atelier IA](docs/21-atelier.md) | Équipe de 16 agents IA multi-fournisseurs avec relais automatique, Chef de production, documents, import depuis RMAOPN AI |

### Aller plus loin
| Notice | Contenu |
|---|---|
| [20 — Créer une extension](docs/20-creer-une-extension.md) | API `AgnesCore` pour écrire vos propres extensions |
| [99 — Dépannage](docs/99-depannage.md) | Erreurs fréquentes et solutions |

---

## Structure du dossier

```
Agnes_production/
├── index.html                  ← à ouvrir dans le navigateur
├── README.md
├── docs/                       ← notices
├── skills-packs/               ← packs de skills en .md (exemples du format d'import)
├── css/studio.css
├── vendor/                     JSZip, mammoth, pdf.js en local (obligatoire dans Lumina)
├── js/
│   ├── storage.js              stockage local (IndexedDB)
│   ├── app-state.js            données, réglages, formats, modes, modèles, skills intégrés
│   ├── app-api.js              appels à l'API Agnes (image, vidéo 2.5, suivi)
│   ├── app-queue.js            liste d'attente
│   ├── app-ui.js               storyboard, réglages, projets
│   ├── app-library.js          bibliothèque
│   ├── skill-packs.js          packs de skills prêts à l'emploi
│   ├── app-skills-batch.js     skills, import en masse, Skill → Clip
│   ├── app-batch.js            Le lot (script numéroté, opérations sur fichiers)
│   ├── upscale.js              agrandissement 720P → 1080p (WebGL)
│   ├── app-diag.js             test de génération vidéo (⚙)
│   ├── app-montage.js          assemblage, étalonnage, export
│   ├── app-init.js             démarrage
│   ├── plugin-manager.js       chargement des extensions
│   └── agnes-core.js           API publique pour les extensions
├── Module-reglage/active-module.js   liste des extensions (⚙)
└── plugins/
    ├── plugin-stills.js        Stills → Clip
    ├── plugin-extract.js       Extraire (lien, script, images)
    ├── plugin-script.js        Scénario
    ├── plugin-bible.js         Bible
    ├── plugin-tts.js           Voix
    ├── plugin-music.js         Son
    ├── plugin-episodes.js      Épisodes
    ├── plugin-grade.js         Étalonnage
    ├── plugin-ffmpeg.js        Kit FFmpeg
    ├── plugin-social.js        Publication
    ├── plugin-planning.js      Planning
    ├── plugin-atelier.js       Atelier IA (agents IA multi-fournisseurs)
    ├── plugin-mentions.js      Mentions @ (références) et # (skills) dans les prompts
    ├── plugin-moteurs.js       Moteurs : images Agnes/ChatGPT, vidéos Agnes/Grok
    ├── plugin-lumina.js        Lumina (plans → Grok, rendus → prises)
    ├── plugin-backup.js        Sauvegarde complète / restauration
    └── plugin-captions.js      AutoCaption (sous-titres animés)
```

---

## Où sont mes données ?

- **Projets, médias, voix, musiques, bible** : dans le stockage du navigateur (IndexedDB), sur cet ordinateur uniquement.
- **Atelier IA** : le travail des agents, la discussion avec le chef et les documents sont enregistrés **dans le projet**. L'équipe d'agents (consignes, réglages) est enregistrée dans le navigateur ; **Modifier l'agent → Exporter l'équipe** en fait une sauvegarde.
- **Clés API** : dans le navigateur. Elles ne sont envoyées qu'au service concerné (Agnes, imgbb, Gemini, Groq, OpenRouter, Mistral, ElevenLabs, OpenAI).
- **Sauvegarde** :
  - **Projet → Exporter le projet en .zip** (tous les médias, voix, musiques) ;
  - **Bible → Exporter (.json)** ;
  - **Atelier IA → Exporter l'équipe (.json)** ;
  - **Projet → Protéger le stockage** pour éviter que le navigateur ne fasse le ménage.

> ⚠️ Vider les données du navigateur efface les projets. Faites régulièrement une **💾 Sauvegarde complète** (onglet Projet) : elle se restaure avec **↺ Restaurer une sauvegarde…**.

---

## Services externes utilisés

| Service | Utilisé pour | Obligatoire |
|---|---|---|
| **Agnes AI** | Génération d'images et de vidéos, et discussion pour les agents de l'Atelier IA (`agnes-2.5-flash`) | Oui |
| **imgbb** | Mise en ligne des images de référence (Agnes exige des URL publiques) | Oui dès qu'une vidéo part d'une image |
| Google Gemini / Groq / OpenRouter / Mistral | Relais pour les agents de l'Atelier IA (qui utilise Agnes par défaut) | Non (facultatifs, voir [21](docs/21-atelier.md)) |
| **Jina Reader** (service tiers gratuit) | Lecture d'une page web comme document de l'Atelier | Non (reçoit seulement l'adresse de la page) |
| **ElevenLabs** | Voix, musique, ambiances, bruitages | Non (extensions Voix et Son) |
| **OpenAI** (ou compatible) | Voix, transcription | Non (alternative à ElevenLabs ; transcription payante mais précise) |
| **Whisper** (dans le navigateur) | Transcription gratuite et privée | Non (modèle téléchargé une fois depuis Hugging Face) |
| **TikWM** (service tiers gratuit) | Récupération des vidéos TikTok par lien et recherche (veille) | Non (extension Extraire) |
| **yt-dlp** (sur votre PC) | Téléchargement de vidéos par lien, tous sites | Non (extension Extraire) |
| **FFmpeg** (sur votre PC) | Rendu final du kit de montage | Non (le montage navigateur suffit pour un aperçu) |

Des bibliothèques de lecture (JSZip, mammoth pour les .docx, pdf.js pour les .pdf) sont chargées au besoin depuis cdnjs.

---

## Principes de l'app

- **Pas de texte, sous-titres ni musique dans les générations** : dialogues, sous-titres, musique et titres sont des couches séparées (onglets Voix, AutoCaption, Son, Publication). Vous gardez la main dessus et pouvez les corriger sans régénérer l'image.
- **Continuité avant tout** : Bible, références dans chaque carte, **verrou d'identité**, image validée avant l'animation, *Scène verrouillée*, raccord entre épisodes. Tout sert à garder les mêmes visages et les mêmes décors.
- **Rien n'est perdu** : chaque génération produit une **prise**. On choisit la meilleure, les autres restent disponibles.
- **Vous gardez la main** : les agents proposent, vous validez. Rien n'est rangé dans l'app, et rien n'est généré chez Agnes, sans votre accord.

---

## Nouveautés

### 3.10 — septembre 2026
- **Atelier IA — prompt parfait** ([21](docs/21-atelier.md)) : agent 16 *Directeur de plans* (angle, place de chaque personnage dans l'image, règles France, mentions @ et #) ; le Chef lit le Storyboard, écrit les prompts dans les cartes et peut **créer de nouveaux agents**, toujours avec votre accord.
- **Mentions @ et #** ([25](docs/25-mentions.md)) : `@[Nom]` (ou clic sur une pastille de référence) coche la référence ; `#[Skill]` insère le skill à cet endroit du prompt ; liste de suggestions.
- **Pack de skills « France »** (Skills → Import en masse → Packs, aussi dans `skills-packs/france.md`) : contexte français, circulation à droite, et 8 angles de caméra en voiture française avec la place du conducteur et du passager **dans l'image** (volant à gauche vu de l'intérieur, à droite de l'image vu de face).
- **Vidéos par Grok** ([24](docs/24-moteurs.md)) : dans Agnes ouverte depuis Lumina, moteur vidéo au choix (Agnes gratuit ou Grok) ; image de départ, dernière image du plan précédent et références envoyées sans imgbb ; durée arrondie à 6/10/15 s.
- **Images par ChatGPT** ([24](docs/24-moteurs.md)) : moteur d'image au choix (Agnes gratuit ou ChatGPT via Codex et le pont local) ; références jointes sans imgbb, planches au format 3:4 intactes.
- **Agnes dans Lumina** ([23](docs/23-lumina.md)) : onglet Agnes du panneau Lumina ; plans envoyés vers Grok Imagine (Stills → Clips ou Lot mixte, références et ADN Bible compris), rendus rangés comme prises, **pilote auto** `pilote.py lancer-agnes`.
- **Sauvegarde complète** (.zip) de tous les projets, médias, Bible et réglages, et **restauration** (onglet Projet) — sert aussi à transférer vers Lumina.
- Bibliothèques (JSZip, mammoth, pdf.js) copiées dans `vendor/` : plus besoin de connexion pour les charger.

### 3.9 — septembre 2026
**Écriture avec l'Atelier IA** ([21](docs/21-atelier.md))
- Équipe de **17 agents IA** : concept, bible de série, bible de personnages, épisodes, scènes, scénario, direction artistique, prompts image et vidéo, storyboard, package, plan de tournage, publication, montage, continuité.
- **Chef de production** qui coordonne l'équipe et range le travail dans la Bible, le Scénario, Le lot et Publication, **avec votre autorisation**.
- **Documents** (.txt, .md, .fountain, .docx, .pdf, pages web, texte collé), transmis aux agents de votre choix.
- Agents propulsés par **Agnes** (`agnes-2.5-flash`, même clé que les images et vidéos), avec d'autres fournisseurs en option (Gemini, Groq, OpenRouter, Mistral, API compatible OpenAI) et **relais automatique** quand l'un atteint sa limite.
- **Import des agents RMAOPN AI**, réglages par agent (modèle, créativité, longueur), appel direct d'un agent avec **@**.

**Agnes 2.5**
- Migration vers **Agnes Video 2.5 Flash** et **Image 2.5 Flash** (Video v2.0 retiré le 25/09/2026) : réglages migrés automatiquement, 4 à 12 s, attente adaptée à 1 vidéo par minute.
- **🧪 Test de génération vidéo** dans ⚙ avec rapport à copier, et **Requête vidéo envoyée** visible sur chaque carte.
- Vidéo avec image **refusée sans clé imgbb** : message immédiat au lieu d'une attente de 20 minutes ; **⟳ Reprendre le suivi** après un délai dépassé.

**Storyboard et Le lot**
- Carte **Texte → Image → Vidéo** : un prompt image et un prompt vidéo dans la même carte ; l'image est générée avec les références de la carte, validée, puis animée.
- **🎬 Convertir (vidéo)** sur toute carte image.
- **Le lot → Script numéroté** : IMAGE / VIDÉO / RÉF par numéro (blocs, tableau Markdown, CSV, JSON), une carte par numéro avec ses propres références, liste de vérification ; étiquette **N°** sur les cartes.

**Skills**
- **Import en masse** dans la carte de création : fichiers .md (un `##` par skill), .csv, .json ou texte collé, catégorie imposée, doublons ignorés ou mis à jour, aperçu avant import ; modèles .md et .csv.
- **Packs prêts à l'emploi** : Positions spatiales (25) et Styles visuels (20), aussi fournis en fichiers dans `skills-packs/`.
- Ligne **`SKILLS :`** dans les scripts de Le lot ; les agents de prompts et la conversion d'Extraire peuvent l'écrire.

**Extraire**
- **🔎 Veille** : l'IA propose des mots-clés, TikWM cherche les vidéos TikTok avec leurs statistiques ; classement par vues, likes, partages ou engagement ; les liens cochés vont dans « Télécharger depuis un lien » ; analyse IA de ce qui marche.
- **Tout est enregistré dans le projet** (liens, veille, vidéos analysées avec script corrigé, images et prompts).
- Script → **Atelier IA** (document) ou **✨ Convertir en prompts** plan par plan (avec les images extraites) → **Le lot**.

**Sous-titres**
- Extension **AutoCaption** : sous-titres animés posés après la génération (7 styles : TikTok, karaoké, mot par mot, encadré, classique, cyber-noir, néon ; police, couleurs, mot actif, contour, fond, position, animation), synchronisés sur les dialogues et le montage réel, dans l'Assemblage et le kit FFmpeg ; exports .srt / .ass.

**Image**
- **Agrandissement 720P → 1080p** (bicubique + netteté adaptative, sur la carte graphique) dans l'Assemblage, le kit FFmpeg et le bouton **⬇ 1080p**.

### Versions précédentes
| Version | Ajouts |
|---|---|
| **3.8** | **TikTok directement dans l'app** (onglet Extraire) : récupération par lien via TikWM, téléchargement HD sans filigrane, analyse immédiate, couverture → Bibliothèque |
| **3.7** | Extension **Extraire** : kit de téléchargement par lien (yt-dlp), script par transcription (Whisper gratuit dans le navigateur, API OpenAI, ou sous-titres), extraction d'images avec **détection des plans**, envoi vers Scénario, Bibliothèque ou Stills → Clip |
| **3.6** | Extension **Stills → Clip** : import d'images numérotées, prompts reliés par numéro (liste, .txt, .json, .csv), paires début/fin, format automatique |
| **3.5** | **Image → Vidéo** : *Scène verrouillée*, *Scène + références personnages*, réglage du **mouvement**, prompt négatif anti-invention |
| **3.4** | Bloc **Références** (personnages, lieux, objets) dans les cartes Texte → Vidéo/Image et Image → Image ; import direct ; **📖 Depuis la Bible** ; **verrou d'identité** |
| **3.3** | Aperçu direct des rendus que l'app ne peut pas télécharger, bouton **⟳ Récupérer le fichier** ; page protégée de la traduction automatique |

---

*Version 3.10 — septembre 2026.*
