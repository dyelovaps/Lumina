# 15 — Étalonnage & finition

*Extension « Étalonnage & finition » — à activer dans ⚙.*

Applique un **look commun à tous les plans** pour gommer les écarts de couleur entre générations. C'est souvent ce qui fait la différence entre « des clips IA » et « un film ».

[← Retour au README](../README.md)

---

## Activer
Cochez **Appliquer l'étalonnage à l'Assemblage et au kit FFmpeg**. Choisir un préréglage l'active aussi.

## Préréglages
| Préréglage | Effet |
|---|---|
| Neutre | Aucun changement |
| **Réalisme brut** | Couleurs légèrement retenues, grain fin, netteté : rendu « caméra réelle » |
| **Cyber-noir** | Désaturé, froid, contrasté, vignette marquée |
| Drame chaud | Tons chauds, contraste doux |
| Nuit bleue | Sombre et bleuté |
| Sans blanchiment (bleach bypass) | Très contrasté, couleurs lavées : thriller, guerre |
| Vintage 70 | Chaud, sépia léger, gros grain |
| Noir & blanc | Contraste fort, grain |
| Animation vive (3D) | Couleurs saturées et lumineuses (style Pixar) |

## Réglages fins
| Curseur | Plage | Remarque |
|---|---|---|
| Contraste | 0,5 – 1,6 | 1 = neutre |
| Saturation | 0 – 1,8 | 0 = noir & blanc |
| Luminosité | 0,6 – 1,4 | 1 = neutre |
| Température | froid −1 ↔ +1 chaud | |
| Sépia | 0 – 1 | |
| Vignettage | 0 – 1 | Assombrit les bords |
| Grain | 0 – 1 | Grain animé |
| Netteté | 0 – 1 | **Kit FFmpeg uniquement** |

Toucher un curseur passe en réglage personnalisé.

## LUT .cube
**Importer une LUT** : un fichier `.cube` (LUT 3D) de votre logiciel de montage ou d'un pack de looks. Elle est appliquée **par le kit FFmpeg** (avant les autres réglages), pas dans l'aperçu.

## Aperçu avant / après
Choisissez un plan, puis déplacez la **séparation** : l'original est à gauche, l'image étalonnée à droite. La netteté et la LUT n'y sont pas visibles.

## Plans exclus
Cochez les plans à laisser tels quels (cartons, écran de téléphone, archive…).

## Agrandissement
Le kit FFmpeg redimensionne chaque plan en **Lanczos**, la meilleure méthode classique, à la résolution choisie dans l'Assemblage (jusqu'en 4K), avec la netteté réglée ici.
Pour un agrandissement **par IA** (reconstruction de détails), passez le film final dans un outil dédié : Topaz Video, Real-ESRGAN.
