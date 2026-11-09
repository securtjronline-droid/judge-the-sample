const COLUMNS = ['visit_id', 'week', 'weekday', 'slot', 'visit_type', 'wait_time'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Parse CSV without rearranging records or treating an empty target as zero.
export function parseCsv(text) {
  if (typeof text !== 'string') throw new TypeError('CSV input must be text.');
  const records = [];
  let record = [], field = '', quoted = false, afterQuote = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') { quoted = false; afterQuote = true; }
      else field += ch;
    } else if (ch === '"' && field === '' && !afterQuote) quoted = true;
    else if (ch === ',') { record.push(field); field = ''; afterQuote = false; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = []; field = ''; afterQuote = false;
    } else {
      if (afterQuote || ch === '"') throw new Error('Malformed quoted CSV field.');
      field += ch;
    }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  if (field !== '' || record.length > 0 || afterQuote) { record.push(field); records.push(record); }
  return records;
}

export function parseClinicCsv(text) {
  const records = parseCsv(text);
  if (records.length < 2 || records[0].join(',') !== COLUMNS.join(',')) {
    throw new Error('Expected the six original clinic appointment columns.');
  }
  return records.slice(1).map((fields, index) => {
    if (fields.length !== COLUMNS.length) throw new Error('Wrong field count at CSV row ' + (index + 2));
    const row = Object.fromEntries(COLUMNS.map((name, i) => [name, fields[i]]));
    for (const name of ['visit_id', 'week', 'slot', 'wait_time']) {
      if (!/^\d+$/.test(row[name])) throw new Error('Missing or invalid ' + name + ' at appointment ' + (index + 1));
      row[name] = Number(row[name]);
      if (!Number.isSafeInteger(row[name])) throw new Error('Invalid integer in ' + name);
    }
    if (row.visit_id !== index + 1) throw new Error('The original appointment row order must be preserved.');
    if (row.week < 1 || row.slot < 1 || row.slot > 20 || !DAYS.includes(row.weekday)) {
      throw new Error('Invalid chronological appointment fields.');
    }
    if (!['Follow-up', 'New', 'Same-day'].includes(row.visit_type)) throw new Error('Unknown appointment type.');
    return Object.freeze(row);
  });
}
