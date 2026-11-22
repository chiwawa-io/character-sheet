// Cloud sync through Supabase RPC. Whole-document, last write wins (by updatedAt).
// The secret key never leaves the device in clear: the server stores only its SHA-256.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import * as S from './state.js';

const KEY_STORE = 'character-sheet:sync-key';
export const isConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const getKey = () => { try { return localStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
export const setKey = (k) => { try { localStorage.setItem(KEY_STORE, k); } catch { /* private mode */ } };
export const clearKey = () => { try { localStorage.removeItem(KEY_STORE); } catch { /* ignore */ } };

export function newKey() {
  const b = crypto.getRandomValues(new Uint8Array(48));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const isValidKey = (k) => /^[A-Za-z0-9_-]{32,200}$/.test(k);
export const syncLink = () => `${location.origin}${location.pathname}#k=${getKey()}`;

// --- status for the UI ---
export const status = { state: 'off', at: 0, error: '' }; // off | idle | syncing | ok | error
const watchers = new Set();
export const onStatus = (fn) => (watchers.add(fn), () => watchers.delete(fn));
const set = (patch) => { Object.assign(status, patch); watchers.forEach((w) => w()); };

async function rpc(fn, args, key) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_key: key, ...args }),
  });
  if (!res.ok) throw new Error(`Sync server said ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const fetchRemote = (key = getKey()) => rpc('get_sheet', {}, key);
export const pushNow = (key = getKey()) => rpc('put_sheet', { p_data: S.getState() }, key);

async function guarded(job) {
  if (!isConfigured() || !getKey()) return;
  set({ state: 'syncing', error: '' });
  try {
    await job();
    set({ state: 'ok', at: Date.now() });
  } catch (e) {
    set({ state: 'error', error: navigator.onLine ? e.message : 'Offline, will retry' });
  }
}

/** Compare with the cloud copy and move data in the newer direction. */
export function reconcile() {
  return guarded(async () => {
    const remote = await fetchRemote();
    const local = S.getState();
    if (!remote) await pushNow();
    else if ((remote.updatedAt || 0) > local.updatedAt) S.applyRemote(remote);
    else if (local.updatedAt > (remote.updatedAt || 0)) await pushNow();
  });
}

let timer = null;
function schedulePush() {
  if (!isConfigured() || !getKey()) return;
  clearTimeout(timer);
  timer = setTimeout(() => guarded(() => pushNow()), 1200);
}

let lastPull = 0;
export function start() {
  if (!isConfigured()) return;
  if (getKey()) { set({ state: 'idle' }); reconcile(); }
  S.onLocalChange(schedulePush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getKey() && Date.now() - lastPull > 10000) { lastPull = Date.now(); reconcile(); }
  });
  window.addEventListener('online', () => reconcile());
}

/** Turn sync on with a key (new or from another device). Returns 'created' | 'joined'. */
export async function enable(key, { useRemote = false } = {}) {
  setKey(key);
  set({ state: 'idle' });
  if (useRemote) {
    const remote = await fetchRemote(key);
    if (remote) { S.applyRemote(remote); set({ state: 'ok', at: Date.now() }); return 'joined'; }
  }
  S.commit(() => {}); // stamps updatedAt so the push wins
  await guarded(() => pushNow(key));
  return 'created';
}

export function disable() {
  clearKey();
  clearTimeout(timer);
  set({ state: 'off', error: '' });
}
