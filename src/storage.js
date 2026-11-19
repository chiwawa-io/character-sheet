// Persistence: localStorage plus JSON export/import. No UI in here.
const KEY = 'character-sheet:v1';
export const SCHEMA_VERSION = 1;

const uid = () => Math.random().toString(36).slice(2, 10);
export { uid };

export function defaultSettings() {
  return {
    currency: 'XP',
    levelBase: 100,
    levelGrowth: 1.25,
    freezeEnabled: true,
    freezePerWeek: 1,
    calendarDays: 60,
  };
}

export function seedState() {
  const craft = uid(), body = uid(), mind = uid();
  const r = (valueId, text, xp = 10, streak = false) => ({ id: uid(), valueId, text, xp, streak, archived: false });
  const ms = [1, 3, 7, 14, 30, 60, 100].map((days) => ({
    id: uid(), days, rewardId: null, claimedAt: null, snapshot: null,
  }));
  return {
    version: SCHEMA_VERSION,
    settings: defaultSettings(),
    goal: { text: 'Simple freedom', minAction: '15 minutes on the main goal' },
    values: [
      { id: craft, name: 'Craft', icon: 'pen-tool', color: '#e0a43a', archived: false },
      { id: body, name: 'Body', icon: 'dumbbell', color: '#5fae8a', archived: false },
      { id: mind, name: 'Mind', icon: 'brain', color: '#5b8fd6', archived: false },
    ],
    rules: [
      r(craft, 'I did 15 minutes on my main goal', 10, true),
      r(craft, 'I shipped something small', 20),
      r(body, 'I moved for 20 minutes', 10),
      r(body, 'I went to bed on time', 10),
      r(mind, 'I read 10 pages', 10),
      r(mind, 'I wrote down three thoughts', 10),
    ],
    completions: [],
    rewards: [
      { id: uid(), title: 'A coffee somewhere nice', rating: 1, description: '', link: '' },
      { id: uid(), title: 'An evening off with a good film', rating: 2, description: '', link: '' },
      { id: uid(), title: 'A new book', rating: 3, description: '', link: '' },
      { id: uid(), title: 'A day trip', rating: 4, description: '', link: '' },
      { id: uid(), title: 'The thing I keep postponing buying', rating: 5, description: '', link: '' },
    ],
    milestones: ms,
  };
}

/** Fill gaps and coerce an unknown object into a valid state. Throws on nonsense. */
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a character sheet file');
  for (const k of ['values', 'rules', 'completions', 'rewards', 'milestones']) {
    if (raw[k] !== undefined && !Array.isArray(raw[k])) throw new Error(`"${k}" must be a list`);
  }
  return {
    version: SCHEMA_VERSION,
    settings: { ...defaultSettings(), ...(raw.settings || {}) },
    goal: { text: '', minAction: '', ...(raw.goal || {}) },
    values: raw.values || [],
    rules: raw.rules || [],
    completions: raw.completions || [],
    rewards: raw.rewards || [],
    milestones: raw.milestones || [],
  };
}

export function load() {
  try {
    const text = localStorage.getItem(KEY);
    if (text) return normalize(JSON.parse(text));
  } catch (e) {
    console.warn('Could not read saved data', e);
  }
  return null;
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save', e);
  }
}

export function exportJson(state) {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function parseImport(text) {
  return normalize(JSON.parse(text));
}
