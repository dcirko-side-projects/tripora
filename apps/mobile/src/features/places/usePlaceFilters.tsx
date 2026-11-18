import { useState } from "react";
import { Keyboard, TextInput, View } from "react-native";
import type { Place, PlaceCategory } from "../../core/placeStore";
import { Choice, Field } from "../../ui/components";
import { ui } from "../../ui/theme";
import { CompactMapFilters } from "./CompactMapFilters";
import { categoryOptions } from "./mapPresentation";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("hr").replace(/đ/g, "d").trim();
const categories = [["all", "Sve kategorije"], ...categoryOptions] as const;
const statuses = [["all", "Sve"], ["planned", "Za posjetiti"], ["visited", "Posjećeno"]] as const;

export function usePlaceFilters(searchLabel: string) {
  const [category, setCategory] = useState<PlaceCategory | "all">("all");
  const [status, setStatus] = useState<typeof statuses[number][0]>("all");
  const [query, setQuery] = useState("");
  const needle = normalize(query);

  return {
    category, setCategory, setStatus,
    matches: (place: Place) =>
      (category === "all" || place.category === category) &&
      (status === "all" || place.visited === (status === "visited")) &&
      (!needle || normalize([place.name, place.address, place.location?.displayName ?? ""].join(" ")).includes(needle)),
    inline: (
      <View style={{ gap: 8 }}>
        <Field label="Filtriraj grad, naziv ili adresu" value={query} onChangeText={setQuery} maxLength={300} />
        <Choice options={categories} value={category} onChange={setCategory} />
        <Choice options={statuses} value={status} onChange={setStatus} />
      </View>
    ),
    fullscreenSearch: (
      <TextInput accessibilityLabel={searchLabel} placeholder="Pretraži mjesta"
        value={query} onChangeText={setQuery} maxLength={300} returnKeyType="search"
        onSubmitEditing={() => Keyboard.dismiss()} style={[ui.input, { minHeight: 48, paddingVertical: 10 }]} />
    ),
    fullscreenFilters: (
      <>
        <CompactMapFilters label="Kategorije mjesta" options={categories} value={category} onChange={setCategory} />
        <CompactMapFilters label="Status posjeta" options={statuses} value={status} onChange={setStatus} />
      </>
    ),
  };
}
