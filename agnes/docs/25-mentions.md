# 25 — Mentions @ et # dans les prompts

Dans les prompts des cartes (Storyboard), on nomme les personnages et on place les skills directement dans le texte.

[← Retour au README](../README.md)

---

## @ — personnages, lieux, objets
- Tapez **@** : la liste de la bibliothèque s'ouvre (avec les vignettes). Tapez le début du nom pour filtrer, puis ↑ ↓, **Entrée** ou **Tab** pour choisir, **Échap** pour fermer.
- Ou **cliquez une pastille** du bloc Références : elle se coche et `@[Nom]` s'écrit là où était votre curseur. La décocher retire ses mentions du texte.
- Une mention **coche d'office** la référence du plan (dans la limite réglée dans ⚙ → Options avancées, 5 par défaut ; ChatGPT en accepte 8).
- Dans le prompt envoyé, `@[Mangoustino]` devient `Mangoustino` : le moteur relie ce nom à l'image de référence du même nom.

## # — skills à un endroit précis
- Tapez **#** : la liste des skills s'ouvre (recherche avec espaces : `#de face`).
- `#[Voiture FR — de face (pare-brise)]` est remplacé, **à cet endroit du texte**, par la consigne du skill. Utile pour écrire la scène dans l'ordre : qui, où, sous quel angle.
- Un skill à la fois mentionné et coché sur la carte n'est envoyé qu'une fois.

## Exemple (5 personnages en voiture)
```
De nuit, #[France — contexte] #[Voiture FR — de face (pare-brise)]
@[Mangoustino] conduit, @[Orangella] est passagère avant,
à l'arrière de gauche à droite de l'image : @[Kiwiro], @[Pomella], @[Litchao].
```
Le détail « Plus d'options → Prompt envoyé » de la carte montre le texte final.
