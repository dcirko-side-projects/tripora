import { useEffect, useRef, useState } from 'react';
import { Alert } from './alert.web';

export function PwaUpdate() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [waiting, setWaiting] = useState(false);
  const [message, setMessage] = useState('');
  const activationListener = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    // The recovery URL bypasses legacy workers. Return to the cached entry URL
    // afterwards so subsequent reloads also work offline.
    const url = new URL(location.href);
    if (url.pathname === '/' && url.searchParams.has('update') && [...url.searchParams.keys()].length === 1)
      history.replaceState(history.state, '', '/' + url.hash);
    if (!('serviceWorker' in navigator)) return;
    let disposed = false;
    let current: ServiceWorkerRegistration | undefined;
    const workers = new Set<ServiceWorker>();
    const refresh = () => { if (!disposed) setWaiting(!!current?.waiting); };
    const found = () => {
      const worker = current?.installing;
      if (worker) { workers.add(worker); worker.addEventListener('statechange', refresh); }
      refresh();
    };
    const check = () => {
      if (document.visibilityState === 'visible') void current?.update().catch(() => {});
    };
    const response = (event: MessageEvent) => {
      if (event.data?.type === 'TRIPORA_UPDATE_BLOCKED')
        setMessage('Zatvori ostale Tripora kartice i prozore pa pokušaj ponovno.');
    };
    void navigator.serviceWorker.ready.then(value => {
      if (disposed) return;
      current = value; setRegistration(value);
      value.addEventListener('updatefound', found); found(); check();
    });
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    navigator.serviceWorker.addEventListener('message', response);
    return () => {
      disposed = true;
      current?.removeEventListener('updatefound', found);
      for (const worker of workers) worker.removeEventListener('statechange', refresh);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
      navigator.serviceWorker.removeEventListener('message', response);
      activationListener.current?.();
    };
  }, []);
  const apply = () => Alert.alert('Ažurirati Triporu?',
    'Prvo spremi otvoreni unos. Aplikacija će se ponovno učitati; nespremljeni tekst će se zatvoriti. Spremljeni podaci, prijava i promjene koje čekaju sinkronizaciju ostaju sačuvani.', [
      { text: 'Odustani', style: 'cancel' },
      { text: 'Ažuriraj sada', onPress: () => {
        const worker = registration?.waiting;
        if (!worker) { setWaiting(false); return; }
        activationListener.current?.();
        const activated = () => {
          if (worker.state === 'activated') { worker.removeEventListener('statechange', activated); location.reload(); }
        };
        worker.addEventListener('statechange', activated);
        activationListener.current = () => worker.removeEventListener('statechange', activated);
        worker.postMessage({ type: 'TRIPORA_APPLY_UPDATE' });
      } },
    ]);
  return <div style={{ padding: '8px 16px', background: '#e5f5fb', color: '#123044', fontSize: 14 }}>
    {waiting ? <p role="status">Nova verzija Tripore je spremna.</p> : null}
    <button style={{ minHeight: 44, fontSize: 14 }} disabled={!registration} onClick={waiting ? apply : () => {
      setMessage('Provjera nove verzije…');
      void registration?.update().then(() => setMessage(registration.installing || registration.waiting
        ? 'Preuzimanje nove verzije…' : 'Nema novije verzije.')).catch(() => setMessage('Provjera nije uspjela. Poveži se na internet i pokušaj ponovno.'));
    }}>{waiting ? 'Ažuriraj Triporu' : 'Provjeri novu verziju'}</button>
    {message && !waiting ? <p role="status">{message}</p> : null}
    {waiting && message.includes('Zatvori ostale') ? <p role="status">{message}</p> : null}
  </div>;
}
