import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { summarizeEstimates } from '../src/lib/sampling.js';

// Synthetic distribution fixtures test rendering/lifecycle only. They never
// run the student's clinic experiments or supply production result values.
function fixture(settings, challenge = false) {
  const truth = 22.6842;
  function result(method, n) {
    const exact = method === 'systematic';
    const estimates = Array.from({ length: exact ? 100 : settings.repetitions }, (_, i) => truth + (i % 2 ? 1 : -1));
    return {
      method, n, N: 10000, truth, estimates, runs: estimates.length,
      condition: 'Baseline · Original CSV', type: exact ? 'Exact' : 'Monte Carlo',
      seed: exact ? null : settings.seed,
      column: method === 'stratified' ? settings.column : null,
      allocation: method === 'stratified' ? [{ key: 'Synthetic test group', populationSize: 10000, allocation: 100, weight: 1 }] : null,
      ...summarizeEstimates(estimates, truth),
    };
  }
  const methods = [result('simple', 100), result('systematic', 100), result('stratified', 100)];
  if (challenge) {
    const modified = [result('simple', 100), result('systematic', 100), result('stratified', 100)].map(item => ({ ...item, condition: settings.periodicEnabled ? 'Modified · Periodic order (100 bands)' : 'Control · Original order' }));
    return { settings: { ...settings, n: 100, N: 10000 }, methods, modified, sizes: [] };
  }
  return { settings: { ...settings, N: 10000, condition: 'Baseline · Original CSV' }, methods, sizes: [result('simple', 1), result('simple', 10), methods[0], result('simple', 640)] };
}

test('Stage 4 runs only on request, renders labeled distributions, exports CSV, and rejects stale/canceled results', { timeout: 30000 }, async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/#experiments' });
  dom.window.scrollTo = () => {};
  const requests = [];
  class MockWorker {
    constructor(url, options) {
      assert.match(url.href, /experiments\.worker\.js$/);
      assert.equal(options.type, 'module');
      this.terminated = false;
    }
    postMessage(request) { requests.push({ worker: this, request }); }
    terminate() { this.terminated = true; }
  }
  const previous = new Map();
  const overrides = {
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, Node: dom.window.Node, Event: dom.window.Event,
    Worker: MockWorker, IS_REACT_ACT_ENVIRONMENT: true,
    ResizeObserver: class { constructor(callback) { this.callback = callback; } observe() { this.callback(); } disconnect() {} },
  };
  for (const [name, value] of Object.entries(overrides)) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  let downloadedBlob, downloadedName, server, root, act;
  URL.createObjectURL = blob => { downloadedBlob = blob; return 'blob:synthetic-test'; };
  URL.revokeObjectURL = () => {};
  dom.window.HTMLAnchorElement.prototype.click = function () { downloadedName = this.download; };
  try {
    server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
    const React = await import('react'); act = React.act;
    const { createRoot } = await import('react-dom/client');
    const { default: App } = await server.ssrLoadModule('/src/App.jsx');
    const document = dom.window.document;
    const pause = () => new Promise(resolve => setTimeout(resolve, 20));
    async function interact(callback) { await act(async () => { callback(); await pause(); }); }
    async function click(text) {
      const button = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === text);
      assert.ok(button, 'Button exists: ' + text);
      await interact(() => button.click());
    }
    async function input(id, value) {
      const element = document.getElementById(id);
      const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
      await interact(() => { setter.call(element, value); element.dispatchEvent(new dom.window.Event('input', { bubbles: true })); element.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    }
    async function complete(record) { await interact(() => record.worker.onmessage({ data: { kind: 'result', jobId: record.request.jobId, result: fixture(record.request.settings, record.request.mode === 'challenge') } })); }
    root = createRoot(document.getElementById('root'));
    await interact(() => root.render(React.createElement(App)));
    for (let i = 0; i < 15 && !document.querySelector('.experiment-empty'); i += 1) await interact(() => {});
    assert.equal(requests.length, 0, 'Opening the page never runs an experiment.');
    assert.equal(document.querySelectorAll('.distribution-card').length, 0);
    assert.equal(document.getElementById('experiment-repetitions').value, '1000');
    await click('Run experiments');
    assert.equal(requests.length, 1);
    const first = requests[0];
    assert.equal(first.request.rows.length, 10000);
    assert.equal(first.request.rows[639].visit_id, 640);
    assert.deepEqual(first.request.settings, { seed: 2026, repetitions: 1000, column: 'visit_type' });
    assert.ok(document.querySelector('[role="status"]'));
    await complete(first);
    assert.equal(first.worker.terminated, true);
    assert.equal(document.querySelectorAll('.distribution-card').length, 7);
    assert.equal(document.querySelectorAll('svg[role="img"]').length, 7);
    assert.equal(document.querySelectorAll('.results-table-panel tbody tr').length, 6);
    assert.equal(document.querySelectorAll('.exact-type').length, 1);
    assert.equal(document.querySelectorAll('.monte-carlo-type').length, 6);
    assert.match(document.querySelector('.experiment-results').textContent, /100 starts · no seed/);
    assert.equal(document.querySelectorAll('.distribution-metrics').length, 7);
    await interact(() => first.worker.onerror());
    assert.equal(document.querySelectorAll('.distribution-card').length, 7, 'A late error from a completed worker cannot clear current results.');
    assert.ok([...document.querySelectorAll('svg[role="img"]')].every(node => node.textContent.includes('Estimated mean wait (minutes)') && node.textContent.includes('Estimates per bin (%)')));
    await click('Download results CSV');
    assert.equal(downloadedName, 'northstar-stage4-seed-2026.csv');
    assert.equal((await downloadedBlob.text()).trim().split('\r\n').length, 7);
    await input('experiment-seed', '2027');
    assert.equal(document.querySelector('.experiment-results'), null, 'Changing settings clears old results.');
    await click('Run experiments');
    assert.equal(requests.length, 2);
    await complete(first);
    assert.equal(document.querySelector('.experiment-results'), null, 'A result from an earlier request is ignored.');
    await click('Cancel run');
    assert.equal(requests[1].worker.terminated, true);
    assert.match(document.querySelector('[role="alert"]').textContent, /Run canceled/);
    await complete(requests[1]);
    assert.equal(document.querySelector('.experiment-results'), null);
    await input('experiment-repetitions', '999');
    const runButton = [...document.querySelectorAll('button')].find(node => node.textContent.trim() === 'Run experiments');
    assert.equal(runButton.disabled, true);
    assert.match(document.querySelector('[role="alert"]').textContent, /1,000–10,000/);
    await input('experiment-repetitions', '1000');
    await click('Run experiments');
    assert.equal(requests.length, 3);
    await interact(() => requests[2].worker.onmessage({ data: { kind: 'error', jobId: requests[2].request.jobId, message: 'Synthetic test failure' } }));
    assert.match(document.querySelector('[role="alert"]').textContent, /Synthetic test failure/);
    assert.equal(document.querySelector('.experiment-results'), null);
    await click('Open Stage 5 challenge');
    assert.match(document.querySelector('h1').textContent, /Sampling Challenge/);
    assert.match(document.querySelector('.challenge-proposal').textContent, /AI-assisted/);
    assert.equal(document.querySelectorAll('.distribution-card').length, 0);
    const toggle = document.querySelector('.challenge-toggle input');
    assert.equal(toggle.checked, true);
    await click('Run experiments');
    assert.equal(requests.at(-1).request.mode, 'challenge');
    assert.equal(requests.at(-1).request.settings.periodicEnabled, true);
    await complete(requests.at(-1));
    assert.equal(document.querySelectorAll('.distribution-card').length, 6);
    assert.equal(document.querySelectorAll('.results-table-panel tbody tr').length, 6);
    assert.equal(document.querySelectorAll('.exact-type').length, 2);
    assert.match(document.querySelector('.experiment-results').textContent, /Modified/);
    await click('Download results CSV');
    assert.equal(downloadedName, 'northstar-stage5-seed-2026.csv');
    const csv = await downloadedBlob.text();
    assert.equal(csv.trim().split('\r\n').length, 7);
    assert.match(csv, /Modified/);
    await interact(() => toggle.click());
    assert.equal(document.querySelector('.experiment-results'), null);
    await click('Run experiments');
    assert.equal(requests.at(-1).request.settings.periodicEnabled, false);
    await complete(requests.at(-1));
    assert.match(document.querySelector('.experiment-results').textContent, /Control · Original order/);
  } finally {
    if (root && act) await act(async () => root.unmount());
    if (server) await server.close();
    URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
    dom.window.close();
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
