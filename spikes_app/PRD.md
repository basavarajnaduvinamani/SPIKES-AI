# Product Requirements Document (PRD)

## SPIKES Web App — Vite + Tailwind Replica

**Version:** 1.0  
**Status:** Draft (pre-implementation)  
**Reference implementation:** `SPIKES_app.py` (Streamlit)  
**Target codebase:** `spikes_app/` (Vite + React + TypeScript + Tailwind)

---

## 1. Vision & goals

### 1.1 Summary

Deliver a **browser-based application** that **replicates all user-facing functionality** of the existing Streamlit SPIKES dashboard: CGM spike/dip analysis, patient metadata overview, and lifestyle pillars visualization, driven by the **same CSV data shapes** as the repository `data/` folder (and file upload).

### 1.2 Success criteria

- **Functional parity:** Every feature listed in Section 3 is available with equivalent inputs, controls, and outputs.
- **Visual parity:** Layout, typography scale, color tokens, card styles, and chart semantics match the Streamlit app closely (Tailwind theme derived from existing injected CSS).
- **Data parity:** Supports `cgm_matrix.csv`, `patient_metadata.csv`, and `patient_reported_metrics.csv` (upload + optional dev loading from `public/data` or env URL).
- **Determinism:** Detection outputs match the Python reference when the same parameters and CSV rows are sent to the **reference backend** (see Section 7).

### 1.3 Non-goals (v1)

- Rewriting cohort scripts (`cohort_level.py`, `demo_pipeline.py`) in the UI unless explicitly scoped later.
- Replacing clinical copy with regulatory-approved labeling (keep demo / research framing).

---

## 2. Personas & use cases

| Persona | Primary use case |
|---------|------------------|
| Clinician / researcher | Upload CGM CSV, pick patient, tune detection layers, review daily traces and event tables. |
| Study coordinator | Upload metadata CSV, browse participant profiles (demographics, clinical, lifestyle). |
| Participant-facing demo | Upload pillars CSV, show radar, trends, and time series for self-reported gauges. |

---

## 3. Feature specification (parity with `SPIKES_app.py`)

### 3.1 Global shell

| ID | Requirement |
|----|-------------|
| G-1 | **Wide layout** with persistent **sidebar** (expanded by default). |
| G-2 | Sidebar **branding:** “SPIKES” accent + “Demo” (same visual hierarchy as Streamlit). |
| G-3 | **Tab navigation** (three routes or state): 🔬 CGM Spikes · 🧑‍⚕️ Patient Overview · 🌿 Lifestyle Pillars. |
| G-4 | **Data Upload** area (collapsible panel): three independent CSV uploads — CGM, Patient Information, Self Reported Pillars. Show success row counts after parse. |
| G-5 | **Column validation** for CGM: require `Client ID` and `Day`; derive patient list as unique sorted IDs. |

### 3.2 CGM Spikes tab

| ID | Requirement |
|----|-------------|
| C-1 | **Patient select** in sidebar (from CGM CSV). |
| C-2 | **Detection layer toggles:** Hard Spikes, Soft Spikes, Hard Dips, Soft Dips (defaults: hard on, soft off — match Streamlit). Tooltips with SD-tier explanation text. |
| C-3 | **Advanced parameters** (collapsible): FFT denoise cutoff (hours, slider 0.25–2.0, step 0.25, default 0.5), baseline window (2–8 h, step 0.5, default 5), sample interval select {5, 10, 15} min (default 5). |
| C-4 | **Show baseline** toggle (default on). |
| C-5 | **Analyse** primary button: until clicked, show instructional copy (“Select patient… press Analyse”). |
| C-6 | On Analyse: run **wide → long reshape** + **detect_events** equivalent with `mode=both`, `direction=both`, passing FFT/baseline/sample parameters (API contract in plan). |
| C-7 | **Filter displayed events** by active `(direction, tier)` pairs: `(up/down, high_confidence/sensitive)`. |
| C-8 | **Summary metric strip:** Spikes count, Dips count, Days analysed (unique calendar dates in trace), Mean confidence (`p_val` mean), Highest spike (mmol/L). If dips > 0, second row: Lowest dip (mmol/L). |
| C-9 | **Active layers** caption listing enabled layer labels; if none, warn and block. |
| C-10 | **Time of day:** three pie charts — Spikes by period, Dips by period, All events by period. Periods: Morning (6–11), Afternoon (12–17), Evening (18–23), Night (0–5). Values = **counts / n_days** (average per day). Colors: `#F59E0B`, `#EF4444`, `#6366F1`, `#1E3A5F`. Empty state if no events. |
| C-11 | **Expandable table** under pies: Period, Time Range, Total Spikes, Total Dips, Avg Spikes/Day, Avg Dips/Day. |
| C-12 | **Daily glucose traces:** For each day (group by `study_day` if present, else `date`), show header with day label and spike/dip counts badge. |
| C-13 | **Per-day chart** matching `build_day_figure` semantics: faint raw glucose, bold denoised line, optional dashed baseline (`baseline` or `baseline_fft`), hypo reference 3.9 mmol/L, event **axvspan** shading and vertical markers for filtered events only, peak scatter + annotations (full label for high_confidence tier). |
| C-14 | **Per-day event details** expander: table columns Type, Pipeline, Start, End, Peak, Confidence, Range, Extreme, Baseline, Closure (same renames as Streamlit). |
| C-15 | **Full event table** expander: same column set + `Day`; auto-expanded when total events ≤ 20. |

**Note:** Streamlit sets `show_event_component = False`; **v1 omits** the dual-panel “event component” subplot unless added as stretch.

### 3.3 Patient Overview tab

| ID | Requirement |
|----|-------------|
| P-1 | **WIP badge** visible in sidebar when this tab is active. |
| P-2 | Requires uploaded **Patient Information** CSV; otherwise show guided empty state. |
| P-3 | Resolve ID column: prefer `Client_ID`; else first column matching “client” or “id” in name (case-insensitive). |
| P-4 | Sidebar patient select for this tab. |
| P-5 | **Health Goal** block: quote style or “no goal” muted state. |
| P-6 | **Demographics card:** Age, Sex Assigned, Ethnicity — with **column aliases** for repo data (`Sex Assigned at Birth` → display as Sex Assigned, etc.). |
| P-7 | **Body measurements:** Height (m, 2dp), Weight (kg, 1dp), BMI (1dp), Waist (cm, 0dp), Waist:Height Ratio (3dp). |
| P-8 | **Clinical:** Blood Pressure, HbA1c, HbA1c Date, Medication. |
| P-9 | **Lifestyle:** Wearable Type, Chronotype — aliases for `Wearble Type` and `Night Owl / Morning Lark / Neither`. |
| P-10 | **Quick summary:** BMI category with color thresholds (<18.5 underweight blue, <25 normal green, <30 overweight amber, else obese red). “Data Source: CGM + Metadata” static label. |
| P-11 | Missing values render as em dash (—). |

### 3.4 Lifestyle Pillars tab

| ID | Requirement |
|----|-------------|
| L-1 | Requires uploaded pillars CSV; empty state if missing. |
| L-2 | Run **clean_pillars** equivalent: strip headers, drop empty IDs, coerce gauges, normalize trend strings, `day_index` = cumulative per patient + 1. |
| L-3 | Resolve `Client ID` column with fallback heuristic (same as Streamlit). |
| L-4 | Six **pillar cards** in one row: Health, Sleep, Nutrition, Movement, Stress, Connection — mean score, dominant trend (↑/→/↓ + label), delta; top border color from `PILLAR_COLORS`. |
| L-5 | **Negative Affect** card when negative stats exist; color by mean threshold (same logic as Streamlit). |
| L-6 | **Charts:** Pillar Balance (radar), Trend Distribution (stacked horizontal %), Gauges Over Time (multi-line), Negative Affect Over Time (area + line) — **pixel-level parity** optional; **data parity mandatory**. |
| L-7 | **Raw pillar data** expandable table for selected patient. |
| L-8 | **Data/schema note:** Repo CSV uses `* Gauge Change` columns; Python `pillar_analysis` expects `* Gauge Trend` for trend charts. PRD requires **support both** column naming in the port so demo data works without manual rename. |

---

## 4. Design system (extracted from Streamlit CSS)

| Token | Value / usage |
|-------|------------------|
| Text primary | `#1a1a2e` |
| Text muted | `#6b7280` |
| Accent / brand | `#4a90d9` |
| Border | `#e2e6ec` |
| Spike metric | `#e94560` |
| Dip metric | `#3B7DD8` |
| Confidence accent | `#e9a045` |
| Glucose accent | `#45e980` |
| Card background | `#f8f9fa` / `#ffffff` |
| Pillar trend colors | improving `#22c55e`, staying `#6b7280`, declining `#ef4444` |
| Event tier colors | Match `_EVENT_STYLES` in `SPIKES_app.py` (hard spike `#D32F2F`, soft `#F57C00`, hard dip `#0D47A1`, soft `#42A5F5`). |

Typography: sidebar brand ~1.35rem / 800; section headers ~1.6rem / 700; body ~0.88–0.9rem.

---

## 5. Data model (reference files in `data/`)

| File | Shape | Role |
|------|--------|------|
| `cgm_matrix.csv` | `Client ID`, `Day`, `00:00` … `23:55` (288 five-minute columns, mmol/L, sparse OK) | CGM wide format → reshape → detection |
| `patient_metadata.csv` | One row per patient; mixed clinical/lifestyle text | Patient Overview |
| `patient_reported_metrics.csv` | One row per patient per day; gauge + change/trend columns; `Negative Gauge` | Lifestyle Pillars |

**ID alignment:** CGM + pillars use `Client ID`. Metadata file uses `Client ID` in repo; app also accepts `Client_ID` naming.

---

## 6. Accessibility & UX

- All toggles and file inputs keyboard operable; visible focus rings (Tailwind `ring-2`).
- Charts: expose summaries in text or tables where possible (pies + event tables partially cover this).
- Upload: announce parse errors (invalid CSV, missing required columns) with actionable messages.

---

## 7. Architecture constraint (critical)

The current SPIKES detection pipeline is implemented in **Python** (`reshape_wide_to_long`, `detect_events` in `spike_analysis/spike_detection.py`) with **SciPy FFT**. A **pure Vite SPA cannot call this code** without:

- **Recommended:** A **Python backend** (FastAPI or similar) exposing REST (or WebSocket) endpoints that run the **same functions** and return JSON (events, annotated series per day). The Vite app renders charts from JSON.

**Alternatives (higher risk):** Pyodide/WebAssembly bundling Python + scientific stack (large payload, slower load); or TypeScript rewrite of the detector (must be validated for numerical parity).

**PRD assumption for v1:** **Python API + Vite frontend** unless explicitly changed.

---

## 8. Out of scope / future

- User accounts, persistence of uploads to cloud.
- Real-time CGM device streaming.
- Event component subplot (`show_event_component`) enabled in UI.
- Mixed-effects modeling or cohort views.

---

## 9. Open questions

1. Hosting: single repo monorepo (Vite + FastAPI) vs separate deployables?
2. Authentication required for deployment?
3. Should “demo mode” auto-load `data/*.csv` from repo in development only?

---

## 10. Acceptance checklist (sign-off)

- [ ] All sections 3.1–3.4 behaviors verified against `SPIKES_app.py` with same three CSVs.
- [ ] Visual review against Streamlit screenshots.
- [ ] Backend returns bit-identical or documented-tolerance parity for detection on golden test fixtures.
