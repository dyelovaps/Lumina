# 22 — AutoCaption (sous-titres animés)

*Extension « AutoCaption » — active par défaut (désactivable dans ⚙). Fichier : `plugins/plugin-captions.js`.*

Des sous-titres **animés et stylés**, façon TikTok, Reels ou Shorts, posés **après la génération**. Les vidéos d'Agnes restent sans texte : les sous-titres sont une couche séparée, dessinée pendant l'**Assemblage** et incrustée par le **kit FFmpeg**. Vous pouvez changer de style ou corriger un mot sans rien regénérer.

[← Retour au README](../README.md)

---

## En bref
1. Écrivez les dialogues dans l'onglet **Voix** (ou importez un scénario : ils y arrivent tout seuls).
2. Onglet **AutoCaption** : cochez **Incruster les sous-titres**, choisissez un style.
3. **Assemblage → Assembler le film** (aperçu) ou **Exporter le kit FFmpeg** (version finale) : les sous-titres sont dedans.

---

## 1. Le texte

| Source | Détail |
|---|---|
| **Dialogues de l'onglet Voix** *(par défaut)* | Le texte vient de la réplique de chaque plan. Le minutage suit la voix du plan (son décalage et sa durée) et la **position réelle du plan dans le film** : si vous changez l'ordre, une découpe ou une transition, les sous-titres suivent |
| **Liste modifiable** | Une liste de sous-titres avec début, fin et texte, à corriger librement. Remplissez-la avec **Convertir en liste modifiable** (depuis les dialogues) ou **Importer un .srt** |

- Le nom du personnage (`LÉA :`, `Léa :`) et les balises de jeu (`[whispers]`) ne sont **jamais affichés**.
- **Inclure aussi les dialogues dont la voix n'est pas encore générée** : leur durée est estimée (environ 15 caractères par seconde). Pratique pour voir le rendu avant de générer les voix.
- Chaque mot est minuté en proportion de sa longueur, au sein de la réplique.

> ⚠️ Une **liste modifiable** a des temps fixes : elle ne suit plus les changements du montage. Faites-la en dernier, ou régénérez-la après avoir retouché le montage.

**Un sous-titre à partir d'une vidéo sans dialogue écrit** ? Assemblez le film, transcrivez-le dans **Extraire → Récupérer le script** ([19](19-extracteur.md)), téléchargez le **.srt**, puis **Importer un .srt** ici.

---

## 2. Les styles

### Préréglages
| Style | Effet |
|---|---|
| **TikTok — mot actif jaune** | Gras, majuscules, contour noir, 3 mots à la fois ; le mot prononcé passe en jaune et rebondit |
| **Karaoké** | Les mots se colorent progressivement au rythme de la voix |
| **Mot par mot** | Un seul mot, très grand, au centre de l'image, qui rebondit |
| **Mot surligné (encadré)** | Le mot prononcé est posé sur une pastille de couleur |
| **Sous-titre classique** | Phrase entière sur un bandeau semi-transparent, en bas |
| **Cyber-noir** | Comme TikTok, mot actif rouge (identité BlackLaw) |
| **Néon** | Texte blanc avec halo lumineux coloré |

Un préréglage est un point de départ : chaque réglage reste modifiable.

### Réglages
| Réglage | Détail |
|---|---|
| Police | Arial Black, Impact, Arial, Verdana, Trebuchet MS, Tahoma, Georgia : des polices présentes sur Windows, pour que le kit FFmpeg les retrouve |
| Taille | En % du petit côté de l'image |
| Couleur du texte | — |
| **Mot actif** | **Aucun effet**, **Change de couleur**, **Karaoké** (les mots déjà dits restent colorés), **Encadré** ; avec sa couleur |
| Contour | Couleur et épaisseur (0 = sans contour) |
| Fond | **Aucun** ou **Bandeau** (couleur et opacité) |
| Position | **Bas**, **Centre** ou **Haut**, avec la marge en % de la hauteur |
| Mots à l'écran | 1 (mot par mot) à 12. Un groupe se termine aussi en fin de phrase |
| Animation | **Aucune**, **Pop** (le mot rebondit), **Fondu** |
| Options | MAJUSCULES, ombre, halo |

L'**aperçu** montre le style en mouvement, au format du montage, sur la première image de vos plans.

> 📱 **Zones masquées** : TikTok, Reels et Shorts affichent boutons et légende en bas et à droite. Gardez une marge basse de **20 % ou plus** (les préréglages sont à 24 %), ou placez les sous-titres au centre.

---

## 3. Où apparaissent les sous-titres

| Sortie | Ce qui se passe |
|---|---|
| **Assemblage** (navigateur) | Dessinés image par image par-dessus le film, après l'étalonnage : ils ne sont ni teintés ni granulés |
| **Kit FFmpeg** | Le kit contient `sous-titres.ass` et l'incruste en dernière étape (H.264, qualité CRF 18). Le minutage est recalculé sur les positions exactes du kit |
| **Exporter .srt** | Texte et minutage seuls : pour CapCut, YouTube (sous-titres activables) ou les sous-titres automatiques des plateformes |
| **Exporter .ass** | Texte, minutage **et styles** (couleurs, mot actif, karaoké, animations) : s'ouvre dans CapCut, Premiere, Aegisub, ou s'incruste avec FFmpeg |

Décochez **Incruster les sous-titres** pour un film sans texte : les exports .srt et .ass restent possibles.

---

## Astuces
- Pour des sous-titres **justes au mot près**, générez d'abord les voix : le minutage suit alors leur durée réelle.
- Une réplique longue s'affiche en plusieurs groupes : c'est plus lisible sur mobile. Montez **Mots à l'écran** pour des phrases entières.
- Dans le kit FFmpeg, si la police choisie n'est pas installée sur le PC, une police voisine est utilisée ; Arial Black et Impact sont présentes sur Windows.
- Les cartons d'ouverture et de fin (extension Épisodes) et les textes de couverture (Publication) sont gérés à part : AutoCaption ne concerne que les dialogues.
