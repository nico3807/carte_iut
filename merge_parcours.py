#!/usr/bin/env python3
"""
merge_parcours.py
-----------------
Remplace les champs 'parcours' de data.json par les données de recup_parcours.json.
Les IUTs sont appariés par similarité ville + nom. Les spécialités et parcours
(en noms complets dans recup) sont convertis en codes (format data.json).
"""

import json, unicodedata, re, sys
from collections import defaultdict
from pathlib import Path

DATA_FILE   = Path(__file__).parent / "data.json"
RECUP_FILE  = Path(__file__).parent / "recup_parcours.json"
OUTPUT_FILE = Path(__file__).parent / "data.json"

# ── Normalisation ─────────────────────────────────────────────────────────────

def normalize(s):
    s = str(s)
    # Normalise toutes les variantes de guillemets simples / apostrophes
    for src, dst in [
        ('‘', "'"), ('’', "'"), ('ʼ', "'"),
        ('\x91',   "'"), ('\x92',   "'"),           # Windows-1252
        ('‑', '-'), ('–', '-'), ('—', '-'),  # tirets
        (' ', ' '),                              # espace insécable
    ]:
        s = s.replace(src, dst)
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.lower().strip()

def norm_ville(v):
    v = normalize(v)
    v = re.sub(r'\s+cedex\s*\d*$', '', v)
    v = re.sub(r'\s+\d{5}$', '', v)
    # Normalise les tirets et apostrophes pour l'appariement ville
    v = re.sub(r'[^a-z0-9\s]', ' ', v)
    return re.sub(r'\s+', ' ', v).strip()

STOP = {'iut', 'de', 'du', 'des', 'd', 'l', 'la', 'le', 'les', 'et', 'en',
        'site', 'campus', 'a', 'un', 'une'}

def tokens(s):
    return set(re.sub(r'[^a-z0-9]', ' ', normalize(s)).split()) - STOP - {''}

# ── Correspondance spécialités ────────────────────────────────────────────────

def build_spec_matcher(data):
    """Retourne une fonction spec_full_name -> code."""
    spec_name_to_code = {normalize(s['nom']): s['code'] for s in data['specialites']}
    spec_code_to_code = {s['code'].lower(): s['code'] for s in data['specialites']}

    aliases = {
        'mt2e': 'MTEE',
        'gcgp': 'GCGP',
        'genie chimique et genie des procedes': 'GCGP',
        'genie chimique-genie des procedes': 'GCGP',
        'genie chimique genie des procedes': 'GCGP',
        'genie civil construction durable': 'GCCD',
        'genie civil-construction durable': 'GCCD',
        'genie civil - construction durable': 'GCCD',
        'genie electrique informatique industrielle': 'GEII',
        'genie electrique et informatique industrielle': 'GEII',
        'hygiene securite environnement': 'HSE',
        'hygiene, securite, environnement': 'HSE',
        'packaging emballage et conditionnement': 'PEC',
        'reseaux & telecommunications': 'RT',
        'reseaux et telecommunications': 'RT',
        'information-communication': 'INFOCOM',
        'information communication': 'INFOCOM',
        'metier du multimedia et de l internet': 'MMI',
        'metiers du multimedia et de l internet': 'MMI',
        'gestion des entreprises et administrations': 'GEA',
        'metiers de la transition et de l efficacite energetiques': 'MTEE',
        'carrieres sociales villes et territoires durables': 'CS',
        'carrieres sociales villes et territoires durables cs': 'CS',
        'qualite, logistique industrielle, organisation': 'QLIO',
        'qualite, logistique industrielle et organisation': 'QLIO',
        'qualite logistique industrielle et organisation': 'QLIO',
        # Avec préfixe ville non strippé (e.g. "MMI Champs", "Chimie Sète")
        'mmi champs': 'MMI',
        'mmi': 'MMI',
        "metier du multimedia et de l'internet": 'MMI',
        'genie mecanique et productique gmp': 'GMP',
        'chimie sete': 'CHIMIE',
        'informatique montpellier': 'INFO',
        'informatique sete': 'INFO',
        'gestion des entreprises et des administrations montpellier': 'GEA',
        'gestion des entreprises et des administrations sete': 'GEA',
    }

    def clean(name):
        s = normalize(name)
        s = re.sub(r'^b\.?u\.?t\.?\s+', '', s)
        # 'CODE – name' or 'CODE : name' au début
        s = re.sub(r'^([a-z0-9]{2,6})\s*[-:]\s*', '', s)
        s = re.sub(r'\s*\([^)]+\)\s*$', '', s)
        s = re.sub(r'\s*[-,]\s*(?:orientation|parcours)\s+\S+.*$', '', s)
        # suffixe ville ' a ville'
        s = re.sub(r'\s+a\s+\S+(?:\s+\S+)?$', '', s)
        s = re.sub(r'[-]', ' ', s)
        return re.sub(r'\s+', ' ', s).strip()

    def match(name):
        n = normalize(name)
        if n in spec_code_to_code: return spec_code_to_code[n]
        if n in spec_name_to_code: return spec_name_to_code[n]
        c = clean(name)
        if c in spec_name_to_code: return spec_name_to_code[c]
        if c in spec_code_to_code: return spec_code_to_code[c]
        if c in aliases:           return aliases[c]
        if n in aliases:           return aliases[n]
        # code dans parenthèses
        m = re.search(r'\(([a-z0-9]{2,6})\)', n)
        if m and m.group(1) in spec_code_to_code: return spec_code_to_code[m.group(1)]
        # 'BUT CODE :' au début
        m = re.match(r'^(?:but\s+)?([a-z0-9]{2,6})\s*[:-]', n)
        if m and m.group(1) in spec_code_to_code: return spec_code_to_code[m.group(1)]
        return None

    return match

# ── Correspondance parcours ───────────────────────────────────────────────────

def build_parc_matcher(data):
    """Retourne une fonction parc_full_name -> code (ou None si introuvable)."""
    def_to_code = {normalize(v['definition']): k
                   for k, v in data['intitule_parcours'].items()}
    # Version sans parenthèses (ex: IPI a "(parfois noté INNO)" qui gêne le Jaccard)
    def strip_parens(s):
        return re.sub(r'\s*\([^)]+\)\s*$', '', s).strip()
    stripped_def_to_code = {normalize(strip_parens(v['definition'])): k
                            for k, v in data['intitule_parcours'].items()}
    tok_to_code = {frozenset(tokens(strip_parens(v['definition']))): k
                   for k, v in data['intitule_parcours'].items()}

    aliases = {
        'animation sociale et socio-culturelle':           'ASSC',
        'animation sociale et socioculturelle':            'ASSC',
        'auromatisme et informatique industrielle':        'AII',  # typo source
        'automatisme et informatique industrielle':        'AII',
        'biologie medicale et biotechnologies':            'BMB',  # pluriel
        'bureaux d etudes et conception':                  'BEC',
        'bureaux d etudes, conception':                    'BEC',
        'bureaux d etudes conception':                     'BEC',
        "bureaux d'etudes conception":                     'BEC',
        'conception des procedes et innovation technologique': 'CPIT',
        'conception et production durable':                'CPD',
        'conception et productions durables':              'CPD',
        'controle qualite, environnement et securite des procedes':  'CQESP',
        'controle, qualite, environnement et securite des procedes': 'CQESP',
        'controle-qualite, environnement et securite des procedes':  'CQESP',
        'developpement web et dispositif interactif':      'DEV',
        'ingenierie des systemes pluri-techniques':        'ISP',
        'ingenierie des systemes pluri techniques':        'ISP',
        "innovation pour l industrie":                     'IPI',
        "innovation pour l'industrie":                     'IPI',
        'management des fonctions supports':               'MDFS',
        'management des fonctions support':                'MDFS',
        'mdfs : management des fonctions support':         'MDFS',
        'management des fonctions supports (comptabilite, droit, rh, management, rse, entrepreneuriat)': 'MDFS',
        'management, methodes et maintenances innovantes': '3MI',
        'management, methodes, maintenance innovantes':    '3MI',
        'management des process industriel':               'MPI',
        'management de la production':                     'MPI',
        'management responsable de projet':                'MRPE',
        'organisation et supply chain':                    'MPBS',
        'qualite et management integre':                   'QPSMI',
        'business international achat et vente':           'BIAV',
        'charge d affaires industrielles':                 'CAI',
        "charge d'affaires industrielles":                 'CAI',
        'sciences de l environnement et ecotechnologie':   'SEE',  # singulier
        "sciences de l'environnement et ecotechnologie":  'SEE',
        'sciences de l environnement et ecotechnologies':  'SEE',
        "sciences de l'environnement et ecotechnologies":  'SEE',
        'reseaux mobiles et internet des objets':          'IOM',
        'marketing digital, e-commerce et entrepreneuriat': 'MDEE',
        'marketing digital, e commerce et entrepreneuriat': 'MDEE',
        'management des activites culturelles, artisitiques, sportives et de tourisme': 'MACAST',  # typo
        'management des activites culturelles, artistiques, sportives et de tourisme': 'MACAST',
        # Pas de code équivalent dans data.json : on ignore silencieusement
        'management de la transformation digitale':        '__skip__',
        'management de la transformation':                 '__skip__',
        'but travaux publics et batiments':                '__skip__',  # donnée erronée dans recup
    }

    def clean(name):
        s = normalize(name)
        s = re.sub(r'\s*\([^)]+\)\s*$', '', s)
        s = re.sub(r'^but\s+', '', s)
        return re.sub(r'\s+', ' ', s).strip()

    def match(name):
        n = normalize(name)
        if n in def_to_code:         return def_to_code[n]
        if n in stripped_def_to_code: return stripped_def_to_code[n]
        c = clean(name)
        if c in def_to_code:         return def_to_code[c]
        if c in stripped_def_to_code: return stripped_def_to_code[c]
        if c in aliases:     return aliases[c]
        if n in aliases:     return aliases[n]
        # Token Jaccard similarity
        t = frozenset(tokens(name))
        if t in tok_to_code: return tok_to_code[t]
        best, best_j = None, 0
        for known_t, code in tok_to_code.items():
            inter = len(t & known_t)
            union = len(t | known_t)
            j = inter / union if union else 0
            if j > best_j and j >= 0.72:
                best_j, best = j, code
        return best

    return match

# ── Appariement IUT ───────────────────────────────────────────────────────────

def iut_score(data_iut, recup_iut):
    """Score de similarité entre deux IUTs."""
    dt = tokens(data_iut['ville'])  | tokens(data_iut['nom_iut'])
    rt = tokens(recup_iut['ville']) | tokens(recup_iut['nom_iut'])
    inter = len(dt & rt)
    union = len(dt | rt)
    return inter / union if union else 0

def name_only_score(data_iut, recup_iut):
    """Score basé uniquement sur le nom (pour fallback sans correspondance de ville)."""
    dt = tokens(data_iut['nom_iut'])
    rt = tokens(recup_iut['nom_iut'])
    inter = len(dt & rt)
    union = len(dt | rt)
    return inter / union if union else 0

def find_best_recup_iut(data_iut, recup_iuts, threshold=0.25, name_only=False):
    score_fn = name_only_score if name_only else iut_score
    scored = [(score_fn(data_iut, r), r) for r in recup_iuts]
    scored.sort(key=lambda x: -x[0])
    if scored and scored[0][0] >= threshold:
        return scored[0][1]
    return None

# ── Fusion principale ─────────────────────────────────────────────────────────

def merge(data, recup):
    spec_to_code = build_spec_matcher(data)
    parc_to_code = build_parc_matcher(data)

    recup_by_ville = defaultdict(list)
    for r in recup['iuts']:
        recup_by_ville[norm_ville(r['ville'])].append(r)
    all_recup = recup['iuts']

    matched = not_found = parc_unknown = 0

    for iut in data['iuts']:
        nv = norm_ville(iut['ville'])
        direct_candidates = recup_by_ville.get(nv, [])
        if direct_candidates:
            best = find_best_recup_iut(iut, direct_candidates, threshold=0.25)
        else:
            # Fallback global : d'abord par score combiné (seuil élevé)
            best = find_best_recup_iut(iut, all_recup, threshold=0.40)
            # Sinon, par nom seul (les villes diffèrent mais les noms se recoupent)
            if best is None:
                best = find_best_recup_iut(iut, all_recup, threshold=0.50, name_only=True)
        if best is None:
            not_found += 1
            continue

        matched += 1
        new_parcours = {}

        for spec_full, parc_list in best['parcours'].items():
            code = spec_to_code(spec_full)
            if code is None:
                print(f"  [WARN] specialite non reconnue : {spec_full!r}", file=sys.stderr)
                continue
            converted = []
            for p in parc_list:
                pc = parc_to_code(p)
                if pc == '__skip__':
                    pass
                elif pc is None:
                    parc_unknown += 1
                    print(f"  [WARN] parcours non reconnu : {p!r} (spec={spec_full})", file=sys.stderr)
                else:
                    converted.append(pc)
            if converted:
                new_parcours[code] = converted

        # Validation : au moins un code spécialité doit correspondre
        # Évite les faux positifs (ex: site satellite apparié au mauvais campus)
        iut_specs = set(iut.get('specialite', []))
        if new_parcours and iut_specs and not (iut_specs & set(new_parcours.keys())):
            not_found += 1
            matched -= 1
            continue

        if new_parcours:
            iut['parcours'] = new_parcours

    print(f"IUTs apparies : {matched}/{len(data['iuts'])} "
          f"(non trouves : {not_found}, parcours inconnus : {parc_unknown})",
          file=sys.stderr)


def main():
    with open(DATA_FILE,  encoding='utf-8') as f: data  = json.load(f)
    with open(RECUP_FILE, encoding='utf-8') as f: recup = json.load(f)

    merge(data, recup)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"data.json mis a jour -> {OUTPUT_FILE}", file=sys.stderr)


if __name__ == '__main__':
    main()
