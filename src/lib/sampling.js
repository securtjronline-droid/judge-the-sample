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
  validateSize(N, n);
  const rng = createSeededRandom(seed);
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
  const groups = populationStrata(rows, column);
  const allocation = proportionalAllocation(groups.map(group => group.populationSize), n);
  const rng = createSeededRandom(seed);
  const strata = groups.map((group, i) => {
    const indices = drawRandomIndices(group.populationSize, allocation[i], rng).map(position => group.positions[position]);
    return { key: group.key, populationSize: group.populationSize, weight: group.weight, quota: n * group.populationSize / rows.length, allocation: allocation[i], indices, sampleMean: sampleMean(rows, indices) };
  });
  return { indices: strata.flatMap(group => group.indices), strata, estimate: populationWeightedMean(strata), weightSum: strata.reduce((sum, group) => sum + group.weight, 0), column };
}

export function drawSample(rows, { method = 'simple', n = 100, seed = 2026, column = 'visit_type' } = {}) {
  validateSize(rows.length, n);
  validateSeed(seed);
  let selection;
  if (method === 'simple') selection = { indices: simpleRandomIndices(rows.length, n, seed) };
  else if (method === 'systematic') selection = systematicSelection(rows.length, n, seed);
  else if (method === 'stratified') selection = stratifiedSelection(rows, n, seed, column);
  else throw new RangeError('Unknown sampling method.');
  const truth = populationMean(rows);
  const estimate = method === 'stratified' ? selection.estimate : sampleMean(rows, selection.indices);
  return { ...selection, method, n, N: rows.length, seed, truth, estimate, error: estimate - truth };
}
