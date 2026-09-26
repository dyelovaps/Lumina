# 07 — Assemblage

Monte le film à partir des plans terminés, dans l'ordre du storyboard, avec leur **prise sélectionnée**. Le rendu se fait **dans le navigateur, en temps réel** : un film de 2 minutes prend 2 minutes.

[← Retour au README](../README.md)

---

## Réglages du film
| Réglage | Détail |
|---|---|
| Format de sortie | 16:9, 9:16… Les plans d'un autre format sont recadrés ou bordés selon le cadrage |
| Résolution | 480p, 720p ou 1080p |
| **Agrandissement (720P → 1080p)** | **Net** (par défaut) : rééchantillonnage bicubique + netteté adaptative, calculés par la carte graphique · **Très net** · **Simple** (lissage du navigateur). S'applique dès qu'un plan est plus petit que la sortie, par exemple une vidéo Agnes 2.5 Flash (720P) dans un film 1080p |
| Images / seconde | 12 à 60 (24, 25 ou 30 conseillés) |
| Cadrage | **Remplir** (recadre, pas de bandes) ou **Adapter** (image entière, bandes noires) |
| Transition par défaut | Cut, Fondu enchaîné, Fondu au noir |
| Durée des images fixes | Temps d'affichage d'un plan image |
| Garder le son des clips | Conserve le son d'origine des vidéos |
| Léger zoom sur les images fixes | Effet « Ken Burns » : les images fixes ne paraissent pas figées |
| Piste audio | Un fichier audio posé sur tout le film. Pour un vrai mixage par séquence, préférez l'onglet **Son** ([13](13-son.md)) |

> 🔍 **720P → 1080p, comme « télécharger en 1080p » dans Google Flow ?** Presque : l'image devient plus grande et nettement plus nette, mais **aucun détail n'est inventé**. Google Flow utilise un agrandissement par IA côté serveur, qu'Agnes ne propose pas aujourd'hui. Pour de vrais détails supplémentaires : générez en 1080P avec `agnes-video-2.5` (payant), ou passez le film dans Topaz Video / Real-ESRGAN.

## Réglages par plan (timeline)
Chaque plan terminé a une ligne :
| Champ | Rôle |
|---|---|
| ☑ | Inclure ou exclure le plan du film |
| **Durée** | *(image)* durée d'affichage, sinon celle par défaut |
| **Début / Fin** | *(vidéo)* découpe en secondes : garder de 0,5 s à 4,2 s, par exemple |
| Transition | Vers le plan suivant, avec sa **durée** |

## Lancer le rendu
1. **Assembler le film**. Un aperçu s'affiche pendant le rendu.
2. **Gardez l'onglet visible** : un onglet en arrière-plan ralentit ou fige le rendu.
3. À la fin, **Télécharger le film** : MP4 si le navigateur sait l'enregistrer, sinon WebM.

**Arrêter** interrompt le rendu et propose la partie déjà rendue.

## Ce qui est appliqué automatiquement
- **Voix** attachées aux plans ([12](12-voix.md)), avec baisse du son du clip pendant qu'on parle.
- **Musiques / ambiances / bruitages** ([13](13-son.md)).
- **Étalonnage** ([15](15-etalonnage.md)), sauf la netteté et la LUT, réservées au kit FFmpeg.
- **Sous-titres animés** ([22](22-autocaption.md)), si « Incruster les sous-titres » est coché dans AutoCaption.

## Boutons des extensions
- **Exporter le kit FFmpeg (.zip)** : rendu final haute qualité sur votre PC ([16](16-kit-ffmpeg.md)).
- **→ Publication** : ouvre l'onglet Publication. Le dernier film rendu y est ajouté au kit de publication ([17](17-publication.md)).

## Aperçu ou rendu final ?
| | Assemblage navigateur | Kit FFmpeg |
|---|---|---|
| Vitesse | Temps réel | Rapide (dépend du PC) |
| Qualité | Bonne (compression navigateur) | Maximale (H.264, CRF 18) |
| Format | MP4 ou WebM | MP4 |
| Netteté, LUT | Non | Oui |
| Usage | Vérifier le rythme, publier vite | Version finale |
