import { ArrowRight } from 'lucide-react';
import { GROUP_COLUMNS } from '../lib/sampling.js';
import { METHOD_DISPLAY, stratumDisplay } from '../lib/method-display.js';

const fmt = value => value.toLocaleString('en-US', { maximumFractionDigits: 10 });

export default function MethodWalkthrough({ method, sample, groups, column, onColumn, step, onStep, onInspect }) {
  const config = METHOD_DISPLAY[method];
  const text = {
    simple: [
      'The finite population is every appointment in this CSV. File rows remain in chronological order; inspection never changes membership.',
      'Select n distinct row positions randomly without replacement. Every set of n rows is equally likely under this selection rule.',
      'Add the selected waiting times and divide by n. This is a single-sample estimate in minutes, shown beside the true mean of all appointments.',
    ],
    systematic: [
      method === 'systematic' && sample ? 'N / n = ' + sample.N + ' / ' + sample.n + ' = ' + fmt(sample.interval) + '. The app selects the whole-number or fractional-interval design from these actual settings.' : 'The interval is N / n; every whole-number n from 1 to N is supported.',
      method === 'systematic' && sample ? 'The seeded random start is ' + fmt(sample.start) + '. ' + (sample.design === 'Whole-number interval' ? 'It is an integer from 1 to k, inclusive.' : 'It lies in (0, k], with zero excluded and k included.') : 'The random start is chosen within the first interval.',
      'Follow the start through the original file order. Each selected row is shown below; click one to locate it in the grid. The estimate is the selected rows’ arithmetic mean.',
    ],
    stratified: [
      'Divide appointments using the observable ' + column + ' column. Each record belongs to exactly one of the ' + groups.length + ' groups shown below.',
      'Compute each quota as n × Nh / N, then apply largest-remainder rounding with at least one row per stratum and no more than its population size. Select randomly without replacement within each group.',
      'Combine the stratum means using population weights Nh / N. The estimate is Σ (Nh / N) × stratum sample mean; pooling all selected records without these weights is not this estimator.',
    ],
  };
  return <section className="method-walkthrough" aria-labelledby="walkthrough-title">
    <div className="walkthrough-heading"><div><p className="eyebrow">GUIDED METHOD WALKTHROUGH</p><h3 id="walkthrough-title">Why were these appointments selected?</h3></div><span>Step {step + 1} of 3</span></div>
    <ol className="walkthrough-steps">{config.steps.map((label, index) => <li key={label}><button type="button" aria-current={index === step ? 'step' : undefined} onClick={() => { onStep(index); if (sample?.indices.length) onInspect(sample.indices[Math.min(index, sample.indices.length - 1)]); }}><span>{index + 1}</span>{label}</button></li>)}</ol>
    <p className="walkthrough-explanation" aria-live="polite">{text[method][step]}</p>
    {method === 'systematic' && sample && <div className="systematic-design" data-testid="systematic-design">
      <div className="design-facts"><span><small>Design</small><strong>{sample.design}</strong></span><span><small>Interval k = N / n</small><strong>{fmt(sample.interval)}</strong></span><span><small>Random start {sample.design === 'Whole-number interval' ? 'r' : 'u'}</small><strong>{fmt(sample.start)}</strong></span></div>
      <p><strong>Selection rule:</strong> {sample.design === 'Whole-number interval' ? 'Rows r + j × k, for j = 0, …, n − 1.' : 'Rows ceil(u + j × k), for j = 0, …, n − 1. Each position is rounded upward separately.'}</p>
      {sample.design === 'Fractional interval' && <details><summary>Exact start and rounding</summary><p>u = {sample.startExact} rows. The calculation uses this exact fraction and exact ceiling arithmetic. The decimal above is rounded for display; no selected row is clipped or duplicated.</p></details>}
      <div className="selection-trace" aria-label="First selected systematic rows">{sample.indices.slice(0, 6).map((index, i) => <span key={index}>{i > 0 && <ArrowRight size={13} aria-hidden="true" />}<button type="button" onClick={() => onInspect(index)} aria-label={'Inspect selected CSV row ' + (index + 1)}>Row {index + 1}</button></span>)}</div>
    </div>}
    {method === 'stratified' && <div className="stratified-design"><label className="column-selector" htmlFor="stratum-column">Observable stratification column<select id="stratum-column" value={column} onChange={event => onColumn(event.target.value)}>{GROUP_COLUMNS.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      <p className="allocation-note">Rounding starts from the full proportional quotas. Minimum-one and population-capacity bounds are enforced; ties use the groups’ first appearance in the CSV. All allocations total the shared n.</p>
      <div className="table-wrap"><table className="allocation-table"><caption>Stratum populations, allocations, and population weights</caption><thead><tr><th scope="col">Stratum</th><th scope="col">Population Nh</th><th scope="col">Quota</th><th scope="col">Sample nh</th><th scope="col">Weight Nh/N</th><th scope="col">Mean (min)</th></tr></thead><tbody>{groups.map((group, i) => {
        const current = sample?.strata?.find(item => item.key === group.key);
        const style = stratumDisplay(i);
        return <tr key={group.key}><th scope="row"><span className="stratum-swatch" data-pattern={style.pattern} style={{ '--stratum-color': style.fill }} aria-hidden="true" />{group.key}</th><td>{group.populationSize.toLocaleString('en-US')}</td><td>{current ? current.quota.toFixed(4) : '—'}</td><td>{current ? current.allocation : 'Unavailable'}</td><td>{group.weight.toFixed(6)}</td><td>{current ? current.sampleMean.toFixed(4) : '—'}</td></tr>;
      })}</tbody></table></div>
      <p className="weighted-estimate-note">Population-weighted estimate = Σ (Nh / N) × stratum sample mean. {sample ? 'Weights total ' + sample.weightSum.toFixed(6) + '; total allocated = ' + sample.n + '.' : 'Every stratum needs at least one observation before an estimate is available.'} Displayed decimals are rounded; calculations use full precision.</p>
    </div>}
    <p className="row-order-note"><strong>What row order means:</strong> these clinic appointments run by week, Monday–Friday, then slots 1–20. Adjacent rows are adjacent appointments. Interval sampling of an unordered list has a different meaning from sampling this chronological record.</p>
  </section>;
}
