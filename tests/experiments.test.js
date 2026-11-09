import test from 'node:test';
import assert from 'node:assert/strict';
import { mean, repeatSampling, summarizeEstimates, runBaselineExperiments, comparisonHistograms, experimentCsv, periodicReordering, runChallengeExperiments, conditionHistograms } from '../src/lib/sampling.js';
import { processExperimentRequest } from '../src/workers/experiments.worker.js';

// All repeated-sampling tests use synthetic populations, not the student's
// clinic investigation. Actual baseline experiments wait for the student's click.
const tiny = Array.from({ length: 10 }, (_, i) => ({ wait_time: i * 2, visit_type: i < 2 ? 'A' : i < 5 ? 'B' : 'C' }));
const baselineFixture = Array.from({ length: 1000 }, (_, i) => ({ wait_time: (i * 7) % 31, visit_type: ['A', 'B', 'C', 'D'][i % 4] }));

test('bias, population SD of estimates, and RMSE match hand calculations', () => {
  const result = summarizeEstimates([1, 2, 3], 1);
  assert.equal(result.estimateMean, 2);
  assert.equal(result.bias, 1);
  assert.ok(Math.abs(result.sd - Math.sqrt(2 / 3)) < 1e-12);
  assert.ok(Math.abs(result.rmse - Math.sqrt(5 / 3)) < 1e-12);
  assert.ok(Math.abs(result.rmse ** 2 - result.bias ** 2 - result.sd ** 2) < 1e-12);
  assert.throws(() => summarizeEstimates([], 1));
  assert.throws(() => summarizeEstimates([1, NaN], 1));
});

test('whole-number systematic enumeration lists every start once, needs no seed, and is exact', () => {
  const data = [0, 10, 20, 30].map(wait_time => ({ wait_time }));
  const starts = [];
  const result = repeatSampling(data, { method: 'systematic', n: 2, seed: 'not used', repetitions: 0 }, sample => {
    starts.push(sample.start);
    assert.equal(new Set(sample.indices).size, 2);
  });
  assert.deepEqual(starts, [1, 2]);
  assert.deepEqual(result.estimates, [10, 20]);
  assert.equal(result.type, 'Exact');
  assert.equal(result.seed, null);
  assert.equal(result.runs, 2);
  assert.equal(result.bias, 0);
  assert.equal(result.sd, 5);
  assert.equal(result.rmse, 5);
});

for (const method of ['simple', 'systematic', 'stratified']) {
  test(method + ' Monte Carlo has 1,000 estimates, n unique rows per draw, and reproducible values', () => {
    const settings = { method, n: 3, seed: 24, repetitions: 1000, column: 'visit_type' };
    let draws = 0;
    const handEstimates = [];
    const first = repeatSampling(tiny, settings, sample => {
      draws += 1;
      assert.equal(sample.indices.length, 3);
      assert.equal(new Set(sample.indices).size, 3);
      assert.ok(sample.indices.every(index => index >= 0 && index < tiny.length));
      if (method === 'stratified') {
        const estimate = ['A', 'B', 'C'].reduce((sum, key) => {
          const Nh = tiny.filter(row => row.visit_type === key).length;
          const picked = sample.indices.filter(index => tiny[index].visit_type === key);
          return sum + Nh / tiny.length * picked.reduce((total, index) => total + tiny[index].wait_time, 0) / picked.length;
        }, 0);
        handEstimates.push(estimate);
      } else handEstimates.push(sample.indices.reduce((sum, index) => sum + tiny[index].wait_time, 0) / 3);
    });
    assert.equal(draws, 1000);
    assert.equal(first.type, 'Monte Carlo');
    assert.equal(first.runs, 1000);
    assert.equal(first.seed, 24);
    first.estimates.forEach((value, i) => assert.ok(Math.abs(value - handEstimates[i]) < 1e-12));
    assert.deepEqual(first, repeatSampling(tiny, settings));
    assert.ok(Math.abs(first.rmse ** 2 - first.bias ** 2 - first.sd ** 2) < 1e-10);
    assert.equal(first.column, method === 'stratified' ? 'visit_type' : null);
  });
}

test('Monte Carlo cannot silently use fewer than 1,000 repetitions or infeasible samples', () => {
  for (const repetitions of [0, 100, 999, 1000.5]) assert.throws(() => repeatSampling(tiny, { n: 2, repetitions }));
  assert.throws(() => repeatSampling(tiny, { method: 'stratified', n: 1, repetitions: 1000 }));
  assert.throws(() => repeatSampling(tiny, { method: 'simple', n: 2, seed: -1 }));
});

let suite;
test('the two baseline experiments preserve their settings and reuse the SRS n=100 result', () => {
  const progress = [];
  suite = runBaselineExperiments(baselineFixture, { seed: 17, repetitions: 1000, column: 'visit_type' }, p => progress.push(p));
  assert.deepEqual(suite.methods.map(result => result.method), ['simple', 'systematic', 'stratified']);
  assert.ok(suite.methods.every(result => result.n === 100));
  assert.deepEqual(suite.sizes.map(result => result.n), [1, 10, 100, 640]);
  assert.ok(suite.sizes.every(result => result.method === 'simple'));
  assert.equal(suite.methods[0], suite.sizes[2]);
  assert.equal(progress.at(-1).completed, 6);
  assert.equal(suite.methods[1].runs, 10);
  assert.equal(suite.methods[1].type, 'Exact');
  assert.ok([...suite.methods, ...suite.sizes].every(result => result.N === 1000 && result.truth === mean(baselineFixture.map(row => row.wait_time))));
});

test('comparison histograms share domains, include true/estimate means, and normalize exact vs Monte Carlo', () => {
  const results = [
    { condition: 'Synthetic', N: 10, truth: 0, estimateMean: 1, estimates: [0, 2], runs: 2 },
    { condition: 'Synthetic', N: 10, truth: 0, estimateMean: 1, estimates: Array(1000).fill(1), runs: 1000 },
  ];
  const chart = comparisonHistograms(results);
  assert.ok(chart.xMin < 0 && chart.xMax > 2);
  assert.ok(chart.yMax > 0 && chart.yMax <= 1);
  chart.series.forEach((bins, index) => {
    assert.equal(bins.reduce((sum, bin) => sum + bin.count, 0), results[index].runs);
    assert.ok(Math.abs(bins.reduce((sum, bin) => sum + bin.probability, 0) - 1) < 1e-12);
    assert.deepEqual(bins.map(bin => bin.lower), chart.series[0].map(bin => bin.lower));
  });
  assert.throws(() => comparisonHistograms([results[0], { ...results[1], condition: 'Modified' }]));
  assert.throws(() => comparisonHistograms([{ ...results[0], runs: 1 }]));
});

test('a constant distribution receives valid nonzero chart domains', () => {
  const chart = comparisonHistograms([{ condition: 'Synthetic', N: 1, truth: 3, estimateMean: 3, estimates: [3], runs: 1 }]);
  assert.ok(chart.xMin < 3 && chart.xMax > 3 && chart.yMax > 0);
});

test('CSV export labels six unique results without duplicating the reused n=100 condition', () => {
  const csv = experimentCsv(suite);
  assert.equal(csv.trim().split('\r\n').length, 7);
  assert.match(csv, /True mean \(min\)/);
  assert.match(csv, /Exact; no seed/);
  assert.match(csv, /weight=/);
  assert.match(csv, /also SRS n = 100/);
});

test('worker request reports progress/results with the request ID and reports errors without invented results', () => {
  const messages = [];
  processExperimentRequest({ jobId: 'synthetic-run', rows: baselineFixture, settings: { seed: 17, repetitions: 1000, column: 'visit_type' } }, message => messages.push(message));
  assert.ok(messages.every(message => message.jobId === 'synthetic-run'));
  assert.equal(messages.at(-1).kind, 'result');
  assert.equal(messages.at(-1).result.methods[1].seed, null);
  const errors = [];
  processExperimentRequest({ jobId: 'bad-run', rows: tiny, settings: { repetitions: 100 } }, message => errors.push(message));
  assert.equal(errors.at(-1).kind, 'error');
  assert.ok(!errors.some(message => message.kind === 'result'));
});

test('periodic ordering is the specified stable transpose and preserves every record and value', () => {
  const data = Array.from({ length: 12 }, (_, i) => ({ visit_id: i + 1, wait_time: i })).reverse();
  const before = structuredClone(data);
  const ordered = periodicReordering(data, 3);
  assert.deepEqual(ordered.map(row => row.wait_time), [0, 4, 8, 1, 5, 9, 2, 6, 10, 3, 7, 11]);
  assert.deepEqual(data, before);
  assert.equal(new Set(ordered.map(row => row.visit_id)).size, 12);
  assert.equal(mean(ordered.map(row => row.wait_time)), mean(data.map(row => row.wait_time)));
  assert.throws(() => periodicReordering(data, 5));
});

test('challenge conditions use the same n, original estimators, separate means, and complete labels', () => {
  const original = structuredClone(baselineFixture);
  const settings = { seed: 17, repetitions: 1000, column: 'visit_type', periodicEnabled: true };
  const suite = runChallengeExperiments(baselineFixture, settings);
  assert.deepEqual(baselineFixture, original);
  assert.equal(suite.methods.length, 3);
  assert.equal(suite.modified.length, 3);
  assert.ok([...suite.methods, ...suite.modified].every(result => result.n === 100 && result.N === 1000 && result.truth === mean(baselineFixture.map(row => row.wait_time))));
  assert.ok(suite.methods.every(result => result.condition.startsWith('Baseline')));
  assert.ok(suite.modified.every(result => result.condition.startsWith('Modified')));
  assert.equal(suite.modified[1].type, 'Exact');
  assert.equal(suite.modified[1].seed, null);
  assert.deepEqual(suite, runChallengeExperiments(baselineFixture, settings));
  assert.equal(experimentCsv(suite).trim().split('\r\n').length, 7);
  const axes = conditionHistograms([suite.methods, suite.modified]);
  assert.equal(axes[0].xMin, axes[1].xMin);
  assert.equal(axes[0].xMax, axes[1].xMax);
  assert.equal(axes[0].yMax, axes[1].yMax);
});

test('turning periodic ordering off produces a labeled original-order control with identical seeded results', () => {
  const suite = runChallengeExperiments(baselineFixture, { seed: 17, repetitions: 1000, periodicEnabled: false });
  suite.methods.forEach((result, i) => {
    assert.deepEqual(result.estimates, suite.modified[i].estimates);
    assert.equal(result.truth, suite.modified[i].truth);
    assert.match(suite.modified[i].condition, /Control/);
  });
});

test('challenge worker uses the requested mode and never silently substitutes another mode', () => {
  const messages = [];
  processExperimentRequest({ mode: 'challenge', jobId: 'challenge', rows: baselineFixture, settings: { repetitions: 1000, periodicEnabled: false } }, message => messages.push(message));
  assert.equal(messages.at(-1).kind, 'result');
  assert.equal(messages.at(-1).result.modified.length, 3);
  const invalid = [];
  processExperimentRequest({ mode: 'unknown', jobId: 'invalid', rows: baselineFixture, settings: {} }, message => invalid.push(message));
  assert.equal(invalid.at(-1).kind, 'error');
});
