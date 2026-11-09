import { runBaselineExperiments, runChallengeExperiments } from '../lib/sampling.js';

export function processExperimentRequest(request, notify) {
  const { jobId, rows, settings } = request;
  try {
    if (request.mode !== undefined && !['baseline', 'challenge'].includes(request.mode)) throw new RangeError('Unknown experiment mode.');
    const run = request.mode === 'challenge' ? runChallengeExperiments : runBaselineExperiments;
    const result = run(rows, settings, progress => notify({ kind: 'progress', jobId, progress }));
    notify({ kind: 'result', jobId, result });
  } catch (error) {
    notify({ kind: 'error', jobId, message: error.message });
  }
}

if (typeof self !== 'undefined') {
  self.onmessage = event => processExperimentRequest(event.data, message => self.postMessage(message));
}
