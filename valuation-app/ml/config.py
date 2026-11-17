"""Shared config + TRREB column mapping. Extend ALIASES if your export uses other headers."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ART_DIR = ROOT / "artifacts"

# canonical name -> possible header names in a TRREB/Matrix export (compared case-insensitively)
ALIASES = {
    "mls": ["ml num", "mls#", "mls", "mls number", "listing id"],
    "address": ["address", "full address", "street address"],
    "unit": ["apt/unit no", "unit", "unit no", "apt"],
    "municipality": ["municipality", "city", "municipality district"],
    "community": ["community", "neighbourhood", "area"],
    "postal_code": ["postal code", "zip", "postal"],
    "prop_type": ["type", "property type", "style", "prop type"],
    "beds": ["br", "bedrooms", "beds", "bedrooms above grade"],
    "beds_plus": ["br plus", "bedrooms plus", "den", "beds plus"],
    "baths": ["bath tot", "bathrooms", "baths", "washrooms"],
    "sqft": ["sqft", "square footage", "living area", "sq ft", "approx sqft"],
    "lot_front": ["lot front", "frontage", "lot width"],
    "lot_depth": ["lot depth", "depth"],
    "basement": ["bsmt1 out", "basement", "basement1", "basement type"],
    "garage": ["gar spaces", "garage spaces", "garage"],
    "parking": ["park spcs", "parking spaces", "parking total", "parking"],
    "age": ["age", "approx age", "yr built age"],
    "year_built": ["yr built", "year built"],
    "maint_fee": ["maint", "maintenance fee", "maint fee", "condo fee"],
    "locker": ["locker"],
    "exposure": ["exposure", "unit exposure"],
    "list_price": ["lp dol", "list price", "lp$", "original price"],
    "sold_price": ["sp dol", "sold price", "sp$", "sale price"],
    "dom": ["dom", "days on market"],
    "sold_date": ["sold date", "cd", "close date", "sale date", "closing date"],
}

HOUSE_TYPES = {"detached", "semi", "townhouse"}
CONDO_TYPES = {"condo", "condo_th"}
SEGMENTS = ("house", "condo")


def segment_of(prop_type: str) -> str:
    return "house" if prop_type in HOUSE_TYPES else "condo"
