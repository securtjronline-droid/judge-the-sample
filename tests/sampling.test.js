import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { mean, populationMean, sampleMean, simpleRandomIndices, temporarySample, createSeededRandom } from '../src/lib/sampling.js';
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
