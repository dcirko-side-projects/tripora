import { Linking, Text } from "react-native";
import type { Place } from "../../core/placeStore";
import { Button } from "../../ui/components";
import { ui } from "../../ui/theme";
import { markerAppearance } from "./mapPresentation";

export function PlaceDetails({ place, onError }: {
  place: Place;
  onError: (message: string) => void;
}) {
  function open(url: string, message: string) {
    void Linking.openURL(url).catch(() => onError(message));
  }
  const location = place.location;
  return (
    <>
      <Text style={ui.eyebrow}>{markerAppearance(place.category).label}</Text>
      <Text style={ui.title}>{place.name}</Text>
      <Text style={ui.muted}>{place.visited ? "Posjećeno" : "Za posjetiti"}</Text>
      {location ? (
        <>
          <Text style={ui.body}>{location.displayName}</Text>
          <Text style={ui.caption}>Podaci o položaju: © OpenStreetMap contributors</Text>
          <Button title="Otvori navigaciju" variant="secondary" onPress={() =>
            open(`https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`,
              "Navigacija nije otvorena. Provjeri internet.")
          } />
        </>
      ) : <Text style={ui.muted}>Položaj još nije potvrđen. Mjesto možeš pronaći u obrascu za uređivanje.</Text>}
      {place.address ? <Text selectable style={ui.body}>{place.address}</Text> : null}
      {place.notes ? <Text style={ui.body}>{place.notes}</Text> : null}
      {place.link ? <Button title="Otvori poveznicu" variant="secondary" onPress={() =>
        open(place.link, "Poveznica nije otvorena. Provjeri vezu s internetom.")
      } /> : null}
    </>
  );
}
