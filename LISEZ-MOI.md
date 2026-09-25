# You & Me. — v39

Cette version conserve les fonctionnalités et la structure de You & Me. et applique une DA visuelle fidèle à l’ébauche : cartes éditoriales, pile de notes, En direct latéral, carte Spotify sombre, calendrier doux et navigation flottante : cartes plus douces, piles de cartes, verre léger, lilas/rose poudré et navigation flottante.

Conservé : musique/vinyle, bulles de profils, mood, En direct, calendrier, memories/throwback, notes, dessin, Send Love, déplacement libre des widgets et synchronisation Firebase.

Ajouts conservés : throwback photo dans le cœur du calendrier, gomme de dessin, pile de notes avec favoris/listes, disparition d'une note après envoi, recherche Spotify (avec configuration Spotify), personnalisation des widgets.

## GitHub Pages
Décompressez tout le contenu à la racine du dépôt puis activez GitHub Pages sur la branche publiée.

## Spotify
Renseignez `spotify-config.js` avec votre Client ID et l'URL de callback correspondant à votre GitHub Pages. La recherche Spotify utilise OAuth PKCE côté navigateur.


### Synchronisation
Le fond d’écran et la configuration de position/taille/couleur des widgets sont synchronisés dans Firebase sous la room. La dernière modification enregistrée devient la configuration partagée.


### Modifs v39
- En direct : pile de vraies photos discrète sur le bord, ouverture compacte, photo au premier plan et passage à la suivante par appui avec animation douce.
- Widgets : aucun déplacement pendant le scroll normal. Appui long pour entrer en édition, déplacement libre au doigt et redimensionnement par pincement à deux doigts. Les boutons Monter/Descendre ont été retirés.
- Notes : pile conservée, appui ou swipe horizontal pour passer à la suivante, animation douce de passage de carte, et les actions commentaire/favori/suppression/édition ainsi que l’agrandissement des photos restent indépendants.
- Le reste de l’application est conservé.
