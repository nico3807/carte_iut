# Carte & Annuaire des IUT de France – 2025

Application web statique en deux vues complémentaires présentant les 201 sites IUT de France métropolitaine et d'outre-mer proposant un Bachelor Universitaire de Technologie (BUT).

## Pages

### Carte interactive (`index.html`)

- Carte Leaflet avec clustering automatique des marqueurs
- Filtre par spécialité BUT (24 spécialités avec code couleur par domaine)
- Filtre par parcours (liste déroulante conditionnelle, n'apparaît qu'après sélection d'une spécialité)
- Recherche libre insensible aux accents (ville, université, nom IUT)
- Panneau de détail : université, département, région, spécialités et parcours proposés, lien vers iut.fr
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
- Lien vers la page iut.fr de chaque établissement
- Navigation vers la carte

## Structure des fichiers

```
├── index.html                      Carte interactive
├── iut-france-annuaire.html        Annuaire tableau comparatif
├── app.js                          Logique de la carte (Leaflet, filtres, panneau)
├── styles.css                      Mise en forme
├── data.json                       Données : IUTs, spécialités, parcours
├── liens_pages_iut.json            Liens iut.fr par nom_iut (201 entrées)
├── sw.js                           Service worker (PWA, cache offline)
├── manifest.json                   Manifest PWA
├── logo-les-iut-single-couleur.svg Logo
├── icons/                          Icônes PWA (192×192, 512×512)
│
├── merge_parcours.py               Fusionne recup_parcours.json dans data.json
├── recup_parcours.json             Données brutes extraites du site iut.fr
├── recup_parcours.py               Scrape les pages iut.fr pour extraire les parcours
│
└── Recuperation des parcours/
    ├── parse_iuts.py               Parse les HTML mis en cache → recup_parcours.json
    └── cache_iuts_html/            Pages HTML téléchargées depuis iut.fr (une par IUT)
```

## Données (`data.json`)

Trois entrées principales :

- **`specialites`** – 24 BUT avec code, nom, domaine, couleur hex et URL iut.fr
- **`iuts`** – 201 sites avec ville, université, département, région, coordonnées GPS, liste des spécialités et parcours proposés par spécialité (codes courts)
- **`intitule_parcours`** – dictionnaire code → définition pour les 83 parcours BUT

### Spécialités couvertes

| Domaine | Spécialités |
|---|---|
| Administration, gestion, commerce | CJ, GACO, GEA, MLT, TC |
| Communication et médiation | CS, INFOCOM, MMI |
| Électricité, automatique, informatique | GEII, INFO, RT, SD |
| Sciences industrielles | CHIMIE, GB, GCGP, GIM, GMP, MP, QLIO, SGM |
| Construction, énergie, sécurité | GCCD, HSE, MTEE, PEC |

### Format d'un IUT dans `data.json`

```json
{
  "id": 42,
  "ville": "Grenoble",
  "nom_iut": "IUT Grenoble I",
  "universite": "Université Grenoble Alpes",
  "departement_nom": "Isère",
  "departement_numero": "38",
  "region": "Auvergne-Rhône-Alpes",
  "lat": 45.187,
  "lng": 5.726,
  "specialite": ["INFO", "GEII", "GMP"],
  "parcours": {
    "INFO": ["DACS", "IAMSI", "RACDV"],
    "GEII": ["AII", "SEEM"]
  }
}
```

## Mettre à jour les parcours

Le processus se fait en deux étapes Python :

### Étape 1 – Extraire les parcours depuis iut.fr

Placer les pages HTML des IUT (une par établissement) dans `Recuperation des parcours/cache_iuts_html/`, puis lancer :

```bash
cd "Recuperation des parcours"
python parse_iuts.py
```

Cela produit `recup_parcours.json` à la racine du projet.

> **Alternativement**, si vous souhaitez scraper directement le site iut.fr (requiert une connexion) :
> ```bash
> python recup_parcours.py
> ```

### Étape 2 – Fusionner dans `data.json`

```bash
python merge_parcours.py
```

Le script apparie les IUT par similarité ville + nom (Jaccard), convertit les noms complets de spécialités et parcours en codes courts, valide les correspondances (les spécialités doivent se recouper) et met à jour `data.json`.

Résultat attendu (affiché dans le terminal) :
```
IUTs apparies : 181/201 (non trouves : 20, parcours inconnus : 0)
data.json mis a jour
```

## Mettre à jour les liens vers les pages iut.fr

`liens_pages_iut.json` contient un dictionnaire `nom_iut → URL` construit à partir des noms de fichiers HTML dans `cache_iuts_html/`. Si de nouveaux fichiers HTML sont ajoutés :

1. Ajouter le fichier HTML dans `Recuperation des parcours/cache_iuts_html/`
2. Mettre à jour manuellement l'entrée correspondante dans `liens_pages_iut.json`

Format :
```json
{
  "IUT de Laval": "https://www.iut.fr/iut/iut-de-laval/",
  "IUT Annecy": null
}
```

## Lancement

L'application est entièrement statique. Un serveur local est requis pour le chargement des fichiers JSON via `fetch` :

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
