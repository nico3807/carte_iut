"""
recup_parcours.py
-----------------
Récupère, pour tous les IUT listés sur https://www.iut.fr,
le nom de l'IUT, ses spécialités (départements) et leurs parcours,
puis enregistre le résultat dans recup_parcours.json.

Format de sortie :
[
  {
    "nom_iut": "IUT Lyon 3 Jean Moulin",
    "specialite": "Carrières Juridiques",
    "parcours": [
      "Administration et justice",
      "Patrimoine et finance",
      "Entreprise et association"
    ]
  },
  ...
]
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_URL = "https://www.iut.fr"
LIST_ENDPOINT = f"{BASE_URL}/wp-json/wp/v2/fiche_iuts"
OUTPUT_FILE = Path("recup_parcours.json")
CACHE_DIR = Path("cache_iuts_html")
USER_AGENT = (
    "Mozilla/5.0 (compatible; IUT-Parcours-Scraper/1.0; "
    "+contact: votre.email@example.com)"
)
REQUEST_DELAY_SEC = 0.5      # politesse entre 2 requêtes HTML
TIMEOUT = 30                 # secondes
PER_PAGE = 100

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("recup_parcours")


# ---------------------------------------------------------------------------
# Session HTTP avec retries automatiques
# ---------------------------------------------------------------------------
def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "fr,en;q=0.7"})
    retry = Retry(
        total=4,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET",),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


# ---------------------------------------------------------------------------
# Étape 1 : Lister tous les IUT via l'API REST WordPress
# ---------------------------------------------------------------------------
def fetch_all_iuts(session: requests.Session) -> list[dict[str, Any]]:
    iuts: list[dict[str, Any]] = []
    page = 1
    while True:
        params = {
            "per_page": PER_PAGE,
            "page": page,
            "_fields": "id,slug,link,title",
        }
        log.info("Récupération de la liste des IUT - page %d", page)
        r = session.get(LIST_ENDPOINT, params=params, timeout=TIMEOUT)
        if r.status_code == 400:
            # WordPress renvoie 400 quand on dépasse le nombre de pages
            break
        r.raise_for_status()
        batch = r.json()
        if not batch:
            break
        iuts.extend(batch)
        total_pages = int(r.headers.get("X-WP-TotalPages", "1"))
        if page >= total_pages:
            break
        page += 1
        time.sleep(REQUEST_DELAY_SEC)
    log.info("Nombre d'IUT trouvés : %d", len(iuts))
    return iuts


# ---------------------------------------------------------------------------
# Étape 2 : Récupérer le HTML d'une fiche IUT (avec cache local)
# ---------------------------------------------------------------------------
def get_iut_html(session: requests.Session, slug: str, url: str) -> str:
    CACHE_DIR.mkdir(exist_ok=True)
    cache_file = CACHE_DIR / f"{slug}.html"
    if cache_file.exists():
        return cache_file.read_text(encoding="utf-8")

    log.info("  -> téléchargement %s", url)
    r = session.get(url, timeout=TIMEOUT)
    r.raise_for_status()
    cache_file.write_text(r.text, encoding="utf-8")
    time.sleep(REQUEST_DELAY_SEC)
    return r.text


# ---------------------------------------------------------------------------
# Étape 3 : Parser une fiche IUT et extraire spécialités + parcours
# ---------------------------------------------------------------------------
def parse_iut_html(html: str) -> list[dict[str, Any]]:
    """
    Retourne une liste {specialite, parcours[]} extraite du HTML d'un IUT.
    Les blocs sans parcours (laboratoires, etc.) sont écartés.
    Les doublons sont fusionnés.
    """
    soup = BeautifulSoup(html, "html.parser")
    fusion: dict[str, list[str]] = {}

    for bloc in soup.select(".sitedepartementdetails"):
        h3 = bloc.find("h3")
        if not h3:
            continue
        nom = re.sub(r"^\s*Département\s*", "", h3.get_text(strip=True)).strip()
        if not nom:
            continue

        parcours: list[str] = []
        for ul in bloc.select("ul.uk-list"):
            if "Parcours" not in ul.get_text():
                continue
            for li in ul.select("li li"):
                txt = li.get_text(" ", strip=True)
                # nettoyage : espaces multiples, puces résiduelles
                txt = re.sub(r"\s+", " ", txt).strip(" •-–")
                if txt and txt not in parcours:
                    parcours.append(txt)

        # On ignore les blocs sans aucun parcours (souvent des labos)
        if not parcours:
            continue

        # Fusion en cas de doublon (clé : nom normalisé)
        key = nom.lower()
        existing = fusion.setdefault(key, [])
        for p in parcours:
            if p not in existing:
                existing.append(p)
        # Conserver le libellé original le plus long pour l'affichage
        # (utile si un même département a deux variantes de casse)
        fusion.setdefault(f"__label__{key}", nom)
        if len(nom) > len(fusion[f"__label__{key}"]):
            fusion[f"__label__{key}"] = nom

    resultat = []
    for key, parcours in fusion.items():
        if key.startswith("__label__"):
            continue
        label = fusion.get(f"__label__{key}", key)
        resultat.append({"specialite": label, "parcours": parcours})
    return resultat


# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------
def main() -> None:
    session = make_session()
    iuts = fetch_all_iuts(session)

    sortie: list[dict[str, Any]] = []
    for i, iut in enumerate(iuts, 1):
        nom_iut = BeautifulSoup(iut["title"]["rendered"], "html.parser").get_text(strip=True)
        url = iut["link"]
        slug = iut["slug"]
        log.info("[%d/%d] %s", i, len(iuts), nom_iut)
        try:
            html = get_iut_html(session, slug, url)
            specialites = parse_iut_html(html)
        except Exception as exc:  # noqa: BLE001
            log.error("  Erreur sur %s : %s", url, exc)
            continue

        for spec in specialites:
            sortie.append(
                {
                    "nom_iut": nom_iut,
                    "specialite": spec["specialite"],
                    "parcours": spec["parcours"],
                }
            )

    OUTPUT_FILE.write_text(
        json.dumps(sortie, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    log.info(
        "Terminé. %d entrées (IUT × spécialité) écrites dans %s",
        len(sortie),
        OUTPUT_FILE.resolve(),
    )


if __name__ == "__main__":
    main()