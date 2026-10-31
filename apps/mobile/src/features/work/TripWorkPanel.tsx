import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { randomUUID } from "expo-crypto";
import { LocalDatabase } from "../../core/localStore";
import {
  Actor,
  BudgetData,
  Entry,
  EntrySnapshot,
  ExpenseData,
  MemoryData,
  PlanData,
  canEditEntry,
  deleteEntry,
  formatMoney,
  minorUnits,
  saveEntry,
  tripTotals,
} from "../../core/entryStore";
import { SyncedTrip } from "../../core/accountStore";
import { Place, PlaceSnapshot } from "../../core/placeStore";
import {
  LocalMedia,
  MediaIO,
  attachPhoto,
  discardUnattachedPhoto,
  downloadPhoto,
} from "../../core/mediaQueue";
import { ApiClient } from "../../core/sync";
import { Button, Choice, Empty, Field, FormSheet } from "../../ui/components";
import { DateField } from "../../ui/DateField";
import { calendarDate, dateValue, displayDate, tripDays } from "../../ui/dates";
import { Icon } from "../../ui/Icon";
import { tokens, ui } from "../../ui/theme";
import { actionError } from "../../core/actionError";
export type WorkSection = "plan" | "packing" | "expense" | "memory";
type Props = {
  db: LocalDatabase;
  trip: SyncedTrip;
  actor: Actor;
  snapshot: EntrySnapshot;
  places: PlaceSnapshot;
  media: LocalMedia[];
  io: MediaIO;
  api: ApiClient;
  busy: boolean;
  error?: string;
  mutate: (action: () => void) => boolean;
  perform: (action: () => Promise<void>, online?: boolean) => Promise<boolean>;
  section: WorkSection;
  planPlace?: Place;
  onSeedUsed?: () => void;
};
function Status({ entry, p }: { entry: Entry; p: Props }) {
  const pending = p.snapshot.pending.find(
    (v) => v.operation.entryId === entry.id,
  );
  return (
    <Text style={ui.caption}>
      {pending
        ? (pending.error ?? "Spremljeno na uređaju · čeka slanje")
        : p.trip.accessRevoked
          ? "Prethodno preuzeto"
          : "Sinkronizirano"}
    </Text>
  );
}
function editable(entry: Entry, p: Props) {
  const pending = p.snapshot.pending.find(
    (v) => v.operation.entryId === entry.id,
  );
  return (
    canEditEntry(p.db, entry, p.actor) &&
    !pending?.conflict &&
    (!pending?.error || pending.error.startsWith("Podaci nisu prihvaćeni."))
  );
}
function remove(entry: Entry, p: Props, done: () => void) {
  Alert.alert(
    "Obrisati zapis?",
    entry.feature === "budget" ? "Budžet" : entry.data.title,
    [
      { text: "Odustani", style: "cancel" },
      {
        text: "Obriši zapis",
        style: "destructive",
        onPress: () => {
          if (p.mutate(() => deleteEntry(p.db, entry.id, p.actor, randomUUID)))
            done();
        },
      },
    ],
  );
}
function commit(
  p: Props,
  setError: (value: string) => void,
  action: () => void,
) {
  setError("");
  return p.mutate(() => {
    try {
      action();
    } catch (e) {
      setError(actionError(e));
      throw e;
    }
  });
}
function PlaceChoice({
  p,
  value,
  onChange,
}: {
  p: Props;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const places = p.places.places.filter(
    (v) => v.tripId === p.trip.id && !v.deleted,
  );
  return (
    <View style={{ gap: 8 }}>
      <Button
        title={
          value
            ? `Mjesto: ${places.find((v) => v.id === value)?.name ?? "Nije dostupno"}`
            : "Poveži spremljeno mjesto"
        }
        icon="pin"
        variant="secondary"
        disabled={p.busy}
        onPress={() => setOpen(!open)}
      />
      {open ? (
        <View style={ui.inset}>
          <Button
            title="Bez povezanog mjesta"
            variant="ghost"
            onPress={() => {
              onChange(null);
              setOpen(false);
            }}
          />
          {places.map((v) => (
            <Button
              key={v.id}
              title={`Poveži: ${v.name}`}
              variant="ghost"
              onPress={() => {
                onChange(v.id);
                setOpen(false);
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
export function TripWorkPanel(p: Props) {
  return p.section === "plan" ? (
    <PlanPanel {...p} />
  ) : p.section === "packing" ? (
    <PackingPanel {...p} />
  ) : p.section === "expense" ? (
    <ExpensePanel {...p} />
  ) : (
    <MemoryPanel {...p} />
  );
}
function PlanPanel(p: Props) {
  const today = dateValue(new Date());
  const [day, setDay] = useState(
    today >= p.trip.startDate && today <= p.trip.endDate
      ? today
      : p.trip.startDate,
  );
  const blank = (): PlanData => ({
    title: "",
    notes: "",
    date: day,
    time: "",
    category: "activity",
    placeId: null,
    done: false,
  });
  const [input, setInput] = useState<PlanData>(() =>
    p.planPlace
      ? { ...blank(), title: p.planPlace.name, placeId: p.planPlace.id }
      : blank(),
  );
  const [editing, setEditing] = useState<string>();
  const [form, setForm] = useState(!!p.planPlace);
  const [detail, setDetail] = useState<string>();
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const records = p.snapshot.entries
    .filter(
      (e): e is Extract<Entry, { feature: "plan" }> =>
        e.feature === "plan" && e.tripId === p.trip.id && !e.deleted,
    )
    .sort(
      (a, b) =>
        a.data.time.localeCompare(b.data.time) || a.id.localeCompare(b.id),
    );
  const selected = records.find((e) => e.id === detail);
  const days = tripDays(p.trip.startDate, p.trip.endDate);
  const shown = records.filter((e) => e.data.date === day);
  function close() {
    setForm(false);
    p.onSeedUsed?.();
  }
  function edit(entry?: Extract<Entry, { feature: "plan" }>) {
    setInput(entry?.data ?? blank());
    setEditing(entry?.id);
    setError("");
    setAdvanced(!!entry);
    setDetail(undefined);
    setForm(true);
  }
  function save() {
    if (!input.title.trim()) {
      setError("Unesi naslov aktivnosti.");
      return;
    }
    if (
      commit(p, setError, () =>
        saveEntry(p.db, p.trip.id, "plan", input, p.actor, randomUUID, editing),
      )
    ) {
      setDay(input.date);
      close();
    }
  }
  return (
    <View style={ui.panel}>
      <View>
        <Text style={ui.eyebrow}>DAN PO DAN</Text>
        <Text accessibilityRole="header" style={ui.title}>
          Dnevni plan
        </Text>
        <Text style={ui.muted}>Vrijeme vrijedi za odredište putovanja.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={ui.row}>
          {days.map((date, index) => (
            <Pressable
              key={date}
              accessibilityRole="tab"
              accessibilityLabel={`Dan ${displayDate(date)}`}
              accessibilityState={{ selected: day === date }}
              onPress={() => setDay(date)}
              style={{
                minWidth: 64,
                padding: 12,
                borderRadius: 12,
                backgroundColor:
                  day === date ? tokens.color.primary : tokens.color.background,
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: day === date ? tokens.color.onPrimary : tokens.color.muted,
                }}
              >
                DAN {index + 1}
              </Text>
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: "700",
                  color: day === date ? tokens.color.onPrimary : tokens.color.text,
                }}
              >
                {calendarDate(date).getDate()}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: day === date ? tokens.color.onPrimary : tokens.color.muted,
                }}
              >
                {calendarDate(date).toLocaleDateString("hr-HR", {
                  month: "short",
                })}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={ui.between}>
        <Text style={ui.subheading}>
          {day ? displayDate(day) : "Neraspoređeno"}
        </Text>
        <Button
          title="Neraspoređeno"
          variant={day === "" ? "secondary" : "ghost"}
          onPress={() => setDay("")}
        />
      </View>
      {days.length === 366 ? (
        <DateField
          label="Prikaži drugi dan"
          value={day}
          minimum={p.trip.startDate}
          maximum={p.trip.endDate}
          onChange={setDay}
        />
      ) : null}
      {!p.trip.accessRevoked ? (
        <Button
          title="Dodaj aktivnost"
          icon="plus"
          disabled={p.busy}
          onPress={() => edit()}
        />
      ) : null}
      {!shown.length ? (
        <Empty
          icon="calendar"
          title="Prostor za nove doživljaje"
          detail={
            day
              ? "Dodaj aktivnost za odabrani dan ili pogledaj neraspoređene stavke."
              : "Ovdje su ideje kojima još nisi odabrao dan."
          }
        />
      ) : (
        <View>
          {shown.map((e) => (
            <Pressable
              key={e.id}
              accessibilityRole="button"
              accessibilityLabel={`Otvori aktivnost ${e.data.title}`}
              onPress={() => setDetail(e.id)}
              style={[ui.item, ui.row]}
            >
              <View
                style={{
                  width: 54,
                  alignSelf: "stretch",
                  borderRightWidth: 2,
                  borderColor: tokens.color.primarySoft,
                  paddingRight: 8,
                }}
              >
                <Text style={[ui.subheading, { color: tokens.color.primaryInk }]}>
                  {e.data.time || "—"}
                </Text>
              </View>
              <View style={ui.flex}>
                <Text
                  style={[
                    ui.subheading,
                    e.data.done && {
                      textDecorationLine: "line-through",
                      color: tokens.color.muted,
                    },
                  ]}
                >
                  {e.data.title}
                </Text>
                <Text style={ui.muted}>
                  {e.data.category === "stay"
                    ? "Smještaj"
                    : e.data.category === "transport"
                      ? "Prijevoz"
                      : "Aktivnost"}
                  {e.data.done ? " · Dovršeno" : ""}
                </Text>
                <Status entry={e} p={p} />
              </View>
              <Icon name="next" size={18} />
            </Pressable>
          ))}
        </View>
      )}
      {records.some(
        (e) =>
          e.data.date &&
          (e.data.date < p.trip.startDate || e.data.date > p.trip.endDate),
      ) ? (
        <View style={ui.errorBox}>
          <Text style={ui.error}>
            Neke aktivnosti su izvan datuma putovanja.
          </Text>
          {records
            .filter(
              (e) =>
                e.data.date &&
                (e.data.date < p.trip.startDate ||
                  e.data.date > p.trip.endDate),
            )
            .map((e) => (
              <Button
                key={e.id}
                title={`Prilagodi: ${e.data.title}`}
                variant="ghost"
                onPress={() => setDetail(e.id)}
              />
            ))}
        </View>
      ) : null}
      <FormSheet
        title={editing ? "Uredi aktivnost" : "Nova aktivnost"}
        visible={form && !p.trip.accessRevoked}
        onClose={close}
        busy={p.busy}
        error={error || p.error}
      >
        <Field
          label="Naslov aktivnosti"
          value={input.title}
          maxLength={160}
          editable={!p.busy}
          onChangeText={(title) => setInput((i) => ({ ...i, title }))}
          error={!input.title.trim() ? error : undefined}
        />
        <DateField
          label="Datum aktivnosti"
          value={input.date}
          optional
          minimum={p.trip.startDate}
          maximum={p.trip.endDate}
          disabled={p.busy}
          onChange={(date) =>
            setInput((i) => ({ ...i, date, time: date ? i.time : "" }))
          }
        />
        <DateField
          label="Vrijeme aktivnosti"
          value={input.time}
          optional
          mode="time"
          disabled={p.busy || !input.date}
          onChange={(time) => setInput((i) => ({ ...i, time }))}
        />
        <Choice
          label="Vrsta"
          options={
            [
              ["activity", "Aktivnost"],
              ["transport", "Prijevoz"],
              ["stay", "Smještaj"],
            ] as const
          }
          value={input.category}
          onChange={(category) => setInput((i) => ({ ...i, category }))}
          disabled={p.busy}
        />
        <PlaceChoice
          p={p}
          value={input.placeId}
          onChange={(placeId) => setInput((i) => ({ ...i, placeId }))}
        />
        <Button
          title={advanced ? "Sakrij bilješku" : "Dodaj bilješku"}
          variant="ghost"
          onPress={() => setAdvanced(!advanced)}
        />
        {advanced ? (
          <Field
            label="Bilješka aktivnosti"
            optional
            multiline
            value={input.notes}
            onChangeText={(notes) => setInput((i) => ({ ...i, notes }))}
            editable={!p.busy}
          />
        ) : null}
        <Button title="Spremi aktivnost" disabled={p.busy} onPress={save} />
      </FormSheet>
      <FormSheet
        title="Aktivnost"
        visible={!!selected}
        onClose={() => setDetail(undefined)}
        busy={p.busy}
        error={p.error}
      >
        {selected ? (
          <>
            <Text style={ui.title}>{selected.data.title}</Text>
            <Text style={ui.body}>
              {selected.data.date
                ? displayDate(selected.data.date)
                : "Neraspoređeno"}
              {selected.data.time ? ` · ${selected.data.time}` : ""}
            </Text>
            {selected.data.notes ? (
              <Text style={ui.body}>{selected.data.notes}</Text>
            ) : null}
            {selected.data.placeId ? (
              <Text style={ui.muted}>
                Mjesto:{" "}
                {p.places.places.find(
                  (v) => v.id === selected.data.placeId && !v.deleted,
                )?.name ?? "Obrisano ili nije dostupno"}
              </Text>
            ) : null}
            <Status entry={selected} p={p} />
            {editable(selected, p) ? (
              <>
                <Button
                  title={
                    selected.data.done
                      ? "Vrati aktivnost u plan"
                      : "Označi aktivnost dovršenom"
                  }
                  icon="check"
                  onPress={() =>
                    p.mutate(() =>
                      saveEntry(
                        p.db,
                        p.trip.id,
                        "plan",
                        { ...selected.data, done: !selected.data.done },
                        p.actor,
                        randomUUID,
                        selected.id,
                      ),
                    )
                  }
                  disabled={p.busy}
                />
                <Button
                  title="Uredi aktivnost"
                  variant="secondary"
                  disabled={p.busy}
                  onPress={() => edit(selected)}
                />
                <Button
                  title="Obriši aktivnost"
                  variant="danger"
                  disabled={p.busy}
                  onPress={() =>
                    remove(selected, p, () => setDetail(undefined))
                  }
                />
              </>
            ) : null}
          </>
        ) : null}
      </FormSheet>
    </View>
  );
}
function PackingPanel(p: Props) {
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<string>();
  const [error, setError] = useState("");
  const records = p.snapshot.entries.filter(
    (e): e is Extract<Entry, { feature: "packing" }> =>
      e.feature === "packing" &&
      e.tripId === p.trip.id &&
      e.authorId === p.actor.id &&
      !e.deleted,
  );
  const selected = records.find((e) => e.id === editing);
  const packed = records.filter((e) => e.data.packed).length;
  function save() {
    if (!title.trim()) {
      setError("Unesi stvar za ponijeti.");
      return;
    }
    if (
      commit(p, setError, () =>
        saveEntry(
          p.db,
          p.trip.id,
          "packing",
          { title, packed: selected?.data.packed ?? false },
          p.actor,
          randomUUID,
          editing,
        ),
      )
    ) {
      setTitle("");
      setEditing(undefined);
    }
  }
  return (
    <View style={ui.panel}>
      <View>
        <Text style={ui.eyebrow}>SAMO ZA TEBE</Text>
        <Text accessibilityRole="header" style={ui.title}>
          Moja packing lista
        </Text>
        <Text style={ui.muted}>Tvoju listu ne vide drugi sudionici.</Text>
      </View>
      <View style={ui.inset}>
        <Text style={ui.subheading}>
          {packed} od {records.length} spakirano
        </Text>
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: records.length || 1, now: packed }}
          style={{ height: 6, borderRadius: 3, backgroundColor: tokens.color.surface }}
        >
          <View
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: tokens.color.primary,
              width: `${records.length ? (packed / records.length) * 100 : 0}%`,
            }}
          />
        </View>
      </View>
      {!p.trip.accessRevoked && !editing ? (
        <View style={{ gap: 8 }}>
          <Field
            label="Stvar za ponijeti"
            placeholder="Što nosiš sa sobom?"
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={save}
            returnKeyType="done"
            editable={!p.busy}
            error={error}
          />
          <Button
            title="Dodaj na packing listu"
            icon="plus"
            disabled={p.busy}
            onPress={save}
          />
        </View>
      ) : null}
      {!records.length ? (
        <Empty
          icon="packing"
          title="Spakiraj se bez brige"
          detail="Dodaj prvu stvar. Popis ti je dostupan i bez interneta."
        />
      ) : (
        <View>
          {[...records]
            .sort((a, b) => Number(a.data.packed) - Number(b.data.packed))
            .map((e) => (
              <View key={e.id} style={[ui.item, ui.row]}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel={e.data.title}
                  accessibilityState={{
                    checked: e.data.packed,
                    disabled: p.busy || !editable(e, p),
                  }}
                  disabled={p.busy || !editable(e, p)}
                  onPress={() =>
                    p.mutate(() =>
                      saveEntry(
                        p.db,
                        p.trip.id,
                        "packing",
                        { ...e.data, packed: !e.data.packed },
                        p.actor,
                        randomUUID,
                        e.id,
                      ),
                    )
                  }
                  style={[ui.row, ui.flex, { minHeight: 48 }]}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      borderWidth: 1,
                      borderColor: e.data.packed
                        ? tokens.color.primary
                        : tokens.color.muted,
                      backgroundColor: e.data.packed
                        ? tokens.color.primary
                        : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {e.data.packed ? (
                      <Icon name="check" color={tokens.color.onPrimary} size={18} />
                    ) : null}
                  </View>
                  <View style={ui.flex}>
                    <Text
                      style={[
                        ui.body,
                        e.data.packed && {
                          textDecorationLine: "line-through",
                          color: tokens.color.muted,
                        },
                      ]}
                    >
                      {e.data.title}
                    </Text>
                    <Status entry={e} p={p} />
                  </View>
                </Pressable>
                {editable(e, p) ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Uredi ${e.data.title}`}
                    accessibilityState={{ disabled: p.busy }}
                    disabled={p.busy}
                    style={{
                      minWidth: 48,
                      minHeight: 48,
                      flexShrink: 0,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onPress={() => {
                      setTitle(e.data.title);
                      setEditing(e.id);
                      setError("");
                    }}
                  >
                    <Icon name="more" color={tokens.color.primary} />
                  </Pressable>
                ) : null}
              </View>
            ))}
        </View>
      )}
      <FormSheet
        title="Uredi packing stavku"
        visible={!!selected}
        onClose={() => {
          setEditing(undefined);
          setTitle("");
          setError("");
        }}
        busy={p.busy}
        error={error || p.error}
      >
        <Field
          label="Stvar za ponijeti"
          value={title}
          onChangeText={setTitle}
          editable={!p.busy}
        />
        <Button title="Spremi stavku" disabled={p.busy} onPress={save} />
        {selected ? (
          <Button
            title="Obriši packing stavku"
            variant="danger"
            disabled={p.busy}
            onPress={() =>
              remove(selected, p, () => {
                setEditing(undefined);
                setTitle("");
              })
            }
          />
        ) : null}
      </FormSheet>
    </View>
  );
}
function ExpensePanel(p: Props) {
  const settings = p.snapshot.entries.find(
    (e) => e.id === p.trip.id && e.feature === "budget" && !e.deleted,
  );
  const budget = settings?.feature === "budget" ? settings.data : null;
  const owner = p.trip.ownerId
    ? p.trip.ownerId === p.actor.id
    : p.trip.role !== "member";
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [currency, setCurrency] = useState<BudgetData["currency"]>("EUR");
  const [limit, setLimit] = useState("");
  const blank = (): ExpenseData => ({
    title: "",
    notes: "",
    date: dateValue(new Date()),
    category: "ostalo",
    amountMinor: "",
    currency: budget?.currency ?? "EUR",
    payer: "",
  });
  const [input, setInput] = useState(blank);
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState<string>();
  const [form, setForm] = useState(false);
  const [detail, setDetail] = useState<string>();
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [breakdown, setBreakdown] = useState<"category" | "author" | "payer">(
    "category",
  );
  const records = p.snapshot.entries
    .filter(
      (e): e is Extract<Entry, { feature: "expense" }> =>
        e.feature === "expense" && e.tripId === p.trip.id && !e.deleted,
    )
    .sort(
      (a, b) =>
        b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id),
    );
  const selected = records.find((e) => e.id === detail);
  let totals: ReturnType<typeof tripTotals> = null;
  let totalError = "";
  try {
    totals = tripTotals(p.db, p.trip.id);
  } catch {
    totalError = "Valute nisu usklađene. Provjeri sukobe prije zbroja.";
  }
  const groups = new Map<string, bigint>();
  if (!totalError)
    for (const e of records) {
      const key =
        breakdown === "category"
          ? e.data.category
          : breakdown === "payer"
            ? e.data.payer || "Platitelj nije naveden"
            : e.authorEmail || e.authorId;
      groups.set(key, (groups.get(key) ?? 0n) + BigInt(e.data.amountMinor));
    }
  function edit(e?: Extract<Entry, { feature: "expense" }>) {
    setInput(e?.data ?? blank());
    setAmount(e ? formatMoney(e.data.amountMinor, "").trim() : "");
    setEditing(e?.id);
    setDetail(undefined);
    setAdvanced(!!e);
    setError("");
    setForm(true);
  }
  function save() {
    if (!input.title.trim()) {
      setError("Unesi naziv troška.");
      return;
    }
    if (
      commit(p, setError, () =>
        saveEntry(
          p.db,
          p.trip.id,
          "expense",
          {
            ...input,
            currency: budget!.currency,
            amountMinor: minorUnits(amount),
          },
          p.actor,
          randomUUID,
          editing,
        ),
      )
    )
      setForm(false);
  }
  return (
    <View style={ui.panel}>
      <View>
        <Text style={ui.eyebrow}>POTROŠNJA POD KONTROLOM</Text>
        <Text accessibilityRole="header" style={ui.title}>
          Troškovi i budžet
        </Text>
      </View>
      {totalError ? (
        <Text style={ui.error}>{totalError}</Text>
      ) : totals ? (
        <View style={ui.inset}>
          <Text style={ui.muted}>Ukupno potrošeno</Text>
          <Text style={ui.title}>
            {formatMoney(totals.spent, totals.currency)}
          </Text>
          <View style={ui.between}>
            <View>
              <Text style={ui.caption}>Budžet</Text>
              <Text style={ui.subheading}>
                {totals.budget === null
                  ? "Bez ograničenja"
                  : formatMoney(totals.budget, totals.currency)}
              </Text>
            </View>
            <View>
              <Text style={ui.caption}>Preostalo</Text>
              <Text
                style={[
                  ui.subheading,
                  totals.remaining !== null &&
                    BigInt(totals.remaining) < 0n && {
                      color: tokens.color.danger,
                    },
                ]}
              >
                {totals.remaining === null
                  ? "—"
                  : formatMoney(totals.remaining, totals.currency)}
              </Text>
            </View>
          </View>
          <Text style={ui.caption}>
            Uključene su i promjene spremljene samo na uređaju.
          </Text>
        </View>
      ) : (
        <Empty
          icon="wallet"
          title="Postavi okvir putovanja"
          detail={
            owner
              ? "Odaberi valutu i, ako želiš, budžet."
              : "Vlasnik treba postaviti valutu prije prvog troška."
          }
        />
      )}
      {budget && !p.trip.accessRevoked ? (
        <Button
          title="Dodaj trošak"
          icon="plus"
          disabled={p.busy}
          onPress={() => edit()}
        />
      ) : null}
      {owner && !p.trip.accessRevoked ? (
        <Button
          title={budget ? "Uredi budžet" : "Postavi valutu i budžet"}
          variant="ghost"
          disabled={p.busy}
          onPress={() => {
            setCurrency(budget?.currency ?? "EUR");
            setLimit(
              budget?.budgetMinor !== null && budget?.budgetMinor !== undefined
                ? formatMoney(budget.budgetMinor, "").trim()
                : "",
            );
            setError("");
            setBudgetOpen(true);
          }}
        />
      ) : null}
      {records.length > 0 && !totalError ? (
        <View style={{ gap: 12 }}>
          <Text style={ui.subheading}>Pregled potrošnje</Text>
          <Choice
            options={
              [
                ["category", "Kategorije"],
                ["author", "Sudionici"],
                ["payer", "Platitelji"],
              ] as const
            }
            value={breakdown}
            onChange={setBreakdown}
          />
          {breakdown === "author" ? (
            <Text style={ui.caption}>Prema osobi koja je unijela trošak.</Text>
          ) : null}
          {[...groups].map(([label, value]) => (
            <View key={label} style={ui.between}>
              <Text style={[ui.muted, ui.flex]}>{label}</Text>
              <Text style={ui.body}>
                {formatMoney(value.toString(), budget?.currency ?? "EUR")}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={ui.subheading}>Svi troškovi</Text>
      {!records.length ? (
        <Text style={ui.muted}>
          Još nema troškova. Dodaj prvi kad nešto platiš.
        </Text>
      ) : (
        records.map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityLabel={`Otvori trošak ${e.data.title}`}
            onPress={() => setDetail(e.id)}
            style={[ui.item, ui.between]}
          >
            <View style={ui.flex}>
              <Text style={ui.subheading}>{e.data.title}</Text>
              <Text style={ui.muted}>
                {displayDate(e.data.date)} · {e.data.category}
              </Text>
              <Status entry={e} p={p} />
            </View>
            <Text style={ui.subheading}>
              {formatMoney(e.data.amountMinor, e.data.currency)}
            </Text>
          </Pressable>
        ))
      )}
      <FormSheet
        title="Valuta i budžet"
        visible={budgetOpen && owner && !p.trip.accessRevoked}
        onClose={() => setBudgetOpen(false)}
        busy={p.busy}
        error={error || p.error}
      >
        <Choice
          label="Valuta"
          options={
            [
              ["EUR", "EUR"],
              ["USD", "USD"],
              ["GBP", "GBP"],
            ] as const
          }
          value={currency}
          onChange={setCurrency}
          disabled={
            p.busy ||
            p.snapshot.entries.some(
              (e) => e.tripId === p.trip.id && e.feature === "expense",
            )
          }
        />
        <Text style={ui.caption}>
          Valuta se zaključava nakon prvog troška, uključujući obrisane
          troškove.
        </Text>
        <Field
          label="Budžet"
          optional
          placeholder="Bez ograničenja"
          value={limit}
          keyboardType="decimal-pad"
          onChangeText={setLimit}
          editable={!p.busy}
        />
        <Button
          title="Spremi budžet"
          disabled={p.busy}
          onPress={() => {
            if (
              commit(p, setError, () =>
                saveEntry(
                  p.db,
                  p.trip.id,
                  "budget",
                  {
                    currency,
                    budgetMinor: limit.trim() ? minorUnits(limit, true) : null,
                  },
                  p.actor,
                  randomUUID,
                ),
              )
            )
              setBudgetOpen(false);
          }}
        />
      </FormSheet>
      <FormSheet
        title={editing ? "Uredi trošak" : "Novi trošak"}
        visible={form && !!budget && !p.trip.accessRevoked}
        onClose={() => setForm(false)}
        busy={p.busy}
        error={error || p.error}
      >
        <Field
          label={`Iznos · ${budget?.currency ?? "EUR"}`}
          value={amount}
          placeholder="0,00"
          keyboardType="decimal-pad"
          onChangeText={setAmount}
          editable={!p.busy}
        />
        <Field
          label="Naziv troška"
          value={input.title}
          maxLength={160}
          onChangeText={(title) => setInput((i) => ({ ...i, title }))}
          editable={!p.busy}
        />
        <DateField
          label="Datum troška"
          value={input.date}
          onChange={(date) => setInput((i) => ({ ...i, date }))}
          disabled={p.busy}
        />
        <Choice
          label="Kategorija"
          options={
            [
              ["hrana", "Hrana"],
              ["prijevoz", "Prijevoz"],
              ["smještaj", "Smještaj"],
              ["aktivnosti", "Aktivnosti"],
              ["ostalo", "Ostalo"],
            ] as const
          }
          value={input.category}
          onChange={(category) => setInput((i) => ({ ...i, category }))}
          disabled={p.busy}
        />
        <Button
          title={
            advanced
              ? "Sakrij dodatne pojedinosti"
              : "Dodaj platitelja ili bilješku"
          }
          variant="ghost"
          onPress={() => setAdvanced(!advanced)}
        />
        {advanced ? (
          <>
            <Field
              label="Platitelj"
              optional
              value={input.payer}
              onChangeText={(payer) => setInput((i) => ({ ...i, payer }))}
              editable={!p.busy}
            />
            <Field
              label="Kategorija troška"
              value={input.category}
              onChangeText={(category) => setInput((i) => ({ ...i, category }))}
              editable={!p.busy}
            />
            <Field
              label="Bilješka troška"
              optional
              multiline
              value={input.notes}
              onChangeText={(notes) => setInput((i) => ({ ...i, notes }))}
              editable={!p.busy}
            />
          </>
        ) : null}
        <Button title="Spremi trošak" disabled={p.busy} onPress={save} />
      </FormSheet>
      <FormSheet
        title="Detalji troška"
        visible={!!selected}
        onClose={() => setDetail(undefined)}
        busy={p.busy}
        error={p.error}
      >
        {selected ? (
          <>
            <Text style={ui.title}>
              {formatMoney(selected.data.amountMinor, selected.data.currency)}
            </Text>
            <Text style={ui.heading}>{selected.data.title}</Text>
            <Text style={ui.body}>
              {displayDate(selected.data.date)} · {selected.data.category}
            </Text>
            <Text style={ui.muted}>
              Unio/la: {selected.authorEmail || selected.authorId}
            </Text>
            <Text style={ui.muted}>
              Platio/la: {selected.data.payer || "Nije navedeno"}
            </Text>
            {selected.data.notes ? (
              <Text style={ui.body}>{selected.data.notes}</Text>
            ) : null}
            <Status entry={selected} p={p} />
            {editable(selected, p) ? (
              <>
                <Button
                  title="Uredi trošak"
                  disabled={p.busy}
                  onPress={() => edit(selected)}
                />
                <Button
                  title="Obriši trošak"
                  variant="danger"
                  disabled={p.busy}
                  onPress={() =>
                    remove(selected, p, () => setDetail(undefined))
                  }
                />
              </>
            ) : null}
          </>
        ) : null}
      </FormSheet>
    </View>
  );
}
function MemoryPanel(p: Props) {
  const blank: MemoryData = {
    title: "",
    notes: "",
    placeId: null,
    mediaId: null,
  };
  const [input, setInput] = useState(blank);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState<string>();
  const [detail, setDetail] = useState<string>();
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const records = p.snapshot.entries.filter(
    (e): e is Extract<Entry, { feature: "memory" }> =>
      e.feature === "memory" && e.tripId === p.trip.id && !e.deleted,
  );
  const selected = records.find((e) => e.id === detail);
  const image = selected?.data.mediaId
    ? p.media.find((m) => m.id === selected.data.mediaId)
    : undefined;
  const preview = input.mediaId
    ? p.media.find((m) => m.id === input.mediaId)
    : undefined;
  function edit(e?: Extract<Entry, { feature: "memory" }>) {
    setInput(e?.data ?? blank);
    setEditing(e?.id);
    setDetail(undefined);
    setError("");
    setAdvanced(!!e?.data.placeId);
    setForm(true);
  }
  async function pick() {
    setError("");
    await p.perform(async () => {
      try {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted)
          throw Error(
            "Dopusti pristup fotografijama ili spremi tekstualnu uspomenu.",
          );
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: false,
          exif: false,
          quality: 1,
        });
        if (result.canceled) return;
        const selected = result.assets[0];
        if (selected.width * selected.height > 64000000)
          throw Error("Odaberi manju fotografiju.");
        const attached = await attachPhoto(
          p.db,
          p.trip.id,
          p.actor,
          p.io,
          selected,
          randomUUID(),
        );
        if (input.mediaId)
          await discardUnattachedPhoto(p.db, input.mediaId, p.io);
        setInput((i) => ({ ...i, mediaId: attached.id }));
      } catch (e) {
        setError(actionError(e));
        throw e;
      }
    }, false);
  }
  async function cancel() {
    await p.perform(async () => {
      if (input.mediaId)
        await discardUnattachedPhoto(p.db, input.mediaId, p.io);
      setForm(false);
    }, false);
  }
  return (
    <View style={ui.panel}>
      <View>
        <Text style={ui.eyebrow}>SAČUVAJ DOŽIVLJAJE</Text>
        <Text accessibilityRole="header" style={ui.title}>
          Uspomene
        </Text>
        <Text style={ui.muted}>
          Male priče i fotografije s velikog putovanja.
        </Text>
      </View>
      {!p.trip.accessRevoked ? (
        <Button
          title="Dodaj uspomenu"
          icon="plus"
          disabled={p.busy}
          onPress={() => edit()}
        />
      ) : null}
      {!records.length ? (
        <Empty
          icon="photo"
          title="Priče tek dolaze"
          detail="Dodaj fotografiju ili zapiši trenutak koji želiš sačuvati."
        />
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {records.map((e) => {
            const local = p.media.find((m) => m.id === e.data.mediaId);
            return (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`Otvori uspomenu ${e.data.title}`}
                onPress={() => setDetail(e.id)}
                style={{ width: "47%", gap: 8, paddingBottom: 16 }}
              >
                {local ? (
                  <Image
                    accessibilityLabel={`Fotografija ${e.data.title}`}
                    source={{ uri: local.thumbnailUri }}
                    style={{
                      width: "100%",
                      aspectRatio: 1,
                      borderRadius: 12,
                      backgroundColor: tokens.color.sky,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      aspectRatio: 1,
                      borderRadius: 12,
                      backgroundColor: tokens.color.sky,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={e.data.mediaId ? "download" : "photo"}
                      size={32}
                    />
                    <Text style={ui.caption}>
                      {e.data.mediaId
                        ? "Preuzmi fotografiju"
                        : "Tekstualna uspomena"}
                    </Text>
                  </View>
                )}
                <Text style={ui.subheading}>{e.data.title}</Text>
                <Status entry={e} p={p} />
              </Pressable>
            );
          })}
        </View>
      )}
      <FormSheet
        title={editing ? "Uredi uspomenu" : "Nova uspomena"}
        visible={form && !p.trip.accessRevoked}
        onClose={() => void cancel()}
        busy={p.busy}
        error={error || p.error}
      >
        {preview ? (
          <Image
            accessibilityLabel="Odabrana fotografija uspomene"
            source={{ uri: preview.thumbnailUri }}
            style={ui.photo}
          />
        ) : input.mediaId ? (
          <Text style={ui.muted}>
            Fotografija je povezana; pregled nije preuzet.
          </Text>
        ) : null}
        <Button
          title={input.mediaId ? "Zamijeni fotografiju" : "Dodaj fotografiju"}
          icon="photo"
          variant="secondary"
          disabled={p.busy}
          onPress={() => void pick()}
        />
        <Field
          label="Naslov uspomene"
          value={input.title}
          maxLength={160}
          onChangeText={(title) => setInput((i) => ({ ...i, title }))}
          editable={!p.busy}
        />
        <Field
          label="Tekst uspomene"
          optional
          multiline
          value={input.notes}
          onChangeText={(notes) => setInput((i) => ({ ...i, notes }))}
          editable={!p.busy}
        />
        <Button
          title={advanced ? "Sakrij povezano mjesto" : "Poveži mjesto"}
          variant="ghost"
          onPress={() => setAdvanced(!advanced)}
        />
        {advanced ? (
          <PlaceChoice
            p={p}
            value={input.placeId}
            onChange={(placeId) => setInput((i) => ({ ...i, placeId }))}
          />
        ) : null}
        {input.mediaId ? (
          <Button
            title="Ukloni fotografiju iz uspomene"
            variant="ghost"
            disabled={p.busy}
            onPress={() =>
              void p.perform(async () => {
                await discardUnattachedPhoto(p.db, input.mediaId!, p.io);
                setInput((i) => ({ ...i, mediaId: null }));
              }, false)
            }
          />
        ) : null}
        <Button
          title="Spremi uspomenu"
          disabled={p.busy}
          onPress={() => {
            if (!input.title.trim()) {
              setError("Unesi naslov uspomene.");
              return;
            }
            if (
              commit(p, setError, () =>
                saveEntry(
                  p.db,
                  p.trip.id,
                  "memory",
                  input,
                  p.actor,
                  randomUUID,
                  editing,
                ),
              )
            )
              setForm(false);
          }}
        />
        <Text style={ui.caption}>
          Fotografija se sprema na uređaj prije slanja. Jedna fotografija po
          uspomeni.
        </Text>
      </FormSheet>
      <FormSheet
        title="Uspomena"
        visible={!!selected}
        onClose={() => setDetail(undefined)}
        busy={p.busy}
        error={p.error}
      >
        {selected ? (
          <>
            {image ? (
              <Image
                accessibilityLabel="Fotografija uspomene"
                source={{ uri: image.uri }}
                style={[ui.photo, { resizeMode: "contain" }]}
              />
            ) : selected.data.mediaId ? (
              <View style={ui.inset}>
                <Text style={ui.body}>
                  Fotografija nije preuzeta na ovaj uređaj.
                </Text>
                {!p.trip.accessRevoked ? (
                  <Button
                    title="Preuzmi fotografiju za offline"
                    icon="download"
                    disabled={p.busy}
                    onPress={() =>
                      void p.perform(() =>
                        downloadPhoto(p.db, selected, p.actor, p.api, p.io),
                      )
                    }
                  />
                ) : null}
              </View>
            ) : null}
            <Text style={ui.title}>{selected.data.title}</Text>
            {selected.data.notes ? (
              <Text style={ui.body}>{selected.data.notes}</Text>
            ) : null}
            <Text style={ui.muted}>
              Autor: {selected.authorEmail || selected.authorId}
            </Text>
            {selected.data.placeId ? (
              <Text style={ui.muted}>
                Mjesto:{" "}
                {p.places.places.find(
                  (v) => v.id === selected.data.placeId && !v.deleted,
                )?.name ?? "Nije dostupno"}
              </Text>
            ) : null}
            {image ? (
              <Text style={ui.caption}>
                {image.state === "pending"
                  ? "Fotografija čeka slanje"
                  : image.state === "downloaded"
                    ? "Fotografija je preuzeta za offline"
                    : "Fotografija je poslana i spremljena na uređaju"}
              </Text>
            ) : null}
            {image?.error ? <Text style={ui.error}>{image.error}</Text> : null}
            <Status entry={selected} p={p} />
            {editable(selected, p) ? (
              <>
                <Button
                  title="Uredi uspomenu"
                  disabled={p.busy}
                  onPress={() => edit(selected)}
                />
                <Button
                  title="Obriši uspomenu"
                  variant="danger"
                  disabled={p.busy}
                  onPress={() =>
                    remove(selected, p, () => setDetail(undefined))
                  }
                />
              </>
            ) : null}
          </>
        ) : null}
      </FormSheet>
    </View>
  );
}
