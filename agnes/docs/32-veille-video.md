# Veille vidéo

L'onglet **Veille vidéo** est une extension indépendante d'**Extraire**. Elle cherche des vidéos publiques TikTok et YouTube depuis le pont local, sans télécharger leur contenu. TikTok utilise TikWM ; YouTube utilise `yt-dlp` installé sur l'ordinateur du pont (`python -m pip install yt-dlp` si absent).

Saisissez jusqu'à cinq mots-clés, puis choisissez l'objectif, la plateforme, le format, la langue, le pays et la période de publication. Les résultats apparaissent en cartes avec leur miniature lorsqu'elle est disponible, leur date, leur durée et leurs statistiques. Un filtre précis ne conserve que les vidéos pour lesquelles cette information est publiée et vérifiable : avec une période choisie, une vidéo sans date publique est donc masquée. Le pays correspond à l'origine déclarée pour la vidéo, pas au pays des spectateurs ; YouTube ne donne généralement pas ce champ. Les métriques indisponibles restent affichées « — ». Les résultats ne constituent pas un classement global des plateformes.

**Ouvrir la source** ouvre la page YouTube ou TikTok. **Utiliser dans Extraire** ajoute plutôt le lien dans la section « Télécharger depuis un lien » d'Extraire et ouvre cet onglet. Pour YouTube, utilisez ensuite le kit yt-dlp ; pour TikTok, la récupération TikWM ou le kit. Ce transfert ne télécharge rien sans votre clic et Extraire peut toujours être activé ou désactivé séparément.

Le bouton **Envoyer à Marketing_Avatar** est facultatif. Il ajoute uniquement l'adresse, le titre et les métriques publiques relevées à la veille de l'agent Marketing. Le pont refuse l'export si la vérification date de plus d'une heure. Cette action ne génère ni script ni projet Agnes. Le lien existant entre l'agent Marketing et le Chef de production reste géré par `marketing_pont.py`.

Le bouton **Étudier** ouvre un parcours manuel adapté à l'objectif choisi : Marketing — Anthony 10 s, Court métrage, Série ou Film. Il reste attaché à l'URL choisie :

1. **SOURCE VÉRIFIÉE** : URL, provenance et métriques de la veille ; collez la transcription ou reprenez celle d'Extraire après avoir confirmé la correspondance de la vidéo. Ajoutez seulement des observations visuelles que vous avez contrôlées. Extraire peut rester désactivé.
2. **TRADUCTION FIDÈLE** : l'Atelier IA traduit en français sans interprétation. Si la source est déjà française, son texte est conservé.
3. **ANALYSE / INTERPRÉTATION** : l'Atelier IA sépare les observations fournies des hypothèses. Sans vidéo ou notes visuelles contrôlées, il doit indiquer que le visuel n'est pas vérifiable.
4. **CRÉATION** : pour le marketing, l'Atelier propose une réplique originale de 10 secondes pour Anthony. Pour les autres objectifs, il produit une nouvelle base de court métrage, de série ou de film avec une prémisse, des personnages et une structure différents. Un contrôle lexical compare la création à la transcription et à sa traduction ; une revue IA du sens cherche aussi les situations, personnages et enchaînements trop proches. Toute proximité excessive bloque l'ajout du dossier à l'Atelier. La revue humaine reste nécessaire.

La création reste un brouillon. L'ajout à l'Atelier IA est un clic distinct ; il ne lance aucune génération de vidéo ou publication. Le document conserve les quatre sections et l'URL d'origine.
