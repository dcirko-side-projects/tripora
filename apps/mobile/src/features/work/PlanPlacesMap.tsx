import { useState } from "react";
import { View } from "react-native";
import type { SyncedTrip } from "../../core/accountStore";
import type { Entry } from "../../core/entryStore";
import type { LocalDatabase } from "../../core/localStore";
import type { Place } from "../../core/placeStore";
import { planPlaceIds } from "../../core/placesExport";
import type { ApiClient } from "../../core/sync";
import { FormSheet } from "../../ui/components";
import { displayDate, tripDays } from "../../ui/dates";
import { CompactMapFilters } from "../places/CompactMapFilters";
import { PlaceDetails } from "../places/PlaceDetails";
import { PlacesExport } from "../places/PlacesExport";
import { TripPlacesMap } from "../places/TripPlacesMap";
import { usePlaceFilters } from "../places/usePlaceFilters";

export function PlanPlacesMap({ trip, entries, places, day, api, db }: {
  trip: SyncedTrip;
  entries: Extract<Entry, { feature: "plan" }>[];
  places: Place[];
  day: string;
  api: ApiClient;
  db: LocalDatabase;
}) {
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<string>();
  const [error, setError] = useState("");
  const filters = usePlaceFilters("Pretraži mjesta u planu");
  const dates = new Set([...tripDays(trip.startDate, trip.endDate), day, ...entries.map(entry => entry.data.date)]);
  dates.delete("");
  const options = [
    ["all", "Svi dani"],
    ...Array.from(dates).sort().map(date => [date, displayDate(date)] as const),
    ["", "Neraspoređeno"],
  ] as const;
  const ids = planPlaceIds(entries, trip.id, filter === "all" ? undefined : filter);
  const mapped = places.filter(place => ids.has(place.id) && filters.matches(place));
  const selected = mapped.find(place => place.id === detail && place.location);
  const close = () => setDetail(undefined);
  const dayFilters = <CompactMapFilters label="Dani na karti plana" options={options} value={filter} onChange={(value) => {
    close();
    setFilter(value);
  }} />;

  return (
    <View style={{ gap: 12 }}>
      <TripPlacesMap places={mapped} scopeKey={filter} api={api}
        filters={<><View style={{ flexDirection: "row" }}>{dayFilters}</View>{filters.inline}</>}
        fullscreenSearch={filters.fullscreenSearch}
        fullscreenFilters={<>{dayFilters}{filters.fullscreenFilters}</>}
        onSelect={(id) => { setError(""); setDetail(id); }}
        onCloseOverlay={close}
        overlay={selected ? (embedded) => (
          <FormSheet title="Detalji mjesta" embedded={embedded} visible onClose={close} error={error}>
            <PlaceDetails place={selected} onError={setError} />
          </FormSheet>
        ) : undefined}
      />
      {!trip.accessRevoked ? (
        <PlacesExport db={db} scope={filter === "all" ? { kind: "plan", tripId: trip.id } : { kind: "day", tripId: trip.id, date: filter }}
          title={filter === "all" ? "Izvezi mjesta iz plana" : filter ? "Izvezi mjesta za odabrani dan" : "Izvezi neraspoređena mjesta"}
          description={filter === "all" ? "Sva spremljena mjesta povezana s ovim planom."
            : filter ? `Spremljena mjesta u planu za ${displayDate(filter)}` : "Spremljena mjesta povezana s neraspoređenim aktivnostima."}
        />
      ) : null}
    </View>
  );
}
