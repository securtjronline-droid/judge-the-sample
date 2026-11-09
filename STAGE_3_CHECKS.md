# Stage 3 implementation and checks

This is the Stage 3 verification snapshot. See STAGE_4_CHECKS.md for the current implementation and checks.

## Confirmed design and scope

Approach A: a guided walkthrough using the existing chronological grid. The user confirmed the proposed `visit_type` stratification column in the conversation and requested implementation. It is the default; the starter's other observable group columns are available for explicit user selection.

The original CSV, assignment brief, and student decision notes remain unchanged. No Stage 4 experiments or Stage 5 hypothesis/controls are supplied.

## Statistical behavior

- Simple random: exactly n distinct rows without replacement, with the ordinary sample mean.
- Whole-number systematic: k = N/n; seeded integer start r in 1..k; rows r + j × k.
- Fractional systematic: seeded u in (0, k]; rows ceil(u + j × k). The start is represented as an exact rational fraction and BigInt ceiling arithmetic implements the rule without floating-point clipping. Both designs return exactly n distinct rows.
- Stratified: full proportional quotas n × Nh/N, then bounded largest-remainder allocation. At least one row per stratum, no more than Nh, total exactly n. Ties use first appearance in the CSV. Minimum-one corrections remove from the most overallocated eligible stratum when necessary.
- Within each stratum: seeded SRS without replacement. Estimate = Σ (Nh/N) × stratum sample mean.
- If n is smaller than the number of strata, the app displays every stratum and its population weight, explains infeasibility, and withholds the sample and estimate. It never changes n automatically; the explicit suggested-size button changes the shared n only when clicked.
- Valid control changes update calculations immediately. Invalid settings withhold results rather than showing a previous result as current.
- n and seed persist across method switches. Default n = 100; seed = 2026.

## Display

Method colors: electric blue for simple random, turquoise for systematic, violet for stratified. Coral outlines identify selected rows; yellow marks the inspected row and true-mean reference. Stratum labels and patterns supplement color. The grid remains in original CSV row order.

The walkthrough identifies the rule, actual systematic interval/start/design, first selected positions, and the stratum allocations and weights. Clicking a traced row inspects that original record without changing membership.

Stratified results are labeled population-weighted estimates. Single-sample error is distinguished from repeated-sampling bias. Colors do not rank methods.

## Verification

| Check | Result |
| --- | --- |
| Statistical / data-integrity tests | 27 passed, 0 failed |
| DOM integration test | 1 passed, 0 failed |
| Exactly n unique SRS/systematic rows at 1, 10, 100, 640 | Passed |
| Additional systematic boundaries at n = 9999 and n = N | Passed |
| Same seed and settings reproduce all three methods | Passed |
| Whole-number and fractional start/interval rules | Passed |
| Largest-remainder allocations, minimum-one, and capacity limits | Passed |
| Weights sum to 1 | Passed within floating-point precision |
| Population-weighted estimate on known synthetic data | Passed |
| Original CSV SHA-256 and row identifiers/order | Passed |
| Production build | Passed |
| Visual browser / mobile review | Unverified: managed preview service is unavailable |

The DOM check covers the hospital entry, chart keyboard tabs, all three method controls, shared n/seed, fractional n = 640, weighted results, all-strata display when n is infeasible, explicit recovery, row inspection, invalid inputs, and pagination. It verifies canvas drawing commands with a test context; it is not a visual browser or pixel test.

GitHub Actions runs these checks and the build on Node 20.19.0 and Node 24. See the live workflow result for its status.

The student's remaining hands-on task is to use the method explanations and inspect selections in the updated local app, rather than repeat the automated test suite manually.
