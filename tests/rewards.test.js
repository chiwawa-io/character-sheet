import { describe, it, expect } from 'vitest';
import { distribute, targetRating } from '../src/rewards.js';

const ms = (...days) => days.map((d) => ({ id: `m${d}`, days: d, rewardId: null, claimedAt: null }));
const rw = (id, rating, extra = {}) => ({ id, rating, title: id, ...extra });
const first = () => 0;

describe('targetRating', () => {
  it('spreads ratings from 1 to 5', () => {
    const r = [0, 1, 2, 3, 4, 5, 6].map((i) => targetRating(i, 7));
    expect(r[0]).toBe(1);
    expect(r[6]).toBe(5);
    expect([...r].sort()).toEqual(r);
  });
});

describe('distribute', () => {
  const rewards = [rw('a', 1), rw('b', 3), rw('c', 5)];

  it('gives higher thresholds higher ratings', () => {
    const out = distribute(ms(1, 7, 100), rewards, { rng: first });
    expect(out.map((m) => m.rewardId)).toEqual(['a', 'b', 'c']);
  });

  it('leaves milestones empty when no reward matches', () => {
    const out = distribute(ms(1, 3, 7, 14, 30, 60, 100), rewards, { rng: first });
    expect(out.filter((m) => m.rewardId)).toHaveLength(3);
    expect(out.find((m) => m.days === 100).rewardId).toBe('c');
    expect(out.find((m) => m.days === 60).rewardId).toBe(null);
  });

  it('picks randomly among equal ratings, never reusing a reward', () => {
    const pool = [rw('x', 1), rw('y', 1), rw('z', 1)];
    const lo = distribute(ms(1, 100), pool, { rng: () => 0 });
    const hi = distribute(ms(1, 100), pool, { rng: () => 0.99 });
    expect(lo.find((m) => m.days === 1).rewardId).toBe('x');
    expect(hi.find((m) => m.days === 1).rewardId).toBe('z');
    const ids = distribute(ms(1, 2, 3), [rw('x', 1), rw('y', 1)], { rng: Math.random })
      .map((m) => m.rewardId).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never changes claimed milestones or reuses their rewards', () => {
    const list = ms(1, 100);
    list[0] = { ...list[0], rewardId: 'a', claimedAt: '2026-11-01' };
    const out = distribute(list, [rw('a', 1), rw('a2', 1), rw('c', 5)], { rng: first });
    expect(out[0]).toEqual(list[0]);
    expect(out[1].rewardId).toBe('c');
    const out2 = distribute(ms(1, 100), [rw('a', 1, { claimedAt: '2026-11-01' }), rw('c', 5)], { rng: first });
    expect(out2[0].rewardId).toBe(null);
  });

  it('keep=true preserves valid assignments and fills empties', () => {
    const list = ms(1, 100);
    list[0].rewardId = 'a';
    const out = distribute(list, [rw('a', 1), rw('a2', 1), rw('c', 5)], { rng: () => 0.99, keep: true });
    expect(out[0].rewardId).toBe('a');
    expect(out[1].rewardId).toBe('c');
  });

  it('drops assignments to deleted rewards when keep=true', () => {
    const list = ms(1);
    list[0].rewardId = 'gone';
    expect(distribute(list, [], { keep: true })[0].rewardId).toBe(null);
  });

  it('does not mutate its input', () => {
    const list = ms(1, 7);
    const copy = JSON.stringify(list);
    distribute(list, rewards, { rng: first });
    expect(JSON.stringify(list)).toBe(copy);
  });
});
