import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { parseClinicCsv } from '../src/lib/population.js';
import { temporarySample, drawSample } from '../src/lib/sampling.js';

// A DOM integration test, not a substitute for visual browser review.
test('hospital-to-lab journey and all three guided methods, including fractional and infeasible settings', { timeout: 30000 }, async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/' });
  const previous = new Map();
  let paints = 0, outlines = 0;
  const context = { scale() {}, fillRect() { paints += 1; }, strokeRect() { outlines += 1; }, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} };
  dom.window.HTMLCanvasElement.prototype.getContext = () => context;
  dom.window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ width: 600, height: 475, left: 0, top: 0, right: 600, bottom: 475 });
  dom.window.scrollTo = () => {};
  const overrides = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} },
  };
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  let server, root, act;
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
    const React = await import('react');
    act = React.act;
    const { createRoot } = await import('react-dom/client');
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    const rows = parseClinicCsv(await readFile(new URL('../data/clinic_visits.csv', import.meta.url), 'utf8'));
    const document = dom.window.document;
    const pause = () => new Promise(resolve => setTimeout(resolve, 20));
    async function interact(callback) { await act(async () => { callback(); await pause(); }); }
    async function clickText(text) {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text);
      assert.ok(button, 'Button exists: ' + text);
      await interact(() => button.click());
    }
    async function input(id, value) {
      const field = document.getElementById(id);
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
      await interact(() => {
        setter.call(field, value);
        field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
        field.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
      });
    }
    async function submit(selector) {
      await interact(() => document.querySelector(selector).dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    }
    const selectedIds = () => [...document.querySelectorAll('.selected-records tbody th')].map(node => Number(node.textContent.trim()));
    const expectedIds = seed => [...temporarySample(rows, seed).indices].sort((a, b) => a - b).map(i => rows[i].visit_id);
    root = createRoot(document.getElementById('root'));
    await interact(() => root.render(React.createElement(App)));
    for (let i = 0; i < 15 && !document.querySelector('.hospital-hero'); i += 1) await interact(() => {});
    assert.match(document.querySelector('h1').textContent, /clearer view of care/);
    await clickText('Open a simulated chart');
    assert.equal(document.querySelector('.wait-value strong').textContent, String(rows[0].wait_time));
    const overviewTab = document.getElementById('overview-tab');
    await interact(() => overviewTab.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    assert.equal(document.getElementById('details-tab').getAttribute('aria-selected'), 'true');
    assert.match(document.querySelector('#chart-panel').textContent, /visit_id/);
    await clickText('Quality & Safety / Research & Analytics');
    assert.match(document.querySelector('h1').textContent, /Research & Analytics/);
    await clickText('Launch Sampling Lab');
    assert.match(document.querySelector('h1').textContent, /Sampling Methods Explorer/);
    assert.equal(document.querySelectorAll('.method-picker button').length, 3);
    assert.equal(document.getElementById('sample-size').value, '100');
    assert.equal(document.querySelectorAll('canvas').length, 1);
    assert.ok(paints >= 10000, 'Every population row receives a grid mark.');
    assert.ok(outlines >= 100, 'Selected rows receive outlines as well as color.');
    assert.deepEqual(selectedIds(), expectedIds(2026).slice(0, 10));
    assert.match(document.querySelector('.result-yellow').textContent, /22.6842/);
    assert.match(document.querySelector('.result-coral').textContent, new RegExp(temporarySample(rows, 2026).estimate.toFixed(4).replace('.', '\\.')));
    await input('row-number', '640');
    await submit('.row-search');
    assert.match(document.querySelector('.inspector-record-top').textContent, /AP-00640/);
    assert.equal(document.querySelector('.inspector-wait strong').textContent.trim(), rows[639].wait_time + ' min');
    assert.deepEqual(selectedIds(), expectedIds(2026).slice(0, 10), 'Inspection leaves sample membership unchanged.');
    await clickText('Next seed');
    assert.deepEqual(selectedIds(), expectedIds(2027).slice(0, 10));
    await input('seed', '2026');
    await submit('.seed-controls');
    assert.deepEqual(selectedIds(), expectedIds(2026).slice(0, 10), 'Restoring a seed restores the selected IDs.');
    await input('seed', '-1');
    await submit('.seed-controls');
    assert.match(document.getElementById('seed-error').textContent, /whole-number seed/);
    assert.deepEqual(selectedIds(), [], 'Invalid settings never display a stale sample as current.');
    assert.equal(document.querySelector('.result-coral strong').textContent, '—');
    await input('seed', '2026');
    await interact(() => document.querySelector('[aria-label="Next selected records"]').click());
    assert.deepEqual(selectedIds(), expectedIds(2026).slice(10, 20));
    const chooseMethod = method => interact(() => document.querySelector('.method-picker button[data-method="' + method + '"]').click());
    const expected = (method, n, column = 'visit_type') => drawSample(rows, { method, n, seed: 2026, column });
    await chooseMethod('systematic');
    assert.equal(document.getElementById('sample-size').value, '100');
    assert.equal(document.getElementById('seed').value, '2026');
    assert.match(document.querySelector('.systematic-design').textContent, /Whole-number interval/);
    assert.match(document.querySelector('.systematic-design').textContent, /100/);
    await input('sample-size', '640');
    assert.match(document.querySelector('.systematic-design').textContent, /Fractional interval/);
    assert.match(document.querySelector('.systematic-design').textContent, /15.625/);
    assert.deepEqual(selectedIds(), expected('systematic', 640).indices.slice(0, 10).map(index => index + 1));
    assert.match(document.querySelector('canvas').getAttribute('aria-label'), /640 selected/);
    const traceButtons = document.querySelectorAll('.selection-trace button');
    await interact(() => traceButtons[2].click());
    assert.match(document.querySelector('.inspector-record-top').textContent, new RegExp('AP-' + String(expected('systematic', 640).indices[2] + 1).padStart(5, '0')));
    await chooseMethod('stratified');
    assert.equal(document.getElementById('sample-size').value, '640');
    assert.equal(document.getElementById('stratum-column').value, 'visit_type');
    assert.equal(document.querySelectorAll('.allocation-table tbody tr').length, 3);
    assert.match(document.querySelector('.result-coral').textContent, /Population-weighted estimate/);
    assert.equal(document.querySelector('.result-coral strong').textContent, expected('stratified', 640).estimate.toFixed(4));
    const allocationRows = [...document.querySelectorAll('.allocation-table tbody tr')];
    assert.equal(allocationRows.reduce((sum, row) => sum + Number(row.querySelectorAll('td')[2].textContent), 0), 640);
    assert.ok(Math.abs(allocationRows.reduce((sum, row) => sum + Number(row.querySelectorAll('td')[3].textContent), 0) - 1) < 1e-12);
    await interact(() => document.querySelectorAll('.walkthrough-steps button')[1].click());
    assert.match(document.querySelector('.walkthrough-explanation').textContent, /largest-remainder/);
    const column = document.getElementById('stratum-column');
    await interact(() => { column.value = 'slot'; column.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(document.querySelectorAll('.allocation-table tbody tr').length, 20);
    await input('sample-size', '1');
    assert.match(document.getElementById('seed-error').textContent, /each of 20 strata/);
    assert.equal(document.getElementById('sample-size').value, '1', 'An infeasible allocation never silently changes n.');
    assert.equal(document.querySelector('.result-coral strong').textContent, '—');
    assert.deepEqual(selectedIds(), []);
    assert.match(document.querySelector('canvas').getAttribute('aria-label'), /0 selected/);
    assert.equal(document.querySelectorAll('.allocation-table tbody tr').length, 20, 'No strata are silently omitted.');
    await chooseMethod('simple');
    assert.equal(document.getElementById('sample-size').value, '1');
    assert.equal(selectedIds().length, 1);
    assert.equal(document.querySelector('[aria-label="Next selected records"]').disabled, true);
    await chooseMethod('systematic');
    assert.match(document.querySelector('.systematic-design').textContent, /10,000/);
    assert.equal(selectedIds().length, 1);
    await chooseMethod('stratified');
    const columnAgain = document.getElementById('stratum-column');
    await interact(() => { columnAgain.value = 'visit_type'; columnAgain.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    await clickText('Use n = 3 for all methods');
    assert.equal(document.getElementById('sample-size').value, '3');
    assert.equal(selectedIds().length, 3);
    assert.equal(document.querySelectorAll('.allocation-table tbody tr').length, 3);
    assert.equal(document.querySelector('[role="alert"]'), null);
    await input('sample-size', '10001');
    assert.match(document.getElementById('seed-error').textContent, /from 1 to 10000/);
    assert.equal(document.querySelector('.result-coral strong').textContent, '—');
  } finally {
    if (root && act) await act(async () => root.unmount());
    if (server) await server.close();
    dom.window.close();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
