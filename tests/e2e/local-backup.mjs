// Cold snapshots for the local development stack only. No in-place restore.
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readdir, readFile, writeFile, copyFile, rename, realpath, rm, open } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const local = join(root, 'local-data');
const allowed = new Set(['postgres', 'media', 'keys', 'settings.json']);
export { inside as localDataPath };
const digest = async path => { const h = createHash('sha256'); for await (const b of createReadStream(path)) h.update(b); return h.digest('hex'); };
async function exists(path) { try { await lstat(path); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
async function inside(path, fresh = false) {
  path = resolve(path);
  const rel = relative(local, path);
  if (!rel || rel.startsWith('..') || rel.includes(':') || resolve(local, rel) !== path) throw Error('Path must be strictly inside repository local-data.');
  let cursor = local;
  for (const part of rel.split(sep)) {
    cursor = join(cursor, part);
    if (await exists(cursor)) {
      if ((await lstat(cursor)).isSymbolicLink() || await realpath(cursor) !== cursor) throw Error('Linked paths are not allowed.');
    }
  }
  if (fresh && await exists(path)) throw Error('Destination already exists; restore never overwrites data.');
  return path;
}
async function files(path, prefix = '', directories = []) {
  const found = [];
  for (const item of await readdir(path, { withFileTypes: true })) {
    const name = prefix ? prefix + '/' + item.name : item.name;
    const full = join(path, item.name);
    if (item.isSymbolicLink() || (!item.isDirectory() && !item.isFile())) throw Error('Only regular files/directories can be backed up.');
    if (item.isDirectory()) { directories.push(name); found.push(...await files(full, name, directories)); } else found.push(name);
  }
  return found.sort();
}
async function stopped(source) {
  if (await exists(join(source, 'postgres', 'postmaster.pid'))) throw Error('Stop the development stack cleanly before backup; PostgreSQL is running or did not stop cleanly.');
  if (!(await exists(join(source, 'postgres', 'PG_VERSION'))) || !(await exists(join(source, 'settings.json')))) throw Error('Not a complete local development stack.');
}
export async function withMaintenance(action) {
  await mkdir(local, { recursive: true });
  const path = join(local, 'development.lock');
  let lock;
  try { lock = await open(path, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') throw Error('Development/maintenance lock exists. Stop the runner first; inspect stale locks manually.'); throw e; }
  await lock.writeFile(String(process.pid));
  try { return await action(); }
  finally { await lock.close(); await rm(path); }
}
async function distinct(source, target) {
  source = await inside(source); target = await inside(target, true);
  if (target.startsWith(source + sep) || source.startsWith(target + sep)) throw Error('Source and destination cannot be nested.');
  return [source, target];
}
export async function backupLocal(source, target) {
  return withMaintenance(async () => {
    [source, target] = await distinct(source, target); await stopped(source);
    const directories = [];
    const names = (await files(source, '', directories)).filter(n => allowed.has(n.split('/')[0]));
    const stage = await inside(target + '.partial', true); await mkdir(stage, { recursive: true, mode: 0o700 });
    // Incomplete snapshots intentionally stay .partial and are never accepted for restore.
    const manifest = { format: 1, platform: process.platform, arch: process.arch, postgres: (await readFile(join(source, 'postgres', 'PG_VERSION'), 'utf8')).trim(), createdAt: new Date().toISOString(), directories: directories.filter(n => allowed.has(n.split('/')[0])), files: [] };
    for (const name of manifest.directories) await mkdir(join(stage, name), { recursive: true, mode: 0o700 });
    for (const name of names) {
      await mkdir(dirname(join(stage, name)), { recursive: true, mode: 0o700 });
      await copyFile(join(source, name), join(stage, name));
      manifest.files.push({ name, sha256: await digest(join(stage, name)) });
    }
    await stopped(source);
    await writeFile(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
    await rename(stage, target); return manifest.files.length;
  });
}
export async function restoreLocal(source, target) {
  return withMaintenance(async () => {
    [source, target] = await distinct(source, target);
    if (basename(source).endsWith('.partial')) throw Error('Incomplete snapshot cannot be restored.');
    const manifest = JSON.parse(await readFile(join(source, 'manifest.json'), 'utf8'));
    if (manifest.format !== 1 || manifest.platform !== process.platform || manifest.arch !== process.arch || manifest.postgres !== '17' || !Array.isArray(manifest.files) || !Array.isArray(manifest.directories)) throw Error('Unsupported snapshot: restore needs the same platform/architecture and PostgreSQL 17.');
    const validPath = name => typeof name === 'string' && /^[a-zA-Z0-9_./-]+$/.test(name) && !name.split('/').some(p => !p || p === '.' || p === '..') && allowed.has(name.split('/')[0]);
    if (manifest.directories.some(n => !validPath(n))) throw Error('Invalid snapshot directory.');
    const names = new Set();
    for (const file of manifest.files) {
      if (!validPath(file.name) || names.has(file.name)) throw Error('Invalid snapshot path.');
      names.add(file.name);
      if (file.sha256 !== await digest(await inside(join(source, file.name)))) throw Error('Snapshot checksum mismatch; restore refused.');
    }
    if (!names.has('postgres/PG_VERSION') || !names.has('settings.json') || names.has('postgres/postmaster.pid')) throw Error('Incomplete or running-cluster snapshot.');
    // No target is created until every checksum/path has passed.
    const stage = await inside(target + '.partial', true); await mkdir(stage, { recursive: true, mode: 0o700 });
    for (const name of manifest.directories) await mkdir(join(stage, name), { recursive: true, mode: 0o700 });
    for (const file of manifest.files) {
      await mkdir(dirname(join(stage, file.name)), { recursive: true, mode: 0o700 });
      await copyFile(join(source, file.name), join(stage, file.name));
      if (await digest(join(stage, file.name)) !== file.sha256) throw Error('Snapshot changed while restoring.');
    }
    await rename(stage, target); return names.size;
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, source, target] = process.argv.slice(2);
  if (!['backup', 'restore'].includes(mode) || !source || !target) throw Error('Usage: node tests/e2e/local-backup.mjs backup|restore SOURCE NEW_DESTINATION');
  try { const count = await (mode === 'backup' ? backupLocal : restoreLocal)(source, target); console.log(`Local ${mode} complete: ${count} files. Keep this private; it contains credentials, keys and media.`); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
