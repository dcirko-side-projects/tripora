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
let interceptCleanup;
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
    if (interceptCleanup && req.url === '/api/media/cleanup') {
      const finish = () => {
        if (res.writableEnded) return;
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'synthetic_cleanup_failure' }));
      };
      interceptCleanup(finish); interceptCleanup = undefined;
      setTimeout(finish, 45000).unref();
      return;
    }
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
  assert.match(home.headers.get('permissions-policy'), /geolocation=\(self\)/);
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
    await context.addInitScript(() => {
      let watched;
      window.triporaTestGps = {
        requests: 0, stopped: 0,
        give(latitude, longitude) { watched?.success({ coords: { latitude, longitude } }); },
        fail(code) { watched?.failure({ code }); },
      };
      Object.defineProperty(navigator, 'geolocation', { value: {
        watchPosition(success, failure) {
          watched = { success, failure };
          return ++window.triporaTestGps.requests;
        },
        clearWatch() { watched = undefined; window.triporaTestGps.stopped++; },
      } });
    });
    browser = context.browser();
    let page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
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
      await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active));
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
      const openOfflineTrip = () => page.getByRole('button', { name: /Otvori putovanje PWA Offline/ }).click();
      await openOfflineTrip();
      await page.getByRole('tab', { name: 'Više', exact: true }).click();
      await page.getByRole('button', { name: 'Postavke putovanja', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Obriši putovanje', exact: true }).isEnabled(), true);
      await page.getByRole('button', { name: 'Uredi putovanje', exact: true }).click();
      await page.getByLabel('Destinacija', { exact: true }).fill('Ispravljena sintetička destinacija');
      await page.getByRole('button', { name: 'Spremi putovanje', exact: true }).click();
      await page.reload();
      await page.getByRole('button', { name: /PWA Offline/ }).waitFor();
      pass(name + ': offline shell/session reload, create, edit and durable entity/outbox');
      let cleanupHeld = false;
      const cleanupStarted = new Promise(resolve => {
        interceptCleanup = finish => { cleanupHeld = true; resolve(finish); };
      });
      await context.setOffline(false);
      await page.getByRole('tab', { name: 'Sinkronizacija', exact: true }).click();
      const syncButton = page.getByRole('button', { name: 'Sinkroniziraj', exact: true });
      if (await syncButton.isEnabled()) {
        try { await syncButton.click({ timeout: 3000 }); }
        catch (error) { if (!cleanupHeld) throw error; }
      }
      const finishCleanup = await cleanupStarted;
      await page.getByText('0 na čekanju', { exact: true }).waitFor();
      const pull = await api('/api/sync/pull', tokens.accessToken);
      assert.equal(pull.data.items.filter(t => t.name === 'PWA Offline ' + name).length, 1);
      const savedTrip = pull.data.items.find(t => t.name === 'PWA Offline ' + name);
      assert.equal(savedTrip.destination, 'Ispravljena sintetička destinacija');
      pass(name + ': real API applies the persisted immutable create and follow-up edit to one trip');
      await page.getByRole('tab', { name: 'Putovanja', exact: true }).click();
      await openOfflineTrip();
      await page.getByText('Zadnje preuzimanje podataka:', { exact: false }).waitFor();
      await page.getByRole('button', { name: 'Preuzimanje i sinkronizacija…', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Uspomene', exact: true }).click();
      await page.getByRole('button', { name: 'Dodaj uspomenu', exact: true }).click();
      const duringSync = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Dodaj fotografiju', exact: true }).click();
      await (await duringSync).setFiles([]);
      await page.getByRole('button', { name: 'Zatvori obrazac', exact: true }).click();
      await page.getByRole('tab', { name: 'Više', exact: true }).click();
      await page.getByRole('button', { name: 'Sudionici', exact: true }).click();
      await page.getByText('Učitaj sudionike', { exact: true }).waitFor();
      finishCleanup();
      await page.getByText('Članovi · 0', { exact: true }).waitFor();
      await page.getByRole('tab', { name: 'Pregled', exact: true }).click();
      await page.getByText('Zadnje preuzimanje podataka:', { exact: false }).waitFor();
      await page.getByText('Podaci su preuzeti. Čišćenje fotografija čeka ponovni pokušaj.', { exact: true }).waitFor();
      pass(name + ': offline readiness and local photo picker work during stalled cleanup; member roster resumes automatically');
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
      // The outbox can reach zero before the last metadata pull finishes.
      await page.getByText('Sinkroniziram…', { exact: true }).waitFor({ state: 'hidden' });
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
      for (const [category, label, latitude, providerId] of [
        ['food', 'Synthetic dining', 45.801, 'N1000'],
        ['nightlife', 'Synthetic evening', 45.799, 'N1001'],
        ['accommodation', 'Synthetic hotel', 45.82, 'N1002'],
      ]) {
        assert.equal((await api('/api/places/push', tokens.accessToken, { operationId: randomUUID(), tripId: savedTrip.id, placeId: randomUUID(), kind: 'place.create', baseVersion: 0,
          data: { category, name: label, notes: '', address: '', link: '', visited: false,
            location: { latitude, longitude: 16.002, displayName: label, provider: 'osm', providerId } } })).status, 200);
      }
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
      assert.equal(await page.getByTestId('fullscreen-map-frame').evaluate(element => element.style.paddingTop), 'env(safe-area-inset-top, 0px)', 'CSS safe-area padding survives native/web style adapters');
      assert.deepEqual((await page.locator('.leaflet-marker-icon [data-icon]').evaluateAll(nodes => nodes.map(n => n.dataset.icon))).sort(), ['bed', 'food', 'nightlife', 'pin']);
      for (const [category, icon, label] of [
        ['Hrana', 'food', 'Hrana: Synthetic dining'],
        ['Izlasci', 'nightlife', 'Izlasci: Synthetic evening'],
        ['Smještaj', 'bed', 'Smještaj: Synthetic hotel'],
      ]) {
        await page.getByLabel('Kategorije mjesta', { exact: true }).getByRole('tab', { name: category, exact: true }).click();
        assert.equal(await page.locator('.leaflet-marker-icon [data-icon]').getAttribute('data-icon'), icon);
        await page.getByRole('button', { name: label, exact: true }).press(icon === 'food' ? 'Enter' : 'Space');
        await page.getByRole('heading', { name: 'Detalji mjesta', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Zatvori obrazac', exact: true }).click();
        assert.equal(await page.locator('.leaflet-marker-icon').getAttribute('aria-pressed'), 'true');
      }
      await page.getByLabel('Kategorije mjesta', { exact: true }).getByRole('tab', { name: 'Sve kategorije', exact: true }).click();
      assert.equal(await page.locator('.leaflet-marker-icon[aria-pressed="true"]').count(), 1);
      await page.screenshot({ path: join(artifacts, name + '-marker-icons.png') });
      await page.getByLabel('Pretraži spremljena mjesta', { exact: true }).fill('Synthetic marker');
      for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(size);
        const search = page.getByRole('textbox', { name: 'Pretraži spremljena mjesta', exact: true });
        const close = page.getByRole('button', { name: 'Zatvori kartu', exact: true });
        await search.waitFor();
        await page.waitForTimeout(150); // Leaflet ResizeObserver and RN layout settle.
        const mapBox = await page.getByRole('region', { name: 'Karta spremljenih mjesta', exact: true }).boundingBox();
        const searchBox = await search.boundingBox(), closeBox = await close.boundingBox();
        assert.ok(mapBox.height >= size.height * 0.8, 'map fills at least 80% of the viewport');
        assert.ok(searchBox.x + searchBox.width <= closeBox.x, 'search and close never overlap');
        assert.ok(closeBox.width >= 44 && closeBox.height >= 44, 'accessible close target');
        assert.equal(await close.innerText(), '', 'close has only an icon');
        if (size.width === 320) {
          const categoryRow = page.getByLabel('Kategorije mjesta', { exact: true });
          const row = await categoryRow.boundingBox();
          for (const category of await categoryRow.getByRole('tab').all()) {
            const box = await category.boundingBox();
            assert.ok(box.x >= row.x - 1 && box.x + box.width <= row.x + row.width + 1,
              `category fits on screen at 320px: ${await category.getAttribute('aria-label')} ${JSON.stringify({ row, box })}`);
          }
        }
        for (const title of ['Sve kategorije', 'Mjesta', 'Hrana', 'Izlasci', 'Smještaj', 'Sve', 'Za posjetiti', 'Posjećeno']) {
          const group = ['Sve kategorije', 'Mjesta', 'Hrana', 'Izlasci', 'Smještaj'].includes(title) ? 'Kategorije mjesta' : 'Status posjeta';
          const tab = page.getByLabel(group, { exact: true }).getByRole('tab', { name: title, exact: true });
          await tab.scrollIntoViewIfNeeded();
          const box = await tab.boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= size.width + 1 && box.y >= mapBox.y && box.y + box.height <= size.height - 20, 'filters fit within safe map area: ' + title);
        }
        await page.screenshot({ path: join(artifacts, `${name}-map-${size.width}x${size.height}.png`) });
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('tab', { name: 'Hrana', exact: true }).click();
      assert.equal(await page.locator('.leaflet-marker-icon').count(), 0);
      await page.getByRole('tab', { name: 'Sve kategorije', exact: true }).click();
      await page.getByRole('tab', { name: 'Posjećeno', exact: true }).click();
      assert.equal(await page.locator('.leaflet-marker-icon').count(), 0);
      await page.getByRole('tab', { name: 'Sve', exact: true }).click();
      await page.locator('.leaflet-marker-icon').waitFor();
      await page.locator('.leaflet-marker-icon').click();
      await page.getByRole('heading', { name: 'Detalji mjesta', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Zatvori kartu', exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Zatvori obrazac', exact: true }).click();
      await page.getByRole('button', { name: 'Zatvori kartu', exact: true }).waitFor();
      assert.equal(await page.getByRole('region', { name: 'Karta spremljenih mjesta', exact: true }).count(), 1);
      assert.equal(await page.locator('.leaflet-marker-icon').innerText(), '');
      assert.equal(await page.locator('.leaflet-marker-icon [data-icon]').getAttribute('data-icon'), 'pin');
      assert.equal(await page.locator('.leaflet-marker-icon svg').count(), 1);
      assert.equal(await page.locator('.leaflet-marker-icon').getAttribute('aria-pressed'), 'true');
      const markerPosition = () => page.locator('.leaflet-marker-icon').getAttribute('style');
      const beforeDetails = await markerPosition();
      const mapMarker = page.locator('.leaflet-marker-icon');
      await mapMarker.focus();
      await page.keyboard.press('Enter');
      const details = page.getByRole('dialog', { name: 'Detalji mjesta', exact: true });
      await details.waitFor();
      assert.equal(await details.evaluate(node => node.contains(document.activeElement)), true);
      await page.keyboard.press('Shift+Tab');
      assert.equal(await details.evaluate(node => node.contains(document.activeElement)), true);
      await details.getByRole('button', { name: 'Zatvori obrazac', exact: true }).click();
      assert.equal(await mapMarker.evaluate(node => node === document.activeElement), true);
      await page.locator('.leaflet-marker-icon').click();
      await page.getByRole('heading', { name: 'Detalji mjesta', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Uredi mjesto', exact: true }).click();
      await page.getByRole('heading', { name: 'Uredi mjesto', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Zatvori obrazac', exact: true }).click();
      assert.equal(await markerPosition(), beforeDetails);
      await page.getByLabel('Pretraži spremljena mjesta', { exact: true }).fill('no synthetic match');
      assert.equal(await page.locator('.leaflet-marker-icon').count(), 0);
      await page.getByRole('button', { name: 'Zatvori kartu', exact: true }).waitFor();
      await page.getByLabel('Pretraži spremljena mjesta', { exact: true }).fill('Synthetic marker');
      await page.locator('.leaflet-marker-icon').waitFor();
      const locate = page.getByRole('button', { name: 'Centriraj na moju lokaciju', exact: true });
      assert.equal(await page.evaluate(() => window.triporaTestGps.requests), 0);
      await locate.click();
      await page.evaluate(() => window.triporaTestGps.fail(1));
      await page.getByText(/Dozvola za lokaciju je odbijena/).waitFor();
      await locate.click();
      await page.evaluate(() => window.triporaTestGps.fail(2));
      await page.getByText(/Lokacija nije dostupna/).waitFor();
      await locate.click();
      await page.evaluate(() => window.triporaTestGps.give(45.81, 15.98));
      const dot = page.locator('.tripora-current-location');
      await dot.waitFor();
      const markerBox = () => mapMarker.evaluate(node => {
        const { x, y } = node.getBoundingClientRect();
        return { x, y };
      });
      const beforeMove = await markerBox();
      const beforeDot = await dot.getAttribute('d');
      await page.evaluate(() => window.triporaTestGps.give(45.82, 15.99));
      await page.waitForFunction(path => {
        const marker = document.querySelector('.tripora-current-location');
        return marker && marker.getAttribute('d') !== path;
      }, beforeDot);
      assert.deepEqual(await markerBox(), beforeMove);
      await locate.click();
      await page.waitForFunction(({ x, y }) => {
        const position = document.querySelector('.leaflet-marker-icon')?.getBoundingClientRect();
        return position && (Math.abs(position.x - x) > 10 || Math.abs(position.y - y) > 10);
      }, beforeMove);
      pass(name + ': location asks on tap, handles denial and unavailability, updates marker without moving the camera');
      pass(name + ': actual Leaflet map/tiles, retained fullscreen/viewport after details/edit, category icons/selection and live filters');
      await page.getByRole('button', { name: 'Zatvori kartu', exact: true }).click();
      const click = (title, scope = page) => scope.getByRole('button', { name: title, exact: true }).click();
      const tab = title => page.getByRole('tab', { name: title, exact: true }).click();
      async function downloadPlaces(title, kind, expected) {
        await click(title);
        for (const [label, extension] of [['Izvezi popis (JSON)', '.json'], ['Izvezi oznake karte (GeoJSON)', '.geojson'], ['Izvezi GeoJSON bez bilješki', '-bez-biljeski.geojson']]) {
          const [download] = await Promise.all([page.waitForEvent('download'), click(label)]);
          assert.ok(download.suggestedFilename().endsWith(extension));
          const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
          assert.equal(exported.scope.kind, kind);
          const names = exported.features?.map(feature => feature.properties.name) ?? exported.places.map(place => place.name);
          assert.deepEqual(names.sort(), [...expected].sort());
          if (extension.startsWith('-bez-biljeski')) {
            assert.ok(exported.features.every(({ properties }) => !('notes' in properties) && properties.plan.every(visit => !('notes' in visit))));
          }
        }
        const [csv] = await Promise.all([page.waitForEvent('download'), click('Izvezi CSV za Google My Maps')]);
        assert.ok(csv.suggestedFilename().endsWith('.csv'));
        const contents = await readFile(await csv.path(), 'utf8');
        assert.match(contents, /^Name,Location\r\n/);
        assert.ok(expected.every(item => contents.includes(item)));
        if (kind === 'day') {
          // Intercept browser handoff so the test never sends synthetic place data outside the local browser.
          await page.evaluate(() => { window.open = url => { window.triporaTestMapsUrl = String(url); return null; }; });
          await click('Otvori u Google Mapsu');
          assert.equal(new URL(await page.evaluate(() => window.triporaTestMapsUrl)).hostname, 'www.google.com');
          await click('Otvori u Apple Mapsu');
          assert.equal(new URL(await page.evaluate(() => window.triporaTestMapsUrl)).pathname, '/directions');
        }
        await click('Zatvori obrazac');
      }
      const allSaved = ['Synthetic dining', 'Synthetic evening', 'Synthetic hotel', 'Synthetic marker'];
      await downloadPlaces('Izvezi mjesta putovanja', 'trip', allSaved);
      await tab('Plan');
      assert.equal(await page.evaluate(() => window.triporaTestGps.stopped), 3);
      for (const date of ['Dan 1. 6. 2027.', 'Dan 2. 6. 2027.']) {
        await tab(date);
        await click('Dodaj spremljeno mjesto');
        await page.getByRole('textbox', { name: 'Pretraži mjesta za dodavanje', exact: true }).fill('synthetic hotel');
        assert.equal(await page.getByRole('button', { name: 'Synthetic dining', exact: true }).count(), 0);
        await click('Synthetic hotel');
        const row = page.getByRole('button', { name: 'Otvori aktivnost Synthetic hotel', exact: true });
        await row.getByText('Smještaj', { exact: true }).waitFor();
        assert.equal(await row.locator('svg path[d^="M3 18V5"]').count(), 1);
      }
      await click('Dodaj spremljeno mjesto');
      await click('Synthetic dining');
      await downloadPlaces('Izvezi mjesta za odabrani dan', 'day', ['Synthetic dining', 'Synthetic hotel']);
      await tab('Karta plana');
      await page.getByRole('button', { name: 'Smještaj: Synthetic hotel', exact: true }).waitFor();
      assert.equal(await page.locator('.leaflet-marker-icon').count(), 2);
      await locate.click();
      await page.evaluate(() => window.triporaTestGps.give(45.81, 15.98));
      await dot.waitFor();
      await downloadPlaces('Izvezi mjesta iz plana', 'plan', ['Synthetic dining', 'Synthetic hotel']);
      await click('Otvori kartu preko cijelog zaslona');
      await tab('1. 6. 2027.');
      assert.equal(await page.locator('.leaflet-marker-icon').count(), 1);
      await click('Smještaj: Synthetic hotel');
      await page.getByRole('heading', { name: 'Detalji mjesta', exact: true }).waitFor();
      await click('Zatvori obrazac');
      await page.setViewportSize({ width: 320, height: 568 });
      await tab('2. 6. 2027.');
      assert.equal(await page.locator('.leaflet-marker-icon').count(), 2);
      const planMap = await page.getByRole('region', { name: 'Karta spremljenih mjesta', exact: true }).boundingBox();
      assert.ok(planMap.width <= 320 && planMap.height >= 450);
      const filterRow = await page.getByLabel('Dani na karti plana', { exact: true }).boundingBox();
      for (const marker of await page.locator('.leaflet-marker-icon').all()) {
        const box = await marker.boundingBox();
        assert.ok(box.y >= planMap.y && box.y + box.height <= filterRow.y, 'both markers fit above the filters');
      }
      await page.screenshot({ path: join(artifacts, name + '-plan-map.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      await click('Zatvori kartu');
      await tab('Raspored');
      await tab('Dan 1. 6. 2027.');
      await click('Otvori aktivnost Synthetic hotel');
      await click('Ukloni iz rasporeda');
      await click('Ukloni iz rasporeda', page.getByRole('alertdialog'));
      // The underlying schedule is hidden from role queries until the activity sheet closes.
      await page.getByRole('heading', { name: 'Aktivnost', exact: true, includeHidden: true }).waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Otvori aktivnost Synthetic hotel', exact: true }).waitFor({ state: 'detached' });
      await tab('Dan 2. 6. 2027.');
      await page.getByText('2. 6. 2027.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Otvori aktivnost Synthetic hotel', exact: true }).waitFor();
      await tab('Pregled');
      const coverImage = () => page.getByRole('img', { name: 'Naslovna fotografija putovanja' });
      async function chooseCover(title, png) {
        const choosing = page.waitForEvent('filechooser');
        await click(title);
        await (await choosing).setFiles({ name: 'synthetic-cover.png', mimeType: 'image/png', buffer: png });
        await coverImage().waitFor();
        await page.getByRole('button', { name: 'Ukloni naslovnu fotografiju', exact: true }).waitFor();
      }
      await chooseCover('Dodaj naslovnu fotografiju', syntheticPhotoPng);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 844 });
        const image = await coverImage().boundingBox();
        const title = await page.getByRole('heading', { name: 'PWA local conflict ' + name, exact: true }).boundingBox();
        assert.ok(image.x >= 0 && image.x + image.width <= width && image.height > 40 && image.y + image.height <= title.y);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await click('Sva putovanja');
      await coverImage().waitFor();
      await context.setOffline(true);
      await page.reload();
      await coverImage().waitFor();
      await click('Otvori putovanje PWA local conflict ' + name);
      await chooseCover('Promijeni naslovnu fotografiju', syntheticPng);
      await click('Ukloni naslovnu fotografiju');
      await coverImage().waitFor({ state: 'detached' });
      await page.reload();
      assert.equal(await coverImage().count(), 0);
      await context.setOffline(false);
      pass(name + ': cover fits 320, 390 and 1440 px, persists offline and can be replaced or removed');
      await downloadPlaces('Izvezi sva spremljena mjesta', 'all', allSaved);
      pass(name + ': repeat saved hotel across days, remove one visit, fullscreen plan filters and JSON/GeoJSON downloads across all scopes');
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
      await page.getByRole('button', { name: 'Ažuriraj Triporu', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Naziv putovanja', { exact: true }).inputValue(), 'Keep unsaved draft through update');
      // The form deliberately covers background controls. The pending worker must
      // preserve it; the user closes it before choosing to update.
      await page.getByRole('button', { name: 'Zatvori obrazac', exact: true }).click();
      await page.getByRole('button', { name: 'Ažuriraj Triporu', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Odustani', exact: true }).click();
      await page.getByRole('button', { name: 'Otvori putovanje PWA pending update', exact: true }).waitFor();
      const otherWindow = await context.newPage(); await otherWindow.goto(base);
      await page.getByRole('button', { name: 'Ažuriraj Triporu', exact: true }).click();
      await page.getByRole('button', { name: 'Ažuriraj sada', exact: true }).click();
      await page.getByText('Zatvori ostale Tripora kartice i prozore pa pokušaj ponovno.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Otvori putovanje PWA pending update', exact: true }).waitFor();
      await otherWindow.close();
      await page.getByRole('button', { name: 'Ažuriraj Triporu', exact: true }).click();
      await page.getByRole('button', { name: 'Ažuriraj sada', exact: true }).click();
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
      pass(name + ': update notice/cancel/multiple-window guard preserve draft; confirmed update restores session and sends persisted outbox exactly once');
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
