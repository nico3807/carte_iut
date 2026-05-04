/* ── IUT France 2025 – Interactive Map ── */

const CATEGORIES = {
  'Administration, gestion, commerce':       { color: '#e63946', short: 'AGC' },
  'Communication et médiation':              { color: '#7209b7', short: 'COM' },
  'Électricité, automatique, informatique':  { color: '#0077b6', short: 'ÉAI' },
  'Sciences industrielles':                  { color: '#2d6a4f', short: 'SI'  },
  'Construction, énergie, sécurité':         { color: '#b5770a', short: 'CÉS' },
};

const MARKER_COLORS = Object.fromEntries(
  Object.entries(CATEGORIES).map(([k, v]) => [k, v.color])
);

/* ── URLs iut.fr par spécialité BUT ── */
const BUT_URLS = {
  'CHIMIE':   'https://www.iut.fr/les-but/chimie/',
  'CJ':       'https://www.iut.fr/les-but/carrieres-juridiques/',
  'CS':       'https://www.iut.fr/les-but/carrieres-sociales/',
  'GB':       'https://www.iut.fr/les-but/genie-biologique/',
  'GCCD':     'https://www.iut.fr/les-but/genie-civil-construction-durable/',
  'GCGP':     'https://www.iut.fr/les-but/genie-chimique-genie-des-procedes/',
  'GEII':     'https://www.iut.fr/les-but/genie-electrique-et-informatique-industrielle/',
  'GIM':      'https://www.iut.fr/les-but/genie-industriel-et-maintenance/',
  'GMP':      'https://www.iut.fr/les-but/genie-mecanique-et-productique/',
  'GACO':     'https://www.iut.fr/les-but/gestion-administrative-et-commerciale-des-organisations/',
  'GEA':      'https://www.iut.fr/les-but/gestion-des-entreprises-et-des-administrations/',
  'HSE':      'https://www.iut.fr/les-but/hygiene-securite-environnement/',
  'INFOCOM':  'https://www.iut.fr/les-but/information-communication/',
  'INFO':     'https://www.iut.fr/les-but/informatique/',
  'MLT':      'https://www.iut.fr/les-but/management-de-la-logistique-et-des-transports/',
  'MP':       'https://www.iut.fr/les-but/mesures-physiques/',
  'MMI':      'https://www.iut.fr/les-but/metiers-du-multimedia-et-de-l-internet/',
  'PEC':      'https://www.iut.fr/les-but/packaging-emballage-et-conditionnement/',
  'QLIO':     'https://www.iut.fr/les-but/qualite-logistique-industrielle-et-organisation/',
  'RT':       'https://www.iut.fr/les-but/reseaux-et-telecommunications/',
  'SGM':      'https://www.iut.fr/les-but/science-et-genie-des-materiaux/',
  'SD':       'https://www.iut.fr/les-but/science-des-donnees/',
  'TC':       'https://www.iut.fr/les-but/techniques-de-commercialisation/',
  'MTEE':     'https://www.iut.fr/les-but/metiers-de-la-transition-et-de-l-efficacite-energetiques/',
};

/* ── Génère l'URL iut.fr d'un IUT à partir de son nom ── */
function iutPageUrl(nomIut) {
  const slug = nomIut
    .replace(/ [-–].+$/, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^iut\s+/i, '')
    .replace(/^(d[e']?|l[ae']?|les?)\s+/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `https://www.iut.fr/iut/iut-${slug}/`;
}

let map, clusterGroup, allMarkers = [], specialites = [], iuts = [], intituleParcours = {};
let activeMarkerEl = null;

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadData();
  buildFilters();
  buildLegend();
  createMarkers(iuts);
  updateCounter(iuts.length);
  bindUIEvents();
  handleUrlParams();
});

/* ── Map init ── */
function initMap() {
  map = L.map('map', {
    center: [46.6, 2.3],
    zoom: 6,
    minZoom: 5,
    maxZoom: 14,
    zoomControl: false,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, tuiles <a href="https://openstreetmap.fr/">OSM France</a>',
    subdomains: 'abc',
    maxZoom: 20,
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 10,
  });
  map.addLayer(clusterGroup);

  map.on('click', closePanel);
}

/* ── Load JSON ── */
async function loadData() {
  const res = await fetch('data.json');
  const json = await res.json();
  specialites     = json.specialites;
  iuts            = json.iuts;
  intituleParcours = json.intitule_parcours || {};
}

/* ── Create Markers ── */
// activeCode : code de spécialité sélectionnée pour colorer uniformément (optionnel)
function createMarkers(subset, activeCode = null) {
  clusterGroup.clearLayers();
  allMarkers = [];

  // Couleur de la spécialité active (si filtre spécialité activé)
  const activeSpec = activeCode ? specialites.find(s => s.code === activeCode) : null;

  const layers = subset.map(iut => {
    const color = '#009cde';
    const label = activeCode ? activeCode : iut.specialite.length;
    const icon = L.divIcon({
      className: '',
      html: `<div class="iut-marker" style="background:${color}" data-id="${iut.id}" title="${iut.ville}">
               ${label}
             </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });

    const marker = L.marker([iut.lat, iut.lng], { icon });

    marker.bindPopup(popupHTML(iut), {
      closeButton: false,
      maxWidth: 240,
      className: 'iut-popup',
    });

    marker.on('click', e => {
      L.DomEvent.stopPropagation(e);
      openPanel(iut);
      highlightMarker(e.target);
    });

    marker.on('mouseover', () => marker.openPopup());
    marker.on('mouseout',  () => marker.closePopup());

    allMarkers.push({ marker, iut });
    return marker;
  });

  // addLayers (batch) évite les problèmes de rendu de MarkerCluster
  clusterGroup.addLayers(layers);
  updateCounter(subset.length);
}

/* ── Dominant color (most represented category) ── */
function dominantColor(parcoursCodes) {
  const counts = {};
  parcoursCodes.forEach(code => {
    const spec = specialites.find(s => s.code === code);
    if (!spec) return;
    counts[spec.categorie] = (counts[spec.categorie] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
  return top ? CATEGORIES[top[0]]?.color ?? '#457b9d' : '#457b9d';
}

/* ── Popup HTML ── */
function popupHTML(iut) {
  return `<div class="popup-city">${iut.ville}</div>
          <div class="popup-sub">${iut.departement_nom} (${iut.departement_numero})</div>
          <div class="popup-sub">${iut.nom_iut}</div>
          <span class="popup-count">${iut.specialite.length} spécialité${iut.specialite.length > 1 ? 's' : ''}</span>`;
}

/* ── Info Panel ── */
function openPanel(iut) {
  const panel = document.getElementById('info-panel');
  document.getElementById('panel-content').innerHTML = renderPanel(iut);
  panel.classList.remove('panel-hidden');
  panel.classList.add('panel-visible');
  document.getElementById('app').classList.add('panel-open');
}

function closePanel() {
  const panel = document.getElementById('info-panel');
  panel.classList.remove('panel-visible');
  panel.classList.add('panel-hidden');
  document.getElementById('app').classList.remove('panel-open');
  if (activeMarkerEl) {
    activeMarkerEl.classList.remove('active');
    activeMarkerEl = null;
  }
}

function highlightMarker(leafletMarker) {
  if (activeMarkerEl) activeMarkerEl.classList.remove('active');
  const container = leafletMarker.getElement();
  const el = container?.querySelector('.iut-marker');
  if (el) { el.classList.add('active'); activeMarkerEl = el; }
}

/* ── Render Panel ── */
function renderPanel(iut) {
  const grouped = groupByCategory(iut.specialite);

  const catBlocks = Object.entries(grouped).map(([cat, specs]) => {
    const catColor = CATEGORIES[cat]?.color ?? '#457b9d';
    const tags = specs.map(s =>
      `<span class="parcours-tag" style="background:${s.couleur}80;border:1px solid ${s.couleur};color:${darken(s.couleur)}">
         <span class="tag-code">${s.code}</span>
       </span>`
    ).join('');
    const items = specs.map(s => {
      const butLink = BUT_URLS[s.code]
        ? `<a href="${BUT_URLS[s.code]}" target="_blank" rel="noopener" class="ext-link" title="BUT ${s.code} sur iut.fr">↗</a>`
        : '';
      const codes = iut.parcours?.[s.code] ?? [];
      const parcoursRows = codes.map(code => {
        const def = intituleParcours[code]?.definition ?? code;
        return `<div class="parcours-row">
          <span class="parcours-code" style="border-color:${s.couleur};color:${s.couleur}">${code}</span>
          <span class="parcours-def">${def}</span>
        </div>`;
      }).join('');
      const parcoursBlock = codes.length
        ? `<div class="parcours-inline">${parcoursRows}</div>`
        : '';
      return `<div class="legend-item" style="margin-bottom:2px">
         <span class="legend-dot" style="background:${s.couleur}"></span>
         <span><strong>${s.code}</strong> — ${s.nom} ${butLink}</span>
       </div>${parcoursBlock}`;
    }).join('');

    return `<div class="cat-group">
              <div class="cat-group-title" style="color:${catColor}">${cat}</div>
              ${items}
            </div>`;
  }).join('');

  return `
    <div class="panel-header">
      <div class="panel-city">${iut.ville}</div>
      <div class="panel-dept">
        <span class="panel-dept-num">${iut.departement_numero}</span>
        ${iut.departement_nom}
      </div>
      <div class="panel-region">${iut.region}</div>
    </div>

    <div class="panel-section">
      <div class="panel-section-title">Université</div>
      <div class="panel-uni-name">${iut.universite}</div>
      <div class="panel-iut-name">${iut.nom_iut}</div>
      <a href="${iutPageUrl(iut.nom_iut)}" target="_blank" rel="noopener" class="iut-link-tag">↗ Lien vers l'IUT</a>
    </div>

    <div class="panel-section">
      <div class="panel-section-title">
        ${iut.specialite.length} spécialité${iut.specialite.length > 1 ? 's' : ''} BUT proposée${iut.specialite.length > 1 ? 's' : ''}
      </div>
      ${catBlocks}
    </div>

  `;
}


function groupByCategory(codes) {
  const result = {};
  codes.forEach(code => {
    const spec = specialites.find(s => s.code === code);
    if (!spec) return;
    if (!result[spec.categorie]) result[spec.categorie] = [];
    result[spec.categorie].push(spec);
  });
  return result;
}

/* lighten hex for readability */
function darken(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const lum = 0.299*r + 0.587*g + 0.114*b;
  return lum > 140 ? '#1e293b' : '#ffffff';
}

/* ── Filters ── */
function buildFilters() {
  /* Parcours */
  const parcoursSel = document.getElementById('parcours-filter');
  const bycat = {};
  specialites.forEach(s => {
    if (!bycat[s.categorie]) bycat[s.categorie] = [];
    bycat[s.categorie].push(s);
  });

  Object.entries(bycat).forEach(([cat, specs]) => {
    const og = document.createElement('optgroup');
    og.label = cat;
    specs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.code;
      opt.textContent = `${s.code} – ${s.nom}`;
      og.appendChild(opt);
    });
    parcoursSel.appendChild(og);
  });

  /* Stats */
  document.getElementById('stats-count').textContent = iuts.length;
}

function buildLegend() {
  const body = document.getElementById('legend-body');
  const bycat = {};
  specialites.forEach(s => {
    if (!bycat[s.categorie]) bycat[s.categorie] = [];
    bycat[s.categorie].push(s);
  });

  body.innerHTML = Object.entries(bycat).map(([cat, specs]) => {
    const catColor = CATEGORIES[cat]?.color ?? '#457b9d';
    const items = specs.map(s =>
      `<div class="legend-item">
         <span class="legend-dot" style="background:${s.couleur}"></span>
         <span><strong>${s.code}</strong> — ${s.nom}</span>
       </div>`
    ).join('');
    return `<div class="legend-cat">
              <div class="legend-cat-title" style="color:${catColor}">${cat}</div>
              ${items}
            </div>`;
  }).join('');
}

/* ── Normalize accents for search ── */
function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* ── Filter Logic ── */
function applyFilters() {
  const parcours = document.getElementById('parcours-filter').value;
  const search   = norm(document.getElementById('search-input').value.trim());

  const filtered = iuts.filter(iut => {
    if (parcours && !iut.specialite.includes(parcours)) return false;
    if (search) {
      const hay = norm([iut.ville, iut.departement_nom, iut.universite, iut.nom_iut, iut.region].join(' '));
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  // Passer le code actif pour colorier les marqueurs avec la couleur de la spécialité
  createMarkers(filtered, parcours || null);
  document.getElementById('stats-count').textContent = filtered.length;

  if (filtered.length === 0) {
    map.setView([46.6, 2.3], 6);
    return;
  }

  // Calcul de la zone à afficher
  let zoomTargets = filtered;

  // Recherche texte : prioriser les correspondances sur la ville
  if (search) {
    const villeMatches = filtered.filter(i => norm(i.ville).includes(search));
    if (villeMatches.length > 0) zoomTargets = villeMatches;
  }

  // Exclure les DOM-TOM si la métropole est représentée
  const metro = zoomTargets.filter(i => i.lat > 40 && i.lat < 52 && i.lng > -6 && i.lng < 11);
  const boundsTargets = metro.length > 0 ? metro : zoomTargets;

  if (boundsTargets.length === 1) {
    // Un seul résultat : zoom sur la ville + ouverture du panneau
    map.setView([boundsTargets[0].lat, boundsTargets[0].lng], 11);
    openPanel(boundsTargets[0]);
  } else {
    // Plusieurs résultats : fitBounds synchrone (plus fiable que flyToBounds avec MarkerCluster)
    const lats = boundsTargets.map(i => i.lat);
    const lngs = boundsTargets.map(i => i.lng);
    map.fitBounds(
      [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [60, 60], maxZoom: 11, animate: true }
    );
  }
}

/* ── Counter ── */
function updateCounter(n) {
  document.getElementById('visible-count').textContent = n;
  document.getElementById('plural-s').textContent  = n > 1 ? 's' : '';
  document.getElementById('plural-s2').textContent = n > 1 ? 's' : '';
}

/* ── UI events ── */
function bindUIEvents() {
  document.getElementById('parcours-filter').addEventListener('change', applyFilters);

  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 280);
  });

  document.getElementById('reset-btn').addEventListener('click', resetFilters);
  document.getElementById('panel-close').addEventListener('click', closePanel);

  document.getElementById('legend-toggle').addEventListener('click', () => {
    document.getElementById('legend').classList.toggle('collapsed');
  });
}

/* ── Lien entrant depuis l'annuaire ── */
function handleUrlParams() {
  const iutParam = new URLSearchParams(window.location.search).get('iut');
  if (!iutParam) return;

  const matches = allMarkers.filter(({ iut }) =>
    iut.nom_iut === iutParam || iut.nom_iut.startsWith(iutParam + ' - ')
  );
  if (matches.length === 0) return;

  const { marker, iut: target } = matches[0];
  clusterGroup.zoomToShowLayer(marker, () => {
    openPanel(target);
    highlightMarker(marker);
  });
}

function resetFilters() {
  document.getElementById('parcours-filter').value = '';
  document.getElementById('search-input').value    = '';
  createMarkers(iuts);
  document.getElementById('stats-count').textContent = iuts.length;
  map.setView([46.6, 2.3], 6);
  closePanel();
}
