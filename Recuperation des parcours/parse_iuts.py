#!/usr/bin/env python3
"""
parse_iuts.py
-------------
Parcourt tous les fichiers HTML du dossier cache_iuts_html/,
extrait pour chaque site IUT :
  - nom de l'IUT (depuis la card)
  - ville (depuis la card)
  - spécialités BUT en Formation initiale
  - parcours associés

Résultat écrit dans recup_parcours.json.
"""

import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

# ── Configuration ────────────────────────────────────────────────────────────

INPUT_DIR  = Path(__file__).parent / "cache_iuts_html"   # dossier contenant les fichiers HTML
OUTPUT_FILE = Path("recup_parcours.json")  # fichier JSON de sortie

# ── Fonctions ────────────────────────────────────────────────────────────────

def extract_cards(soup):
    """
    Retourne la liste des cards présentes dans la page :
      [{'anchor': 'site0', 'nom': '...', 'ville': '...'}]
    """
    cards = []
    for card in soup.select(".widget_widget_iutsitegrid a.el-item"):
        anchor = card.get("href", "").lstrip("#")
        title_el = card.select_one("h3 span")
        nom = title_el.get_text(strip=True) if title_el else ""
        p = card.select_one(".el-content p")
        strongs = p.find_all("strong") if p else []
        # La ville est dans le dernier <strong> du bloc adresse
        ville = strongs[-1].get_text(strip=True) if strongs else ""
        # On ignore les doublons : une même ancre (#siteN) ne doit
        # produire qu'une seule entrée, même si plusieurs cards y pointent.
        if anchor and not any(c["anchor"] == anchor for c in cards):
            cards.append({"anchor": anchor, "nom": nom, "ville": ville})
    return cards


def extract_site_sections(soup):
    """
    Construit un dict {site_id: BeautifulSoup_element}
    en associant chaque ancre #siteN à son bloc .sitedetails.
    """
    sections = {}
    widget = soup.find("div", id="widget-iut-sites-details")
    if not widget:
        return sections
    for div in widget.find_all("div", id=re.compile(r"^site\d+$")):
        sitedetails = div.find_next_sibling("div", class_="sitedetails")
        if sitedetails:
            sections[div["id"]] = sitedetails
    return sections


def extract_specialites(sitedetails):
    """
    Pour un bloc .sitedetails donné, retourne un dict :
      { 'Nom spécialité': ['Parcours 1', 'Parcours 2', ...] }

    Seuls les blocs "Diplôme BUT" avec modalité "Formation initiale" sont retenus.
    """
    result = {}
    for dept in sitedetails.find_all("div", class_="sitedepartementdetails"):
        for diplome in dept.find_all("div", class_="sitedepartementdiplome"):

            # 1. Doit porter le label "Diplôme BUT"
            label = diplome.find("span", class_="uk-label-success")
            if not label or "BUT" not in label.get_text():
                continue

            # 2. Doit contenir "Formation initiale"
            has_fi = any(
                "Formation initiale" in panel.get_text()
                for panel in diplome.find_all("div", class_="uk-panel")
            )
            if not has_fi:
                continue

            # 3. Nom de la spécialité
            h4 = diplome.find("h4", class_="uk-font-tertiary")
            if not h4:
                continue
            specialite = h4.get_text(strip=True)

            # 4. Parcours (liste ordonnée)
            ol = diplome.find("ol")
            parcours = (
                [li.get_text(strip=True) for li in ol.find_all("li")]
                if ol else []
            )

            result[specialite] = parcours
    return result


def process_file(html_path: Path, id_offset: int):
    """
    Traite un fichier HTML et retourne la liste des entrées IUT extraites.
    id_offset : valeur de départ pour les ids de cette page.
    """
    with open(html_path, encoding="utf-8") as f:
        soup = BeautifulSoup(f.read(), "html.parser")

    cards    = extract_cards(soup)
    sections = extract_site_sections(soup)

    entries = []
    for i, card in enumerate(cards):
        anchor    = card["anchor"]
        specs_dict = extract_specialites(sections[anchor]) if anchor in sections else {}
        entries.append({
            "id":        id_offset + i,
            "ville":     card["ville"],
            "nom_iut":   card["nom"],
            "specialite": list(specs_dict.keys()),
            "parcours":  specs_dict,
        })
    return entries


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    if not INPUT_DIR.exists():
        print(f"[ERREUR] Dossier introuvable : {INPUT_DIR.resolve()}", file=sys.stderr)
        sys.exit(1)

    html_files = sorted(INPUT_DIR.glob("*.html"))
    if not html_files:
        print(f"[AVERTISSEMENT] Aucun fichier .html trouvé dans {INPUT_DIR}/", file=sys.stderr)
        sys.exit(0)

    print(f"{len(html_files)} fichier(s) HTML trouvé(s) dans '{INPUT_DIR}/'")

    all_iuts = []
    id_counter = 1

    for html_path in html_files:
        print(f"  → {html_path.name} … ", end="", flush=True)
        try:
            entries = process_file(html_path, id_offset=id_counter)
            all_iuts.extend(entries)
            id_counter += len(entries)
            print(f"{len(entries)} site(s) extrait(s)")
        except Exception as e:
            print(f"ERREUR : {e}", file=sys.stderr)

    output = {"iuts": all_iuts}
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n✓ {len(all_iuts)} entrée(s) écrite(s) dans '{OUTPUT_FILE}'")


if __name__ == "__main__":
    main()