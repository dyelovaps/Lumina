# 99 — Dépannage

[← Retour au README](../README.md)

---

## Génération
| Symptôme | Cause probable | Solution |
|---|---|---|
| « Ajoutez votre clé API » | Clé absente | ⚙ → Clé API Agnes |
| Erreur **401** | Clé invalide ou expirée | Vérifiez la clé dans votre compte Agnes |
| Erreur **400** avec une image de référence | Agnes refuse l'image intégrée | Ajoutez une **clé imgbb** ([01](01-reglages.md)), ou une URL publique dans la Bibliothèque |
| Erreur **400** sur tous les plans vidéo | Format de paramètres ou modèle | ⚙ → Options avancées : essayez l'autre *Format des paramètres vidéo*, vérifiez le modèle |
| Erreur **404** | Chemin d'API changé | Vérifiez les chemins dans les options avancées, puis **Réinitialiser** |
| **429** / « trop de requêtes » | Offre gratuite : **1 vidéo par minute** (20 requêtes/min en texte) | L'app réessaie seule en patientant (jusqu'à ~4 min) ; gardez *Générations simultanées* à 1 pour la vidéo |
| Erreur **400** « size must be 720P » | Autre taille demandée à 2.5 Flash | Ne devrait plus arriver (l'app envoie 720P) ; vérifiez le *Format des paramètres vidéo* : **Automatique** |
| Erreur 400/404 sur toutes les vidéos depuis le 26/09/2026 | Modèle `agnes-video-v2.0` retiré | ⚙ → Options avancées → Modèle vidéo : `agnes-video-2.5-flash`, format **Automatique** |
| Vidéo plus courte que prévu | La série 2.5 accepte 4 à 12 s | Découpez les plans longs en deux |
| Vidéo bloquée « en cours » | Suivi interrompu | Rechargez la page : le suivi reprend. Sinon, *Annuler* puis *Relancer* |
| **503 « video_queue_full »** / « File d'attente Agnes pleine » | Les serveurs vidéo d'Agnes sont saturés (fréquent aux heures de pointe, et depuis la migration générale vers 2.5 Flash). **Ce n'est pas un problème de réglage** | Rien à faire : l'app patiente et réessaie seule jusqu'à 20 min (30 à 90 s entre deux essais, affichés sur la carte et dans la Liste d'attente). Au-delà, le plan passe en échec : **Relancer** plus tard |
| **« Délai dépassé (20 min) »** | Agnes n'a pas fini (file chargée), ou image envoyée sans URL publique | Cliquez **⟳ Reprendre le suivi** (même tâche, rien de refacturé). Le message indique le dernier statut reçu. Si c'est « en file côté serveur » depuis le début, vérifiez la **clé imgbb** et essayez en **720p** |
| « Agnes a besoin d'une adresse publique (URL)… » | Vidéo à partir d'une image sans clé imgbb | ⚙ → **Clé imgbb** (gratuite sur api.imgbb.com), puis relancez |
| Personnage différent d'un plan à l'autre | Pas de référence commune | Références dans la carte + Bible + même seed ([02](02-storyboard.md#références--personnages-lieux-objets), [11](11-bible.md)) |
| Le personnage **change au milieu d'une vidéo** | Le modèle a inventé une coupe | Laissez le **Verrou d'identité** coché, clips de 5 s, un personnage principal par plan |
| En Image → Vidéo, l'IA **invente** ce qui n'est pas dans l'image | Mouvement trop ample | **Scène verrouillée** + **mouvement subtil** ([02](02-storyboard.md#image--vidéo--tenir-la-scène)) |
| **« Aucun rendu »** / « en ligne » alors que le plan est terminé | Le serveur d'Agnes bloque le téléchargement direct | **⟳ Récupérer le fichier** sur le plan ([02](02-storyboard.md#aucun-rendu-ou-rendu-en-ligne-sur-un-plan-terminé)) |
| Vidéo en 16:9 alors que le prompt dit « vertical 9:16 » | C'est le **Format** du plan qui compte | Réglez le format du plan (ou la sélection) sur 9:16 |
| Libellés bizarres (« Ajouter une compétence », « Réponse finale rapide ») | Traduction automatique du navigateur | Désactivez la traduction pour cette page (menu du navigateur) |
| Du texte ou des sous-titres dans la vidéo | Le modèle en invente | Skill « Sans texte ni musique » + prompt négatif `text, subtitles, watermark` |

Dans tous les cas, ouvrez **Réponse brute** (et **Requête vidéo envoyée**) sous le plan : c'est le message exact de l'API. Pour isoler un problème de paramètres vidéo : ⚙ → **🧪 Tester la génération vidéo**, puis copiez le rapport.

## Bible
| Symptôme | Solution |
|---|---|
| Un nouveau projet affiche la bible d'une autre série | Projet rattaché avant la v3.9 : onglet **Bible** → **+ Nouvelle bible pour ce projet** ou **Ne pas utiliser de bible ici** (l'autre série n'est pas modifiée) |
| L'ADN d'un personnage d'une autre série apparaît dans les prompts | Même cause : vérifiez dans l'onglet Bible avec quels projets la bible est partagée |

## Voix et son
| Symptôme | Solution |
|---|---|
| « aucune voix choisie pour LÉA » | Casting vocal : choisissez une voix pour ce nom |
| Réplique lue par le narrateur | Le nom du dialogue ne correspond pas au casting (accents, majuscules) : l'app l'indique |
| « dépasse le plan » | Allongez la durée du plan ou raccourcissez la réplique |
| Musique ElevenLabs refusée (402/403) | Votre abonnement n'inclut pas Eleven Music : importez un fichier à la place |
| Micro refusé | Autorisez le micro pour cette page (icône à gauche de l'adresse) |

## Assemblage
| Symptôme | Solution |
|---|---|
| Rendu saccadé ou figé | Gardez l'onglet **visible**, fermez les autres onglets lourds |
| Fichier en WebM au lieu de MP4 | Le navigateur ne sait pas enregistrer en MP4 : utilisez le **kit FFmpeg** ou convertissez |
| Plan « ignoré car indisponible » | La vidéo n'a pas été téléchargée localement : regénérez-la ou ouvrez-la une fois dans le Storyboard |
| Pas de son | Cochez *Garder le son des clips* ; vérifiez que les voix et pistes ne sont pas coupées |
| Film 1080p un peu flou | Plans en 720P agrandis | *Agrandissement* : **Net** ou **Très net** ; pour la version finale, kit FFmpeg |
| « ⬇ 1080p » en WebM | Le navigateur ne sait pas écrire de MP4 | Chrome/Edge récents, ou conversion avec FFmpeg |

## Kit FFmpeg
| Symptôme | Solution |
|---|---|
| « FFmpeg est introuvable » | Installez FFmpeg et ajoutez-le au PATH ([16](16-kit-ffmpeg.md)) |
| Erreur `lut3d` | Fichier LUT invalide : réimportez-le ou retirez-le |
| Erreur sur un clip | Le clip est peut-être corrompu : regénérez ce plan |

## Données
| Symptôme | Solution |
|---|---|
| Projets disparus | Le navigateur a vidé son stockage, ou vous avez changé de navigateur. Utilisez toujours le même navigateur et **Projet → Protéger le stockage**. Exportez régulièrement |
| Stockage plein | **Projet → Supprimer les médias orphelins**, supprimez les vieilles prises et les anciens projets exportés |
| Changer d'ordinateur | Exportez projets (.zip) et bible (.json). L'import de projet .zip n'existe pas encore ; la bible, elle, se réimporte |

## Stills → Clip et Extraire
| Symptôme | Cause probable | Solution |
|---|---|---|
| Images « sans numéro » | Le numéro n'est pas au début du nom | Renommez (`01.png`) ou tapez le numéro dans la liste ([09](09-stills-clip.md)) |
| Plans « sans prompt » | Numéros différents entre images et prompts | Vérifiez `01 :` ↔ `01.png` ; ou tapez le prompt dans la liste |
| Le kit de téléchargement dit « yt-dlp est introuvable » | yt-dlp pas installé | `winget install yt-dlp.yt-dlp`, puis relancez ([19](19-extracteur.md)) |
| TikTok : « échec » sur un lien dans l'app | TikWM lent, saturé ou lien privé/supprimé | Réessayez dans une minute, cochez le relais allOrigins, ou utilisez le kit yt-dlp |
| TikTok : la vidéo s'ouvre dans un onglet au lieu de se télécharger | Le serveur du fichier refuse la page web | Clic droit → « Enregistrer la vidéo sous… », puis glissez-la dans Extraire |
| TikTok refuse le téléchargement (kit) | yt-dlp pas à jour, ou variante sans curl-cffi | Le script met à jour yt-dlp ; sur Mac, `pipx install "yt-dlp[default,curl-cffi]"` |
| « Moteur Whisper indisponible » | Pas d'internet au premier chargement du modèle | Reconnectez-vous (le modèle est ensuite gardé), ou passez à l'API OpenAI |
| « Impossible de lire le son de ce fichier » | Vidéo sans piste audio, ou codec non lu par le navigateur | Essayez Chrome/Edge ; ou extrayez l'audio (option « audio seul » du kit) |
| Veille : « Aucune vidéo trouvée » | TikWM lent ou bloqué | Réessayez dans une minute, cochez le relais allOrigins (étape 1), ou changez de mots-clés |
| Veille : peu de résultats | Période trop courte ou durée max trop basse | Élargissez la période (reclassement sans nouvelle recherche) |
| « Convertir en prompts » : « activez l'extension Atelier IA » | La conversion utilise l'IA de l'Atelier | ⚙ → cochez **Atelier IA** |
| Vidéo analysée rouverte « fichier indisponible » | Le fichier n'a pas pu être enregistré (stockage plein ?) | Glissez à nouveau la vidéo ; **Projet → Protéger le stockage** |
| Une seule image « par plan » pour toute la vidéo | Sensibilité trop basse | Glissez la sensibilité vers la gauche, ou utilisez « toutes les N secondes » |

## Le lot (script numéroté)
| Symptôme | Cause probable | Solution |
|---|---|---|
| Un numéro devient « Texte → Vidéo » au lieu de « Texte → Image → Vidéo » | La ligne image n'est pas reconnue | Commencez-la par `IMAGE :` (ou `Prompt image :`), ou corrigez-la dans la liste de vérification |
| Référence en rouge « Julien ? » | Aucune image de ce nom dans la Bibliothèque | Ajoutez-la sous ce nom, ou corrigez la ligne `RÉF :` |
| Mauvais personnage repris automatiquement | Un nom de la Bibliothèque est cité dans le prompt | Ajoutez une ligne `RÉF :` (elle remplace la détection), ou retirez-le (✕) dans la vérification |
| Un texte après le numéro n'est pas utilisé | Le numéro a déjà des lignes IMAGE/VIDÉO : ce texte est lu comme un **titre** | Mettez-le sous une étiquette `IMAGE :` ou `VIDÉO :` |
| Carte bloquée sur « image à valider » | Validation demandée (réglage par défaut) | Choisissez la variante dans **Image de départ**, puis **Animer cette image →** |
| « Tout mettre en file » n'anime pas mes images | Voulu : il ne lance pas les images non validées | **Animer** sur chaque carte, ou cochez les cartes puis **Générer la sélection** |
| « Générez d'abord l'image de départ » | Animation demandée sans image | **Générer l'image** sur la carte |
| Corrections de la liste disparues | Le script a été modifié ensuite | Corrigez directement le script, ou faites les corrections en dernier |

## Atelier IA
| Symptôme | Solution |
|---|---|
| « … injoignable depuis la page » | Vérifiez la connexion ; si c'est systématique pour un fournisseur, utilisez-en un autre et signalez-le |
| « … : clé refusée (401 / 403) » | Recopiez la clé depuis le site du fournisseur |
| « … : limite atteinte (429) » / « Tous les fournisseurs ont refusé » | Quotas gratuits épuisés : ajoutez un second fournisseur (repli automatique) ou attendez |
| Le chef ne range rien | Il attend votre **Autoriser** dans la discussion ; activez aussi les extensions Bible, Scénario et Publication |
| Noms en rouge dans Le lot après envoi | Les images de ces personnages ne sont pas dans la Bibliothèque : ajoutez-les sous le même nom |
| Un agent ignore mon document | Case cochée ? Menu sur « Tous les agents » ou sur cet agent ? Précisez « d'après le document X » dans la demande |
| « PDF sans texte » | PDF scanné : copiez le texte avec « + Texte collé » |

Détails : [21 — Atelier IA](21-atelier.md#13-dépannage).

## AutoCaption
| Symptôme | Solution |
|---|---|
| Aucun sous-titre dans le film | **Incruster les sous-titres** coché ? Des dialogues dans l'onglet Voix (ou une liste) ? Puis relancez **Assembler le film** |
| Sous-titres décalés par rapport à la voix | Générez les voix : sans voix, la durée est estimée. Vérifiez le **Décalage** de la voix du plan |
| Sous-titres décalés après une modification du montage | Vous êtes en **Liste modifiable** (temps fixes) : régénérez-la, ou repassez en « Dialogues » |
| Police différente dans le kit FFmpeg | La police n'est pas installée sur le PC : choisissez Arial Black, Impact ou Arial |
| Sous-titres cachés par les boutons de TikTok | Montez la **marge** basse (20 % ou plus) ou placez-les au centre |

## Extensions
| Symptôme | Solution |
|---|---|
| Un onglet n'apparaît pas | Vérifiez la case dans ⚙ ; un message indique si le fichier est introuvable |
| Extension décochée mais toujours visible | Rechargez la page |
