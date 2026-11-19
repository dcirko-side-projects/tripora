import { useRef, useState } from "react";
import { Text } from "react-native";
import { accountSnapshot } from "../../core/accountStore";
import { entrySnapshot } from "../../core/entryStore";
import type { LocalDatabase } from "../../core/localStore";
import { placeSnapshot } from "../../core/placeStore";
import { collectPlaces, serializePlaces, type PlacesExportFormat, type PlacesScope } from "../../core/placesExport";
import { Button, FormSheet } from "../../ui/components";
import { ui } from "../../ui/theme";
import { sharePlacesFile } from "./sharePlacesFile";

export function PlacesExport({ db, scope, title, description }: {
  db: LocalDatabase;
  scope: PlacesScope;
  title: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const exporting = useRef(false);
  const data = open ? collectPlaces(accountSnapshot(db).trips, placeSnapshot(db).places, entrySnapshot(db).entries, scope) : undefined;
  const mappable = data?.places.filter(place => place.location).length ?? 0;

  async function exportFile(format: PlacesExportFormat, includeNotes = true) {
    if (!data || exporting.current) return;
    exporting.current = true;
    setBusy(true);
    setError("");
    try {
      const suffix = scope.kind === "day" ? scope.date || "nerasporedeno" : scope.kind;
      const mime = format === "json" ? "application/json" : "application/geo+json";
      const privacySuffix = includeNotes ? "" : "-bez-biljeski";
      await sharePlacesFile(`tripora-mjesta-${suffix}${privacySuffix}.${format}`, mime, serializePlaces(data, format, includeNotes));
    } catch {
      setError("Datoteku nije moguće izvesti. Pokušaj ponovno.");
    } finally {
      exporting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Button title={title} icon="download" variant="secondary" onPress={() => {
        setError("");
        setOpen(true);
      }} />
      <FormSheet title={title} visible={open} busy={busy} error={error} onClose={() => setOpen(false)}>
        <Text style={ui.body}>{description}</Text>
        <Text style={ui.caption}>Broj mjesta {data?.places.length ?? 0} · s položajem {mappable}</Text>
        <Button title="Izvezi popis (JSON)" disabled={busy || !data?.places.length} onPress={() => void exportFile("json")} />
        <Button title="Izvezi oznake karte (GeoJSON)" variant="secondary" disabled={busy || !mappable}
          onPress={() => void exportFile("geojson")} />
        <Button title="Izvezi GeoJSON bez bilješki" variant="secondary" disabled={busy || !mappable}
          onPress={() => void exportFile("geojson", false)} />
        <Text style={ui.caption}>Izvoz može sadržavati adrese, datume i plan posjeta. JSON uključuje i mjesta bez položaja. Verzija GeoJSON bez bilješki zadržava lokacije i raspored.</Text>
      </FormSheet>
    </>
  );
}
