# Northstar Memorial Hospital — Sampling Lab

A browser-only educational EHR and sampling app using React, Vite, JavaScript, Node.js, and npm.

**Current stage: Stage 2 — population visualization.** Open a simulated visit chart from the hospital dashboard, navigate to Quality & Safety / Research & Analytics, and launch the Sampling Lab.

The lab shows all **10,000 simulated appointments**, one grid cell per original CSV row, and a clearly labeled **temporary simple random sample of 100**. Seed controls, the row inspector, magnified row-order strip, selected-records table, estimate, and true mean use the same shared calculation module.

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
- **Temporary sample:** 100 distinct rows without replacement. The shared module uses a partial Fisher–Yates shuffle and seeded Mulberry32 stream, with rejection-based integer draws.
- **Default seed:** 2026. The same displayed seed and settings reproduce the same selection and estimate. Different seeds are not guaranteed to produce different samples.
- **Estimate:** mean waiting time of the selected records. The true mean uses every CSV row; error = estimate minus true mean.

Data provenance and reuse details are in `data/README.md`. The original CSV is unchanged.

## Stage 2 checks for the student

1. Open a simulated chart, then Quality & Safety / Research & Analytics, then the Sampling Lab.
2. Confirm the temporary sample label, 100 distinct selected appointments, displayed seed, estimate, and labeled true mean.
3. Inspect any CSV row by pointer, touch, or the row-number form. Inspection never changes sample membership.
4. Match a selected record with its grid cell, magnified strip, and selected-records table.
5. Change the seed, then restore the original seed and confirm the same rows return.

The demo patient identity is fictional navigation context. The source CSV contains appointment records, not named patient histories.

## Staged workflow

- **Stages 1–2:** student notes and the grid choice are in `DECISIONS.md`; the Stage 2 app is implemented.
- **Stage 3:** guided interactions are planned. Systematic and stratified sampling are not implemented in the JavaScript app yet. The stratification column still needs final student confirmation.
- **Stage 4:** aligned histograms are planned. Resolve the guide/repository sample-size and repetition-count difference before implementation.
- **Stage 5:** controls await an independently written, dated hypothesis; no challenge is preselected.
- **Stage 6:** the student runs investigations and completes findings and evidence.

The existing Python/Streamlit source is retained for reference. The new launcher runs React. Legacy code does not mark later JavaScript stages complete.

## Source map

| Path | Purpose |
| --- | --- |
| `src/App.jsx` | Hospital, chart, research access, and Stage 2 lab |
| `src/components/PopulationGrid.jsx` | Full-population canvas and inspection marker |
| `src/lib/population.js` | CSV parsing and validation |
| `src/lib/sampling.js` | Shared seeded randomness, SRS, and means |
| `tests/sampling.test.js` | Statistical and data-integrity checks |
| `tests/ui.test.js` | DOM integration check of navigation and lab controls |
| `STAGE_2_CHECKS.md` | Verification results and remaining review |
| `run_app.sh` | Bash launcher and dependency setup |
| `DECISIONS.md` | Student-owned notes, results, and hypothesis |
| `AGENT_BRIEF.md` | Assignment workflow and statistical rules |

Stage 2 includes source and local running instructions. Public deployment is separate.
