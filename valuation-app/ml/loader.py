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
    if "lease" in s or "vacant" in s or "multi" in s or "plex" in s or "farm" in s or "co-op" in s or "locker" in s \
            or "parking" in s or "time" in s:
        return None
    if "semi" in s:
        return "semi"
    if "link" in s or ("detach" in s and "condo" not in s):
        return "detached"
    if "condo" in s and "town" in s:
        return "condo_th"
    if "condo" in s or "apt" in s or "co-ownership" in s:
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


WANTED = {n for names in ALIASES.values() for n in names}


def _age(v):
    if pd.isna(v):
        return np.nan
    s = str(v).lower()
    if "new" in s:
        return 0.0
    return _range_mid(s)


def _garage(v):
    if pd.isna(v):
        return 0.0
    s = str(v).strip().lower()
    try:
        return float(s)
    except ValueError:
        return 0.0 if s in ("", "none", "nan", "n/a") else 1.0


STRIP_UNIT = re.compile(r"^\s*(?:(?:UNIT|APT|SUITE|#)\s*[A-Z0-9]+\s+|[A-Z0-9]+\s+-\s+)(?=\d)", re.I)


def load_sold(paths: list[str | Path], months: int = 24) -> pd.DataFrame:
    frames = []
    for p in paths:
        raw = pd.read_csv(p, low_memory=False, usecols=lambda c: c.lower().strip() in WANTED)
        frames.append(rename_columns(raw))
    df = pd.concat(frames, ignore_index=True)
    for need in ("address", "prop_type", "sold_price"):
        if need not in df.columns:
            raise ValueError(f"required column '{need}' not found; extend ml/config.py ALIASES. Got: {list(df.columns)}")

    n0 = len(df)
    if "transaction" in df.columns:
        df = df[~df["transaction"].astype(str).str.contains("lease|rent", case=False, na=False)]
    if "municipality" in df.columns:
        df = df[df["municipality"].astype(str).str.contains("toronto", case=False, na=False)]
    df["prop_type"] = df["prop_type"].map(map_type)
    df = df[df["prop_type"].notna()].copy()
    df["sold_price"] = _num(df["sold_price"].astype(str).str.replace(r"[$,]", "", regex=True))
    sd = pd.to_datetime(df["sold_date"], errors="coerce") if "sold_date" in df.columns else pd.Series(pd.NaT, index=df.index)
    if "close_date" in df.columns:
        sd = sd.fillna(pd.to_datetime(df["close_date"], errors="coerce"))
    df["sold_date"] = sd.dt.tz_localize(None) if getattr(sd.dt, "tz", None) is not None else sd
    df = df[(df["sold_price"] > 100_000) & df["sold_date"].notna()]
    if "mls" in df.columns:
        df = df.drop_duplicates("mls", keep="last")
    df = df[df["sold_date"] >= df["sold_date"].max() - pd.DateOffset(months=months)]

    for c in ("beds", "beds_plus", "baths", "lot_front", "lot_depth", "parking", "year_built",
              "maint_fee", "list_price", "orig_list_price", "dom"):
        df[c] = _num(df[c].astype(str).str.replace(r"[$,]", "", regex=True)) if c in df.columns else np.nan
    # square footage: exact building area if present (convert m2), else the listing's range midpoint
    exact = _num(df["sqft"]) if "sqft" in df.columns else pd.Series(np.nan, index=df.index)
    if "sqft_units" in df.columns:
        exact = exact.where(~df["sqft_units"].astype(str).str.contains("met", case=False, na=False), exact * 10.764)
    rng_mid = df["sqft_range"].map(_range_mid) if "sqft_range" in df.columns else np.nan
    df["sqft"] = exact.where(exact > 100).fillna(rng_mid)
    # lot size to feet
    if "lot_units" in df.columns:
        m = df["lot_units"].astype(str).str.contains("met", case=False, na=False)
        df.loc[m, ["lot_front", "lot_depth"]] = df.loc[m, ["lot_front", "lot_depth"]] * 3.281
    df["age"] = df["age"].map(_age) if "age" in df.columns else np.nan
    if df["age"].isna().all() and df["year_built"].notna().any():
        df["age"] = df["sold_date"].dt.year - df["year_built"]
    df["age"] = df["age"].clip(0, 200)
    df["garage"] = df["garage"].map(_garage) if "garage" in df.columns else 0.0

    bs = df["basement"].astype(str).str.lower() if "basement" in df.columns else pd.Series("", index=df.index)
    df["bsmt_apt"] = bs.str.contains("apartment|separate|walk-up|walk up|in-law").astype(int)
    df["bsmt_fin"] = (bs.str.contains("finish|apartment|rec") | (df["bsmt_apt"] == 1)).astype(int)
    df["locker"] = (df["locker"].astype(str).str.lower().isin(["owned", "exclusive", "ensuite", "yes", "y", "1"])).astype(int) \
        if "locker" in df.columns else 0
    df["exposure"] = df["exposure"].astype(str).str.upper().str[0].where(lambda x: x.isin(list("NESW")), "") \
        if "exposure" in df.columns else ""

    # "905 - 12 Main St, Toronto, ON M4E 1A1" -> "12 Main St"
    df["address"] = df["address"].astype(str).str.split(",").str[0].str.replace(STRIP_UNIT, "", regex=True).str.strip()
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

    # drop data-entry errors / non-arm's-length oddities
    ppsf = df["sold_price"] / df["sqft"]
    bad = ppsf.notna() & ((ppsf < 150) | (ppsf > 4000))
    if "list_price" in df.columns:
        r = df["sold_price"] / df["list_price"]
        bad |= r.notna() & ((r < 0.6) | (r > 1.6))
    df = df[~bad]
    df["month"] = df["sold_date"].dt.to_period("M").dt.to_timestamp()
    print(f"[load] {n0:,} raw rows -> {len(df):,} Toronto sold in last {months} months")
    print(df["prop_type"].value_counts().to_string())
    return df.sort_values("sold_date").reset_index(drop=True)
