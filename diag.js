const fs = require('fs');
const recup = JSON.parse(fs.readFileSync('./recup_parcours.json', 'utf8'));
const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

function norm(s) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/['‘’ʼ`´]/g, "'")
    .replace(/[–—−-]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*&\s*/g, ' et ')
    .replace(/,/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ').trim();
}

const ip = data.intitule_parcours;
const defByNorm = {};
for (const [code, val] of Object.entries(ip)) {
  defByNorm[norm(val.definition)] = code;
}

// Diagnostic apostrophe
const target = recup.find(e => e.parcours && e.parcours.some(p => p.includes('aliment'))).parcours.find(p => p.includes('aliment'));
const def = ip['SAB'].definition;
console.log('recup:', JSON.stringify(target));
console.log('data: ', JSON.stringify(def));
console.log('recup norm:', norm(target));
console.log('data  norm:', norm(def));
console.log('match:', norm(target) === norm(def));

// Char codes around apostrophe
const ap_recup = [...target].map((c,i) => [i, c.charCodeAt(0).toString(16), c]).filter(x => x[1] !== '20' && !('a' <= x[2] && x[2] <= 'z') && !('A' <= x[2] && x[2] <= 'Z') && x[1] !== '2c' && x[1] !== '27');
const ap_def   = [...def].map((c,i) => [i, c.charCodeAt(0).toString(16), c]).filter(x => x[1] !== '20' && !('a' <= x[2] && x[2] <= 'z') && !('A' <= x[2] && x[2] <= 'Z') && x[1] !== '2c' && x[1] !== '27');
console.log('special chars in recup:', ap_recup);
console.log('special chars in def:  ', ap_def);

// Test RACDV
const racdv_recup = recup.find(e => e.parcours && e.parcours.some(p => p.includes('Réalisation d'))).parcours.find(p => p.includes('Réalisation d'));
const racdv_def = ip['RACDV'].definition;
console.log('\nRACDV recup:', norm(racdv_recup));
console.log('RACDV def:  ', norm(racdv_def));
console.log('match:', norm(racdv_recup) === norm(racdv_def));
