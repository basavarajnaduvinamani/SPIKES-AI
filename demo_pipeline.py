# demo_pipeline.py
"""
Combined CGM Spike + Lifestyle Pillar Analysis Pipeline
--------------------------------------------------------
Demonstrates how to join spike detection outputs with self-reported
pillar data at the day level, compute correlations, and produce
clinician-ready insights for a single patient.

Usage:
    python demo_pipeline.py

Requires:
    - spike_analysis.py  (reshape_wide_to_long, detect_spikes)
    - pillar_analysis.py (clean_pillars, patient_summary, PILLAR_NAMES, ...)
    - CGM CSV            (wide-format)
    - Pillars CSV        (self-reported gauges)
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns
from scipy import stats
from pathlib import Path

from spike_analysis import reshape_wide_to_long, detect_spikes
from pillar_analysis import (
    clean_pillars,
    patient_summary,
    PILLAR_NAMES,
    GAUGE_COLS,
    PILLAR_COLORS,
)

# ==============================================
# CONFIGURATION — change these
# ==============================================

CLIENT_ID = "SPIKES-021"

CGM_CSV_PATH   = Path("data/cgm_matrix.csv")
PILLAR_CSV_PATH = Path("data/patient_reported_metrics.csv")

# Spike detection thresholds
AMP_THRESH  = 1.0    # mmol/L above baseline
RISE_RATE   = 0.02   # mmol/L per minute
END_BAND    = 0.3    # mmol/L
MIN_ABOVE   = 15     # minutes

# Column names in CGM CSV
ID_COL  = "Client ID"
DAY_COL = "Day"


# ==============================================
# 1. LOAD DATA
# ==============================================

print(f"{'=' * 60}")
print(f"  Combined Analysis Pipeline  ·  {CLIENT_ID}")
print(f"{'=' * 60}\n")

cgm_wide = pd.read_csv(CGM_CSV_PATH)
pillars_raw = pd.read_csv(PILLAR_CSV_PATH)

print(f"CGM data:     {len(cgm_wide)} rows, {len(cgm_wide.columns)} columns")
print(f"Pillars data: {len(pillars_raw)} rows, {len(pillars_raw.columns)} columns")


# ==============================================
# 2. RUN SPIKE DETECTION
# ==============================================

print(f"\n{'-' * 60}")
print("  Step 2: Spike Detection")
print(f"{'-' * 60}\n")

long_df = reshape_wide_to_long(cgm_wide, id_col=ID_COL, day_col=DAY_COL)

events_df, annotated_df = detect_spikes(
    long_df,
    person_id=CLIENT_ID,
    amp_thresh=AMP_THRESH,
    rise_rate_thresh=RISE_RATE,
    end_band=END_BAND,
    min_above_min=MIN_ABOVE,
)

print(f"Total spikes detected: {len(events_df)}")
if not events_df.empty:
    print(f"Peak glucose range:    {events_df['peak_glucose'].min():.1f} – {events_df['peak_glucose'].max():.1f} mmol/L")
    print(f"Mean confidence:       {events_df['p_val'].mean():.3f}")


# ==============================================
# 3. BUILD DAILY SPIKE SUMMARY
# ==============================================

print(f"\n{'-' * 60}")
print("  Step 3: Daily Spike Summary")
print(f"{'-' * 60}\n")

# Determine which day column the spike detector used
if "study_day" in annotated_df.columns:
    spike_day_col = "study_day"
    annotated_df[spike_day_col] = pd.to_numeric(annotated_df[spike_day_col], errors="coerce")
else:
    annotated_df["datetime"] = pd.to_datetime(annotated_df["datetime"])
    spike_day_col = "date"
    annotated_df[spike_day_col] = annotated_df["datetime"].dt.date

# Per-day CGM metrics from the annotated trace
daily_cgm = (
    annotated_df
    .groupby(spike_day_col)
    .agg(
        mean_glucose=("glucose_mmol_l", "mean"),
        std_glucose=("glucose_mmol_l", "std"),
        min_glucose=("glucose_mmol_l", "min"),
        max_glucose=("glucose_mmol_l", "max"),
    )
    .reset_index()
)

# Per-day spike counts and peak amplitude
if not events_df.empty and "Day" in events_df.columns:
    # Align the Day column type with the spike_day_col type
    if spike_day_col == "study_day":
        events_df["_day_key"] = pd.to_numeric(events_df["Day"], errors="coerce")
    else:
        events_df["_day_key"] = events_df["Day"]

    daily_spikes = (
        events_df
        .groupby("_day_key")
        .agg(
            spike_count=("peak_glucose", "size"),
            max_peak_glucose=("peak_glucose", "max"),
            mean_peak_glucose=("peak_glucose", "mean"),
            mean_amplitude=("amplitude", "mean") if "amplitude" in events_df.columns else ("peak_glucose", "mean"),
        )
        .reset_index()
        .rename(columns={"_day_key": spike_day_col})
    )
else:
    daily_spikes = pd.DataFrame({
        spike_day_col: daily_cgm[spike_day_col],
        "spike_count": 0,
        "max_peak_glucose": np.nan,
        "mean_peak_glucose": np.nan,
        "mean_amplitude": np.nan,
    })

# Merge CGM summary + spike counts
daily_cgm = daily_cgm.merge(daily_spikes, on=spike_day_col, how="left")
daily_cgm["spike_count"] = daily_cgm["spike_count"].fillna(0).astype(int)

# Add a sequential day index (1-based) for alignment with pillars
daily_cgm = daily_cgm.sort_values(spike_day_col).reset_index(drop=True)
daily_cgm["day_index"] = range(1, len(daily_cgm) + 1)

print(f"CGM days:  {len(daily_cgm)}")
print(daily_cgm[["day_index", spike_day_col, "mean_glucose", "spike_count", "max_peak_glucose"]].to_string(index=False))


# ==============================================
# 4. CLEAN & PREPARE PILLAR DATA
# ==============================================

print(f"\n{'-' * 60}")
print("  Step 4: Pillar Data Preparation")
print(f"{'-' * 60}\n")

pillars_clean = clean_pillars(pillars_raw)

# Filter to this patient
patient_pillars = pillars_clean.loc[
    pillars_clean["Client ID"].astype(str) == CLIENT_ID
].copy().reset_index(drop=True)

print(f"Pillar days for {CLIENT_ID}: {len(patient_pillars)}")

# Quick summary
summary = patient_summary(pillars_clean, CLIENT_ID)
print(f"\nPillar averages:")
for pillar in PILLAR_NAMES:
    pdata = summary["pillars"].get(pillar, {})
    mean_val = pdata.get("mean")
    dominant = pdata.get("dominant_trend", "—")
    if mean_val is not None:
        print(f"  {pillar:12s}  mean={mean_val:.1f}  trend={dominant}")
    else:
        print(f"  {pillar:12s}  (no data)")


# ==============================================
# 5. JOIN ON DAY INDEX
# ==============================================

print(f"\n{'-' * 60}")
print("  Step 5: Day-Level Join (CGM <-> Pillars)")
print(f"{'-' * 60}\n")

# Both datasets have a day_index (1-based sequential)
# Pillar data already has day_index from clean_pillars()
gauge_cols_present = [GAUGE_COLS[p] for p in PILLAR_NAMES if GAUGE_COLS[p] in patient_pillars.columns]

pillar_daily = patient_pillars[["day_index"] + gauge_cols_present].copy()

# Merge on day_index
combined = daily_cgm.merge(pillar_daily, on="day_index", how="inner")

n_matched = len(combined)
n_cgm = len(daily_cgm)
n_pillar = len(pillar_daily)

print(f"CGM days:       {n_cgm}")
print(f"Pillar days:    {n_pillar}")
print(f"Matched days:   {n_matched}")

if n_matched == 0:
    print("\n[!] No overlapping days found. Check that CGM and pillar data cover the same period.")
    print("  Pipeline cannot continue without matched days.")
    exit(1)

print(f"\nCombined table (first 10 rows):")
display_cols = ["day_index", "spike_count", "mean_glucose", "max_peak_glucose"] + gauge_cols_present
print(combined[display_cols].head(10).to_string(index=False))


# ==============================================
# 6. CORRELATION ANALYSIS
# ==============================================

print(f"\n{'-' * 60}")
print("  Step 6: Pillar <-> Spike Correlations")
print(f"{'-' * 60}\n")

correlation_results = []

for pillar in PILLAR_NAMES:
    gcol = GAUGE_COLS.get(pillar)
    if gcol not in combined.columns:
        continue

    valid = combined[["spike_count", "mean_glucose", gcol]].dropna()
    if len(valid) < 5:
        print(f"  {pillar:12s}  — insufficient data ({len(valid)} days)")
        continue

    # Correlation with spike count
    r_spikes, p_spikes = stats.spearmanr(valid[gcol], valid["spike_count"])

    # Correlation with mean glucose
    r_glucose, p_glucose = stats.spearmanr(valid[gcol], valid["mean_glucose"])

    sig_spike = "***" if p_spikes < 0.001 else "**" if p_spikes < 0.01 else "*" if p_spikes < 0.05 else ""
    sig_gluc  = "***" if p_glucose < 0.001 else "**" if p_glucose < 0.01 else "*" if p_glucose < 0.05 else ""

    print(f"  {pillar:12s}  vs spike_count: r={r_spikes:+.3f} (p={p_spikes:.4f}) {sig_spike}")
    print(f"  {' ':12s}  vs mean_glucose: r={r_glucose:+.3f} (p={p_glucose:.4f}) {sig_gluc}")

    correlation_results.append({
        "Pillar": pillar,
        "r_spike_count": round(r_spikes, 3),
        "p_spike_count": round(p_spikes, 4),
        "r_mean_glucose": round(r_glucose, 3),
        "p_mean_glucose": round(p_glucose, 4),
        "n_days": len(valid),
    })

corr_df = pd.DataFrame(correlation_results)

if not corr_df.empty:
    # Identify the strongest predictor of spike count
    best = corr_df.loc[corr_df["r_spike_count"].abs().idxmax()]
    print(f"\n  > Strongest spike predictor: {best['Pillar']} "
          f"(r={best['r_spike_count']:+.3f}, p={best['p_spike_count']:.4f})")


# ==============================================
# 7. HIGH vs LOW PILLAR DAY COMPARISON
# ==============================================

print(f"\n{'-' * 60}")
print("  Step 7: High vs Low Pillar Day Comparison")
print(f"{'-' * 60}\n")

for pillar in PILLAR_NAMES:
    gcol = GAUGE_COLS.get(pillar)
    if gcol not in combined.columns:
        continue

    valid = combined[["spike_count", "mean_glucose", gcol]].dropna()
    if len(valid) < 6:
        continue

    median_val = valid[gcol].median()
    low_days  = valid.loc[valid[gcol] <= median_val]
    high_days = valid.loc[valid[gcol] > median_val]

    if len(low_days) < 2 or len(high_days) < 2:
        continue

    low_spikes  = low_days["spike_count"].mean()
    high_spikes = high_days["spike_count"].mean()
    low_gluc    = low_days["mean_glucose"].mean()
    high_gluc   = high_days["mean_glucose"].mean()

    # Mann-Whitney U test for spike counts between groups
    if low_days["spike_count"].std() > 0 or high_days["spike_count"].std() > 0:
        u_stat, u_pval = stats.mannwhitneyu(
            low_days["spike_count"], high_days["spike_count"],
            alternative="two-sided",
        )
        sig = f"p={u_pval:.4f}" + (" *" if u_pval < 0.05 else "")
    else:
        sig = "no variance"

    print(f"  {pillar:12s}  (median split at {median_val:.0f})")
    print(f"    Low  days (n={len(low_days):2d}):  spikes={low_spikes:.2f}  glucose={low_gluc:.2f} mmol/L")
    print(f"    High days (n={len(high_days):2d}):  spikes={high_spikes:.2f}  glucose={high_gluc:.2f} mmol/L")
    print(f"    Difference: {high_spikes - low_spikes:+.2f} spikes/day  ({sig})")
    print()


# ==============================================
# 8. LAG ANALYSIS (does yesterday's pillar
#    predict today's spikes?)
# ==============================================

print(f"{'-' * 60}")
print("  Step 8: Lag-1 Analysis (Yesterday's Pillar -> Today's Spikes)")
print(f"{'-' * 60}\n")

lag_results = []

for pillar in PILLAR_NAMES:
    gcol = GAUGE_COLS.get(pillar)
    if gcol not in combined.columns:
        continue

    # Create lagged version: yesterday's pillar gauge
    lag_df = combined[["day_index", "spike_count", gcol]].copy()
    lag_df[f"{gcol}_lag1"] = lag_df[gcol].shift(1)
    lag_df = lag_df.dropna()

    if len(lag_df) < 5:
        continue

    r_lag, p_lag = stats.spearmanr(lag_df[f"{gcol}_lag1"], lag_df["spike_count"])

    # Compare with same-day correlation
    r_same, p_same = stats.spearmanr(lag_df[gcol], lag_df["spike_count"])

    lag_results.append({
        "Pillar": pillar,
        "r_same_day": round(r_same, 3),
        "r_lag1": round(r_lag, 3),
        "p_lag1": round(p_lag, 4),
    })

    stronger = "lag-1 stronger" if abs(r_lag) > abs(r_same) else "same-day stronger"
    sig = "*" if p_lag < 0.05 else ""

    print(f"  {pillar:12s}  same-day r={r_same:+.3f}  |  lag-1 r={r_lag:+.3f} (p={p_lag:.4f}) {sig}  [{stronger}]")

lag_df_results = pd.DataFrame(lag_results)


# ==============================================
# 9. RISK DAY IDENTIFICATION
# ==============================================

print(f"\n{'-' * 60}")
print("  Step 9: Risk Day Identification")
print(f"{'-' * 60}\n")

# A "risk day" = multiple pillars below their patient-specific 25th percentile
risk_threshold = 0.25  # bottom quartile

risk_flags = pd.DataFrame({"day_index": combined["day_index"]})
n_risk_pillars = np.zeros(len(combined))

for pillar in PILLAR_NAMES:
    gcol = GAUGE_COLS.get(pillar)
    if gcol not in combined.columns:
        continue

    q25 = combined[gcol].quantile(risk_threshold)
    is_low = combined[gcol] <= q25
    risk_flags[f"{pillar}_low"] = is_low
    n_risk_pillars += is_low.astype(int).values

combined["n_low_pillars"] = n_risk_pillars.astype(int)
combined["is_risk_day"] = combined["n_low_pillars"] >= 3  # 3+ pillars in bottom quartile

n_risk = combined["is_risk_day"].sum()
n_normal = (~combined["is_risk_day"]).sum()

print(f"Risk days (>=3 pillars in bottom 25%): {n_risk} / {len(combined)}")

if n_risk > 0 and n_normal > 0:
    risk_spikes   = combined.loc[combined["is_risk_day"], "spike_count"].mean()
    normal_spikes = combined.loc[~combined["is_risk_day"], "spike_count"].mean()
    risk_glucose  = combined.loc[combined["is_risk_day"], "mean_glucose"].mean()
    normal_glucose = combined.loc[~combined["is_risk_day"], "mean_glucose"].mean()

    print(f"\n  Risk days:    spikes={risk_spikes:.2f}/day  glucose={risk_glucose:.2f} mmol/L")
    print(f"  Normal days:  spikes={normal_spikes:.2f}/day  glucose={normal_glucose:.2f} mmol/L")
    print(f"  Difference:   {risk_spikes - normal_spikes:+.2f} spikes/day, "
          f"{risk_glucose - normal_glucose:+.2f} mmol/L")

    # Flag which days
    print(f"\n  Risk day indices: {combined.loc[combined['is_risk_day'], 'day_index'].tolist()}")
elif n_risk == 0:
    print("  No risk days identified — pillars are generally stable for this patient.")


# ==============================================
# 10. VISUALISATIONS
# ==============================================

print(f"\n{'-' * 60}")
print("  Step 10: Generating Figures")
print(f"{'-' * 60}\n")

sns.set_theme(style="whitegrid", font_scale=0.95)
output_dir = Path("output")
output_dir.mkdir(exist_ok=True)


# -- 10a. Correlation heatmap --
if not corr_df.empty:
    fig, ax = plt.subplots(figsize=(8, 5))

    heatmap_data = corr_df.set_index("Pillar")[["r_spike_count", "r_mean_glucose"]]
    heatmap_data.columns = ["Spike Count", "Mean Glucose"]

    sns.heatmap(
        heatmap_data,
        annot=True, fmt=".2f", cmap="RdBu_r", center=0,
        vmin=-1, vmax=1, linewidths=0.5,
        cbar_kws={"label": "Spearman r"},
        ax=ax,
    )
    ax.set_title(f"{CLIENT_ID}  ·  Pillar <-> Glucose Correlations", fontsize=13, fontweight="bold", pad=12)
    fig.tight_layout()
    fig.savefig(output_dir / "correlation_heatmap.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("  [OK] correlation_heatmap.png")


# -- 10b. Dual-axis time-series: spikes + pillar gauges --
fig, ax1 = plt.subplots(figsize=(14, 5))

# Spike count as bars
ax1.bar(
    combined["day_index"], combined["spike_count"],
    color="#e94560", alpha=0.35, width=0.8, label="Spike Count",
)
ax1.set_xlabel("Study Day", fontsize=10)
ax1.set_ylabel("Spike Count", fontsize=10, color="#e94560")
ax1.tick_params(axis="y", labelcolor="#e94560")
ax1.set_ylim(0, max(combined["spike_count"].max() + 1, 4))
ax1.xaxis.set_major_locator(mticker.MaxNLocator(integer=True))

# Pillar gauges as lines on secondary axis
ax2 = ax1.twinx()
for pillar in PILLAR_NAMES:
    gcol = GAUGE_COLS.get(pillar)
    if gcol not in combined.columns:
        continue
    ax2.plot(
        combined["day_index"], combined[gcol],
        marker="o", markersize=3, linewidth=1.2,
        color=PILLAR_COLORS[pillar], label=pillar, alpha=0.8,
    )

ax2.set_ylabel("Pillar Gauge (1–10)", fontsize=10, color="#333")
ax2.set_ylim(0, 11)
ax2.yaxis.set_major_locator(mticker.MultipleLocator(2))

# Highlight risk days
for _, row in combined.loc[combined["is_risk_day"]].iterrows():
    ax1.axvspan(row["day_index"] - 0.4, row["day_index"] + 0.4,
                color="#ef4444", alpha=0.08, zorder=0)

# Combined legend
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
ax2.legend(lines1 + lines2, labels1 + labels2, loc="upper right", fontsize=7, ncol=4, framealpha=0.9)

ax1.set_title(f"{CLIENT_ID}  ·  Spikes vs Lifestyle Pillars Over Time", fontsize=13, fontweight="bold", pad=12)
fig.tight_layout()
fig.savefig(output_dir / "spikes_vs_pillars_timeseries.png", dpi=150, bbox_inches="tight")
plt.close(fig)
print("  [OK] spikes_vs_pillars_timeseries.png")


# -- 10c. Scatter matrix: top 3 correlated pillars vs spike count --
if len(corr_df) >= 2:
    top_pillars = corr_df.loc[corr_df["r_spike_count"].abs().nlargest(3).index, "Pillar"].tolist()
    top_gcols = [GAUGE_COLS[p] for p in top_pillars if GAUGE_COLS[p] in combined.columns]

    if top_gcols:
        n_plots = len(top_gcols)
        fig, axes = plt.subplots(1, n_plots, figsize=(5 * n_plots, 4.5))
        if n_plots == 1:
            axes = [axes]

        for ax, gcol in zip(axes, top_gcols):
            pillar_name = [p for p, c in GAUGE_COLS.items() if c == gcol][0]
            color = PILLAR_COLORS.get(pillar_name, "#4a90d9")

            valid = combined[["spike_count", gcol]].dropna()
            ax.scatter(valid[gcol], valid["spike_count"], color=color, alpha=0.6, s=50, edgecolors="white", linewidths=0.5)

            # Trend line
            if len(valid) >= 3:
                z = np.polyfit(valid[gcol], valid["spike_count"], 1)
                poly = np.poly1d(z)
                x_range = np.linspace(valid[gcol].min(), valid[gcol].max(), 50)
                ax.plot(x_range, poly(x_range), color=color, linewidth=1.5, linestyle="--", alpha=0.7)

            r_val = corr_df.loc[corr_df["Pillar"] == pillar_name, "r_spike_count"].values[0]
            p_val = corr_df.loc[corr_df["Pillar"] == pillar_name, "p_spike_count"].values[0]
            ax.set_title(f"{pillar_name}\nr={r_val:+.3f}, p={p_val:.3f}", fontsize=11, fontweight="bold")
            ax.set_xlabel(f"{pillar_name} Gauge", fontsize=10)
            ax.set_ylabel("Spike Count", fontsize=10)
            ax.yaxis.set_major_locator(mticker.MaxNLocator(integer=True))

        fig.suptitle(f"{CLIENT_ID}  ·  Top Correlated Pillars vs Spike Count", fontsize=13, fontweight="bold", y=1.02)
        fig.tight_layout()
        fig.savefig(output_dir / "scatter_top_pillars.png", dpi=150, bbox_inches="tight")
        plt.close(fig)
        print("  [OK] scatter_top_pillars.png")


# -- 10d. Risk day heatmap --
heatmap_cols = [GAUGE_COLS[p] for p in PILLAR_NAMES if GAUGE_COLS[p] in combined.columns]
if heatmap_cols:
    fig, ax = plt.subplots(figsize=(14, max(4, len(combined) * 0.3)))

    hm_data = combined.set_index("day_index")[heatmap_cols].copy()
    hm_data.columns = [p for p in PILLAR_NAMES if GAUGE_COLS[p] in combined.columns]

    # Add spike count as the last column
    hm_data["Spikes"] = combined.set_index("day_index")["spike_count"]

    sns.heatmap(
        hm_data.T,
        annot=True, fmt=".0f", cmap="YlOrRd_r",
        linewidths=0.5, cbar_kws={"label": "Gauge / Count"},
        ax=ax,
    )

    # Mark risk days on x-axis
    risk_indices = combined.loc[combined["is_risk_day"], "day_index"].tolist()
    for label in ax.get_xticklabels():
        try:
            if int(label.get_text()) in risk_indices:
                label.set_color("#ef4444")
                label.set_fontweight("bold")
        except ValueError:
            pass

    ax.set_xlabel("Study Day", fontsize=10)
    ax.set_title(f"{CLIENT_ID}  ·  Daily Pillar + Spike Heatmap  (red x-labels = risk days)",
                 fontsize=13, fontweight="bold", pad=12)
    fig.tight_layout()
    fig.savefig(output_dir / "daily_heatmap.png", dpi=150, bbox_inches="tight")
    plt.close(fig)
    print("  [OK] daily_heatmap.png")


# ==============================================
# 11. CLINICAL SUMMARY
# ==============================================

print(f"\n{'=' * 60}")
print(f"  CLINICAL SUMMARY — {CLIENT_ID}")
print(f"{'=' * 60}\n")

print(f"  Study period:       {n_matched} matched days")
print(f"  Total spikes:       {combined['spike_count'].sum()}")
print(f"  Spikes per day:     {combined['spike_count'].mean():.2f} (±{combined['spike_count'].std():.2f})")
print(f"  Mean glucose:       {combined['mean_glucose'].mean():.2f} mmol/L")

if not corr_df.empty:
    best = corr_df.loc[corr_df["r_spike_count"].abs().idxmax()]
    direction = "lower" if best["r_spike_count"] < 0 else "higher"
    print(f"\n  > Primary intervention target: {best['Pillar']}")
    print(f"    {direction.title()} {best['Pillar']} gauge is associated with more spikes")
    print(f"    (Spearman r={best['r_spike_count']:+.3f}, p={best['p_spike_count']:.4f}, n={best['n_days']} days)")

    if best["p_spike_count"] < 0.05:
        print(f"    [OK] Statistically significant at α=0.05")
    else:
        print(f"    [!] Not statistically significant — interpret with caution")

if not lag_df_results.empty:
    best_lag = lag_df_results.loc[lag_df_results["r_lag1"].abs().idxmax()]
    if abs(best_lag["r_lag1"]) > abs(best_lag["r_same_day"]):
        print(f"\n  > Delayed effect detected: {best_lag['Pillar']}")
        print(f"    Yesterday's {best_lag['Pillar']} gauge predicts today's spikes")
        print(f"    better than same-day (lag-1 r={best_lag['r_lag1']:+.3f} vs same-day r={best_lag['r_same_day']:+.3f})")

if n_risk > 0:
    print(f"\n  > {n_risk} risk days identified (≥3 pillars in bottom quartile)")
    print(f"    Risk days average {risk_spikes:.1f} spikes vs {normal_spikes:.1f} on normal days")

print(f"\n  Figures saved to: {output_dir.resolve()}/")
print(f"\n{'=' * 60}")
print(f"  Pipeline complete.")
print(f"{'=' * 60}")


# ==============================================
# 12. EXPORT COMBINED TABLE
# ==============================================

combined.to_csv(output_dir / f"{CLIENT_ID}_combined_daily.csv", index=False)
if not corr_df.empty:
    corr_df.to_csv(output_dir / f"{CLIENT_ID}_correlations.csv", index=False)

print(f"\n  Exported: {CLIENT_ID}_combined_daily.csv")
print(f"  Exported: {CLIENT_ID}_correlations.csv")