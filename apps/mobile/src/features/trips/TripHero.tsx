import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { SyncedTrip } from "../../core/accountStore";
import { displayDate } from "../../ui/dates";
import { Icon } from "../../ui/Icon";
import { tokens, ui } from "../../ui/theme";

export function TripHero({ trip, children }: { trip: SyncedTrip; children?: ReactNode }) {
  return (
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
      {children}
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
