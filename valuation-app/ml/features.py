"""Feature engineering shared by training and live inference.

Design (matters because we only have ~2 years):
 1. Stage-1 hedonic ridge per segment -> monthly price INDEX (captures market trend + seasonality explicitly).
 2. Stage-2 LightGBM predicts  y = log(price) - index[month]  (so trees never have to extrapolate a trend).
 3. "Local stats": mean y of the previous <=5 sales in the same building / street / postal code / FSA+type,
    computed strictly from earlier sales (no leakage). This is what makes same-building / same-street sales dominate.
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

TYPE_CODE = {"detached": 0, "semi": 1, "townhouse": 2, "condo": 3, "condo_th": 4}
EXPO_CODE = {"": -1, "N": 0, "E": 1, "S": 2, "W": 3}
LOCAL_KEYS = {"house": ["street_key", "postal6", "fsa_type"], "condo": ["building_key", "postal6", "fsa_type"]}
LAST_N = 5

NUM_BASE = ["beds", "beds_plus", "baths", "log_sqft", "age", "parking"]
NUM_HOUSE = NUM_BASE + ["lot_front", "lot_depth", "lot_area", "garage", "bsmt_fin", "bsmt_apt"]
NUM_CONDO = NUM_BASE + ["maint_fee", "locker", "expo"]


def add_basic(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    for c in ("beds", "beds_plus", "baths", "sqft", "age", "parking", "lot_front", "lot_depth", "garage",
              "maint_fee", "bsmt_fin", "bsmt_apt", "locker"):
        if c not in d:
            d[c] = np.nan
    d["log_sqft"] = np.log(d["sqft"].where(d["sqft"] > 100))
    d["lot_area"] = d["lot_front"] * d["lot_depth"]
    d["type_code"] = d["prop_type"].map(TYPE_CODE)
    d["expo"] = d.get("exposure", pd.Series("", index=d.index)).fillna("").map(EXPO_CODE).fillna(-1)
    d["moy_sin"] = np.sin(2 * np.pi * d["sold_date"].dt.month / 12)
    d["moy_cos"] = np.cos(2 * np.pi * d["sold_date"].dt.month / 12)
    return d


def hedonic_index(df: pd.DataFrame, seg: str) -> pd.Series:
    """Monthly log-price index for a segment (indexed by month Timestamp)."""
    d = df[df["segment"] == seg].copy()
    num = ["beds", "baths", "log_sqft", "age"]
    d[num] = d[num].fillna(d[num].median())
    d["month_s"] = d["month"].dt.strftime("%Y-%m")
    pre = ColumnTransformer([
        ("m", OneHotEncoder(handle_unknown="ignore"), ["month_s", "fsa", "prop_type"]),
        ("n", StandardScaler(), num)])
    pipe = make_pipeline(pre, Ridge(alpha=1.0))
    pipe.fit(d[["month_s", "fsa", "prop_type"] + num], np.log(d["sold_price"]))
    enc = pipe[0].named_transformers_["m"]
    months = enc.categories_[0]
    coefs = pipe[-1].coef_[: len(months)]
    idx = pd.Series(coefs, index=pd.to_datetime([m + "-01" for m in months]))
    return idx - idx.iloc[-1]  # last month = 0  -> idx[m] = log(price_m / price_latest)


def add_local_stats(df: pd.DataFrame, seg: str) -> pd.DataFrame:
    """Leak-free rolling stats over earlier sales. Expects df sorted by sold_date and column y_adj."""
    d = df
    d["y_ppsf"] = d["y_adj"] - d["log_sqft"]  # size-aware stat (NaN when sqft missing)
    for k in LOCAL_KEYS[seg]:
        g = d.groupby(k, sort=False)
        for col, tag in (("y_adj", "adj"), ("y_ppsf", "ppsf")):
            d[f"ls_{k}_{tag}"] = g[col].transform(lambda s: s.shift().rolling(LAST_N, min_periods=1).mean())
        d[f"ls_{k}_n"] = g.cumcount()
    return d


def local_stat_cols(seg: str) -> list[str]:
    return [f"ls_{k}_{t}" for k in LOCAL_KEYS[seg] for t in ("adj", "ppsf", "n")]


def feature_cols(seg: str, with_rate=True) -> list[str]:
    cols = (NUM_HOUSE if seg == "house" else NUM_CONDO) + ["type_code", "fsa_code", "comm_code",
                                                         "moy_sin", "moy_cos"] + local_stat_cols(seg)
    if with_rate:
        cols += ["boc_rate", "rate_chg3", "news_idx"]
    return cols


def build_lookup(df: pd.DataFrame, seg: str) -> dict:
    """Latest rolling stats per key, used at inference time (subject property has no sale date yet)."""
    out = {}
    for k in LOCAL_KEYS[seg]:
        sub = df[df[k] != ""].sort_values("sold_date")
        g = sub.groupby(k)
        out[k] = {key: {"adj": grp["y_adj"].tail(LAST_N).mean(),
                        "ppsf": grp["y_ppsf"].tail(LAST_N).mean(),
                        "n": len(grp)} for key, grp in g}
    return out
