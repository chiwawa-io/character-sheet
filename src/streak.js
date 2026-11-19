import { addDays, weekStart } from './dates.js';

/**
 * Compute streaks from the set of days on which a streak rule was done.
 *
 * - A missed day resets the streak, unless a freeze is available that week
 *   (weeks start on Monday, `freezePerWeek` freezes each). A frozen day keeps
 *   the streak alive without adding to it.
 * - Today is "pending" while undone: it never breaks the streak or burns a freeze.
 *
 * Returns { current, best, days, freezeLeft } where days maps date ->
 * 'done' | 'frozen' | 'missed' | 'pending'.
 */
export function computeStreak(doneDates, today, opts = {}) {
  const { freezeEnabled = true, freezePerWeek = 1 } = opts;
  const done = new Set([...doneDates].filter((d) => d <= today));
  const days = {};
  const used = {};
  let current = 0;
  let best = 0;

  if (done.size) {
    const first = [...done].sort()[0];
    for (let d = first; d <= today; d = addDays(d, 1)) {
      if (done.has(d)) {
        current += 1;
        best = Math.max(best, current);
        days[d] = 'done';
      } else if (d === today) {
        days[d] = 'pending';
      } else {
        const wk = weekStart(d);
        if (freezeEnabled && current > 0 && (used[wk] || 0) < freezePerWeek) {
          used[wk] = (used[wk] || 0) + 1;
          days[d] = 'frozen';
        } else {
          current = 0;
          days[d] = 'missed';
        }
      }
    }
  }

  const freezeLeft = freezeEnabled
    ? Math.max(0, freezePerWeek - (used[weekStart(today)] || 0))
    : 0;
  return { current, best, days, freezeLeft };
}

/** Share of rules completed on a day, 0..1. Uses distinct rules. */
export function dayPercent(date, completions, activeRuleCount) {
  const ids = new Set(completions.filter((c) => c.date === date).map((c) => c.ruleId));
  if (!ids.size) return 0;
  return Math.min(1, ids.size / Math.max(activeRuleCount, ids.size));
}

/** Days (history snapshot) on which at least one streak rule was completed. */
export function streakDays(completions) {
  return new Set(completions.filter((c) => c.streak).map((c) => c.date));
}
