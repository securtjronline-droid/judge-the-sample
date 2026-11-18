# Activity Questions

AI-assisted answers. All numerical results below come from the simulated clinic-appointment population, not training or test patients; this app has no training/test split.

1. My GitHub repository is https://github.com/securtjronline-droid/judge-the-sample.

2. My live website is https://securtjronline-droid.github.io/judge-the-sample/.

3. Simple random sampling selects observations randomly without replacement, systematic sampling selects evenly spaced rows after a random start, and stratified sampling randomly selects within groups and combines their means using population weights. Repeating patterns in row order can make systematic sampling less precise, while meaningful groups can make stratification useful.

4. One sample mean far from the population mean does not establish bias because random variation can produce an unusual sample. Repeated sampling reveals whether estimates are consistently shifted away from the true mean or simply spread around it.

5. In my simulated appointment population—not training or test patients—the SD of simple random sample means decreased from 4.6663 minutes at sample size 10 to 1.4682 minutes at sample size 100 and 0.5311 minutes at sample size 640. Larger samples reduced overall variability but did not guarantee that every individual estimate would be closer to the true mean.

6. Yes: in my simulated appointment population—not training or test patients—systematic sampling remained unbiased across all possible starts, but periodic reordering increased its SD from 6.9567 to 14.4292 minutes. Under that ordering, I would recommend simple random sampling over systematic sampling because its SD was much smaller at 1.4414 minutes, without depending on fixed positions in the row order.

## Supporting evidence

- [Stage 4 results](evidence/northstar-stage4-seed-2026.csv)
- [Stage 5 results](evidence/northstar-stage5-seed-2026.csv)
- [Reflection and AI-use disclosure](DECISIONS.md)

The live dashboard, data loading, three sampling methods, and Stage 4–5 worker calculations were verified in a desktop browser. These responses and the challenge hypothesis are AI-assisted; the independent-authorship limitation remains disclosed.
