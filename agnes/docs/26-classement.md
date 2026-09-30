# 26 — Classement des cartes (Projet / Saison / Épisode)

*Extension « Classement » : active par défaut (désactivable dans ⚙). Fichier : `plugins/plugin-classement.js`.*

Quand une carte du Storyboard est terminée, le bouton **📁 Classer** copie tout ce qui la concerne dans un dossier de votre ordinateur, rangé par projet, saison et épisode. Rien n'est supprimé d'Agnes : c'est une copie.

[← Retour au README](../README.md)

---

## Ce qui est copié
```
<dossier racine>\
  La méthode AIDA\
    Saison 01\
      Episode 02\
        Carte 05 - Tu laisses un blanc après tes phrases\
          image.png    ← l'image de départ choisie sur la carte
          video.mp4    ← la prise vidéo sélectionnée
          fiche.md     ← prompts image et vidéo, références, notes de la carte
```
La **fiche.md** reprend les **Notes** de la carte (Plus d'options → Notes) : pour une vidéo marketing, la réplique, le montage, le **carton de fin**, la publication, la **description** et les **hashtags** (recopiés par le Chef de l'Atelier, voir [21](21-atelier.md)).

## Classer une carte
1. Sur la carte : **📁 Classer**.
2. La première fois : **Choisir le dossier racine…** (par exemple `D:\Productions`). Le navigateur demande l'autorisation d'y écrire : acceptez. Agnes retient ce dossier ; **Changer…** pour en prendre un autre.
3. Vérifiez **Projet**, **Saison**, **Épisode** et le nom du dossier de la carte :
   - Projet : la série de l'onglet Publication ou Épisodes si elle est remplie, sinon le nom du projet Agnes ;
   - Saison et Épisode : les derniers utilisés dans ce projet (sinon 1, ou le numéro d'épisode de Publication) ;
   - Carte : `Carte NN - ` + le titre de publication de la vidéo (ou la 1re ligne des notes, ou le début du prompt).
4. **Classer**. Le résumé de la carte affiche ensuite « 📁 Classée », avec la date et le dossier.

Classer à nouveau la même carte remplace ses fichiers dans ce dossier (par exemple après une nouvelle prise).

## Bon à savoir
- Chaque fois que le navigateur est rouvert, il peut redemander l'autorisation d'écrire dans le dossier : c'est normal, acceptez.
- Navigateur sans sélecteur de dossier : les fichiers sont **téléchargés** dans Téléchargements, avec le chemin dans le nom (`La_méthode_AIDA__Saison_01__Episode_02__Carte_05…__video.mp4`).
- Une carte sans image ni vidéo donne seulement `fiche.md`.
- L'extension n'utilise ni le pont local ni une autre extension : elle marche dans l'app seule.
