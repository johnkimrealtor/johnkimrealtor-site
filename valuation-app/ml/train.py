"""Train valuation models.   python -m ml.train data/sold_2024_2026.csv [more.csv ...]"""
from __future__ import annotations
import json, sys
import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from .config import ART_DIR, SEGMENTS, segment_of
from .features import add_basic, add_local_stats, build_lookup, feature_cols, hedonic_index
from .loader import load_sold
from .macro import load_macro

HOLDOUT_MONTHS = 3
PARAMS = dict(objective="regression_l1", learning_rate=0.04, num_leaves=31, min_data_in_leaf=20,
              feature_fraction=0.8, bagging_fraction=0.8, bagging_freq=1, lambda_l2=1.0, verbose=-1)


def train(paths, months=24):
    ART_DIR.mkdir(exist_ok=True, parents=True)
    df = add_basic(load_sold(paths, months))
    df["segment"] = df["prop_type"].map(segment_of)
    macro = load_macro()
    df = df.merge(macro[["month", "boc_rate", "rate_chg3", "news_idx"]], on="month", how="left") \
        if len(macro) else df.assign(boc_rate=np.nan, rate_chg3=np.nan, news_idx=np.nan)
    span = (df["month"].max().year - df["month"].min().year) * 12 + df["month"].max().month - df["month"].min().month + 1
    print(f"[data] {len(df):,} sales, {span} months, {df['month'].min():%Y-%m} → {df['month'].max():%Y-%m}")

    bundle = {"segments": {}, "built": pd.Timestamp.now().isoformat(), "months": int(span)}
    comps_keep = []
    metrics = {}
    cutoff = df["month"].max() - pd.DateOffset(months=HOLDOUT_MONTHS - 1)

    for seg in SEGMENTS:
        d0 = df[df["segment"] == seg].sort_values("sold_date").reset_index(drop=True)

        def prepare(idx):
            d = d0.copy()
            d["idx"] = d["month"].map(idx)
            d["y_adj"] = np.log(d["sold_price"]) - d["idx"]
            d = add_local_stats(d, seg)
            d["fsa_code"] = pd.Categorical(d["fsa"], categories=sorted(d0["fsa"].unique()))
            d["comm_code"] = pd.Categorical(d["community"], categories=sorted(d0["community"].unique()))
            return d

        cols = feature_cols(seg)
        # --- honest out-of-time check: index built ONLY from pre-cutoff sales, holdout priced at the "now" index
        idx_tr = hedonic_index(df[df["month"] < cutoff], seg)
        idx_ext = idx_tr.reindex(sorted(d0["month"].unique())).ffill()  # holdout months -> last known index
        dv = prepare(idx_ext)
        tr, te = dv[dv["month"] < cutoff], dv[dv["month"] >= cutoff]
        print(f"[{seg}] train {len(tr):,} / holdout {len(te):,}")

        def fit(X, y, n=None, Xv=None, yv=None):
            ds = lgb.Dataset(X[cols], y)
            if Xv is not None:
                return lgb.train(PARAMS, ds, 2000, valid_sets=[lgb.Dataset(Xv[cols], yv)],
                                 callbacks=[lgb.early_stopping(60, verbose=False)])
            return lgb.train(PARAMS, ds, n)

        # early-stopping on a slice of train (last month before cutoff) so holdout stays untouched
        es_cut = cutoff - pd.DateOffset(months=1)
        m1 = fit(tr[tr["month"] < es_cut], tr[tr["month"] < es_cut]["y_adj"],
                 Xv=tr[tr["month"] >= es_cut], yv=tr[tr["month"] >= es_cut]["y_adj"])
        now_tr = float(idx_tr.iloc[-2:].mean())
        pred_log = m1.predict(te[cols], num_iteration=m1.best_iteration) + now_tr
        resid = (np.log(te["sold_price"]) - pred_log).to_numpy()   # nowcast residuals, log space
        ape = np.abs(np.exp(resid) - 1)
        metrics[seg] = {"n_holdout": int(len(te)), "median_ape": float(np.median(ape)),
                        "mean_ape": float(ape.mean()), "within_5pct": float((ape < .05).mean()),
                        "within_10pct": float((ape < .10).mean()), "best_iter": int(m1.best_iteration)}
        print(f"[{seg}] holdout median APE {metrics[seg]['median_ape']:.1%}  within10% {metrics[seg]['within_10pct']:.1%}")

        # --- final model on all data with the full-data index
        idx = hedonic_index(df, seg)
        d = prepare(idx)
        cats = {"fsa_code": d["fsa_code"].cat.categories, "comm_code": d["comm_code"].cat.categories}
        final = fit(d, d["y_adj"], n=max(50, int(m1.best_iteration * 1.1)))
        # horizon-aware nowcast: "now" index = mean of last 2 months (trees never extrapolate)
        now_idx = float(idx.iloc[-2:].mean())
        bundle["segments"][seg] = {
            "model": final, "cols": cols, "cats": cats, "index": idx, "now_idx": now_idx,
            "lookup": build_lookup(d, seg), "resid": np.sort(resid),
            "fsa_comm": d.groupby("fsa")["community"].agg(lambda s: s.mode().iat[0]).to_dict(),
            "dom_table": dom_table(te, pred_log),
            "importance": dict(sorted(zip(cols, final.feature_importance("gain").round(1)),
                                      key=lambda kv: -kv[1])[:15]),
        }
        comps_keep.append(d)

    last = macro.dropna(subset=["boc_rate"]).tail(1) if len(macro) else pd.DataFrame()
    bundle["macro_now"] = last.iloc[0].to_dict() if len(last) else {}
    bundle["metrics"] = metrics
    joblib.dump(bundle, ART_DIR / "bundle.joblib")
    pd.concat(comps_keep).to_pickle(ART_DIR / "comps.pkl")
    (ART_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("[done] artifacts ->", ART_DIR)
    for s in SEGMENTS:
        print(f"[{s}] top features:", list(bundle["segments"][s]["importance"])[:8])
    return bundle


def dom_table(te: pd.DataFrame, pred_log):
    """Typical DOM by list/pred ratio bucket. NOTE: sold-only data => survivorship bias (unsold listings missing)."""
    if te["list_price"].isna().all() or te["dom"].isna().all():
        return None
    ratio = te["list_price"].to_numpy() / np.exp(pred_log)
    b = pd.cut(ratio, [0, .95, 1.0, 1.05, 1.10, 9])
    t = te.assign(b=b).groupby("b", observed=True)["dom"].agg(["median", "count"])
    return {str(k): {"median_dom": float(v["median"]), "n": int(v["count"])} for k, v in t.iterrows()}


if __name__ == "__main__":
    args = sys.argv[1:]
    months = 24
    if "--months" in args:
        i = args.index("--months"); months = int(args[i + 1]); del args[i:i + 2]
    train(args, months)
