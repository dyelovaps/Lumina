# 16 — Kit de montage FFmpeg

*Extension « Kit de montage FFmpeg » — à activer dans ⚙. Bouton dans l'onglet Assemblage.*

Exporte un dossier prêt à l'emploi qui fabrique le **film final en haute qualité** sur votre ordinateur avec FFmpeg (gratuit). Il reprend **tout** ce qui est réglé dans l'app.

[← Retour au README](../README.md)

---

## Installation de FFmpeg (une seule fois)
- **Windows** : téléchargez une version « essentials » sur **gyan.dev/ffmpeg/builds**, dézippez-la (ex. `C:\ffmpeg`), puis ajoutez `C:\ffmpeg\bin` au **PATH** (Paramètres → Système → Variables d'environnement). Vérifiez dans un terminal : `ffmpeg -version`.
- **Mac** : `brew install ffmpeg`.
- **Linux** : `sudo apt install ffmpeg`.

## Utilisation
1. **Assemblage → Exporter le kit FFmpeg (.zip)**.
2. Dézippez le dossier.
3. Windows : double-cliquez **`montage.bat`**. Mac/Linux : `./montage.sh`.
4. Le film sort sous le nom **`film_final.mp4`**, dans le dossier.

## Contenu du kit
| Élément | Rôle |
|---|---|
| `clips/` | Les prises sélectionnées, numérotées |
| `voix/` | Les voix attachées aux plans |
| `musique/` | Les pistes de l'onglet Son |
| `luts/grade.cube` | La LUT, si vous en avez importé une |
| `montage.bat` / `montage.sh` | Le script de fabrication |
| `filtre.txt`, `musique_filtre.txt`, `liste.txt` | Instructions de montage et de mixage (générées) |
| `LISEZMOI.txt` | Résumé des réglages repris |

## Ce que fait le script
1. **Prépare chaque plan** : recadrage au format et à la résolution de l'Assemblage (Lanczos, puis netteté `unsharp` selon le réglage *Agrandissement*), étalonnage, découpe début/fin, cadence d'images uniforme, durée exacte, son (ou silence si le clip n'en a pas).
2. **Mixe la voix** de chaque plan : décalage, volume, son du clip atténué.
3. **Assemble** : collage direct si tout est en « cut », sinon fondus enchaînés et fondus au noir.
4. **Mixe musiques et ambiances** : plages, fondus, boucle, baisse automatique quand on parle.
5. Encode en **H.264, qualité CRF 18**, son AAC 192 kb/s.
6. **Incruste les sous-titres** AutoCaption (`sous-titres.ass`), s'ils sont activés ([22](22-autocaption.md)).

## Si quelque chose ne va pas
- **« FFmpeg est introuvable »** : le PATH n'est pas configuré (voir l'installation).
- Une ligne en erreur s'affiche dans la fenêtre : copiez-la et transmettez-la, elle indique la commande en cause.
- Les dossiers `work/` (fichiers intermédiaires) peuvent être supprimés une fois le film terminé.

> Petite différence avec l'aperçu navigateur : dans le kit, un fondu au noir se fait **en chevauchement** entre deux plans. Le film peut donc être quelques dixièmes de seconde plus court. La synchronisation des voix et des musiques est recalculée en conséquence.
