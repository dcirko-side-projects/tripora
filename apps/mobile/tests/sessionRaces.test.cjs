const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SessionClient } = require('../.test-build/core/sessionClient.js');

const base = 'https://session.example.test';
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
const unauthorized = error => error.status === 401;
function gate() {
  let release;
  const promise = new Promise(resolve => { release = resolve; });
  return { promise, release };
}
function fixture() {
  const disk = { value: null, async read() { return this.value; }, async write(value) { this.value = value; }, async clear() { this.value = null; } };
  const calls = [];
  let user = 'a';
  let now = 0;
  const pauses = new Map();
  const send = async (url, options) => {
    const path = url.slice(base.length);
    calls.push({ path, options });
    if (pauses.has(path)) return pauses.get(path)(options);
    if (path.startsWith('/auth/login')) {
      user = JSON.parse(options.body).email[0];
      return response({ accessToken: user, refreshToken: user, expiresIn: 900 });
    }
    if (path === '/auth/me') return response({ id: user, email: `${user}@example.test` });
    if (path === '/auth/refresh') return response({ accessToken: user, refreshToken: user, expiresIn: 900 });
    return response({ ok: true });
  };
  const session = new SessionClient(base, disk, async value => value, send, () => now);
  return { disk, calls, pauses, session, expire() { now += 900000; }, signIn: who => session.signIn(`${who}@example.test`, 'Synthetic!123', false) };
}

for (const stage of ['read', 'scope']) {
  test(`logout during session restore ${stage} cannot reactivate stored credentials`, async () => {
    const f = fixture();
    await f.signIn('a');
    const entered = gate(); const resume = gate();
    const stored = f.disk.value;
    if (stage === 'read') f.disk.read = async () => { entered.release(); await resume.promise; return stored; };
    const scope = async value => {
      if (stage === 'scope') { entered.release(); await resume.promise; }
      return value;
    };
    const client = new SessionClient(base, f.disk, scope);
    const restoring = client.restore();
    const rejected = assert.rejects(restoring, unauthorized);
    await entered.promise;
    await client.signOut();
    resume.release();
    await rejected;
    assert.equal(f.disk.value, null);
    await assert.rejects(client.request('/api/trips'), unauthorized);
  });
}

test('delayed restore cannot replace a newly signed-in account', async () => {
  const f = fixture(); await f.signIn('a');
  const stored = f.disk.value; const entered = gate(); const resume = gate();
  f.disk.read = async () => { entered.release(); await resume.promise; return stored; };
  const restoring = f.session.restore(); const rejected = assert.rejects(restoring, unauthorized);
  await entered.promise; await f.signIn('b'); resume.release(); await rejected;
  await f.session.request('/api/current');
  assert.equal(f.calls.at(-1).options.headers.Authorization, 'Bearer b');
  assert.equal(JSON.parse(f.disk.value).id, 'b');
});

for (const status of [200, 401]) {
  test(`account switch rejects old HTTP ${status} without retrying its mutation as the new account`, async () => {
    const f = fixture(); await f.signIn('a');
    const entered = gate(); const resume = gate();
    f.pauses.set('/api/push', async () => { entered.release(); await resume.promise; return response({ accepted: true }, status); });
    const pending = f.session.request('/api/push', { operationId: 'synthetic-a-only' });
    const rejected = assert.rejects(pending, unauthorized);
    await entered.promise; await f.session.signOut(); await f.signIn('b'); resume.release(); await rejected;
    assert.equal(f.calls.filter(call => call.path === '/api/push').length, 1);
    assert.equal(f.calls.filter(call => call.path === '/auth/refresh').length, 0);
    await f.session.request('/api/current');
    assert.equal(f.calls.at(-1).options.headers.Authorization, 'Bearer b');
  });
}

test('new account refresh does not join the previous account refresh still in flight', async () => {
  const f = fixture(); await f.signIn('a'); f.expire();
  const entered = gate(); const resume = gate();
  f.pauses.set('/auth/refresh', async options => {
    const token = JSON.parse(options.body).refreshToken;
    if (token === 'a') { entered.release(); await resume.promise; }
    return response({ accessToken: token, refreshToken: token, expiresIn: 900 });
  });
  const oldRequest = f.session.request('/api/old'); const rejected = assert.rejects(oldRequest, unauthorized);
  await entered.promise; await f.session.signOut(); await f.signIn('b'); f.expire();
  const newRequest = f.session.request('/api/current');
  resume.release(); await rejected;
  assert.deepEqual(await newRequest, { ok: true });
  assert.equal(f.calls.filter(call => call.path === '/auth/refresh').length, 2);
  assert.equal(f.calls.some(call => call.path === '/api/old'), false);
  assert.equal(f.calls.at(-1).options.headers.Authorization, 'Bearer b');
});

test('logout blocks new requests before secure-storage clearing finishes', async () => {
  const f = fixture(); await f.signIn('a');
  const entered = gate(); const resume = gate();
  f.disk.clear = async () => { entered.release(); await resume.promise; f.disk.value = null; };
  const logout = f.session.signOut();
  await entered.promise;
  await assert.rejects(f.session.request('/api/after-logout'), unauthorized);
  assert.equal(f.calls.some(call => call.path === '/api/after-logout'), false);
  resume.release(); await logout;
});

test('logout also rejects a delayed successful response from the authorized retry', async () => {
  const f = fixture(); await f.signIn('a');
  const entered = gate(); const resume = gate(); let attempts = 0;
  f.pauses.set('/api/push', async () => {
    if (++attempts === 1) return response({}, 401);
    entered.release(); await resume.promise; return response({ accepted: true });
  });
  const pending = f.session.request('/api/push', { operationId: 'synthetic-retry' });
  const rejected = assert.rejects(pending, unauthorized);
  await entered.promise; await f.session.signOut(); resume.release(); await rejected;
  assert.equal(attempts, 2);
  assert.equal(f.disk.value, null);
});

test('restore started during logout waits for secure-storage clearing', async () => {
  const f = fixture(); await f.signIn('a');
  const entered = gate(); const resume = gate();
  f.disk.clear = async () => { entered.release(); await resume.promise; f.disk.value = null; };
  const logout = f.session.signOut(); await entered.promise;
  const restoring = f.session.restore();
  resume.release(); await logout;
  assert.equal(await restoring, null);
  await assert.rejects(f.session.request('/api/current'), unauthorized);
});

test('cold server can respond after 60 seconds without replaying a mutation', async t => {
  const f = fixture(); await f.signIn('a');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  f.pauses.set('/api/push', options => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    setTimeout(() => resolve(response({ accepted: true })), 60000);
  }));
  const pending = f.session.request('/api/push', { operationId: 'cold-start' });
  t.mock.timers.tick(60000);
  assert.deepEqual(await pending, { accepted: true });
  assert.equal(f.calls.filter(call => call.path === '/api/push').length, 1);
});

test('timeout bounds response body reading and preserves the session for retry', async t => {
  const f = fixture(); await f.signIn('a'); const saved = f.disk.value;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let reading;
  const entered = new Promise(resolve => { reading = resolve; });
  f.pauses.set('/api/push', async options => ({ text: () => {
    reading();
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  } }));
  const pending = f.session.request('/api/push', { operationId: 'body-stall' });
  const rejected = assert.rejects(pending, /Server nije odgovorio na vrijeme/);
  await entered;
  t.mock.timers.tick(75000);
  await rejected;
  assert.equal(f.disk.value, saved);
  assert.equal(f.calls.filter(call => call.path === '/api/push').length, 1);
  f.pauses.delete('/api/push');
  assert.deepEqual(await f.session.request('/api/push', { operationId: 'body-stall' }), { ok: true });
});

test('network loss after idle preserves credentials and a later refresh recovers', async () => {
  const f = fixture(); await f.signIn('a'); f.expire(); const saved = f.disk.value;
  f.pauses.set('/auth/refresh', async () => { throw new TypeError('network failed'); });
  await assert.rejects(f.session.request('/api/current'), /Provjeri mrežu/);
  assert.equal(f.disk.value, saved);
  assert.equal(f.calls.some(call => call.path === '/api/current'), false);
  f.pauses.delete('/auth/refresh');
  assert.deepEqual(await f.session.request('/api/current'), { ok: true });
});
