import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { ApiClient } from '../../core/sync';
import { actionError } from '../../core/actionError';
import { Button, Field, FormError, FormSheet } from '../../ui/components';
import { ui } from '../../ui/theme';
const confirmation = 'OBRIŠI RAČUN I PUTOVANJA';
export function DeleteAccountPanel({ client, onDeleted, pending }: { client: ApiClient; onDeleted: (mediaCleanupPending: number) => Promise<void>; pending: number }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    setBusy(true); setError('');
    try { const result = await client.request<{ mediaCleanupPending: number }>('/auth/delete-account', { password, confirmation: phrase }); await onDeleted(result.mediaCleanupPending); setOpen(false); setPassword(''); setPhrase(''); }
    catch (cause) { setError(actionError(cause)); }
    finally { setBusy(false); }
  }
  return <>
    <Button title="Obriši račun" variant="danger" onPress={() => { setPassword(''); setPhrase(''); setError(''); setOpen(true); }} />
    <FormSheet visible={open} title="Brisanje računa" busy={busy} onClose={() => { setOpen(false); setPassword(''); }}>
      <Text style={ui.body}>Trajno uklanjaš račun, svoja putovanja i njihove zajedničke sadržaje te svoje zapise iz tuđih putovanja. Drugi sudionici gube te podatke nakon sinkronizacije. Prethodno preuzete kopije na drugim uređajima ne mogu se udaljeno izbrisati.</Text>
      <Text style={ui.body}>Na ovom uređaju bit će uklonjene i lokalne kopije računa, uključujući {pending} neposlanih promjena. Ova se radnja ne može poništiti.</Text>
      <FormError message={error} />
      <Field label="Potvrdi lozinku" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" editable={!busy} />
      <Field label={`Upiši ${confirmation}`} value={phrase} onChangeText={setPhrase} autoCorrect={false} editable={!busy} />
      <Button title="Trajno obriši račun" variant="danger" disabled={busy || !password || phrase !== confirmation} onPress={() => Alert.alert('Potvrdi trajno brisanje', 'Obrisat će se račun, vlasnička putovanja i tvoji zapisi u tuđim putovanjima. Želiš li nastaviti?', [{ text: 'Odustani', style: 'cancel' }, { text: 'Obriši', style: 'destructive', onPress: () => void remove() }])} />
    </FormSheet>
  </>;
}
