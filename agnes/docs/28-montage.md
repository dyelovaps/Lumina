# 28 — Montage (pôle de montage, montage par carte)

Extension **Montage** (`plugins/plugin-montage.js`, active d'office, 01/10/2026). Étape 1 du cahier « montage par carte ».

[← Retour au README](../README.md)

---

## 1. Le pôle Montage
L'onglet **Montage** regroupe le montage. Sous la barre d'onglets, une barre de **sous-onglets** mène à :
**Par carte** (ci-dessous) · **Assemblage** · **Voix** · **Son** · **AutoCaption** · **Étalonnage** · **Épisodes** · **Publication**.

- Chaque module reste une extension indépendante : désactivé dans ⚙, son sous-onglet n'apparaît pas.
- Case **« Ranger les onglets de montage dans Montage »** (section Par carte) : les onglets du haut de ces modules sont
  masqués, on y va par les sous-onglets. Décochée (réglage d'origine), rien ne change en haut.
- Montage désactivé dans ⚙ : Agnes redevient exactement comme avant.
- Les prochaines étapes (sous-titres karaoké, modèles et favoris, appel de fin, compilation) s'ajoutent comme sections de Montage.

## 2. Montage par carte
Chaque vidéo de carte devient une vidéo **prête à publier**, sans toucher à l'original :

| Quoi | Réglage d'origine |
|---|---|
| Image | **Format de sortie** : « Comme la vidéo » par défaut (9:16 → 1080×1920, 16:9 → 1920×1080, 1:1, 4:5, autre forme gardée avec un côté court de 1080 : **jamais de recadrage**), ou imposé (9:16, 16:9, 1:1, 4:5 : recadrage au centre si la vidéo a une autre forme, signalé dans le compte rendu). Les vidéos plus petites sont agrandies proprement (Lanczos). Carton et sous-titres se placent en proportion de l'image. Pas d'étalonnage. |
| Voix | « Au maximum » sans la casser : graves inutiles filtrés, légère présence, compression douce, puis **-14 LUFS**, crête **-1 dBTP** (marge de 0,5 dB pour l'encodage). Pas de musique ; l'ambiance du clip reste. |
| Vitesse | x1,00 à x1,25 : image et son ensemble, **hauteur de la voix gardée**. |
| Carton de fin | Sur les **1,8 dernières secondes** (1,5 à 2 s), texte + sous-texte facultatif, **sans nom ni logo** ; police, taille, couleurs, fond, position réglables ; apparition en **fondu** ou en **machine à écrire** (lettre par lettre, ligne fixe). |
| Pauses resserrées | **Au choix, carte par carte** (case « Resserrer les pauses ») : coupes au milieu des silences entre les mots, aucun mot touché. La pause la plus longue est gardée à 0,4 s, les autres ramenées à 0,15 s (réglables : 0, 1 ou 2 pauses gardées). Le silence du début et celui de la fin (sous le carton) restent. La vidéo raccourcit d'autant ; le détail est dans le compte rendu. |
| Sous-titres karaoké | **Au choix, carte par carte** (case « Sous-titres karaoké ») : Whisper (extension Extracteur, dans Agnes) écoute la vidéo **une fois** et donne l'heure de chaque mot (gardée sur la carte ; bouton « Réécouter avec Whisper »). Le pont y cale le **texte exact** de la réplique (entre « » dans le prompt) : les erreurs de Whisper (« 48 » pour « quarante-huit ») sont remplacées. **Le style est celui de l'onglet AutoCaption** (police, taille, hauteur, couleurs, mot prononcé, animation, majuscules) : un seul endroit pour le régler. Ils suivent les coupes et la vitesse et s'arrêtent à l'arrivée du carton (réglable). La taille dans la vidéo finale est ajustée pour être identique à l'aperçu. Un `.srt` est écrit à côté de la vidéo finale. |

**Texte du carton** : repris automatiquement des notes de la carte, ligne
`CARTON DE FIN (…) : « Abonne-toi pour la suite. » + « Suite à 12 h 30 »` (le 1er texte = carton, le 2e = sous-texte).
Il se modifie dans la liste « Cartes du projet », pour cette carte seulement ; « Reprendre le texte des notes » annule la modification.

**Sortie** : dans le dossier de la journée, sous-dossier `Final` :
`Production\Marketing\Accroche\20260930 - Accroche_01\Final\Carte 01 - Anthony - final.mp4`
et à côté `Carte 01 - Anthony - final - compte rendu.txt` (volume avant / après, crête, écrêtage, fin de la voix,
carton, avertissements). Un final existant n'est jamais écrasé sauf si « Le remplacer » est coché (sinon `final (2)`).

### Conditions
- Le **pont local** doit tourner (`lancer_pont.bat`, dossier `prod-fruits`) : c'est lui qui monte, avec ffmpeg.
- La carte doit être **classée** en local (bouton **Classer**, thématique) ou venir de Google Flow (vidéo déjà rangée).
  Si la vidéo n'est pas encore dans Production, Agnes l'y copie d'abord (même dossier que Classer).

### Pas à pas
1. Onglet **Montage** → **Par carte**.
2. Réglages : vitesse, voix, carton (une fois pour toutes, ils sont retenus).
3. Vérifier le texte du carton de chaque carte.
4. **Monter cette carte**, ou cocher plusieurs cartes puis **Monter les cartes cochées** (l'une après l'autre).
5. **Voir le fichier** ouvre l'Explorateur sur la vidéo finale.

## Lecteur (aperçu sans rendu)
Bouton **Aperçu** sur une carte : en haut de « Par carte », le même lecteur vidéo qu'Extraire, avec une couche transparente qui dessine
le carton et les sous-titres, saute les coupes et lit à la vitesse choisie. **Tout réglage se voit tout de suite**, sans fabriquer de vidéo (le texte du carton à chaque lettre ; vitesse, pauses, durée du carton
et format en une seconde environ, le temps que le pont recalcule) ; l'écran prend la forme de la vidéo finale (vertical, paysage, carré) :
- à côté du lecteur : **Taille** et **Hauteur** des sous-titres (ce sont les réglages d'AutoCaption eux-mêmes), bouton vers tous les
  réglages du style dans AutoCaption ;
- en dessous : carton (texte sur la carte, durée, police, couleurs, machine à écrire…), vitesse, pauses.
« Monter cette carte » fabrique ensuite le fichier final, identique à l'aperçu. Le lecteur d'Extraire n'est pas touché.

## 3. Pour un agent ou pour Claude (même moteur, même résultat)
Depuis le dossier `prod-fruits` :
```bash
cd "D:\Rmaopn\a classser\Dernier_projet\TitTok_Histoires_vraie\_BlackLow\Production\App\prod-fruits"
python montage_carte.py "Marketing/Accroche/20260930 - Accroche_01/Video/Carte 01 - Anthony.mp4" --vitesse 1.1
```
Options : `--carton "…"` `--sous-texte "…"` (sinon lus dans la fiche de la carte, `Fiches\Carte 01 - Anthony.md`),
`--sans-carton`, `--duree-carton 1.8`, `--police Montserrat-ExtraBold.ttf`, `--taille 76`, `--couleur "#FFFFFF"`,
`--fond "#000000"`, `--fond-opacite 0.45`, `--assombrir 0.2`, `--position centre|bas`, `--animation fondu|machine`, `--format auto|9:16|16:9|1:1|4:5`,
`--resserrer` (+ `--pauses-longues 1`, `--pause-longue 0.4`, `--pause-courte 0.15`),
`--mots mots.json` (mots minutés de Whisper `[{text, start, end}]` : active le karaoké) `--replique "…"` (sinon lue dans la fiche),
`--sans-voix`, `--remplacer`, `--json`.

Routes du pont : `GET /montage/polices`, `POST /montage/carte {video, reglages}`, `GET /montage/etat?id=…`
(la vidéo est un chemin relatif au dossier Production ; rien n'est écrit ailleurs que dans `Final`).
Depuis une autre extension : `AgnesPlugins.get("montage").monterCarte(1, { vitesse: 1.1 })`.
Aperçu (sans rendu) : `POST /montage/apercu {video, reglages}` → coupes, durée finale, début du carton, mots calés.
Sous-titres : le .ass vient d'AutoCaption (`assFromChunks`, `chunksFromWords`, `srtFromChunks`, `temoin`) ; en ligne de commande
sans Agnes, le moteur garde un style par défaut (Montserrat, mot prononcé jaune).
Mots minutés (Extraire) : `AgnesPlugins.get("extracteur").motsBlob(blob, onEtat)` → `[{ text, start, end }]` (Whisper local ;
si le modèle réglé ne sait pas minuter les mots, un modèle « _timestamped » est essayé).

**Ordre de travail validé (01/10)** : d'abord les coupes (pauses), ensuite le carton, puis les sous-titres.

## 4. Tests
- `prod-fruits\test_montage_carte.py` (vidéo synthétique) : `python -m unittest test_montage_carte -v`
- Lumina : `tests/agnes-montage.test.cjs` (dans `npm test`).
