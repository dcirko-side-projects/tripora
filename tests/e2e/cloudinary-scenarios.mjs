import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const { png } = createRequire(import.meta.url)('../../apps/mobile/tests/featureHarness.cjs');

export async function verifyCloudinary({ request, startApi, stopApi, env, tokenA, tokenB, pass }) {
  const secret = 'synthetic-cloud-secret', key = 'synthetic-cloud-key', objects = new Map();
  let failThumbnail = true, failDelete = false;
  const check = values => {
    assert.equal(values.api_key, key);
    const fields = Object.entries(values).filter(([k]) => !['api_key', 'signature', 'file'].includes(k)).sort(([a], [b]) => a.localeCompare(b));
    assert.equal(values.signature, createHash('sha256').update(fields.map(([k,v]) => k + '=' + v).join('&') + secret).digest('hex'));
    assert.equal(values.type, 'authenticated');
  };
  const upstream = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const chunks = []; for await (const c of req) chunks.push(c); const bytes = Buffer.concat(chunks);
      if (url.pathname === '/image/upload') {
        const boundary = req.headers['content-type'].split('boundary=')[1].replaceAll('"', '');
        const parts = bytes.toString('latin1').split('--' + boundary).filter(p => p.includes('Content-Disposition:'));
        const fields = {}; let file;
        for (const part of parts) {
          const name = /name="?([^";\r\n]+)"?/.exec(part)[1], begin = part.indexOf('\r\n\r\n') + 4;
          const value = part.slice(begin, -2);
          if (name === 'file') file = Buffer.from(value, 'latin1'); else fields[name] = value;
        }
        check(fields); assert.equal(fields.overwrite, 'true');
        if (failThumbnail && fields.public_id.endsWith('-thumb')) { failThumbnail = false; res.writeHead(503).end('{}'); return; }
        objects.set(fields.public_id, file); res.end(JSON.stringify({ type: 'authenticated', public_id: fields.public_id })); return;
      }
      if (url.pathname === '/image/download') {
        const fields = Object.fromEntries(url.searchParams); check(fields); assert.equal(fields.format, 'png');
        assert.ok(Number(fields.expires_at) > Date.now() / 1000);
        const file = objects.get(fields.public_id); if (!file) { res.writeHead(404).end('{}'); return; }
        res.end(file); return;
      }
      if (url.pathname === '/image/destroy') {
        const fields = Object.fromEntries(new URLSearchParams(bytes.toString())); check(fields);
        if (failDelete) { failDelete = false; res.writeHead(503).end('{}'); return; }
        objects.delete(fields.public_id); res.end('{"result":"ok"}'); return;
      }
      if (url.pathname === '/resources/image/authenticated') {
        assert.equal(req.headers.authorization, 'Basic ' + Buffer.from(key + ':' + secret).toString('base64'));
        res.end(JSON.stringify({ resources: [...objects.keys()].map(public_id => ({ public_id, created_at: new Date().toISOString() })) })); return;
      }
      res.writeHead(404).end('{}');
    } catch (e) { res.writeHead(500).end('{}'); console.error('Cloudinary stub assertion:', e.message); }
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const saved = Object.fromEntries(['Tripora__Storage__Mode', 'Tripora__Storage__CloudName', 'Tripora__Storage__ApiKey', 'Tripora__Storage__ApiSecret', 'Tripora__Storage__TestUrl', 'Tripora__DatabaseProvider', 'Tripora__EnforceDataApiIsolation'].map(k => [k, env[k]]));
  try {
    await stopApi(); Object.assign(env, { Tripora__DatabaseProvider: 'Neon', Tripora__EnforceDataApiIsolation: 'true', Tripora__Storage__Mode: 'Cloudinary', Tripora__Storage__CloudName: 'synthetic', Tripora__Storage__ApiKey: key, Tripora__Storage__ApiSecret: secret,
      Tripora__Storage__TestUrl: 'http://127.0.0.1:' + upstream.address().port }); await startApi();
    const tripId = randomUUID(), id = randomUUID(), image = png(2, 2), sha256 = createHash('sha256').update(image).digest('hex');
    await request('/api/sync/push', tokenA, { operationId: randomUUID(), tripId, kind: 'trip.create', baseVersion: 0,
      data: { name: 'Private media fixture', destination: 'Synthetic island', startDate: '2026-11-01', endDate: '2026-11-03' } });
    const body = { id, tripId, pngBase64: image.toString('base64'), thumbnailBase64: image.toString('base64'), sha256, thumbnailSha256: sha256 };
    assert.equal((await request('/api/media/push', tokenA, body)).status, 500);
    assert.equal((await request('/api/media/push', tokenA, body)).status, 200);
    assert.equal((await request('/api/media/push', tokenA, body)).status, 200); assert.equal(objects.size, 2);
    assert.equal((await request('/api/media/' + id)).status, 401);
    assert.equal((await request('/api/media/' + id, tokenB)).status, 404);
    await stopApi(); await startApi();
    const read = await request('/api/media/' + id, tokenA); assert.equal(read.status, 200); assert.equal(read.data.base64, image.toString('base64')); assert.equal(read.data.sha256, sha256);
    pass('Cloudinary transport: SHA-256-signed authenticated uploads/downloads, interrupted retry, stable objects, exact bytes, access and restart');
    const memory = await request('/api/entries/push', tokenA, { operationId: randomUUID(), entryId: randomUUID(), tripId, feature: 'memory', kind: 'create', baseVersion: 0,
      data: { title: 'Synthetic memory', notes: '', mediaId: id, placeId: null } });
    assert.equal(memory.status, 200);
    await request('/api/entries/push', tokenA, { operationId: randomUUID(), entryId: memory.data.id, tripId, feature: 'memory', kind: 'delete', baseVersion: memory.data.version, data: null });
    failDelete = true; assert.equal((await request('/api/media/cleanup', tokenA, {})).status, 500);
    assert.equal((await request('/api/media/cleanup', tokenA, {})).status, 200); assert.equal(objects.size, 0);
    assert.equal((await request('/api/media/' + id, tokenA)).status, 404);
    pass('Cloudinary transport: confirmed media deletion retries safely and removes both authenticated originals');
  } finally {
    await stopApi(); for (const [k,v] of Object.entries(saved)) { if (v === undefined) delete env[k]; else env[k] = v; }
    await new Promise(resolve => upstream.close(resolve)); await startApi();
  }
}
