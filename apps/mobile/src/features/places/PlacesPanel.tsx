import { useEffect, useRef, useState } from "react";
import { Alert, Linking, Pressable, Text, View } from "react-native";
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
const categories = [
  ["place", "Mjesta"],
  ["food", "Hrana"],
  ["nightlife", "Izlasci"],
] as const;
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
  const [category, setCategory] = useState<PlaceCategory | 'all'>("all");
  const [view, setView] = useState<'list' | 'map'>('list');
  const [city, setCity] = useState(destination);
  const [results, setResults] = useState<PlaceLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const searchGeneration = useRef(0);
  useEffect(() => () => { searchGeneration.current++; }, []);
  const [filter, setFilter] = useState<"all" | "planned" | "visited">("all");
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
      (category === 'all' || p.category === category) &&
      (filter === "all" || p.visited === (filter === "visited")),
  );
  const selected = snapshot.places.find((p) => p.id === detail && !p.deleted);
  function edit(place?: Place) {
    searchGeneration.current++;
    setSearching(false); setResults([]); setSearched(false); setCity(destination);
    setInput(place ?? empty(category === 'all' ? 'place' : category));
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
      const response = await api.request<{ items: PlaceLocation[] }>('/api/places/search', { tripId, name: input.name.trim(), city: city.trim() });
      if (generation !== searchGeneration.current) return;
      setResults(response.items); setSearched(true);
    } catch (cause) {
      if (generation !== searchGeneration.current) return;
      setError(cause instanceof ApiError && cause.status === 429 ? 'Pretraga je trenutačno ograničena. Pričekaj pa pokušaj ponovno.'
        : cause instanceof ApiError && cause.status === 404 ? 'Prvo sinkroniziraj putovanje kako bi pretraga bila dostupna.'
        : 'Mjesto nije pronađeno jer pretraga nije dostupna. Nacrt je sačuvan; provjeri vezu i pokušaj ponovno.');
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
      setCategory(input.category);
      setFilter("all");
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
  return (
    <View style={ui.panel}>
      <View>
        <Text style={ui.eyebrow}>ISTRAŽI ODREDIŠTE</Text>
        <Text accessibilityRole="header" style={ui.title}>
          Tvoja mjesta
        </Text>
      </View>
      <Choice options={[["list", "Popis"], ["map", "Karta"]] as const} value={view} onChange={setView} />
      <Choice options={[["all", "Sve kategorije"], ...categories] as const} value={category} onChange={setCategory} />
      <Choice
        options={
          [
            ["all", "Sve"],
            ["planned", "Za posjetiti"],
            ["visited", "Posjećeno"],
          ] as const
        }
        value={filter}
        onChange={setFilter}
      />
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
      {view === 'map' ? <TripPlacesMap places={records} api={api} onSelect={(id) => { setDetail(id); setError(''); }} /> : !records.length ? (
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
      <FormSheet
        title={editing ? "Uredi mjesto" : "Novo mjesto"}
        visible={form && !readOnly}
        onClose={() => { searchGeneration.current++; setSearching(false); setForm(false); }}
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
        <Field label="Grad ili odredište za pretragu" value={city} maxLength={120} editable={!busy}
          onChangeText={(value) => { locationQueryChanged(); setCity(value); setInput(i => ({ ...i, location: null })); }} />
        <Button title={searching ? 'Tražim mjesto…' : 'Pronađi mjesto'} variant="secondary" icon="pin"
          disabled={busy || searching || !api || !input.name.trim() || !city.trim()} onPress={() => void findLocation()} />
        <Text style={ui.caption}>Pretražuje se naziv uz grad. Ako treba, u naziv dodaj ulicu ili broj. Naziv i grad šalju se OpenStreetMap servisu tek na pritisak gumba.</Text>
        {results.map(result => <Button key={result.providerId} title={result.displayName} variant="secondary" disabled={busy}
          onPress={() => { setInput(i => ({ ...i, address: result.displayName.slice(0, 300), location: result })); setResults([]); setSearched(false); }} />)}
        {searched && !results.length ? <Text style={ui.muted}>Nema rezultata. Dopuni naziv ulicom ili provjeri grad. Položaj nije odabran automatski.</Text> : null}
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
      <FormSheet
        title="Detalji mjesta"
        visible={!!selected}
        onClose={() => setDetail(undefined)}
        busy={busy}
        error={error}
      >
        {selected ? (
          <>
            <Text style={ui.eyebrow}>
              {categories.find(([key]) => key === selected.category)?.[1]}
            </Text>
            <Text style={ui.title}>{selected.name}</Text>
            <Text style={ui.muted}>
              {selected.visited ? "Posjećeno" : "Za posjetiti"}
            </Text>
            {selected.location ? <>
              <Text style={ui.body}>{selected.location.displayName}</Text>
              <Text style={ui.caption}>Podaci o položaju: © OpenStreetMap contributors</Text>
              <Button title="Otvori navigaciju" variant="secondary" onPress={() => {
                const p = selected.location!;
                void Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`).catch(() => setError('Navigacija nije otvorena. Provjeri internet.'));
              }} />
            </> : <Text style={ui.muted}>Položaj još nije potvrđen. Odaberi „Uredi mjesto” pa „Pronađi mjesto”.</Text>}
            {selected.address ? (
              <Text selectable style={ui.body}>
                {selected.address}
              </Text>
            ) : null}
            {selected.notes ? (
              <Text style={ui.body}>{selected.notes}</Text>
            ) : null}
            <Text style={ui.caption}>
              {queued
                ? (queued.error ?? "Spremljeno na uređaju · čeka slanje")
                : readOnly
                  ? "Prethodno preuzeto"
                  : "Sinkronizirano"}
            </Text>
            {selected.link ? (
              <Button
                title="Otvori poveznicu"
                variant="secondary"
                onPress={() => {
                  void Linking.openURL(selected.link).catch(() =>
                    setError(
                      "Poveznica nije otvorena. Provjeri vezu s internetom.",
                    ),
                  );
                }}
              />
            ) : null}
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
    </View>
  );
}
