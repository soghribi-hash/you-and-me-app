# You & Me. — v17

Cette version conserve les fonctionnalités et la structure de You & Me. et applique une DA visuelle fidèle à l’ébauche : cartes éditoriales, pile de notes, En direct latéral, carte Spotify sombre, calendrier doux et navigation flottante : cartes plus douces, piles de cartes, verre léger, lilas/rose poudré et navigation flottante.

Conservé : musique/vinyle, bulles de profils, mood, En direct, calendrier, memories/throwback, notes, dessin, Send Love, déplacement libre des widgets et synchronisation Firebase.

Ajouts conservés : throwback photo dans le cœur du calendrier, gomme de dessin, pile de notes avec favoris/listes, disparition d'une note après envoi, recherche Spotify (avec configuration Spotify), personnalisation des widgets.

## GitHub Pages
Décompressez tout le contenu à la racine du dépôt puis activez GitHub Pages sur la branche publiée.

## Spotify
Renseignez `spotify-config.js` avec votre Client ID et l'URL de callback correspondant à votre GitHub Pages. La recherche Spotify utilise OAuth PKCE côté navigateur.


### Synchronisation
Le fond d’écran et la configuration de position/taille/couleur des widgets sont synchronisés dans Firebase sous la room. La dernière modification enregistrée devient la configuration partagée.
