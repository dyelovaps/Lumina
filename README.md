# Lumina — Grok & Google Flow

Lot Imagine pour [grok.com/imagine](https://grok.com/imagine).

## Agnes : Chef de l'Atelier et ressources locales (1.13.4, 01/10/2026)

Copie `agnes/` mise à jour depuis Agnes_production (`npm run sync:agnes`) :
- **Journée renvoyée sans doublon** : le Chef met à jour les cartes existantes (`update_shots` avec `document` + `cartes`,
  fonctions `parseLot` / `applyLotToCards` de `plugin-atelier.js`) au lieu de renvoyer le lot. Testé en réel (cartes #4-#6).
- **Ressources locales** : outils du Chef `marketing_ressources`, `transcrire_ressource` (vidéo servie par le pont →
  Extraire/Whisper → contrôle de la transcription par l'agent Marketing → fiche + document) et `marketing_extraire_fiche`.
- **Extraire** : API `transcribeBlob(blob, nom)` sans dépendance ; le Chef affiche un message si Extraire est désactivée.
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
