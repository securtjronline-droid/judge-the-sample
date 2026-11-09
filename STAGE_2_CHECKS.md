# Stage 2 implementation and verification

This is the Stage 2 verification snapshot. See STAGE_3_CHECKS.md for the current method explorer and checks.

## Implemented

- Node/npm setup with pinned dependencies and a lockfile.
- React + Vite browser app.
- Hospital overview → simulated visit chart → Quality & Safety / Research & Analytics → Sampling Lab.
- Chronological grid with one mark for each of the 10,000 CSV appointments.
- Clearly labeled temporary SRS of 100 without replacement.
- Shared seeded calculation module; selected IDs, estimate, true mean, and error use the same sample.
- Pointer/touch and keyboard row inspection, magnified row-order strip, and selected-record pagination.
- Locally bundled fonts and responsive styles, including reduced-motion support.
- Bash launcher that enters the project directory and installs locked dependencies when needed.

## Checks completed in the development environment

| Check | Result |
| --- | --- |
| Node.js version | 24.22.1 |
| npm version | 11.9.0 |
| npm dependency installation / lockfile | Passed |
| Statistical and data-integrity tests | 12 passed, 0 failed |
| DOM integration test | 1 passed, 0 failed |
| Dataset loading / original row identifiers | Passed |
| Production build | Passed |
| Bash syntax | Passed |
| Launcher dependency setup and live HTTP response | Passed |
| npm run dev within the launcher | Served app HTML and transformed React source successfully |
| Visual browser and mobile review | Unverified: the managed preview service is unavailable |

The statistical tests cover unique SRS rows at n = 1, 10, 100, 640, and 10,000; reproducibility; known synthetic means; sample/estimate agreement; invalid inputs; and the supplied CSV's SHA-256.

The DOM integration test covers the hospital-to-lab journey, chart keyboard tabs, record inspection without changing membership, full-grid drawing commands, seed restoration, invalid seed handling, and selected-record pagination. Canvas drawing calls are checked with a test context; this is not a pixel-level or visual browser test.

GitHub Actions runs the tests and build on Node 20.19.0 and Node 24. Its live status is separate from the local results above.

## Still pending

- The student's hands-on Stage 2 checks in the running app.
- Stage 3 confirmation of the stratification column, followed by systematic/stratified implementation and their correctness checks.
- Stage 4 assignment-version clarification, implementation, and student-run experiments.
- Stage 5 independently written hypothesis and chosen controls.
- Student findings and final evidence.

The original data, assignment brief, and decision notes are unchanged by this implementation. No later-stage results were generated.
