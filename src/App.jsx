import { useEffect, useState } from 'react';
import { Activity, ArrowDown, ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, CircleHelp, ClipboardList, Database, FlaskConical, Grid2X2, HeartPulse, Hospital, LayoutDashboard, Microscope, ShieldCheck, UserRound } from 'lucide-react';
import { parseClinicCsv } from './lib/population.js';
import SamplingLab from './components/SamplingLab.jsx';

const populationPromise = import('../data/clinic_visits.csv?raw')
  .then(module => ({ rows: parseClinicCsv(module.default) }))
  .catch(error => ({ error: error.message }));
const number = value => value.toLocaleString('en-US');
const rowLabel = value => String(value).padStart(5, '0');
const pages = {
  dashboard: ['Clinical workspace', 'Hospital overview'],
  chart: ['Patient workspace', 'Simulated visit chart'],
  quality: ['Quality & Safety', 'Research & Analytics'],
  lab: ['Research & Analytics', 'Sampling Lab'],
};

function Icon({ as: Component, ...props }) { return <Component size={18} strokeWidth={1.8} aria-hidden="true" {...props} />; }
function Pill({ children, tone = '' }) { return <span className={'pill ' + tone}>{children}</span>; }
function PrimaryButton({ children, icon: Component = ArrowRight, ...props }) {
  return <button className="button primary" {...props}>{children}<Icon as={Component} size={16} /></button>;
}

function App() {
  const [population, setPopulation] = useState(null);
  const [page, setPage] = useState(() => Object.hasOwn(pages, window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'dashboard');
  const [chartIndex, setChartIndex] = useState(0);
  useEffect(() => {
    let active = true;
    populationPromise.then(value => { if (active) setPopulation(value); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    function update() { const route = window.location.hash.slice(1); setPage(Object.hasOwn(pages, route) ? route : 'dashboard'); }
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  function navigate(route) {
    if (window.location.hash.slice(1) !== route) window.location.hash = route;
    else setPage(route);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function openChart(index = chartIndex) { setChartIndex(index); navigate('chart'); }
  if (!population) return <main className="load-error" aria-live="polite"><p className="eyebrow">NORTHSTAR MEMORIAL HOSPITAL</p><h1>Opening the teaching registry…</h1><p>Loading the original clinic appointment dataset.</p></main>;
  if (population.error) return <main className="load-error"><h1>Clinic data could not be loaded</h1><p role="alert">{population.error}</p><button className="button primary" onClick={() => window.location.reload()}>Try loading again</button></main>;
  const rows = population.rows;
  const row = rows[chartIndex];
  return (
    <div className={'app-shell ' + (page === 'lab' ? 'research-mode' : '')}>
      <a className="skip-link" href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content').focus(); }}>Skip to content</a>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate('dashboard')} aria-label="Northstar Memorial Hospital home">
          <span className="brand-mark"><Icon as={Hospital} size={24} /></span>
          <span><strong>NORTHSTAR</strong><small>MEMORIAL HOSPITAL</small></span>
        </button>
        <div className="workspace-label">EDUCATIONAL EHR</div>
        <nav aria-label="Hospital navigation">
          <NavItem icon={LayoutDashboard} active={page === 'dashboard'} onClick={() => navigate('dashboard')}>Hospital overview</NavItem>
          <NavItem icon={ClipboardList} active={page === 'chart'} onClick={() => openChart()}>Visit chart</NavItem>
          <NavItem icon={ShieldCheck} active={page === 'quality'} onClick={() => navigate('quality')}>Quality & Safety</NavItem>
          <div className="nav-divider" />
          <div className="workspace-label">RESEARCH WORKSPACE</div>
          <NavItem icon={FlaskConical} active={page === 'lab'} onClick={() => navigate('lab')}>Sampling Lab <span className="nav-stage">03</span></NavItem>
        </nav>
        <div className="sidebar-study">
          <Icon as={Microscope} size={21} />
          <strong>From care to discovery.</strong>
          <p>Explore the appointments behind the numbers.</p>
          <button onClick={() => navigate('quality')}>View study details <Icon as={ArrowRight} size={14} /></button>
        </div>
        <div className="sidebar-footer"><span className="status-dot" /><span>Simulated teaching environment</span></div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>{pages[page][0]}</span><ChevronRight size={13} aria-hidden="true" /><strong>{pages[page][1]}</strong></div>
          <div className="topbar-right"><span className="connected"><span className="status-dot" />Dataset connected</span><span className="profile-icon" aria-label="Educational workspace"><Icon as={UserRound} /></span></div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {page === 'dashboard' && <Dashboard rows={rows} openChart={openChart} navigate={navigate} />}
          {page === 'chart' && <VisitChart row={row} navigate={navigate} />}
          {page === 'quality' && <Quality rows={rows} navigate={navigate} />}
          {page === 'lab' && <SamplingLab rows={rows} />}
        </main>
        <footer className="app-footer"><span>Northstar Memorial Hospital <span aria-hidden="true">·</span> Educational simulation · v0.3.0</span><span>Original clinic CSV <span aria-hidden="true">·</span> Browser-based calculations</span></footer>
      </div>
    </div>
  );
}

function NavItem({ icon, active, children, ...props }) {
  return <button className={'nav-item ' + (active ? 'active' : '')} aria-current={active ? 'page' : undefined} {...props}><Icon as={icon} /><span>{children}</span>{active && <span className="nav-active-dot" />}</button>;
}

function Dashboard({ rows, openChart, navigate }) {
  const weeks = new Set(rows.map(row => row.week)).size;
  const types = new Set(rows.map(row => row.visit_type)).size;
  return (
    <div className="page hospital-page">
      <div className="page-heading"><div><p className="eyebrow">CONNECTED CLINICAL WORKSPACE</p><h1>A clearer view of care.</h1><p className="page-subtitle">Explore a simulated visit, then follow the data into research.</p></div><Pill tone="teal"><Icon as={ShieldCheck} size={14} />Teaching environment</Pill></div>
      <section className="hospital-hero" aria-labelledby="hero-title">
        <div><span className="hero-label"><span className="small-cross" />NORTHSTAR MEMORIAL HOSPITAL</span><h2 id="hero-title">Every appointment<br />has a bigger picture.</h2><p>Your clinical workspace connects appointment records with a hands-on sampling lab.</p><PrimaryButton onClick={() => openChart(0)}>Open a simulated chart</PrimaryButton></div>
        <div className="hero-path" aria-label="Journey from clinical record to research"><span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" /><div className="path-icon"><Icon as={HeartPulse} size={35} /></div><div className="path-node"><Icon as={ClipboardList} /><span>Clinical record</span><CheckCircle2 size={16} /></div><div className="path-node"><Icon as={ShieldCheck} /><span>Quality & Safety</span><ArrowDown size={15} /></div><div className="path-node research-node"><Icon as={FlaskConical} /><span>Research & Analytics</span><ArrowRight size={16} /></div></div>
      </section>
      <div className="registry-stats">
        <RegistryStat label="Appointments in the CSV" value={number(rows.length)} icon={ClipboardList} detail="One record per appointment" />
        <RegistryStat label="Weeks represented" value={number(weeks)} icon={Activity} detail="Original chronological order" />
        <RegistryStat label="Appointment types" value={number(types)} icon={Grid2X2} detail="Observable visit categories" />
      </div>
      <section className="panel registry-panel">
        <div className="panel-heading"><div><p className="eyebrow">CLINIC APPOINTMENT REGISTRY</p><h2>Start with a visit</h2></div><span className="muted">First 6 of {number(rows.length)} appointments</span></div>
        <div className="table-wrap"><table><caption className="sr-only">First six appointments from the original CSV</caption><thead><tr><th scope="col">Appointment</th><th scope="col">Week / day</th><th scope="col">Slot</th><th scope="col">Visit type</th><th scope="col">Wait time</th><th scope="col"><span className="sr-only">Open chart</span></th></tr></thead><tbody>{rows.slice(0, 6).map((row, index) => <tr key={row.visit_id}><th scope="row"><span className="appointment-id">AP-{rowLabel(row.visit_id)}</span><small>Simulated appointment</small></th><td>Week {row.week} <span className="muted">/ {row.weekday}</span></td><td>{row.slot}</td><td><span className={'visit-type type-' + row.visit_type.toLowerCase()}>{row.visit_type}</span></td><td>{row.wait_time} <span className="muted">min</span></td><td><button className="table-action" onClick={() => openChart(index)} aria-label={'Open chart for appointment ' + row.visit_id}>Open chart <Icon as={ArrowRight} size={14} /></button></td></tr>)}</tbody></table></div>
      </section>
      <div className="context-note"><Icon as={CircleHelp} size={18} /><p>All appointment values come from the supplied teaching CSV. This workspace contains simulated records and does not represent live hospital activity.</p><button className="text-button" onClick={() => navigate('quality')}>Data provenance <Icon as={ArrowRight} size={14} /></button></div>
    </div>
  );
}

function RegistryStat({ label, value, icon, detail }) {
  return <div className="registry-stat"><span className="stat-icon"><Icon as={icon} /></span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></div>;
}

function VisitChart({ row, navigate }) {
  const [tab, setTab] = useState('overview');
  return (
    <div className="page hospital-page">
      <button className="back-link" onClick={() => navigate('dashboard')}><Icon as={ArrowLeft} size={15} />Hospital overview</button>
      <section className="patient-header"><div className="patient-avatar">DP</div><div><p className="eyebrow">SIMULATED PATIENT CHART</p><h1>Demo patient</h1><p className="muted">Demo chart NMH-001 <span aria-hidden="true">·</span> Appointment AP-{rowLabel(row.visit_id)}</p></div><Pill tone="teal">Educational record</Pill></section>
      <div className="chart-tabs"><div role="tablist" aria-label="Chart sections" onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'details' : tab === 'overview' ? 'details' : 'overview';
        setTab(next);
        document.getElementById(next + '-tab').focus();
      }}>
        <button role="tab" id="overview-tab" tabIndex={tab === 'overview' ? 0 : -1} aria-selected={tab === 'overview'} aria-controls="chart-panel" onClick={() => setTab('overview')}>Visit overview</button>
        <button role="tab" id="details-tab" tabIndex={tab === 'details' ? 0 : -1} aria-selected={tab === 'details'} aria-controls="chart-panel" onClick={() => setTab('details')}>Record details</button>
        </div><button onClick={() => navigate('quality')}><Icon as={ShieldCheck} size={15} />Quality & Safety / Research & Analytics<Icon as={ArrowRight} size={14} /></button>
      </div>
      <div id="chart-panel" role="tabpanel" aria-labelledby={tab + '-tab'} className="chart-layout">
        <section className="panel"><div className="panel-heading"><div><p className="eyebrow">APPOINTMENT RECORD</p><h2>{tab === 'overview' ? 'Visit overview' : 'Original CSV fields'}</h2></div><Icon as={ClipboardList} /></div>
          {tab === 'overview' ? <><div className="visit-summary"><span className="stat-icon"><Icon as={HeartPulse} size={25} /></span><div><h3>{row.visit_type} appointment</h3><p>Week {row.week} · {row.weekday} · Slot {row.slot}</p></div><div className="wait-value"><strong>{row.wait_time}</strong><span>minutes waited</span></div></div><dl className="record-grid"><div><dt>Source row</dt><dd>{number(row.visit_id)}</dd></div><div><dt>Dataset</dt><dd>Clinic waiting times</dd></div><div><dt>Target</dt><dd>wait_time</dd></div><div><dt>Units</dt><dd>Minutes</dd></div></dl></> : <dl className="record-list">{Object.entries(row).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}{key === 'wait_time' ? ' minutes' : ''}</dd></div>)}</dl>}
          <p className="panel-footnote">“Demo patient” is a fictional navigation identity. The CSV contains appointment records, not named patient histories. Displayed appointment values come directly from row {row.visit_id}.</p>
        </section>
        <section className="research-access"><span className="access-icon"><Icon as={Microscope} size={26} /></span><p className="eyebrow">RESEARCH ACCESS</p><h2>See beyond<br />one appointment.</h2><p>Open the hospital research workspace to explore the full appointment population.</p><PrimaryButton onClick={() => navigate('quality')}>Open Quality & Safety</PrimaryButton><small><Icon as={Database} size={13} />Uses the full CSV population</small></section>
      </div>
    </div>
  );
}

function Quality({ rows, navigate }) {
  return (
    <div className="page hospital-page">
      <button className="back-link" onClick={() => navigate('chart')}><Icon as={ArrowLeft} size={15} />Return to visit chart</button>
      <div className="page-heading"><div><p className="eyebrow">QUALITY & SAFETY</p><h1>Research & Analytics</h1><p className="page-subtitle">A purposeful connection between clinical records and statistical inquiry.</p></div></div>
      <section className="study-launch"><div className="study-art" aria-hidden="true"><span className="study-cross">+</span><div className="study-art-icon"><Icon as={FlaskConical} size={54} /></div><span className="study-small-dot dot-blue" /><span className="study-small-dot dot-violet" /><span className="study-small-dot dot-coral" /></div><div className="study-launch-copy"><Pill tone="blue">INTERACTIVE TEACHING STUDY</Pill><h2>Clinic waiting times.<br />A population worth exploring.</h2><p>Enter the Sampling Lab to see every appointment, explore three reproducible sampling methods, and compare each estimate with the true population mean.</p><PrimaryButton onClick={() => navigate('lab')}>Launch Sampling Lab</PrimaryButton><small>Stage 3 · Sampling Methods Explorer · Default sample size 100</small></div></section>
      <div className="study-facts"><RegistryStat icon={Database} label="Finite population" value={number(rows.length)} detail="Appointments in this file only" /><RegistryStat icon={Activity} label="Target variable" value="wait_time" detail="Waiting time in minutes" /><RegistryStat icon={ShieldCheck} label="Source" value="Simulated" detail="Course teaching dataset" /></div>
      <section className="panel provenance"><div><p className="eyebrow">KNOW YOUR DATA</p><h2>One file. One finite population.</h2><p>The file covers 100 weeks, with five weekdays and 20 slots each day. Records remain in their original order: week, weekday, then appointment slot.</p></div><dl><div><dt>Source file</dt><dd>data/clinic_visits.csv</dd></div><div><dt>Data generation seed</dt><dd>20261105</dd></div><div><dt>Scope</dt><dd>These {number(rows.length)} appointments—not all clinics or patients.</dd></div></dl></section>
      <div className="context-note"><Icon as={CircleHelp} /><p>The current chart is an entry point. Opening the lab uses all {number(rows.length)} appointments; it does not filter the population to that chart.</p></div>
    </div>
  );
}


export default App;
