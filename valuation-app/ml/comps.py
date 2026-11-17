"""Comparable-sales ranking. Priority: same building (condo) > same street (house) > same postal code > FSA > community.
Prices are time-adjusted to today with the segment index so a 14-month-old sale is comparable to a fresh one."""
from __future__ import annotations
import os
from urllib.parse import quote
import numpy as np
import pandas as pd

# HouseSigma has no public address deep-link API that we can rely on. Override with the real pattern/partner URL
# via env var once confirmed. {q} = url-encoded "address, Toronto".
HOUSESIGMA_URL = os.getenv("HOUSESIGMA_URL_TEMPLATE", "https://housesigma.com/web/en/search?keyword={q}")


def housesigma_url(address: str, unit: str | float = "") -> str:
    u = f"{unit} - " if isinstance(unit, str) and unit and unit != "nan" else ""
    return HOUSESIGMA_URL.format(q=quote(f"{u}{address}, Toronto"))


def tier(sub: dict, row: pd.DataFrame, seg: str) -> pd.Series:
    """0 same building | .4 same street | .8 same postal6 | 1.6 same FSA(+type) | 2.6 same community | 4 other."""
    t = pd.Series(4.0, index=row.index)
    t[row["community"] == sub["community"]] = 2.6
    t[row["fsa"] == sub["fsa"]] = 1.6
    if sub["postal6"]:
        t[row["postal6"] == sub["postal6"]] = 0.8
    if seg == "condo":
        if sub["building_key"]:
            t[row["building_key"] == sub["building_key"]] = 0.0
    elif sub["street"]:
        t[row["street_key"] == sub["street_key"]] = 0.4
    return t


def find_comps(sub: dict, seg: str, pool: pd.DataFrame, idx: pd.Series, now_idx: float, k: int = 8,
               max_months: int = 18) -> pd.DataFrame:
    d = pool[(pool["segment"] == seg)].copy()
    latest = d["sold_date"].max()
    d = d[d["sold_date"] >= latest - pd.DateOffset(months=max_months)]
    if seg == "house":
        d = d[d["prop_type"] == sub["prop_type"]] if (d["prop_type"] == sub["prop_type"]).sum() >= 8 else d
    else:
        d = d[d["prop_type"] == sub["prop_type"]] if (d["prop_type"] == sub["prop_type"]).sum() >= 8 else d
    d["tier"] = tier(sub, d, seg)
    d = d[d["tier"] < 4.0]
    if d.empty:
        return d
    months_ago = (latest - d["sold_date"]).dt.days / 30.4
    sc = d["tier"].copy()
    sc += 0.8 * (d["beds"].fillna(sub["beds"]) - sub["beds"]).abs()
    sc += 0.5 * (d["baths"].fillna(sub["baths"]) - sub["baths"]).abs()
    if sub.get("sqft"):
        sc += 6.0 * np.log(d["sqft"].fillna(sub["sqft"]) / sub["sqft"]).abs()
    if seg == "house":
        if sub.get("lot_front") and sub.get("lot_depth"):
            la = d["lot_area"].fillna(sub["lot_front"] * sub["lot_depth"])
            sc += 1.5 * np.log(la / (sub["lot_front"] * sub["lot_depth"])).abs()
        sc += 0.5 * (d["bsmt_fin"] != int(sub.get("bsmt_fin", 0)))
        sc += 0.3 * (d["age"].fillna(sub.get("age") or 40) - (sub.get("age") or 40)).abs() / 20
    else:
        sc += 0.3 * (d["parking"].fillna(0) - sub.get("parking", 0)).abs()
        sc += 0.2 * (d["locker"] != int(sub.get("locker", 0)))
    sc += 0.08 * months_ago
    d["score"] = sc
    d["adj_price"] = np.exp(np.log(d["sold_price"]) + (now_idx - d["month"].map(idx)))
    d["similarity"] = (100 * np.exp(-d["score"] / 4.0)).round(0)
    top = d.sort_values("score").head(k)
    return top


def comp_records(top: pd.DataFrame) -> list[dict]:
    out = []
    for _, r in top.iterrows():
        unit = r.get("unit", "")
        out.append({
            "address": f"{r['address']}", "unit": "" if pd.isna(unit) else str(unit),
            "prop_type": r["prop_type"], "sold_price": int(r["sold_price"]), "adj_price": int(round(r["adj_price"], -2)),
            "sold_date": r["sold_date"].strftime("%Y-%m-%d"), "list_price": None if pd.isna(r.get("list_price")) else int(r["list_price"]),
            "dom": None if pd.isna(r.get("dom")) else int(r["dom"]),
            "beds": None if pd.isna(r["beds"]) else float(r["beds"]), "baths": None if pd.isna(r["baths"]) else float(r["baths"]),
            "sqft": None if pd.isna(r["sqft"]) else int(r["sqft"]),
            "match": {0.0: "same building", 0.4: "same street", 0.8: "same postal code",
                      1.6: "same area (FSA)", 2.6: "same neighbourhood"}.get(float(r["tier"]), "nearby"),
            "similarity": int(r["similarity"]),
            "housesigma_url": housesigma_url(r["address"], r.get("unit", "")),
        })
    return out
