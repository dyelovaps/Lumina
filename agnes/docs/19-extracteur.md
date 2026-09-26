# 19 — Extraire (veille, lien, script, images)

*Extension « Extracteur » — active par défaut (désactivable dans ⚙).*

Quatre outils pour partir de vidéos existantes :
- **🔎 veille** : trouver les meilleures vidéos TikTok de votre catégorie ;
- **télécharger** une vidéo à partir de son lien (TikTok, YouTube, Instagram…) ;
- **récupérer son script** (transcription de la parole), puis le **convertir en prompts** ;
- **extraire ses images**, par exemple une par plan.

**Tout est enregistré dans le projet** : les liens, les résultats de la veille, les vidéos TikTok récupérées et chaque vidéo analysée (fichier, script corrigé, images, prompts). Vous retrouvez tout en rouvrant l'app. Chaque projet a son propre onglet Extraire.

[← Retour au README](../README.md)

> ⚖️ Pour vos propres vidéos, ou pour analyser une référence. Republier le contenu d'un autre créateur demande son accord.

---

## 0. 🔎 Veille : les meilleures vidéos de votre catégorie
1. **Catégorie ou série** : décrivez votre créneau (« mini-séries dramatiques avec des fruits IA », « avatars IA qui vendent un produit »).
2. **✨ Proposer des mots-clés (IA)** : l'IA de l'Atelier (Agnes par défaut) propose 8 recherches TikTok. Modifiez-les librement, une par ligne. Vous pouvez aussi les écrire vous-même.
3. Réglez la **période** (7 jours à 6 mois, ou toutes), le **classement** (vues, likes, partages ou engagement), le **nombre** de vidéos gardées et, si besoin, une **durée maximale**.
4. **Chercher** : chaque mot-clé est cherché sur TikTok via **TikWM** (environ une recherche par seconde). Les résultats sont fusionnés, sans doublon, avec pour chaque vidéo : vues, likes, commentaires, partages, taux d'engagement, date, durée et le mot-clé qui l'a trouvée. Les 5 meilleures sont cochées.
5. **Ajouter les liens cochés → 1. Télécharger** les place dans le champ des liens ; **Ajouter et récupérer ici** lance aussi la récupération TikTok.
6. **✨ Ce qui marche (analyse IA)** : l'IA résume ce que ces vidéos ont en commun (accroches, formats, durées, thèmes) et propose 3 idées de vidéos.

> L'**engagement** = (likes + commentaires + partages) ÷ vues. Il fait remonter les vidéos qui accrochent vraiment, pas seulement celles qui ont été beaucoup poussées.

Changer la période, le classement, le nombre ou la durée **reclasse sans refaire la recherche**. Le relais allOrigins (étape 1) s'applique aussi à la veille si TikWM est bloqué chez vous.

## 1. Télécharger depuis un lien

### TikTok : directement dans l'app
Collez un ou plusieurs liens TikTok (`tiktok.com/@…/video/…` ou liens courts `vm.tiktok.com/…`), puis **Récupérer les vidéos TikTok ici**. L'app interroge **TikWM**, un service gratuit non officiel qui renvoie les fichiers sans filigrane. Pour chaque vidéo : titre, compte, durée, vues, et les boutons :

| Bouton | Effet |
|---|---|
| **Analyser ici** | Charge la vidéo à l'étape 2, prête pour le script et les images |
| **⬇ Télécharger (HD)** / **Qualité standard** / **Avec filigrane** | Enregistre le .mp4 sur votre ordinateur |
| **Couverture → Bibliothèque** | Ajoute l'image de couverture comme source |

- TikWM accepte environ **1 lien par seconde** : l'app espace les demandes toute seule. Le service peut être lent ou indisponible ; il essaie deux méthodes avant d'abandonner.
- Si TikWM est bloqué chez vous, cochez **« réessayer via le relais public allOrigins »**. Votre lien passe alors par ce relais.
- Si le **fichier** lui-même refuse de se télécharger, il s'ouvre dans un onglet : clic droit → « Enregistrer la vidéo sous… », puis glissez-le à l'étape 2.
- **Instagram, YouTube, X…** ne passent pas par TikWM : utilisez le kit ci-dessous.

### Tous les sites : le kit yt-dlp
**Pourquoi un kit ?** Les sites (TikTok, Instagram, YouTube…) empêchent une page web de récupérer leurs vidéos. Les sites de téléchargement en ligne passent par leur propre serveur. L'app, elle, prépare un petit kit qui fait le travail **sur votre PC**, avec **yt-dlp**, l'outil gratuit de référence (TikTok, YouTube, Instagram, X, Facebook, Vimeo et des centaines d'autres).

1. Collez vos liens, **un par ligne**.
2. Choisissez la qualité (1080p max conseillé). Options : **sous-titres du site** (.srt, quand le site en fournit) et **audio seul** (.mp3).
3. **Télécharger le kit (.zip)** → dézippez → double-clic sur **`telecharger.bat`** (Windows) ou `bash telecharger.sh` (Mac/Linux).
4. Les vidéos arrivent dans **`telechargements/`**, numérotées dans l'ordre des liens.

**Première fois : installer yt-dlp** (et FFmpeg, déjà utile pour le kit de montage)
| Système | Commandes |
|---|---|
| Windows | `winget install yt-dlp.yt-dlp` puis `winget install Gyan.FFmpeg` |
| Mac | `brew install ffmpeg` puis `pipx install "yt-dlp[default,curl-cffi]"` |

Le script met yt-dlp à jour à chaque lancement : c'est ce qui le fait marcher quand un site change. Pour ajouter des liens plus tard, éditez `liens.txt` et relancez.

**Essayer en direct** : fonctionne pour un lien qui mène **directement à un fichier** `.mp4`, si son serveur l'autorise. Pas pour une page TikTok.

## 2. La vidéo à analyser
Glissez une **vidéo** (ou un fichier **audio**) dans la zone, ou choisissez un **rendu vidéo de ce projet**. Elle s'affiche dans un lecteur.

Chaque vidéo analysée est **enregistrée** avec son script et ses images. Le menu **Vidéos analysées de ce projet** permet de rouvrir une vidéo précédente (les 30 dernières sont gardées). **Retirer de la liste** supprime la vidéo, son script et ses images de l'app.

## 3. Récupérer le script
| Moteur | Coût | Détail |
|---|---|---|
| **Whisper dans le navigateur** | Gratuit | Rien n'est envoyé nulle part. Le modèle se télécharge **une seule fois** : *Rapide* ≈ 80 Mo, *Précis* ≈ 250 Mo (conseillé en français). Comptez à peu près la durée de la vidéo avec le modèle précis (plus rapide si votre navigateur utilise la carte graphique) |
| **API OpenAI** | Payant (quelques centimes par minute) | Clé OpenAI, ici ou reprise de l'onglet Voix. `whisper-1` donne les **timecodes** ; `gpt-4o-transcribe` est plus précis mais donne le texte seul. Les longues vidéos sont envoyées par morceaux de 10 min |
| **Fichier de sous-titres** | Gratuit | Importez le `.srt` ou `.vtt` téléchargé par le kit (option « sous-titres du site »). Les doublons des sous-titres automatiques sont fusionnés |

Choisissez la **langue parlée** (ou *Détection auto*), puis **Transcrire**.

**Résultat** (modifiable)
- **Texte** : paragraphes coupés aux pauses ;
- **Avec timecodes** : `[0:12] …` ;
- **Sous-titres .srt**.

Vos **corrections** du texte sont enregistrées.

| Bouton | Effet |
|---|---|
| **Copier**, **Télécharger** | Le texte affiché |
| **→ Scénario** | Colle le texte (vos corrections comprises) dans l'onglet Scénario ([10](10-scenario.md)) : ajoutez les noms des personnages (`LÉA : …`), puis *Analyser* |
| **→ Atelier IA (document)** | Ajoute le script aux **documents** de l'Atelier ([21](21-atelier.md)) : tous les agents le lisent. Ex. « @8 adapte ce script en prompts image » |
| **✨ Convertir en prompts (IA)** | Réécrit la vidéo **plan par plan** en prompts IMAGE / VIDÉO / RÉF, prêts pour **Le lot** (voir ci-dessous) |

### Convertir en prompts
1. *(Conseillé)* Extrayez d'abord **une image par plan** (étape 4) : les plans suivent ces images. Sans images, il y a un plan par passage du script.
2. Écrivez la **consigne d'adaptation** : « Recrée cette vidéo dans l'univers de ma série, avec mes personnages », « Garde le rythme, remplace le produit par le mien »…
3. Options : **Joindre les images extraites** (le modèle voit chaque plan : cadrage, lumière, décor) et **Utiliser la Bible et la Bibliothèque** (vos personnages, leur ADN, les noms à mettre dans `RÉF :`).
4. **Convertir** : l'IA de l'Atelier écrit un bloc par plan (`01 — libellé`, `IMAGE :`, `VIDÉO :` avec une durée conseillée, `RÉF :`). Si le modèle ne lit pas les images, l'app refait la demande sans elles.
5. Relisez et corrigez, puis **→ Le lot** : une carte **Texte → Image → Vidéo** par plan, avec ses propres références ([03](03-le-lot.md)).

La consigne et le résultat sont enregistrés avec la vidéo.

## 4. Extraire des images
| Méthode | Usage |
|---|---|
| **Une image par plan** | Détecte les **coupes** et garde une image par plan : milieu (conseillé), début ou fin. Réglez la **sensibilité** : vers la gauche, plus de coupes détectées |
| **Toutes les N secondes** | Échantillonnage régulier |
| **N images réparties** | N images espacées sur toute la vidéo |
| **Première + dernière image** | Pour enchaîner deux plans |
| **📸 Capturer l'image affichée** | Mettez le lecteur en pause au bon moment, puis capturez |

Les images sont à la **pleine résolution** de la vidéo, en **JPG** (léger) ou **PNG** (sans perte). Limite de 300 images par extraction ; **Arrêter** interrompt à tout moment.

**Ensuite**
- cochez ou décochez les images ; le timecode sous chaque image replace le lecteur à ce moment ;
- **Télécharger (.zip)** : `01.jpg`, `02.jpg`… et `timecodes.txt` ;
- **→ Bibliothèque** : comme source, personnage, décor… (menu à côté du bouton) ;
- **→ Stills → Clip** : les images partent dans l'onglet Stills → Clip, **déjà numérotées** dans l'ordre. Il ne reste qu'à écrire les prompts d'animation ([09](09-stills-clip.md)).

## Idée de méthode : refaire une vidéo de référence dans votre univers
1. **Veille** → les meilleures vidéos de votre créneau → **Ajouter et récupérer ici**.
2. **Analyser ici** la vidéo choisie.
3. **Script** (Whisper), puis **images**, une par plan : vous avez le découpage exact (cadrages, rythme).
4. **✨ Convertir en prompts** avec votre consigne et votre Bible → **Le lot** → **Créer les plans**.
5. **→ Scénario** pour les dialogues, puis **Voix** avec votre casting, et **AutoCaption** pour les sous-titres.
