// Rendering and event handling. State comes from state.js, effects from fx.js.
import * as S from './state.js';
import { icon } from './icons.js';
import { openForm, confirmBox } from './forms.js';
import { xpPopup, toast, pips, rarityName, showReveal } from './fx.js';
import { addDays, formatLong, formatShort, toKey, weekStart } from './dates.js';
import { xpForLevel } from './levels.js';
import { targetRating } from './rewards.js';
import { exportJson } from './storage.js';
import * as Sync from './sync.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => Math.round(n).toLocaleString('en-US');
const cur = () => S.getState().settings.currency;
const ui = { date: S.today(), revealing: false };

const NAV = [
  ['today', 'Today', 'list'], ['sheet', 'Sheet', 'user'], ['streak', 'Streak', 'calendar'],
  ['rewards', 'Rewards', 'gift'], ['manage', 'Manage', 'sliders'],
];
const route = () => (location.hash.replace('#/', '') || 'today').split('?')[0];

// ---------- shared pieces ----------
const bar = (key, pct, color) =>
  `<div class="bar"><i data-bar="${key}" data-pct="${Math.min(1, pct)}" ${color ? `style="--c:${color}"` : ''}></i></div>`;
const stat = (label, value, sub = '') =>
  `<div class="stat"><span class="label">${label}</span><span class="figure">${value}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
const iconBtn = (action, id, name, label, extra = '') =>
  `<button class="icon-btn" data-action="${action}" data-id="${id}" aria-label="${label}" title="${label}" ${extra}>${icon(name, 16)}</button>`;

function levelRing(info, size = 148, label = 'Level') {
  const r = 62, c = 2 * Math.PI * r;
  return `<div class="emblem" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 148 148" aria-hidden="true"><circle cx="74" cy="74" r="${r}" class="track"/>
    <circle cx="74" cy="74" r="${r}" class="arc" data-ring="main" data-pct="${info.pct}" data-c="${c}" stroke-dasharray="${c}" transform="rotate(-90 74 74)"/></svg>
    <div class="emblem-core"><span class="label">${label}</span><span class="lvl">${info.level}</span></div></div>`;
}

// ---------- screens ----------
function viewToday() {
  const st = S.getState();
  const date = ui.date, isToday = date === S.today();
  const done = S.doneOn(date);
  const rules = S.activeRules();
  const lv = S.characterLevel();
  const sk = S.streakInfo();
  const pct = S.dayPct(date);
  const streakDone = st.completions.some((c) => c.date === date && c.streak);
  const dayXp = st.completions.filter((c) => c.date === date).reduce((s, c) => s + c.xp, 0);

  const groups = S.activeValues().map((v) => {
    const vr = rules.filter((r) => r.valueId === v.id);
    if (!vr.length) return '';
    const vl = S.valueLevel(v.id);
    return `<section class="group" style="--c:${v.color}">
      <header><span class="vicon">${icon(v.icon, 16)}</span><h3>${esc(v.name)}</h3>
        <span class="meta">Lv ${vl.level}</span><span class="spacer"></span>
        <span class="meta">${num(vl.into)} / ${num(vl.need)}</span></header>
      ${bar('v-' + v.id, vl.pct, v.color)}
      <ul class="rules">${vr.map((r) => `<li><button class="rule ${done.has(r.id) ? 'done' : ''}" data-action="toggle" data-id="${r.id}" aria-pressed="${done.has(r.id)}">
        <span class="box">${icon('check', 14)}</span>
        <span class="text">${esc(r.text)}</span>
        ${r.streak ? `<span class="tag" title="Counts toward the streak">${icon('flame', 12)}</span>` : ''}
        <span class="xp">+${r.xp}</span></button></li>`).join('')}</ul></section>`;
  }).join('');

  return `<header class="page-head">
      <div><p class="eyebrow">${isToday ? 'Today' : 'Past day'}</p><h1>${formatLong(date)}</h1></div>
      <div class="date-nav">
        ${iconBtn('day-prev', '', 'left', 'Previous day')}
        <button class="btn small" data-action="day-today" ${isToday ? 'disabled' : ''}>Today</button>
        ${iconBtn('day-next', '', 'right', 'Next day', isToday ? 'disabled' : '')}
      </div></header>
    <section class="hero-card">
      ${levelRing(lv, 112)}
      <div class="hero-body">
        <div class="row"><span class="label">Character</span><span class="meta">${num(lv.into)} / ${num(lv.need)} ${cur()}</span></div>
        ${bar('char', lv.pct)}
        <div class="stats-inline">
          ${stat('Done', `${Math.round(pct * 100)}%`, `${done.size} of ${rules.length} rules`)}
          ${stat('Earned', `+${num(dayXp)}`, cur())}
          ${stat('Streak', `${sk.current}`, streakDone || !isToday ? (streakDone ? 'counted' : 'day') : 'needs a streak rule')}
        </div>
      </div></section>
    ${st.goal.minAction ? `<p class="goal-line">${icon('target', 16)}<span>${esc(st.goal.minAction)}</span></p>` : ''}
    ${groups || `<div class="empty"><p>No rules yet. Add a value and a few rules to start earning ${cur()}.</p><a class="btn primary" href="#/manage">Open Manage</a></div>`}`;
}

function viewSheet() {
  const st = S.getState();
  const lv = S.characterLevel();
  const sk = S.streakInfo();
  const nm = S.nextMilestone();
  const nmReward = nm && S.rewardOf(nm);
  const vals = S.activeValues();
  return `<header class="page-head"><div><p class="eyebrow">Character sheet</p><h1>Level ${lv.level}</h1></div></header>
    <section class="sheet-top">
      ${levelRing(lv, 176)}
      <div class="sheet-meta">
        <div class="big-xp"><span class="figure">${num(S.totalXp())}</span><span class="label">total ${cur()}</span></div>
        <p class="sub">${num(lv.need - lv.into)} ${cur()} to level ${lv.level + 1}</p>
        ${bar('char', lv.pct)}
        ${st.goal.text ? `<p class="goal-text"><span class="label">Main goal</span>${esc(st.goal.text)}</p>` : ''}
      </div></section>
    <div class="stats">
      ${stat('Current streak', sk.current, sk.current === 1 ? 'day' : 'days')}
      ${stat('Best streak', sk.best, sk.best === 1 ? 'day' : 'days')}
      ${stat('Values', vals.length, `${S.activeRules().length} rules`)}
    </div>
    <section class="panel"><h2>Values</h2>
      ${vals.length ? `<ul class="vlist">${vals.map((v) => {
        const l = S.valueLevel(v.id);
        return `<li style="--c:${v.color}"><span class="vicon">${icon(v.icon, 16)}</span>
          <div class="vbody"><div class="row"><span class="name">${esc(v.name)}</span><span class="meta">Lv ${l.level} · ${num(S.valueXp(v.id))} ${cur()}</span></div>
          ${bar('v-' + v.id, l.pct, v.color)}</div></li>`;
      }).join('')}</ul>` : '<p class="hint">No values yet.</p>'}</section>
    <section class="panel"><h2>Next milestone</h2>
      ${nm ? `<div class="next-ms"><div class="row"><span class="figure sm">${nm.days} days</span><span class="meta">${sk.current} / ${nm.days}</span></div>
        ${bar('ms', sk.current / nm.days)}
        <p class="sub">${nmReward ? `A reward is waiting ${pips(nmReward.rating)}` : 'No reward assigned yet'}</p></div>`
        : '<p class="hint">Every milestone is behind you. Add a longer one in Rewards.</p>'}</section>`;
}

function viewStreak() {
  const st = S.getState();
  const sk = S.streakInfo();
  const t = S.today();
  const n = st.settings.calendarDays;
  const start = addDays(t, -(n - 1));
  const gridStart = weekStart(start);
  const cells = [];
  for (let d = gridStart; d <= t; d = addDays(d, 1)) {
    if (d < start) { cells.push('<span class="cell void"></span>'); continue; }
    const s = sk.days[d];
    const p = S.dayPct(d);
    const lbl = `${formatShort(d)} · ${Math.round(p * 100)}% of rules${s === 'done' ? ' · streak day' : s === 'frozen' ? ' · freeze used' : ''}`;
    cells.push(`<button class="cell ${s || 'none'} ${d === t ? 'today' : ''}" style="--p:${p}" data-action="goto-day" data-id="${d}" title="${lbl}" aria-label="${lbl}">
      <span class="dn">${Number(d.slice(8))}</span>${s === 'frozen' ? icon('snow', 12) : ''}</button>`);
  }
  const last30 = Array.from({ length: 30 }, (_, i) => S.dayPct(addDays(t, -i)));
  const avg = Math.round((last30.reduce((a, b) => a + b, 0) / 30) * 100);
  const streakRules = S.activeRules().filter((r) => r.streak);
  return `<header class="page-head"><div><p class="eyebrow">Streak</p><h1>${sk.current} ${sk.current === 1 ? 'day' : 'days'}</h1></div></header>
    <section class="panel goal">
      <span class="label">Main goal</span>
      <p class="goal-big">${esc(st.goal.text) || '<span class="hint">Set a goal in Manage</span>'}</p>
      ${st.goal.minAction ? `<p class="sub">Daily minimum: ${esc(st.goal.minAction)}</p>` : ''}
      <p class="sub">${streakRules.length ? `Counts: ${streakRules.map((r) => esc(r.text)).join(' · ')}` : 'No streak rules yet. Flag one in Manage.'}</p></section>
    <div class="stats four">
      ${stat('Current', sk.current)}${stat('Best', sk.best)}
      ${stat('Freezes left', st.settings.freezeEnabled ? sk.freezeLeft : 'Off', st.settings.freezeEnabled ? 'this week' : '')}
      ${stat('Avg done', `${avg}%`, 'last 30 days')}</div>
    <section class="panel"><div class="row"><h2>Last ${n} days</h2>
      <span class="legend"><i class="lg done"></i>streak day <i class="lg part"></i>share of rules <i class="lg frozen"></i>freeze</span></div>
      <div class="cal-head">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="cal">${cells.join('')}</div></section>`;
}

function viewRewards() {
  const st = S.getState();
  const sk = S.streakInfo();
  const sorted = [...st.milestones].sort((a, b) => a.days - b.days);
  const col = S.collection();
  const rows = sorted.map((m, i) => {
    const r = S.rewardOf(m);
    const reached = m.days <= sk.best;
    let slot;
    if (m.claimedAt) slot = `<div class="slot claimed" data-rating="${m.snapshot.rating}"><span class="t">${esc(m.snapshot.title)}</span><span class="meta">Claimed ${formatShort(m.claimedAt)}</span></div>`;
    else if (r && reached) slot = `<button class="btn primary" data-action="open-reveal" data-id="${m.id}">Open reward</button>`;
    else if (r) slot = `<div class="slot locked">${icon('lock', 14)}<span class="meta">Reward waiting</span>${pips(r.rating)}</div>`;
    else slot = `<div class="slot none"><span class="meta">No reward yet</span><button class="btn small" data-action="add-reward-for" data-id="${targetRating(i, sorted.length)}">Add a rating ${targetRating(i, sorted.length)} reward</button></div>`;
    return `<li class="ms ${reached ? 'reached' : ''}"><div class="ms-days"><span class="figure sm">${m.days}</span><span class="label">${m.days === 1 ? 'day' : 'days'}</span></div>
      <div class="ms-slot">${slot}</div>${m.claimedAt ? '' : iconBtn('edit-ms', m.id, 'edit', 'Edit milestone')}</li>`;
  }).join('');
  const tiles = [
    ...col.claimed.map((c) => ({ rating: c.rating, got: 0, html: `<div class="tile got" data-rating="${c.rating}"><span class="rar">${rarityName(c.rating)}</span>${pips(c.rating)}<h4>${esc(c.title)}</h4><span class="meta">${formatShort(c.claimedAt)} · day ${c.days}</span></div>` })),
    ...col.locked.map((r) => ({ rating: r.rating, got: 1, html: `<div class="tile silhouette" data-rating="${r.rating}">${icon('lock', 18)}${pips(r.rating)}<span class="meta">Locked</span></div>` })),
  ].sort((x, y) => x.rating - y.rating || x.got - y.got).map((t) => t.html).join('');
  return `<header class="page-head"><div><p class="eyebrow">Rewards</p><h1>Milestones</h1></div>
      <div class="head-actions"><button class="btn" data-action="redistribute">${icon('shuffle', 16)} Redistribute</button>
      <button class="btn" data-action="add-ms">${icon('plus', 16)} Milestone</button></div></header>
    <ul class="ms-list">${rows || '<li class="hint">No milestones yet.</li>'}</ul>
    <section class="panel"><h2>Collection</h2><div class="tiles">${tiles || '<p class="hint">Nothing here yet. Add rewards below.</p>'}</div></section>
    <section class="panel"><div class="row"><h2>Reward list</h2><button class="btn small" data-action="add-reward">${icon('plus', 14)} Reward</button></div>
      <ul class="rlist">${[...st.rewards].sort((a, b) => a.rating - b.rating).map((r) => `<li><span class="t">${esc(r.title)}</span>${pips(r.rating)}${
        r.claimedAt ? '<span class="meta">Claimed</span>' : iconBtn('edit-reward', r.id, 'edit', 'Edit reward')}</li>`).join('') || '<li class="hint">Add a few prizes, from a trifle to a big one.</li>'}</ul>
      <p class="hint">Higher streak thresholds get higher ratings. Rewards with the same rating are drawn at random. A milestone with no match stays empty.</p></section>`;
}

function viewManage() {
  const st = S.getState();
  const s = st.settings;
  const lvls = [1, 2, 3, 4].map((l) => `L${l}→${l + 1}: ${xpForLevel(l, s)}`).join(' · ');
  const vcard = (v, archived) => {
    const rs = st.rules.filter((r) => r.valueId === v.id);
    return `<article class="vcard ${archived ? 'archived' : ''}" style="--c:${v.color}">
      <header><span class="vicon">${icon(v.icon, 16)}</span><h3>${esc(v.name)}</h3><span class="spacer"></span>
        ${archived ? '' : iconBtn('v-up', v.id, 'up', 'Move up') + iconBtn('v-down', v.id, 'down', 'Move down')}
        ${iconBtn('v-edit', v.id, 'edit', 'Edit value')}
        ${iconBtn('v-archive', v.id, archived ? 'restore' : 'archive', archived ? 'Restore' : 'Archive')}</header>
      <ul class="mrules">${rs.map((r) => `<li class="${r.archived ? 'archived' : ''}"><span class="text">${esc(r.text)}</span>
        ${r.streak ? `<span class="tag">${icon('flame', 12)}</span>` : ''}<span class="xp">+${r.xp}</span>
        ${iconBtn('r-up', r.id, 'up', 'Move up')}${iconBtn('r-down', r.id, 'down', 'Move down')}${iconBtn('r-edit', r.id, 'edit', 'Edit rule')}
        ${iconBtn('r-archive', r.id, r.archived ? 'restore' : 'archive', r.archived ? 'Restore rule' : 'Archive rule')}</li>`).join('')}</ul>
      ${archived ? '' : `<button class="btn small" data-action="r-add" data-id="${v.id}">${icon('plus', 14)} Rule</button>`}</article>`;
  };
  const act = st.values.filter((v) => !v.archived), arch = st.values.filter((v) => v.archived);
  const field = (label, name, val, type = 'number', extra = '') =>
    `<label class="field"><span>${label}</span><input data-setting="${name}" type="${type}" value="${esc(val)}" ${extra}></label>`;
  return `<header class="page-head"><div><p class="eyebrow">Manage</p><h1>Values and rules</h1></div>
      <div class="head-actions"><button class="btn primary" data-action="v-add">${icon('plus', 16)} Value</button></div></header>
    <section class="panel"><h2>Main goal</h2><div class="two">
      <label class="field"><span>Goal</span><input data-goal="text" value="${esc(st.goal.text)}" placeholder="Simple freedom"></label>
      <label class="field"><span>Minimal daily action</span><input data-goal="minAction" value="${esc(st.goal.minAction)}" placeholder="15 minutes"></label></div></section>
    <div class="vcards">${act.map((v) => vcard(v, false)).join('') || '<p class="hint">No values yet. Add one to begin.</p>'}</div>
    ${arch.length ? `<h2 class="sec">Archived</h2><div class="vcards">${arch.map((v) => vcard(v, true)).join('')}
      ${arch.map((v) => `<button class="btn danger small" data-action="v-delete" data-id="${v.id}">Delete ${esc(v.name)} for good</button>`).join('')}</div>` : ''}
    <section class="panel"><h2>Settings</h2><div class="two">
      ${field('Currency name', 'currency', s.currency, 'text', 'maxlength="8"')}
      ${field('XP for level 1→2', 'levelBase', s.levelBase, 'number', 'min="1"')}
      ${field('Growth per level', 'levelGrowth', s.levelGrowth, 'number', 'min="1" max="3" step="0.05"')}
      <label class="field"><span>Calendar length</span><select data-setting="calendarDays">${[30, 60, 90].map((d) => `<option ${d === s.calendarDays ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="field check"><input type="checkbox" data-setting="freezeEnabled" ${s.freezeEnabled ? 'checked' : ''}><span>Soft freeze: a skipped day will not reset the streak</span></label>
      ${field('Freezes per week', 'freezePerWeek', s.freezePerWeek, 'number', `min="1" max="6" ${s.freezeEnabled ? '' : 'disabled'}`)}</div>
      <p class="hint">Level n needs base × growth^(n−1). ${lvls}</p></section>
    ${syncPanel()}
    <section class="panel"><h2>Data</h2>
      <p class="hint">Everything lives in this browser. Export a file to back up or move to another device.</p>
      <div class="head-actions"><button class="btn" data-action="export">${icon('download', 16)} Export to JSON</button>
      <button class="btn" data-action="import">${icon('upload', 16)} Import from JSON</button>
      <button class="btn danger" data-action="reset">${icon('reset', 16)} Reset</button></div>
      <input type="file" id="import-file" accept="application/json,.json" hidden></section>`;
}


function syncPanel() {
  if (!Sync.isConfigured()) {
    return `<section class="panel"><h2>Sync</h2><p class="hint">Cloud sync is not configured in this build, so data stays in this browser. Use export and import to move it.</p></section>`;
  }
  const key = Sync.getKey(), st = Sync.status;
  const line = st.state === 'syncing' ? 'Syncing…' : st.state === 'error' ? `Sync problem: ${esc(st.error)}`
    : st.state === 'ok' ? `Synced at ${new Date(st.at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : 'On';
  if (!key) {
    return `<section class="panel"><h2>Sync</h2>
      <p class="hint">Right now this data lives only in this browser. Turn on sync to keep it in the cloud and open it on any device with a private link.</p>
      <div class="head-actions"><button class="btn primary" data-action="sync-on">Turn on sync</button></div>
      <div class="join"><label class="field"><span>Already synced elsewhere? Paste the sync code or link</span>
        <input id="sync-code" type="text" autocomplete="off" spellcheck="false"></label>
        <button class="btn" data-action="sync-join">Connect</button></div></section>`;
  }
  return `<section class="panel"><h2>Sync</h2>
    <p class="sync-line ${st.state}"><i class="dot"></i>${line}</p>
    <p class="hint">Anyone with the sync link can read and change your data, so keep it private. Open it on another device to connect that device.</p>
    <div class="head-actions"><button class="btn primary" data-action="sync-copy">${icon('link', 16)} Copy sync link</button>
      <button class="btn" data-action="sync-now">Sync now</button>
      <button class="btn danger" data-action="sync-off">Turn off here</button></div></section>`;
}

const VIEWS = { today: viewToday, sheet: viewSheet, streak: viewStreak, rewards: viewRewards, manage: viewManage };

// ---------- render ----------
const barMemory = new Map();
export function render() {
  const r = VIEWS[route()] ? route() : 'today';
  const app = document.getElementById('app');
  const prevScroll = window.scrollY;
  app.innerHTML = `<nav class="nav" aria-label="Main"><div class="brand"><span class="mark"></span><span>Character sheet</span></div>
    ${NAV.map(([id, label, ic]) => `<a href="#/${id}" class="${r === id ? 'active' : ''}" ${r === id ? 'aria-current="page"' : ''}>${icon(ic, 18)}<span>${label}</span></a>`).join('')}</nav>
    <main class="page ${r !== ui.lastRoute ? 'enter' : ''}" data-page="${r}">${VIEWS[r]()}</main>`;
  ui.lastRoute = r;
  window.scrollTo(0, prevScroll);
  // Tween bars from their previous fill so XP visibly flows in.
  app.querySelectorAll('[data-bar]').forEach((el) => {
    const key = el.dataset.bar, pct = Number(el.dataset.pct);
    el.style.transform = `scaleX(${barMemory.has(key) ? barMemory.get(key) : pct})`;
    barMemory.set(key, pct);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `scaleX(${pct})`; }));
  });
  app.querySelectorAll('[data-ring]').forEach((el) => {
    const c = Number(el.dataset.c), pct = Number(el.dataset.pct);
    const prev = barMemory.has('ring') ? barMemory.get('ring') : pct;
    el.style.strokeDashoffset = c * (1 - prev);
    barMemory.set('ring', pct);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.strokeDashoffset = c * (1 - pct); }));
  });
  maybeReveal();
}

function maybeReveal() {
  if (ui.revealing || route() === 'manage') return;
  const m = S.pendingReveals().find((x) => !(ui.skipped && ui.skipped.has(x.id)));
  if (m) openReveal(m.id);
}

function openReveal(id) {
  const m = S.getState().milestones.find((x) => x.id === id);
  const reward = m && S.rewardOf(m);
  if (!reward || m.claimedAt || ui.revealing) return;
  ui.revealing = true;
  ui.skipped = ui.skipped || new Set();
  showReveal({
    days: m.days, reward,
    onClaim: () => S.claimMilestone(id),
    onClose: () => { ui.revealing = false; ui.skipped.add(id); render(); },
  });
}

// ---------- forms ----------
const valueForm = (v) => openForm({
  title: v ? 'Edit value' : 'New value',
  fields: [
    { name: 'name', label: 'Name', required: true, placeholder: 'Craft' },
    { name: 'icon', label: 'Icon', type: 'icon' }, { name: 'color', label: 'Color', type: 'swatch' }],
  values: v || { icon: 'star', color: '#e0a43a' },
  onSubmit: (d) => (v ? S.updateValue(v.id, d) : S.addValue(d)),
});
const ruleForm = (rule, valueId) => openForm({
  title: rule ? 'Edit rule' : 'New rule',
  note: rule ? 'Past completions keep the XP and wording they had when you ticked them.' : '',
  fields: [
    { name: 'text', label: 'I feel successful when…', required: true, placeholder: 'I did 15 minutes on my main goal' },
    { name: 'xp', label: `Reward (${cur()})`, type: 'number', min: 1, max: 1000, required: true },
    { name: 'streak', label: 'Counts toward the goal streak', type: 'checkbox' }],
  values: rule || { xp: 10, streak: false },
  onSubmit: (d) => (rule ? S.updateRule(rule.id, d) : S.addRule({ ...d, valueId })),
  onDelete: rule ? () => S.deleteRule(rule.id) : null, deleteLabel: 'Delete rule',
});
const rewardForm = (rw, rating = 3) => openForm({
  title: rw ? 'Edit reward' : 'New reward',
  fields: [
    { name: 'title', label: 'Title', required: true },
    { name: 'rating', label: 'Value', type: 'select', options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} · ${n === 1 ? 'a trifle' : n === 5 ? 'a big prize' : rarityName(n).toLowerCase()}` })) },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'link', label: 'Link', type: 'url', placeholder: 'https://' }],
  values: rw || { rating },
  onSubmit: (d) => { d.rating = Number(d.rating); rw ? S.updateReward(rw.id, d) : S.addReward(d); },
  onDelete: rw ? () => S.deleteReward(rw.id) : null, deleteLabel: 'Delete reward',
});
const msForm = (m) => openForm({
  title: m ? 'Edit milestone' : 'New milestone',
  fields: [{ name: 'days', label: 'Streak days', type: 'number', min: 1, max: 3650, required: true }],
  values: m || { days: 10 },
  onSubmit: (d) => (m ? S.updateMilestone(m.id, d.days) : S.addMilestone(d.days)),
  onDelete: m ? () => S.deleteMilestone(m.id) : null, deleteLabel: 'Delete milestone',
});

// ---------- events ----------
const find = (list, id) => list.find((x) => x.id === id);
const actions = {
  toggle(el) {
    const wasDone = el.classList.contains('done');
    const res = S.toggleRule(el.dataset.id, ui.date);
    if (res.added) {
      const b = el.getBoundingClientRect();
      const v = find(S.getState().values, res.valueId);
      xpPopup(b.right - 40, b.top + b.height / 2, `+${res.xp} ${cur()}`, v && v.color);
      if (res.levelUp) setTimeout(() => toast(`${res.levelUp.name} reached level ${res.levelUp.level}`), 350);
    } else if (wasDone) toast(`−${res.xp} ${cur()}`);
  },
  'day-prev': () => { ui.date = addDays(ui.date, -1); render(); },
  'day-next': () => { if (ui.date < S.today()) ui.date = addDays(ui.date, 1); render(); },
  'day-today': () => { ui.date = S.today(); render(); },
  'goto-day': (el) => { ui.date = el.dataset.id; location.hash = '#/today'; },
  'open-reveal': (el) => openReveal(el.dataset.id),
  redistribute: () => { S.redistribute(); toast('Rewards redistributed. Claimed ones stay as they are'); },
  'add-ms': () => msForm(),
  'edit-ms': (el) => msForm(find(S.getState().milestones, el.dataset.id)),
  'add-reward': () => rewardForm(),
  'add-reward-for': (el) => rewardForm(null, Number(el.dataset.id)),
  'edit-reward': (el) => rewardForm(find(S.getState().rewards, el.dataset.id)),
  'v-add': () => valueForm(),
  'v-edit': (el) => valueForm(find(S.getState().values, el.dataset.id)),
  'v-up': (el) => S.moveValue(el.dataset.id, -1),
  'v-down': (el) => S.moveValue(el.dataset.id, 1),
  'v-archive': (el) => { const v = find(S.getState().values, el.dataset.id); S.updateValue(v.id, { archived: !v.archived }); },
  'v-delete': (el) => {
    const v = find(S.getState().values, el.dataset.id);
    confirmBox({ title: `Delete ${v.name}?`, text: 'Its rules go too. XP already earned stays in your history and totals.', confirmLabel: 'Delete', danger: true, onConfirm: () => S.deleteValue(v.id) });
  },
  'r-add': (el) => ruleForm(null, el.dataset.id),
  'r-edit': (el) => ruleForm(find(S.getState().rules, el.dataset.id)),
  'r-up': (el) => S.moveRule(el.dataset.id, -1),
  'r-down': (el) => S.moveRule(el.dataset.id, 1),
  'r-archive': (el) => { const r = find(S.getState().rules, el.dataset.id); S.updateRule(r.id, { archived: !r.archived }); },
  async 'sync-on'() {
    try { await Sync.enable(Sync.newKey()); toast('Sync is on. Copy the link to use it elsewhere'); } catch (e) { Sync.disable(); toast(`Could not turn on sync: ${e.message}`); }
    render();
  },
  'sync-join'() {
    const raw = (document.getElementById('sync-code').value || '').trim();
    joinSync(raw.includes('k=') ? raw.split('k=').pop() : raw);
  },
  async 'sync-copy'() {
    try { await navigator.clipboard.writeText(Sync.syncLink()); toast('Sync link copied'); } catch { window.prompt('Copy your sync link', Sync.syncLink()); }
  },
  'sync-now': () => Sync.reconcile(),
  'sync-off': () => confirmBox({ title: 'Turn off sync here?', text: 'This device keeps its data but stops syncing. Your cloud copy stays and the link keeps working elsewhere.', confirmLabel: 'Turn off', danger: true, onConfirm: () => { Sync.disable(); render(); } }),
  export() {
    const blob = new Blob([exportJson(S.getState())], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `character-sheet-${toKey()}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  },
  import: () => document.getElementById('import-file').click(),
  reset: () => confirmBox({
    title: 'Reset everything?', text: 'This erases all values, rules, history and rewards in this browser and turns sync off here. A cloud copy, if any, is kept. Export first if unsure.',
    confirmLabel: 'Erase', danger: true,
    onConfirm: () => { Sync.disable(); localStorage.clear(); location.reload(); },
  }),
};


/** Connect this device to an existing sync code (typed in or from a link). */
export async function joinSync(key) {
  if (!Sync.isConfigured()) return;
  if (!Sync.isValidKey(key)) { toast('That sync code does not look right'); return; }
  try {
    const remote = await Sync.fetchRemote(key);
    if (!remote) { toast('No data found for that code'); return; }
    const untouched = S.getState().updatedAt === 0;
    const go = async () => { await Sync.enable(key, { useRemote: true }); toast('Connected. Data loaded from the cloud'); render(); };
    if (untouched) await go();
    else confirmBox({ title: 'Replace this device\'s data?', text: 'This browser already has data. Connecting replaces it with the synced copy. Export first if you want to keep it.', confirmLabel: 'Use synced data', danger: true, onConfirm: go });
  } catch (e) { toast(`Could not connect: ${e.message}`); }
}

export function init() {
  const app = document.getElementById('app');
  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el && !el.disabled && actions[el.dataset.action]) actions[el.dataset.action](el);
  });
  app.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'import-file') {
      const f = t.files[0];
      if (!f) return;
      f.text().then((text) => {
        confirmBox({ title: 'Replace current data?', text: `Import "${f.name}" and overwrite everything in this browser.`, confirmLabel: 'Import', danger: true,
          onConfirm: () => { try { S.replaceState(text); toast('Imported'); } catch (err) { toast(`Import failed: ${err.message}`); } } });
      });
      t.value = '';
    } else if (t.dataset.setting) {
      const k = t.dataset.setting;
      let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? Number(t.value) : t.value;
      if (k === 'calendarDays') v = Number(v);
      if (k === 'currency') v = String(v).trim() || 'XP';
      if ((k === 'levelBase' || k === 'freezePerWeek') && !(v >= 1)) v = 1;
      if (k === 'levelGrowth' && !(v >= 1)) v = 1;
      S.setSettings({ [k]: v });
    } else if (t.dataset.goal) S.setGoal({ [t.dataset.goal]: t.value.trim() });
  });
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
  S.subscribe(render);
  Sync.onStatus(() => { if (route() === 'manage' && !document.querySelector('dialog[open]')) render(); });
  render();
}
