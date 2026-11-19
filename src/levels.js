// XP needed to climb from level n to n+1: round(base * growth^(n-1)).
export function xpForLevel(level, { levelBase = 100, levelGrowth = 1.25 } = {}) {
  return Math.max(1, Math.round(levelBase * Math.pow(levelGrowth, level - 1)));
}

/** Level, progress inside the level and what is needed for the next, from total XP. */
export function levelInfo(totalXp, settings = {}) {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  let need = xpForLevel(level, settings);
  while (rest >= need && level < 999) {
    rest -= need;
    level += 1;
    need = xpForLevel(level, settings);
  }
  return { level, into: rest, need, pct: rest / need };
}
