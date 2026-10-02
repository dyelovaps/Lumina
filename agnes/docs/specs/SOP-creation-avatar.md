# SOP / MASTER PROMPT — Extension « Création d'avatar » d'Agnes Studio Pro

> **À coller tel quel au début d'une nouvelle session Claude Code**, ouverte dans `C:\Users\rmaop\Documents\lumina-extension`.
> Cahier validé avec l'utilisatrice le 01/10/2026. Objectif : une extension **exploitable dès la fin de la session**, testée,
> documentée, synchronisée dans Lumina et commitée.

---

## 0. Rôle, contexte et règles de travail

Tu es le développeur d'Agnes Studio Pro, une app vendue sur abonnement avec des extensions, et intégrée comme onglet de
l'extension Chrome Lumina. L'utilisatrice **ne programme pas**. Donne-lui des chemins complets, des commandes prêtes à coller
et l'endroit où cliquer. Écris en français. Les prompts envoyés aux moteurs restent en anglais.

**Lis d'abord ta mémoire** (`MEMORY.md`), en particulier `studio-avatar-cahier`, `styles-prompt`, `chef-orchestre`,
`reprendre-avant-creer`, `modulaire-pas-remplacer`, `agnes-sans-emojis`, `adresses-pas-fonctions` et `agnes-produit-commercial`.

| Quoi | Où |
|---|---|
| Source d'Agnes (**à modifier ici**, pas de git) | `D:\Rmaopn\a classser\Dernier_projet\TitTok_Histoires_vraie\_BlackLow\Production\App\Agnes_production\` |
| Copie dans Lumina (**ne jamais l'éditer**) | `C:\Users\rmaop\Documents\lumina-extension\agnes\`, recopiée par `npm run sync:agnes` |
| Pont local et CLI Claude | `…\Production\App\prod-fruits\` (`lumina_bridge.py`, `agnes.py`), pont sur `http://127.0.0.1:8177` |
| Tests | `C:\Users\rmaop\Documents\lumina-extension\tests\*.test.cjs` (node:test + vm, sur la copie `agnes/`), liste dans `package.json` → `npm test` |
| Git | dépôt `lumina-extension`, branche **`agnes-integration`** (pas `main`) ; ne jamais commiter `flowkit-local` |
| Sauvegardes | `…\Production\App\_sauvegardes\<nom-date>\` (zip d'Agnes_production **avant** de toucher au code) |

**Règles impératives :**
1. **Modulaire.** Nouvelle extension activable dans ⚙ → Extensions. Ne rien supprimer ni casser : sans cette extension,
   Agnes marche exactement comme avant.
2. **Reprendre l'existant** : Bibliothèque, Bible (`plugin-bible.js`), Atelier IA et son Chef (`plugin-atelier.js`), Styles
   de prompt (`plugin-styles.js`), Moteurs (`plugin-moteurs.js`), Mentions. Aucun doublon de fonction.
3. **La Bible appartient à l'Atelier : seul le Chef la crée et la modifie.** L'extension **n'écrit jamais** dans la Bible.
   Elle s'arrête à l'envoi à l'Atelier.
4. **Interface sans emojis ni pictos**, étoiles comprises. Texte simple ; un état « favori » se dessine en CSS.
5. **Aucun code tiers copié** (produit commercial). Aucune bibliothèque distante : l'extension Chrome est en MV3.
6. **Aucun vrai nom de personne ni de marque** dans les prompts par défaut.
7. Chaque appel IA ou génération qui coûte des crédits se lance **sur un clic** de l'utilisatrice, jamais tout seul.
8. Fin de session : tests verts, doc écrite, `npm run sync:agnes`, commit et push sur `agnes-integration`, zip des
   dossiers non suivis par git, mémoire mise à jour.

---

## 1. Ce que veut l'utilisatrice (cahier)

Un **onglet séparé, « Création d'avatar »**, pour créer tout ce qui touche à un avatar ou à un personnage : son
**identité physique**, ses **tenues**, ses **lieux** et ses **objets**. Elle remplit des cases, surtout des listes
déroulantes et quelques champs libres :
- taille, corpulence, description physique… ;
- tenue : haut, bas, matières… ;
- lieu : type, lumière… ;
- objet.

L'app compose le **prompt final en anglais**. Elle voit un **aperçu de l'image dans un écran de visualisation 9:16 ou 16:9**,
puis clique sur **« Envoyer à l'Atelier »**. Ensuite, le Chef de l'Atelier :
1. crée ou met à jour la **Bible** ;
2. **rattache l'image validée** à la fiche de la Bible et la range dans la **Bibliothèque** ;
3. fait apparaître sur les cartes du Storyboard une **pastille Bible**. Au clic, elle montre l'ADN et permet de demander
   une modification au Chef.

**Exemple d'usage, non figé :** Anthony, l'avatar marketing, a une **tenue différente chaque jour** et un **lieu différent
pour chaque scène**. Les tenues et les lieux sont donc des fiches séparées, liées à l'avatar, et combinables.

**Ce qu'elle a validé :**
- elle peut ajouter, modifier et supprimer les valeurs des listes déroulantes ;
- la traduction se fait par un **dictionnaire intégré** pour les listes, et par l'**IA (Atelier)** seulement pour les champs libres ;
- la pastille Bible permet **les deux** : lire l'ADN et demander une modification au Chef ;
- l'**aperçu** se fait avant l'envoi ;
- la structure de l'écran est inspirée d'OpenArt (pas ses couleurs : celles d'Agnes) ;
- la **gestion publicitaire** viendra **plus tard**, dans une extension à part. Ne pas la coder, mais ne pas fermer la porte :
  le type de fiche doit rester extensible.

**Point de départ possible :** sa suggestion `C:\Users\rmaop\Downloads\files.zip` (`plugin-promptlab.js` +
`promptlab-studio.css`). C'est son code, généré par Claude sur un autre compte : il n'y a pas de problème de licence. Il
apporte de bonnes idées (niveaux Essentiel, Détaillé et Extrême ; types de fiche ; favoris ; collections ; export et import
.json). Il a aussi des défauts connus, à ne pas reproduire :
- le mode Texte → Image est cherché dans les cartes au lieu de valoir `t2i` ;
- il écoute `view:change` sur « promptlab », alors qu'Agnes émet `view_promptlab` ;
- son CSS n'est pas dans `studio.css` ;
- il n'est pas inscrit dans `active-module.js` ;
- ses prompts sortent en français avec des étiquettes ;
- il affiche des étoiles ★.

---

## 2. Fichiers à créer ou modifier

| Fichier (dans `Agnes_production\`) | Action |
|---|---|
| `plugins/plugin-avatar.js` | **Nouveau** : l'extension (`AgnesPlugins.register("avatar", …)`) |
| `css/studio.css` | **Ajouter en fin de fichier** une section `/* Création d'avatar (extension, AAAA-MM-JJ) */`, toutes les classes préfixées `.av-` |
| `Module-reglage/active-module.js` | Inscrire `{ key: "avatar", id: "avatar", label: "Création d'avatar — onglet …", file: "plugins/plugin-avatar.js", defaultOn: true }` (avant `classement`) |
| `plugins/plugin-atelier.js` | Nouvel outil du Chef `bible_attacher_image` (avec autorisation) ; consigne « fiche reçue de Création d'avatar » dans `managerSystem` |
| `plugins/plugin-bible.js` | Filtres de la Bible (§ 9) ; méthode publique `attacherImage(nomOuId, blob)` utilisée **par l'outil du Chef seulement** |
| `plugins/plugin-moteurs.js` | Exposer `genererImage({ prompt, ratio, refs, planche, signal, onInfo })` → `Promise<Blob>`, en réutilisant `chatgptImage` / `wait` (pas de copie de code) |
| `plugins/plugin-claude.js` + `prod-fruits/agnes.py` | Commandes `avatars`, `avatar`, `avatar_prompt`, `envoyer_avatar` (§ 11) |
| `docs/30-creation-avatar.md` | **Nouveau** : notice utilisatrice |
| `README.md` (Agnes) | Ligne dans « Notices par section » + bloc « 3.13 — octobre 2026 » dans Nouveautés |
| `docs/21-atelier.md`, `docs/29-styles.md` | Paragraphe sur le relais Création d'avatar → Chef |
| Lumina : `tests/agnes-avatar.test.cjs`, `package.json` (script `test`), `README.md` (section 1.13.8), `manifest.json` (1.13.8) | Tests et version |

Avant d'écrire du code, **lis** : `js/agnes-core.js` (API des extensions), `plugins/plugin-styles.js` (modèle d'extension
récente avec carte éditable), `plugins/plugin-bible.js`, la partie outils et `managerSystem` de `plugins/plugin-atelier.js`,
`plugins/plugin-moteurs.js` (`chatgptImage`, `wait`, `quality`, `isSheet`), `js/app-ui.js` (rendu des cartes, événement
`shots:render`), et le début de `css/studio.css` (variables `:root`).

---

## 3. API d'Agnes à utiliser (déjà existante)

- `core.ui.addTab("avatar", "Création d'avatar", html)` → la vue a l'identifiant **`view_avatar`** ; `core.on("view:change", id => id === "view_avatar" …)`.
- Stockage : `core.store.getKV/setKV` (JSON) et `core.store.get/put/del` (Blob). Réglages légers : `core.pluginSettings("avatar", {...})`.
- `core.toast(msg, "ok"|"err")`, `core.download(blob, name)`, `core.getProject()`, `core.saveProject()`, `core.on/emit`.
- Bibliothèque : `core.addToLibrary(blob, { name, kind, bibleId, bibleRef })` ; types `personnage | decor | objet | costume | style | autre`.
- Atelier : `AgnesPlugins.get("atelier")` → `addDoc(nom, contenu, source, remplacer)`, `ask(texte)` (envoie au Chef ; refuse si
  le Chef travaille ou si une autorisation attend), `chat(messages, extra)` (chaîne de fournisseurs IA de l'Atelier, avec Codex),
  `styleProjet()` et `common()`.
- Bible : `AgnesPlugins.get("bible")`, données dans `KINDS` (`personnage`, `lieu`, `objet`, `costume`, `autre`), entrées
  `{ id, name, kind, aliases, dna, refs, byProject }`. Le Chef écrit avec son outil `bible_upsert`.
- Style du projet : `AgnesPlugins.get("styles").courant(projet)` → `{ nom, image, video, texteEcran, musique }`.
- Extension présente ? `AgnesPlugins.isLoaded("bible")`, `…("atelier")`, `…("moteurs")`, `…("styles")`. Si une extension
  manque, affiche un message clair (« Activez la Bible dans ⚙ → Extensions ») et ne plante jamais.

---

## 4. Modèle de données

Fiches **communes à tous les projets** (comme la Bibliothèque de l'Atelier Prompt), clé KV `avatar:fiches` :

```js
{
  id: "av…", type: "avatar" | "personnage" | "tenue" | "lieu" | "objet",   // extensible (publicité plus tard)
  nom: "Anthony", collection: "Marketing", etiquettes: ["coach"], favori: false, note: 0,   // note 0 à 5
  champs: { age: "35", taille: "178", corpulence: "athletique", … },          // valeurs FR (ids de liste ou texte libre)
  traductions: { "<champ>": { fr: "…", en: "…" } },                          // cache des champs libres traduits
  liens: { tenues: [ids], lieux: [ids], objets: [ids], tenueDefaut: id, lieuDefaut: id },   // avatar / personnage
  combinaisons: [ { id, nom: "Mardi — bureau", tenue: id, lieu: id, objets: [ids], cadrage, action } ],
  priseDeVue: { format: "9:16", cadrage, angle, objectif, lumiere, profondeur, rendu },
  aEviter: "…",                                    // FR libre → traduit → « Avoid: … » dans le prompt
  essais: [ { cle: "avatar:img:<id>:<ts>", format: "9:16", prompt: "…", moteur: "chatgpt", date } ],   // 12 au plus
  imageValidee: "<cle d'un essai>",
  envois: [ { date, document: "Création d'avatar — Anthony", statut: "envoyé" } ],
  cree, modifie
}
```

**Listes déroulantes éditables**, clé KV `avatar:listes`. Chaque liste est `{ id, nom, valeurs: [{ id, fr, en }] }`. Il y a
des valeurs d'origine (§ 6) et un bouton « Rétablir les valeurs d'origine », qui garde les ajouts de l'utilisatrice.

---

## 5. Les fiches et leurs champs

Les niveaux viennent de la suggestion : **1 = Essentiel, 2 = Détaillé, 3 = Extrême**. Le niveau choisi décide des champs
affichés. Un champ rempli puis masqué reste enregistré, mais **n'entre pas** dans le prompt. Signification des marques :
**(L)** = liste déroulante éditable, **(N)** = nombre, **(T)** = texte libre traduit par l'IA.

### 5.1 Avatar / Personnage (même formulaire ; l'avatar a un bloc « Marketing » en plus)
- **Identité :** prénom (T, jamais traduit), âge (N), genre (L), origine apparente (L), rôle ou archétype (T, niv. 2).
- **Corps :** taille en cm (N) → `about 1.78 m tall` ; corpulence (L) ; morphologie et carrure (L, niv. 2) ; posture (L, niv. 2) ; mains (T, niv. 3).
- **Visage :** forme (L) ; teint (L) ; sous-ton (L, niv. 2) ; yeux, couleur (L) et forme (L, niv. 2) ; sourcils (L, niv. 2) ;
  nez (L, niv. 3) ; lèvres (L, niv. 3) ; mâchoire et pommettes (L, niv. 3) ; rides et âge visible (L, niv. 2) ;
  barbe et moustache (L) ; maquillage (L, niv. 2).
- **Cheveux :** couleur (L) ; longueur (L) ; texture (L) ; coiffure (L) ; raie (L, niv. 2) ; détails (T, niv. 3).
- **Signes distinctifs :** lunettes (L) ; grains de beauté, cicatrices, taches de rousseur (T) ; tatouages et piercings (T, niv. 3).
- **Jeu (hors image) :** expression habituelle (L, niv. 2), regard (L, niv. 2), gestuelle (T, niv. 3), voix et façon de parler
  (T, niv. 3, **jamais dans le prompt image** : seulement dans le document envoyé au Chef).
- **Continuité :** à ne jamais changer (T, niv. 2).
- **Marketing (avatar seulement, hors image, dans le document du Chef) :** public visé, ton de marque, secteur, rapport à la caméra.
- **Liens :** tenues, lieux et objets liés (cases à cocher parmi les fiches existantes) ; tenue et lieu par défaut ;
  **combinaisons** enregistrées (nom + tenue + lieu + objets + cadrage + action), par exemple « Mardi — bureau ».

### 5.2 Tenue
Occasion (L) ; style (L) ; haut, bas, couche (veste, manteau), chaussures (T) ; couleurs (L, choix multiple) ;
matières (L, multiple) ; coupe (L) ; état (L, niv. 2) ; motifs (L, niv. 2) ; accessoires et bijoux (T, niv. 2) ;
saison ou époque (L, niv. 3) ; détails de fabrication (T, niv. 3).

### 5.3 Lieu
Type de lieu (L) ; intérieur ou extérieur (L) ; pays et ville (T, France par défaut) ; éléments principaux (T) ; mobilier (T, niv. 2) ;
matériaux (L multiple, niv. 2) ; palette (L multiple) ; moment de la journée (L) ; météo (L, niv. 2) ; lumière (L) ;
ambiance (L) ; premier plan et arrière-plan (T, niv. 3) ; échelle (L, niv. 3) ; texte visible à l'écran (T, niv. 3 :
entre apostrophes `'…'`, voir les règles des Styles de prompt).

### 5.4 Objet
Type (L) ; taille ou échelle (L) ; matière (L) ; couleur (L) ; état (L) ; détails (T) ; marque **inventée** (T) ;
texte écrit sur l'objet (T, entre apostrophes `'…'`).

### 5.5 Prise de vue (bloc commun à toutes les fiches)
Format d'aperçu (**9:16 | 16:9**, puis 1:1, 4:5, 3:4 en option) ; type d'image (L : planche de référence, portrait en situation,
plein pied, lieu vide, packshot d'objet) ; cadrage (L) ; angle (L) ; objectif (L, niv. 2) ; lumière (L, niv. 2) ;
profondeur de champ (L, niv. 3) ; rendu (L, niv. 3) ; à éviter (T).
**Le style visuel n'est pas choisi ici.** C'est le **style du projet** (Styles de prompt) qui s'applique à l'envoi. Dans
l'aperçu, un menu « Rendu de l'aperçu » propose Réaliste, Cartoon, ou celui du projet ouvert (par défaut).

---

## 6. Dictionnaire des listes (valeurs d'origine)

Chaque valeur a un libellé `fr` et une traduction `en`. Elle est **modifiable dans l'onglet**. Au minimum 6 à 15 valeurs par
liste. Exemples à suivre :

| Liste | fr → en |
|---|---|
| genre | femme → woman · homme → man · personne non binaire → androgynous person |
| corpulence | mince → slim build · élancée → lean build · athlétique → athletic build · moyenne → average build · ronde → curvy build · forte → heavyset build · musclée → muscular build |
| teint | très clair → very fair skin · clair → fair skin · olive → olive skin · mat → tan skin · brun → brown skin · foncé → dark brown skin · ébène → deep dark skin |
| yeux | bruns → brown eyes · noisette → hazel eyes · verts → green eyes · bleus → blue eyes · gris → grey eyes · noirs → dark eyes |
| cheveux longueur | rasés → shaved head · très courts → buzz cut · courts → short hair · mi-longs → shoulder-length hair · longs → long hair · très longs → very long hair |
| coiffure | raie au milieu → middle part · dégradé → fade haircut · chignon → bun · queue de cheval → ponytail · tresses → braids · locks → locs · afro → afro · bouclés naturels → natural curls |
| barbe | rasé de près → clean-shaven · barbe de 3 jours → light stubble · barbe courte taillée → short trimmed beard · barbe pleine → full beard · moustache → moustache |
| lunettes | aucune → (rien) · fines dorées → thin gold-rimmed glasses · rondes métal → round metal glasses · épaisses noires → thick black frames · lunettes de soleil → sunglasses |
| cadrage | gros plan → close-up · rapproché poitrine → medium close-up · taille → medium shot · américain → medium long shot · plein pied → full body shot · plan d'ensemble → wide establishing shot |
| angle | hauteur d'yeux → eye level · légère contre-plongée → slight low angle · légère plongée → slight high angle · trois-quarts → three-quarter view · profil → profile view · par-dessus l'épaule → over-the-shoulder |
| lumière | naturelle douce → soft natural light · fenêtre latérale → side window light · heure dorée → golden hour light · studio trois points → three-point studio lighting · néon nocturne → neon night lighting · tungstène chaud → warm tungsten practical light |
| moment | matin → morning · midi → midday · fin d'après-midi → late afternoon · heure bleue → blue hour · nuit → night |

Ajoute de la même façon toutes les autres listes du § 5 : origine, sous-ton, forme du visage, sourcils, nez, lèvres,
mâchoire, rides, maquillage, texture, couleur des cheveux, raie, posture, morphologie, expression, regard, occasion, style
vestimentaire, couleurs, matières, coupe, état, motifs, saison, type de lieu, intérieur ou extérieur, matériaux, palette,
météo, ambiance, échelle, type d'objet, taille d'objet, objectif, profondeur, rendu, type d'image.

**Taille :** cm → `about 1.78 m tall`. **Âge :** `35` → `35-year-old`.

---

## 7. Composition du prompt anglais

**Règle d'or : déterministe.** Les listes sont traduites par le dictionnaire, les nombres par une formule. **Seuls les
champs (T)** passent par l'IA, sur clic de « Traduire » ou au premier « Générer l'aperçu ». La traduction est **mise en cache**
dans `traductions` et refaite seulement si le texte français change. Pour la traduction, appelle
`atelier.chat([{role:"system", content:"Translate to concise natural English for an image prompt. Output only the translation."},{role:"user", content: fr}])`.
Si aucune IA ne répond : garde le français, affiche « non traduit », ne bloque rien.

Il y a **trois sorties**, avec un bouton Copier pour chacune :

1. **ADN court**, une seule ligne (convention de la Bible et de l'agent 3) : identité stable, **sans émotion ni action ni
   décor**. Pour un avatar ou un personnage :
   `35-year-old French man, about 1.78 m tall, athletic build, olive skin, short black hair with a fade haircut, brown eyes, short trimmed beard, thin gold-rimmed glasses, small scar above the right eyebrow`
   Pour une tenue : `navy blue wool blazer over a white crew-neck t-shirt, slim grey chinos, white leather sneakers`.
   Pour un lieu ou un objet : la même logique, en une phrase.
2. **Prompt d'aperçu** (image), selon le **type d'image** :
   - Planche : `Character reference sheet of <Nom>: <ADN> wearing <ADN tenue>. Three views side by side on a plain light grey background: front, three-quarter, profile, <cadrage>, neutral relaxed expression. <rendu>, soft even studio light, tack-sharp, no film grain.`
     Ce début est reconnu par `isSheet()` de plugin-moteurs.
   - Portrait en situation : `<Nom>, <ADN>, wearing <tenue>, <action ou pose neutre> in <ADN lieu>. <cadrage>, <angle>, <objectif>, <lumière>, <profondeur>. <rendu>, tack-sharp, no film grain.`
   - Lieu vide : `Empty location reference: <ADN lieu>. <cadrage>, no people. …`
   - Packshot d'objet : `Product reference of <ADN objet> on a plain background, <angle>, studio light. …`
   - En fin de prompt, si « À éviter » est rempli : `Avoid: <traduction>`. ChatGPT et Grok ne reçoivent pas le prompt
     négatif d'Agnes : c'est donc ici qu'il compte.
   - Le **style du projet** (`styles.courant()`) s'ajoute **à l'envoi au moteur** par `plugin-moteurs.quality`, comme pour une
     carte. Ne le recopie pas dans le prompt affiché, mais signale-le : « + règles du style “Série réaliste” ».
3. **Prompt de combinaison** (avatar avec tenue, lieu et objets d'une combinaison enregistrée) : il sert à l'aperçu « en
   situation » et part dans le document envoyé au Chef.

**Interdits dans le texte produit** : vrais noms de personnes ou de marques, guillemets « » (réservés aux répliques), emojis.

---

## 8. Écran de l'onglet (structure à la OpenArt, couleurs d'Agnes)

### 8.1 Disposition sur un écran large (1280 px et plus) : trois colonnes
```
┌──────────────┬──────────────────────────────────────┬──────────────────────────────┐
│ NAVIGATION   │ BARRE : recherche · type · collection │ FICHE (panneau de droite)    │
│ Avatars      │ · tri · Favoris · [+ Nouvelle fiche]  │ Nom · type · collection      │
│ Personnages  ├──────────────────────────────────────┤ Niveau : Essentiel/Détaillé/ │
│ Tenues       │ GALERIE en grille de cartes          │ Extrême                      │
│ Lieux        │ (miniature = image validée ou        │ Onglets internes :           │
│ Objets       │  dernier essai, sinon silhouette du  │  Identité · Corps · Visage · │
│ ──────────   │  cadrage) · nom · type · pastilles   │  Cheveux · Signes · Liens ·  │
│ Favoris      │  « Envoyé », « Image validée »       │  Prise de vue                │
│ Collections  │                                      │ ──────────────────────────── │
│ ──────────   │                                      │ ÉCRAN DE VISUALISATION (§ 8.3)│
│ Listes       │                                      │ PROMPT ANGLAIS (ADN / aperçu │
│ (éditer)     │                                      │  / combinaison) · Copier     │
│ Import/Export│                                      │ [Générer l'aperçu] [Valider] │
│              │                                      │ [Envoyer à l'Atelier]        │
└──────────────┴──────────────────────────────────────┴──────────────────────────────┘
```
- Colonnes : `grid-template-columns: 220px minmax(0, 1fr) minmax(360px, 440px)`. Écart avec la variable d'espacement de l'app.
- Galerie : `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))`. Les cartes ont l'aspect de leur image
  (`aspect-ratio` 9/16 ou 16/9), et la miniature est en `object-fit: cover`.
- Le panneau de droite est **collant** (`position: sticky; top: …; max-height: calc(100vh - …); overflow: auto`).

### 8.2 Responsive (obligatoire, à tester à chaque largeur)
| Largeur | Disposition |
|---|---|
| ≥ 1280 px | 3 colonnes comme ci-dessus |
| 960 à 1279 px | 2 colonnes : la navigation devient une **barre horizontale de filtres** (boutons défilants) au-dessus de la galerie ; galerie + panneau à droite (`minmax(0,1fr) minmax(340px, 400px)`) |
| 640 à 959 px | 1 colonne : barre de filtres, galerie (`minmax(140px,1fr)`) ; la fiche s'ouvre en **panneau plein écran** par-dessus la galerie, avec un bouton « Retour à la galerie » |
| < 640 px | Comme au-dessus ; galerie en 2 colonnes ; marges latérales de 16 px ; les champs de la fiche passent sur une colonne ; boutons d'action en bas, collants, sur toute la largeur |
- Aucun défilement horizontal de la page, quelle que soit la largeur. Les zones de texte sont en `min-width: 0`.
- Respect de `prefers-reduced-motion` (pas d'animation de transition dans ce cas).
- Clavier : tout est atteignable à la tabulation ; Échap ferme le panneau plein écran et l'aperçu agrandi.

### 8.3 Écran de visualisation (aperçu avant envoi)
- Un **cadre au format choisi** : sélecteur **9:16 | 16:9** (et 1:1, 4:5, 3:4). Par défaut 16:9 pour une planche ou un lieu,
  9:16 pour un portrait en situation. Le cadre utilise `aspect-ratio` ; l'image est en `object-fit: contain` sur fond noir
  (`.ext-canvas`).
  - **9:16** : hauteur limitée à `min(70vh, 640px)`, largeur automatique, cadre centré.
  - **16:9** : largeur 100 % du panneau, hauteur automatique.
  - Sans image : **silhouette du cadrage** dessinée sur un canvas, comme dans la suggestion, avec la grille des tiers et une
    étiquette `9:16 · plan taille`.
- Boutons :
  - **« Générer l'aperçu »** : un clic = **une** image. Elle passe par `moteurs.genererImage` (ChatGPT via le pont
    `/codex/image` puis `/codex/etat` et `/codex/resultat` ; sinon le moteur image choisi dans ⚙ → Moteurs).
  - Pendant la génération : état « En attente chez ChatGPT, position n » et bouton Annuler (`AbortController`).
- **Bande d'essais** sous le cadre : 12 au plus, miniatures cliquables. Sur chaque essai :
  - **« Valider cette image »** : elle devient `imageValidee`, avec un contour net sur la miniature et un libellé « Validée » ;
  - **« Supprimer »** ;
  - **« Agrandir »** : vue plein écran au même format, Échap pour fermer.
- Les références envoyées au moteur sont l'image validée de la tenue, du lieu ou de l'objet liés, s'il y en a. C'est ce qui
  garde la cohérence entre fiches.
- Si le pont ne répond pas : message clair, avec la commande à coller pour le lancer.

### 8.4 Gestion des listes (« Listes » dans la navigation)
Tableau par liste : libellé français, traduction anglaise, boutons Monter, Descendre et Supprimer ; « Ajouter une valeur » ;
« Rétablir les valeurs d'origine ». Une valeur supprimée mais encore utilisée par une fiche reste affichée dans cette fiche,
avec la mention « valeur retirée de la liste ».

---

## 9. Bible : filtres et pastille sur les cartes

**Filtres de la Bible** (dans `plugin-bible.js`, onglet Bible). Il existe déjà un `bbFilter` par type : vérifie-le et
complète-le pour qu'il ressemble à la Bibliothèque :
- boutons Tous · Personnages · Tenues (`costume`) · Lieux · Objets · Autres ;
- une recherche par nom ou alias ;
- le filtre choisi est retenu.
**Ne retire pas l'édition manuelle existante** (règle modulaire). L'extension Création d'avatar, elle, n'écrit jamais dans
la Bible.

**Pastille Bible sur les cartes du Storyboard** (dans `plugin-avatar.js`, sur l'événement `shots:render`). Dans chaque carte,
sous le bloc Références, une ligne de pastilles `.av-bible-chip` :
- une pastille pour chaque entrée de la Bible liée à la carte ;
- une entrée est liée si une référence cochée de la Bibliothèque porte son `bibleId`, ou si `bible.matches(entrée, carte, projet)` la trouve ;
- chaque pastille affiche « Bible · Anthony », avec la miniature de la référence si elle existe.

Au clic, un petit panneau s'ouvre :
- **lecture** : type, ADN (en anglais), note d'épisode, avec un bouton Copier l'ADN ;
- **demande au Chef** : une zone de texte et le bouton « Demander une modification au Chef ». Il appelle
  `atelier.ask("Modifie la fiche de la Bible « <nom> » : <texte>. Utilise bible_upsert puis dis-moi ce qui a changé.")`.
  Si le Chef est occupé ou attend une autorisation, le message d'`ask` s'affiche tel quel.

Sans la Bible ou sans l'Atelier, il n'y a pas de pastille, et rien ne plante.

---

## 10. « Envoyer à l'Atelier » : le relais vers le Chef

Le bouton n'est actif que si la fiche a un nom et un ADN. Il **conseille**, sans l'exiger, d'avoir une image validée.
1. **Crée ou remplace un document** de l'Atelier avec
   `addDoc("Création d'avatar — <Nom>", markdown, "Création d'avatar", true)`. Contenu du markdown :
   - en-tête : type, nom, collection, date, **identifiant de fiche** `av…` ;
   - **ADN (anglais)**, en une ligne ;
   - un résumé en français des champs remplis, groupés comme dans la fiche ;
   - les fiches liées (tenues, lieux, objets) avec leur ADN, la tenue et le lieu par défaut, et les **combinaisons** ;
   - le bloc Marketing ou Jeu (voix, ton, public) pour les agents d'écriture ;
   - les prompts anglais (aperçu, combinaisons) ;
   - « Image validée : oui (essai du <date>, format 16:9) » ou « non ».
2. **Prévient le Chef** avec `atelier.ask(…)` :
   > « Nouvelle fiche de Création d'avatar : document “Création d'avatar — <Nom>” (fiche <id>). Lis-le avec get_document.
   > Crée ou mets à jour la fiche de la Bible avec bible_upsert : type <personnage|costume|lieu|objet>, l'ADN tel quel, sans
   > le réécrire. Ensuite, si une image est validée, rattache-la avec bible_attacher_image (fiche <id>). Ne crée aucune carte. »
3. Ajoute la ligne d'historique à `envois[]` et affiche la pastille « Envoyé le … » sur la carte de la galerie.

**Nouvel outil du Chef `bible_attacher_image`** (dans `plugin-atelier.js`, avec autorisation, ajouté à la liste des outils
qui demandent l'autorisation) :
- paramètres : `{ fiche: "av…", nom: "<entrée de la Bible>" }` ;
- action : `AgnesPlugins.get("avatar").imageValidee(fiche)` donne le Blob, puis `bible.attacherImage(nom, blob)`. Cette
  méthode fait `storeRef` puis `toLibrary` : la référence arrive dans la **Bibliothèque** avec son `bibleId`, et la pastille
  des cartes en profite ;
- la description de la demande d'autorisation dit : « Rattacher l'image validée de la fiche <Nom> à la Bible et la ranger
  dans la Bibliothèque ».

**Consigne à ajouter dans `managerSystem` :** un document « Création d'avatar — … » vient de l'utilisatrice, et son ADN se
recopie mot pour mot. Seul le Chef écrit la Bible. Ne pas créer de cartes : les cartes restent créées par l'utilisatrice ou
par Claude. Les tenues et les lieux d'un avatar sont des entrées séparées (`costume`, `lieu`) ; la tenue du jour et le lieu de
chaque scène se choisissent parmi elles.

---

## 11. Commandes pour Claude (pont)

Dans `plugin-claude.js` (switch des actions) et dans l'aide en tête de `prod-fruits/agnes.py` :
```
python agnes.py avatars [type=avatar]                 # liste des fiches (id, type, nom, image validée, envoyée)
python agnes.py avatar id=av… | nom="Anthony"          # fiche complète + ADN + prompts
python agnes.py avatar_prompt id=av… [format=9:16]     # prompt anglais d'aperçu
python agnes.py envoyer_avatar id=av…                  # même chose que le bouton Envoyer à l'Atelier
```
Ajoute `avatars`, `avatar` et `avatar_prompt` à `LECTURE` dans agnes.py : elles ne modifient rien. Aucune commande ne lance
de génération payante.

---

## 12. Tests (obligatoires) : `tests/agnes-avatar.test.cjs`

Même méthode que `tests/agnes-styles.test.cjs` : vm, faux `core`, chargement des fichiers depuis `agnes/`. À couvrir au
minimum :
1. **Dictionnaire** : une fiche remplie avec des listes donne exactement l'ADN attendu (taille → `about 1.78 m tall`,
   âge → `35-year-old`) ; une valeur modifiée par l'utilisatrice change la sortie ; « Rétablir » garde les ajouts.
2. **Traduction des champs libres** : appelée une fois (cache), refaite seulement si le français change ; si l'IA est en panne, le français est gardé et rien ne plante.
3. **Prompts** : la planche commence par `Character reference sheet of` (donc `isSheet` vaut vrai) ; « À éviter » donne `Avoid: …` ; aucun « » ni emoji dans la sortie.
4. **Niveaux** : un champ de niveau 3 rempli n'entre pas dans le prompt au niveau 2.
5. **Envoi** : `addDoc` reçoit le bon nom et un contenu qui contient l'ADN, l'identifiant et les combinaisons ; `ask` reçoit la consigne ; **aucun appel à la Bible** depuis l'extension.
6. **Outil du Chef** `bible_attacher_image` : il appelle `attacherImage` avec le Blob validé ; erreur claire s'il n'y a pas d'image validée ; il est bien dans la liste des outils soumis à autorisation.
7. **Pastille** : une carte dont la référence cochée porte un `bibleId` affiche la pastille ; sans la Bible, aucune pastille et aucune erreur.
8. **Inscription** : `active-module.js` contient l'extension ; la vue est `view_avatar` ; le CSS contient la section `.av-`.
Lance **toute** la suite (`npm test`) : tout doit rester vert (197 tests au 01/10/2026, plus les nouveaux).

---

## 13. Vérification visuelle (navigateur intégré)

`.claude/launch.json` du dépôt Lumina contient déjà `agnes-static` (serveur Python sur le port 8765). Lance-le, puis
ouvre `http://localhost:8765/agnes/index.html` (après `npm run sync:agnes`).
- Crée un avatar, une tenue et un lieu, lie-les, enregistre une combinaison, change de niveau et vérifie le prompt anglais.
- Teste l'écran de visualisation en **9:16 puis 16:9**, avec la silhouette (pas de génération : le pont peut être absent).
- Redimensionne aux largeurs **1440, 1100, 800 et 375 px** : pas de défilement horizontal, le panneau plein écran marche, Échap le ferme.
- Ouvre la console : **aucune erreur**.
- Fais une capture et envoie-la à l'utilisatrice.
- Ne lance **aucune** génération ChatGPT réelle sans son accord : elle coûte des crédits.

---

## 14. Documentation et fin de session

- `docs/30-creation-avatar.md` : à quoi sert l'onglet, où cliquer, les niveaux, les listes éditables, l'aperçu 9:16 et 16:9,
  le relais au Chef, la pastille Bible, les commandes Claude, les limites. Écrit pour quelqu'un qui ne programme pas.
- README d'Agnes : notice 30 et Nouveautés 3.13. `docs/21-atelier.md` : outil `bible_attacher_image` et documents
  « Création d'avatar ». README de Lumina : section 1.13.8. `manifest.json` : 1.13.8.
- Ordre de fin de session :
  1. zip d'`Agnes_production` dans `_sauvegardes\avant-avatar-<date>\` (**au début**, avant de coder) ;
  2. `npm run sync:agnes` ;
  3. `npm test` (tout vert) ;
  4. commit sur `agnes-integration` (message « Lumina 1.13.8 : Agnes — Création d'avatar … ») et push ;
  5. zip de fin de session dans `_sauvegardes\fin-session-<date>-avatar\` ;
  6. mise à jour de la mémoire (`studio-avatar-cahier` : fait, commit, ce qui n'est pas testé en réel).
- **Dis-lui comment l'essayer** : ↻ Lumina dans `chrome://extensions`, F5 sur Agnes, onglet « Création d'avatar ». Liste
  aussi ce qui n'a **pas** été testé en réel (génération ChatGPT réelle, Chef réel).

---

## 15. Questions à poser à l'utilisatrice au début, seulement si c'est encore flou

1. Le nom de l'onglet : « Création d'avatar » ou « Studio personnages » ?
2. La Bible doit-elle devenir **en lecture seule** pour elle, puisque seul le Chef la gère ? Par défaut, on ne touche pas à
   l'édition existante : règle modulaire.
3. Faut-il un bouton pour reprendre les fiches existantes de la Bible (Anthony, ses tenues, ses lieux) comme point de départ
   d'une fiche ? C'est une lecture seule de la Bible, permise.
