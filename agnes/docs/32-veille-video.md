# Veille vidéo

L'onglet **Veille vidéo** est une extension indépendante d'**Extraire**. Elle cherche des vidéos publiques TikTok et YouTube depuis le pont local, sans télécharger leur contenu. TikTok utilise TikWM ; YouTube utilise `yt-dlp` installé sur l'ordinateur du pont (`python -m pip install yt-dlp` si absent).

Saisissez jusqu'à cinq mots-clés, puis choisissez la plateforme, le format, la langue et le pays. Un filtre précis ne conserve que les vidéos pour lesquelles cette information est publiée et vérifiable. Le pays correspond à l'origine déclarée pour la vidéo, pas au pays des spectateurs ; YouTube ne donne généralement pas ce champ. Les métriques indisponibles restent affichées « — ». Les résultats ne constituent pas un classement global des plateformes.

Le bouton **Envoyer à Marketing_Avatar** est facultatif. Il ajoute uniquement l'adresse, le titre et les métriques publiques relevées à la veille de l'agent Marketing. Le pont refuse l'export si la vérification date de plus d'une heure. Cette action ne génère ni script ni projet Agnes. Le lien existant entre l'agent Marketing et le Chef de production reste géré par `marketing_pont.py`.

Le bouton **Étudier pour Anthony** ouvre un parcours manuel, attaché à l'URL choisie :

1. **SOURCE VÉRIFIÉE** : URL, provenance et métriques de la veille ; collez la transcription ou reprenez celle d'Extraire après avoir confirmé la correspondance de la vidéo. Ajoutez seulement des observations visuelles que vous avez contrôlées. Extraire peut rester désactivé.
2. **TRADUCTION FIDÈLE** : l'Atelier IA traduit en français sans interprétation. Si la source est déjà française, son texte est conservé.
3. **ANALYSE / INTERPRÉTATION** : l'Atelier IA sépare les observations fournies des hypothèses. Sans vidéo ou notes visuelles contrôlées, il doit indiquer que le visuel n'est pas vérifiable.
4. **CRÉATION** : l'Atelier IA propose une réplique originale de 10 secondes pour Anthony à partir de la mécanique générale. Un contrôle local compare le script à la transcription et à sa traduction ; une revue IA du sens cherche une paraphrase. Toute proximité excessive bloque l'ajout du dossier à l'Atelier. La revue humaine reste nécessaire.

La création reste un brouillon. L'ajout à l'Atelier IA est un clic distinct ; il ne lance aucune génération de vidéo ou publication. Le document conserve les quatre sections et l'URL d'origine.
