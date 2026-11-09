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
  if (!Number.isInteger(N) || N < 1 || N > 0xFFFFFFFF) throw new RangeError('Invalid population size.');
  if (!Number.isInteger(n) || n < 1 || n > N) throw new RangeError('Sample size must be a whole number between 1 and N.');
  const random = createSeededRandom(seed);
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
