import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { randomUUID } from 'expo-crypto';
import { getDatabase } from './src/core/database';
import { createTrip, InputError, LocalSnapshot, readSnapshot, TripInput } from './src/core/localStore';

const emptyInput: TripInput = { name: '', destination: '', startDate: '', endDate: '' };
function Home() {
  const [snapshot, setSnapshot] = useState<LocalSnapshot>({ trips: [], pendingCount: 0 });
  const [input, setInput] = useState(emptyInput);
  const [ready, setReady] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const saving = useRef(false);

  function load() {
    try { setSnapshot(readSnapshot(getDatabase())); setReady(true); setError(''); }
    catch { setError('Lokalna pohrana nije dostupna. Pokušaj ponovno; postojeći podaci nisu obrisani.'); }
  }
  useEffect(load, []);
  function save() {
    if (saving.current) return;
    saving.current = true;
    setMessage(''); setError('');
    try {
      createTrip(getDatabase(), input, randomUUID);
      setSnapshot(readSnapshot(getDatabase()));
      setInput(emptyInput); setFormOpen(false);
      setMessage('Putovanje je spremljeno na ovom uređaju.');
    } catch (cause) {
      setError(cause instanceof InputError ? cause.message : 'Spremanje nije uspjelo. Provjeri popis prije ponovnog pokušaja.');
    } finally { saving.current = false; }
  }
  return <SafeAreaView style={styles.safe}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>TRIPORA</Text>
        <Text style={styles.title}>Tvoje sljedeće{ '\n' }putovanje.</Text>
        <Text style={styles.subtitle}>Manje traženja. Više doživljaja.</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Spremljeno na uređaju</Text>
          <Text style={styles.body}>Ovaj prototip radi lokalno, bez računa i dijeljenja. Sinkronizacija još nije dostupna. Koristi probne podatke.</Text>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
        {!ready ? <View>
          {!error ? <ActivityIndicator accessibilityLabel="Otvaranje lokalne pohrane" /> : null}
          {error ? <Pressable style={styles.button} onPress={load}><Text style={styles.buttonText}>Pokušaj ponovno</Text></Pressable> : null}
        </View> : <>
          <View style={styles.row}><Text style={styles.heading}>Moja putovanja</Text><Text style={styles.count}>{snapshot.trips.length}</Text></View>
          {!formOpen ? <Pressable accessibilityRole="button" style={styles.button} onPress={() => { setFormOpen(true); setError(''); setMessage(''); }}>
            <Text style={styles.buttonText}>+ Novo putovanje</Text>
          </Pressable> : <View style={styles.card}>
            <Text style={styles.heading}>Kamo idemo?</Text>
            {([
              ['name', 'Naziv putovanja', 'Ljetni odmor', 100],
              ['destination', 'Destinacija', 'Krk i Rab', 120],
              ['startDate', 'Početak · GGGG-MM-DD', '2026-10-01', 10],
              ['endDate', 'Završetak · GGGG-MM-DD', '2026-10-07', 10],
            ] as const).map(([key, label, placeholder, maxLength]) => <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextInput accessibilityLabel={label} style={styles.input} value={input[key]}
                placeholder={placeholder} placeholderTextColor="#697B76" maxLength={maxLength}
                autoCorrect={false} autoCapitalize={key.endsWith('Date') ? 'none' : 'sentences'}
                onChangeText={value => setInput(current => ({ ...current, [key]: value }))} />
            </View>)}
            <Pressable accessibilityRole="button" style={styles.button} onPress={save}><Text style={styles.buttonText}>Spremi putovanje</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.cancel} onPress={() => { setFormOpen(false); setError(''); }}><Text style={styles.link}>Odustani</Text></Pressable>
          </View>}
          {snapshot.trips.length === 0 ? <View style={styles.card}>
            <Text style={styles.heading}>Planovi počinju ovdje</Text>
            <Text style={styles.body}>Dodaj prvo putovanje. Naziv, destinacija i datumi ostat će spremljeni i nakon zatvaranja aplikacije.</Text>
          </View> : snapshot.trips.map(trip => <View key={trip.id} style={styles.card}>
            <Text style={styles.eyebrow}>{trip.destination}</Text>
            <Text style={styles.heading}>{trip.name}</Text>
            <Text style={styles.body}>{trip.startDate} — {trip.endDate}</Text>
            <Text style={styles.local}>Samo na ovom uređaju</Text>
          </View>)}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
export default function App() { return <SafeAreaProvider><Home /></SafeAreaProvider>; }
const styles = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: '#F5F5EE' },
  page: { padding: 24, gap: 20, maxWidth: 640, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  brand: { fontWeight: '800', letterSpacing: 4, color: '#195C4F', fontSize: 16 },
  title: { fontSize: 38, fontWeight: '700', color: '#173E35', lineHeight: 44 },
  subtitle: { fontSize: 17, color: '#526960' },
  notice: { backgroundColor: '#E3EDE5', padding: 18, borderRadius: 16, gap: 8 },
  noticeTitle: { fontWeight: '700', color: '#195C4F', fontSize: 16 },
  body: { color: '#435C52', fontSize: 15, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: '#173E35', fontSize: 22, fontWeight: '700' },
  count: { fontSize: 18, color: '#435C52' },
  button: { minHeight: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: '#195C4F', borderRadius: 14, padding: 14 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  card: { padding: 20, borderRadius: 20, backgroundColor: '#FFFFFF', gap: 12, borderWidth: 1, borderColor: '#DDE5DD' },
  eyebrow: { color: '#526960', fontSize: 15, fontWeight: '600' },
  local: { color: '#195C4F', fontSize: 13, marginTop: 4 },
  label: { color: '#435C52', fontSize: 14, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#9EAEA6', borderRadius: 10, minHeight: 50, padding: 12, fontSize: 16, color: '#173E35' },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  link: { color: '#195C4F', fontWeight: '600', fontSize: 16 },
  error: { color: '#9B2323', lineHeight: 22 }, success: { color: '#195C4F', lineHeight: 22 },
});
