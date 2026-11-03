// Read-only public release check: no registration, login or user-data mutations.
// Run from repository root after export/deployment. Requires Playwright browsers.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
const root = process.cwd();
const require = createRequire(join(root, 'apps/mobile/package.json'));
const { chromium, webkit } = require('playwright');
const base = 'https://tripora-l4c7.onrender.com/';
const dataRoot = join(root, 'local-data'); await mkdir(dataRoot, { recursive: true });
for (const [name, engine] of Object.entries({ chromium, webkit })) {
  const profile = await mkdtemp(join(dataRoot, 'pwa-public-'));
  let context;
  try {
    context = await engine.launchPersistentContext(profile, { viewport: { width: 390, height: 844 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByLabel('E-mail', { exact: true }).waitFor({ timeout: 75000 });
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // Let the installed shell control this client.
    await page.getByLabel('E-mail', { exact: true }).waitFor();
    await context.setOffline(true); await page.reload();
    await page.getByLabel('E-mail', { exact: true }).waitFor();
    await page.getByText('Tripora na iPhoneu · instalacija i offline podaci', { exact: true }).click();
    await page.getByText('Otvaranje aplikacije bez interneta je spremno.', { exact: false }).waitFor();
    const urls = await page.evaluate(async () => {
      const result = [];
      for (const key of await caches.keys()) for (const request of await (await caches.open(key)).keys()) result.push(request.url);
      return result;
    });
    assert.ok(urls.some(url => url.endsWith('.wasm')));
    assert.ok(urls.every(url => !/\/(auth|api)\//.test(url)));
    assert.deepEqual(errors, []);
    console.log(`PASS public ${name}: HTTPS startup, installed shell, offline reload, readiness and private-cache boundary`);
  } finally {
    await context?.close();
    if (resolve(profile).startsWith(resolve(dataRoot) + sep)) await rm(profile, { recursive: true, force: true });
  }
}
