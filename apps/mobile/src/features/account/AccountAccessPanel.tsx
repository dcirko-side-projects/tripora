import { useState } from 'react';
import { Text } from 'react-native';
import { SessionClient } from '../../core/sessionClient';
import { actionError } from '../../core/actionError';
import { Button, Field, FormError, FormSheet } from '../../ui/components';
import { ui } from '../../ui/theme';

export function AccountAccessPanel({ client, initialEmail }: { client: Pick<SessionClient, 'requestPasswordReset' | 'resetPassword' | 'resendConfirmation' | 'confirmEmail'>; initialEmail: string }) {
  const [mode, setMode] = useState<'reset' | 'confirm' | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  function open(next: 'reset' | 'confirm') { setEmail(initialEmail); setCode(''); setPassword(''); setError(''); setMessage(''); setMode(next); }
  async function perform(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (!email.trim()) throw Error('Unesi e-mail računa.');
      await action(); setMessage(success);
    } catch (cause) { setError(actionError(cause)); }
    finally { setBusy(false); }
  }
  return <>
    <Button title="Zaboravljena lozinka" variant="ghost" onPress={() => open('reset')} />
    <Button title="Potvrdi e-mail" variant="ghost" onPress={() => open('confirm')} />
    <FormSheet visible={mode !== null} title={mode === 'reset' ? 'Oporavak lozinke' : 'Potvrda e-maila'} busy={busy} onClose={() => { setMode(null); setCode(''); setPassword(''); }}>
      <FormError message={error} />
      {message ? <Text accessibilityRole="alert" style={ui.body}>{message}</Text> : null}
      <Field label="E-mail računa" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" editable={!busy} />
      <Button title={mode === 'reset' ? 'Pošalji kod za oporavak' : 'Pošalji novu potvrdu'} disabled={busy} variant="secondary" onPress={() => void perform(() => mode === 'reset' ? client.requestPasswordReset(email) : client.resendConfirmation(email), 'Ako račun ispunjava uvjete, poruka je poslana. Provjeri i neželjenu poštu.')} />
      <Field label="Kod iz e-maila" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} editable={!busy} multiline />
      {mode === 'reset' ? <><Field label="Nova lozinka" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" editable={!busy} /><Text style={ui.caption}>Najmanje 12 znakova, veliko i malo slovo, broj i poseban znak.</Text></> : null}
      <Button title={mode === 'reset' ? 'Spremi novu lozinku' : 'Potvrdi kod'} disabled={busy} onPress={() => void perform(async () => {
        if (!code.trim()) throw Error('Unesi kod iz e-maila.');
        if (mode === 'reset') {
          if (password.length < 12) throw Error('Nova lozinka mora imati najmanje 12 znakova.');
          await client.resetPassword(email, code, password); setPassword('');
        } else await client.confirmEmail(email, code);
        setCode('');
      }, mode === 'reset' ? 'Lozinka je promijenjena. Prijavi se novom lozinkom; lokalni podaci ostaju sačuvani.' : 'E-mail je potvrđen. Sada se možeš prijaviti.')} />
    </FormSheet>
  </>;
}
