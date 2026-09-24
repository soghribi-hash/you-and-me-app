// Spotify Web API — optionnel mais recommandé pour la recherche intégrée.
// Crée une app sur developer.spotify.com/dashboard et colle uniquement le Client ID ici.
// Ajoute ton URL GitHub Pages exacte comme Redirect URI, puis renseigne-la ci-dessous.
window.SPOTIFY_CLIENT_ID = window.SPOTIFY_CLIENT_ID || '';
window.SPOTIFY_REDIRECT_URI = window.SPOTIFY_REDIRECT_URI || (location.origin + location.pathname);
