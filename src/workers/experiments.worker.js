import { runBaselineExperiments } from '../lib/sampling.js';

export function processExperimentRequest(request, notify) {
  const { jobId, rows, settings } = request;
  try {
    const result = runBaselineExperiments(rows, settings, progress => notify({ kind: 'progress', jobId, progress }));
    notify({ kind: 'result', jobId, result });
  } catch (error) {
    notify({ kind: 'error', jobId, message: error.message });
  }
}

if (typeof self !== 'undefined') {
  self.onmessage = event => processExperimentRequest(event.data, message => self.postMessage(message));
}
