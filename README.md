# Carte & Annuaire des IUT de France – 2025

Application web statique en deux vues complémentaires présentant les IUT de France métropolitaine et d'outre-mer proposant un Bachelor Universitaire de Technologie (BUT).

## Pages

### Carte interactive (`index.html`)

- Carte Leaflet avec clustering automatique des marqueurs
- Filtre par spécialité BUT (24 spécialités avec code couleur par domaine)
- Recherche libre insensible aux accents (ville, université, nom IUT)
- Panneau de détail : université, département, région, spécialités et parcours proposés
- Légende rétractable des domaines et spécialités
- Compteur du nombre de sites affichés
- Navigation vers l'annuaire

### Annuaire tableau comparatif (`iut-france-annuaire.html`)

- Tableau interactif regroupant les IUT par établissement
- Vue tableau (défaut desktop) et vue cartes (défaut mobile)
- Filtres : région, spécialité BUT, recherche textuelle, tri
- Tags BUT colorés par domaine avec mise en évidence de la spécialité filtrée
- Colonne parcours listant les parcours disponibles par spécialité
- En-tête de colonne fixe lors du défilement
- Navigation vers la carte

## Structure des fichiers

```
├── index.html              Carte interactive
├── iut-france-annuaire.html  Annuaire tableau comparatif
├── app.js                  Logique de la carte (Leaflet, filtres, panneau)
├── styles.css              Mise en forme partagée (carte)
├── data.json               Données : IUTs, spécialités, parcours
├── sw.js                   Service worker (PWA, cache offline)
├── manifest.json           Manifest PWA
├── logo-les-iut-single-couleur.svg  Logo
├── icons/                  Icônes PWA (192×192, 512×512)
├── update_parcours.js      Script de mise à jour des parcours dans data.json
└── parcours.xlsx           Source de données parcours BUT
```

## Données (`data.json`)

Trois entrées principales :

- **`specialites`** – 24 BUT avec code, nom, domaine, couleur hex et URL iut.fr
- **`iuts`** – établissements avec ville, université, département, région, coordonnées GPS, liste des spécialités et parcours proposés par spécialité
- **`intitule_parcours`** – dictionnaire code → définition pour les 56 parcours BUT

### Spécialités couvertes

| Domaine | Spécialités |
|---|---|
| Administration, gestion, commerce | CJ, GACO, GEA, MLT, TC |
| Communication et médiation | CS, INFOCOM, MMI |
| Électricité, automatique, informatique | GEII, INFO, RT, SD |
| Sciences industrielles | GIM, GMP, MP, QLIO, CHIMIE, GB, GCGP, SGM |
| Construction, énergie, sécurité | GCCD, MTEE, HSE, PEC |

## Mettre à jour les parcours

Si les données de parcours évoluent, préparer un fichier `recup_parcours.json` au format :

```json
[
  {
    "nom_iut": "IUT La Rochelle",
    "specialite": "Génie biologique",
    "parcours": ["Biologie médicale et biotechnologie", "Agronomie"]
  }
]
```

Puis lancer :

```bash
node update_parcours.js
```

Le script normalise les noms (accents, tirets, apostrophes, mots de liaison) et met à jour `data.json` en ne modifiant que les entrées ayant des parcours renseignés.

## Lancement

L'application est entièrement statique. Un serveur local est requis pour le chargement de `data.json` via `fetch` :

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
- [Barlow & Arvo](https://fonts.google.com/) – polices
- Aucun framework JS, aucune dépendance back-end
