const clamp = (n) => Math.min(5, Math.max(1, n));

/** Rating a milestone wants, from its position among all milestones (low days -> 1, high -> 5). */
export function targetRating(index, count) {
  if (count <= 1) return 3;
  return clamp(Math.round(1 + (4 * index) / (count - 1)));
}

/**
 * Assign rewards to milestones. Pure: returns a new milestones array.
 *
 * - Claimed milestones never change, and their rewards (plus any reward with
 *   `claimedAt`) are removed from the pool.
 * - Each unclaimed milestone gets a random reward with exactly its target rating,
 *   or null when none is left (the UI then shows an "add a reward" hint).
 * - keep=true leaves valid existing assignments alone and only fills empty slots.
 */
export function distribute(milestones, rewards, { rng = Math.random, keep = false } = {}) {
  const sorted = [...milestones].sort((a, b) => a.days - b.days);
  const rating = new Map(sorted.map((m, i) => [m.id, targetRating(i, sorted.length)]));
  const byId = new Map(rewards.map((r) => [r.id, r]));
  const taken = new Set();

  for (const m of milestones) if (m.claimedAt && m.rewardId) taken.add(m.rewardId);
  for (const r of rewards) if (r.claimedAt) taken.add(r.id);

  const next = milestones.map((m) => ({ ...m }));
  const open = next.filter((m) => !m.claimedAt);

  if (keep) {
    for (const m of open) {
      const r = byId.get(m.rewardId);
      if (r && !taken.has(r.id)) taken.add(r.id);
      else m.rewardId = null;
    }
  } else {
    for (const m of open) m.rewardId = null;
  }

  // Biggest milestones pick first so rare rewards are not stolen by small ones.
  for (const m of open.filter((x) => !x.rewardId).sort((a, b) => b.days - a.days)) {
    const pool = rewards.filter((r) => !taken.has(r.id) && r.rating === rating.get(m.id));
    if (!pool.length) continue;
    const pick = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
    m.rewardId = pick.id;
    taken.add(pick.id);
  }
  return next;
}
