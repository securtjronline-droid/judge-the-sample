export const TEMPORARY_SAMPLE_SIZE = 100;
const UINT32_RANGE = 0x100000000;

export function validateSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed >= UINT32_RANGE) {
    throw new RangeError('Use a whole-number seed from 0 to 4,294,967,295.');
  }
  return seed;
}

// Mulberry32: one deterministic uint32 stream per seed. Rejection sampling
// avoids modulo bias when mapping that stream to integer positions.
export function createSeededRandom(seed) {
  let state = validateSeed(seed);
  function nextUint32() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  return {
    nextUint32,
    intBelow(bound) {
      if (!Number.isInteger(bound) || bound < 1 || bound > UINT32_RANGE) throw new RangeError('Invalid random integer bound.');
      const limit = Math.floor(UINT32_RANGE / bound) * bound;
      let value;
      do { value = nextUint32(); } while (value >= limit);
      return value % bound;
    },
  };
}

export function mean(values) {
  if (values.length === 0) throw new RangeError('A mean needs at least one observation.');
  let sum = 0, correction = 0;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Every observation must be a finite number.');
    const adjusted = value - correction;
    const next = sum + adjusted;
    correction = (next - sum) - adjusted;
    sum = next;
  }
  return sum / values.length;
}

export function populationMean(rows) {
  return mean(rows.map(row => row.wait_time));
}

// A partial Fisher–Yates shuffle draws distinct indices without replacement.
export function simpleRandomIndices(N, n, seed) {
  return drawRandomIndices(N, n, createSeededRandom(seed));
}

function drawRandomIndices(N, n, random) {
  if (!Number.isInteger(N) || N < 1 || N > 0xFFFFFFFF) throw new RangeError('Invalid population size.');
  if (!Number.isInteger(n) || n < 1 || n > N) throw new RangeError('Sample size must be a whole number between 1 and N.');
  const positions = Array.from({ length: N }, (_, i) => i);
  for (let i = 0; i < n; i += 1) {
    const j = i + random.intBelow(N - i);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, n);
}

export function sampleMean(rows, indices) {
  if (new Set(indices).size !== indices.length) throw new RangeError('A sample cannot contain duplicate rows.');
  return mean(indices.map(index => {
    if (!Number.isInteger(index) || index < 0 || index >= rows.length) throw new RangeError('Sample row is outside the population.');
    return rows[index].wait_time;
  }));
}

export function temporarySample(rows, seed) {
  const indices = simpleRandomIndices(rows.length, TEMPORARY_SAMPLE_SIZE, seed);
  const truth = populationMean(rows);
  const estimate = sampleMean(rows, indices);
  return Object.freeze({
    indices: Object.freeze(indices),
    n: TEMPORARY_SAMPLE_SIZE,
    N: rows.length,
    seed,
    estimate,
    truth,
    error: estimate - truth,
  });
}

export const METHODS = ['simple', 'systematic', 'stratified'];
export const GROUP_COLUMNS = ['visit_type', 'weekday', 'slot'];

function validateSize(N, n) {
  if (!Number.isInteger(N) || N < 1 || N > 0xFFFFFFFF) throw new RangeError('Invalid population size.');
  if (!Number.isInteger(n) || n < 1 || n > N) throw new RangeError('Sample size must be a whole number from 1 to ' + N + '.');
}

export function wholeSystematicIndices(N, n, start) {
  validateSize(N, n);
  const interval = N / n;
  if (N % n !== 0 || !Number.isInteger(start) || start < 1 || start > interval) {
    throw new RangeError('A whole-number start must be an integer from 1 to k.');
  }
  return Array.from({ length: n }, (_, j) => start - 1 + j * interval);
}

// q = numerator/denominator is the random fraction of the first interval.
// u = q * N/n. Exact rational arithmetic implements ceil(u + j*N/n),
// including integer boundaries and the closed right endpoint, without clamps.
export function fractionalSystematicIndices(N, n, numerator, denominator) {
  validateSize(N, n);
  const p = BigInt(numerator), d = BigInt(denominator);
  if (d < 1n || p < 1n || p > d) throw new RangeError('The fractional start must lie in (0, 1] of the interval.');
  const divisor = BigInt(n) * d;
  return Array.from({ length: n }, (_, j) => {
    const position = BigInt(N) * (p + BigInt(j) * d);
    const index = Number((position + divisor - 1n) / divisor) - 1;
    if (index < 0 || index >= N) throw new RangeError('Systematic row exceeds the population.');
    return index;
  });
}

export function systematicSelection(N, n, seed) {
  return systematicWithRandom(N, n, createSeededRandom(seed));
}

function systematicWithRandom(N, n, rng) {
  validateSize(N, n);
  const interval = N / n;
  if (N % n === 0) {
    const start = rng.intBelow(interval) + 1;
    return { indices: wholeSystematicIndices(N, n, start), interval, start, design: 'Whole-number interval', startExact: String(start) };
  }
  const numerator = rng.nextUint32() + 1;
  const denominator = UINT32_RANGE;
  return {
    indices: fractionalSystematicIndices(N, n, numerator, denominator),
    interval,
    start: numerator / denominator * interval,
    design: 'Fractional interval',
    startExact: (BigInt(numerator) * BigInt(N)).toString() + ' / ' + (BigInt(denominator) * BigInt(n)).toString(),
  };
}

export class InfeasibleStratificationError extends RangeError {
  constructor(n, count) {
    super('n = ' + n + ' cannot give at least one appointment to each of ' + count + ' strata. Choose a larger sample or another group column.');
    this.name = 'InfeasibleStratificationError';
    this.minimum = count;
  }
}

export function populationStrata(rows, column) {
  if (!GROUP_COLUMNS.includes(column)) throw new RangeError('Choose an observable group column: ' + GROUP_COLUMNS.join(', ') + '.');
  const groups = new Map();
  rows.forEach((row, index) => {
    const value = row[column];
    if (value === undefined || value === null || value === '') throw new Error('Every appointment must have a stratum value.');
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(index);
  });
  return [...groups].map(([key, positions]) => ({ key: String(key), positions, populationSize: positions.length, weight: positions.length / rows.length }));
}

export function proportionalAllocation(sizes, n) {
  if (!sizes.length || sizes.some(size => !Number.isInteger(size) || size < 1)) throw new RangeError('Strata must have positive integer sizes.');
  const N = sizes.reduce((sum, size) => sum + size, 0);
  validateSize(N, n);
  if (n < sizes.length) throw new InfeasibleStratificationError(n, sizes.length);
  // Full proportional quotas first: never reserve one before computing quotas.
  // The integer remainders make tie-breaking independent of floating rounding.
  const numerators = sizes.map(size => BigInt(n) * BigInt(size));
  const population = BigInt(N);
  const allocations = numerators.map((quota, i) => Math.min(sizes[i], Math.max(1, Number(quota / population))));
  let total = allocations.reduce((sum, size) => sum + size, 0);
  while (total !== n) {
    const adding = total < n;
    let chosen = -1, best = null;
    allocations.forEach((value, i) => {
      if (adding ? value >= sizes[i] : value <= 1) return;
      const deficit = numerators[i] - BigInt(value) * population;
      const score = adding ? deficit : -deficit;
      if (best === null || score > best) { best = score; chosen = i; }
    });
    if (chosen < 0) throw new RangeError('The allocation is infeasible.');
    allocations[chosen] += adding ? 1 : -1;
    total += adding ? 1 : -1;
  }
  return allocations;
}

export function populationWeightedMean(strata) {
  const N = strata.reduce((sum, group) => {
    if (!Number.isInteger(group.populationSize) || group.populationSize < 1) throw new RangeError('Invalid stratum population size.');
    return sum + group.populationSize;
  }, 0);
  if (!N) throw new RangeError('The weighted estimate needs every stratum.');
  return strata.reduce((sum, group) => {
    if (!Number.isFinite(group.sampleMean)) throw new RangeError('Each stratum needs a finite sample mean.');
    return sum + group.populationSize / N * group.sampleMean;
  }, 0);
}

export function stratifiedSelection(rows, n, seed, column = 'visit_type') {
  validateSize(rows.length, n);
  return stratifiedWithPlan(rows, n, createSeededRandom(seed), column, prepareStrata(rows, n, column));
}

function prepareStrata(rows, n, column) {
  const groups = populationStrata(rows, column);
  const allocation = proportionalAllocation(groups.map(group => group.populationSize), n);
  return { groups, allocation };
}

function stratifiedWithPlan(rows, n, rng, column, { groups, allocation }) {
  const strata = groups.map((group, i) => {
    const indices = drawRandomIndices(group.populationSize, allocation[i], rng).map(position => group.positions[position]);
    return { key: group.key, populationSize: group.populationSize, weight: group.weight, quota: n * group.populationSize / rows.length, allocation: allocation[i], indices, sampleMean: sampleMean(rows, indices) };
  });
  return { indices: strata.flatMap(group => group.indices), strata, estimate: populationWeightedMean(strata), weightSum: strata.reduce((sum, group) => sum + group.weight, 0), column };
}

function prepareGenerator(rows, { method, n, column }) {
  validateSize(rows.length, n);
  if (method === 'simple') return rng => {
    const indices = drawRandomIndices(rows.length, n, rng);
    return { indices, estimate: sampleMean(rows, indices) };
  };
  if (method === 'systematic') return rng => {
    const selection = systematicWithRandom(rows.length, n, rng);
    return { ...selection, estimate: sampleMean(rows, selection.indices) };
  };
  if (method === 'stratified') {
    const plan = prepareStrata(rows, n, column);
    return rng => stratifiedWithPlan(rows, n, rng, column, plan);
  }
  throw new RangeError('Unknown sampling method.');
}

export function drawSample(rows, { method = 'simple', n = 100, seed = 2026, column = 'visit_type' } = {}) {
  validateSize(rows.length, n);
  validateSeed(seed);
  const selection = prepareGenerator(rows, { method, n, column })(createSeededRandom(seed));
  const truth = populationMean(rows);
  const estimate = selection.estimate;
  return { ...selection, method, n, N: rows.length, seed, truth, estimate, error: estimate - truth };
}

export function summarizeEstimates(estimates, truth) {
  if (!Number.isFinite(truth)) throw new RangeError('The true mean must be finite.');
  const estimateMean = mean(estimates);
  const bias = estimateMean - truth;
  const sd = Math.sqrt(mean(estimates.map(value => (value - estimateMean) ** 2)));
  const rmse = Math.sqrt(mean(estimates.map(value => (value - truth) ** 2)));
  return { estimateMean, bias, sd, rmse };
}

export function repeatSampling(rows, { method = 'simple', n = 100, seed = 2026, repetitions = 1000, column = 'visit_type', condition = 'Baseline · Original CSV' } = {}, onSample) {
  validateSize(rows.length, n);
  const truth = populationMean(rows);
  const exact = method === 'systematic' && rows.length % n === 0;
  const estimates = [];
  let allocation = null;
  if (exact) {
    for (let start = 1; start <= rows.length / n; start += 1) {
      const indices = wholeSystematicIndices(rows.length, n, start);
      estimates.push(sampleMean(rows, indices));
      onSample?.({ indices, start });
    }
  } else {
    if (!Number.isInteger(repetitions) || repetitions < 1000) throw new RangeError('Monte Carlo requires at least 1,000 whole-number repetitions.');
    const rng = createSeededRandom(seed);
    const generate = prepareGenerator(rows, { method, n, column });
    for (let i = 0; i < repetitions; i += 1) {
      const selection = generate(rng);
      estimates.push(selection.estimate);
      onSample?.(selection);
      if (i === 0 && selection.strata) allocation = selection.strata.map(({ key, populationSize, weight, allocation }) => ({ key, populationSize, weight, allocation }));
    }
  }
  return {
    condition,
    method, n, N: rows.length,
    type: exact ? 'Exact' : 'Monte Carlo',
    seed: exact ? null : seed,
    runs: estimates.length,
    column: method === 'stratified' ? column : null,
    allocation,
    truth, estimates,
    ...summarizeEstimates(estimates, truth),
  };
}

export const BASELINE_SIZES = [1, 10, 100, 640];

export function runBaselineExperiments(rows, { seed = 2026, repetitions = 1000, column = 'visit_type' } = {}, onProgress) {
  validateSeed(seed);
  if (!Number.isInteger(repetitions) || repetitions < 1000 || repetitions > 10000) throw new RangeError('Choose 1,000–10,000 Monte Carlo repetitions.');
  BASELINE_SIZES.forEach(n => validateSize(rows.length, n));
  const tasks = [
    { method: 'simple', n: 100 },
    { method: 'systematic', n: 100 },
    { method: 'stratified', n: 100 },
    { method: 'simple', n: 1 },
    { method: 'simple', n: 10 },
    { method: 'simple', n: 640 },
  ];
  const results = tasks.map((task, index) => {
    onProgress?.({ completed: index, total: tasks.length, method: task.method, n: task.n });
    const result = repeatSampling(rows, { ...task, seed, repetitions, column });
    onProgress?.({ completed: index + 1, total: tasks.length, method: task.method, n: task.n });
    return result;
  });
  return {
    settings: { seed, repetitions, column, N: rows.length, condition: 'Baseline · Original CSV' },
    methods: results.slice(0, 3),
    sizes: [results[3], results[4], results[0], results[5]],
  };
}

// Probability per shared bin makes exact and Monte Carlo results comparable
// when their number of starts/repetitions differs.
export function comparisonHistograms(results, binCount = 20, axisRange = null) {
  if (!results.length || !Number.isInteger(binCount) || binCount < 2 || binCount > 100) throw new RangeError('Invalid histogram configuration.');
  const first = results[0];
  let minimum = Infinity, maximum = -Infinity;
  for (const result of results) {
    if (result.condition !== first.condition || result.N !== first.N || result.truth !== first.truth) throw new RangeError('Do not pool populations or conditions in a comparison.');
    for (const value of [...result.estimates, result.truth, result.estimateMean]) {
      if (!Number.isFinite(value)) throw new RangeError('Histogram values must be finite.');
      minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
    }
    if (!result.estimates.length || result.runs !== result.estimates.length) throw new RangeError('Estimate count must match the run label.');
  }
  const padding = maximum === minimum ? Math.max(1, Math.abs(minimum) * 0.05) : (maximum - minimum) * 0.07;
  const xMin = axisRange?.xMin ?? minimum - padding, xMax = axisRange?.xMax ?? maximum + padding;
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMin >= xMax || xMin > minimum || xMax < maximum) throw new RangeError('Histogram axes must include every estimate and reference.');
  const width = (xMax - xMin) / binCount;
  const series = results.map(result => {
    const bins = Array.from({ length: binCount }, (_, i) => ({ lower: xMin + i * width, upper: xMin + (i + 1) * width, count: 0 }));
    result.estimates.forEach(value => {
      const index = Math.max(0, Math.min(binCount - 1, Math.floor((value - xMin) / width)));
      bins[index].count += 1;
    });
    bins.forEach(bin => { bin.probability = bin.count / result.runs; });
    return bins;
  });
  const yMax = Math.min(1, Math.max(...series.flatMap(bins => bins.map(bin => bin.probability))) * 1.12);
  return { xMin, xMax, yMax, series };
}

export function experimentCsv(resultSet) {
  const names = { simple: 'Simple random', systematic: 'Systematic', stratified: 'Stratified' };
  const headers = ['Experiment', 'Population', 'Method', 'n', 'N', 'Type', 'Seed', 'Repetitions or starts', 'Stratification column', 'Allocation and population weights', 'True mean (min)', 'Mean estimate (min)', 'Bias (min)', 'SD of estimates (min)', 'RMSE (min)'];
  const records = (resultSet.modified ? [
    ...resultSet.methods.map(result => [result.condition, result]),
    ...resultSet.modified.map(result => [result.condition, result]),
  ] : [
    ...resultSet.methods.map(result => [result === resultSet.sizes[2] ? 'Methods at n = 100; also SRS n = 100' : 'Methods at n = 100', result]),
    ...resultSet.sizes.filter(result => !resultSet.methods.includes(result)).map(result => ['SRS sample sizes', result]),
  ]).map(([experiment, result]) => [
    experiment, result.condition, names[result.method], result.n, result.N, result.type,
    result.type === 'Exact' ? 'Exact; no seed' : result.seed, result.runs, result.column ?? '',
    result.allocation ? result.allocation.map(group => group.key + ': nh=' + group.allocation + ', Nh=' + group.populationSize + ', weight=' + group.weight).join('; ') : '',
    result.truth, result.estimateMean, result.bias, result.sd, result.rmse,
  ]);
  const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
  return [headers, ...records].map(record => record.map(quote).join(',')).join('\r\n') + '\r\n';
}

export function periodicReordering(rows, bands = 100) {
  if (!Number.isInteger(bands) || bands < 1 || rows.length === 0 || rows.length % bands !== 0) throw new RangeError('The band count must divide the population size.');
  const sorted = rows.map((row, index) => ({ row, index })).sort((a, b) => a.row.wait_time - b.row.wait_time || a.index - b.index);
  const bandSize = rows.length / bands;
  const reordered = [];
  for (let offset = 0; offset < bandSize; offset += 1) {
    for (let band = 0; band < bands; band += 1) reordered.push(sorted[band * bandSize + offset].row);
  }
  return reordered;
}

export function runChallengeExperiments(rows, { seed = 2026, repetitions = 1000, column = 'visit_type', periodicEnabled = true } = {}, onProgress) {
  validateSeed(seed);
  validateSize(rows.length, 100);
  if (!Number.isInteger(repetitions) || repetitions < 1000 || repetitions > 10000) throw new RangeError('Choose 1,000–10,000 Monte Carlo repetitions.');
  if (typeof periodicEnabled !== 'boolean') throw new RangeError('The ordering control must be explicitly enabled or disabled.');
  const conditions = [
    { name: 'Baseline · Original CSV', population: rows },
    { name: periodicEnabled ? 'Modified · Periodic order (' + rows.length / 100 + ' bands)' : 'Control · Original order', population: periodicEnabled ? periodicReordering(rows, rows.length / 100) : [...rows] },
  ];
  const all = [];
  for (const condition of conditions) {
    const results = METHODS.map(method => {
      onProgress?.({ completed: all.length, total: 6, method, n: 100, condition: condition.name });
      const result = repeatSampling(condition.population, { method, n: 100, seed, repetitions, column, condition: condition.name });
      all.push(result);
      onProgress?.({ completed: all.length, total: 6, method, n: 100, condition: condition.name });
      return result;
    });
    condition.results = results;
  }
  return {
    settings: { seed, repetitions, column, periodicEnabled, n: 100, N: rows.length },
    methods: conditions[0].results,
    modified: conditions[1].results,
    sizes: [],
  };
}

// Conditions retain separate distributions and summaries. Only the visual
// axes are synchronized; results are never pooled or averaged together.
export function conditionHistograms(groups, binCount = 20) {
  if (!groups.length) throw new RangeError('At least one condition is required.');
  const preliminary = groups.map(group => comparisonHistograms(group, binCount));
  const range = { xMin: Math.min(...preliminary.map(chart => chart.xMin)), xMax: Math.max(...preliminary.map(chart => chart.xMax)) };
  const charts = groups.map(group => comparisonHistograms(group, binCount, range));
  const yMax = Math.max(...charts.map(chart => chart.yMax));
  return charts.map(chart => ({ ...chart, yMax }));
}
