# 13 — Son (musique, ambiances & bruitages)

*Extension « Musique, ambiances & bruitages » — à activer dans ⚙.*

La bande-son est une **couche séparée** : les vidéos sont générées sans musique, puis on pose ici des pistes sur des plages de plans. Elles sont mixées par l'Assemblage et le kit FFmpeg.

[← Retour au README](../README.md)

---

## Ajouter une piste
- **Importer un fichier audio** (mp3, wav, m4a…), en choisissant d'abord le type : Musique, Ambiance ou Bruitage.
- **Générer avec ElevenLabs** (section repliable) :

| Type | Service | Durée |
|---|---|---|
| Musique | Eleven Music | 10 s à 5 min, option *Instrumental uniquement* |
| Ambiance | Effets sonores | 30 s max (la piste boucle ensuite) |
| Bruitage | Effets sonores | 30 s max |

Décrivez le son en anglais, de préférence avec l'ambiance, les instruments et le rythme :
`dark minimal synth pulse, tense legal thriller underscore, slow build, no vocals`
`heavy rain on a car roof, distant traffic, night`

La clé ElevenLabs de l'onglet Voix est reprise si le champ est vide. Selon votre abonnement, la musique peut ne pas être disponible.

## Réglages d'une piste
| Réglage | Rôle |
|---|---|
| Nom, Type | Changer le type applique ses valeurs conseillées (voir plus bas) |
| **Du plan… au plan…** | Plage couverte (« début du film » / « fin du film » par défaut) |
| Retard | Démarre x secondes après le début du premier plan |
| Départ dans le fichier | Commence la lecture plus loin dans le fichier audio |
| Volume | 0 à 2 |
| Fondu entrée / sortie | En secondes |
| **Sous les voix** | Volume pendant qu'un personnage parle (0,35 = nettement baissé, 1 = inchangé) |
| Boucle | Répète le fichier s'il est plus court que la plage |

▶ écoute la piste · **Couper** la désactive sans la supprimer · **Supprimer**.

## Valeurs conseillées par type
| Type | Volume | Fondus | Boucle | Sous les voix |
|---|---|---|---|---|
| Musique | 0,5 | 1,5 s / 2 s | oui | 0,35 |
| Ambiance | 0,35 | 0,8 s / 0,8 s | oui | 0,7 |
| Bruitage | 0,9 | aucun | non | 1 |

Un bruitage se cale sur **un seul plan** (même plan au début et à la fin), avec un **retard** pour le synchroniser (porte qui claque à 1,2 s, par exemple).

## Conseils
- Une musique par séquence plutôt qu'une seule pour tout l'épisode : le film respire mieux.
- Ambiance + musique ensemble : baissez l'ambiance (0,25–0,35).
- Écoutez le résultat avec **Assembler le film** ; pour la version finale, utilisez le **kit FFmpeg**.
