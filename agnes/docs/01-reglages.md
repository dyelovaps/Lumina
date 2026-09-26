# 01 — Réglages (⚙)

Le bouton **⚙** en haut à droite ouvre le panneau des réglages. Tout ce que vous y mettez reste dans ce navigateur.

[← Retour au README](../README.md)

---

## Clé API Agnes
Obligatoire pour générer. Collez votre clé (`sk-…`). Le bouton 👁 l'affiche ou la masque.
La clé n'est envoyée qu'à l'URL de l'API configurée dans les options avancées.

## Clé imgbb (hébergement des images de référence)
**Indispensable pour les vidéos à partir d'images.** La documentation d'Agnes Video exige des URL publiques : une image intégrée à la requête laisse la vidéo bloquée « en file ». L'app refuse donc de lancer une vidéo avec image sans clé imgbb, et l'explique sur le plan. Agnes attend des **URL publiques** pour toutes les images de référence : Image → Image, Image → Vidéo, première/dernière frame, ingrédients.

- **Avec une clé imgbb**, l'app met vos images locales en ligne automatiquement, puis réutilise l'URL (pas de nouvel envoi pour la même image).
- **Sans clé**, l'image part intégrée à la requête (data URL) pour les générations d'**images** ; pour les **vidéos**, l'app s'arrête avec un message (seule exception : une image générée par Agnes, dont l'adresse publique est réutilisée).

Clé gratuite : créez un compte sur **api.imgbb.com**.

> Alternative : dans la **Bibliothèque**, vous pouvez coller vous-même l'URL publique d'une image dans le champ *URL publique*.

## Extensions du Studio
Une case par extension. Cochée, l'extension se charge tout de suite et à chaque ouverture de l'app. Décochée, rechargez la page pour la retirer complètement.

| Extension | Onglet ajouté | Notice |
|---|---|---|
| **Stills → Clip** *(active par défaut)* | Stills → Clip | [09](09-stills-clip.md) |
| **Extracteur** *(active par défaut)* | Extraire | [19](19-extracteur.md) |
| Import de scénario | Scénario | [10](10-scenario.md) |
| Bible de continuité | Bible | [11](11-bible.md) |
| Voix-off & dialogues | Voix | [12](12-voix.md) |
| Musique, ambiances & bruitages | Son | [13](13-son.md) |
| Enchaînement d'épisodes | Épisodes | [14](14-episodes.md) |
| Étalonnage & finition | Étalonnage | [15](15-etalonnage.md) |
| Kit de montage FFmpeg | bouton dans Assemblage | [16](16-kit-ffmpeg.md) |
| Publication | Publication | [17](17-publication.md) |
| Planning de publication | Planning | [18](18-planning.md) |
| **Atelier IA** *(active par défaut)* | Atelier IA | [21](21-atelier.md) |
| **AutoCaption** *(active par défaut)* | AutoCaption | [22](22-autocaption.md) |

## 🧪 Tester la génération vidéo
En bas du panneau ⚙. **Lancer le test** envoie à Agnes deux requêtes minimales, copiées des exemples officiels : **texte → vidéo**, puis **image → vidéo** (mode keyframe, avec une image de test mise sur imgbb). Chaque requête et chaque réponse s'affichent. **Copier le rapport** permet de le transmettre ; la clé API n'y figure jamais. Comptez 2 à 5 minutes (1 vidéo par minute en offre gratuite).

## Options avancées (URL et paramètres)
À ne toucher que si les générations échouent (erreur 400/404) ou si Agnes change son API. Les valeurs par défaut suivent la documentation d'**Agnes Video 2.5 Flash** et **Image 2.5 Flash** (septembre 2026).

> ⚠️ **Agnes Video v2.0 est retiré le 25/09/2026 à 23:59 (UTC+8).** À l'ouverture, l'app remplace automatiquement `agnes-video-v2.0` par `agnes-video-2.5-flash` et `agnes-image-2.1-flash` par `agnes-image-2.5-flash` (même API, meilleure qualité), puis l'annonce.

**Modèles proposés** (liste dans le champ)
| Modèle | Détail |
|---|---|
| `agnes-video-2.5-flash` | Par défaut. Gratuit pour une durée limitée. **720P uniquement**, 4 à 12 s, 5 références maximum |
| `agnes-video-2.5` | Payant (0,025 $/s en 720P à 0,055 $/s en 2K). 720P, 1080P, 2K, 8 références maximum |
| `agnes-image-2.5-flash` | Par défaut. Même requête et même prix que 2.1 |

**Comment l'app traduit les plans pour la série 2.5**
| Plan | Requête Agnes |
|---|---|
| Texte → Vidéo sans référence | `mode: text` |
| Texte → Vidéo avec références, Ingrédients → Vidéo | `mode: reference`, images nommées `<Picture 1> = Léa…` dans le prompt |
| Image → Vidéo *Standard* | `mode: keyframe`, première image |
| Image → Vidéo *Scène verrouillée* | `mode: keyframe`, même image au début et à la fin |
| Image → Vidéo *Scène + références* | `mode: reference`, `<Picture 1>` = scène de départ (le départ exact n'est plus garanti) |
| Première + dernière frame | `mode: keyframe`, début + fin |

Le **prompt négatif** n'existe pas dans la série 2.5 : il n'est plus envoyé en vidéo (les consignes du verrou d'identité restent dans le prompt). Les vidéos 2.5 peuvent contenir du **son d'ambiance** : gardez le skill « Sans texte ni musique », ou décochez *Garder le son des clips* dans l'Assemblage.

| Option | Rôle |
|---|---|
| URL de base de l'API | Adresse du service (ex. `https://apihub.agnes-ai.com/v1`) |
| Modèle image / Modèle vidéo | Nom du modèle envoyé à l'API (ex. `agnes-video-2.5-flash`) |
| Chemin de génération d'image | Ajouté à l'URL de base (ex. `/images/generations`) |
| Chemin de création vidéo | Ex. `/videos` |
| Chemin de suivi vidéo | Adresse interrogée pour savoir si la vidéo est prête. `{id}` = identifiant vidéo ; `{model}` = modèle (obligatoire en 2.5 pour les modes image) ; `~/` = racine du domaine (hors `/v1`) |
| Chemin de suivi de secours | Utilisé si le premier ne répond pas (`{id}` = identifiant de tâche) |
| Format des paramètres vidéo | **Automatique** (d'après le nom du modèle), **Agnes Video 2.5** (mode/seconds/size/aspect_ratio), **Agnes Video v2.0** (largeur/hauteur/images) ou **Générique** |
| Placer les images multiples dans `extra_body` | Format demandé par la doc Agnes pour plusieurs références |
| Ajouter `tags: ["img2img"]` | Nécessaire pour le modèle `agnes-image-2.0` en Image → Image |
| Envoyer le prompt négatif | À décocher si l'API le refuse |
| Nombre max d'ingrédients par requête | Au-delà, les ingrédients supplémentaires sont ignorés |

**Enregistrer** applique les réglages. **Réinitialiser** revient aux valeurs par défaut (vos clés sont conservées).

> En cas d'échec, la **réponse brute** de l'API s'affiche sous le plan concerné (Storyboard). C'est l'information à regarder, ou à transmettre, pour corriger une option.
