# Stage 5 implementation and verification

The user approved building the fixed baseline-versus-periodic-order test with n = 100. This is an AI-assisted proposal, explicitly disclosed in the app; it does not satisfy independent-authorship requirements. Student notes, assignment brief, and original CSV remain unchanged.

## Design

A stable wait-time sort of a copy is divided into 100 bands of 100 records, then interleaved one record per band per block. Each condition recomputes its population mean. SRS and stratified sampling reuse the existing seeded methods; systematic sampling exactly enumerates its 100 starts. Default Monte Carlo repetitions are 1,000, adjustable to 10,000. The control toggle uses the original ordering for both conditions. No investigation runs until requested.

Histograms share axes across conditions without pooling their distributions or summaries. Results include condition, method, n, true mean, bias, SD, RMSE, run type, seed when applicable, and stratification metadata in the CSV. Changes to settings invalidate old results; existing cancel and stale-worker safeguards apply.

## Automated checks

Statistical tests cover known periodic-order permutations, identity/value/mean preservation, deterministic repeated sampling, exact systematic behavior, unchanged-order control equivalence, shared axes, six-condition-row CSV export, worker routing, and the existing sample-size/allocation/weighted-estimate tests. UI integration covers navigation, no automatic run, challenge requests, six result cards, exact/Monte Carlo labels, CSV export, and control-toggle invalidation. Repeated-sampling test runs use synthetic data. No actual clinic challenge investigation was run by the implementation agent.

Production build, data integrity, Bash syntax, and whitespace checks are required before publication. The managed browser preview service is unavailable, so visual, mobile, and real-browser review remain unverified; DOM integration is not a substitute for that review. Student execution, evidence, interpretation, and Stage 6 reflection remain required.
