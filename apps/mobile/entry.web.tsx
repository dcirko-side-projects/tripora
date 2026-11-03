import '@expo/metro-runtime';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initializeWebStorage } from './src/core/webRuntime';
import { currentAlert, dismissAlert, subscribeAlerts } from './src/ui/alert.web';

function AlertHost() {
  const [, changed] = useState(0);
  useEffect(() => subscribeAlerts(() => changed(n => n + 1)), []);
  const notice = currentAlert();
  useEffect(() => {
    if (!notice) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.getElementById('tripora-confirmation')!;
    const buttons = Array.from(dialog.querySelectorAll('button'));
    buttons[0]?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const index = notice.buttons.findIndex(b => b.style === 'cancel');
        if (index >= 0) dismissAlert(index);
      }
      if (event.key === 'Tab') {
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
      }
    };
    document.addEventListener('keydown', keys);
    return () => { document.removeEventListener('keydown', keys); previous?.focus(); };
  }, [notice]);
  if (!notice) return null;
  return <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, background: '#0009', display: 'grid', placeItems: 'center', padding: 20 }}>
    <div id="tripora-confirmation" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" style={{ background: '#FCFFFF', color: '#123044', padding: 24, borderRadius: 16, maxWidth: 450 }}>
      <h2 id="confirmation-title">{notice.title}</h2><p id="confirmation-message">{notice.message}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{notice.buttons.map((button, index) =>
        <button key={index} onClick={() => dismissAlert(index)} style={{ minHeight: 48, padding: 12, fontSize: 16, color: button.style === 'destructive' ? '#9b1240' : '#123044' }}>{button.text ?? 'U redu'}</button>)}</div>
    </div>
  </div>;
}
function WebApp() {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    void initializeWebStorage().then(() => setState('ready')).catch(cause => { setError(cause instanceof Error ? cause.message : 'Lokalna pohrana nije dostupna.'); setState('error'); });
    const offlineFailed = () => setError('Offline otvaranje još nije spremno. Poveži se na internet i ponovno otvori Triporu.');
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(registration => {
        const installing = registration.installing;
        installing?.addEventListener('statechange', () => { if (installing.state === 'redundant' && !registration.active) offlineFailed(); });
        return navigator.serviceWorker.ready;
      }).then(() => setOfflineReady(true)).catch(offlineFailed);
    } else offlineFailed();
  }, []);
  return <>
    <details style={{ padding: '8px 16px', background: '#e5f5fb', fontSize: 14, color: '#123044', paddingTop: 'max(8px, env(safe-area-inset-top))' }}>
      <summary style={{ cursor: 'pointer', minHeight: 28 }}>Tripora na iPhoneu · instalacija i offline podaci</summary>
      <p>U Safariju odaberi Dijeli → Dodaj na početni zaslon → Dodaj. Nakon instalacije otvori Triporu preko nove ikone i prijavi se. Prva prijava i preuzimanje trebaju internet.</p>
      <p>Za put pripremi podatke i posebno preuzmi fotografije. Nemoj brisati podatke stranice dok postoje neposlane promjene. Preglednik ili sustav mogu ukloniti lokalne podatke pri manjku prostora; redovito sinkroniziraj. Koristi uobičajeni, a ne privatni prozor. Karta treba internet.</p>
      <p role="status">{offlineReady ? 'Otvaranje aplikacije bez interneta je spremno. Podatke i fotografije pripremi u svom putovanju.' : 'Priprema otvaranja aplikacije bez interneta… Ostani povezan dok priprema ne završi.'}</p>
    </details>
    {error ? <p role="alert" style={{ padding: 16 }}>{error}</p> : null}
    {state === 'ready' ? <App /> : <main style={{ padding: 24 }}><h1>Tripora</h1>{state === 'loading' ? <p>Otvaranje lokalnih podataka…</p> : <button onClick={() => location.reload()}>Pokušaj ponovno</button>}</main>}
    <AlertHost />
  </>;
}
createRoot(document.getElementById('root')!).render(<WebApp />);
