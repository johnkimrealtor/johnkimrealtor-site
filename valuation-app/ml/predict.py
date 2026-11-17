"""Live valuation: model estimate + comps + range + probability of selling at a given price."""
from __future__ import annotations
import numpy as np
import pandas as pd
import joblib
from .config import ART_DIR, segment_of
from .features import TYPE_CODE, EXPO_CODE, LOCAL_KEYS
from .loader import parse_address, norm_postal
from .comps import find_comps, comp_records

DISCLAIMER = ("Estimate based on past TRREB sold data. Not an appraisal; not a guarantee of sale price. "
              "Accuracy depends on data completeness and market conditions.")


class Valuator:
    def __init__(self, art_dir=ART_DIR):
        self.b = joblib.load(art_dir / "bundle.joblib")
        self.pool = pd.read_pickle(art_dir / "comps.pkl")

    # ---------- subject -> feature row
    def _subject(self, r: dict) -> dict:
        no, street = parse_address(r["address"])
        pt = r["prop_type"]
        seg = segment_of(pt)
        postal = norm_postal(r.get("postal_code"))
        fsa = postal[:3]
        s = dict(r, street_no=no, street=street, postal6=postal, fsa=fsa, segment=seg)
        s["building_key"] = f"{no} {street}" if seg == "condo" else ""
        s["street_key"] = f"{street}|{pt}"
        s["fsa_type"] = f"{fsa}|{pt}"
        s["community"] = r.get("community") or self.b["segments"][seg]["fsa_comm"].get(fsa, "")
        for k in ("beds", "baths", "sqft"):
            s[k] = float(r[k]) if r.get(k) else None
        return s

    def _row(self, s: dict, seg: str) -> pd.DataFrame:
        S = self.b["segments"][seg]
        now = pd.Timestamp.now()
        sqft = s["sqft"]
        row = {
            "beds": s["beds"], "beds_plus": s.get("beds_plus", 0), "baths": s["baths"],
            "log_sqft": np.log(sqft) if sqft else np.nan, "age": s.get("age", np.nan), "parking": s.get("parking", 0),
            "lot_front": s.get("lot_front", np.nan), "lot_depth": s.get("lot_depth", np.nan),
            "garage": s.get("garage", 0), "bsmt_fin": int(bool(s.get("bsmt_fin"))), "bsmt_apt": int(bool(s.get("bsmt_apt"))),
            "maint_fee": s.get("maint_fee", np.nan), "locker": int(bool(s.get("locker"))),
            "expo": EXPO_CODE.get(str(s.get("exposure", ""))[:1].upper(), -1), "type_code": TYPE_CODE[s["prop_type"]],
            "moy_sin": np.sin(2 * np.pi * now.month / 12), "moy_cos": np.cos(2 * np.pi * now.month / 12),
        }
        row["lot_area"] = (row["lot_front"] * row["lot_depth"]) if row["lot_front"] and row["lot_depth"] else np.nan
        for k in LOCAL_KEYS[seg]:
            st = S["lookup"][k].get(s[k], {})
            row[f"ls_{k}_adj"] = st.get("adj", np.nan)
            row[f"ls_{k}_ppsf"] = st.get("ppsf", np.nan)
            row[f"ls_{k}_n"] = st.get("n", 0)
        m = self.b.get("macro_now", {})
        row["boc_rate"], row["rate_chg3"], row["news_idx"] = (m.get("boc_rate", np.nan), m.get("rate_chg3", np.nan),
                                                              m.get("news_idx", np.nan))
        df = pd.DataFrame([row])
        df["fsa_code"] = pd.Categorical([s["fsa"]], categories=S["cats"]["fsa_code"])
        df["comm_code"] = pd.Categorical([s["community"]], categories=S["cats"]["comm_code"])
        return df[S["cols"]]

    # ---------- main API
    def valuate(self, req: dict, asking_price: float | None = None) -> dict:
        s = self._subject(req)
        seg = s["segment"]
        S = self.b["segments"][seg]
        X = self._row(s, seg)
        model_est = float(np.exp(S["model"].predict(X)[0] + S["now_idx"]))

        top = find_comps(s, seg, self.pool, S["index"], S["now_idx"])
        comps = comp_records(top)
        close = top[top["tier"] <= 0.8] if len(top) else top
        comp_est, w = None, 0.0
        if len(close) >= 3:
            wts = np.exp(-close["score"].to_numpy() / 2)
            if s["sqft"] and close["sqft"].notna().sum() >= 3:
                ppsf = (close["adj_price"] / close["sqft"]).to_numpy()
                ok = ~np.isnan(ppsf)
                comp_est = float(np.average(ppsf[ok], weights=wts[ok]) * s["sqft"])
            else:
                comp_est = float(np.average(close["adj_price"], weights=wts))
            w = min(0.4, 0.1 * len(close))
        est = model_est if comp_est is None else (1 - w) * model_est + w * comp_est

        res = S["resid"]
        q = lambda p: float(np.quantile(res, p))
        # widen when there is little local evidence
        n_local = max([S["lookup"][k].get(s[k], {}).get("n", 0) for k in LOCAL_KEYS[seg]] + [0])
        widen = 1.25 if n_local < 3 else 1.0
        rng = {"low": est * np.exp(q(0.10) * widen), "high": est * np.exp(q(0.90) * widen)}
        conf = "high" if (len(close) >= 5 and n_local >= 5) else "medium" if len(close) >= 2 else "low"

        out = {
            "estimate": round(est, -3), "model_estimate": round(model_est, -3),
            "comps_estimate": None if comp_est is None else round(comp_est, -3),
            "range_low": round(rng["low"], -3), "range_high": round(rng["high"], -3),
            "confidence": conf, "segment": seg, "community": s["community"],
            "model_median_error_pct": round(100 * self.b["metrics"][seg]["median_ape"], 1),
            "comps": comps, "drivers": self._drivers(S, X), "disclaimer": DISCLAIMER,
            "price_ladder": self._ladder(est, res, widen),
        }
        if asking_price:
            p = self._p_at_least(est, res, widen, asking_price)
            out["asking_price"] = asking_price
            out["prob_sell_at_or_above"] = round(100 * p, 0)
            out["typical_dom"] = self._dom(S, asking_price / est)
        return out

    @staticmethod
    def _p_at_least(est, res, widen, price) -> float:
        """P(final sold price >= price) from the empirical out-of-time residual distribution."""
        z = np.log(price / est) / widen
        return float(np.clip((res >= z).mean(), 0.01, 0.99))

    def _ladder(self, est, res, widen):
        return [{"price": round(est * m, -3), "prob": round(100 * self._p_at_least(est, res, widen, est * m))}
                for m in (0.90, 0.95, 1.0, 1.05, 1.10, 1.15)]

    @staticmethod
    def _dom(S, ratio):
        t = S.get("dom_table")
        if not t:
            return None
        for lab, v in t.items():
            lo, hi = [float(x) for x in lab.strip("()[]").split(", ")]
            if lo < ratio <= hi:
                return {"median_days": v["median_dom"], "sample": v["n"],
                        "note": "from sold listings only; unsold listings are not in the data"}
        return None

    @staticmethod
    def _drivers(S, X):
        return list(S["importance"])[:6]
