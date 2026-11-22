import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config.js', () => ({ SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon' }));

const store = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
});
vi.stubGlobal('navigator', { onLine: true });

const Sync = await import('../src/sync.js');
const S = await import('../src/state.js');

const calls = [];
function mockServer(remote) {
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    const fn = url.split('/rpc/')[1];
    calls.push({ fn, body: JSON.parse(init.body) });
    return { ok: true, text: async () => (fn === 'get_sheet' && remote ? JSON.stringify(remote) : '') };
  }));
}

beforeEach(() => { store.clear(); Sync.setKey('k'.repeat(40)); });

describe('sync keys', () => {
  it('generates long url-safe codes', () => {
    const k = Sync.newKey();
    expect(k.length).toBeGreaterThanOrEqual(60);
    expect(Sync.isValidKey(k)).toBe(true);
    expect(Sync.isValidKey('short')).toBe(false);
    expect(Sync.isValidKey('a b'.repeat(20))).toBe(false);
  });
  it('is unique each time', () => {
    expect(Sync.newKey()).not.toBe(Sync.newKey());
  });
});

describe('reconcile', () => {
  it('pushes when the cloud is empty', async () => {
    mockServer(null);
    await Sync.reconcile();
    expect(calls.map((c) => c.fn)).toEqual(['get_sheet', 'put_sheet']);
    expect(calls[1].body.p_key).toBe('k'.repeat(40));
  });
  it('adopts the cloud copy when it is newer', async () => {
    const remote = { ...S.getState(), updatedAt: Date.now() + 100000, goal: { text: 'From cloud', minAction: '' } };
    mockServer(remote);
    await Sync.reconcile();
    expect(S.getState().goal.text).toBe('From cloud');
    expect(calls.map((c) => c.fn)).toEqual(['get_sheet']);
  });
  it('pushes when this device is newer', async () => {
    S.commit(() => {});
    mockServer({ ...S.getState(), updatedAt: 1 });
    await Sync.reconcile();
    expect(calls.map((c) => c.fn)).toEqual(['get_sheet', 'put_sheet']);
  });
  it('reports errors without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, text: async () => '' })));
    await Sync.reconcile();
    expect(Sync.status.state).toBe('error');
  });
});
