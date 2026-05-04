const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));
const recup = JSON.parse(fs.readFileSync('./recup_parcours.json', 'utf8'));

// ── Normalisation ──────────────────────────────────────────────────────────
function norm(s) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')                       // supprime diacritiques
    .replace(/[‘’ʼ´`]/g, "\x27") // normalise apostrophes -> U+0027
    .replace(/[–—−]/g, '-')                  // normalise tirets -> -
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*&\s*/g, ' et ')
    .replace(/,/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ').trim();
}

// Sans tirets et apostrophes (pour comparaison large)
function normClean(s) {
  return norm(s).replace(/[-']/g, ' ').replace(/\s+/g, ' ').trim();
}

// Sans tirets et apostrophes et espaces (comparaison mot compose vs separe)
function normFlat(s) {
  return norm(s).replace(/[-'\s]/g, '');
}

// Sans mots de liaison "et"
function normNoEt(s) {
  return norm(s).replace(/\bet\b/g, '').replace(/\s+/g, ' ').trim();
}

// ── Tables de correspondance ───────────────────────────────────────────────
const specByNorm = {};
for (const s of data.specialites) {
  specByNorm[norm(s.nom)]    = s.code;
  specByNorm[normClean(s.nom)] = s.code;
  specByNorm[normNoEt(s.nom)]  = s.code;
  specByNorm[normFlat(s.nom)]  = s.code;
  specByNorm[s.code.toLowerCase()] = s.code;
}

const defByNorm  = {};
const defByClean = {};
const defByFlat  = {};
for (const [code, val] of Object.entries(data.intitule_parcours)) {
  defByNorm[norm(val.definition)]    = code;
  defByClean[normClean(val.definition)] = code;
  defByFlat[normFlat(val.definition)]   = code;
}

// ── Similarite de mots (Jaccard avec tolerance typo prefixe) ──────────────
function wordSim(a, b) {
  const wa = new Set(a.split(' ').filter(w => w.length > 3));
  const wb = b.split(' ').filter(w => w.length > 3);
  if (wa.size === 0 || wb.length === 0) return 0;
  let matches = 0;
  for (const w of wb) {
    if (wa.has(w)) { matches++; continue; }
    if (w.length > 6 && [...wa].some(a => a.slice(0, 7) === w.slice(0, 7))) matches += 0.85;
  }
  return matches / Math.max(wa.size, wb.length);
}

// ── Resolution de specialite ───────────────────────────────────────────────
function resolveSpec(raw) {
  let s = raw.trim();
  // Supprimer prefixes BUT / DEPARTEMENT
  s = s.replace(/^(BUT|DEPARTEMENT)\s+/i, '');
  // Supprimer suffixes site/campus/orientation
  s = s.replace(/\s*[-–—]\s*(campus|site|orientation)\s*(de|d[''’]|du|des|en)?.*/i, '').trim();

  // Code entre parentheses finales
  const inParen = s.match(/\(([A-Z0-9]{2,8})\)\s*$/);
  if (inParen && data.specialites.some(sp => sp.code === inParen[1])) return inParen[1];

  // Prefixe "CODE :" ou "CODE -"
  const prefixCode = s.match(/^([A-Z0-9]{2,8})\s*[:–—-]/);
  if (prefixCode && data.specialites.some(sp => sp.code === prefixCode[1])) return prefixCode[1];

  // Suffixe "- CODE"
  const suffixCode = s.match(/[:–—-]\s*([A-Z]{2,8})\s*$/);
  if (suffixCode && data.specialites.some(sp => sp.code === suffixCode[1])) return suffixCode[1];

  // Nettoyer les restes
  s = s.replace(/\s*\([^)]+\)\s*$/, '').replace(/\s*[-–—]\s*[A-Z0-9]{2,8}\s*$/, '').trim();

  // Tentatives directes
  for (const fn of [norm, normClean, normNoEt, normFlat]) {
    const k = fn(s);
    if (specByNorm[k]) return specByNorm[k];
  }

  // Similarite de mots
  let best = null; let bestScore = 0;
  for (const [sn, code] of Object.entries(specByNorm)) {
    if (sn === code.toLowerCase()) continue;
    const score = wordSim(norm(s), sn);
    if (score > 0.7 && score > bestScore) { bestScore = score; best = code; }
  }
  return best;
}

// ── Resolution de parcours ─────────────────────────────────────────────────
function cleanParcours(s) {
  return s
    .replace(/\s*\([^)]*\)\s*$/, '')      // supprimer "(CODE / description)" final
    .replace(/^[A-Z0-9]{1,4}\s*[-–—]\s*/, '') // supprimer "A –" ou "A2I –" prefixe
    .replace(/^Parcours\s+/i, '')          // supprimer "Parcours "
    .trim();
}

function resolveParcours(raw) {
  // Extraire code direct
  const colonCode = raw.match(/^([A-Z0-9]{1,8})\s*:/);
  if (colonCode && data.intitule_parcours[colonCode[1]]) return colonCode[1];

  const inParen = raw.match(/\(([A-Z0-9]{2,8})\)\s*$/);
  if (inParen && data.intitule_parcours[inParen[1]]) return inParen[1];

  // Generer candidats apres nettoyage
  const candidates = [...new Set([raw, cleanParcours(raw)])];

  for (const cand of candidates) {
    const n = norm(cand);
    if (defByNorm[n])  return defByNorm[n];
    const nc = normClean(cand);
    if (defByClean[nc]) return defByClean[nc];
    const nf = normFlat(cand);
    if (defByFlat[nf]) return defByFlat[nf];
  }

  // Similarite de mots sur les candidats
  let best = null; let bestScore = 0;
  for (const cand of candidates) {
    const n = norm(cand);
    for (const [code, val] of Object.entries(data.intitule_parcours)) {
      const score = wordSim(n, norm(val.definition));
      if (score > 0.78 && score > bestScore) { bestScore = score; best = code; }
    }
  }
  return best;
}

// ── Correspondance IUT ─────────────────────────────────────────────────────
const IUT_ALIAS = {
  'iut toulouse-auch-castres':                 'iut toulouse a',
  'iut strasbourg-robert schuman':             'iut strasbourg sud-robert schuman',
  'iut lyon 3 jean moulin':                    'iut lyon 3',
  'iut mantes en yvelines':                    'iut mantes-en-yvelines',
  'iut martinique':                            'iut la martinique',
  'iut henri poincare longwy':                 'iut longwy',
  'iut grenoble i':                            'iut grenoble 1',
  'iut grenoble ii':                           'iut grenoble 2',
  'iut avignon universite':                    'iut avignon',
  "iut bayonne et du pays basque":             'iut bayonne et pays basque',
  'iut paris-rives de seine':                  'iut paris rives de seine',
  'iut dijon-auxerre-nevers':                  'iut dijon-auxerre',
  "iut besancon-vesoul-dole":                  'iut besancon-vesoul',
  'iut brest-morlaix':                         'iut brest',
  'iut chalon sur saone':                      'iut chalon-sur-saone',
  "iut ville d'avray-saint-cloud-nanterre": "iut ville d'avray",
  'ut strasbourg louis pasteur':               null,
};

function findIuts(recupName) {
  const nr = norm(recupName);
  const alias = Object.prototype.hasOwnProperty.call(IUT_ALIAS, nr) ? IUT_ALIAS[nr] : nr;
  if (alias === null) return [];
  return data.iuts.filter(iut => {
    const nd = norm(iut.nom_iut);
    return nd === alias || nd.startsWith(alias + '-') || nd.startsWith(alias + ' ');
  });
}

// ── Traitement ────────────────────────────────────────────────────────────
let updates = 0;
const notFoundIUT   = new Set();
const notFoundSpec  = new Set();
const notFoundParcours = new Set();

const SKIP_SPECS = new Set(['licences professionnelles']);
const SKIP_PARCOURS = /1re ann[eé]e commune|1re ann[eé]e\s*$|licence professionnelle/i;

for (const entry of recup) {
  if (!entry.parcours || entry.parcours.length === 0) continue;

  const matchingIuts = findIuts(entry.nom_iut);
  if (matchingIuts.length === 0) { notFoundIUT.add(entry.nom_iut); continue; }

  if (SKIP_SPECS.has(norm(entry.specialite))) continue;

  const specCode = resolveSpec(entry.specialite);
  if (!specCode) { notFoundSpec.add(entry.specialite); continue; }

  const codes = [];
  for (const p of entry.parcours) {
    if (SKIP_PARCOURS.test(p)) continue;
    const code = resolveParcours(p);
    if (code) codes.push(code);
    else notFoundParcours.add(p);
  }
  if (codes.length === 0) continue;

  for (const iut of matchingIuts) {
    if (!iut.parcours) iut.parcours = {};
    iut.parcours[specCode] = codes;
    updates++;
  }
}

fs.writeFileSync('./data.json', JSON.stringify(data, null, 2), 'utf8');

console.log('=== MISES A JOUR : ' + updates + ' ===');
console.log('\n=== IUT NON TROUVES (' + notFoundIUT.size + ') ===');
[...notFoundIUT].sort().forEach(n => console.log('  ' + n));
console.log('\n=== SPECIALITES NON TROUVEES (' + notFoundSpec.size + ') ===');
[...notFoundSpec].sort().forEach(n => console.log('  ' + n));
console.log('\n=== PARCOURS NON RESOLUS (' + notFoundParcours.size + ') ===');
[...notFoundParcours].sort().forEach(n => console.log('  ' + n));
