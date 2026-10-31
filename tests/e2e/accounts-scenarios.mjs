import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { png } = require('../../apps/mobile/tests/featureHarness.cjs');

export async function verifyAccounts({ request, startApi, stopApi, env, client, folder, pass }) {
  await stopApi();
  const objects = new Map(), messages = [];
  let failThumbnail = false, failDeletion = false, publicBucket = false;
  const storageKey = 'synthetic-server-only-key';
  const storage = createServer(async (req, res) => {
    try {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      const bytes = Buffer.concat(chunks), path = req.url;
      if (path === '/mail') { assert.equal(req.headers['api-key'], 'synthetic-email-key'); messages.push(JSON.parse(bytes)); res.writeHead(201).end('{}'); return; }
      assert.equal(req.headers.apikey, storageKey); assert.equal(req.headers.authorization, 'Bearer ' + storageKey);
      if (path === '/storage/v1/bucket/tripora-private') { res.end(JSON.stringify({ public: publicBucket })); return; }
      if (path === '/storage/v1/object/list/tripora-private') {
        const options=JSON.parse(bytes);const rows=[...objects.keys()].sort().map(name=>({name,updated_at:name.startsWith('00000000')?'2000-01-01T00:00:00Z':new Date().toISOString()}));
        res.end(JSON.stringify(rows.slice(options.offset,options.offset+options.limit))); return;
      }
      if (path === '/storage/v1/object/tripora-private' && req.method === 'DELETE') {
        if (failDeletion) { failDeletion = false; res.writeHead(503).end('{}'); return; }
        for (const name of JSON.parse(bytes).prefixes) objects.delete(name);
        res.end('{}'); return;
      }
      if (req.method === 'POST' && path.startsWith('/storage/v1/object/tripora-private/')) {
        assert.equal(req.headers['x-upsert'], 'true');
        const name = path.split('/').at(-1);
        if (failThumbnail && name.endsWith('.thumb.png')) { failThumbnail = false; res.writeHead(503).end('{}'); return; }
        objects.set(name, bytes); res.end('{}'); return;
      }
      if (req.method === 'GET' && path.startsWith('/storage/v1/object/authenticated/tripora-private/')) {
        const value = objects.get(path.split('/').at(-1)); if (!value) { res.writeHead(404).end('{}'); return; }
        res.setHeader('content-type', 'image/png'); res.end(value); return;
      }
      res.writeHead(404).end('{}');
    } catch { res.writeHead(500).end('{}'); }
  });
  await new Promise(resolve => storage.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + storage.address().port;
  const outbox = join(folder, 'account-outbox');
  Object.assign(env, { Tripora__RequireConfirmedEmail: 'true', Tripora__Email__Mode: 'File', Tripora__Email__Outbox: outbox, Tripora__DatabaseKeys: 'true', Tripora__Storage__Mode: 'Supabase', Tripora__Storage__Url: origin, Tripora__Storage__ServiceKey: storageKey, Tripora__ValidatePrivateBucket: 'true' });
  const password = 'Synthetic!123456';
  const email = 'recovery@example.test', otherEmail = 'remaining@example.test';
  const mailbox = async (recipient, kind) => {
    const names = await readdir(outbox); const all = await Promise.all(names.map(async name => ({ message: JSON.parse(await readFile(join(outbox, name), 'utf8')), time: (await stat(join(outbox, name))).mtimeMs })));
    return all.sort((a,b) => b.time-a.time).find(m => m.message.email === recipient && m.message.kind === kind)?.message;
  };
  const login = async (email, password) => (await request('/auth/login?useCookies=false', null, { email, password }));
  const entries = async token => { let cursor = 0, items = []; while (true) { const page = (await request('/api/entries/pull?after=' + cursor, token)).data; items.push(...page.items); cursor = page.cursor; if (!page.hasMore) return items; } };
  try {
    await startApi();
    assert.equal((await request('/auth/options')).data.requireConfirmedEmail, true);
    assert.equal((await request('/auth/register', null, { email, password })).status, 200);
    assert.equal((await login(email, password)).status, 401);
    assert.equal((await request('/auth/confirm-code', null, { email, code: 'invalid' })).status, 400);
    const confirm = await mailbox(email, 'confirmation'); assert.ok(confirm.code);
    assert.equal((await request('/auth/confirm-code', null, { email, code: confirm.code })).status, 204);
    const original = (await login(email, password)).data; assert.ok(original.accessToken);
    assert.equal((await request('/auth/forgotPassword', null, { email: 'absent@example.test' })).status, 200);
    assert.equal(await mailbox('absent@example.test', 'reset'), undefined);
    assert.equal((await request('/auth/forgotPassword', null, { email })).status, 200);
    const reset = await mailbox(email, 'reset'); assert.ok(reset.code);
    assert.equal((await request('/auth/resetPassword', null, { email, resetCode: 'invalid', newPassword: password })).status, 400);
    const nextPassword = 'Changed!123456';
    assert.equal((await request('/auth/resetPassword', null, { email, resetCode: reset.code, newPassword: nextPassword })).status, 200);
    assert.equal((await login(email, password)).status, 401);
    assert.equal((await request('/auth/me', original.accessToken)).status, 401);
    assert.equal((await request('/auth/refresh', null, { refreshToken: original.refreshToken })).status, 401);
    assert.equal((await request('/auth/resetPassword', null, { email, resetCode: reset.code, newPassword: password })).status, 400);
    const owner = (await login(email, nextPassword)).data; assert.ok(owner.accessToken);
    const ownerId = (await request('/auth/me', owner.accessToken)).data.id;
    await stopApi(); await startApi();
    assert.equal((await request('/auth/me', owner.accessToken)).status, 200);
    assert.ok(Number((await client.query('SELECT count(*) FROM "DataProtectionKeys"')).rows[0].count) > 0);
    pass('confirmed-email gate, anonymous non-enumerating recovery, invalid/reused codes, password change, access/refresh invalidation and database-key restart');

    assert.equal((await request('/auth/register', null, { email: otherEmail, password })).status, 200);
    assert.equal((await request('/auth/confirm-code', null, { email: otherEmail, code: (await mailbox(otherEmail, 'confirmation')).code })).status, 204);
    const other = (await login(otherEmail, password)).data;
    const makeTrip = async (token, name) => { const id = randomUUID(); const r = await request('/api/sync/push', token, { operationId: randomUUID(), tripId: id, kind: 'trip.create', baseVersion: 0, data: { name, destination: 'Synthetic', startDate: '2026-11-01', endDate: '2026-11-03' } }); assert.equal(r.status, 200); return id; };
    const ownedTrip = await makeTrip(owner.accessToken, 'To erase'), sharedTrip = await makeTrip(other.accessToken, 'To retain');
    for (const [token, tripId, recipient, receiver] of [[owner.accessToken, ownedTrip, otherEmail, other.accessToken], [other.accessToken, sharedTrip, email, owner.accessToken]]) {
      const invite = (await request(`/api/trips/${tripId}/invitations`, token, { email: recipient })).data;
      assert.equal((await request('/api/invitations/accept', receiver, { token: invite.token })).status, 200);
    }
    const placeId = randomUUID();
    assert.equal((await request('/api/places/push', owner.accessToken, { operationId: randomUUID(), placeId, tripId: sharedTrip, kind: 'place.create', baseVersion: 0, data: { category: 'place', name: 'Private creator place', notes: 'Erase', address: 'Synthetic', link: '', visited: false } })).status, 200);
    const asset = randomUUID(), image = png(2, 2), hash = createHash('sha256').update(image).digest('hex');
    const upload = { id: asset, tripId: sharedTrip, pngBase64: image.toString('base64'), thumbnailBase64: image.toString('base64'), sha256: hash, thumbnailSha256: hash };
    failThumbnail = true;
    assert.equal((await request('/api/media/push', owner.accessToken, upload)).status, 500);
    assert.equal((await request('/api/media/push', owner.accessToken, upload)).status, 200);
    assert.equal((await request('/api/media/push', owner.accessToken, upload)).status, 200);
    assert.equal((await request('/api/media/' + asset)).status, 401);
    const memoryId = randomUUID();
    assert.equal((await request('/api/entries/push', owner.accessToken, { operationId: randomUUID(), entryId: memoryId, tripId: sharedTrip, feature: 'memory', kind: 'create', baseVersion: 0, data: { title: 'Erase memory', notes: 'Private note', placeId: null, mediaId: asset } })).status, 200);
    const downloaded = await request('/api/media/' + asset, other.accessToken); assert.equal(downloaded.status, 200); assert.equal(downloaded.data.sha256, hash);
    await stopApi(); await startApi();
    assert.equal((await request('/api/media/' + asset, other.accessToken)).data.sha256, hash);
    assert.equal(objects.size, 2);
    pass('private remote storage HTTP contract, interrupted thumbnail write/retry, stable asset ID, authenticated download and API restart');

    assert.equal((await request('/auth/delete-account', owner.accessToken, { password: nextPassword, confirmation: 'wrong' })).status, 400);
    assert.equal((await request('/auth/delete-account', owner.accessToken, { password: 'wrong', confirmation: 'OBRIŠI RAČUN I PUTOVANJA' })).status, 400);
    assert.equal((await request('/auth/me', owner.accessToken)).status, 200);
    failDeletion = true;
    const deletion = await request('/auth/delete-account', owner.accessToken, { password: nextPassword, confirmation: 'OBRIŠI RAČUN I PUTOVANJA' });
    assert.equal(deletion.status, 200); assert.equal(deletion.data.mediaCleanupPending, 1);
    assert.equal((await request('/auth/me', owner.accessToken)).status, 401);
    assert.equal((await request('/auth/refresh', null, { refreshToken: owner.refreshToken })).status, 401);
    assert.equal((await login(email, nextPassword)).status, 401);
    const remainingTrips = (await request('/api/sync/pull', other.accessToken)).data.items;
    assert.equal(remainingTrips.find(t => t.id === ownedTrip).deleted, true); assert.equal(remainingTrips.find(t => t.id === sharedTrip).deleted, false);
    const remainingEntries = await entries(other.accessToken); const memory = remainingEntries.find(e => e.id === memoryId);
    assert.equal(memory.deleted, true); assert.equal(memory.authorEmail, ''); assert.equal(memory.data.notes, ''); assert.equal(memory.data.mediaId, null);
    const places = (await request('/api/places/pull', other.accessToken)).data.items; assert.equal(places.find(p => p.id === placeId).deleted, true); assert.equal(places.find(p => p.id === placeId).notes, '');
    const storedUser = (await client.query('SELECT "Email", "PasswordHash", "SecurityStamp" FROM "AspNetUsers" WHERE "Id"=$1', [ownerId])).rows[0]; assert.equal(storedUser.Email, null); assert.equal(storedUser.PasswordHash, null);
    assert.equal((await request('/api/media/' + asset, other.accessToken)).status, 404);
    for(let i=0;i<101;i++)objects.set('00000000000000000000'+i.toString(16).padStart(12,'0')+'.png',image);
    assert.equal((await request('/api/media/cleanup', other.accessToken, {})).status, 200); assert.equal(objects.size, 0);
    assert.equal(Number((await client.query('SELECT count(*) FROM "MediaAssets" WHERE "Id"=$1', [asset])).rows[0].count), 0);
    await stopApi(); await startApi(); assert.equal((await request('/auth/me', owner.accessToken)).status, 401);
    pass('password plus explicit deletion confirmation; owner trip and own shared contributions erased, access revoked, tombstones persisted, failed private byte deletion retried');

    assert.equal((await request('/auth/register', null, { email, password })).status, 200);
    assert.equal((await request('/auth/confirm-code', null, { email, code: (await mailbox(email, 'confirmation')).code })).status, 204);
    const replacement = (await login(email, password)).data;
    assert.notEqual((await request('/auth/me', replacement.accessToken)).data.id, ownerId);
    assert.equal((await request('/api/sync/pull', replacement.accessToken)).data.items.length, 0);
    pass('re-registering an erased email creates a new identity and cannot reclaim old trips or offline account scope');

    await stopApi();
    Object.assign(env, { Tripora__Email__Mode: 'Brevo', Tripora__Email__ApiKey: 'synthetic-email-key', Tripora__Email__From: 'sender@example.test', Tripora__Email__TestUrl: origin + '/mail' });
    await startApi(); assert.equal((await request('/auth/forgotPassword', null, { email: otherEmail })).status, 200);
    assert.equal(messages.length, 1); assert.equal(messages[0].to[0].email, otherEmail); assert.ok(messages[0].htmlContent.includes('Tripori')); assert.equal(messages[0].sender.email, 'sender@example.test');
    pass('transactional email HTTPS-adapter request contract through a Testing-only local transport; no real email sent');
    await stopApi(); publicBucket = true;
    await assert.rejects(startApi(), /Refusing a public photo bucket/); publicBucket = false;
    pass('hosted private-storage startup refuses a public bucket instead of exposing private media');
    env.ASPNETCORE_ENVIRONMENT='Production';
    await assert.rejects(startApi(), /Hosted beta requires explicit opt-in/);
    pass('production startup stays closed without explicit hosted configuration');
    env.ASPNETCORE_ENVIRONMENT='Testing'; env.Tripora__EnforceDataApiIsolation='true';
    await client.query('CREATE ROLE anon; CREATE ROLE authenticated;');
    await assert.rejects(startApi(), /Public database schema is exposed/);
    await client.query(await readFile(new URL('../../deploy/supabase-private-database.sql', import.meta.url), 'utf8'));
    await startApi(); assert.equal((await request('/health/ready')).status, 200);
    const isolation = (await client.query("SELECT has_schema_privilege('anon','public','USAGE') AS schema_access, has_table_privilege('anon','\"AspNetUsers\"','SELECT') AS user_read")).rows[0];
    assert.equal(isolation.schema_access,false);assert.equal(isolation.user_read,false);
    pass('Supabase-style public Data API roles cannot read Identity/app tables; startup rejects exposure before accepting hardened configuration');
  } finally { await stopApi(); await new Promise(resolve => storage.close(resolve)); }
}
