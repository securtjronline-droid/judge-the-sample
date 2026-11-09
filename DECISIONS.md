# My decisions and evidence notes

AI-assisted draft — November 8, 2026

I hypothesize that systematic sampling at n = 100 will have a larger SD of estimates and RMSE than simple random sampling after the appointments are placed in a periodic ordering.

To create that ordering, sort the 10,000 appointments by waiting time, divide them into 100 groups of 100, and interleave those groups so each 100-row block contains one appointment from each group. Preserve every appointment and waiting-time value.

The systematic interval is 100, so each random start repeatedly selects the same position within successive blocks. This could produce samples concentrated within particular waiting-time groups, increasing variability across starts.

Compare the original and reordered populations using the same n = 100. Enumerate all systematic starts and use at least 1,000 seeded SRS repetitions.

Evidence against the hypothesis would be systematic sampling showing no greater SD or RMSE than SRS under the reordered condition. Reordering alone leaves the true population mean unchanged.

## 1. Population and target

- Scenario and file: Clinic waiting times — data/clinic_visits.csv.
- One row means: One simulated clinic appointment.
- Number of rows (N): 10,000 appointments.
- Row order, and what it means in this file: Chronological order by week, then weekday from Monday to Friday, then appointment slot from 1 to 20. Neighboring rows represent neighboring appointments.
- Target column and units: wait_time, measured in minutes waited after the scheduled appointment time.
- My finite population is (and what it is not): The 10,000 simulated appointments contained in this CSV, covering 100 weeks. It does not represent all patients, all clinics, or appointments outside this file.
- True mean I calculated (and how): 22.6842 minutes. Calculated with AI assistance using the arithmetic mean: sum all 10,000 values in the wait_time column (226,842 minutes), then divide by 10,000 appointments.

## 2. Design choices

For each stage: the option I chose, why, and what it is meant to help a user learn.

- Stage 2, visualization (include one visual feature meant to reveal a sampling problem): A chronological grid containing all 10,000 appointments, with one cell per CSV row. Selected appointments are highlighted while unselected appointments remain visible. Row-order labels and a magnified selection strip make gaps and repeated spacing inspectable. This helps users connect the selection pattern with actual appointment records. The sample estimate appears beside the labeled true population mean.
- Stage 3, sampling interactions and stratification column: Approach A, a guided walkthrough using the same grid for all three methods. Users change sample size and seed, inspect the selection rule, and see the selected rows and estimate update. Proposed stratification column: visit_type, which has three observable groups—Follow-up, New, and Same-day—keeping the allocation and weighting table compact. Show each group’s population size, sample allocation, and population weight. This choice does not assume better statistical performance.
- Stage 4, presentation of the method comparison and sample-size experiments: Separate, aligned histograms with shared scales within each experiment, a clearly labeled true-mean reference line, and bias, SD, and RMSE cards in minutes. Keep the method comparison and sample-size comparison in distinct sections. Label every result exact or Monte Carlo and display its settings. Confirm the required sample sizes and repetition count against the assignment version before implementation.
- Stage 5, challenge controls: Independently write and date the challenge hypothesis before planning controls. Then select controls that test that hypothesis, preserve the original population, and compare baseline and modified conditions using the required sampling rules and equal sample sizes.

## 3. Results table

Results below were exported from the app. Bias, SD, and RMSE are in minutes, rounded to four decimal places. The true population mean is 22.6842 minutes in both conditions. MC means Monte Carlo.

| Experiment | Condition | Method | Seed | n | Runs or starts | Type | Bias | SD | RMSE |
|---|---|---|---|---|---|---|---|---|---|
| Method comparison | Original order | Simple random | 2026 | 100 | 1000 | MC | 0.1543 | 1.4682 | 1.4763 |
| Method comparison | Original order | Systematic | No seed | 100 | 100 | Exact | 0.0000 | 6.9567 | 6.9567 |
| Method comparison | Original order | Stratified | 2026 | 100 | 1000 | MC | -0.0079 | 1.3018 | 1.3018 |
| Sample size | Original order | Simple random | 2026 | 1 | 1000 | MC | -0.4182 | 13.7307 | 13.7371 |
| Sample size | Original order | Simple random | 2026 | 10 | 1000 | MC | 0.0507 | 4.6663 | 4.6666 |
| Sample size | Original order | Simple random | 2026 | 640 | 1000 | MC | 0.0128 | 0.5311 | 0.5312 |
| Challenge baseline | Original order | Simple random | 2026 | 100 | 1000 | MC | 0.1543 | 1.4682 | 1.4763 |
| Challenge baseline | Original order | Systematic | No seed | 100 | 100 | Exact | 0.0000 | 6.9567 | 6.9567 |
| Challenge baseline | Original order | Stratified | 2026 | 100 | 1000 | MC | -0.0079 | 1.3018 | 1.3018 |
| Challenge modified | Periodic order | Simple random | 2026 | 100 | 1000 | MC | -0.0186 | 1.4414 | 1.4415 |
| Challenge modified | Periodic order | Systematic | No seed | 100 | 100 | Exact | 0.0000 | 14.4292 | 14.4292 |
| Challenge modified | Periodic order | Stratified | 2026 | 100 | 1000 | MC | -0.0181 | 1.3768 | 1.3769 |

The original-order simple random n = 100 result also serves as the sample-size comparison at n = 100. Repeated baseline entries identify their role in the challenge; they are not additional independent evidence.

Stratification used `visit_type`: 55 Follow-up, 25 New, and 20 Same-day appointments. Population weights were 0.5475, 0.2469, and 0.2056, respectively, summing to 1. The estimate used the population-weighted stratum means.

Source exports: `northstar-stage4-seed-2026.csv` and `northstar-stage5-seed-2026.csv`, downloaded from the student's app runs.

## 4. Findings — AI-assisted interpretation

### (a) Comparing methods at n = 100

For the original-order population, stratified sampling had the lowest observed RMSE, 1.3018 minutes, followed by simple random sampling at 1.4763 minutes. Systematic sampling had an RMSE of 6.9567 minutes.

Systematic sampling had exactly zero bias across all 100 possible starts, but its estimates varied substantially between starts. This demonstrates that an unbiased method can still produce imprecise individual estimates.

The small nonzero biases reported for simple random and stratified sampling are estimates from finite Monte Carlo runs. They do not establish that the underlying designs are biased. These comparisons apply to this population and the chosen designs, rather than proving one method is always best.

### (b) Sample size and estimation error

For simple random sampling, SD decreased from 13.7307 minutes at n = 1 to 4.6663 at n = 10, 1.4682 at n = 100, and 0.5311 at n = 640. RMSE also decreased as sample size increased.

Larger random samples produced more concentrated estimates in this experiment. Increasing sample size does not by itself correct a flawed selection process, missing population coverage, or inaccurate measurements. An individual sample can still differ from the true mean.

### (c) Population order matters for systematic sampling

Changing only the row order increased systematic sampling's SD and RMSE from 6.9567 to 14.4292 minutes. The records, waiting-time values, and true population mean stayed unchanged. The selection rule's interaction with the ordering explains the loss of precision.

## 5. Challenge — AI-assisted hypothesis and evaluation

### Hypothesis provenance

The original AI-assisted hypothesis, dated November 8, 2026, is preserved above. It was developed with AI assistance and was not independently authored. It therefore does not meet an independent-authorship requirement.

### Test design

The challenged method was systematic sampling at n = 100.

For the modified condition, the 10,000 appointments were sorted by waiting time, divided into 100 bands of 100 appointments, and interleaved so each 100-row block contained one appointment from each band. This preserved every appointment and waiting-time value.

The systematic interval was 100. Each starting position therefore selected appointments from the same waiting-time band across successive blocks. Different starts could produce very different estimated means.

The prediction was that systematic sampling would have greater SD and RMSE than simple random sampling under this ordering. Results showing no greater SD or RMSE would contradict that prediction.

### Settings and observed evidence

The test compared original and periodic ordering using all three methods at n = 100. Simple random and stratified sampling used 1,000 repetitions with seed 2026. Systematic sampling enumerated all 100 starts without a seed. Stratification used `visit_type`.

The results supported the prediction. Under periodic ordering, systematic sampling's RMSE was 14.4292 minutes, compared with 1.4415 minutes for simple random sampling—approximately ten times as large. Systematic RMSE also approximately doubled relative to its original-order result.

Systematic bias remained zero across all starts. The problem demonstrated here was increased variability rather than a shift in the average estimate. Simple random sampling provided an alternative that avoided repeatedly selecting a fixed band position.

Small differences between the two simple random Monte Carlo summaries can arise from finite simulation variability. Reordering does not change the theoretical SRS distribution when every subset of the same size remains equally likely.

## 6. AI use

- Tools used: ChatGPT/Codex, the connected GitHub integration, and the browser-based sampling app.
- Assistance received: AI helped plan and implement the app, write automated checks, calculate the population mean, develop the challenge hypothesis and ordering, inspect exported results, and draft this interpretation.
- Work I performed: I downloaded and launched the app locally, ran the Stage 4 and Stage 5 experiments, and exported the result files.
- Authorship disclosure: The hypothesis and this written reflection are AI-assisted. I do not claim they were independently written. Automated code checks were performed by the agent; I do not claim to have independently audited every calculation.
- Scope: These results describe the supplied simulated population of 10,000 appointments. They do not establish conclusions about all hospitals or real patients.
