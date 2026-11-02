import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { SyncedTrip, AccountSnapshot } from "../../core/accountStore";
import { EntrySnapshot } from "../../core/entryStore";
import { LocalMedia } from "../../core/mediaQueue";
import { PlaceSnapshot } from "../../core/placeStore";
import { tripOverview } from "../../core/tripOverview";
import { Button, MenuRow } from "../../ui/components";
import { dateValue, displayDate } from "../../ui/dates";
import { tokens, ui } from "../../ui/theme";
import { Icon } from "../../ui/Icon";
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
      <View style={styles.ticket}>
        <View pointerEvents="none" accessible={false} style={styles.landscape}>
          <Svg width="100%" height="100%" viewBox="0 0 360 260" preserveAspectRatio="xMaxYMax slice">
            <Circle cx={310} cy={42} r={65} fill="#FFFFFF" opacity={0.08} />
            <Circle cx={310} cy={42} r={36} fill={tokens.color.accent} opacity={0.65} />
            <Path d="M140 260 245 125 305 202 340 155 400 260Z" fill="#FFFFFF" opacity={0.09} />
            <Path d="M200 260C200 207 330 242 330 170S270 140 290 98" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeDasharray="5 7" opacity={0.35} />
          </Svg>
        </View>
        <View style={styles.ticketTop}>
          <View style={styles.badge}><Icon name="trips" size={18} color={tokens.color.surface} /><Text style={styles.badgeText}>PUTOVANJE ZA PAMĆENJE</Text></View>
        </View>
        <Text style={[ui.eyebrow, styles.light, { marginTop: 12 }]}>
          {trip.destination.toLocaleUpperCase("hr-HR")}
        </Text>
        <Text accessibilityRole="header" style={[ui.title, styles.light]}>
          {trip.name}
        </Text>
        <View style={styles.dates}>
          <Icon name="calendar" size={20} color={tokens.color.surface} />
          <Text style={[ui.body, styles.light, { flex: 1 }]}>
          {displayDate(trip.startDate)} – {displayDate(trip.endDate)}
          </Text>
        </View>
        <Text style={[ui.caption, styles.light]}>
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

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: tokens.color.primaryInk,
    borderRadius: 24,
    padding: 24,
    gap: 10,
    overflow: "hidden",
  },
  landscape: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  ticketTop: { flexDirection: "row", flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFFFFF18", padding: 10, borderRadius: 12 },
  badgeText: { color: tokens.color.surface, fontSize: 11, fontWeight: "700", letterSpacing: 1, flexShrink: 1 },
  light: { color: tokens.color.surface },
  dates: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: 1, borderTopColor: "#FFFFFF40", paddingTop: 16, marginTop: 6 },
});
