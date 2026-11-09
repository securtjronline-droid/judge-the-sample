# Northstar Memorial Hospital — Sampling Lab

A browser-only educational EHR and sampling app using React, Vite, JavaScript, Node.js, and npm.

**Project status: app implemented (v0.5.0); Stage 4–5 experiments run, evidence exported, and Stage 6 AI-assisted reflection saved.** The hospital entry flow, Stage 3 explorer, and Stage 4 experiments remain available. Open Challenge from the sidebar or `/#challenge`.

The lab shows all **10,000 simulated appointments**, one grid cell per original CSV row. A guided walkthrough offers simple random, systematic, and stratified sampling with shared n and seed controls. The default n is 100; the confirmed default stratification column is `visit_type`. Grid highlights, inspection, selected records, estimates, and true mean use the shared calculation module.

## Run locally

Use Node.js **24 LTS** with npm and a Bash terminal (macOS/Linux, Git Bash, or WSL). The pinned Vite version also supports Node.js 20.19+ and 22.12+.

From the project directory:

```bash
bash run_app.sh
```

Open **http://127.0.0.1:5173**. Stop with **Ctrl+C**. The launcher enters its project directory, checks Node, installs locked dependencies when needed, and starts Vite. Another port: `PORT=5174 bash run_app.sh`.

Separate development commands:

```bash
npm ci
npm run check:data
npm run test:stats
npm run test:ui
npm run dev
npm run build
```

The build output is `dist/`. No backend, account, database, or API key is required. Fonts are bundled locally.

## Population and reproducibility

- **Scenario:** clinic waiting times, `data/clinic_visits.csv`.
- **One row:** one simulated appointment. The population is this file, not all clinics or patients.
- **Target:** `wait_time`, in minutes.
- **Order:** week, weekday Monday–Friday, then slots 1–20. Each 100-cell horizontal grid row represents one week.
- **Simple random:** n distinct rows without replacement, using a partial Fisher–Yates shuffle and a seeded Mulberry32 stream with rejection-based integer draws.
- **Systematic:** if k = N/n is whole, use an integer start from 1 to k and rows r + j × k. Otherwise use u in (0, k] and rows ceil(u + j × k). Exact rational arithmetic avoids floating-point boundary errors. Both return exactly n distinct rows.
- **Stratified:** compute full proportional quotas n × Nh/N, apply largest-remainder allocation with minimum-one and capacity bounds, then SRS within each stratum. Ties follow the groups' first appearance in the original CSV. n below the stratum count produces a clear infeasibility message and no estimate.
- **Default seed:** 2026. The same displayed seed and settings reproduce the same selection and estimate. Different seeds are not guaranteed to produce different samples.
- **Estimate:** simple random and systematic use the sample mean. Stratified uses Σ (Nh/N) × stratum sample mean, not the pooled mean. The true mean uses every CSV row; single-sample error = estimate minus true mean.

Data provenance and reuse details are in `data/README.md`. The original CSV is unchanged.

## Stage 3 checks in the running app

1. Open a simulated chart, then Quality & Safety / Research & Analytics, then the Sampling Lab.
2. Switch between all three methods. n defaults to 100 and stays the same when switching; every result shows its seed, estimate, and labeled true mean.
3. Use n = 1, 10, 100, and 640. Simple random and systematic return exactly n rows. An infeasible stratified n remains unchanged until you explicitly choose a feasible size or another column.
4. Read the systematic interval, start, and design. Predict the next selected row numbers, then compare with the trace and selected-records table. Fractional n values are supported.
5. Inspect the stratified allocation table: allocations total n, weights total 1, and the displayed estimate uses the population weights.
6. Inspect any CSV row by pointer, touch, or the row-number form. Inspection never changes sample membership.
7. Change a seed, then restore it; the same settings reproduce the same selected IDs and estimate.

The demo patient identity is fictional navigation context. The source CSV contains appointment records, not named patient histories.

## Stage 4: run and record your investigation

1. Open **Experiments** (or the local route `/#experiments`).
2. Choose a Monte Carlo seed, 1,000–10,000 repetitions (default 1,000), and the observable stratification column (default `visit_type`).
3. Click **Run experiments** yourself. Opening the page never runs an investigation.
4. Experiment A compares all three methods at **n = 100**. Experiment B uses SRS at **n = 1, 10, 100, and 640**, covering both guide/starter size sets approved in the conversation.
5. Whole-number systematic sampling enumerates all N/n starts and is labeled **Exact**, with no seed. Other required results are seeded **Monte Carlo**. The same SRS n = 100 result is reused.
6. Read aligned distributions, true-mean and mean-estimate references, bias, SD of estimates, and RMSE in minutes. Histograms use probability per shared bin, allowing exact and Monte Carlo counts to differ. Scales are shared within each experiment.
7. Inspect accessible bin tables or allocation details, then download the six unique current results as CSV and record your own findings in `DECISIONS.md`.

Computation runs in a browser worker. Canceling or changing settings terminates the current job and clears previous results. Rerunning replaces the current result set; it never appends or pools conditions. No results are prefilled or generated during setup. Repeated-sampling tests use synthetic populations.

## Staged workflow

- **Stages 1–2:** the chosen chronological grid and hospital entry flow are retained.
- **Stage 3:** Approach A (guided walkthrough) and the user-confirmed `visit_type` default are implemented. The controls also present the starter's other observable group columns, `weekday` and `slot`, for user selection.
- **Stage 4:** aligned histograms, worker-based experiments, metrics, and CSV export are implemented. The approved SRS sizes 1/10/100/640 and at least 1,000 Monte Carlo repetitions cover the two assignment versions. The student runs and interprets the investigation.
- **Stage 5:** the approved AI-assisted periodic-order challenge is implemented and was run by the student. Original and modified conditions use n = 100; results are saved in `evidence/northstar-stage5-seed-2026.csv`. The hypothesis was not independently authored.
- **Stage 6:** results tables, three findings, challenge evaluation, and AI-use disclosure are saved in `DECISIONS.md` and were reviewed by the student. The reflection is AI-assisted.

The existing Python/Streamlit source is retained for reference. The Bash launcher runs React. The implemented app and written evidence are available in this repository. The assignment's independent-authorship requirements are not satisfied by the AI-assisted hypothesis and reflection; disclosure documents this limitation and does not replace those requirements.

## Source map

| Path | Purpose |
| --- | --- |
| `src/App.jsx` | Hospital overview, chart, and research access |
| `src/components/SamplingLab.jsx` | Shared method controls, grid, inspector, and results |
| `src/components/MethodWalkthrough.jsx` | Selection explanations, systematic trace, and stratified allocation table |
| `src/components/Experiments.jsx` | User-run Stage 4 experiments and Stage 5 challenge results |
| `src/components/SamplingDistribution.jsx` | Data-driven histograms, references, and accessible bin tables |
| `src/workers/experiments.worker.js` | Background calculation and progress messages |
| `src/components/PopulationGrid.jsx` | Full-population canvas and inspection marker |
| `src/lib/population.js` | CSV parsing and validation |
| `src/lib/sampling.js` | Shared seeded randomness, SRS, and means |
| `tests/sampling.test.js` | Statistical and data-integrity checks |
| `tests/experiments.test.js` | Repeated estimates, summaries, enumeration, histograms, and export checks |
| `tests/ui.test.js` | DOM integration check of navigation and lab controls |
| `tests/experiments-ui.test.js` | Run/cancel lifecycle, result rendering, stale-result rejection, and export |
| `STAGE_2_CHECKS.md` | Verification results and remaining review |
| `STAGE_3_CHECKS.md` | Stage 3 verification snapshot |
| `STAGE_4_CHECKS.md` | Stage 4 implementation and verification snapshot |
| `STAGE_5_CHECKS.md` | Stage 5 implementation and verification snapshot |
| `evidence/` | Student-exported Stage 4 and Stage 5 results |
| `run_app.sh` | Bash launcher and dependency setup |
| `DECISIONS.md` | Notes, results, AI-assisted hypothesis and reflection, and assistance disclosure |
| `AGENT_BRIEF.md` | Assignment workflow and statistical rules |

Source and local running instructions are included. Public deployment is separate. If using a ZIP download, obtain the updated source after merging this version; refreshing a browser does not update an older folder on your computer.

## Stage 5: fixed periodic-order challenge

Open `/#challenge`. The comparison keeps n = 100 for all three methods and compares the original CSV order against a copy sorted into 100 wait-time bands, then interleaved by band. Every appointment and wait-time value is preserved; the original CSV is never changed. Inspect the first ten records before running. Turn periodic ordering off to compare the baseline against an unchanged-order control.

Click **Run experiments**, inspect the six distributions and condition-specific bias, SD, and RMSE, then download the results CSV. Both conditions share chart axes but retain separate summaries and true-mean references. Whole-number systematic sampling enumerates every possible start; other conditions use the displayed seeded Monte Carlo settings.

The prediction and challenge design are explicitly **AI-assisted** and do not meet an independent-authorship requirement. The implementation does not claim predicted differences are results. The student ran the investigation and exported its results. The results, AI-assisted interpretation, and assistance disclosure are saved in `DECISIONS.md`. See `STAGE_5_CHECKS.md` for verification and review limitations.

## Submission evidence and review status

- [Stage 4 results](evidence/northstar-stage4-seed-2026.csv): method comparison and sample-size experiments.
- [Stage 5 results](evidence/northstar-stage5-seed-2026.csv): original versus periodic ordering, with separately labeled conditions.
- [Results and reflection](DECISIONS.md): population definition, design choices, results tables, three findings, challenge evaluation, and AI-use disclosure.
- Verification: 43 statistical tests and 2 DOM integration tests passed, along with data integrity, production build, and Bash syntax checks. GitHub CI passed on Node 20.19 and 24. Full browser/mobile visual review remains unverified.

Stage 6 is written evidence in `DECISIONS.md`, not a separate app form. The lock icon on the reminder does not block access or indicate missing saved work. The app does not synchronize completion status with GitHub notes. A public deployment is not included; reviewers can download this repository and run `bash run_app.sh` with a supported Node.js version and npm installed.
