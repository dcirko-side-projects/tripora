import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const lock = fileURLToPath(new URL('../../local-data/development.lock', import.meta.url));
const stop = fileURLToPath(new URL('../../local-data/development.stop', import.meta.url));
try {
  const pid = Number(await readFile(lock, 'utf8'));
  if (!Number.isSafeInteger(pid) || pid <= 0) throw Error('Invalid development lock; inspect manually.');
  process.kill(pid, 0);
  await writeFile(stop, 'stop', { mode: 0o600 });
  for (let n = 0; n < 100; n++) {
    try { await access(lock); }
    catch (e) { if (e.code === 'ENOENT') { console.log('Development stack stopped; lock released.'); process.exit(0); } throw e; }
    await new Promise(r => setTimeout(r, 250));
  }
  throw Error('Shutdown timed out. Do not back up until the runner and PostgreSQL have stopped.');
} catch (e) { console.error(e.code === 'ENOENT' ? 'No managed development stack is running.' : e.message); process.exitCode = 1; }
