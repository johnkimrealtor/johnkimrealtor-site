"""Shared config + TRREB column mapping. Extend ALIASES if your export uses other headers."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ART_DIR = ROOT / "artifacts"

# canonical name -> possible header names in a TRREB/Matrix export (compared case-insensitively)
ALIASES = {
    # (TRREB Matrix export names ... then PropTx/RESO API names, all lowercase)
    "mls": ["ml num", "mls#", "mls", "listingkey"],
    "address": ["address", "unparsedaddress"],
    "unit": ["apt/unit no", "unit", "unitnumber"],
    "municipality": ["municipality", "city"],
    "community": ["cityregion", "community", "neighbourhood"],
    "postal_code": ["postal code", "postalcode"],
    "prop_type": ["propertysubtype", "type", "property type", "style"],
    "beds": ["bedroomsabovegrade", "br", "bedrooms"],
    "beds_plus": ["bedroomsbelowgrade", "br plus"],
    "baths": ["bathroomstotalinteger", "bath tot", "bathrooms"],
    "sqft": ["buildingareatotal", "sqft", "square footage"],
    "sqft_range": ["livingarearange"],
    "sqft_units": ["buildingareaunits"],
    "lot_front": ["lotwidth", "lot front"],
    "lot_depth": ["lotdepth", "lot depth"],
    "lot_units": ["lotsizeunits"],
    "basement": ["basement", "bsmt1 out"],
    "garage": ["garagetype", "gar spaces"],
    "parking": ["parkingtotal", "park spcs"],
    "age": ["approximateage", "age"],
    "year_built": ["yr built", "year built"],
    "maint_fee": ["associationfee", "maint"],
    "locker": ["locker"],
    "exposure": ["exposure"],
    "list_price": ["listprice", "lp dol", "list price"],
    "orig_list_price": ["originallistprice"],
    "sold_price": ["closeprice", "sp dol", "sold price"],
    "dom": ["daysonmarket", "dom"],
    "sold_date": ["purchasecontractdate", "sold date", "cd"],   # contract date = when the price was really set
    "close_date": ["closedate", "close date"],
    "status": ["standardstatus"],
    "transaction": ["transactiontype"],
}

HOUSE_TYPES = {"detached", "semi", "townhouse"}
CONDO_TYPES = {"condo", "condo_th"}
SEGMENTS = ("house", "condo")


def segment_of(prop_type: str) -> str:
    return "house" if prop_type in HOUSE_TYPES else "condo"
