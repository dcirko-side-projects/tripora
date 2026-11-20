import { useRef, useState } from "react";
import { Linking, Text } from "react-native";
import { accountSnapshot } from "../../core/accountStore";
import { entrySnapshot } from "../../core/entryStore";
import type { LocalDatabase } from "../../core/localStore";
import { placeSnapshot } from "../../core/placeStore";
import { collectPlaces, serializePlaces, type PlacesExportFormat, type PlacesScope } from "../../core/placesExport";
import { mapsStops, mapsUrl, myMapsRows, serializeMyMaps } from "../../core/mapsExport";
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
  const stops = data ? mapsStops(data) : [];
  const google = mapsUrl("google", stops);
  const apple = mapsUrl("apple", stops);
  const csvParts = Math.ceil(stops.length / myMapsRows);

  async function exportFile(format: PlacesExportFormat | "csv", includeNotes = true, part = 0) {
    if (!data || exporting.current) return;
    exporting.current = true;
    setBusy(true);
    setError("");
    try {
      const suffix = scope.kind === "day" ? scope.date || "nerasporedeno" : scope.kind;
      const mime = format === "csv" ? "text/csv" : format === "json" ? "application/json" : "application/geo+json";
      const privacySuffix = includeNotes ? "" : "-bez-biljeski";
      const partSuffix = format === "csv" && csvParts > 1 ? `-${part + 1}` : "";
      const contents = format === "csv" ? serializeMyMaps(stops.slice(part * myMapsRows, (part + 1) * myMapsRows))
        : serializePlaces(data, format, includeNotes);
      await sharePlacesFile(`tripora-mjesta-${suffix}${privacySuffix}${partSuffix}.${format}`, mime, contents);
    } catch {
      setError("Datoteku nije moguće izvesti. Pokušaj ponovno.");
    } finally {
      exporting.current = false;
      setBusy(false);
    }
  }

  function openMaps(url: string | undefined) {
    if (!url) return;
    setError("");
    void Linking.openURL(url).catch(() => setError("Kartu nije moguće otvoriti. Pokušaj ponovno."));
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
        {stops.length ? <>
          <Button title="Otvori u Google Mapsu" disabled={busy || !google} onPress={() => openMaps(google)} />
          <Button title="Otvori u Apple Mapsu" variant="secondary" disabled={busy || !apple} onPress={() => openMaps(apple)} />
          {!google || !apple ? <Text style={ui.caption}>Jedna ruta podržava do pet mjesta i ima ograničenu duljinu poveznice. Cijeli odabir možeš prenijeti u Google My Maps datotekom.</Text> : null}
          {Array.from({ length: csvParts }, (_, part) => <Button key={part}
            title={csvParts > 1 ? `Izvezi CSV za Google My Maps (${part + 1}/${csvParts})` : "Izvezi CSV za Google My Maps"}
            variant="secondary" disabled={busy} onPress={() => void exportFile("csv", true, part)} />)}
          <Text style={ui.caption}>U Google My Maps na računalu uvezi CSV i odaberi stupac Location za položaj i Name za naziv.</Text>
        </> : null}
        {(data?.places.length ?? 0) > stops.length ? <Text style={ui.caption}>Mjesta bez koordinata i adrese dostupna su u JSON izvozu.</Text> : null}
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
