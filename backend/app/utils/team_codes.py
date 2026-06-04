"""FIFA-style country codes for schedule import and flagcdn."""

from __future__ import annotations

import re

# Display name (schedule JSON) -> ISO 3166-1 alpha-2 for flagcdn
TEAM_NAME_TO_CODE: dict[str, str] = {
    "Mexico": "mx",
    "South Africa": "za",
    "South Korea": "kr",
    "Czech Republic": "cz",
    "Canada": "ca",
    "Bosnia & Herzegovina": "ba",
    "Qatar": "qa",
    "Switzerland": "ch",
    "Brazil": "br",
    "Morocco": "ma",
    "Haiti": "ht",
    "Scotland": "gb",
    "USA": "us",
    "Paraguay": "py",
    "Australia": "au",
    "Turkey": "tr",
    "Germany": "de",
    "Curaçao": "cw",
    "Ivory Coast": "ci",
    "Ecuador": "ec",
    "Netherlands": "nl",
    "Japan": "jp",
    "Sweden": "se",
    "Tunisia": "tn",
    "Belgium": "be",
    "Egypt": "eg",
    "Iran": "ir",
    "New Zealand": "nz",
    "Spain": "es",
    "Cape Verde": "cv",
    "Saudi Arabia": "sa",
    "Uruguay": "uy",
    "France": "fr",
    "Senegal": "sn",
    "Iraq": "iq",
    "Norway": "no",
    "Argentina": "ar",
    "Algeria": "dz",
    "Austria": "at",
    "Jordan": "jo",
    "Portugal": "pt",
    "DR Congo": "cd",
    "Uzbekistan": "uz",
    "Colombia": "co",
    "England": "gb",
    "Croatia": "hr",
    "Ghana": "gh",
    "Panama": "pa",
    "Chile": "cl",
}

_PLACEHOLDER = re.compile(
    r"^("
    r"[12][A-L]|"
    r"W\d+|L\d+|"
    r"3[A-L](/[A-L])+|"
    r"3[A-L]/[A-L]/[A-L]/[A-L]/[A-L]"
    r")$",
    re.IGNORECASE,
)


def is_placeholder_team(name: str) -> bool:
    n = name.strip()
    if not n:
        return True
    if _PLACEHOLDER.match(n):
        return True
    if "/" in n:
        return True
    return n not in TEAM_NAME_TO_CODE


def team_display_code(name: str) -> str:
    n = name.strip()
    if is_placeholder_team(n):
        slug = re.sub(r"[^a-z0-9]", "", n.lower())[:8] or "tbd"
        return slug
    return TEAM_NAME_TO_CODE[n]
