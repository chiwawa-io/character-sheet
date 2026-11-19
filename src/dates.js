// Date helpers. Days are plain "YYYY-MM-DD" strings in local time; math runs in UTC to dodge DST.
const pad = (n) => String(n).padStart(2, '0');

export function toKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parse(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(key, n) {
  const t = new Date(parse(key) + n * 86400000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function diffDays(a, b) {
  return Math.round((parse(a) - parse(b)) / 86400000);
}

/** Monday of the week containing `key`. */
export function weekStart(key) {
  const dow = new Date(parse(key)).getUTCDay(); // 0 = Sunday
  return addDays(key, -((dow + 6) % 7));
}

export function formatLong(key) {
  return new Date(parse(key)).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

export function formatShort(key) {
  return new Date(parse(key)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}
