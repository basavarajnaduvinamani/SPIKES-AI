# Implementation Plan — SPIKES Vite + Tailwind (`spikes_app/`)

This plan translates `PRD.md` into executable phases. **Reference UI:** `SPIKES_app.py`. **Reference data:** `../data/*.csv`.

---

## 0. Prerequisites & decisions

| Decision | Recommendation |
|----------|----------------|
| Stack | **Vite 5+**, **React 18+**, **TypeScript**, **Tailwind CSS 3.4+**, **React Router** (or TanStack Router) for three views. |
| State | **Zustand** or **React context** for uploaded files + parsed tables + selected patient + analysis results (keep simple). |
| Charts | **React + canvas/SVG:** e.g. **Visx**, **Recharts**, or **uPlot** — choose one stack early. Matplotlib cannot run in browser; **rebuild charts** from series JSON. |
| Compute | **FastAPI** service in `spikes_app/server/` (or repo root `api/`) importing existing `spike_analysis` + `pillar_analysis` (add parent path or pip install local package). |
| Monorepo layout | `spikes_app/web/` (Vite), `spikes_app/api/` (Python), shared `PRD.md` / `plan.md` at `spikes_app/`. |

**Golden rule:** Do not reimplement `detect_events` in TypeScript for v1 unless backend route is blocked.

---

## Phase 1 — Scaffold & design tokens

1. Create Vite React-TS app under `spikes_app/web/`.
2. Add Tailwind with `tailwind.config.js` — extend theme with colors/spacing from PRD Section 4 (`brand`, `spike`, `dip`, etc.).
3. Add global layout: `AppShell` = sidebar + main; match wide layout proportions (~sidebar 280–320px).
4. Implement CSS component classes mirroring Streamlit injections: `SidebarBrand`, `MainHeader`, `MetricCard`, `PatientProfile`, `PillarCard`, `DayHeader`, `WipBadge`.
5. Add React Router routes: `/cgms`, `/overview`, `/pillars` (or query param `?tab=` if preferred).

**Exit:** Empty shell navigates between three tabs; branding visible.

---

## Phase 2 — Data ingestion (client)

1. **File upload** component (three zones or one panel with three inputs) reading `File` → text → parse.
2. Use **Papa Parse** or similar for CSV; handle UTF-8.
3. **CGM validation:** ensure `Client ID`, `Day` exist; list patients.
4. **Metadata normalize map:** aliases for `Sex Assigned at Birth`, `Wearble Type`, `Night Owl / Morning Lark / Neither` → UI labels expected by PRD.
5. **Pillars:** optional preprocessing hook for `* Change` vs `* Trend` columns (normalize to internal model before API or shared TS util).
6. Dev-only: `import.meta.env.DEV` + optional **“Load sample data”** button fetching `/data/cgm_matrix.csv` from `web/public/data/` (copied from repo `data/`).

**Exit:** Upload three files; state holds parsed row arrays + validation messages.

---

## Phase 3 — Python API

1. Create `spikes_app/api/main.py` (FastAPI).
2. **POST `/api/reshape`** — body: wide CGM rows (or file upload multipart). Response: long-format samples (or too large — prefer **session/job** pattern).

   **Better pattern for large CGM:**  
   - **POST `/api/analyse`** multipart: `cgm.csv` + JSON params `{ patientId, fftCutoffHours, baselineWindowHours, sampleStepMin, layers }`.  
   - Server runs `pd.read_csv` → `reshape_wide_to_long` → `detect_events` → returns:
     - `events`: array of event records (JSON-serializable datetimes → ISO strings).
     - `annotatedByDay`: array of `{ studyDayOrDate, points: [{ t, glucose_raw?, glucose_denoised?, baseline?, ... }] }` **or** full long frame split by day (keep payload size in check).

3. **POST `/api/pillars/clean`** — optional if cleaning stays client-side; **recommended** to reuse `clean_pillars` server-side for parity.
4. **POST `/api/pillars/summary`** — returns `patient_summary` dict JSON.

5. CORS: allow `http://localhost:5173`.

6. **Dockerfile** (optional): single image with Python + API; Vite built to static served by nginx or API serves `dist/`.

**Exit:** `curl` or Thunder Client can analyse one patient and return JSON matching frontend types.

---

## Phase 4 — Types & API client (web)

1. Define TypeScript interfaces: `CgmRowWide`, `DetectedEvent`, `AnnotatedPoint`, `PatientSummary`, etc.
2. `apiClient.analyse()` wraps `fetch` / `axios` with error handling.
3. On **Analyse** click: show loading overlay; stream or await full JSON; store in Zustand.

**Exit:** CGM tab triggers real detection against local API.

---

## Phase 5 — CGM tab UI parity

1. Rebuild **controls grid** (toggles + advanced expander + baseline + analyse).
2. **Metric strip** as five cards + conditional sixth (lowest dip).
3. **Pie charts:** three components; feed with aggregated counts from events + `nDays` from annotated metadata returned by API.
4. **Expandable** time-of-day summary table.
5. **Daily charts:** for each day, render glucose chart:
   - Plot denoised + raw + baseline + 3.9 line.
   - For each **filtered** event, draw shaded interval (semi-transparent rects in chart coordinates) + vertical lines + peak marker.
   - Implement time axis as **time-of-day** (duplicate 24h for each day or use absolute timestamps from API).

6. **Per-day details** collapsible table; **full event** table expander.

**Exit:** Side-by-side screenshot comparison with Streamlit for one patient (`SPIKES-001` or `SPIKES-021`).

---

## Phase 6 — Patient Overview tab

1. Port all cards and field formatting (number formats, em dash).
2. BMI category color logic.
3. WIP badge in sidebar when route active.

**Exit:** Metadata CSV from `data/patient_metadata.csv` renders correctly with aliases.

---

## Phase 7 — Lifestyle Pillars tab

1. Call `/api/pillars/summary` or bundle cleaning + summary in one endpoint.
2. Six cards + negative card.
3. Implement charts:
   - **Radar:** six axes, mean values 0–10.
   - **Trend distribution:** horizontal stacked bar % (three segments × six pillars).
   - **Time series:** multi-line `day_index` vs gauges.
   - **Negative gauge:** area under line.

4. Raw table expander (sortable optional).

**Exit:** `patient_reported_metrics.csv` produces visible trends when `* Change` columns mapped to trend model.

---

## Phase 8 — Polish & QA

1. Error boundaries; toast on API failure.
2. **E2E:** Playwright — upload → analyse → assert metrics > 0 for known fixture.
3. **Parity test:** Python script compares Streamlit-exported event count vs API JSON for fixed patient (CI optional).
4. README in `spikes_app/` with `npm run dev`, `uvicorn` command, env vars.

---

## File structure (target)

```
spikes_app/
├── PRD.md
├── plan.md
├── README.md
├── api/
│   ├── main.py
│   ├── requirements.txt   # fastapi, uvicorn, pandas, numpy, scipy, python-multipart
│   └── ...
└── web/
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── index.html
    └── src/
        ├── App.tsx
        ├── components/
        ├── routes/
        ├── lib/api.ts
        └── styles/
```

---

## Risk register

| Risk | Mitigation |
|------|------------|
| Large CGM payload over JSON | Server-side session id + chunked download; or gzip; or analyse on server only return aggregates + per-day downsampled series for plot. |
| Chart parity vs Matplotlib | Accept minor visual diff; lock color/stroke/alpha in design tokens. |
| `detect_events` param mismatch | API passes exact kwargs as in `SPIKES_app.py` L1137–1144. |
| Pillar trend columns mismatch | Normalization layer (PRD L-8). |

---

## Order of execution (suggested)

`Phase 1 → 3 (stub API) → 4 → 5 → 2 polish → 6 → 7 → 8`

(Phase 3 early to unblock chart data shape; Phase 2 can parallel once API response schema is frozen.)

---

## Next step after this document

1. Freeze **Open questions** in PRD Section 9.  
2. Scaffold `web/` and `api/` per Phase 1 + 3 skeleton.  
3. Define OpenAPI schema for `/api/analyse` response (generate TS types via `openapi-typescript`).
