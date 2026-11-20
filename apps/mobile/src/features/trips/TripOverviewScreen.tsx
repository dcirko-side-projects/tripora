import { Text, View } from "react-native";
import { SyncedTrip, AccountSnapshot } from "../../core/accountStore";
import { EntrySnapshot } from "../../core/entryStore";
import { LocalMedia } from "../../core/mediaQueue";
import { PlaceSnapshot } from "../../core/placeStore";
import { tripOverview } from "../../core/tripOverview";
import { Button, MenuRow } from "../../ui/components";
import { dateValue, displayDate } from "../../ui/dates";
import { ui } from "../../ui/theme";
import { TripHero } from "./TripHero";
import { tripCover } from "./tripCover";
export type TripSection =
  | "overview"
  | "plan"
  | "places"
  | "expense"
  | "more"
  | "packing"
  | "memory"
  | "members"
  | "settings";
export function TripOfflineStatus({ trip, summary, onSync, syncing, disabled, error }: {
  trip: SyncedTrip;
  summary: Pick<ReturnType<typeof tripOverview>, "photos" | "localPhotos" | "pending" | "attention">;
  onSync: () => void;
  syncing?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const preparedAt = trip.offlinePreparedAt && new Date(trip.offlinePreparedAt);
  return <View style={ui.card}>
    <Text style={ui.subheading}>Dostupnost bez interneta</Text>
    <Text style={ui.muted} accessibilityLiveRegion="polite">
      {preparedAt && Number.isFinite(preparedAt.getTime())
        ? `Zadnje preuzimanje podataka: ${preparedAt.toLocaleString("hr-HR", { dateStyle: "medium", timeStyle: "short" })}`
        : "Lokalni zapisi su dostupni. Potpuno preuzimanje još nije potvrđeno."}
    </Text>
    <Text style={ui.body}>Fotografije na uređaju: {summary.localPhotos} od {summary.photos}</Text>
    {summary.localPhotos < summary.photos ? <Text style={ui.caption}>Preostale fotografije preuzmi u Uspomenama.</Text> : null}
    <Text style={ui.caption}>Na čekanju: {summary.pending} · treba pažnju: {summary.attention}</Text>
    <Text style={ui.caption}>Podloga karte i traženje lokacija trebaju internet.</Text>
    {error && !trip.accessRevoked ? <Text accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
    {!trip.accessRevoked ? <Button title={syncing ? "Preuzimanje i sinkronizacija…" : "Pripremi za offline"} icon="download"
      variant="secondary" disabled={syncing || disabled} onPress={onSync} /> : null}
  </View>;
}

export function TripOverviewScreen({
  trip,
  actorId,
  snapshot,
  places,
  entries,
  media,
  onNavigate,
  onSync,
  syncing,
  syncDisabled,
  syncError,
  coverDisabled,
  onChangeCover,
}: {
  trip: SyncedTrip;
  actorId: string;
  snapshot: AccountSnapshot;
  places: PlaceSnapshot;
  entries: EntrySnapshot;
  media: LocalMedia[];
  onNavigate: (section: TripSection) => void;
  onSync: () => void;
  syncing?: boolean;
  syncDisabled?: boolean;
  syncError?: string;
  coverDisabled?: boolean;
  onChangeCover?: (remove: boolean) => void;
}) {
  const cover = tripCover(trip.id, entries.entries, media);
  const summary = tripOverview(
    trip.id,
    actorId,
    snapshot,
    places,
    entries,
    media,
  );
  const today = dateValue(new Date());
  const next = entries.entries
    .filter(
      (e) =>
        e.tripId === trip.id &&
        e.feature === "plan" &&
        !e.deleted &&
        !e.data.done &&
        !!e.data.date &&
        e.data.date >= today,
    )
    .sort((a, b) =>
      (a.feature === "plan" ? a.data.date + a.data.time : "").localeCompare(
        b.feature === "plan" ? b.data.date + b.data.time : "",
      ),
    )
    .slice(0, 3);
  return (
    <View
      style={ui.panel}
      accessibilityLabel={`Pregled putovanja ${trip.name}`}
    >
      <TripHero trip={trip} coverUri={trip.accessRevoked ? undefined : cover.image?.uri} />
      {onChangeCover ? <View style={ui.wrap}>
        <Button title={cover.id ? "Promijeni naslovnu fotografiju" : "Dodaj naslovnu fotografiju"} icon="photo"
          variant="secondary" disabled={coverDisabled} onPress={() => onChangeCover(false)} />
        {cover.id ? <Button title="Ukloni naslovnu fotografiju" variant="ghost"
          disabled={coverDisabled} onPress={() => onChangeCover(true)} /> : null}
      </View> : null}
      {trip.accessRevoked ? (
        <View style={ui.errorBox}>
          <Text style={ui.error}>
            Pristup je uklonjen. Ovo je prethodno preuzeta lokalna kopija;
            promjene se neće slati.
          </Text>
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        <View style={ui.between}>
          <Text style={ui.subheading}>Sljedeće na rasporedu</Text>
          <Button
            title="Cijeli plan"
            variant="ghost"
            onPress={() => onNavigate("plan")}
          />
        </View>
        {next.length ? (
          next.map((e) =>
            e.feature === "plan" ? (
              <View key={e.id} style={ui.item}>
                <Text style={ui.caption}>
                  {displayDate(e.data.date)}
                  {e.data.time ? ` · ${e.data.time}` : ""}
                </Text>
                <Text style={ui.subheading}>{e.data.title}</Text>
              </View>
            ) : null,
          )
        ) : (
          <Text style={ui.muted}>
            Još nema nadolazećih aktivnosti. Posloži ideje u dnevnom planu.
          </Text>
        )}
      </View>
      <View>
        <Text style={ui.subheading}>Za tvoje putovanje</Text>
        <MenuRow
          title="Budžet i troškovi"
          detail={summary.currencyMismatch
            ? "Provjeri valute troškova"
            : summary.spent
              ? `Potrošeno ${summary.spent}${summary.remaining !== null ? ` · preostalo ${summary.remaining}` : ""} · uključuje lokalne promjene`
              : "Postavi budžet i prati troškove"}
          icon="wallet"
          onPress={() => onNavigate("expense")}
        />
        <MenuRow
          title="Mjesta, hrana i izlasci"
          detail={`${summary.places} spremljeno · ${summary.visited} posjećeno`}
          icon="pin"
          onPress={() => onNavigate("places")}
        />
        <MenuRow
          title="Moja packing lista"
          detail={`${summary.packed} od ${summary.packing} spakirano`}
          icon="packing"
          onPress={() => onNavigate("packing")}
        />
        <MenuRow
          title="Uspomene"
          detail={`${summary.memories} uspomena · ${summary.localPhotos}/${summary.photos} fotografija na uređaju`}
          icon="photo"
          onPress={() => onNavigate("memory")}
        />
        <MenuRow
          title="Sudionici"
          detail={
            trip.role === "member"
              ? "Tvoja uloga i zajedničko uređivanje"
              : "Upravljanje suputnicima i pozivnicama"
          }
          icon="people"
          onPress={() => onNavigate("members")}
        />
      </View>
      <TripOfflineStatus trip={trip} summary={summary} onSync={onSync} syncing={syncing} disabled={syncDisabled} error={syncError} />
    </View>
  );
}
