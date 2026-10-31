import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../', import.meta.url));
const tag = 'tripora-smoke-' + randomBytes(6).toString('hex');
const network = tag + '-net', pg = tag + '-pg', api = tag + '-api';
const folder = fileURLToPath(new URL('../../local-data/' + tag + '/', import.meta.url));
const docker = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const password = randomBytes(24).toString('hex');
const pgEnv = folder + 'postgres.env', apiEnv = folder + 'api.env';
let networkCreated = false, pgCreated = false, apiCreated = false;
try {
  await mkdir(folder, { recursive: true });
  await writeFile(pgEnv, `POSTGRES_PASSWORD=${password}\nPOSTGRES_DB=tripora\n`, { mode: 0o600 });
  const certRoot = fileURLToPath(new URL('../../local-data/hosted-beta/', import.meta.url));
  const encrypted = existsSync(certRoot + 'key-certificate-base64.txt');
  const certificateEnv = encrypted ? `Tripora__KeyCertificate=${(await readFile(certRoot+'key-certificate-base64.txt','utf8')).trim()}\nTripora__KeyCertificatePassword=${(await readFile(certRoot+'key-certificate-password.txt','utf8')).trim()}\n` : '';
  await writeFile(apiEnv, `ASPNETCORE_ENVIRONMENT=Testing\nConnectionStrings__Tripora=Host=${pg};Database=tripora;Username=postgres;Password=${password}\nTripora__DatabaseKeys=true\nTripora__Email__Mode=File\nTripora__Email__Outbox=/tmp/outbox\nTripora__MediaRoot=/tmp/media\n` + certificateEnv, { mode: 0o600 });
  docker(['network', 'create', network]); networkCreated = true;
  docker(['run', '-d', '--name', pg, '--network', network, '--env-file', pgEnv, 'postgres:17-alpine']); pgCreated = true;
  for (let i = 0; ; i++) {
    try { docker(['exec', pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres']); break; }
    catch (error) { if (i === 60) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  docker(['run', '-d', '--memory', '512m', '--name', api, '--network', network, '--env-file', apiEnv, '-p', '127.0.0.1::8080', 'tripora-beta:local']); apiCreated = true;
  let endpoint = 'http://' + docker(['port', api, '8080/tcp']);
  async function ready() { for (let i = 0; ; i++) { try { const response = await fetch(endpoint + '/health/ready'); if (response.ok) return; } catch {} if (i === 90) throw Error('Container readiness timed out'); await new Promise(resolve => setTimeout(resolve, 500)); } }
  await ready();
  const email = 'container@example.test', userPassword = 'Synthetic!123456';
  const post = (path, body, token) => fetch(endpoint + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  assert.equal((await post('/auth/register', { email, password: userPassword })).status, 200);
  const login = await post('/auth/login?useCookies=false', { email, password: userPassword }); assert.equal(login.status, 200); const session = await login.json();
  assert.equal((await fetch(endpoint + '/auth/me', { headers: { authorization: 'Bearer ' + session.accessToken } })).status, 200);
  if (encrypted) assert.equal(docker(['exec', pg, 'psql', '-U', 'postgres', '-d', 'tripora', '-Atc', 'SELECT bool_and(position(\'EncryptedData\' in "Xml")>0) FROM "DataProtectionKeys"']), 't');
  docker(['restart', api]); endpoint = 'http://' + docker(['port', api, '8080/tcp']); await ready();
  assert.equal((await fetch(endpoint + '/auth/me', { headers: { authorization: 'Bearer ' + session.accessToken } })).status, 200);
  assert.equal((await fetch(endpoint + '/api/sync/pull')).status, 401);
  console.log('PASS: 512 MiB Linux container starts migrations as non-root, reaches isolated PostgreSQL, serves readiness/auth and retains database-key tokens after restart.' + (encrypted ? ' Persisted keys are certificate-encrypted.' : ' Testing-only unencrypted keys.'));
} catch (error) {
  if (apiCreated) { const logs=spawnSync('docker',['logs',api],{encoding:'utf8',windowsHide:true});await writeFile(folder+'api.log',(logs.stdout||'')+(logs.stderr||'')); }
  throw error;
} finally {
  if (apiCreated) docker(['rm', '-f', '-v', api]);
  if (pgCreated) docker(['rm', '-f', '-v', pg]);
  if (networkCreated) docker(['network', 'rm', network]);
  await rm(pgEnv, { force: true }); await rm(apiEnv, { force: true });
}
