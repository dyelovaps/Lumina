# 12 — Voix (voix-off & dialogues)

*Extension « Voix-off & dialogues » — à activer dans ⚙.*

Génère les **dialogues et la voix-off** plan par plan, avec **une voix fixe par personnage**. La voix est attachée au plan, puis mixée automatiquement par l'Assemblage et le kit FFmpeg.

[← Retour au README](../README.md)

---

## 1. Synthèse vocale (fournisseur)
| Fournisseur | Réglages |
|---|---|
| **ElevenLabs** (meilleur rendu en français) | Clé, modèle, stabilité / ressemblance |
| **OpenAI TTS** | Clé, URL de base, modèle (`gpt-4o-mini-tts`) |
| **API compatible OpenAI** | Même chose avec une autre URL |

Modèles ElevenLabs :
- **Multilingual v2** : stable et naturel, le choix par défaut ;
- **Eleven v3** : le plus expressif ; comprend les balises `[whispers]`, `[sighs]`, `[angry]`, `[laughs]`… ;
- **Flash v2.5 / Turbo v2.5** : rapides et économiques.

Stabilité : bas = plus d'émotion et de variation, haut = plus régulier. Ressemblance : fidélité à la voix d'origine.

**Silence entre répliques** : pause insérée quand un plan contient plusieurs répliques.
**Charger mes voix ElevenLabs** : récupère les voix de votre compte (voix de la bibliothèque, voix clonées).

## 2. Casting vocal
Une ligne par personnage : **NOM** · **voix** · **consigne de jeu** · **Tester**.
- Le nom doit correspondre à celui des dialogues (majuscules, accents compris : `LÉA`).
- **NARRATEUR** est la voix des lignes sans nom.
- La **consigne de jeu** (« voix grave, lasse, murmurée ») sert avec OpenAI. Avec Eleven v3, mettez plutôt des balises dans le texte.
- Le casting est enregistré dans le projet. L'import de scénario le remplit tout seul.

## 3. Dialogues par plan
Écrivez le dialogue de chaque plan :
```
LÉA : [whispers] Tu savais depuis le début ?
MARC : Je voulais te protéger.
Ce soir-là, tout a basculé.        ← sans nom = NARRATEUR
```
| Réglage | Rôle |
|---|---|
| **Décalage** | Moment (s) où la voix démarre dans le plan |
| **Volume** | 0 à 2 |
| **Son du clip** | Volume du son d'origine du clip pendant la voix (0,35 = atténué) |

| Bouton | Effet |
|---|---|
| **Générer** | Synthétise les répliques et les assemble en un seul fichier |
| **🎙 Enregistrer** / ■ Arrêter | Enregistre votre propre voix au micro (voix témoin ou définitive) |
| **Importer…** | Utilise un fichier audio existant |
| ▶ Écouter · Télécharger · Retirer | — |

Des étiquettes signalent l'état : « voix attachée · 3,2 s », et en rouge **« dépasse le plan »** si la voix est plus longue que le plan (elle serait coupée). Allongez alors le plan ou raccourcissez la réplique.

## Actions globales
- **Générer les voix manquantes** / **Tout régénérer**.
- **Exporter les voix (.zip)** : fichiers numérotés + `dialogues.txt`.
- **Exporter les dialogues (.srt)** : sous-titres calés sur le montage réel. Ils servent pour CapCut ou pour les sous-titres automatiques des plateformes ; la vidéo générée, elle, reste sans texte. Pour des sous-titres **incrustés et animés**, utilisez **AutoCaption** ([22](22-autocaption.md)).

Sur chaque carte du Storyboard, **🎙 Voix** ouvre directement le dialogue du plan.

> Les voix consomment vos crédits ElevenLabs ou OpenAI. Testez d'abord une réplique avec **Tester** dans le casting.
