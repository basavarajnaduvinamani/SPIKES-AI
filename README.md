# SPIKES: Clinical Telemetry & CGM Signal Processing Platform

[![Hackathon Winner](https://img.shields.io/badge/Award-Winner%20%7C%20HealthTech%20AI%20Hackathon-gold.svg)](https://www.birmingham.ac.uk/)
[![Institution](https://img.shields.io/badge/University-University%20of%20Birmingham-red.svg)](https://www.birmingham.ac.uk/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Frontend](https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript%20%7C%20Vite%20%7C%20Tailwind-61DAFB.svg)](https://vitejs.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%20%7C%20SciPy-009688.svg)](https://fastapi.tiangolo.com/)

An end-to-end clinical telemetry and physiological data analytics platform developed for the **University of Birmingham HealthTech AI Hackathon (Winner)**. 

SPIKES translates high-frequency Continuous Glucose Monitor (CGM) time-series data, patient clinical metadata, and self-reported longitudinal lifestyle metrics into actionable clinical intelligence through advanced signal processing and a modern clinician dashboard.

---

## 🔬 Core System Architecture & Features

### 1. High-Frequency CGM Signal Processing & Anomaly Detection
- **Time-Series Ingestion:** Ingests continuous 5–15 minute interval glucose monitoring feeds across multi-week observation windows.
- **Fast Fourier Transform (FFT) Denoising:** Applies frequency-domain filtering to strip sensor noise, isolate circadian baselines, and reconstruct smoothed glycemic trajectories.
- **Dual-Threshold Event Classification:** Algorithmically detects and stratifies glycemic anomalies into **Hard/Soft Spikes** and **Hard/Soft Dips**, computing statistical significance ($p$-values), peak velocity, area under the curve (AUC), and duration.
- **Diurnal Trace Visualization:** Overlays annotated spike thresholds on 24-hour daily cycle graphs to identify recurrent postprandial volatility.

### 2. Multi-Pillar Lifestyle Correlation Engine
- **Longitudinal Tracking:** Synchronizes time-series glycemic excursions with self-reported lifestyle pillars: **Sleep, Nutrition, Movement, Stress, Connection, and General Health**.
- **Cohort-Level Statistics:** Computes Pearson/Spearman correlation matrices, daily cohort heatmaps, and multivariate regressions to determine primary behavioral drivers of glycemic instability.
- **Multi-Factor Radar Profiling:** Generates patient balance radars to assist clinicians during lifestyle interventions.

### 3. Full-Stack Interactive Clinician Dashboard
- **Modern Web Interface:** Built with **React, TypeScript, Vite**, and styled using **Tailwind CSS**.
- **Interactive Telemetry Views:** Real-time filtering by patient cohort, date ranges, and anomaly severity.
- **Microservice Backend:** Powered by **FastAPI** and **SciPy/NumPy** for high-throughput metric computation.

---

## 📁 Repository Structure

```text
SPIKES-AI/
├── docs/                                    # Hackathon reports and slide decks
│   ├── healthAI_hackathon_report-1.pdf      # Detailed clinical hackathon submission report
│   └── Team SPIKES.pptx                     # Official presentation deck
├── spikes_app/
│   └── web/                                 # Modern React + TypeScript + Vite frontend
│       ├── src/                             # UI components, telemetry charts, dashboards
│       ├── package.json                     # Frontend dependencies
│       └── vite.config.ts                   # Vite configuration
├── spike_analysis/                          # Core spike detection algorithms & notebooks
│   ├── spike_detection.py                   # Algorithmic spike/dip identification
│   ├── High_Confidence_Spike.ipynb          # Statistical confidence threshold analysis
│   └── Spike_Pipeline.ipynb                 # End-to-end signal processing walkthrough
├── preprocessing/                           # Data imputation & feature engineering
│   └── process_spikes.py                    # Matrix transformation & normalization
├── imputed/                                 # Imputed clinical & telemetry datasets
├── output/                                  # Generated analytics, heatmaps, and figures
├── SPIKES_app.py                            # Streamlit/FastAPI integrated application
├── cohort_level.py                          # Cohort-wide aggregation & variance metrics
├── pillar_analysis.py                       # Lifestyle pillar correlation analyzer
├── demo_pipeline.py                         # End-to-end command-line pipeline runner
├── requirements.txt                         # Python dependencies
├── .gitignore                               # Environment & artifact exclusions
└── README.md                                # Comprehensive system documentation
```

---

## ⚡ Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend & Signal Processing Pipeline Setup

```bash
# Clone the repository
git clone https://github.com/basavarajnaduvinamani/SPIKES-AI.git
cd SPIKES-AI

# Create and activate virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the complete demo pipeline
python demo_pipeline.py

# Launch the interactive analysis app
streamlit run SPIKES_app.py
```

### 2. Frontend Clinician Web Dashboard Setup

```bash
# Navigate to the web application directory
cd spikes_app/web

# Install dependencies
npm install

# Start the local development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the dashboard.

---

## 📊 Sample Visualizations

The pipeline generates publication-ready clinical analytics stored in `output/`:
- `daily_heatmap.png`: Diurnal glucose density distributions across observation days.
- `correlation_heatmap.png`: Cross-correlation between glycemic spikes and lifestyle pillars.
- `scatter_top_pillars.png`: Regression plots identifying primary behavioral drivers.
- `spikes_vs_pillars_timeseries.png`: Synchronized multi-trace time-series overlay.

---

## 🏆 Awards & Recognition

- **Winner, HealthTech AI Hackathon (2026)** — Hosted by the **University of Birmingham**.
- Evaluated on signal processing rigor, clinical interpretability, and full-stack software architecture.

---

## 👨‍💻 Team & Authors

**Team SPIKES**  
- **Basavaraj A Naduvinamani** — Joint M.S. Data Science & AI (*IIT Madras & University of Birmingham*)  
  [LinkedIn](https://linkedin.com/in/basavarajnaduvinamani) • [GitHub](https://github.com/basavarajnaduvinamani)

---

## 📄 License
This project was developed for academic and clinical research purposes under the HealthTech AI Hackathon.
