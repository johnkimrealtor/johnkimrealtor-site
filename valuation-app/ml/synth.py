"""Synthetic TRREB-style data so the pipeline can be tested before real data arrives.  *** NOT REAL DATA ***
python -m ml.synth data/synthetic_sold.csv"""
import sys
import numpy as np
import pandas as pd

rng = np.random.default_rng(7)
FSAS = {"M4E": ("The Beaches", 1250), "M4K": ("Danforth", 1250), "M5V": ("Waterfront", 1000), "M6H": ("Dovercourt", 1150),
        "M1B": ("Malvern", 700), "M2N": ("Willowdale", 1000), "M9C": ("Etobicoke", 800), "M4S": ("Davisville", 1450),
        "M5A": ("Corktown", 1100), "M6P": ("High Park", 1250), "M3C": ("Don Mills", 900), "M1P": ("Scarborough", 750)}
TYPES = ["Detached", "Semi-Detached", "Att/Row/Twnhouse", "Condo Apt"]
STREETS = {f: [f"{n} {s}" for n, s in zip(("Maple", "Oak", "Elm", "Birch", "Pine", "Cedar"), ("Avenue", "Street", "Road", "Drive", "Crescent", "Street"))] for f in FSAS}
BUILDINGS = [(f, rng.integers(10, 400), rng.choice(["Yonge Street", "Bay Street", "King Street West", "Queen Street East", "Dundas Street"]),
              rng.normal(0, .06)) for f in FSAS for _ in range(4)]
MONTHS = pd.date_range("2024-11-01", "2026-10-31", freq="D")


def make(n=14000):
    rows = []
    for i in range(n):
        d = MONTHS[rng.integers(len(MONTHS))]
        m = (d.year - 2024) * 12 + d.month - 11
        seasonal = 0.03 * np.sin(2 * np.pi * (d.month - 2) / 12)          # spring peak
        trend = 0.002 * m - 0.0003 * m ** 1.3
        rate = 3.75 if m < 8 else 3.0
        idx = np.exp(seasonal + trend + 0.01 * (rate - 3.5) * -1)
        t = rng.choice(TYPES, p=[.28, .12, .15, .45])
        f = rng.choice(list(FSAS)); comm, base = FSAS[f]
        postal = f"{f} {rng.integers(1, 9)}{rng.choice(list('ABCDEFGH'))}{rng.integers(1, 9)}"
        if t == "Condo Apt":
            bf, bno, bst, bq = BUILDINGS[rng.integers(len(BUILDINGS))]
            f = bf; comm, base = FSAS[f]; postal = f"{f} {rng.integers(1, 3)}A{rng.integers(1, 4)}"
            beds = rng.choice([0, 1, 2, 3], p=[.08, .45, .38, .09]); sqft = [450, 600, 850, 1150][beds] * rng.uniform(.85, 1.2)
            baths = 1 if beds < 2 else rng.choice([1, 2]); park = rng.choice([0, 1], p=[.3, .7]); locker = rng.choice([0, 1])
            maint = sqft * rng.uniform(.55, .85)
            price = (base * .9 * sqft + 20000 * park + 8000 * locker) * np.exp(bq)
            addr = f"{bno} {bst}"; unit = str(rng.integers(100, 3600)); lf = ld = np.nan; bs = ""; gar = 0; age = rng.integers(0, 35)
        else:
            beds = rng.choice([2, 3, 4, 5], p=[.15, .45, .30, .10]); sqft = (900 + 350 * (beds - 2)) * rng.uniform(.8, 1.3)
            if t != "Detached": sqft *= .8
            baths = max(1, beds - rng.integers(0, 2)); lf = rng.uniform(15, 50) if t == "Detached" else rng.uniform(15, 25)
            ld = rng.uniform(90, 140); bs = rng.choice(["Finished", "Apartment", "Unfinished", "Crawl Space"], p=[.4, .15, .35, .1])
            gar = rng.choice([0, 1, 2]); park = gar + rng.choice([0, 1]); age = rng.integers(0, 100)
            land = base * 450 * (lf / 25) * (1.0 if t == "Detached" else .55)
            price = base * sqft * .8 + land + 60000 * (bs == "Finished") + 110000 * (bs == "Apartment") + 25000 * gar
            st = rng.choice(STREETS[f]); addr = f"{rng.integers(1, 300)} {st}"; unit = ""; maint = np.nan
            price *= np.exp(hash(st + f) % 100 / 100 * .12 - .06)
        sold = price * idx * np.exp(rng.normal(0, .045)); lp = sold * np.exp(rng.normal(-.02, .05))
        rows.append({"Ml Num": f"X{i:07d}", "Address": addr, "Apt/Unit No": unit, "Municipality": "Toronto", "Community": comm,
                     "Postal Code": postal, "Type": t, "Br": beds, "Br Plus": rng.choice([0, 1], p=[.8, .2]), "Bath Tot": baths,
                     "Sqft": f"{int(sqft // 250 * 250)}-{int(sqft // 250 * 250 + 250)}" if rng.random() < .85 else "",
                     "Lot Front": lf, "Lot Depth": ld, "Bsmt1 Out": bs, "Gar Spaces": gar, "Park Spcs": park, "Age": age,
                     "Maint": maint, "Locker": "Owned" if t == "Condo Apt" and rng.random() < .4 else "None", "Exposure": rng.choice(list("NESW")),
                     "Lp Dol": int(lp), "Sp Dol": int(sold), "Dom": int(max(1, rng.gamma(2, 8) * (1 + (lp / sold - 1) * 6))),
                     "Sold Date": d.strftime("%Y-%m-%d")})
    return pd.DataFrame(rows)


if __name__ == "__main__":
    make().to_csv(sys.argv[1], index=False); print("wrote", sys.argv[1])
