// Isolated real-browser upgrade from the deployed legacy cache-first worker.
// No production accounts, API, or travel data. Full outbox coverage lives in pwa.mjs.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { createRequire } from 'node:module';
const root = resolve(import.meta.dirname, '../..');
const require = createRequire(join(root, 'apps/mobile/package.json'));
const { chromium, webkit } = require('playwright');
const dist = join(root, 'apps/mobile/dist-web');
const worker = await readFile(join(dist, 'sw.js'), 'utf8');
const legacyHtml = '<html><body><p>Legacy Tripora</p><script src="/legacy.js"></script></body></html>';
const legacyWorker = `const CACHE='tripora-shell-legacy';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/index.html','/legacy.js']))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.search||u.origin!==self.location.origin)return;
if(e.request.mode==='navigate')e.respondWith(caches.open(CACHE).then(c=>c.match('/index.html')));
});`;
let latest = false;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Content-Type', types[extname(path)] ?? 'text/html');
    if (path === '/sw.js') return res.end(latest ? worker : legacyWorker);
    if (path === '/legacy.js') return res.end("navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});");
    if (path === '/auth/options') { res.setHeader('Content-Type', 'application/json'); return res.end('{"requireConfirmedEmail":false}'); }
    if (path.startsWith('/auth/') || path.startsWith('/api/')) { res.statusCode = 401; return res.end(); }
    if (!latest && ['/', '/index.html'].includes(path)) return res.end(legacyHtml);
    const file = resolve(dist, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(dist + '\\') && !file.startsWith(dist + '/')) throw Error('Invalid path');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = 'http://127.0.0.1:' + server.address().port;
try {
  for (const [name, engine] of Object.entries({ chromium, webkit })) {
    if (process.env.TRIPORA_PWA_ENGINE && process.env.TRIPORA_PWA_ENGINE !== name) continue;
    latest = false;
    const browser = await engine.launch();
    const context = await browser.newContext();
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    try {
      await page.goto(base);
      await page.evaluate(async () => { await navigator.serviceWorker.ready; localStorage.setItem('synthetic-upgrade-proof', 'retain'); });
      await page.reload(); await page.getByText('Legacy Tripora').waitFor();
      latest = true;
      await page.reload(); await page.getByText('Legacy Tripora').waitFor();
      await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
      await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
      // Reproduce stale root navigation, then exercise the same-origin recovery link.
      await page.goto(base + '/?update=synthetic');
      await page.getByLabel('E-mail', { exact: true }).waitFor();
      assert.equal(new URL(page.url()).search, '');
      await page.getByLabel('E-mail', { exact: true }).fill('synthetic-draft@example.test');
      await page.getByRole('button', { name: 'Ažuriraj Triporu', exact: true }).click();
      await page.getByRole('button', { name: 'Odustani', exact: true }).click();
      assert.equal(await page.getByLabel('E-mail', { exact: true }).inputValue(), 'synthetic-draft@example.test');
      const other = await context.newPage(); await other.goto(base);
      await page.getByRole('button', { name: 'Ažuriraj Triporu', exact: true }).click();
      await page.getByRole('button', { name: 'Ažuriraj sada', exact: true }).click();
      await page.getByText('Zatvori ostale Tripora kartice i prozore pa pokušaj ponovno.', { exact: true }).waitFor();
      await other.close();
      await page.getByRole('button', { name: 'Ažuriraj Triporu', exact: true }).click();
      // The previous document can show the check button while the worker activates.
      // Wait for the app's reload before starting a separate offline navigation.
      await Promise.all([
        page.waitForEvent('load'),
        page.getByRole('button', { name: 'Ažuriraj sada', exact: true }).click(),
      ]);
      await page.getByRole('button', { name: 'Provjeri novu verziju', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('synthetic-upgrade-proof')), 'retain');
      await context.setOffline(true); await page.goto(base);
      await page.getByLabel('E-mail', { exact: true }).waitFor();
      assert.equal(await page.getByText('Legacy Tripora').count(), 0);
      console.log(`PASS ${name}: legacy stale shell reproduced; recovery link, cancel, multi-window guard, explicit update, retained storage and new offline shell`);
    } finally { await context.close(); await browser.close(); }
  }
} finally { server.closeAllConnections(); await new Promise(ok => server.close(ok)); }
