# You & Me. — Mise en ligne gratuite

Tout est gratuit : hébergement + base de données. Ça se fait entièrement depuis Safari sur ton iPhone.

## 1. Créer la base de données (5 min, gratuit)

1. Va sur https://console.firebase.google.com, connecte-toi avec un compte Google.
2. "Ajouter un projet" → donne-lui un nom (ex: you-and-me) → crée-le (désactive Google Analytics, pas besoin).
3. Dans le menu de gauche : Build > Realtime Database > "Créer une base de données" > choisis une région proche (europe-west1) > démarre en **mode test**.
   - Le mode test ouvre l'accès en lecture/écriture pendant 30 jours. C'est très bien pour commencer entre vous deux, mais après 30 jours il faudra resserrer les règles (je t'explique plus bas) sinon l'appli arrêtera de se synchroniser.
4. Clique sur la roue crantée en haut à gauche > "Paramètres du projet" > descends jusqu'à "Vos applications" > icône `</>` (web) > donne un surnom à l'appli > "Enregistrer l'application".
5. Firebase t'affiche un bloc `firebaseConfig = {...}`. Copie-le.
6. Ouvre le fichier `firebase-config.js` (dans ce dossier) et colle ton bloc à la place de celui d'exemple. Sauvegarde.

### Resserrer les règles après les 30 jours (optionnel, recommandé)
Retourne dans Realtime Database > onglet "Règles", et remplace par :
```json
{
  "rules": {
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```
Ça reste ouvert à qui connaît le nom exact de votre "room" (votre code secret) — largement suffisant pour un usage privé à deux, sans limite de durée.

## 2. Mettre l'app en ligne (gratuit, sans PC)

**Option la plus simple : GitHub Pages**
1. Crée un compte gratuit sur https://github.com (depuis Safari, ça marche très bien).
2. Crée un nouveau repository (bouton "+") — mets-le en **Public**, appelle-le par ex. `you-and-me-app`.
3. Dans le repo, "Add file" > "Upload files", et envoie tous les fichiers de ce dossier (index.html, style.css, app.js, firebase-config.js, manifest.json, sw.js, icon-192.png, icon-512.png).
4. Une fois envoyés : Settings (du repo) > Pages > Source: "Deploy from a branch" > branche `main`, dossier `/ (root)` > Save.
5. Après 1-2 minutes, ton app est en ligne à une adresse du type :
   `https://TON-PSEUDO.github.io/you-and-me-app/`

## 3. Se connecter à deux

1. Toi et ta copine ouvrez ce lien chacun sur votre iPhone.
2. Au premier lancement, chacun renseigne son prénom, choisit "Moi" ou "Elle", et **entre le même code secret** (ex: `sofia2025`) — c'est ce code qui vous connecte tous les deux à la même appli.
3. Pour l'installer comme une vraie app : dans Safari, appuyez sur le bouton Partager (le carré avec la flèche) > "Sur l'écran d'accueil". L'icône apparaît comme une app normale.

## 4. Modifier l'app plus tard

C'est ton code, dans ton repo GitHub : tu peux revenir ici, me montrer ce que tu veux changer, je te redonne les fichiers mis à jour, et tu les ré-uploades sur GitHub (ça écrase l'ancienne version, l'app se met à jour automatiquement pour vous deux).

## Limites à connaître (honnêtement)
- **Notifications** : elles marchent seulement si l'app est ouverte (même en arrière-plan) sur le téléphone. De vraies notifications push quand l'app est totalement fermée demandent une config plus poussée (Firebase Cloud Messaging) — possible plus tard si tu veux, mais plus de boulot.
- **Photos/notes** : elles sont stockées en base64 directement dans la base de données (pas de vrai espace de stockage fichiers), ça marche très bien à l'usage d'un couple mais évite les photos en HD à outrance — le plan gratuit Firebase a un quota (1 Go de data, largement suffisant pour ce genre d'usage).
