// Single mutable store. Every change goes through commit(), which saves and notifies.
import { load, save, seedState, uid, parseImport, normalize } from './storage.js';
import { toKey } from './dates.js';
import { levelInfo } from './levels.js';
import { computeStreak, streakDays, dayPercent } from './streak.js';
import { distribute } from './rewards.js';

let state = load() || seedState();
if (!state.milestones.some((m) => m.rewardId) && state.rewards.length) {
  state.milestones = distribute(state.milestones, state.rewards, { keep: true });
}
save(state);
const listeners = new Set();

export const getState = () => state;
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

// Local edits bump updatedAt (last write wins when syncing) and tell the sync layer.
const localListeners = new Set();
export const onLocalChange = (fn) => (localListeners.add(fn), () => localListeners.delete(fn));

export function commit(fn) {
  const out = fn(state);
  state.updatedAt = Date.now();
  save(state);
  listeners.forEach((l) => l());
  localListeners.forEach((l) => l());
  return out;
}

export function replaceState(text) {
  state = parseImport(text);
  state.updatedAt = Date.now();
  save(state);
  listeners.forEach((l) => l());
  localListeners.forEach((l) => l());
}

/** Adopt data that came from the cloud: no bump, no push back. */
export function applyRemote(obj) {
  state = normalize(obj);
  save(state);
  listeners.forEach((l) => l());
}

// ---------- selectors ----------
export const today = () => toKey();
export const activeValues = () => state.values.filter((v) => !v.archived);
export const activeRules = () => state.rules.filter((r) => !r.archived && state.values.find((v) => v.id === r.valueId && !v.archived));
export const totalXp = () => state.completions.reduce((s, c) => s + c.xp, 0);
export const valueXp = (id) => state.completions.filter((c) => c.valueId === id).reduce((s, c) => s + c.xp, 0);
export const characterLevel = () => levelInfo(totalXp(), state.settings);
export const valueLevel = (id) => levelInfo(valueXp(id), state.settings);
export const doneOn = (date) => new Set(state.completions.filter((c) => c.date === date).map((c) => c.ruleId));
export const dayPct = (date) => dayPercent(date, state.completions, activeRules().length);
export const streakInfo = () => computeStreak(streakDays(state.completions), today(), state.settings);
export const rewardOf = (m) => state.rewards.find((r) => r.id === m.rewardId) || null;

/** Milestones reached (by best streak) but not claimed yet, with a reward in them. */
export function pendingReveals() {
  const { best } = streakInfo();
  return state.milestones
    .filter((m) => !m.claimedAt && m.days <= best && rewardOf(m))
    .sort((a, b) => a.days - b.days);
}

export function nextMilestone() {
  const { current } = streakInfo();
  return [...state.milestones].sort((a, b) => a.days - b.days).find((m) => m.days > current) || null;
}

// ---------- actions ----------
/** Tick or untick a rule on a date. Returns what changed so the UI can celebrate. */
export function toggleRule(ruleId, date) {
  return commit((s) => {
    const idx = s.completions.findIndex((c) => c.ruleId === ruleId && c.date === date);
    if (idx >= 0) {
      const [gone] = s.completions.splice(idx, 1);
      return { added: false, xp: gone.xp, valueId: gone.valueId };
    }
    const rule = s.rules.find((r) => r.id === ruleId);
    const value = s.values.find((v) => v.id === rule.valueId);
    const before = { all: levelInfo(totalXp(), s.settings).level, val: levelInfo(valueXp(value.id), s.settings).level };
    // Snapshot: later edits to the rule or value never rewrite history.
    s.completions.push({
      id: uid(), date, ruleId, valueId: value.id, xp: rule.xp, streak: !!rule.streak,
      ruleText: rule.text, valueName: value.name, ts: Date.now(),
    });
    const after = { all: levelInfo(totalXp(), s.settings).level, val: levelInfo(valueXp(value.id), s.settings).level };
    return {
      added: true, xp: rule.xp, valueId: value.id, valueName: value.name,
      levelUp: after.val > before.val ? { name: value.name, level: after.val }
        : after.all > before.all ? { name: 'Character', level: after.all } : null,
    };
  });
}

const swap = (list, id, dir) => {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
};

export const addValue = (v) => commit((s) => { s.values.push({ id: uid(), archived: false, ...v }); });
export const updateValue = (id, patch) => commit((s) => Object.assign(s.values.find((v) => v.id === id), patch));
export const moveValue = (id, dir) => commit((s) => swap(s.values, id, dir));
export const deleteValue = (id) => commit((s) => {
  s.values = s.values.filter((v) => v.id !== id);
  s.rules = s.rules.filter((r) => r.valueId !== id);
});

export const addRule = (r) => commit((s) => { s.rules.push({ id: uid(), archived: false, streak: false, xp: 10, ...r }); });
export const updateRule = (id, patch) => commit((s) => Object.assign(s.rules.find((r) => r.id === id), patch));
export const deleteRule = (id) => commit((s) => { s.rules = s.rules.filter((r) => r.id !== id); });
export const moveRule = (id, dir) => commit((s) => {
  // Swap only among rules of the same value, keeping other values' order intact.
  const rule = s.rules.find((r) => r.id === id);
  const peers = s.rules.filter((r) => r.valueId === rule.valueId);
  const i = peers.indexOf(rule);
  const other = peers[i + dir];
  if (!other) return;
  const a = s.rules.indexOf(rule), b = s.rules.indexOf(other);
  [s.rules[a], s.rules[b]] = [s.rules[b], s.rules[a]];
});

export const setSettings = (patch) => commit((s) => Object.assign(s.settings, patch));
export const setGoal = (patch) => commit((s) => Object.assign(s.goal, patch));

const refill = (s) => { s.milestones = distribute(s.milestones, s.rewards, { keep: true }); };
export const addReward = (r) => commit((s) => { s.rewards.push({ id: uid(), description: '', link: '', ...r }); refill(s); });
export const updateReward = (id, patch) => commit((s) => {
  const r = s.rewards.find((x) => x.id === id);
  if (r.claimedAt) return; // claimed rewards are frozen
  Object.assign(r, patch);
  refill(s);
});
export const deleteReward = (id) => commit((s) => {
  const r = s.rewards.find((x) => x.id === id);
  if (r && r.claimedAt) return;
  s.rewards = s.rewards.filter((x) => x.id !== id);
  refill(s);
});
export const addMilestone = (days) => commit((s) => { s.milestones.push({ id: uid(), days, rewardId: null, claimedAt: null, snapshot: null }); refill(s); });
export const updateMilestone = (id, days) => commit((s) => {
  const m = s.milestones.find((x) => x.id === id);
  if (!m.claimedAt) m.days = days;
  refill(s);
});
export const deleteMilestone = (id) => commit((s) => {
  const m = s.milestones.find((x) => x.id === id);
  if (m && m.claimedAt) return;
  s.milestones = s.milestones.filter((x) => x.id !== id);
});
export const redistribute = () => commit((s) => { s.milestones = distribute(s.milestones, s.rewards); });

export function claimMilestone(id) {
  return commit((s) => {
    const m = s.milestones.find((x) => x.id === id);
    const r = s.rewards.find((x) => x.id === m.rewardId);
    if (!m || !r || m.claimedAt) return null;
    const date = toKey();
    m.claimedAt = date;
    m.snapshot = { title: r.title, rating: r.rating, description: r.description, link: r.link };
    r.claimedAt = date;
    return m.snapshot;
  });
}

/** Claimed rewards come from milestone snapshots, so deleting/editing a reward never changes them. */
export function collection() {
  const claimed = state.milestones.filter((m) => m.claimedAt)
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
    .map((m) => ({ ...m.snapshot, claimedAt: m.claimedAt, days: m.days }));
  const locked = state.rewards.filter((r) => !r.claimedAt).sort((a, b) => b.rating - a.rating);
  return { claimed, locked };
}
