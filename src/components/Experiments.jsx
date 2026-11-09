import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BarChart3, Download, FlaskConical, LockKeyhole, Play, X } from 'lucide-react';
import { GROUP_COLUMNS, comparisonHistograms, experimentCsv, populationMean, validateSeed } from '../lib/sampling.js';
import { METHOD_DISPLAY } from '../lib/method-display.js';
import SamplingDistribution from './SamplingDistribution.jsx';

const number = value => value.toLocaleString('en-US');
const metric = value => value.toFixed(4);
const DEFINITIONS = {
  bias: 'Mean of the repeated estimates minus the true population mean. A finite Monte Carlo bias can include simulation variability.',
  sd: 'Standard deviation of the estimates, using the repetition/start count as the divisor. This is not the SD of individual appointment waits.',
  rmse: 'Square root of the mean squared estimation errors, in minutes. RMSE² = bias² + SD² with the population-divisor SD used here.',
};

export default function Experiments({ rows, onExplorer }) {
  const [seedText, setSeedText] = useState('2026');
  const [repetitionsText, setRepetitionsText] = useState('1000');
  const [column, setColumn] = useState('visit_type');
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const worker = useRef(null);
  const jobId = useRef(0);
  const truth = useMemo(() => populationMean(rows), [rows]);
  let settings = null, validationError = '';
  try {
    if (!/^\d+$/.test(seedText)) throw new Error('Enter a whole-number Monte Carlo seed.');
    const seed = validateSeed(Number(seedText));
    const repetitions = Number(repetitionsText);
    if (!/^\d+$/.test(repetitionsText) || !Number.isInteger(repetitions) || repetitions < 1000 || repetitions > 10000) throw new Error('Choose 1,000–10,000 Monte Carlo repetitions.');
    settings = { seed, repetitions, column };
  } catch (issue) { validationError = issue.message; }
  useEffect(() => () => { jobId.current += 1; worker.current?.terminate(); }, []);
  function invalidate() {
    jobId.current += 1;
    worker.current?.terminate(); worker.current = null;
    setResult(null); setRunning(false); setProgress(null); setError('');
  }
  function cancel() { invalidate(); setError('Run canceled. No partial results are shown.'); }
  function run(event) {
    event.preventDefault();
    if (!settings || running) return;
    invalidate();
    const current = ++jobId.current;
    setRunning(true);
    try {
      const instance = new Worker(new URL('../workers/experiments.worker.js', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onmessage = ({ data }) => {
        if (data.jobId !== jobId.current || worker.current !== instance) return;
        if (data.kind === 'progress') setProgress(data.progress);
        else if (data.kind === 'result') {
          setResult(data.result); setRunning(false); setProgress(null);
          instance.terminate(); worker.current = null;
        } else if (data.kind === 'error') {
          setError(data.message); setRunning(false); setResult(null);
          instance.terminate(); worker.current = null;
        }
      };
      instance.onerror = () => {
        if (current !== jobId.current || worker.current !== instance) return;
        setError('The experiment worker could not finish. Retry the run in a modern browser.');
        setRunning(false); setResult(null); instance.terminate(); worker.current = null;
      };
      instance.postMessage({ jobId: current, rows, settings: { ...settings } });
    } catch (issue) {
      worker.current?.terminate(); worker.current = null;
      setRunning(false); setError('Unable to start the experiment worker: ' + issue.message);
    }
  }
  function download() {
    if (!result) return;
    const blob = new Blob([experimentCsv(result)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'northstar-stage4-seed-' + result.settings.seed + '.csv';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return <div className="page experiments-page">
    <button className="back-link" onClick={onExplorer}><ArrowLeft size={15} aria-hidden="true" />Sampling Methods Explorer</button>
    <div className="page-heading"><div><p className="eyebrow"><FlaskConical size={14} aria-hidden="true" />NORTHSTAR MEMORIAL HOSPITAL · STAGE 4</p><h1>From one sample<br />to a distribution.</h1><p className="page-subtitle">Run repeated samples. Inspect the estimates. Build your own evidence.</p></div><span className="pill violet">Repeated-sampling experiments</span></div>
    <div className="experiment-baseline"><span><strong>Baseline population</strong>{number(rows.length)} original CSV appointments</span><span><strong>Target</strong>wait_time · minutes</span><span><strong>True population mean</strong>{metric(truth)} min</span></div>
    <section className="panel experiment-settings" aria-labelledby="experiment-settings-title">
      <div className="panel-heading"><div><p className="eyebrow">YOU RUN THE INVESTIGATION</p><h2 id="experiment-settings-title">Experiment settings</h2></div><BarChart3 size={22} aria-hidden="true" /></div>
      <form className="experiment-form" onSubmit={run}>
        <label htmlFor="experiment-seed">Monte Carlo seed<input id="experiment-seed" inputMode="numeric" value={seedText} onChange={event => { invalidate(); setSeedText(event.target.value); }} /></label>
        <label htmlFor="experiment-repetitions">Monte Carlo repetitions<input id="experiment-repetitions" inputMode="numeric" value={repetitionsText} onChange={event => { invalidate(); setRepetitionsText(event.target.value); }} /></label>
        <label htmlFor="experiment-column">Stratification column<select id="experiment-column" value={column} onChange={event => { invalidate(); setColumn(event.target.value); }}>{GROUP_COLUMNS.map(name => <option key={name}>{name}</option>)}</select></label>
        <button className="button primary" type="submit" disabled={!settings || running}><Play size={15} aria-hidden="true" />Run experiments</button>
        {running && <button type="button" className="button secondary" onClick={cancel}><X size={15} aria-hidden="true" />Cancel run</button>}
      </form>
      <div className="experiment-plans"><div><strong>Experiment A · Compare methods</strong><p>Simple random, systematic, and stratified sampling at the same <b>n = 100</b>.</p></div><div><strong>Experiment B · Compare sample sizes</strong><p>Simple random only, at <b>n = 1, 10, 100, and 640</b>. Population and method stay fixed.</p></div></div>
      <p className="experiment-rule-note">n is the number of appointments in one sample. Repetitions are the number of separate samples. Each Monte Carlo condition uses the chosen count, at least 1,000. Whole-number systematic sampling enumerates every possible start instead and uses no seed. The SRS n = 100 result is reused in both experiments.</p>
      {(validationError || error) && <p className="validation-error" role="alert">{validationError || error}</p>}
      {running && <div className="experiment-progress" role="status" aria-live="polite"><p>{progress ? METHOD_DISPLAY[progress.method].short + ' · n = ' + progress.n + ' · ' + progress.completed + ' of ' + progress.total + ' conditions completed' : 'Starting the experiment worker…'}</p><progress max={progress?.total ?? 6} value={progress?.completed ?? 0} /></div>}
    </section>
    {!result && !running && <section className="experiment-empty"><BarChart3 size={33} aria-hidden="true" /><h2>Your distributions will appear here.</h2><p>Click Run experiments to generate your current results from the original dataset. No experiment results are prefilled.</p></section>}
    {result && <div className="experiment-results" aria-live="polite">
      <div className="current-result-header"><div><p className="eyebrow">CURRENT RUN · BASELINE ONLY</p><p>Seed {result.settings.seed} · {number(result.settings.repetitions)} Monte Carlo repetitions · Stratification: {result.settings.column}</p></div><button className="button secondary" onClick={download}><Download size={15} aria-hidden="true" />Download results CSV</button></div>
      <ExperimentGroup title="Experiment A · Methods at n = 100" description="Same population and total sample size. Exact and Monte Carlo distributions use probability per shared bin so their different run counts are comparable." results={result.methods} kind="methods" />
      <ExperimentGroup title="Experiment B · SRS sample sizes" description="Only sample size changes. The SRS n = 100 estimates are the same result reused from Experiment A. Shared scales apply within each experiment; the two experiments can have different domains." results={result.sizes} kind="sizes" />
      <section className="panel results-table-panel"><div className="panel-heading"><div><p className="eyebrow">RECORD YOUR EVIDENCE</p><h2>Six unique current results</h2></div></div><div className="table-wrap"><table><caption>Current baseline results; SRS n = 100 serves both experiments</caption><thead><tr><th scope="col">Method</th><th scope="col">n</th><th scope="col">Type</th><th scope="col">Seed</th><th scope="col">Runs / starts</th><th scope="col">Bias (min)</th><th scope="col">SD (min)</th><th scope="col">RMSE (min)</th></tr></thead><tbody>{[...result.methods, ...result.sizes.filter(item => !result.methods.includes(item))].map(item => <tr key={item.method + item.n}><th scope="row">{METHOD_DISPLAY[item.method].short}{item.method === 'stratified' ? ' (' + item.column + ')' : ''}</th><td>{item.n}</td><td>{item.type}</td><td>{item.seed ?? 'None—exact'}</td><td>{number(item.runs)}</td><td>{metric(item.bias)}</td><td>{metric(item.sd)}</td><td>{metric(item.rmse)}</td></tr>)}</tbody></table></div><p className="results-table-note">Every row uses the original CSV and its labeled true mean. Re-running replaces this current result set; results from different settings are never appended or pooled. CSV export includes full-precision values and allocation/weight metadata.</p></section>
      <div className="experiment-interpretation"><strong>Read the evidence in your own words.</strong><p>Bias describes the average offset; SD describes spread across estimates; RMSE combines the two. A finite Monte Carlo bias can include simulation variability. Displayed values are rounded. These summaries describe repeated estimates, not the single sample in Stage 3.</p></div>
    </div>}
    <div className="next-stage-note"><span className="next-stage-icon"><LockKeyhole size={18} aria-hidden="true" /></span><div><strong>Stage 5 · Your independent challenge</strong><p>Write and date your own hypothesis before discussing challenge controls. No hypothesis or challenge condition is supplied here.</p></div><span className="next-stage-number">05</span></div>
  </div>;
}

function ExperimentGroup({ title, description, results, kind }) {
  const chart = useMemo(() => comparisonHistograms(results), [results]);
  return <section className="experiment-group" aria-label={title}>
    <div className="experiment-group-heading"><h2>{title}</h2><p>{description}</p></div>
    <div className={'distribution-grid ' + (kind === 'sizes' ? 'size-distributions' : '')}>{results.map((result, i) => {
      const label = kind === 'sizes' ? 'Simple random · n = ' + result.n : METHOD_DISPLAY[result.method].name;
      const color = METHOD_DISPLAY[result.method].color;
      return <article className="panel distribution-card" key={result.method + result.n} style={{ '--distribution-color': color }}>
        <div className="distribution-heading"><h3>{label}</h3><span className={'result-type ' + (result.type === 'Exact' ? 'exact-type' : 'monte-carlo-type')}>{result.type}</span></div>
        <p className="distribution-run-label">Baseline · N = {number(result.N)} · n = {result.n}<br />{result.type === 'Exact' ? number(result.runs) + ' starts · no seed' : number(result.runs) + ' repetitions · seed ' + result.seed}{result.column ? ' · ' + result.column : ''}</p>
        <SamplingDistribution result={result} bins={chart.series[i]} scale={chart} color={color} label={label} />
        <div className="distribution-metrics">{[['bias', 'Bias'], ['sd', 'SD of estimates'], ['rmse', 'RMSE']].map(([key, label]) => <div key={key}><span>{label}<button type="button" className="metric-help" aria-label={DEFINITIONS[key]} title={DEFINITIONS[key]}>?</button></span><strong>{metric(result[key])}<small> min</small></strong></div>)}</div>
        {result.allocation && <details className="result-allocation"><summary>Allocation and population weights</summary><ul>{result.allocation.map(group => <li key={group.key}>{group.key}: Nh = {group.populationSize}, nh = {group.allocation}, weight = {group.weight.toFixed(6)}</li>)}</ul></details>}
      </article>;
    })}</div>
  </section>;
}
