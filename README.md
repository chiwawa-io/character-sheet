# Character Sheet

A personal character sheet with gamified values. Define what matters to you, write the rules that make you feel successful, tick them off each day and watch values level up. A goal streak, milestones and a gacha-style reward reveal keep it going.

Static site, no backend. Data lives in your browser (`localStorage`).

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest: streak, freezes, reward distribution, levels
npm run build    # static site in dist/
```

## How it works

- **Values and rules.** Each value has rules ("I did 15 minutes on my main goal") worth some XP. Ticking a rule on **Today** awards XP to the value and to the character instantly. Past days can be edited with the date arrows.
- **Levels.** XP needed to go from level n to n+1 is `base × growth^(n−1)`. Base, growth and the currency name (XP, HP, anything) are in **Manage → Settings**.
- **Streak.** A day counts when a rule flagged as a streak rule is done. An optional soft freeze lets you skip N days per week (weeks start Monday) without resetting. Today never breaks a streak while it is still open. The calendar shows 30, 60 or 90 days, shaded by the share of rules completed.
- **Milestones and rewards.** Milestones sit at streak thresholds (default 1, 3, 7, 14, 30, 60, 100). Rewards have a rating from 1 (trifle) to 5 (big prize). Higher thresholds get higher ratings, ties are drawn at random, and a milestone with no matching reward stays empty with an "add a reward" hint. **Redistribute** redraws everything except claimed rewards. A reached milestone opens with a reveal and a Claim button.
- **Editing is safe.** Every completion stores a snapshot of the XP, rule text and value name at the time. Editing or deleting rules and values never rewrites history or totals. Claimed rewards are snapshots too.

## Data and backup

Everything is one JSON document under the `character-sheet:v1` key in `localStorage`.

```
settings      currency, levelBase, levelGrowth, freezeEnabled, freezePerWeek, calendarDays
goal          { text, minAction }
values        [{ id, name, icon, color, archived }]            order = array order
rules         [{ id, valueId, text, xp, streak, archived }]
completions   [{ id, date, ruleId, valueId, xp, streak, ruleText, valueName, ts }]
rewards       [{ id, title, rating 1-5, description, link, claimedAt }]
milestones    [{ id, days, rewardId, claimedAt, snapshot }]
```

**Back up:** Manage → Data → *Export to JSON* downloads a file. **Restore or move to another device:** *Import from JSON* on the other browser (it replaces what is there). Clearing site data deletes your progress, so export now and then.

## Code layout

| File | Role |
| --- | --- |
| `src/storage.js` | localStorage, seed data, JSON export/import validation |
| `src/state.js` | the store, selectors and every action |
| `src/streak.js` | streak, freeze and daily percentage logic (pure) |
| `src/rewards.js` | reward distribution (pure, injectable RNG) |
| `src/levels.js` | level formula |
| `src/ui.js`, `src/forms.js`, `src/fx.js` | screens, dialogs, XP popups and the reveal |

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml` (tests, build, GitHub Pages). In the repo settings, Pages → Source must be *GitHub Actions*.
