import { spawn } from 'node:child_process';
// embedded-postgres.stop uses taskkill /f on Windows, leaving an unclean cluster.
// Use PostgreSQL's own shutdown protocol before copying any cluster files.
export async function stopPostgres(pg, databaseDir) {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const { pg_ctl } = await import(`@embedded-postgres/${platform}-${process.arch}`);
  await new Promise((resolve, reject) => {
    const child = spawn(pg_ctl, ['stop', '-D', databaseDir, '-m', 'fast', '-w', '-t', '15'], { stdio: 'ignore', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(Error('PostgreSQL clean shutdown failed; no backup may be taken.')));
  });
  // The package's exit hook otherwise waits for a second exit event from this stopped process.
  pg.stop = async () => {};
}
