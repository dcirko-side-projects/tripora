import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const server = spawn('dotnet', ['services/api/bin/Release/net10.0/Tripora.Api.dll'], {
  env: { ...process.env, ASPNETCORE_URLS: 'http://127.0.0.1:0', Tripora__HealthOnly: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
try {
  const baseUrl = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('API startup timed out: ' + output)), 20000);
    server.once('error', error => { clearTimeout(timeout); reject(error); });
    server.once('exit', code => { clearTimeout(timeout); reject(new Error('API exited: ' + code + '\n' + output)); });
    function collect(data) {
      output += data;
      const match = output.match(/Now listening on: (http:\/\/127\.0\.0\.1:\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    }
    server.stdout.on('data', collect); server.stderr.on('data', collect);
  });
  const response = await fetch(baseUrl + '/health/live');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'Tripora.Api' });
  assert.equal((await fetch(baseUrl + '/api/trips')).status, 404);
  console.log('PASS: HTTP liveness; no public trip data endpoint exposed.');
} finally {
  server.kill();
}
