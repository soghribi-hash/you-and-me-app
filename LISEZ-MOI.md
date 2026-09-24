# You & Me — v14

Version prête pour GitHub Pages, basée sur la DA actuelle.

Ajouts :
- Throwback photo dans le cœur du widget anniversaire, avec ouverture plein écran.
- Journal/Notes en pile de cartes, favoris et listes cochables.
- Envoi d’une note vers la room : elle arrive dans la pile du destinataire et ne reste pas dans la pile de l’expéditeur.
- Deuxième pile séparée pour le dessin, avec gomme ajoutée.
- Recherche Spotify intégrée avec sélection de morceaux et carte musicale (pochette/titre/artiste).
- Recherche Spotify nécessite un Client ID public dans `spotify-config.js`; sans celui-ci, le champ ouvre/recherche Spotify comme solution de secours.
- Appui long sur un widget pour l’édition, palette incluant transparent, et zoom/dézoom à deux doigts en mode édition.
- Déplacement libre, taille, couleur, police et synchronisation Firebase conservés.
- Cache Service Worker v14.

## Spotify
1. Crée une application dans le dashboard Spotify for Developers.
2. Mets son Client ID dans `spotify-config.js`.
3. Ajoute l’URL exacte de ton GitHub Pages comme Redirect URI.

Le Client ID n’est pas un secret. Ne mets jamais de Client Secret dans le dépôt GitHub.
