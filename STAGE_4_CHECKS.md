# Stage 4 implementation and verification

## Approved presentation and settings

The user's saved presentation uses aligned histograms. In the conversation, the user approved:

- Experiment A: simple random, systematic, and stratified sampling at n = 100.
- Experiment B: simple random sampling only, at n = 1, 10, 100, and 640, covering the guide and repository size sets.
- At least 1,000 seeded Monte Carlo repetitions per required condition (default 1,000; UI supports up to 10,000).
- Exact enumeration of every start for whole-number systematic sampling, with no seed.

The baseline is the original CSV. The existing guided explorer and hospital entry flow are retained. Original data, assignment brief, and student notes are unchanged.

## Behavior

Opening Stage 4 shows settings and an empty results area. Experiments start only when the student clicks **Run experiments**. No clinic experiment was run during implementation or testing.

The shared JavaScript sampling module computes the true mean, samplers, estimators, repeated estimates, and summaries. Repeated sampling reuses the same selection kernels as Stage 3. Stratum populations and allocations are prepared once per condition.

- Bias = mean of estimates − true mean.
- SD = square root of mean squared deviations from the mean estimate; divisor is the number of estimates/starts.
- RMSE = square root of mean squared errors relative to the true mean.
- All three summaries retain the target's original unit, minutes.
- Whole-number systematic enumerates every equally likely start once. On the clinic population at n = 100, that is 100 starts.
- Other required conditions use Monte Carlo, labeled with seed and repetition count.
- The exact SRS n = 100 result object is reused in both experiments, avoiding a second run.

The browser worker reports progress. Canceling, changing settings, leaving the page, or starting a replacement run terminates the active worker. Request IDs and worker identity reject stale messages. No partial or old result is shown as current.

## Presentation and evidence

Seven histogram panels display the two experiments, representing six unique current results. Scales and bin edges are shared within an experiment. Vertical axes show the percentage of estimates per bin, allowing comparison of exact and Monte Carlo results with different counts.

Each result shows condition, N, method, n, exact/Monte Carlo type, seed where applicable, count, true mean, average estimate, bias, SD of estimates, and RMSE. Stratified allocation and population weights are available in details.

The dashed yellow reference marks the true mean; the coral line marks the mean estimate. Method colors remain blue/turquoise/violet. Accessible bin tables supplement the plots and hover/tap details.

CSV export contains six unique current results, full-precision summaries, true means, and allocation/weight metadata. SRS n = 100 is identified as serving both experiments. Reruns replace results rather than pool runs. The student records the findings and interpretation.

## Verification

| Check | Result |
| --- | --- |
| Statistical / data-integrity tests | 38 passed, 0 failed |
| DOM integration tests | 2 passed, 0 failed |
| Reproducible Monte Carlo estimates and counts | Passed on synthetic populations |
| n distinct rows in every tested repetition | Passed |
| Exact enumeration visits each start once, without a seed | Passed |
| Bias, population-divisor SD, and RMSE match hand calculations | Passed |
| RMSE² = bias² + SD² | Passed within floating-point precision |
| SRS n = 100 reused between experiments | Passed |
| Histograms share domains/bins and normalize to probability 1 | Passed |
| Incompatible conditions rejected from a comparison | Passed |
| User-run worker lifecycle, cancellation, and stale-message handling | Passed |
| CSV metadata and six unique result rows | Passed |
| No automatic experiment on page opening | Passed |
| Production build, including separate worker asset | Passed |
| Original CSV checksum and row order | Passed |
| Visual browser / mobile review | Unverified: managed preview service is unavailable |

Repeated-sampling correctness tests use synthetic populations only. The Stage 4 DOM test uses explicitly synthetic result fixtures to test presentation and lifecycle. It does not run the clinic investigation or supply production results. Canvas/SVG DOM tests do not constitute visual browser review.

GitHub Actions runs these checks on Node 20.19.0 and Node 24; consult its live result for status.

## Still pending

The student runs the investigation, records results, and writes their interpretation. Stage 5 waits for the student's independently written and dated hypothesis before challenge controls are planned. No challenge hypothesis, condition change, or expected finding is supplied.
