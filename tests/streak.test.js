import { describe, it, expect } from 'vitest';
import { computeStreak, dayPercent } from '../src/streak.js';
import { addDays, weekStart } from '../src/dates.js';
import { levelInfo } from '../src/levels.js';

const T = '2026-11-19'; // Thursday
const days = (...offsets) => offsets.map((o) => addDays(T, o));

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    const r = computeStreak(days(-2, -1, 0), T);
    expect(r.current).toBe(3);
    expect(r.best).toBe(3);
  });

  it('does not break when today is still pending', () => {
    const r = computeStreak(days(-3, -2, -1), T);
    expect(r.current).toBe(3);
    expect(r.days[T]).toBe('pending');
  });

  it('resets on a miss when freezes are off', () => {
    const r = computeStreak(days(-4, -3, -1), T, { freezeEnabled: false });
    expect(r.current).toBe(1);
    expect(r.best).toBe(2);
    expect(r.days[addDays(T, -2)]).toBe('missed');
  });

  it('a freeze bridges one skipped day without adding to the streak', () => {
    const r = computeStreak(days(-3, -2, 0), T); // skip -1 (Wednesday)
    expect(r.days[addDays(T, -1)]).toBe('frozen');
    expect(r.current).toBe(3);
  });

  it('allows only the configured number of freezes per week', () => {
    // Mon..Sun week of 2026-11-16: done Mon, skip Tue + Wed, done Thu.
    const done = ['2026-11-16', '2026-11-19'];
    const one = computeStreak(done, T, { freezeEnabled: true, freezePerWeek: 1 });
    expect(one.days['2026-11-17']).toBe('frozen');
    expect(one.days['2026-11-18']).toBe('missed');
    expect(one.current).toBe(1);
    const two = computeStreak(done, T, { freezeEnabled: true, freezePerWeek: 2 });
    expect(two.current).toBe(2);
  });

  it('freezes reset every Monday', () => {
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // Sunday belongs to the Monday before
    // skip Sun (week A) and Mon (week B): both frozen, one per week
    const r = computeStreak(['2026-11-21', '2026-11-24'], '2026-11-24');
    expect(r.days['2026-11-22']).toBe('frozen');
    expect(r.days['2026-11-23']).toBe('frozen');
    expect(r.current).toBe(2);
  });

  it('never freezes before a streak exists', () => {
    const r = computeStreak(days(0), T);
    expect(r.current).toBe(1);
  });

  it('reports freezes left this week', () => {
    expect(computeStreak(days(-3, -2, 0), T).freezeLeft).toBe(0);
    expect(computeStreak(days(-1, 0), T).freezeLeft).toBe(1);
    expect(computeStreak(days(-1, 0), T, { freezeEnabled: false }).freezeLeft).toBe(0);
  });

  it('keeps the best streak after a reset', () => {
    const r = computeStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-19'], T, { freezeEnabled: false });
    expect(r.best).toBe(3);
    expect(r.current).toBe(1);
  });

  it('handles no history', () => {
    expect(computeStreak([], T)).toMatchObject({ current: 0, best: 0 });
  });
});

describe('day percent', () => {
  const c = (ruleId) => ({ date: T, ruleId });
  it('is the share of rules done', () => {
    expect(dayPercent(T, [c('a'), c('b')], 4)).toBe(0.5);
  });
  it('is capped at 100% when rules were archived since', () => {
    expect(dayPercent(T, [c('a'), c('b'), c('c')], 2)).toBe(1);
  });
  it('is 0 with no completions', () => {
    expect(dayPercent(T, [], 4)).toBe(0);
  });
});

describe('levels', () => {
  const s = { levelBase: 100, levelGrowth: 1.5 };
  it('uses the configured formula', () => {
    expect(levelInfo(0, s)).toMatchObject({ level: 1, need: 100 });
    expect(levelInfo(100, s)).toMatchObject({ level: 2, into: 0, need: 150 });
    expect(levelInfo(260, s)).toMatchObject({ level: 3, into: 10 });
  });
});
