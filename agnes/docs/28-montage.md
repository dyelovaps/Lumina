# 28 — Montage (pôle de montage, montage par carte)

Extension **Montage** (`plugins/plugin-montage.js`, active d'office, 01/10/2026). Étapes 1 à 5 du cahier « montage par
carte » : montage par carte, sous-titres karaoké, modèles et favoris, appel de fin, puis (étape 5) compilation au choix
(clips d'origine, vidéos finales, ou épisode de série) et commandes pour Claude et le Chef de l'Atelier (§ 6 et § 7).

[← Retour au README](../README.md)

---

## 1. Le pôle Montage
L'onglet **Montage** regroupe le montage. Sous la barre d'onglets, une barre de **sous-onglets** mène à :
**Par carte** (ci-dessous) · **Assemblage** · **Voix** · **Son** · **AutoCaption** · **Étalonnage** · **Épisodes** · **Publication**.

- Chaque module reste une extension indépendante : désactivé dans ⚙, son sous-onglet n'apparaît pas.
- Case **« Ranger les onglets de montage dans Montage »** (section Par carte) : les onglets du haut de ces modules sont
  masqués, on y va par les sous-onglets. Décochée (réglage d'origine), rien ne change en haut.
- Montage désactivé dans ⚙ : Agnes redevient exactement comme avant (après rechargement de la page).
- Vérifié le 01/10 : Montage seul (sans AutoCaption, Extraire, Voix, Classement) fonctionne et explique ce qui manque ;
  tous les modules sans Montage fonctionnent comme avant.

## 2. Montage par carte
Chaque vidéo de carte devient une vidéo **prête à publier**, sans toucher à l'original.
**Ordre de travail validé (01/10)** : d'abord les coupes (pauses), ensuite le carton, puis les sous-titres.

| Quoi | Réglage d'origine |
|---|---|
| Image | **Format de sortie** : « Comme la vidéo » par défaut (9:16 → 1080×1920, 16:9 → 1920×1080, 1:1, 4:5, autre forme gardée avec un côté court de 1080 : **jamais de recadrage**), ou imposé (9:16, 16:9, 1:1, 4:5 : recadrage au centre si la vidéo a une autre forme, signalé dans le compte rendu). Les vidéos plus petites sont agrandies proprement (Lanczos). Carton et sous-titres se placent en proportion de l'image. Pas d'étalonnage. |
| Voix | « Au maximum » sans la casser : graves inutiles filtrés, légère présence, compression douce, puis **-14 LUFS**, crête **-1 dBTP** (marge de 0,5 dB pour l'encodage). Pas de musique ; l'ambiance du clip reste. |
| Vitesse | x1,00 à x1,25 : image et son ensemble, **hauteur de la voix gardée**. |
| Pauses resserrées | **Au choix, carte par carte** (case « Resserrer les pauses ») : coupes au milieu des silences entre les mots, aucun mot touché. La pause la plus longue est gardée à 0,4 s, les autres ramenées à 0,15 s (réglables : 0, 1 ou 2 pauses gardées). Le silence du début et celui de la fin (sous le carton) restent. La vidéo raccourcit d'autant ; le détail est dans le compte rendu. |
| Carton de fin | Sur les **1,8 dernières secondes** (1,5 à 2 s ; plus long avec une voix-off, voir § 5), texte + sous-texte facultatif, **sans nom ni logo** ; police, taille, couleurs, fond, opacité, position, assombrissement réglables ; apparition en **fondu** ou en **machine à écrire** (lettre par lettre, ligne fixe). |
| Sous-titres karaoké | **Au choix, carte par carte** (case « Sous-titres karaoké ») : Whisper (extension Extracteur, dans Agnes) écoute la vidéo **une fois** et donne l'heure de chaque mot (gardée sur la carte ; bouton « Réécouter avec Whisper »). Le pont y cale le **texte exact** de la réplique (entre « » dans le prompt) : les erreurs de Whisper (« 48 » pour « quarante-huit ») sont remplacées. **Le style est celui de l'onglet AutoCaption** (police, taille, hauteur, couleurs, mot prononcé, animation, majuscules) : un seul endroit pour le régler. Ils suivent les coupes et la vitesse et s'arrêtent à l'arrivée du carton (réglable). La taille dans la vidéo finale est ajustée pour être identique à l'aperçu. Un `.srt` est écrit à côté de la vidéo finale. |
| Appel de fin | **Au choix, carte par carte** : carton, carton + voix-off, ou pas de carton (voir § 5). |

**Texte du carton** : repris automatiquement des notes de la carte, ligne
`CARTON DE FIN (…) : « Abonne-toi pour la suite. » + « Suite à 12 h 30 »` (le 1er texte = carton, le 2e = sous-texte).
Il se modifie dans la liste « Cartes du projet », pour cette carte seulement (visible dans le lecteur à chaque lettre) ;
« Reprendre le texte des notes » annule la modification.

**Sortie** : dans le dossier de la journée, sous-dossier `Final` :
`Production\Marketing\Accroche\20260930 - Accroche_01\Final\Carte 01 - Anthony - final.mp4`, et à côté
`… - final - compte rendu.txt` (format, volume avant / après, crête, écrêtage, pauses coupées, fin de la voix, sous-titres,
voix-off, carton, avertissements) et `… - final.srt` (si karaoké). Un final existant n'est jamais écrasé sauf si
« Le remplacer » est coché (sinon `final (2)`). La voix-off de l'appel est rangée dans `<journée>\Audio\`.

### Conditions
- Le **pont local** doit tourner (`lancer_pont.bat`, dossier `prod-fruits`) : c'est lui qui monte, avec ffmpeg.
  Après une mise à jour de Montage, **relancer le pont** (sinon Agnes affiche « Le pont local tourne avec une version sans Montage »).
- La carte doit être **classée** en local (bouton **Classer**, thématique) ou venir de Google Flow (vidéo déjà rangée).
  Si la vidéo n'est pas encore dans Production, Agnes l'y copie d'abord (même dossier que Classer).

### Pas à pas
1. Onglet **Montage** → **Par carte**. Choisir au besoin un **modèle de montage** (§ 4) et l'appliquer.
2. Réglages : format, vitesse, voix, carton, pauses (ils sont retenus pour ce projet).
3. Sur chaque carte : texte du carton, **Appel de fin**, cases « Resserrer les pauses » et « Sous-titres karaoké ».
4. **Aperçu** (§ 3) : vérifier et ajuster en regardant (taille et hauteur des sous-titres, carton…).
5. **Monter cette carte**, ou cocher plusieurs cartes puis **Monter les cartes cochées** (l'une après l'autre).
6. **Voir le fichier** ouvre l'Explorateur sur la vidéo finale ; le compte rendu est à côté.

## 3. Lecteur (aperçu sans rendu)
Bouton **Aperçu** sur une carte : en haut de « Par carte », le même lecteur vidéo qu'Extraire, avec une couche transparente qui
dessine le carton et les sous-titres, saute les coupes, lit à la vitesse choisie, fait entendre la voix-off de l'appel et
prolonge la dernière image comme le fera le montage. **Tout réglage se voit tout de suite**, sans fabriquer de vidéo :
- instantané : style des sous-titres, carton (police, couleurs, fond, position, animation, texte à chaque lettre) ;
- environ une seconde (le pont recalcule) : vitesse, pauses, durée du carton, format, appel ;
- la première fois qu'on coche « Sous-titres karaoké » sur une carte, Whisper écoute la vidéo (quelques secondes ; le modèle
  se télécharge une seule fois).

L'écran prend la forme de la vidéo finale (vertical, paysage, carré). À côté du lecteur : **Taille** et **Hauteur** des
sous-titres (ce sont les réglages d'AutoCaption eux-mêmes) et un bouton vers tous les réglages du style dans AutoCaption.
« Monter cette carte » fabrique ensuite le fichier final, identique à l'aperçu. Le lecteur d'Extraire n'est pas touché.

## 4. Modèles et favoris
Trois sortes de modèles, **communs à tous les projets** (gardés dans Agnes et emportés par la Sauvegarde complète) :

| Modèle | Où | Contient |
|---|---|---|
| **Sous-titres** | onglet **AutoCaption** (à côté des 7 préréglages d'origine) | tout le style : police, taille, hauteur, couleurs, mot prononcé, contour, fond, animation, majuscules |
| **Carton** | Montage → Par carte, section « Carton de fin » | police, taille, couleurs, fond, opacité, position, assombrissement, fondu ou machine à écrire, durée |
| **Montage** | Montage → Par carte, en haut des réglages | tous les réglages du montage (format, vitesse, voix, pauses, carton, appel…) **et** le style des sous-titres |

Boutons : **Appliquer** (au projet ouvert), **Enregistrer comme modèle…**, **Mettre à jour « … »** (quand les réglages ont été
retouchés depuis le modèle : la ligne indique « (modifié) »), **Favori oui / non** (les favoris passent en tête de liste),
**Renommer…**, **Supprimer…** (les réglages des projets ne changent pas). Les préréglages d'origine d'AutoCaption ne se
renomment ni ne se suppriment.

**Chaque projet retient ses réglages et son modèle** : le projet Marketing reste en vertical TikTok, une série peut rester en
16:9, sans tout re-régler. Un nouveau projet part des derniers réglages utilisés. Au premier lancement, un modèle « Marketing »
est créé avec les réglages du moment (aucun autre modèle n'est fourni : chacun prépare les siens).

## 5. Appel de fin — au choix
**Par carte**, liste « Appel de fin » (rien n'est imposé) :
- **Carton** (réglage d'origine) : le texte du carton s'affiche, sans voix ;
- **Carton + voix-off qui le lit** : une voix lit le texte du carton (puis le sous-texte) ;
- **Pas de carton**.

La voix-off se fait d'un clic sur la carte, **jamais automatiquement** (aucun crédit dépensé sans vous) :
- **« Faire la voix-off (onglet Voix) »** : ElevenLabs (ou le fournisseur réglé dans l'onglet Voix), avec la voix du casting
  choisie dans « Appel de fin en voix-off » ;
- **« Ma voix (micro) »** : vous la lisez vous-même (présente, jamais par défaut) ;
- **« Importer un son… »** : un fichier déjà prêt.

Elle est gardée sur la carte (bouton **Écouter**). Si le texte du carton change ensuite, la ligne indique « à refaire » et le
montage le demande. Au montage, elle est rangée dans `<journée>\Audio\Carte NN - <perso> - appel.mp3`, puis :
- elle commence au début du carton, **jamais avant la fin de la voix du personnage** ;
- s'il manque de la place, **la dernière image est prolongée** (figée, 4 s au plus) le temps qu'elle finisse ;
- le son du clip baisse pendant qu'elle parle (« Son du clip pendant la voix-off »), volume de la voix-off réglable ;
- le tout est ramené à -14 LUFS ; le compte rendu indique son début, sa durée et la prolongation.

**Marketing — l'appel dit par Anthony** : c'est un choix de la journée, chez l'agent Marketing (`generate-day --appel carton|parle`,
paramètre `appel` de `/marketing/journee`). Le Chef de l'Atelier le demande avec la méthode du jour : « sur le carton »
(Anthony ne le dit pas, réglage habituel `settings.yaml → cta.mode`) ou « Anthony le dit » (en dernier, dans la vidéo Flow,
tiré des listes d'appels sans répétition dans la journée). Dans ce cas, choisissez « Pas de carton » (ou un carton qui
reprend l'appel) dans Montage. Listes d'appels de l'agent (décidé le 01/10) : en plus des appels « Abonne-toi… », « Suis la
page… », il y a **« Like et partage. »** et **« Retrouve la vidéo complète sur mon profil. »** (tutoiement gardé ; « mon profil »
est la seule première personne permise, et seulement dans l'appel).

## 6. Compilation (étape 5) — au choix
Onglet **Montage → Assemblage**, en haut : **« Compiler à partir de »** :
- **Clips d'origine** (réglage d'origine) : l'Assemblage habituel, exactement comme avant (rendu dans le navigateur, kit
  FFmpeg, voix, son, étalonnage, sous-titres d'AutoCaption) — voir [07](07-assemblage.md) ;
- **Vidéos finales du Montage** : l'Assemblage habituel est masqué (rien n'est perdu ; revenir à « Clips d'origine » le
  ré-affiche) et un encart liste les cartes. Seules les cartes **déjà montées** (Par carte) se cochent. Le pont met leurs
  vidéos finales bout à bout, dans l'ordre du storyboard, **avec** leur voix, leur carton et leurs sous-titres.

| Réglage | Détail |
|---|---|
| Transition | Coupe franche (défaut), fondu enchaîné ou fondu au noir ; durée 0,3 à 1 s (la vidéo raccourcit d'autant à chaque raccord) |
| Image | Taille et cadence de la première vidéo ; une vidéo d'une autre forme est ajustée sans recadrage (bandes noires, signalé) |
| Son | Le niveau des finals est gardé (-14 LUFS) ; la mesure de la compilation est écrite dans le compte rendu |
| Sous-titres | Les `.srt` des finals sont recalés et réunis en un seul `.srt` (une carte sans `.srt` est signalée) |
| Nom | « Compilation - Cartes 01 à 03 » par défaut, ou le vôtre ; jamais écrasée sauf « Remplacer » (sinon « (2) ») |

Sortie : dans le dossier `Final` de la première carte, avec `… - compte rendu.txt` (ordre, début de chaque vidéo, son,
alertes). **Voir le fichier** ouvre l'Explorateur. Le bouton **« Compiler les cartes montées (Assemblage) »** de Par carte
ouvre directement ce choix. Chaque projet garde son choix et ses réglages de compilation. Jusqu'à 300 vidéos.

> « Vidéos finales » est fait pour les **posts courts** (marketing) : chaque carte y a déjà son volume réglé à -14 LUFS et
> son carton. Pour une **série**, prenez « Épisode de série » ci-dessous.

### Épisode de série (troisième choix)
**« Épisode de série (plans de l'Assemblage, son réglé sur tout l'épisode) »** : l'Assemblage reste affiché, c'est lui qui
règle les plans ; le pont local en fait le rendu avec ffmpeg, en qualité maximale.

| Repris de l'Assemblage | Détail |
|---|---|
| Plans | Les plans **cochés**, dans l'ordre du storyboard, avec leur prise choisie (vidéo ou image fixe) |
| Début / Fin | La découpe de chaque vidéo |
| Images fixes | Leur durée (cartons d'ouverture et de fin, récap « Précédemment dans… » de l'extension **Épisodes** compris : ce sont des plans de l'Assemblage) |
| Transitions | Celle de **chaque plan** (cut, fondu enchaîné, fondu au noir) et sa durée ; comme l'Assemblage, une transition dure au plus la moitié des deux plans |
| Format | Format, résolution, images/s et cadrage (remplir ou adapter) des réglages de l'Assemblage |
| Étalonnage | Celui de l'onglet Étalonnage (sauf la LUT), plans exclus compris |

| Réglage propre à l'épisode | Détail |
|---|---|
| **Volume de l'épisode** | Réglé **une seule fois sur tout l'épisode** (les nuances restent : un chuchotement reste plus bas qu'un cri) : -14 LUFS (réseaux, défaut), -16 LUFS (plateformes), -23 LUFS (télévision, EBU R128) ; crête -1,5 dBTP |
| Sous-titres karaoké | Au choix : Whisper écoute chaque plan une fois (gardé sur la carte), le texte exact des répliques (« … » du prompt) est calé, ramené au temps de l'épisode ; style AutoCaption ; `.srt` à côté |
| Carton de fin | Au choix : texte + sous-texte, style du carton de Par carte ; les sous-titres s'arrêtent à son arrivée (réglage de Par carte) |
| Nom | Le vôtre, sinon le nom du projet ; jamais écrasé sauf « Remplacer » |

Ce qui **n'est pas repris** (un avertissement s'affiche) : les voix attachées aux plans (onglet Voix), la musique de l'onglet
Son et les sous-titres incrustés d'AutoCaption → pour eux, utilisez « Clips d'origine » (Assemblage ou kit FFmpeg).
Les plans doivent être **classés** (bouton Classer) ; une vidéo absente de Production y est copiée, les images fixes y sont
déposées dans `<épisode>\Images\`. Sortie : `<épisode>\Final\<nom>.mp4` + compte rendu (plans, débuts, son avant / après).

## 7. Pour un agent ou pour Claude (même moteur, même résultat)
**Par Agnes (Piloté par Claude)** — Agnes ouverte, « Claude : actif » ; mêmes fonctions que les boutons, mêmes réglages :
```bash
cd "D:\Rmaopn\a classser\Dernier_projet\TitTok_Histoires_vraie\_BlackLow\Production\App\prod-fruits"
python agnes.py etat_montage
python agnes.py modeles_montage
python agnes.py monter cartes=1,2,3 resserrer=oui karaoke=oui
python agnes.py compiler cartes=tous transition=fondu
```
`monter` : `cartes=1,2` ou `cartes=tous` (cartes classées), `modele="Marketing"` (appliqué au projet d'abord), `resserrer`,
`karaoke`, `appel=carton|voixoff|aucun` (gardés sur les cartes comme un clic), `--json '{"reglages":{"vitesse":1.1}}'`.
**Aucune voix-off n'est générée** par une commande : une carte « Carton + voix-off » sans voix-off est refusée (faites-la d'un
clic dans Par carte). Le karaoké passe par Whisper dans Agnes, comme au clic.
`compiler` : `cartes=…|tous` (toutes les cartes montées), `transition=cut|fondu|noir`, `duree_transition=0.5`, `nom="…"`,
`remplacer=oui`.
`episode` (série, plans cochés de l'Assemblage) : `lufs=-14|-16|-23`, `karaoke=oui`, `carton="À suivre…"`,
`sous_texte="Épisode 2"`, `nom="Ep01"`, `remplacer=oui` :
```bash
python agnes.py episode lufs=-16 karaoke=oui carton="À suivre…"
```

**Chef de l'Atelier** (sans abonnement Claude) : outils `montage_etat` et `montage_modeles` (lecture), `monter_cartes`,
`compiler_finales` et `rendre_episode` (**avec votre autorisation**, à votre demande seulement). Montage désactivé : il vous le dit, rien ne casse.

**Sans Agnes** (ligne de commande du pont) :
```bash
cd "D:\Rmaopn\a classser\Dernier_projet\TitTok_Histoires_vraie\_BlackLow\Production\App\prod-fruits"
python montage_carte.py "Marketing/Accroche/20260930 - Accroche_01/Video/Carte 01 - Anthony.mp4" --vitesse 1.1
python montage_carte.py compiler "Marketing/Accroche/20260930 - Accroche_01/Final/Carte 01 - Anthony - final.mp4" "Marketing/Accroche/20260930 - Accroche_01/Final/Carte 02 - Anthony - final.mp4" --transition fondu
python montage_carte.py episode "Serie/MaSerie/Ep01/Video/Plan 01.mp4" "Serie/MaSerie/Ep01/Video/Plan 02.mp4" --format 16:9 --lufs -16 --transition fondu
```
Options de `episode` : `--transition cut|fondu|noir` (entre tous les plans), `--duree-transition 0.6`, `--format`,
`--cadrage remplir|adapter`, `--fps 30`, `--lufs -14`, `--duree-image 3` (plans image), `--carton "…"`, `--sous-texte "…"`,
`--nom`, `--remplacer`, `--json`.

### Détail du moteur
Options du montage d'une carte : `--carton "…"` `--sous-texte "…"` (sinon lus dans la fiche de la carte, `Fiches\Carte 01 - Anthony.md`),
`--sans-carton`, `--duree-carton 1.8`, `--police Montserrat-ExtraBold.ttf`, `--taille 76`, `--couleur "#FFFFFF"`,
`--fond "#000000"`, `--fond-opacite 0.45`, `--assombrir 0.2`, `--position centre|bas`, `--animation fondu|machine`,
`--format auto|9:16|16:9|1:1|4:5`, `--resserrer` (+ `--pauses-longues 1`, `--pause-longue 0.4`, `--pause-courte 0.15`),
`--mots mots.json` (mots minutés de Whisper `[{text, start, end}]` : active le karaoké) `--replique "…"` (sinon lue dans la fiche),
`--appel-audio "<son sous Production>"` (voix-off de l'appel), `--sans-voix`, `--remplacer`, `--json`.
En ligne de commande sans Agnes, les sous-titres ont un style par défaut (Montserrat, mot prononcé jaune).
Options de la compilation (`compiler <vidéos finales…>`) : `--transition cut|fondu|noir`, `--duree-transition 0.5`, `--nom "…"`,
`--remplacer`, `--json`.

Routes du pont (`montage_carte.py`) : `GET /montage/polices`, `POST /montage/apercu {video, reglages}` (coupes, durée finale,
début du carton, mots calés, prolongation — rien n'est écrit), `POST /montage/carte {video, reglages}`,
`POST /montage/compilation {videos, reglages}` (finals sous Production, chemins relatifs ou absolus),
`POST /montage/episode/plan {plans, reglages}` (durées, débuts, mots calés, sans rendu ; 404 + `manquants` si un plan
n'est pas dans Production), `POST /montage/episode {plans, reglages}`, `GET /montage/etat?id=…`
(montages, compilations et épisodes passent par la même file : un rendu à la fois).
La vidéo et la voix-off sont des chemins relatifs au dossier Production ; le moteur n'écrit que dans `Final`.

Fonctions offertes aux autres extensions :
- Montage : `AgnesPlugins.get("montage").monterCarte(1, { vitesse: 1.1 })` ; étape 5 : `etatCartes()`, `listeModeles()`,
  `monterCartes("1,2"|[1,2]|"tous", { modele, reglages, resserrer, karaoke, appel })`, `compilerFinales(cartes, { transition,
  duree_transition, nom, remplacer })`, `compilerEpisode({ ep_lufs, ep_karaoke, ep_carton, ep_carton_texte, ep_carton_sous, nom,
  remplacer })` (utilisées par Piloté par Claude et par le Chef de l'Atelier) ;
- AutoCaption : `chunksFromWords`, `assFromChunks`, `srtFromChunks`, `temoin` (style et dessin des sous-titres), `modeles`,
  `appliquerModele`, `nouveauModele` (voir [22](22-autocaption.md)) ;
- Extraire : `motsBlob(blob, onEtat)` → `[{ text, start, end }]` (Whisper local ; si le modèle réglé ne sait pas minuter les mots,
  un modèle « _timestamped » est essayé) ;
- Voix : `speak(texte, rôle)`, `cast()`, `micro()` → `{ arreter() → Blob }`.

Données : réglages du projet dans `projet.montageCarte` (et `compilation`, `derniereCompilation`) ; modèles dans `core.store` (« montage:modeles », « captions:modeles ») ;
voix-off des cartes dans `core.store` (« montage:appel:<carte> ») ; tout est dans la Sauvegarde complète.
Le CSS est dans `css/studio.css` (sections « Montage » et « AutoCaption — vos modèles et favoris »).

## 8. Tests
- `prod-fruits\test_montage_carte.py` (vidéos synthétiques : format, coupes, carton, karaoké, taille des sous-titres, voix-off,
  compilation : coupe, fondu, .srt recalés, refus hors Production ; épisode : coupes début/fin, image fixe, transition par
  plan, son réglé une fois, karaoké au temps de l'épisode, carton, étalonnage refusé s'il est douteux) :
  `python -m unittest test_montage_carte -v`
- Lumina : `tests/agnes-montage.test.cjs` et `tests/agnes-montage-commandes.test.cjs` (compilation, commandes de Claude, outils
  du Chef ; dans `npm test`).
- Agent Marketing : `tests/test_appel.py`, `tests/test_validator.py` (appel « mon profil ») (`python -m pytest -q`).
