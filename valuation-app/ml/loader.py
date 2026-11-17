"""Load + clean TRREB sold exports into one canonical DataFrame (City of Toronto only)."""
from __future__ import annotations
import re
from pathlib import Path
import numpy as np
import pandas as pd
from .config import ALIASES

ABBR = {"STREET": "ST", "AVENUE": "AVE", "ROAD": "RD", "DRIVE": "DR", "BOULEVARD": "BLVD", "COURT": "CRT",
        "CRESCENT": "CRES", "LANE": "LN", "PLACE": "PL", "TERRACE": "TER", "SQUARE": "SQ", "WEST": "W",
        "EAST": "E", "NORTH": "N", "SOUTH": "S"}


def parse_address(addr: str) -> tuple[str, str]:
    """-> (street_no, street_name) normalised, e.g. '12 Main Street W, Unit 5' -> ('12','MAIN ST W')."""
    a = re.sub(r"[.,#]", " ", str(addr or "").upper())
    a = re.split(r"\b(UNIT|APT|SUITE|PH|LPH)\b", a)[0]
    m = re.match(r"\s*(\d+[A-Z]?)\s+(.+)", a)
    if not m:
        return "", re.sub(r"\s+", " ", a).strip()
    no, rest = m.group(1), m.group(2)
    rest = " ".join(ABBR.get(w, w) for w in rest.split())
    return no, rest


def norm_postal(p) -> str:
    return re.sub(r"\s+", "", str(p or "")).upper()


def _num(s):
    return pd.to_numeric(s, errors="coerce")


def _range_mid(v):
    """'1500-2000' -> 1750 ; '1500' -> 1500 ; '<700' / '700-1100' also handled."""
    if pd.isna(v):
        return np.nan
    s = str(v).replace(",", "")
    nums = [float(x) for x in re.findall(r"\d+\.?\d*", s)]
    return float(np.mean(nums)) if nums else np.nan


def map_type(v: str) -> str | None:
    s = str(v).lower()
    if "semi" in s:
        return "semi"
    if "detach" in s and "semi" not in s:
        return "detached"
    if "condo" in s and ("town" in s or "th" in s.split()):
        return "condo_th"
    if "condo" in s or "apt" in s:
        return "condo"
    if "town" in s or "row" in s:
        return "townhouse"
    return None


def rename_columns(df: pd.DataFrame) -> pd.DataFrame:
    low = {c.lower().strip(): c for c in df.columns}
    out = {}
    for canon, names in ALIASES.items():
        for n in names:
            if n in low:
                out[low[n]] = canon
                break
    return df.rename(columns=out)[list(dict.fromkeys(out.values()))]


def load_sold(paths: list[str | Path]) -> pd.DataFrame:
    frames = []
    for p in paths:
        raw = pd.read_csv(p, low_memory=False)
        frames.append(rename_columns(raw))
    df = pd.concat(frames, ignore_index=True)
    for need in ("address", "prop_type", "sold_price", "sold_date"):
        if need not in df.columns:
            raise ValueError(f"required column '{need}' not found; extend ml/config.py ALIASES. Got: {list(df.columns)}")

    if "municipality" in df.columns:
        df = df[df["municipality"].astype(str).str.contains("toronto", case=False, na=False)]
    df["prop_type"] = df["prop_type"].map(map_type)
    df = df[df["prop_type"].notna()].copy()
    df["sold_price"] = _num(df["sold_price"].astype(str).str.replace(r"[$,]", "", regex=True))
    df["sold_date"] = pd.to_datetime(df["sold_date"], errors="coerce")
    df = df[(df["sold_price"] > 100_000) & df["sold_date"].notna()]
    if "mls" in df.columns:
        df = df.drop_duplicates("mls", keep="last")

    for c in ("beds", "beds_plus", "baths", "lot_front", "lot_depth", "garage", "parking", "age",
              "year_built", "maint_fee", "list_price", "dom"):
        df[c] = _num(df[c].astype(str).str.replace(r"[$,]", "", regex=True)) if c in df.columns else np.nan
    df["sqft"] = df["sqft"].map(_range_mid) if "sqft" in df.columns else np.nan
    if df["age"].isna().all() and df["year_built"].notna().any():
        df["age"] = df["sold_date"].dt.year - df["year_built"]
    df["age"] = df["age"].clip(0, 200)

    bs = df["basement"].astype(str).str.lower() if "basement" in df.columns else pd.Series("", index=df.index)
    df["bsmt_apt"] = bs.str.contains("apartment|separate|walk-up|walk up").astype(int)
    df["bsmt_fin"] = (bs.str.contains("finish|apartment|rec") | (df["bsmt_apt"] == 1)).astype(int)
    df["locker"] = (df["locker"].astype(str).str.lower().isin(["owned", "exclusive", "yes", "y", "1"])).astype(int) \
        if "locker" in df.columns else 0
    df["exposure"] = df["exposure"].astype(str).str.upper().str[:1] if "exposure" in df.columns else ""

    no_st = df["address"].map(parse_address)
    df["street_no"] = no_st.str[0]
    df["street"] = no_st.str[1]
    df["postal_code"] = df["postal_code"].map(norm_postal) if "postal_code" in df.columns else ""
    df["fsa"] = df["postal_code"].str[:3]
    df["postal6"] = df["postal_code"]
    df["community"] = df["community"].astype(str).str.strip() if "community" in df.columns else ""
    df["building_key"] = np.where(df["prop_type"].isin(["condo", "condo_th"]),
                                  df["street_no"] + " " + df["street"], "")
    df["street_key"] = df["street"] + "|" + df["prop_type"]
    df["fsa_type"] = df["fsa"] + "|" + df["prop_type"]

    # sanity filters on $/sqft to drop data-entry errors
    ppsf = df["sold_price"] / df["sqft"]
    bad = ppsf.notna() & ((ppsf < 150) | (ppsf > 4000))
    df = df[~bad]
    df["month"] = df["sold_date"].dt.to_period("M").dt.to_timestamp()
    return df.sort_values("sold_date").reset_index(drop=True)
