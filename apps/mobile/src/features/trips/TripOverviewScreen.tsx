import { Text, View } from "react-native";
import { SyncedTrip, AccountSnapshot } from "../../core/accountStore";
import { EntrySnapshot } from "../../core/entryStore";
import { LocalMedia } from "../../core/mediaQueue";
import { PlaceSnapshot } from "../../core/placeStore";
import { tripOverview } from "../../core/tripOverview";
import { Button, MenuRow } from "../../ui/components";
import { dateValue, displayDate } from "../../ui/dates";
import { ui } from "../../ui/theme";
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
export function TripOverviewScreen({
  trip,
  actorId,
  snapshot,
  places,
  entries,
  media,
  onNavigate,
  onSync,
}: {
  trip: SyncedTrip;
  actorId: string;
  snapshot: AccountSnapshot;
  places: PlaceSnapshot;
  entries: EntrySnapshot;
  media: LocalMedia[];
  onNavigate: (section: TripSection) => void;
  onSync: () => void;
}) {
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
      <View style={ui.hero}>
        <Text style={ui.eyebrow}>
          {trip.destination.toLocaleUpperCase("hr-HR")}
        </Text>
        <Text accessibilityRole="header" style={ui.title}>
          {trip.name}
        </Text>
        <Text style={ui.body}>
          {displayDate(trip.startDate)} – {displayDate(trip.endDate)}
        </Text>
        <Text style={ui.muted}>
          {trip.role === "member"
            ? "Član zajedničkog putovanja"
            : "Tvoje zajedničko putovanje"}
        </Text>
      </View>
      {trip.accessRevoked ? (
        <View style={ui.errorBox}>
          <Text style={ui.error}>
            Pristup je uklonjen. Ovo je prethodno preuzeta lokalna kopija;
            promjene se neće slati.
          </Text>
        </View>
      ) : null}
      <View style={ui.accentPanel}>
        <Text style={ui.caption}>Potrošeno na putovanju</Text>
        <Text style={ui.heading}>
          {summary.currencyMismatch
            ? "Provjeri valute troškova"
            : (summary.spent ?? "Budžet još nije postavljen")}
        </Text>
        {summary.remaining !== null ? (
          <Text style={ui.body}>Preostalo: {summary.remaining}</Text>
        ) : null}
        <Text style={ui.caption}>Zbroj uključuje lokalne promjene.</Text>
        <Button
          title="Otvori troškove"
          variant="ghost"
          onPress={() => onNavigate("expense")}
        />
      </View>
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
      <View style={ui.card}>
        <Text style={ui.subheading}>Dostupnost bez interneta</Text>
        <Text style={ui.muted}>
          {trip.offlinePreparedAt
            ? "Metapodaci putovanja su preuzeti. Fotografije preuzimaš zasebno u uspomenama."
            : "Lokalni zapisi su sačuvani. Potpuno preuzimanje još nije potvrđeno."}
        </Text>
        <Text style={ui.caption}>
          Na čekanju za ovo putovanje: {summary.pending} · treba pažnju:{" "}
          {summary.attention}
        </Text>
        {!trip.accessRevoked ? (
          <Button
            title="Pripremi za offline"
            icon="download"
            variant="secondary"
            onPress={onSync}
          />
        ) : null}
      </View>
    </View>
  );
}
