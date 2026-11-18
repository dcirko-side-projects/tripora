import { Alert } from "../../ui/alert";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Linking, Platform, Pressable, Text, View } from "react-native";
import { LocalDatabase } from "../../core/localStore";
import {
  Place,
  PlaceCategory,
  PlaceInput,
  PlaceLocation,
  PlaceSnapshot,
  deletePlace,
  savePlace,
} from "../../core/placeStore";
import { randomUUID } from "expo-crypto";
import { Button, Choice, Empty, Field, FormSheet } from "../../ui/components";
import { Icon } from "../../ui/Icon";
import { ui } from "../../ui/theme";
import { actionError } from "../../core/actionError";
import { ApiClient, ApiError } from "../../core/sync";
import { TripPlacesMap } from "./TripPlacesMap";
import { PlaceDetails } from "./PlaceDetails";
import { PlacesExport } from "./PlacesExport";
import { categoryOptions as categories, markerAppearance } from "./mapPresentation";
import { usePlaceFilters } from "./usePlaceFilters";
const empty = (category: PlaceCategory): PlaceInput => ({
  category,
  name: "",
  notes: "",
  address: "",
  link: "",
  visited: false,
});
type Props = {
  db: LocalDatabase;
  tripId: string;
  snapshot: PlaceSnapshot;
  busy: boolean;
  readOnly: boolean;
  mutate: (action: () => void) => boolean;
  onPlan: (place: Place) => void;
  api?: ApiClient;
  destination?: string;
};
export function PlacesPanel({
  db,
  tripId,
  snapshot,
  busy,
  readOnly,
  mutate,
  onPlan,
  api,
  destination = "",
}: Props) {
  const filters = usePlaceFilters("Pretraži spremljena mjesta");
  const [view, setView] = useState<'list' | 'map'>('list');
  const [city, setCity] = useState(destination);
  const [results, setResults] = useState<PlaceLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchGeneration = useRef(0);
  useEffect(() => () => { searchGeneration.current++; }, []);
  const [input, setInput] = useState(empty("place"));
  const [editing, setEditing] = useState<string>();
  const [form, setForm] = useState(false);
  const [detail, setDetail] = useState<string>();
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const records = snapshot.places.filter(
    (p) =>
      p.tripId === tripId &&
      !p.deleted &&
      filters.matches(p),
  );
  const selected = snapshot.places.find((p) => p.id === detail && !p.deleted);
  function edit(place?: Place) {
    searchGeneration.current++;
    setSearching(false); setResults([]); setSearched(false); setCity(destination);
    setInput(place ?? empty(filters.category === 'all' ? 'place' : filters.category));
    setEditing(place?.id);
    setError("");
    setAdvanced(!!place);
    setForm(true);
    setDetail(undefined);
  }
  function locationQueryChanged() {
    searchGeneration.current++; setSearching(false); setResults([]); setSearched(false); setError('');
  }
  async function findLocation() {
    if (!api || searching || busy || readOnly) return;
    const generation = ++searchGeneration.current;
    setSearching(true); setError(''); setResults([]); setSearched(false);
    try {
      const response = await api.request<{ items: PlaceLocation[] }>('/api/places/search', { tripId, name: input.name.trim(), address: input.address.trim(), city: city.trim() });
      if (generation !== searchGeneration.current) return;
      setResults(response.items); setSearched(true);
    } catch (cause) {
      if (generation !== searchGeneration.current) return;
      setError(cause instanceof ApiError && cause.status === 429 ? 'Pretraga je trenutačno ograničena. Pričekaj pa pokušaj ponovno.'
        : cause instanceof ApiError && cause.status === 404 ? 'Prvo sinkroniziraj putovanje kako bi pretraga bila dostupna.'
        : cause instanceof ApiError && cause.status === 400 ? 'Unesi naziv, adresu ili grad za pretragu.'
        : cause instanceof ApiError && cause.status === 401 ? 'Za pretragu se ponovno prijavi. Nacrt je sačuvan.'
        : 'Pretraga trenutačno nije dostupna. Nacrt je sačuvan; provjeri vezu i pokušaj ponovno.');
    } finally { if (generation === searchGeneration.current) setSearching(false); }
  }
  function save() {
    setError("");
    if (!input.name.trim()) {
      setError("Unesi naziv mjesta.");
      return;
    }
    if (
      mutate(() => {
        try {
          savePlace(db, tripId, input, randomUUID, editing);
        } catch (e) {
          setError(actionError(e));
          throw e;
        }
      })
    ) {
      searchGeneration.current++; setSearching(false);
      setForm(false);
      filters.setCategory(input.category);
      filters.setStatus("all");
    }
  }
  function remove(place: Place) {
    Alert.alert("Obrisati mjesto?", place.name, [
      { text: "Odustani", style: "cancel" },
      {
        text: "Obriši mjesto",
        style: "destructive",
        onPress: () => {
          if (mutate(() => deletePlace(db, place.id, randomUUID)))
            setDetail(undefined);
        },
      },
    ]);
  }
  const queued =
    selected &&
    snapshot.pending.find((p) => p.operation.placeId === selected.id);
  const editable = !readOnly && !queued?.conflict && !queued?.error;
  const closeForm = () => { searchGeneration.current++; setSearching(false); setForm(false); };
  const closeMapSheet = () => {
    if (Platform.OS === 'android' && Keyboard.isVisible()) { Keyboard.dismiss(); return; }
    if (busy) return;
    if (selected) setDetail(undefined);
    else closeForm();
  };
  const editor = (embedded = false) => (
      <FormSheet
        embedded={embedded}
        title={editing ? "Uredi mjesto" : "Novo mjesto"}
        visible={form && !readOnly}
        onClose={closeForm}
        busy={busy}
        error={error}
      >
        <Field
          label="Naziv mjesta"
          value={input.name}
          onChangeText={(name) => { locationQueryChanged(); setInput((i) => ({ ...i, name, location: null })); }}
          maxLength={120}
          editable={!busy}
          error={!input.name.trim() ? error : undefined}
        />
        <Choice
          label="Kategorija"
          options={categories}
          value={input.category}
          onChange={(category) => setInput((i) => ({ ...i, category }))}
          disabled={busy}
        />
        <Field
          label="Adresa"
          optional
          value={input.address}
          onChangeText={(address) => { locationQueryChanged(); setInput((i) => ({ ...i, address, location: null })); }}
          maxLength={300}
          editable={!busy}
        />
        <Field label="Grad ili odredište za pretragu" optional value={city} maxLength={120} editable={!busy}
          onChangeText={(value) => { locationQueryChanged(); setCity(value); setInput(i => ({ ...i, location: null })); }} />
        <Button title={searching ? 'Tražim mjesto…' : 'Pronađi mjesto'} variant="secondary" icon="pin"
          disabled={busy || searching || !api || !(input.name.trim() || input.address.trim() || city.trim())} onPress={() => void findLocation()} />
        <Text style={ui.caption}>Pretraži naziv, javnu adresu ili grad, samostalno ili zajedno. Ti se podaci šalju OpenStreetMap servisu tek na pritisak gumba. Ako naziv nije pronađen, pretražuje se unesena adresa; provjeri rezultat prije odabira.</Text>
        {results.map(result => <Button key={result.providerId} title={result.displayName} variant="secondary" disabled={busy}
          onPress={() => { setInput(i => ({ ...i, name: i.name.trim() ? i.name : result.displayName.split(',')[0].slice(0, 120), address: result.displayName.slice(0, 300), location: result })); setResults([]); setSearched(false); }} />)}
        {searched && !results.length ? <Text style={ui.muted}>Nema rezultata za unesene podatke. Provjeri naziv, adresu i grad ili pokušaj samo s adresom. Položaj nije odabran automatski.</Text> : null}
        {input.location ? <View style={ui.inset}>
          <Text style={ui.subheading}>Potvrđen položaj</Text><Text style={ui.body}>{input.location.displayName}</Text>
          <Button title="Ukloni položaj" variant="ghost" onPress={() => setInput(i => ({ ...i, location: null }))} />
        </View> : <Text style={ui.caption}>Bez potvrđenog rezultata mjesto se sprema u popis i neće imati oznaku na karti.</Text>}
        <Button title="© OpenStreetMap contributors · uvjeti pretrage" variant="ghost" onPress={() => {
          void Linking.openURL('https://operations.osmfoundation.org/policies/nominatim/').catch(() => setError('Poveznica nije otvorena.'));
        }} />
        <Button
          title={
            advanced
              ? "Sakrij dodatne pojedinosti"
              : "Dodaj bilješku ili poveznicu"
          }
          variant="ghost"
          onPress={() => setAdvanced(!advanced)}
        />
        {advanced ? (
          <>
            <Field
              label="Bilješka"
              optional
              value={input.notes}
              multiline
              maxLength={2000}
              onChangeText={(notes) => setInput((i) => ({ ...i, notes }))}
              editable={!busy}
            />
            <Field
              label="Poveznica"
              optional
              placeholder="https://…"
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              value={input.link}
              maxLength={1000}
              onChangeText={(link) => setInput((i) => ({ ...i, link }))}
              editable={!busy}
            />
          </>
        ) : null}
        <Choice
          label="Status posjeta"
          options={
            [
              ["planned", "Za posjetiti"],
              ["visited", "Posjećeno"],
            ] as const
          }
          value={input.visited ? "visited" : "planned"}
          onChange={(v) =>
            setInput((i) => ({ ...i, visited: v === "visited" }))
          }
          disabled={busy}
        />
        <Button title="Spremi mjesto" disabled={busy || searching} onPress={save} />
        <Text style={ui.caption}>Spremanje radi i bez interneta.</Text>
      </FormSheet>
  );
  const details = (embedded = false) => (
      <FormSheet
        title="Detalji mjesta"
        embedded={embedded}
        visible={!!selected}
        onClose={() => setDetail(undefined)}
        busy={busy}
        error={error}
      >
        {selected ? (
          <>
            <PlaceDetails place={selected} onError={setError} />
            <Text style={ui.caption}>
              {queued
                ? (queued.error ?? "Spremljeno na uređaju · čeka slanje")
                : readOnly
                  ? "Prethodno preuzeto"
                  : "Sinkronizirano"}
            </Text>
            {!readOnly ? (
              <Button
                title="Dodaj u dnevni plan"
                icon="calendar"
                disabled={busy}
                onPress={() => {
                  setDetail(undefined);
                  onPlan(selected);
                }}
              />
            ) : null}
            {editable ? (
              <>
                <Button
                  title={
                    selected.visited
                      ? "Vrati na popis za posjetiti"
                      : "Označi posjećenim"
                  }
                  icon="check"
                  variant="secondary"
                  disabled={busy}
                  onPress={() =>
                    mutate(() =>
                      savePlace(
                        db,
                        tripId,
                        { ...selected, visited: !selected.visited },
                        randomUUID,
                        selected.id,
                      ),
                    )
                  }
                />
                <View style={ui.row}>
                  <Button
                    title="Uredi mjesto"
                    variant="ghost"
                    disabled={busy}
                    onPress={() => edit(selected)}
                  />
                  <Button
                    title="Obriši mjesto"
                    variant="danger"
                    disabled={busy}
                    onPress={() => remove(selected)}
                  />
                </View>
              </>
            ) : null}
          </>
        ) : null}
      </FormSheet>
  );
  return (
    <View style={ui.panel}>
      <View>
        <Text style={ui.eyebrow}>ISTRAŽI ODREDIŠTE</Text>
        <Text accessibilityRole="header" style={ui.title}>
          Tvoja mjesta
        </Text>
      </View>
      <Choice options={[["list", "Popis"], ["map", "Karta"]] as const} value={view} onChange={setView} />
      {view === "list" ? filters.inline : null}
      {!readOnly ? (
        <Button
          title="Dodaj mjesto"
          icon="plus"
          disabled={busy}
          onPress={() => edit()}
        />
      ) : (
        <Text style={ui.muted}>
          Preuzeta kopija · pristup za izmjene je uklonjen.
        </Text>
      )}
      {view === 'map' ? <TripPlacesMap places={records} api={api} filters={filters.inline} fullscreenSearch={filters.fullscreenSearch} fullscreenFilters={filters.fullscreenFilters} overlay={selected ? details : form && !readOnly ? editor : undefined} onCloseOverlay={closeMapSheet} onSelect={(id) => { setDetail(id); setError(''); }} /> : !records.length ? (
        <Empty
          icon="pin"
          title="Ovdje počinje istraživanje"
          detail="Spremi mjesto, restoran ili izlazak koji ne želiš propustiti."
        />
      ) : (
        <View>
          {records.map((place) => (
            <Pressable
              key={place.id}
              accessibilityRole="button"
              accessibilityLabel={`Otvori mjesto ${place.name}`}
              onPress={() => {
                setDetail(place.id);
                setError("");
              }}
              style={[ui.item, ui.between]}
            >
              <Icon name={markerAppearance(place.category).icon} color={markerAppearance(place.category).color} />
              <View style={ui.flex}>
                <Text style={ui.subheading}>{place.name}</Text>
                <Text style={ui.muted}>
                  {place.visited ? "Posjećeno" : "Za posjetiti"}
                  {place.address ? ` · ${place.address}` : ""}
                </Text>
                {!place.location ? <Text style={ui.caption}>Bez položaja na karti · pronađi mjesto u obrascu</Text> : null}
                {snapshot.pending.some(
                  (p) => p.operation.placeId === place.id,
                ) ? (
                  <Text style={ui.caption}>
                    Spremljeno na uređaju · čeka slanje
                  </Text>
                ) : null}
              </View>
              <Icon name="next" size={18} />
            </Pressable>
          ))}
        </View>
      )}
      {view === "list" ? editor() : null}
      {view === "list" ? details() : null}
      {!readOnly ? (
        <PlacesExport db={db} scope={{ kind: "trip", tripId }} title="Izvezi mjesta putovanja"
          description="Sva spremljena mjesta ovog putovanja, uključujući mjesta izvan plana." />
      ) : null}
    </View>
  );
}
