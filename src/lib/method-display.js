export const METHOD_DISPLAY = {
  simple: { name: 'Simple random sampling', short: 'Simple random', color: '#2563EB', ink: '#FFFFFF', tint: '#EDF3FF', steps: ['Frame the population', 'Draw without replacement', 'Calculate the estimate'] },
  systematic: { name: 'Systematic sampling', short: 'Systematic', color: '#06B6D4', ink: '#083344', tint: '#E6F9FD', steps: ['Calculate the interval', 'Choose the random start', 'Follow the selection pattern'] },
  stratified: { name: 'Stratified sampling', short: 'Stratified', color: '#8B5CF6', ink: '#190B36', tint: '#F2EDFF', steps: ['Identify the groups', 'Allocate the sample', 'Weight the stratum means'] },
};

const STRATUM_DISPLAY = [
  { fill: '#8B5CF6', ink: '#190B36', tint: '#EEE7FD' },
  { fill: '#5B21B6', ink: '#FFFFFF', tint: '#E4D9F7' },
  { fill: '#C4B5FD', ink: '#241241', tint: '#F5F0FF' },
];
export function stratumDisplay(index) {
  return { ...STRATUM_DISPLAY[index % STRATUM_DISPLAY.length], pattern: index % 3 };
}
