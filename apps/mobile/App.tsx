import { useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { randomUUID } from "expo-crypto";
import { openAccountDatabase, deleteAccountDatabase } from "./src/core/accountDatabase";
import {
  ACCESS_REMOVED,
  AccountSnapshot,
  accountSnapshot,
  deleteAccountTrip,
  resolveConflict,
  saveAccountTrip,
  SyncedTrip,
} from "./src/core/accountStore";
import { validateTrip, TripInput } from "./src/core/localStore";
import { Account } from "./src/core/sessionClient";
import { sessionClient } from "./src/core/session";
import { ApiError } from "./src/core/sync";
import { synchronizeAccount as synchronize } from "./src/core/accountSync";
import { MembershipPanel } from "./src/features/membership/MembershipPanel";
import { AccountAccessPanel } from "./src/features/account/AccountAccessPanel";
import { DeleteAccountPanel } from "./src/features/account/DeleteAccountPanel";
import { PlacesPanel } from "./src/features/places/PlacesPanel";
import {
  Place,
  PlaceSnapshot,
  placeSnapshot,
  resolvePlaceConflict,
  PLACE_ACCESS_REMOVED,
} from "./src/core/placeStore";
import {
  Entry,
  EntrySnapshot,
  canEditEntry,
  entrySnapshot,
  formatMoney,
  resolveEntryConflict,
  ENTRY_ACCESS_REMOVED,
} from "./src/core/entryStore";
import { LocalMedia, MediaIO, mediaSnapshot } from "./src/core/mediaQueue";
import { createNativeMediaIO, deleteNativeMediaScope } from "./src/core/nativeMedia";
import { TripWorkPanel } from "./src/features/work/TripWorkPanel";
import { tripOverview } from "./src/core/tripOverview";
import { actionError } from "./src/core/actionError";

import {
  Button,
  BottomNav,
  Empty,
  Field,
  FormError,
  FormSheet,
  Loading,
  MenuRow,
} from "./src/ui/components";
import { DateField } from "./src/ui/DateField";
import { Icon } from "./src/ui/Icon";
import { dateValue, displayDate } from "./src/ui/dates";
import { tokens, ui } from "./src/ui/theme";
import {
  TripOverviewScreen,
  TripSection,
} from "./src/features/trips/TripOverviewScreen";
const globalTabs = [
  ["trips", "Putovanja", "trips"],
  ["sync", "Sinkronizacija", "sync"],
  ["account", "Račun", "user"],
] as const;
const tripTabs = [
  ["overview", "Pregled", "trips"],
  ["plan", "Plan", "calendar"],
  ["places", "Mjesta", "pin"],
  ["expense", "Troškovi", "wallet"],
  ["more", "Više", "more"],
] as const;
const emptyInput: TripInput = {
  name: "",
  destination: "",
  startDate: "",
  endDate: "",
};
const emptySnapshot: AccountSnapshot = { trips: [], pending: [], cursor: 0 };
function Home() {
  const [account, setAccount] = useState<Account | null>(null);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [places, setPlaces] = useState<PlaceSnapshot>({
    places: [],
    pending: [],
    cursor: 0,
  });
  const [entries, setEntries] = useState<EntrySnapshot>({
    entries: [],
    pending: [],
    cursor: 0,
  });
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const mediaIO = useRef<MediaIO | null>(null);
  const [input, setInput] = useState(emptyInput);
  const [editing, setEditing] = useState<string | undefined>();
  const [screen, setScreen] = useState<"trips" | "sync" | "account">("trips");
  const [tripId, setTripId] = useState<string>();
  const [section, setSection] = useState<TripSection>("overview");
  const [planPlace, setPlanPlace] = useState<Place>();
  const [joinOpen, setJoinOpen] = useState(false);
  const [reauthHidden, setReauthHidden] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [register, setRegister] = useState(false);
  const [reauth, setReauth] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const connection = useRef<ReturnType<typeof openAccountDatabase> | null>(
    null,
  );
  const locked = useRef(false);
  const mounted = useRef(true);
  const activeSync = useRef<Promise<unknown> | null>(null);

  function reload() {
    if (connection.current) {
      const db = connection.current.db;
      setSnapshot(accountSnapshot(db));
      setPlaces(placeSnapshot(db));
      setEntries(entrySnapshot(db));
      setMedia(mediaSnapshot(db));
    }
  }
  function activate(next: Account) {
    const opened = openAccountDatabase(next.scope);
    connection.current?.close();
    connection.current = opened;
    setSnapshot(accountSnapshot(opened.db));
    setAccount(next);
    setEmail(next.email);
    setPlaces(placeSnapshot(opened.db));
    setEntries(entrySnapshot(opened.db));
    setMedia(mediaSnapshot(opened.db));
    mediaIO.current = createNativeMediaIO(next.scope);
    setPassword("");
    setReauth(false);
    setFormOpen(false);
    setInput(emptyInput);
    setInviteCode("");
    setTripId(undefined);
    setScreen("trips");
    setSection("overview");
    setPlanPlace(undefined);
    setReauthHidden(false);
  }
  function fail(cause: unknown) {
    if (cause instanceof ApiError && cause.status === 401) {
      setReauth(true);
      setPassword("");
    }
    setError(actionError(cause));
  }
  async function syncNow() {
    if (locked.current || !connection.current || reauth) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const task = synchronize(connection.current.db, sessionClient, {
      actor: account ?? undefined,
      media: mediaIO.current ?? undefined,
    });
    activeSync.current = task;
    try {
      const result = await task;
      if (mounted.current) {
        const db = connection.current!.db;
        const remaining =
          accountSnapshot(db).pending.length +
          placeSnapshot(db).pending.length +
          entrySnapshot(db).pending.length +
          mediaSnapshot(db).filter((m) => m.state === "pending").length;
        setMessage(
          result.conflicts || result.errors
            ? "Neke promjene trebaju tvoju pažnju."
            : remaining
              ? "Dio promjena još čeka slanje."
              : "Podaci putovanja su sinkronizirani.",
        );
      }
    } catch (cause) {
      if (mounted.current) fail(cause);
    } finally {
      activeSync.current = null;
      locked.current = false;
      if (mounted.current) {
        reload();
        setBusy(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const next = await sessionClient.restore();
        if (mounted.current && next) activate(next);
      } catch (cause) {
        if (mounted.current) fail(cause);
      } finally {
        if (mounted.current) setReady(true);
      }
    })();
    return () => {
      mounted.current = false;
      const opened = connection.current;
      connection.current = null;
      if (activeSync.current)
        void activeSync.current.finally(() => opened?.close()).catch(() => {});
      else opened?.close();
    };
  }, []);
  useEffect(() => {
    if (!account || reauth) return;
    void syncNow();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    // A bounded foreground retry also detects connectivity returning without a new dependency.
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void syncNow();
    }, 30000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [account, reauth]);
  async function authenticate() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!email.trim() || !password)
        throw new Error("Unesi e-mail i lozinku.");
      if (
        reauth &&
        account &&
        email.trim().toLowerCase() !== account.email.toLowerCase()
      )
        throw new Error("Za nastavak prijavi isti račun ili se prvo odjavi.");
      activate(
        await sessionClient.signIn(email, password, register && !reauth),
      );
    } catch (cause) {
      if (cause instanceof ApiError && cause.body.code === 'email_confirmation_required') {
        setMessage(cause.message); setRegister(false); setPassword('');
      } else fail(cause);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  async function logout(deletedScope?: string, mediaCleanupPending = 0) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      let cleanupError: unknown;
      try { await sessionClient.signOut(); }
      catch (cause) { if (!deletedScope) throw cause; cleanupError = cause; }
      connection.current?.close();
      connection.current = null;
      if (deletedScope) {
        const cleanup = await Promise.allSettled([deleteAccountDatabase(deletedScope), deleteNativeMediaScope(deletedScope)]);
        if (cleanup.some(result => result.status === 'rejected')) cleanupError = true;
      }
      setTripId(undefined);
      setScreen("trips");
      setPlanPlace(undefined);
      setJoinOpen(false);
      setReauthHidden(false);
      setAccount(null);
      setSnapshot(emptySnapshot);
      setPassword("");
      setReauth(false);
      setPlaces({ places: [], pending: [], cursor: 0 });
      setEntries({ entries: [], pending: [], cursor: 0 });
      setMedia([]);
      mediaIO.current = null;
      setFormOpen(false);
      setInput(emptyInput);
      setMessage(deletedScope ? 'Račun je obrisan.' + (mediaCleanupPending ? ' Dio serverskih fotografija čeka ponovni pokušaj uklanjanja.' : '') : "Odjavljen/a si. Lokalne promjene ostaju za isti račun.");
      if (cleanupError) setError('Račun je obrisan, ali uklanjanje lokalnih kopija nije dovršeno. Očisti podatke aplikacije u postavkama uređaja.');
    } catch (cause) {
      fail(cause);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function confirmLogout() {
    Alert.alert(
      "Odjava",
      `Na uređaju ostaje ${snapshot.pending.length + places.pending.length + entries.pending.length + media.filter((m) => m.state === "pending").length} neposlanih promjena. Dostupne su nakon ponovne prijave istog računa.`,
      [
        { text: "Odustani", style: "cancel" },
        { text: "Odjavi se i sačuvaj podatke", onPress: () => void logout() },
      ],
    );
  }
  async function onlineAction(
    action: () => Promise<void>,
    requiresOnline = true,
  ): Promise<boolean> {
    if (locked.current || (reauth && requiresOnline)) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) {
        reload();
        setBusy(false);
      }
    }
  }
  async function acceptInvitation() {
    const accepted = await onlineAction(async () => {
      if (!/^[a-f0-9]{64}$/i.test(inviteCode.trim()))
        throw new Error("Unesi cijeli kod pozivnice (64 znaka).");
      await sessionClient.request("/api/invitations/accept", {
        token: inviteCode.trim(),
      });
      setInviteCode("");
      setJoinOpen(false);
      setMessage("Pozivnica je prihvaćena. Preuzimam putovanje.");
    });
    if (accepted) void syncNow();
  }
  function localAction(action: () => void, success: string) {
    if (locked.current || !connection.current) return false;
    setError("");
    setMessage("");
    try {
      action();
      reload();
      setMessage(success);
      return true;
    } catch (cause) {
      fail(cause);
      return false;
    }
  }
  function save() {
    const errors: Record<string, string> = {};
    if (!input.name.trim()) errors.name = "Unesi naziv putovanja.";
    if (!input.destination.trim()) errors.destination = "Unesi destinaciju.";
    if (!input.startDate) errors.startDate = "Odaberi datum početka.";
    if (!input.endDate) errors.endDate = "Odaberi datum završetka.";
    if (input.startDate && input.endDate && input.endDate < input.startDate)
      errors.endDate = "Završetak ne može biti prije početka.";
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    try {
      validateTrip(input);
    } catch (cause) {
      fail(cause);
      return;
    }
    const saved = localAction(() => {
      saveAccountTrip(connection.current!.db, input, randomUUID, editing);
      setFormOpen(false);
      setInput(emptyInput);
      setEditing(undefined);
    }, "Spremljeno na uređaju. Čeka sinkronizaciju.");
    if (saved) void syncNow();
  }
  function mutatePlace(action: () => void): boolean {
    const saved = localAction(action, "Promjena je spremljena na uređaju.");
    if (saved) void syncNow();
    return saved;
  }
  function resolvePlace(id: string, choice: "local" | "server") {
    Alert.alert(
      "Riješi sukob mjesta",
      choice === "server"
        ? "Prikazana serverska verzija zamijenit će sve lokalne izmjene ovog mjesta."
        : "Sve tvoje prikazane lokalne izmjene bit će ponovno poslane prema prikazanoj serverskoj verziji.",
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Potvrdi",
          onPress: () =>
            mutatePlace(() =>
              resolvePlaceConflict(
                connection.current!.db,
                id,
                choice,
                randomUUID,
              ),
            ),
        },
      ],
    );
  }
  function resolveEntry(id: string, choice: "local" | "server") {
    Alert.alert(
      "Riješi sukob zapisa",
      choice === "server"
        ? "Prikazana serverska verzija zamijenit će sve tvoje lokalne izmjene ovog zapisa."
        : "Sve tvoje lokalne izmjene bit će ponovno poslane prema prikazanoj serverskoj verziji.",
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Potvrdi",
          onPress: () =>
            mutatePlace(() =>
              resolveEntryConflict(
                connection.current!.db,
                id,
                choice,
                account!,
                randomUUID,
              ),
            ),
        },
      ],
    );
  }
  function describeEntry(entry: Entry | undefined): string {
    if (!entry) return "";
    const prefix = entry.deleted ? "Brisanje · " : "";
    if (entry.feature === "budget")
      return (
        prefix +
        `Valuta: ${entry.data.currency} · Budžet: ${entry.data.budgetMinor === null ? "Bez ograničenja" : formatMoney(entry.data.budgetMinor, entry.data.currency)}`
      );
    if (entry.feature === "packing")
      return (
        prefix +
        `${entry.data.title} · ${entry.data.packed ? "Spakirano" : "Za spakirati"}`
      );
    if (entry.feature === "expense")
      return (
        prefix +
        `${entry.data.title} · ${formatMoney(entry.data.amountMinor, entry.data.currency)} · ${entry.data.date}\n${entry.data.category} · Platitelj: ${entry.data.payer}\n${entry.data.notes}`
      );
    if (entry.feature === "plan")
      return (
        prefix +
        `${entry.data.title} · ${entry.data.date || "Neraspoređeno"} ${entry.data.time}\n${entry.data.notes}`
      );
    return (
      prefix +
      `${entry.data.title}\n${entry.data.notes}${entry.data.mediaId ? "\nS fotografijom" : ""}`
    );
  }
  function edit(trip: SyncedTrip) {
    setInput(trip);
    setEditing(trip.id);
    setFormOpen(true);
    setFormErrors({});
    setError("");
  }
  function remove(trip: SyncedTrip) {
    Alert.alert("Obrisati putovanje?", trip.name, [
      { text: "Odustani", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: () => {
          if (
            localAction(
              () =>
                deleteAccountTrip(connection.current!.db, trip.id, randomUUID),
              "Brisanje je spremljeno na uređaju.",
            )
          )
            void syncNow();
        },
      },
    ]);
  }
  function resolve(id: string, choice: "server" | "local") {
    Alert.alert(
      "Potvrdi rješenje sukoba",
      choice === "server"
        ? "Lokalna promjena bit će zamijenjena prikazanom serverskom verzijom."
        : "Lokalna promjena bit će ponovno poslana na temelju prikazane serverske verzije.",
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Potvrdi",
          onPress: () => {
            if (
              localAction(
                () =>
                  resolveConflict(
                    connection.current!.db,
                    id,
                    choice,
                    randomUUID,
                  ),
                "Rješenje sukoba je spremljeno.",
              )
            )
              void syncNow();
          },
        },
      ],
    );
  }
  const trip = snapshot.trips.find((t) => t.id === tripId);
  const pendingCount =
    snapshot.pending.length +
    places.pending.length +
    entries.pending.length +
    media.filter((m) => m.state === "pending").length;
  const attention =
    snapshot.pending.filter((p) => p.error || p.conflict).length +
    places.pending.filter((p) => p.error || p.conflict).length +
    entries.pending.filter((p) => p.error || p.conflict).length +
    media.filter((m) => m.error).length;
  const moreSections: TripSection[] = [
    "more",
    "packing",
    "memory",
    "members",
    "settings",
  ];
  function navigate(next: TripSection) {
    setSection(next);
    if (next !== "plan") setPlanPlace(undefined);
    setError("");
    setMessage("");
  }
  function back() {
    if (busy) return true;
    if (formOpen) {
      setFormOpen(false);
      return true;
    }
    if (trip) {
      if (moreSections.includes(section) && section !== "more")
        setSection("more");
      else if (section !== "overview") setSection("overview");
      else setTripId(undefined);
      return true;
    }
    if (screen !== "trips") {
      setScreen("trips");
      return true;
    }
    return false;
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      back,
    );
    return () => subscription.remove();
  }, [tripId, section, screen, formOpen, busy]);
  function openTrip(id: string) {
    setTripId(id);
    setSection("overview");
    setPlanPlace(undefined);
    setError("");
    setMessage("");
  }
  function openSync() {
    setTripId(undefined);
    setScreen("sync");
  }
  function newTrip() {
    setEditing(undefined);
    setInput(emptyInput);
    setFormErrors({});
    setError("");
    setFormOpen(true);
  }
  const button = (label: string, action: () => void, secondary = false) => (
    <Button
      title={label}
      onPress={action}
      disabled={busy}
      variant={secondary ? "ghost" : "primary"}
    />
  );
  const today = dateValue(new Date());
  const upcoming = snapshot.trips.filter((t) => t.endDate >= today);
  const past = snapshot.trips
    .filter((t) => t.endDate < today)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
  const tripCard = (t: SyncedTrip) => {
    const state = tripOverview(
      t.id,
      account!.id,
      snapshot,
      places,
      entries,
      media,
    );
    return (
      <Pressable
        key={t.id}
        accessibilityRole="button"
        accessibilityLabel={`Otvori putovanje ${t.name}`}
        onPress={() => openTrip(t.id)}
        style={({ pressed }) => [
          styles.tripCard,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <View style={ui.between}>
          <View style={ui.flex}>
            <Text style={ui.eyebrow}>
              {t.destination.toLocaleUpperCase("hr-HR")}
            </Text>
            <Text style={[ui.heading, { marginTop: 8 }]}>{t.name}</Text>
          </View>
          <Icon name="next" color={tokens.color.primary} />
        </View>
        <Text style={ui.muted}>
          {displayDate(t.startDate)} – {displayDate(t.endDate)}
        </Text>
        <View style={ui.between}>
          <Text style={ui.caption}>
            {t.startDate <= today && t.endDate >= today
              ? "U tijeku"
              : t.endDate < today
                ? "Završeno"
                : "Nadolazeće"}
          </Text>
          <Text
            style={[
              ui.caption,
              state.attention > 0 && { color: tokens.color.danger },
            ]}
          >
            {t.accessRevoked
              ? "Pristup je uklonjen"
              : state.attention
                ? "Treba pažnju"
                : state.pending
                  ? `${state.pending} na čekanju`
                  : "Sinkronizirano"}
          </Text>
        </View>
      </Pressable>
    );
  };
  const authContent = (
    <View style={ui.panel}>
      <View style={ui.hero}>
        <Text style={ui.eyebrow}>TRIPORA</Text>
        <Text accessibilityRole="header" style={ui.title}>
          {reauth
            ? "Obnovi prijavu"
            : register
              ? "Putovanje počinje ovdje."
              : "Dobro došao natrag."}
        </Text>
        <Text style={ui.muted}>
          {reauth
            ? "Lokalni podaci su sačuvani. Prijavi isti račun kako bi nastavio sinkronizaciju."
            : "Manje traženja, više doživljaja. Svi planovi putovanja na jednom mjestu."}
        </Text>
      </View>
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
        autoComplete="email"
        editable={!busy && !reauth}
      />
      <Field
        label="Lozinka"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={register ? "new-password" : "current-password"}
        editable={!busy}
      />
      {register && !reauth ? (
        <Text style={ui.caption}>
          Najmanje 12 znakova, veliko i malo slovo, broj i poseban znak.
        </Text>
      ) : null}
      <Button
        title={register && !reauth ? "Registriraj se" : "Prijavi se"}
        disabled={busy}
        onPress={() => void authenticate()}
      />
      <AccountAccessPanel client={sessionClient} initialEmail={email} />
      {!reauth ? (
        <Button
          title={register ? "Već imam račun" : "Kreiraj račun"}
          variant="ghost"
          disabled={busy}
          onPress={() => setRegister(!register)}
        />
      ) : null}
      {reauth && account ? (
        <Button
          title="Nastavi s lokalnim podacima"
          variant="secondary"
          disabled={busy}
          onPress={() => setReauthHidden(true)}
        />
      ) : null}
      {account ? (
        <Button
          title="Odjava"
          variant="ghost"
          disabled={busy}
          onPress={confirmLogout}
        />
      ) : (
        <Button
          title="Ukloni spremljenu sesiju"
          variant="ghost"
          disabled={busy}
          onPress={() => void logout()}
        />
      )}
      <View style={ui.inset}>
        <Text style={ui.caption}>
          Razvojna verzija · koristi probne podatke. Prva prijava zahtijeva
          internet.
        </Text>
      </View>
    </View>
  );
  const workProps =
    trip && account && connection.current && mediaIO.current
      ? {
          db: connection.current.db,
          trip,
          actor: account,
          snapshot: entries,
          places,
          media,
          io: mediaIO.current,
          api: sessionClient,
          busy,
          error,
          mutate: mutatePlace,
          perform: onlineAction,
        }
      : null;
  const owner =
    trip &&
    !trip.accessRevoked &&
    trip.role !== "member" &&
    (!trip.ownerId || trip.ownerId === account?.id);
  return (
    <SafeAreaView style={ui.safe}>
      <StatusBar style="dark" />
      {account && (!reauth || reauthHidden) ? (
        <View style={styles.header}>
          {trip ? (
            <Button
              title={section === "overview" ? "Sva putovanja" : "Natrag"}
              icon="back"
              variant="ghost"
              disabled={busy}
              onPress={back}
            />
          ) : (
            <Text style={ui.eyebrow}>TRIPORA</Text>
          )}
          <View style={ui.flex} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Status sinkronizacije"
            onPress={openSync}
            style={styles.statusPill}
          >
            <Icon
              name={attention ? "alert" : "sync"}
              color={attention ? tokens.color.danger : tokens.color.primary}
              size={16}
            />
            <Text style={ui.caption}>
              {busy
                ? "U tijeku"
                : pendingCount
                  ? `${pendingCount} na čekanju`
                  : attention
                    ? "Treba pažnju"
                    : "Na uređaju"}
            </Text>
          </Pressable>
        </View>
      ) : null}
      <KeyboardAvoidingView
        style={ui.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          key={trip ? `${trip.id}-${section}` : screen}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={ui.page}
        >
          {error ? <FormError message={error} /> : null}
          {message ? (
            <Text accessibilityLiveRegion="polite" style={ui.caption}>
              {message}
            </Text>
          ) : null}
          {busy || !ready ? <Loading /> : null}
          {busy ? (
            <Text accessibilityLiveRegion="polite" style={ui.caption}>
              Zahtjev je u tijeku. Ako se server pokreće nakon neaktivnosti,
              odgovor može potrajati oko minute.
            </Text>
          ) : null}
          {!ready ? (
            <Text style={ui.muted}>Otvaram tvoje planove…</Text>
          ) : !account || (reauth && !reauthHidden) ? (
            authContent
          ) : (
            <>
              {attention && screen !== "sync" ? (
                <Button
                  title={`${attention} promjena treba pažnju`}
                  icon="alert"
                  variant="secondary"
                  onPress={openSync}
                />
              ) : null}
              {reauth ? (
                <View style={ui.errorBox}>
                  <Text style={ui.error}>
                    Prijava je istekla. Lokalni rad ostaje dostupan; slanje je
                    zaustavljeno.
                  </Text>
                  <Button
                    title="Obnovi prijavu"
                    variant="ghost"
                    onPress={() => setReauthHidden(false)}
                  />
                </View>
              ) : null}
              {!trip && screen === "trips" ? (
                <>
                  <View style={{ gap: 8 }}>
                    <Text style={ui.eyebrow}>PLANIRAJ. ISTRAŽI. PAMTI.</Text>
                    <Text accessibilityRole="header" style={ui.title}>
                      Moja putovanja
                    </Text>
                    <Text style={ui.muted}>
                      Sljedeća pustolovina počinje dobrim planom.
                    </Text>
                  </View>
                  <Button
                    title="Novo putovanje"
                    icon="plus"
                    disabled={busy}
                    onPress={newTrip}
                  />
                  {upcoming.length ? (
                    <View style={{ gap: 16 }}>
                      <Text style={ui.subheading}>Uskoro i u tijeku</Text>
                      {upcoming.map(tripCard)}
                    </View>
                  ) : !past.length ? (
                    <Empty
                      title="Kamo ideš sljedeće?"
                      detail="Napravi prvo putovanje ili prihvati pozivnicu suputnika."
                    />
                  ) : (
                    <Text style={ui.muted}>
                      Nema nadolazećih putovanja. Vrijeme je za novi plan.
                    </Text>
                  )}
                  <Button
                    title="Imam kod pozivnice"
                    icon="people"
                    variant="ghost"
                    disabled={busy || reauth}
                    onPress={() => {
                      setError("");
                      setJoinOpen(true);
                    }}
                  />
                  {past.length ? (
                    <View style={{ gap: 16 }}>
                      <Text style={ui.subheading}>Prošla putovanja</Text>
                      {past.map(tripCard)}
                    </View>
                  ) : null}
                </>
              ) : null}
              {trip && section === "overview" ? (
                <TripOverviewScreen
                  trip={trip}
                  actorId={account.id}
                  snapshot={snapshot}
                  places={places}
                  entries={entries}
                  media={media}
                  onNavigate={navigate}
                  onSync={() => void syncNow()}
                />
              ) : null}
              {trip && section === "places" && connection.current ? (
                <PlacesPanel
                  key={account.scope + trip.id}
                  db={connection.current.db}
                  tripId={trip.id}
                  destination={trip.destination}
                  api={sessionClient}
                  snapshot={places}
                  busy={busy}
                  readOnly={!!trip.accessRevoked}
                  mutate={mutatePlace}
                  onPlan={(place) => {
                    setPlanPlace(place);
                    setSection("plan");
                  }}
                />
              ) : null}
              {workProps &&
              (section === "plan" ||
                section === "packing" ||
                section === "expense" ||
                section === "memory") ? (
                <TripWorkPanel
                  key={account.scope + trip!.id + section}
                  {...workProps}
                  section={section}
                  planPlace={planPlace}
                  onSeedUsed={() => setPlanPlace(undefined)}
                />
              ) : null}
              {trip && section === "more" ? (
                <>
                  <View>
                    <Text style={ui.eyebrow}>
                      {trip.name.toLocaleUpperCase("hr-HR")}
                    </Text>
                    <Text accessibilityRole="header" style={ui.title}>
                      Još za putovanje
                    </Text>
                  </View>
                  <View>
                    <MenuRow
                      title="Moja packing lista"
                      detail="Osobni popis stvari za ponijeti"
                      icon="packing"
                      onPress={() => navigate("packing")}
                    />
                    <MenuRow
                      title="Uspomene"
                      detail="Fotografije i priče s putovanja"
                      icon="photo"
                      onPress={() => navigate("memory")}
                    />
                    <MenuRow
                      title="Sudionici"
                      detail="Suputnici, uloge i pozivnice"
                      icon="people"
                      onPress={() => navigate("members")}
                    />
                    <MenuRow
                      title="Postavke putovanja"
                      detail="Osnovni podaci i dostupnost offline"
                      icon="settings"
                      onPress={() => navigate("settings")}
                    />
                  </View>
                </>
              ) : null}
              {trip && section === "members" ? (
                owner && trip.version > 0 && !reauth ? (
                  <MembershipPanel
                    key={account.scope + trip.id}
                    tripId={trip.id}
                    api={sessionClient}
                    busy={busy}
                    error={error}
                    perform={onlineAction}
                  />
                ) : (
                  <View style={ui.panel}>
                    <Text style={ui.title}>Sudionici</Text>
                    <Text style={ui.body}>
                      {trip.role === "member"
                        ? "Član · pregled osnovnih podataka, zajedničko uređivanje mjesta i plana."
                        : trip.accessRevoked
                          ? "Pristup putovanju je uklonjen."
                          : "Ti si vlasnik putovanja."}
                    </Text>
                    <Text style={ui.muted}>
                      {trip.version === 0
                        ? "Sinkroniziraj novo putovanje prije pozivanja suputnika."
                        : reauth
                          ? "Obnovi prijavu za upravljanje sudionicima."
                          : "Pozivnicama i popisom članova upravlja vlasnik. Packing lista svakog sudionika ostaje privatna."}
                    </Text>
                  </View>
                )
              ) : null}
              {trip && section === "settings" ? (
                <>
                  <Text style={ui.title}>Postavke putovanja</Text>
                  <View style={ui.card}>
                    <Text style={ui.heading}>{trip.name}</Text>
                    <Text style={ui.body}>{trip.destination}</Text>
                    <Text style={ui.muted}>
                      {displayDate(trip.startDate)} –{" "}
                      {displayDate(trip.endDate)}
                    </Text>
                    {owner &&
                    !snapshot.pending.some(
                      (p) => p.operation.tripId === trip.id,
                    ) ? (
                      <Button
                        title="Uredi putovanje"
                        variant="secondary"
                        disabled={busy}
                        onPress={() => edit(trip)}
                      />
                    ) : null}
                  </View>
                  <View style={ui.inset}>
                    <Text style={ui.subheading}>Offline podaci</Text>
                    <Text style={ui.muted}>
                      {trip.offlinePreparedAt
                        ? "Metapodaci su preuzeti. Fotografije preuzimaš u uspomenama."
                        : "Potpuno preuzimanje još nije potvrđeno."}
                    </Text>
                    {!trip.accessRevoked ? (
                      <Button
                        title="Pripremi za offline"
                        icon="download"
                        disabled={busy || reauth}
                        onPress={() => void syncNow()}
                      />
                    ) : null}
                  </View>
                  {owner ? (
                    <>
                      <Text style={ui.caption}>
                        Brisanje putovanja uklanja ga i za ostale sudionike
                        nakon sinkronizacije.
                      </Text>
                      <Button
                        title="Obriši putovanje"
                        variant="danger"
                        disabled={
                          busy ||
                          snapshot.pending.some(
                            (p) => p.operation.tripId === trip.id,
                          )
                        }
                        onPress={() => remove(trip)}
                      />
                    </>
                  ) : null}
                  {!trip.accessRevoked ? (
                    <Button
                      title="Očisti obrisane fotografije"
                      variant="ghost"
                      disabled={busy || reauth}
                      onPress={() =>
                        void onlineAction(async () => {
                          await sessionClient.request("/api/media/cleanup", {});
                          setMessage("Čišćenje je potvrđeno na serveru.");
                        })
                      }
                    />
                  ) : null}
                </>
              ) : null}
              {!trip && screen === "account" ? (
                <>
                  <Text accessibilityRole="header" style={ui.title}>
                    Tvoj račun
                  </Text>
                  <View style={ui.card}>
                    <Text style={ui.subheading}>{account.email}</Text>
                    <Text style={ui.muted}>
                      Lokalni podaci odvojeni su za svaki račun.
                    </Text>
                  </View>
                  <Button
                    title="Pridruži se putovanju"
                    icon="people"
                    variant="secondary"
                    disabled={busy || reauth}
                    onPress={() => {
                      setJoinOpen(true);
                      setError("");
                    }}
                  />
                  <MenuRow
                    title="Sinkronizacija i problemi"
                    icon="sync"
                    detail={`${pendingCount} promjena na čekanju`}
                    onPress={openSync}
                  />
                  {reauth ? (
                    <Button
                      title="Obnovi prijavu"
                      disabled={busy}
                      onPress={() => setReauthHidden(false)}
                    />
                  ) : null}
                  <Button
                    title="Odjava"
                    variant="danger"
                    disabled={busy}
                    onPress={confirmLogout}
                  />
                  <DeleteAccountPanel client={sessionClient} pending={pendingCount} onDeleted={async pending => { await activeSync.current?.catch(() => {}); await logout(account.scope, pending); }} />
                  <Text style={ui.caption}>
                    Razvojna verzija 0.1.0 · koristi probne podatke. Oporavak
                    lozinke još nije dostupan.
                  </Text>
                </>
              ) : null}
              {!trip && screen === "sync" ? (
                <>
                  <View>
                    <Text style={ui.eyebrow}>PODACI NA SIGURNOM</Text>
                    <Text accessibilityRole="header" style={ui.title}>
                      Sinkronizacija
                    </Text>
                  </View>
                  <View style={ui.inset}>
                    <Text style={ui.heading}>{pendingCount} na čekanju</Text>
                    <Text style={ui.body}>
                      {attention} promjena treba pažnju
                    </Text>
                    <Text style={ui.muted}>
                      Lokalno spremanje radi bez interneta. Za slanje i
                      preuzimanje novih promjena potrebna je veza i aktivna
                      prijava.
                    </Text>
                  </View>
                  <Button
                    title="Sinkroniziraj"
                    icon="sync"
                    disabled={busy || reauth}
                    onPress={() => void syncNow()}
                  />
                  {!attention ? (
                    <Empty
                      icon="check"
                      title={
                        pendingCount
                          ? "Promjene su na uređaju"
                          : "Nema prijavljenih problema"
                      }
                      detail={
                        pendingCount
                          ? "Ponovi sinkronizaciju kad imaš vezu."
                          : "Nove promjene suputnika stižu nakon sljedeće sinkronizacije."
                      }
                    />
                  ) : null}
                  {snapshot.pending
                    .filter((p) => p.error)
                    .map((p) => (
                      <View style={styles.card} key={p.operation.operationId}>
                        <Text style={styles.heading}>
                          {p.conflict
                            ? "Sukob promjena"
                            : "Promjena treba pažnju"}
                        </Text>
                        <Text style={styles.error}>{p.error}</Text>
                        <Text style={styles.body}>
                          Tvoja promjena:{" "}
                          {p.operation.kind === "trip.delete"
                            ? "Brisanje putovanja"
                            : `${p.operation.data?.name} · ${p.operation.data?.destination} · ${p.operation.data?.startDate} — ${p.operation.data?.endDate}`}
                        </Text>
                        {p.conflict && p.error !== ACCESS_REMOVED ? (
                          <>
                            <Text style={styles.body}>
                              Server:{" "}
                              {p.conflict.deleted
                                ? "Putovanje je obrisano"
                                : `${p.conflict.name} · ${p.conflict.destination} · ${p.conflict.startDate} — ${p.conflict.endDate}`}
                            </Text>
                            {button(
                              "Prihvati serversku verziju",
                              () => resolve(p.operation.operationId, "server"),
                              true,
                            )}
                            {!p.conflict.deleted &&
                            (!p.conflict.ownerId ||
                              p.conflict.ownerId === account.id)
                              ? button(
                                  "Zadrži moju promjenu",
                                  () =>
                                    resolve(p.operation.operationId, "local"),
                                  true,
                                )
                              : null}
                          </>
                        ) : (
                          <Text style={styles.body}>
                            Promjena je sačuvana. Pokušaj ponovno
                            sinkronizirati; ako problem ostaje, sačuvaj podatke
                            do podrške.
                          </Text>
                        )}
                      </View>
                    ))}
                  {places.pending
                    .filter((p) => p.error)
                    .map((p) => {
                      const local = places.places.find(
                        (v) => v.id === p.operation.placeId,
                      );
                      const trip = snapshot.trips.find(
                        (t) => t.id === p.operation.tripId,
                      );
                      const describe = (v: typeof local) =>
                        v
                          ? `${v.deleted ? "Brisanje · " : ""}${v.name} · ${v.category} · ${v.visited ? "Posjećeno" : "Za posjetiti"}\n${v.address}\n${v.link}\n${v.notes}\nPoložaj: ${v.location ? `${v.location.displayName} (${v.location.latitude}, ${v.location.longitude})` : "Nije potvrđen"}`
                          : "";
                      return (
                        <View style={styles.card} key={p.operation.operationId}>
                          <Text style={styles.heading}>
                            Promjena mjesta treba pažnju
                          </Text>
                          <Text style={styles.error}>{p.error}</Text>
                          <Text style={styles.body}>
                            Tvoja verzija: {describe(local)}
                          </Text>
                          {p.conflict && p.error !== PLACE_ACCESS_REMOVED ? (
                            <>
                              <Text style={styles.body}>
                                Server: {describe(p.conflict)}
                              </Text>
                              {button(
                                "Prihvati serversko mjesto",
                                () =>
                                  resolvePlace(
                                    p.operation.operationId,
                                    "server",
                                  ),
                                true,
                              )}
                              {!p.conflict.deleted &&
                              trip &&
                              !trip.accessRevoked
                                ? button(
                                    "Zadrži moje mjesto",
                                    () =>
                                      resolvePlace(
                                        p.operation.operationId,
                                        "local",
                                      ),
                                    true,
                                  )
                                : null}
                            </>
                          ) : (
                            <Text style={styles.body}>
                              Podaci ostaju na uređaju. Ponovi sinkronizaciju
                              kada imaš pristup i vezu.
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  {entries.pending
                    .filter((p) => p.error)
                    .map((p) => {
                      const local = entries.entries.find(
                        (e) => e.id === p.operation.entryId,
                      );
                      return (
                        <View style={styles.card} key={p.operation.operationId}>
                          <Text style={styles.heading}>Zapis treba pažnju</Text>
                          <Text style={styles.error}>{p.error}</Text>
                          <Text style={styles.body}>
                            Tvoja verzija: {describeEntry(local)}
                          </Text>
                          {p.conflict && p.error !== ENTRY_ACCESS_REMOVED ? (
                            <>
                              <Text style={styles.body}>
                                Server: {describeEntry(p.conflict)}
                              </Text>
                              {button(
                                "Prihvati serverski zapis",
                                () =>
                                  resolveEntry(
                                    p.operation.operationId,
                                    "server",
                                  ),
                                true,
                              )}
                              {!p.conflict.deleted &&
                              local &&
                              connection.current &&
                              canEditEntry(
                                connection.current.db,
                                local,
                                account,
                              )
                                ? button(
                                    "Zadrži moj zapis",
                                    () =>
                                      resolveEntry(
                                        p.operation.operationId,
                                        "local",
                                      ),
                                    true,
                                  )
                                : null}
                            </>
                          ) : (
                            <Text style={styles.body}>
                              Podaci ostaju na uređaju. Uredi odbijene podatke
                              ili ponovi sinkronizaciju nakon obnove pristupa.
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  {media
                    .filter((m) => m.error)
                    .map((m) => (
                      <View style={styles.card} key={"media-" + m.id}>
                        <Text style={styles.heading}>
                          Fotografija treba pažnju
                        </Text>
                        <Text style={styles.error}>{m.error}</Text>
                        <Text style={styles.body}>
                          Trajna lokalna kopija ostaje na uređaju do potvrđenog
                          prijenosa ili izričitog brisanja.
                        </Text>
                      </View>
                    ))}
                </>
              ) : null}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {account && (!reauth || reauthHidden) ? (
        trip ? (
          <BottomNav
            items={tripTabs}
            value={
              moreSections.includes(section)
                ? "more"
                : (section as "overview" | "plan" | "places" | "expense")
            }
            onChange={navigate}
            disabled={busy}
          />
        ) : (
          <BottomNav
            items={globalTabs}
            value={screen}
            onChange={(next) => {
              setScreen(next);
              setError("");
              setMessage("");
            }}
            disabled={busy}
          />
        )
      ) : null}
      <FormSheet
        title={editing ? "Uredi putovanje" : "Novo putovanje"}
        visible={formOpen && !!account}
        onClose={() => setFormOpen(false)}
        busy={busy}
        error={error}
      >
        <Field
          label="Naziv putovanja"
          placeholder="Kako ćeš pamtiti ovo putovanje?"
          value={input.name}
          maxLength={100}
          editable={!busy}
          onChangeText={(name) => setInput((i) => ({ ...i, name }))}
          error={formErrors.name}
        />
        <Field
          label="Destinacija"
          placeholder="Grad, regija ili država"
          value={input.destination}
          maxLength={120}
          editable={!busy}
          onChangeText={(destination) =>
            setInput((i) => ({ ...i, destination }))
          }
          error={formErrors.destination}
        />
        <DateField
          label="Početak putovanja"
          value={input.startDate}
          disabled={busy}
          onChange={(startDate) =>
            setInput((i) => ({
              ...i,
              startDate,
              endDate:
                !i.endDate || i.endDate < startDate ? startDate : i.endDate,
            }))
          }
          error={formErrors.startDate}
        />
        <DateField
          label="Završetak putovanja"
          value={input.endDate}
          minimum={input.startDate || undefined}
          disabled={busy}
          onChange={(endDate) => setInput((i) => ({ ...i, endDate }))}
          error={formErrors.endDate}
        />
        <Button title="Spremi putovanje" disabled={busy} onPress={save} />
        <Text style={ui.caption}>
          Sprema se na uređaj. Promjene će se poslati nakon povezivanja.
        </Text>
      </FormSheet>
      <FormSheet
        title="Pridruži se putovanju"
        visible={joinOpen && !!account && !reauth}
        onClose={() => setJoinOpen(false)}
        busy={busy}
        error={error}
      >
        <Text style={ui.muted}>
          Unesi kod koji je vlasnik poslao za tvoj račun. Prihvaćanje zahtijeva
          internet.
        </Text>
        <Field
          label="Kod pozivnice"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={64}
          multiline
          editable={!busy}
        />
        <Button
          title="Prihvati pozivnicu"
          disabled={busy}
          onPress={() => void acceptInvitation()}
        />
      </FormSheet>
    </SafeAreaView>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  ...ui,
  header: {
    backgroundColor: tokens.color.surface,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    minHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.border,
    gap: 8,
  },
  statusPill: {
    borderRadius: 14,
    backgroundColor: tokens.color.primarySoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    padding: 8,
  },
  tripCard: {
    padding: 20,
    gap: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderLeftWidth: 4,
    borderLeftColor: tokens.color.primary,
    backgroundColor: tokens.color.surface,
  },
});
