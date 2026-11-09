import { readFile } from 'node:fs/promises';
import { parseClinicCsv } from '../src/lib/population.js';

const rows = parseClinicCsv(await readFile(new URL('../data/clinic_visits.csv', import.meta.url), 'utf8'));
console.log('Clinic population loaded: ' + rows.length.toLocaleString('en-US') + ' appointments.');
console.log('Columns: ' + Object.keys(rows[0]).join(', '));
console.log('Original CSV row order preserved; target: wait_time (minutes).');
