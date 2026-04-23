# Carte interactive des IUT de France – 2025

Application web statique présentant les 201 sites IUT de France métropolitaine et d'outre-mer proposant un Bachelor Universitaire de Technologie (BUT).

## Fonctionnalités

- **Carte interactive** avec regroupement automatique des marqueurs (clustering)
- **Filtre par spécialité BUT** : 24 spécialités organisées par domaine
- **Recherche libre** : ville, université, nom de l'IUT (insensible aux accents)
- **Panneau de détail** : université, département, région, liste des spécialités et parcours proposés
- **Légende** des domaines et spécialités, rétractable
- **Compteur** du nombre de sites affichés

## Structure des fichiers

```
├── index.html          Page principale
├── app.js              Logique applicative (carte, filtres, panneau)
├── styles.css          Mise en forme
├── data.json           Données des IUTs et spécialités
├── build_data.js       Script de regénération de data.json (Node.js)
└── Liste_des_BUT_en_France_-_2025_modifie.xlsx   Source de données
```

## Données

`data.json` contient deux tableaux :

- **`specialites`** – 24 BUT avec code, nom, domaine, couleur et parcours
- **`iuts`** – 201 établissements avec ville, université, département, région, coordonnées GPS et liste des codes spécialités proposées

### Spécialités couvertes

| Domaine | Spécialités |
|---|---|
| Administration, gestion, commerce | CJ, GACO, GEA, MLT, TC |
| Communication et médiation | CS, INFOCOM, MMI |
| Électricité, automatique, informatique | GEII, INFO, RT, SD |
| Sciences industrielles | GIM, GMP, MP, QLIO, CHIMIE, GB, GCGP, SGM |
| Construction, énergie, sécurité | GCCD, MTEE, HSE, PEC |

## Régénérer les données

Si le fichier Excel source est mis à jour, relancer la génération de `data.json` :

```bash
npm install xlsx
node build_data.js
```

## Lancement

L'application est entièrement statique. Ouvrir `index.html` via un serveur local (requis pour le chargement de `data.json` par `fetch`) :

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Puis ouvrir `http://localhost:8080` dans un navigateur.

## Technologies

- [Leaflet.js 1.9.4](https://leafletjs.com/) – carte interactive
- [Leaflet.MarkerCluster 1.5.3](https://github.com/Leaflet/Leaflet.markercluster) – regroupement des marqueurs
- [OpenStreetMap France](https://openstreetmap.fr/) – fond de carte en français
- [Inter](https://fonts.google.com/specimen/Inter) – police
- Aucun framework JS, aucune dépendance back-end
