# 20 — Créer une extension

Les extensions sont de simples fichiers JavaScript dans `plugins/`. Elles utilisent l'objet global **`AgnesCore`** et n'ont jamais besoin de toucher au code de l'application.

[← Retour au README](../README.md)

---

## 1. Le fichier
```js
// plugins/plugin-exemple.js
AgnesPlugins.register("exemple", {
  name: "Mon extension",
  version: "1.0",
  init: function (core) {           // appelé une seule fois, core = AgnesCore
    var view = core.ui.addTab("exemple", "Exemple", '<div class="card"><h3>Bonjour</h3></div>');
    core.ui.addShotAction("⭐ Action", function (shot, take) { core.toast("Plan : " + shot.prompt); });
  }
});
```

## 2. La déclarer
Dans `Module-reglage/active-module.js`, ajoutez une ligne au tableau `EXTENSIONS` :
```js
{ key: "exemple", id: "exemple", label: "Mon extension", file: "plugins/plugin-exemple.js" }
```
Ajoutez `defaultOn: true` pour qu'elle soit active d'office (tant que l'utilisateur ne l'a pas décochée).
Le `id` doit être celui passé à `AgnesPlugins.register`. L'extension apparaît alors dans ⚙. Les extensions se chargent dans l'ordre du tableau.

## API `AgnesCore`

### Données
| Fonction | Retour |
|---|---|
| `getProject()` / `getAllProjects()` / `getProjectById(id)` | Projet(s) |
| `getShots()` / `sortedShotsOf(projId)` / `getShot(id)` | Plans, dans l'ordre |
| `getLibrary()` | Bibliothèque du projet |
| `getSelectedTake(shot)` | Prise sélectionnée |
| `getTakeBlob(takeId)` / `getTakeBlobOrFetch(take)` / `getLibBlob(item)` | Fichiers (Blob) |
| `getMontagePlan()` | Plans du montage avec découpes et transitions |
| `getMontageTimeline()` | *(Promise)* `{ total, marks: [{ t, len, it }] }` avec les durées réelles |
| `getSettings()` | Réglages (sans la clé API) |
| `previewPrompt(shot)` | Prompt final exact |

### Actions
| Fonction | Effet |
|---|---|
| `addShot(opts)` | Crée un plan (`{ mode, prompt, duration, … }`) |
| `addMediaShot(blob, "image"\|"video", opts)` | Plan déjà terminé à partir d'un média (`position`, `still`, `tin`, `tout`, `trans`, `label`) |
| `updateShot(id, patch)` | Modifie un plan (`undefined` = supprime le champ) |
| `enqueue(shotId)` | Lance la génération |
| `addToLibrary(blob, meta)` | Ajoute une image à la bibliothèque |
| `setShotVoice(id, blob, meta)` / `clearShotVoice(id)` / `getShotVoiceBlob(id)` | Voix d'un plan (mixée au montage) |
| `openProject(id)` | Change de projet |
| `saveProject()` | Enregistre après une modification directe |
| `toast(msg, "ok"\|"err")` · `download(blob, nom)` | Interface |
| `addPromptFilter(fn)` | `fn(prompt, shot, projet, "image"\|"video") → prompt` : transforme le prompt final (c'est ce qu'utilise la Bible) |

### Stockage
| Fonction | Usage |
|---|---|
| `store.get/put/del(clé, blob)` | Fichiers dans IndexedDB. **Préfixez vos clés** (`monplugin:…`) : le nettoyage des orphelins ne touche qu'aux préfixes du studio |
| `store.getKV/setKV(clé, valeur)` | Données JSON |
| `pluginSettings(id, défauts)` | Réglages persistants : `cfg.x = 1; cfg.save();` |

Données de projet : vous pouvez ajouter vos propres champs à `getProject()`, puis appeler `saveProject()`. Champs déjà utilisés : `voiceCast`, `audioBeds`, `grade`, `publish`, `bibleSeriesId`, `prevEpisodeId`, et `shot.voice`, `shot.voiceDraft`, `shot.media`, `shot.ingredients` (références), `shot.lock` (verrou d'identité), `shot.i2v` (`standard`\|`anchor`\|`refs`), `shot.motion` (`subtle`\|`moderate`\|`free`), `shot.stillNo`, `shot.batchNo` (numéro du script du lot), `shot.imagePrompt`, `shot.keyTakes`, `shot.keyTakeId`, `shot.keyOutputs`, `shot.autoAnimate` (Texte → Image → Vidéo ; `AgnesApp.isTwoStep(shot)`).

Autres extensions utilisables depuis la vôtre : `AgnesPlugins.get("stills").addFiles(fichiers)` (envoie des images dans Stills → Clip), `AgnesPlugins.get("bible").ensureEntries(noms)`.

### Interface
| Fonction | Effet |
|---|---|
| `ui.addTab(id, titre, html)` | Onglet ; renvoie la `<section id="view_<id>">` |
| `ui.addShotAction(libellé, fn(shot, take))` | Bouton sur chaque carte de plan |
| `ui.addToolbarButton("storyboard"\|"montage"\|"project", libellé, fn, principal)` | Bouton dans une barre |
| `ui.panel(id, titre, large)` | Panneau latéral `{ body, open(), close(), setTitle() }` |
| `ui.addRefSource(libellé, fn(shot))` | Bouton dans le bloc **Références** des cartes (c'est ce qu'utilise « 📖 Depuis la Bible ») |

### Couches de l'Assemblage
`AgnesApp.montageOverlays.push(prep)` : `prep({ proj, W, H, total, marks: [{ t, len, shot }] })` est appelé au lancement du rendu (positions réelles des plans) et renvoie `null` ou une fonction `draw(ctx, now)` appelée à chaque image, après l'étalonnage (c'est ce qu'utilise AutoCaption). Côté kit FFmpeg, une extension `captions` qui expose `kitAss(W, H, marks)` voit son fichier .ass incrusté en dernière étape.

### Événements — `core.on(nom, fn)`
`ready` · `render` · `view:change` (id de l'onglet) · `project:change` · `shot:done` · `shot:error` · `shot:change` · `job:update` · `montage:done` (`{ blob }`) · `panel:close`

### Classes CSS disponibles
Bouton de choix de fichier : `<label class="small-btn">Importer…<input type="file" hidden></label>`. Case ou bouton radio avec son texte : `<label class="inline"><input type="checkbox"> Texte</label>`. Deux cartes côte à côte : placez-les dans une grille à part (la règle `.card + .card` ajoute une marge au-dessus de la seconde ; voir `.cap-grid`).

`card`, `field`, `hint`, `row-inline`, `primary-btn`, `small-btn`, `ext-row`, `ext-cols`, `ext-tag` (`ok`/`err`), `ext-copy`, `ext-canvas`, `ext-thumb`.

## Conseils
- Rafraîchissez votre onglet sur `view:change` (quand il devient visible) et sur `project:change`.
- Ne bloquez jamais le chargement : toute erreur dans `init` désactive l'extension et l'affiche dans un message.
