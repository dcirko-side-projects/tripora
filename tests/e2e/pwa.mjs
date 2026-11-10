// Real browser + durable SQLite snapshots/IndexedDB + real isolated PostgreSQL/API.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { createServer as createHttpServer, request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import EmbeddedPostgres from 'embedded-postgres';
import { stopPostgres } from './postgres-stop.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(join(root, 'apps/mobile/package.json'));
const { chromium, webkit } = require('playwright');
const { Resvg } = require('@resvg/resvg-js');
const syntheticPng = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320"><rect width="160" height="320" fill="#0593C6"/><circle cx="80" cy="80" r="40" fill="#D83995"/></svg>').render().asPng();
const syntheticPhotoPng = new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1600"><rect width="2400" height="1600" fill="#0593C6"/><circle cx="1200" cy="800" r="300" fill="#D83995"/></svg>').render().asPng();
const dataRoot = join(root, 'local-data');
await mkdir(dataRoot, { recursive: true });
const folder = await mkdtemp(join(dataRoot, 'pwa-test-'));
const artifacts = join(dataRoot, 'pwa-qa'); await mkdir(artifacts, { recursive: true });
const workerPath = join(root, 'apps/mobile/dist-web/sw.js'), originalWorker = await readFile(workerPath, 'utf8');
const port = await new Promise(ok => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => ok(port)); }); });
const password = randomBytes(24).toString('hex');
const pg = new EmbeddedPostgres({ databaseDir: join(folder, 'postgres'), user: 'tripora_test', password, port,
  authMethod: 'scram-sha-256', persistent: true, initdbFlags: ['--encoding=UTF8'], postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
const env = { ...process.env, ASPNETCORE_ENVIRONMENT: 'Testing', ASPNETCORE_URLS: 'http://127.0.0.1:0',
  ASPNETCORE_WEBROOT: join(root, 'apps/mobile/dist-web'), Tripora__HealthOnly: 'false', Tripora__RequireConfirmedEmail: 'false',
  Tripora__MediaRoot: join(folder, 'media'), Tripora__KeyRoot: join(folder, 'keys'),
  ConnectionStrings__Tripora: `Host=127.0.0.1;Port=${port};Database=tripora_test;Username=tripora_test;Password=${password}` };
const dll = join(root, 'services/api/bin/Release/net10.0/Tripora.Api.dll');
let started = false, server, browser, base, upstreamBase, proxy, checks = 0;
let dropNextUpload = false, uploadCalls = 0, acknowledgeLost, pauseApi = false;
let serverOutput = '';
const pass = message => { checks++; console.log('PASS ' + message); };
const watchdog = setTimeout(() => { console.error('PWA suite timeout'); process.exit(1); }, 240000);
async function api(path, token, body) {
  const response = await fetch((upstreamBase ?? base) + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await response.text();
  return { status: response.status, data: text ? JSON.parse(text) : null };
}
async function bootApi() {
  server = spawn('dotnet', [dll], { cwd: root, env, stdio: ['ignore','pipe','pipe'] });
  return new Promise((ok, fail) => {
    let output = ''; const timer = setTimeout(() => fail(Error('PWA API start timeout: ' + output)), 20000);
    const collect = data => { serverOutput = (serverOutput + data).slice(-20000); output = (output + data).slice(-5000); const found = output.match(/Now listening on: (http:\/\/127\.0\.0\.1:\d+)/); if (found) { clearTimeout(timer); ok(found[1]); } };
    server.stdout.on('data', collect); server.stderr.on('data', collect);
    server.once('error', fail); server.once('exit', code => { clearTimeout(timer); fail(Error('API exit ' + code + ': ' + output)); });
  });
}
try {
  await pg.initialise(); await pg.start(); started = true; await pg.createDatabase('tripora_test');
  await new Promise((ok, fail) => {
    const migration = spawn('dotnet', [dll, '--migrate'], { cwd: root, env, stdio: ['ignore','pipe','pipe'] });
    let output = ''; migration.stdout.on('data', d => output += d); migration.stderr.on('data', d => output += d);
    migration.once('error', fail); migration.once('exit', c => c === 0 ? ok() : fail(Error(output)));
  });
  upstreamBase = await bootApi();
  // Server-side network faults also affect WebKit requests controlled by a service
  // worker, which browser routing cannot reliably intercept. Never use this in production.
  proxy = createHttpServer((req, res) => {
    if (pauseApi && req.url.startsWith('/api/')) { req.socket.destroy(); return; }
    const upload = req.method === 'POST' && req.url === '/api/media/push';
    if (upload) uploadCalls++;
    const drop = upload && dropNextUpload; if (drop) dropNextUpload = false;
    const target = new URL(req.url, upstreamBase);
    const outgoing = httpRequest(target, { method: req.method, headers: { ...req.headers, host: target.host } }, response => {
      if (drop && response.statusCode === 200) {
        response.resume(); response.on('end', () => { req.socket.destroy(); acknowledgeLost?.(); });
      } else { res.writeHead(response.statusCode, response.headers); response.pipe(res); }
    });
    outgoing.on('error', () => res.destroy()); req.pipe(outgoing);
  });
  await new Promise(ok => proxy.listen(0, '127.0.0.1', ok));
  base = 'http://127.0.0.1:' + proxy.address().port;
  const home = await fetch(base); assert.equal(home.status, 200); assert.match(await home.text(), /manifest.webmanifest/);
  assert.equal(home.headers.get('cross-origin-embedder-policy'), 'require-corp');
  assert.match(home.headers.get('content-security-policy'), /script-src 'self' 'wasm-unsafe-eval'/);
  assert.equal((await fetch(base + '/auth/me')).status, 401);
  assert.match((await fetch(base + '/auth/me')).headers.get('cache-control'), /no-store/);
  assert.match((await fetch(base + '/manifest.webmanifest')).headers.get('content-type'), /manifest/);
  pass('same-origin app shell, manifest, security headers and anonymous API rejection');
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    if (process.env.TRIPORA_PWA_ENGINE && name !== process.env.TRIPORA_PWA_ENGINE) continue;
    const email = `pwa-${name}@example.test`, loginPassword = 'Qa!' + randomBytes(18).toString('hex') + 'Az1';
    assert.equal((await api('/auth/register', null, { email, password: loginPassword })).status, 200);
    const tokens = (await api('/auth/login?useCookies=false', null, { email, password: loginPassword })).data;
    // Use a persistent profile, as a regular/Home Screen user would.
    const context = await engine.launchPersistentContext(join(folder, 'browser-' + name), { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    browser = context.browser();
    let page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    if (process.env.TRIPORA_PWA_DEBUG) page.on('requestfailed', request => console.log(name + ' failed request: ' + new URL(request.url()).pathname + ' ' + request.failure()?.errorText));
    page.on('response', response => { if (response.status() >= 500) console.log(name + ' HTTP ' + response.status() + ' ' + new URL(response.url()).pathname); });
    if (process.env.TRIPORA_PWA_DEBUG) page.on('console', message => { if (['error', 'warning'].includes(message.type())) console.log(name + ' browser: ' + message.text().slice(0, 350)); });
    try {
      await page.goto(base);
      const capabilities = await page.evaluate(() => ({ secure: isSecureContext, isolated: crossOriginIsolated, shared: typeof SharedArrayBuffer, opfs: typeof navigator.storage?.getDirectory, locks: !!navigator.locks, indexedDB: !!window.indexedDB }));
      console.log(name + ' storage capabilities: ' + JSON.stringify(capabilities));
      await page.getByLabel('E-mail', { exact: true }).waitFor({ timeout: 25000 });
      assert.equal(await page.evaluate(() => crossOriginIsolated), true);
      await page.getByLabel('E-mail', { exact: true }).fill(email);
      await page.getByLabel('Lozinka', { exact: true }).fill(loginPassword);
      await page.getByRole('button', { name: 'Prijavi se', exact: true }).click();
      await page.getByRole('button', { name: 'Novo putovanje', exact: true }).waitFor();
      await page.evaluate(async () => { await navigator.serviceWorker.ready; });
      pass(name + ': actual SQLite bootstrap, persistent login and service worker installed');
      const second = await context.newPage(); await second.goto(base);
      await second.getByText('Tripora je već otvorena', { exact: false }).waitFor(); await second.close();
      pass(name + ': second tab cannot overwrite the active account database');
      await context.setOffline(true); await page.reload();
      await page.getByRole('button', { name: 'Novo putovanje', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Novo putovanje', exact: true }).click();
      await page.getByLabel('Naziv putovanja', { exact: true }).fill('PWA Offline ' + name);
      await page.getByLabel('Destinacija', { exact: true }).fill('Sintetički grad');
      await page.getByLabel('Početak putovanja', { exact: true }).fill('2027-06-01');
      await page.getByLabel('Završetak putovanja', { exact: true }).fill('2027-06-03');
      await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
          if (key.startsWith('tripora.db.v1.')) { Storage.prototype.setItem = original; throw new DOMException('Synthetic metadata quota', 'QuotaExceededError'); }
          return original.call(this, key, value);
        };
      });
      await page.getByRole('button', { name: 'Spremi putovanje', exact: true }).click();
      await page.getByRole('dialog').getByText('Nema dovoljno prostora na uređaju.', { exact: false }).waitFor();
      assert.equal(await page.getByLabel('Naziv putovanja', { exact: true }).inputValue(), 'PWA Offline ' + name);
      await page.getByRole('button', { name: 'Spremi putovanje', exact: true }).click();
      await page.getByRole('button', { name: /Otvori putovanje PWA Offline/ }).waitFor();
      await page.reload();
      await page.getByRole('button', { name: /PWA Offline/ }).waitFor();
      pass(name + ': offline shell/session reload, create and durable entity/outbox after reload');
      await context.setOffline(false);
      await page.getByRole('tab', { name: 'Sinkronizacija', exact: true }).click();
      await page.getByRole('button', { name: 'Sinkroniziraj', exact: true }).click();
      await page.getByText('0 na čekanju', { exact: true }).waitFor();
      const pull = await api('/api/sync/pull', tokens.accessToken);
      assert.equal(pull.data.items.filter(t => t.name === 'PWA Offline ' + name).length, 1);
      pass(name + ': real API sends persisted offline mutation exactly once');
      const savedTrip = pull.data.items.find(t => t.name === 'PWA Offline ' + name);
      await context.setOffline(true);
      await page.reload();
      await page.getByRole('button', { name: /Otvori putovanje PWA Offline/ }).click();
      await page.getByRole('button', { name: 'Uspomene', exact: true }).click();
      await page.getByRole('button', { name: 'Dodaj uspomenu', exact: true }).click();
      await page.getByLabel('Naslov uspomene', { exact: true }).fill('Synthetic offline photo');
      const badPicker = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Dodaj fotografiju', exact: true }).click();
      await (await badPicker).setFiles({ name: 'unsupported.heic', mimeType: 'image/heic', buffer: Buffer.from('synthetic invalid HEIC') });
      await page.getByRole('dialog').getByText('Preglednik ne može otvoriti ovu fotografiju.', { exact: false }).waitFor();
      assert.equal(await page.getByLabel('Naslov uspomene', { exact: true }).inputValue(), 'Synthetic offline photo');
      // Fail the second IndexedDB write: the first full PNG must roll back too.
      await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put; let calls = 0;
        IDBObjectStore.prototype.put = function(...args) {
          if (this.name === 'media' && ++calls === 2) { IDBObjectStore.prototype.put = original; throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); }
          return original.apply(this, args);
        };
      });
      const fullPicker = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Dodaj fotografiju', exact: true }).click();
      await (await fullPicker).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: syntheticPhotoPng });
      await page.getByRole('dialog').getByText('Nema dovoljno prostora na uređaju.', { exact: false }).waitFor();
      assert.equal(await page.getByLabel('Naslov uspomene', { exact: true }).inputValue(), 'Synthetic offline photo');
      pass(name + ': unsupported image and simulated second-file quota failure preserve the text draft');
      const picker = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Dodaj fotografiju', exact: true }).click();
      await (await picker).setFiles({ name: 'synthetic.png', mimeType: 'image/png', buffer: syntheticPhotoPng });
      await page.getByRole('img', { name: 'Odabrana fotografija uspomene', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Spremi uspomenu', exact: true }).click();
      await page.getByRole('button', { name: 'Otvori uspomenu Synthetic offline photo', exact: true }).waitFor();
      await page.reload();
      await page.getByRole('button', { name: /Otvori putovanje PWA Offline/ }).click();
      await page.getByRole('button', { name: 'Uspomene', exact: true }).click();
      await page.getByRole('button', { name: 'Otvori uspomenu Synthetic offline photo', exact: true }).click();
      await page.getByRole('img', { name: 'Fotografija uspomene', exact: true }).waitFor();
      const blobs = await page.evaluate(async () => {
        const db = await new Promise((ok, fail) => { const request = indexedDB.open('tripora-web-v1'); request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error); });
        const values = await new Promise((ok, fail) => { const request = db.transaction('media').objectStore('media').getAll(); request.onsuccess = () => ok(request.result); request.onerror = () => fail(request.error); });
        db.close(); return await Promise.all(values.map(async blob => { const header = new DataView(await blob.slice(0,24).arrayBuffer()); return { size: blob.size, type: blob.type, width: header.getUint32(16), height: header.getUint32(20) }; }));
      });
      assert.equal(blobs.length, 2); assert.ok(blobs.every(blob => blob.size > 0 && blob.type === 'image/png'));
      assert.deepEqual(blobs.map(blob => blob.width).sort((a,b) => a-b), [320,1280]);
      assert.ok(blobs.every(blob => blob.height <= blob.width));
      await page.waitForFunction(() => Array.from(document.images).some(image => image.complete && image.naturalWidth === 1280));
      pass(name + ': actual gallery file, durable IndexedDB PNG/thumbnail and offline full-image reload');
      uploadCalls = 0; dropNextUpload = true;
      const lostAcknowledgement = new Promise(ok => acknowledgeLost = ok);
      await context.setOffline(false); await page.reload();
      await Promise.race([lostAcknowledgement, new Promise((_, fail) => { const timeout = setTimeout(() => fail(Error('Upload lost-ack fixture was not reached')), 25000); timeout.unref(); })]);
      await page.reload();
      await page.getByRole('tab', { name: 'Sinkronizacija', exact: true }).click();
      await page.getByRole('button', { name: 'Sinkroniziraj', exact: true }).click();
      await page.getByText('0 na čekanju', { exact: true }).waitFor();
      const entries = await api('/api/entries/pull', tokens.accessToken);
      const memory = entries.data.items.find(e => e.tripId === savedTrip.id && e.feature === 'memory');
      assert.ok(memory?.data.mediaId);
      const image = await api('/api/media/' + memory.data.mediaId, tokens.accessToken);
      assert.equal(image.status, 200); assert.match(image.data.sha256, /^[a-f0-9]{64}$/i);
      assert.equal((await api('/api/media/' + memory.data.mediaId)).status, 401);
      assert.ok(uploadCalls >= 2); assert.equal(entries.data.items.filter(e => e.tripId === savedTrip.id && e.feature === 'memory').length, 1);
      pass(name + ': photo upload lost acknowledgement survives reload/retry without duplicate memory; anonymous photo denied');

      // Competing real server edit while this browser edits the old version offline.
      await context.setOffline(true); await page.reload();
      await page.getByRole('button', { name: /Otvori putovanje PWA Offline/ }).click();
      await page.getByRole('tab', { name: 'Više', exact: true }).click();
      await page.getByRole('button', { name: 'Postavke putovanja', exact: true }).click();
      await page.getByRole('button', { name: 'Uredi putovanje', exact: true }).click();
      await page.getByLabel('Naziv putovanja', { exact: true }).fill('PWA local conflict ' + name);
      await page.getByRole('button', { name: 'Spremi putovanje', exact: true }).click();
      assert.equal((await api('/api/sync/push', tokens.accessToken, { operationId: randomUUID(), tripId: savedTrip.id, kind: 'trip.update', baseVersion: savedTrip.version, data: { ...savedTrip, name: 'PWA remote conflict ' + name } })).status, 200);
      await context.setOffline(false); await page.reload();
      await page.getByRole('tab', { name: 'Sinkronizacija', exact: true }).click();
      await page.getByRole('button', { name: 'Sinkroniziraj', exact: true }).click();
      await page.getByText('Sukob promjena', { exact: true }).waitFor();
      await page.reload();
      await page.getByRole('tab', { name: 'Sinkronizacija', exact: true }).click();
      await page.getByRole('button', { name: 'Zadrži moju promjenu', exact: true }).click();
      await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Odustani', exact: true }).click();
      await page.getByText('Sukob promjena', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Zadrži moju promjenu', exact: true }).click();
      await page.getByRole('button', { name: 'Potvrdi', exact: true }).click();
      await page.getByText('0 na čekanju', { exact: true }).waitFor();
      assert.equal((await api('/api/sync/pull', tokens.accessToken)).data.items.find(t => t.id === savedTrip.id).name, 'PWA local conflict ' + name);
      pass(name + ': real conflicting server edit survives reload; cancel retains conflict and explicit local choice converges');
      const placeId = randomUUID();
      assert.equal((await api('/api/places/push', tokens.accessToken, { operationId: randomUUID(), tripId: savedTrip.id, placeId, kind: 'place.create', baseVersion: 0,
        data: { category: 'place', name: 'Synthetic marker', notes: '', address: '', link: '', visited: false,
          location: { latitude: 45.8, longitude: 16, displayName: 'Synthetic marker', provider: 'osm', providerId: 'N999' } } })).status, 200);
      // Render real Leaflet controls/markers using synthetic tiles; no external service calls.
      await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png',
        headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' }, body: syntheticPng }));
      await page.reload();
      await page.getByRole('button', { name: 'Otvori putovanje PWA local conflict ' + name, exact: true }).click();
      await page.getByRole('tab', { name: 'Mjesta', exact: true }).click();
      await page.getByRole('button', { name: 'Otvori mjesto Synthetic marker', exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Karta', exact: true }).click();
      await page.getByRole('region', { name: 'Karta spremljenih mjesta', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 0);
      await page.getByRole('button', { name: 'Otvori kartu preko cijelog zaslona', exact: true }).click();
      assert.equal(await page.getByRole('region', { name: 'Karta spremljenih mjesta', exact: true }).count(), 1);
      await page.locator('.leaflet-marker-icon').click();
      await page.getByRole('heading', { name: 'Detalji mjesta', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Zatvori kartu', exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Zatvori obrazac', exact: true }).click();
      await page.getByRole('button', { name: 'Zatvori kartu', exact: true }).waitFor();
      assert.equal(await page.getByRole('region', { name: 'Karta spremljenih mjesta', exact: true }).count(), 1);
      assert.equal(await page.locator('.leaflet-marker-icon').innerText(), 'M\u00b7SM');
      const markerPosition = () => page.locator('.leaflet-marker-icon').getAttribute('style');
      const beforeDetails = await markerPosition();
      await page.locator('.leaflet-marker-icon').click();
      await page.getByRole('heading', { name: 'Detalji mjesta', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Uredi mjesto', exact: true }).click();
      await page.getByRole('heading', { name: 'Uredi mjesto', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Zatvori obrazac', exact: true }).click();
      assert.equal(await markerPosition(), beforeDetails);
      await page.getByLabel('Filtriraj grad, naziv ili adresu', { exact: true }).fill('no synthetic match');
      assert.equal(await page.locator('.leaflet-marker-icon').count(), 0);
      await page.getByRole('button', { name: 'Zatvori kartu', exact: true }).waitFor();
      await page.getByLabel('Filtriraj grad, naziv ili adresu', { exact: true }).fill('Synthetic marker');
      await page.locator('.leaflet-marker-icon').waitFor();
      pass(name + ': actual Leaflet map/tiles, retained fullscreen/viewport after details/edit, category initials and live filters');
      await page.getByRole('button', { name: 'Zatvori kartu', exact: true }).click();
      await context.setOffline(true); await page.reload();
      await page.getByRole('button', { name: 'Otvori putovanje PWA local conflict ' + name, exact: true }).click();
      await page.getByRole('tab', { name: 'Mjesta', exact: true }).click();
      await page.getByRole('button', { name: 'Otvori mjesto Synthetic marker', exact: true }).click();
      await page.getByRole('button', { name: 'Obriši mjesto', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Obriši mjesto', exact: true }).click();
      await page.reload();
      await page.getByRole('tab', { name: 'Račun', exact: true }).click();
      await page.getByRole('button', { name: 'Odjava', exact: true }).click();
      await page.getByRole('button', { name: 'Odjavi se i sačuvaj podatke', exact: true }).click();
      await page.getByLabel('E-mail', { exact: true }).waitFor();
      const otherEmail = `pwa-other-${name}@example.test`;
      assert.equal((await api('/auth/register', null, { email: otherEmail, password: loginPassword })).status, 200);
      await context.setOffline(false);
      await page.getByLabel('E-mail', { exact: true }).fill(otherEmail);
      await page.getByLabel('Lozinka', { exact: true }).fill(loginPassword);
      await page.getByRole('button', { name: 'Prijavi se', exact: true }).click();
      await page.getByRole('button', { name: 'Novo putovanje', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: /Otvori putovanje PWA/ }).count(), 0);
      await page.getByRole('tab', { name: 'Račun', exact: true }).click();
      await page.getByRole('button', { name: 'Odjava', exact: true }).click();
      await page.getByRole('button', { name: 'Odjavi se i sačuvaj podatke', exact: true }).click();
      await page.getByLabel('E-mail', { exact: true }).fill(email);
      await page.getByLabel('Lozinka', { exact: true }).fill(loginPassword);
      await page.getByRole('button', { name: 'Prijavi se', exact: true }).click();
      await page.getByRole('tab', { name: 'Sinkronizacija', exact: true }).click();
      await page.getByRole('button', { name: 'Sinkroniziraj', exact: true }).click();
      await page.getByText('0 na čekanju', { exact: true }).waitFor();
      assert.equal((await api('/api/places/pull', tokens.accessToken)).data.items.find(p => p.id === placeId).deleted, true);
      pass(name + ': offline deletion survives logout/account switch; second account is isolated and original tombstone syncs');

      await context.setOffline(true);
      await page.getByRole('tab', { name: 'Putovanja', exact: true }).click();
      await page.getByRole('button', { name: 'Novo putovanje', exact: true }).click();
      await page.getByLabel('Naziv putovanja', { exact: true }).fill('PWA pending update');
      await page.getByLabel('Destinacija', { exact: true }).fill('Synthetic update town');
      await page.getByLabel('Početak putovanja', { exact: true }).fill('2027-07-01');
      await page.getByLabel('Završetak putovanja', { exact: true }).fill('2027-07-02');
      await page.getByRole('button', { name: 'Spremi putovanje', exact: true }).click();
      await page.getByRole('button', { name: 'Otvori putovanje PWA pending update', exact: true }).waitFor();
      pauseApi = true;
      await context.setOffline(false);
      await page.getByRole('button', { name: 'Novo putovanje', exact: true }).click();
      await page.getByLabel('Naziv putovanja', { exact: true }).fill('Keep unsaved draft through update');
      await writeFile(workerPath, originalWorker.replace(/tripora-shell-[a-f0-9]+/, 'tripora-shell-qa-' + randomBytes(8).toString('hex')));
      await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
      await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
      assert.equal(await page.getByLabel('Naziv putovanja', { exact: true }).inputValue(), 'Keep unsaved draft through update');
      await page.close(); page = await context.newPage(); await page.goto(base);
      await page.getByRole('button', { name: 'Otvori putovanje PWA local conflict ' + name, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Otvori putovanje PWA pending update', exact: true }).waitFor();
      assert.equal((await api('/api/sync/pull', tokens.accessToken)).data.items.filter(t => t.name === 'PWA pending update').length, 0);
      await page.waitForFunction(async () => (await caches.keys()).filter(key => key.startsWith('tripora-shell-')).length === 1);
      await writeFile(workerPath, originalWorker);
      pauseApi = false;
      await page.getByRole('tab', { name: 'Sinkronizacija', exact: true }).click();
      await page.getByRole('button', { name: 'Sinkroniziraj', exact: true }).click();
      await page.getByText('0 na čekanju', { exact: true }).waitFor();
      assert.equal((await api('/api/sync/pull', tokens.accessToken)).data.items.filter(t => t.name === 'PWA pending update').length, 1);
      await page.getByRole('tab', { name: 'Putovanja', exact: true }).click();
      await page.getByRole('button', { name: 'Otvori putovanje PWA local conflict ' + name, exact: true }).click();
      await page.getByRole('button', { name: 'Uspomene', exact: true }).click();
      await page.getByRole('button', { name: 'Otvori uspomenu Synthetic offline photo', exact: true }).click();
      await page.getByRole('img', { name: 'Fotografija uspomene', exact: true }).waitFor();
      await page.waitForFunction(() => Array.from(document.images).some(image => image.complete && image.naturalWidth === 1280));
      pass(name + ': update preserves active draft and persisted outbox; new shell restores session and sends queued trip exactly once');
      const keys = await page.evaluate(async () => {
        const urls = []; for (const name of await caches.keys()) { for (const request of await (await caches.open(name)).keys()) urls.push(request.url); } return urls;
      });
      assert.ok(keys.some(url => url.endsWith('.wasm')));
      assert.ok(keys.every(url => !/\/(auth|api)\//.test(url)));
      assert.deepEqual(errors, []);
      pass(name + ': only public app assets cached; no uncaught runtime errors');
      await page.screenshot({ path: join(artifacts, name + '.png'), fullPage: true });
    } catch (error) {
      await page.screenshot({ path: join(artifacts, name + '-failure.png'), fullPage: true }).catch(() => {});
      await writeFile(join(artifacts, name + '-failure.txt'), await page.locator('body').innerText().catch(() => 'no body'));
      await writeFile(join(artifacts, name + '-server.log'), serverOutput);
      console.error(name + ' runtime errors:', errors); throw error;
    } finally { await context.close(); await browser.close(); browser = undefined; }
  }
  console.log(`ALL ${checks} PWA scenarios passed.`);
} finally {
  await writeFile(workerPath, originalWorker);
  clearTimeout(watchdog); await browser?.close();
  if (proxy) { proxy.closeAllConnections(); await new Promise(ok => proxy.close(ok)); }
  if (server && server.exitCode === null) await new Promise(ok => { server.once('exit', ok); server.kill(); });
  if (started) await stopPostgres(pg, join(folder, 'postgres'));
  if (resolve(folder).startsWith(resolve(dataRoot) + sep)) await rm(folder, { recursive: true, force: true });
}
