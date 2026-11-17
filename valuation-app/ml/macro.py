"""Monthly macro table: Bank of Canada policy rate (+ optional news/sentiment index).

data/macro_monthly.csv columns: month (YYYY-MM-01), boc_rate, news_idx (optional, e.g. -1..+1)
If the file is missing we try the Bank of Canada Valet API (series V39079 = target overnight rate).
`news_idx` is a hook: fill it from any sentiment source you trust (monthly average); left NaN otherwise.
"""
from __future__ import annotations
import pandas as pd
from .config import DATA_DIR

PATH = DATA_DIR / "macro_monthly.csv"


def fetch_boc(start="2023-01-01") -> pd.DataFrame:
    import requests
    r = requests.get("https://www.bankofcanada.ca/valet/observations/V39079/json",
                     params={"start_date": start}, timeout=20)
    r.raise_for_status()
    rows = [(o["d"], float(o["V39079"]["v"])) for o in r.json()["observations"] if "V39079" in o]
    d = pd.DataFrame(rows, columns=["date", "boc_rate"])
    d["date"] = pd.to_datetime(d["date"])
    d = d.set_index("date").resample("D").ffill()
    m = d.resample("MS").mean().reset_index().rename(columns={"date": "month"})
    m["news_idx"] = float("nan")
    return m


def load_macro() -> pd.DataFrame:
    if PATH.exists():
        m = pd.read_csv(PATH, parse_dates=["month"])
    else:
        try:
            m = fetch_boc()
            m.to_csv(PATH, index=False)
            print(f"[macro] fetched BoC rates -> {PATH}")
        except Exception as e:  # offline: model still trains, rate features become NaN
            print(f"[macro] WARNING no macro file and BoC fetch failed ({e}); rate features will be NaN")
            return pd.DataFrame(columns=["month", "boc_rate", "news_idx", "rate_chg3"])
    if "news_idx" not in m:
        m["news_idx"] = float("nan")
    m = m.sort_values("month").reset_index(drop=True)
    m["rate_chg3"] = m["boc_rate"].diff(3)
    return m
