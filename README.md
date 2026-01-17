# 🎵 Playlist Scraper & Visualizer

Script automatisé pour extraire les données d'une playlist Apple Music et générer des graphiques.

## 📋 Prérequis

- [Node.js](https://nodejs.org/) version 16 ou supérieure

## 🔧 Utilisation

### 1. Scraper la playlist

Exécutez le script pour parcourir automatiquement la playlist Apple Music et générer `playlist.json` :

```powershell
npm run scrape
```

Le script va :
- Lancer un navigateur automatisé (Puppeteer)
- Charger la page de la playlist
- Extraire tous les titres (titre, artiste, durée)
- Sauvegarder dans `playlist.json`

### 2. Visualiser les graphiques

Ouvrez `Index.html` dans votre navigateur :

```powershell
Start-Process Index.html
```

Le site va automatiquement :
- Charger les données depuis `playlist.json`
- Afficher tous les titres (pas juste 35)
- Générer 5 graphiques différents :
  - Répartition par artiste (pie chart)
  - Durée des titres (bar chart)
  - Répartition par genre (pie chart)
  - Distribution par année (bar chart)
  - Évolution temporelle (line chart)

## 📁 Fichiers

- `scraper.js` - Bot qui parcourt la playlist
- `package.json` - Dépendances Node.js
- `playlist.json` - Données extraites (généré)
- `Index.html` - Site avec graphiques
- `README.md` - Ce fichier

## 🐛 Dépannage

Si le scraper ne trouve pas les pistes :
- Vérifiez votre connexion Internet
- Le fichier `debug.html` est créé automatiquement pour analyse
- Les sélecteurs CSS peuvent avoir changé sur Apple Music

Si les graphiques ne s'affichent pas :
- Vérifiez que `playlist.json` existe
- Ouvrez la console du navigateur (F12) pour voir les erreurs
- Le site utilise des données de démo si le JSON n'est pas disponible

## 📝 Format JSON

```json
{
  "name": "Nom de la playlist",
  "description": "Description",
  "tracks": [
    {
      "position": 1,
      "title": "Titre",
      "artist": "Artiste",
      "duration": "3:45",
      "durationSec": 225,
      "genre": "Pop",
      "year": 2021
    }
  ]
}
```
