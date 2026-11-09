import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mean, populationMean, sampleMean, simpleRandomIndices, temporarySample, createSeededRandom, drawSample, systematicSelection, wholeSystematicIndices, fractionalSystematicIndices, proportionalAllocation, populationWeightedMean, InfeasibleStratificationError } from '../src/lib/sampling.js';
import { parseCsv, parseClinicCsv } from '../src/lib/population.js';

const csv = await readFile(new URL('../data/clinic_visits.csv', import.meta.url), 'utf8');
const rows = parseClinicCsv(csv);

test('supplied CSV is unchanged and all 10,000 rows retain their original identifiers and order', () => {
  assert.equal(createHash('sha256').update(csv).digest('hex'), '594c0f62bb522b383670661a531410a89ac376311c9a11a8b840110970621980');
  assert.equal(rows.length, 10000);
  rows.forEach((row, index) => assert.equal(row.visit_id, index + 1));
});

for (const n of [1, 10, 100, 640, 10000]) {
  test('SRS contains exactly ' + n + ' distinct valid rows, including a size that does not divide N', () => {
    for (const seed of [0, 1, 2026, 0xFFFFFFFF]) {
      const indices = simpleRandomIndices(rows.length, n, seed);
      assert.equal(indices.length, n);
      assert.equal(new Set(indices).size, n);
      assert.ok(indices.every(i => Number.isInteger(i) && i >= 0 && i < rows.length));
      if (n === rows.length) assert.deepEqual([...indices].sort((a, b) => a - b), rows.map((_, i) => i));
    }
  });
}

test('the same seed and settings reproduce the same sample without modifying the population', () => {
  const original = structuredClone(rows);
  const first = temporarySample(rows, 2026);
  const second = temporarySample(rows, 2026);
  assert.deepEqual(first, second);
  assert.deepEqual(rows, original);
});

test('known synthetic population and sample means match hand calculations', () => {
  const data = [2, 4, 8, 10].map(wait_time => ({ wait_time }));
  assert.equal(mean([2, 4, 8, 10]), 6);
  assert.equal(populationMean(data), 6);
  assert.equal(sampleMean(data, [0, 2]), 5);
  assert.equal(sampleMean(data, [1, 3]) - populationMean(data), 1);
});

test('the Stage 2 estimate, error, and selected IDs all use the same 100-row sample', () => {
  const result = temporarySample(rows, 2026);
  assert.equal(result.n, 100);
  assert.equal(result.N, 10000);
  assert.equal(result.estimate, result.indices.reduce((sum, i) => sum + rows[i].wait_time, 0) / 100);
  assert.equal(result.truth, rows.reduce((sum, row) => sum + row.wait_time, 0) / rows.length);
  assert.equal(result.error, result.estimate - result.truth);
});

test('invalid sample sizes, seeds, duplicate rows, and missing target values are rejected', () => {
  for (const n of [0, -1, 1.5, 10001]) assert.throws(() => simpleRandomIndices(10000, n, 2026));
  for (const seed of [-1, 1.5, NaN, Infinity, 0x100000000]) assert.throws(() => simpleRandomIndices(10000, 100, seed));
  assert.throws(() => sampleMean(rows, [1, 1]));
  assert.throws(() => sampleMean(rows, [10000]));
  assert.throws(() => mean([]));
  assert.throws(() => mean([1, NaN]));
  assert.throws(() => parseClinicCsv('visit_id,week,weekday,slot,visit_type,wait_time\n1,1,Mon,1,New,\n'));
});

test('CSV parsing supports BOM, quoted fields, escaped quotes, and CRLF without dropping records', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n"one,two","a""b"\r\n'), [['a', 'b'], ['one,two', 'a"b']]);
  assert.throws(() => parseCsv('a,b\n"unfinished,b'));
  assert.throws(() => parseClinicCsv('visit_id,week,weekday,slot,visit_type,wait_time\n2,1,Mon,1,New,5\n'));
});

test('seeded integer draws stay within their specified bounds', () => {
  const rng = createSeededRandom(2026);
  for (const bound of [1, 3, 100, 10000]) {
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.intBelow(bound);
      assert.ok(Number.isInteger(value) && value >= 0 && value < bound);
    }
  }
});

for (const n of [1, 10, 100, 640, 9999, 10000]) {
  test('systematic sampling gives exactly ' + n + ' distinct rows with a valid start and interval', () => {
    for (const seed of [0, 1, 2026, 4294967295]) {
      const result = systematicSelection(rows.length, n, seed);
      assert.equal(result.indices.length, n);
      assert.equal(new Set(result.indices).size, n);
      assert.ok(result.indices.every(index => index >= 0 && index < rows.length));
      assert.equal(result.interval, rows.length / n);
      assert.ok(result.start > 0 && result.start <= result.interval);
      if (rows.length % n === 0) {
        assert.ok(Number.isInteger(result.start));
        assert.deepEqual(result.indices, wholeSystematicIndices(rows.length, n, result.start));
      } else {
        assert.equal(result.design, 'Fractional interval');
        assert.ok(result.indices.every((index, j) => j === 0 || index > result.indices[j - 1]));
      }
    }
  });
}

test('whole-number rules include both possible endpoint starts and preserve file order', () => {
  assert.deepEqual(wholeSystematicIndices(12, 3, 1), [0, 4, 8]);
  assert.deepEqual(wholeSystematicIndices(12, 3, 4), [3, 7, 11]);
  assert.throws(() => wholeSystematicIndices(12, 3, 0));
  assert.throws(() => wholeSystematicIndices(12, 3, 5));
});

test('fractional rules match hand calculations at boundaries and fractional interval 15.625', () => {
  assert.deepEqual(fractionalSystematicIndices(10, 3, 1, 2), [1, 4, 8]);
  assert.deepEqual(fractionalSystematicIndices(10, 3, 3, 10), [0, 4, 7]);
  assert.deepEqual(fractionalSystematicIndices(10, 3, 1, 1), [3, 6, 9]);
  assert.deepEqual(fractionalSystematicIndices(10, 3, 1, 4294967296), [0, 3, 6]);
  const result = fractionalSystematicIndices(10000, 640, 1, 1);
  assert.deepEqual(result.slice(0, 3), [15, 31, 46]);
  assert.equal(result.at(-1), 9999);
  assert.throws(() => fractionalSystematicIndices(10, 3, 0, 10));
  assert.throws(() => fractionalSystematicIndices(10, 3, 11, 10));
});

test('small synthetic populations satisfy unique row counts and equal inclusion under systematic rules', () => {
  for (let N = 1; N <= 25; N += 1) {
    for (let n = 1; n <= N; n += 1) {
      const counts = Array(N).fill(0);
      const starts = N % n === 0 ? N / n : N;
      for (let r = 1; r <= starts; r += 1) {
        const indices = N % n === 0 ? wholeSystematicIndices(N, n, r) : fractionalSystematicIndices(N, n, r, N);
        assert.equal(indices.length, n);
        assert.equal(new Set(indices).size, n);
        indices.forEach(index => { assert.ok(index >= 0 && index < N); counts[index] += 1; });
      }
      assert.ok(counts.every(count => count === counts[0]));
    }
  }
});

test('allocation uses full proportional quotas and largest remainders, with deterministic ties', () => {
  assert.deepEqual(proportionalAllocation([5475, 2469, 2056], 100), [55, 25, 20]);
  assert.deepEqual(proportionalAllocation([2, 2, 2], 4), [2, 1, 1]);
  assert.deepEqual(proportionalAllocation([9, 1, 1], 3), [1, 1, 1]);
  assert.deepEqual(proportionalAllocation([1, 1, 8], 5), [1, 1, 3]);
  assert.deepEqual(proportionalAllocation([1, 1, 8], 10), [1, 1, 8]);
  assert.throws(() => proportionalAllocation([9, 1, 1], 2), InfeasibleStratificationError);
});

for (const column of ['visit_type', 'weekday', 'slot']) {
  test('stratified allocations, weights, and records are correct for ' + column, () => {
    const H = new Set(rows.map(row => row[column])).size;
    for (const n of [...new Set([H, 10, 100, 640, 10000])]) {
      if (n < H) {
        assert.throws(() => drawSample(rows, { method: 'stratified', n, seed: 2026, column }), InfeasibleStratificationError);
        continue;
      }
      const result = drawSample(rows, { method: 'stratified', n, seed: 2026, column });
      assert.equal(result.indices.length, n);
      assert.equal(new Set(result.indices).size, n);
      assert.equal(result.strata.length, H);
      assert.equal(result.strata.reduce((sum, group) => sum + group.allocation, 0), n);
      assert.ok(Math.abs(result.strata.reduce((sum, group) => sum + group.weight, 0) - 1) < 1e-12);
      assert.ok(Math.abs(result.weightSum - 1) < 1e-12);
      result.strata.forEach(group => {
        assert.ok(group.allocation >= 1 && group.allocation <= group.populationSize);
        assert.equal(group.indices.length, group.allocation);
        assert.ok(group.indices.every(index => String(rows[index][column]) === group.key));
        assert.equal(group.weight, group.populationSize / rows.length);
      });
      const weighted = result.strata.reduce((sum, group) => sum + group.weight * group.sampleMean, 0);
      assert.equal(result.estimate, weighted);
    }
    assert.throws(() => drawSample(rows, { method: 'stratified', n: 1, seed: 2026, column }), InfeasibleStratificationError);
  });
}

test('population weighting matches a known answer and is distinct from a pooled sample mean', () => {
  assert.equal(populationWeightedMean([{ populationSize: 2, sampleMean: 10 }, { populationSize: 8, sampleMean: 30 }]), 26);
  const synthetic = [
    ...Array.from({ length: 2 }, () => ({ visit_type: 'A', wait_time: 10 })),
    ...Array.from({ length: 8 }, () => ({ visit_type: 'B', wait_time: 30 })),
  ];
  const sample = drawSample(synthetic, { method: 'stratified', n: 3, seed: 12, column: 'visit_type' });
  assert.equal(sample.estimate, 26);
  assert.notEqual(sampleMean(synthetic, sample.indices), sample.estimate);
  assert.throws(() => populationWeightedMean([{ populationSize: 2, sampleMean: NaN }]));
});

test('all methods reproduce the same sample, metadata, and estimate for the same settings', () => {
  const original = structuredClone(rows);
  for (const method of ['simple', 'systematic', 'stratified']) {
    for (const n of [10, 100, 640]) {
      const settings = { method, n, seed: 2026, column: 'visit_type' };
      assert.deepEqual(drawSample(rows, settings), drawSample(rows, settings));
    }
  }
  assert.deepEqual(rows, original);
});
