import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Sparkles, Check, LockKeyhole, Grid2X2, BarChart3, Database, CheckCircle2, ArrowRight, CircleHelp, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { drawSample, populationMean, populationStrata, validateSeed } from '../lib/sampling.js';
import { METHOD_DISPLAY, stratumDisplay } from '../lib/method-display.js';
import PopulationGrid from './PopulationGrid.jsx';
import MethodWalkthrough from './MethodWalkthrough.jsx';

const number = value => value.toLocaleString('en-US');
const minutes = value => value.toFixed(4);
const rowLabel = value => String(value).padStart(5, '0');
function Icon({ as: Component, ...props }) { return <Component size={18} strokeWidth={1.8} aria-hidden='true' {...props} />; }
function Pill({ children, tone = '' }) { return <span className={'pill ' + tone}>{children}</span>; }

function SamplingLab({ rows, onExperiments, onChallenge }) {
  const [method, setMethod] = useState('simple');
  const [nText, setNText] = useState('100');
  const [column, setColumn] = useState('visit_type');
  const [step, setStep] = useState(0);
  const [draftSeed, setDraftSeed] = useState('2026');
  const [inspected, setInspected] = useState(0);
  const [rowInput, setRowInput] = useState('1');
  const [rowError, setRowError] = useState('');
  const truth = useMemo(() => populationMean(rows), [rows]);
  const groups = useMemo(() => populationStrata(rows, column), [rows, column]);
  const result = useMemo(() => {
    try {
      if (!/^\d+$/.test(draftSeed)) throw new RangeError('Use a whole-number seed from 0 to 4,294,967,295.');
      validateSeed(Number(draftSeed));
      if (!/^\d+$/.test(nText)) throw new RangeError('Choose a whole-number sample size from 1 to ' + rows.length + '.');
      return { sample: drawSample(rows, { method, n: Number(nText), seed: Number(draftSeed), column }) };
    } catch (issue) { return { error: issue.message, minimum: issue.minimum }; }
  }, [rows, method, nText, draftSeed, column]);
  const sample = useMemo(() => result.sample ?? { indices: [], n: 0, N: rows.length, truth }, [result, rows, truth]);
  const error = result.error;
  const config = METHOD_DISPLAY[method];
  const runKey = [method, nText, draftSeed, column].join(':');
  useEffect(() => setStep(0), [runKey]);
  const selected = useMemo(() => new Set(sample.indices), [sample]);
  const selectedOrder = useMemo(() => [...sample.indices].sort((a, b) => a - b), [sample]);
  const record = rows[inspected];
  const start = Math.min(Math.max(0, inspected - 9), rows.length - 20);
  function inspect(index) { setInspected(index); setRowInput(String(index + 1)); setRowError(''); }
  function draw(event) {
    event.preventDefault();
    if (!result.sample) return;
    setStep(1);
    inspect(sample.indices[0]);
  }
  function inspectRow(event) {
    event.preventDefault();
    const value = Number(rowInput);
    if (!/^\d+$/.test(rowInput) || !Number.isInteger(value) || value < 1 || value > rows.length) {
      setRowError('Choose an appointment row from 1 to ' + number(rows.length) + '.'); return;
    }
    inspect(value - 1);
  }
  function nextSelected() { if (selectedOrder.length) inspect(selectedOrder.find(index => index > inspected) ?? selectedOrder[0]); }
  return (
    <div className="page lab-page" data-method={method} style={{ '--method-color': config.color, '--method-ink': config.ink, '--method-tint': config.tint }}>
      <div className="lab-heading"><div><p className="eyebrow"><FlaskConical size={14} aria-hidden="true" />NORTHSTAR MEMORIAL HOSPITAL</p><h1>Sampling Methods Explorer<span>.</span></h1><p className="page-subtitle">One population. Three selection rules. Explore how each appointment enters a sample.</p></div><Pill tone="violet"><Sparkles size={13} aria-hidden="true" />Stage 3 · Guided exploration</Pill></div>
      <nav className="stage-navigation" aria-label="Assignment stages">{['Population', 'Visualization'].map((label, i) => <span className="stage done" key={label}><Check size={13} aria-hidden="true" /><span>{i + 1}. {label}</span></span>)}<span className="stage current" aria-current="step"><span className="stage-number">3</span>Methods</span><button className="stage available-stage" onClick={onExperiments}>4. Experiments <ArrowRight size={12} aria-hidden="true" /></button><button className="stage available-stage" onClick={onChallenge}>5. Challenge</button>{['Evidence'].map((label, index) => <span className="stage pending" key={label}><LockKeyhole size={12} aria-hidden="true" /><span>{index + 6}. {label}</span></span>)}</nav>
      <section className="method-picker" aria-label="Sampling methods">{Object.entries(METHOD_DISPLAY).map(([key, item], i) => <button key={key} type="button" data-method={key} aria-pressed={method === key} onClick={() => setMethod(key)}><span className="method-choice-symbol" style={{ background: item.color }} aria-hidden="true" /><span><small>METHOD {i + 1}</small><strong>{item.short}</strong></span><span className="method-choice-mark" aria-hidden="true">{method === key ? '✓' : '→'}</span></button>)}</section>
      <div className="results-grid" aria-live="polite" aria-atomic="true">
        <ResultCard label="Selected appointments" value={result.sample ? number(sample.n) : '—'} unit={'/ ' + number(sample.N)} detail={result.sample ? number(sample.n) + ' distinct records · no replacement' : 'No current sample: resolve the message below'} tone="blue" icon={Grid2X2} />
        <ResultCard label={method === 'stratified' ? 'Population-weighted estimate' : 'Single-sample estimate'} value={result.sample ? minutes(sample.estimate) : '—'} unit="min" detail={method === 'stratified' ? 'Σ (Nh / N) × stratum sample mean' : 'Arithmetic mean of the selected waiting times'} tone="coral" icon={BarChart3} />
        <ResultCard label="True population mean" value={minutes(truth)} unit="min" detail={'Arithmetic mean of all ' + number(rows.length) + ' appointments'} tone="yellow" icon={Database} reference />
      </div>
      <section className="panel population-panel">
        <div className="panel-heading population-panel-heading"><div><p className="eyebrow">THE FULL POPULATION</p><h2>10,000 appointments. Every row accounted for.</h2><p className="muted">One cell = one appointment · Original CSV order</p></div><Pill tone={result.sample ? "green" : ""}><CheckCircle2 size={13} aria-hidden="true" />{result.sample ? number(sample.n) + " selected" : "Sample unavailable"}</Pill></div>
        <div className="lab-controls"><div className="method-key"><span className="method-symbol" /><div><strong>{config.name}</strong><small>Shared n and seed across methods</small></div></div><form className="seed-controls" onSubmit={draw}><label htmlFor="sample-size">Sample size (n)<input id="sample-size" inputMode="numeric" value={nText} onChange={event => setNText(event.target.value)} aria-describedby={error ? 'seed-error' : 'size-help'} /></label><label htmlFor="seed">Random seed<input id="seed" inputMode="numeric" value={draftSeed} onChange={event => setDraftSeed(event.target.value)} aria-describedby={error ? 'seed-error' : 'seed-help'} /></label><button className="button primary" type="submit" disabled={!result.sample}><Icon as={Sparkles} size={15} />Draw sample</button><button className="button secondary" type="button" disabled={!/^\d+$/.test(draftSeed) || Number(draftSeed) > 4294967295} onClick={() => setDraftSeed(String((Number(draftSeed) + 1) >>> 0))}>Next seed <Icon as={ArrowRight} size={14} /></button></form></div>
        <p className="shared-control-help" id="size-help">Choose any whole-number n from 1 to {number(rows.length)}. Valid controls update the selection immediately. Switching methods keeps the same n and seed; Draw sample focuses the guide on the current selection.</p>
        {error && <div role="alert" className="validation-error" id="seed-error"><p>{error}</p>{result.minimum && <button className="button secondary" type="button" onClick={() => setNText(String(result.minimum))}>Use n = {result.minimum} for all methods</button>}<p>No estimate is shown until the settings are feasible.</p></div>}
        <MethodWalkthrough method={method} sample={result.sample} groups={groups} column={column} onColumn={setColumn} step={step} onStep={setStep} onInspect={inspect} />
        <div className="grid-and-inspector">
          <div className="population-main"><PopulationGrid rows={rows} sample={sample} method={method} strata={groups} column={column} inspected={inspected} onInspect={inspect} /><div className="grid-legend"><span><i className="legend-cell population-cell" />Unselected appointment</span><span><i className="legend-cell sample-cell" />Selected appointment</span><span><i className="legend-cell inspect-cell" />Inspected row</span></div>{method === 'stratified' && <div className="strata-legend" aria-label="Stratum legend">{groups.map((group, i) => { const style = stratumDisplay(i); return <span key={group.key}><i className="stratum-swatch" data-pattern={style.pattern} style={{ '--stratum-color': style.fill }} aria-hidden="true" />{group.key}: {number(group.populationSize)}</span>; })}</div>}</div>
          <aside className="row-inspector" aria-labelledby="inspector-title"><p className="eyebrow">LOOK CLOSER</p><h3 id="inspector-title">Appointment inspector</h3><p className="muted">Hover, tap, or enter a row number.</p><form className="row-search" onSubmit={inspectRow}><label htmlFor="row-number">CSV row<input id="row-number" inputMode="numeric" value={rowInput} onChange={event => setRowInput(event.target.value)} aria-describedby={rowError ? 'row-error' : undefined} /></label><button type="submit" className="button secondary" aria-label="Inspect appointment row"><Icon as={Search} size={16} /></button></form>{rowError && <p className="validation-error" id="row-error" role="alert">{rowError}</p>}<div className="inspector-record"><div className="inspector-record-top"><span>AP-{rowLabel(record.visit_id)}</span><Pill tone={selected.has(inspected) ? 'blue' : ''}>{!result.sample ? 'No sample' : selected.has(inspected) ? 'Selected' : 'Unselected'}</Pill></div><dl className="record-list"><div><dt>Week</dt><dd>{record.week}</dd></div><div><dt>Weekday</dt><dd>{record.weekday}</dd></div><div><dt>Appointment slot</dt><dd>{record.slot}</dd></div><div><dt>Visit type</dt><dd>{record.visit_type}</dd></div></dl><div className="inspector-wait"><span>Waiting time</span><strong>{record.wait_time}<small> min</small></strong></div></div><button className="text-button next-selected" disabled={!selectedOrder.length} onClick={nextSelected}>Inspect next selected row <Icon as={ArrowRight} size={14} /></button><div className="inspection-hint"><CircleHelp size={16} aria-hidden="true" /><p>Inspecting a row never adds it to the sample. Selection is determined only by the sampling rule and seed.</p></div></aside>
        </div>
        <div className="magnifier"><div className="magnifier-heading"><div><p className="eyebrow">MAGNIFIED ROW-ORDER STRIP</p><h3>Follow the appointments, one row at a time.</h3></div><span>Rows {number(start + 1)}–{number(start + 20)}</span></div><div className="row-strip">{rows.slice(start, start + 20).map((row, offset) => { const index = start + offset; const groupIndex = groups.findIndex(group => group.key === String(row[column])); const cell = stratumDisplay(Math.max(0, groupIndex)); return <button key={row.visit_id} data-pattern={method === 'stratified' ? cell.pattern : undefined} style={method === 'stratified' ? { '--cell-color': cell.fill, '--cell-ink': cell.ink } : undefined} className={'strip-cell ' + (selected.has(index) ? 'is-selected ' : '') + (inspected === index ? 'is-inspected' : '')} onClick={() => inspect(index)} aria-label={'Inspect row ' + row.visit_id + ', ' + row.wait_time + ' minutes, ' + (selected.has(index) ? 'selected' : 'unselected')} aria-pressed={inspected === index}>{row.visit_id}</button>; })}</div><p>Row numbers identify the original records. Method-colored fill and coral outlines mark the same selected appointments as the full grid. Stratum labels and patterns supplement color.</p></div>
        <div className="selection-rule"><div><Icon as={CircleHelp} size={18} /><strong>Current sample settings</strong></div><div className="run-metadata" id="seed-help"><span>Method <strong>{config.name}</strong></span><span>Seed <strong>{draftSeed || '—'}</strong></span><span>Sample size <strong>{nText || '—'}</strong></span><span>Population <strong>Original CSV</strong></span><span>Single-sample error <strong>{result.sample ? (sample.error >= 0 ? '+' : '') + minutes(sample.error) + ' min' : 'Unavailable'}</strong></span></div><p className="rule-footnote">The same seed and settings reproduce the same sample. Different seeds can occasionally give the same selection. A single sample’s error is not repeated-sampling bias or evidence that a method is superior. Method colors identify designs, not statistical quality.</p></div>
      </section>
      {result.sample && <SelectedRecords key={runKey} rows={rows} indices={selectedOrder} seed={sample.seed} />}
      <div className="next-stage-note"><span className="next-stage-icon"><LockKeyhole size={19} aria-hidden="true" /></span><div><strong>Next: Repeated-sampling experiments</strong><p>Run the method comparison and sample-size experiments when you are ready. Your Stage 5 hypothesis remains your independent work.</p></div><button className="button primary" onClick={onExperiments}>Open Stage 4 experiments <ArrowRight size={14} aria-hidden="true" /></button></div>
    </div>
  );
}

function ResultCard({ label, value, unit, detail, tone, icon, reference }) {
  return <div className={'result-card result-' + tone}><div className="result-label"><span>{label}</span><Icon as={icon} size={16} /></div><div className="result-value">{reference && <span className="reference-mark" aria-hidden="true" />}<strong>{value}</strong><span>{unit}</span></div><p>{detail}</p></div>;
}

function SelectedRecords({ rows, indices, seed }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [seed]);
  const pageSize = 10, max = Math.ceil(indices.length / pageSize);
  return <section className="panel selected-records"><div className="panel-heading"><div><p className="eyebrow">VERIFY THE SELECTION</p><h2>Selected appointment records</h2></div><span className="muted">{indices.length} distinct rows · Seed {seed}</span></div><div className="table-wrap"><table><caption className="sr-only">Selected records in original CSV row order, ten per page</caption><thead><tr><th scope="col">CSV row</th><th scope="col">Week</th><th scope="col">Weekday</th><th scope="col">Slot</th><th scope="col">Visit type</th><th scope="col">Wait time (min)</th></tr></thead><tbody>{indices.slice(page * pageSize, (page + 1) * pageSize).map(index => { const row = rows[index]; return <tr key={row.visit_id}><th scope="row"><span className="selected-row-dot" />{row.visit_id}</th><td>{row.week}</td><td>{row.weekday}</td><td>{row.slot}</td><td>{row.visit_type}</td><td>{row.wait_time}</td></tr>; })}</tbody></table></div><div className="table-pagination"><span>Rows {page * pageSize + 1}–{Math.min((page + 1) * pageSize, indices.length)} of {indices.length} selected records</span><div><button className="button secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)} aria-label="Previous selected records"><Icon as={ChevronLeft} size={16} /></button><span aria-live="polite">Page {page + 1} of {max}</span><button className="button secondary" disabled={page === max - 1} onClick={() => setPage(value => value + 1)} aria-label="Next selected records"><Icon as={ChevronRight} size={16} /></button></div></div></section>;
}

export default SamplingLab;
