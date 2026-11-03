import { SessionClient } from './sessionClient';
import { stored, changeStored } from './webStorage';

// Same-origin API avoids cross-site credentials and a second hosting account.
const url = window.location.origin;
if (!/^https?:\/\//.test(url) || (!url.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(url)))
  throw Error('Tripora zahtijeva HTTPS.');
export const sessionClient = new SessionClient(url, {
  read: async () => await stored<string>('session', url) ?? null,
  write: value => changeStored('session', [{ key: url, value }]),
  clear: () => changeStored('session', [{ key: url }]),
}, async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
  .map(v => v.toString(16).padStart(2, '0')).join(''));
