import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button } from "./components";
import { Icon } from "./Icon";
import { calendarDate, dateValue, displayDate, timeValue } from "./dates";
import { tokens, ui } from "./theme";

export function DateField({
  label,
  value,
  onChange,
  mode = "date",
  minimum,
  maximum,
  optional = false,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mode?: "date" | "time";
  minimum?: string;
  maximum?: string;
  optional?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(new Date());
  function show() {
    const date =
      mode === "date" ? calendarDate(value || minimum || "") : new Date();
    if (mode === "time") {
      const [hour, minute] = (value || "09:00").split(":").map(Number);
      date.setHours(hour, minute, 0, 0);
    }
    setDraft(date);
    setOpen(true);
  }
  const commit = (date: Date) =>
    onChange(mode === "date" ? dateValue(date) : timeValue(date));
  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.label}>
        {label}
        {optional ? " · opcionalno" : ""}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{
          text: value
            ? mode === "date"
              ? displayDate(value)
              : value
            : "Nije odabrano",
        }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={show}
        style={[
          ui.input,
          ui.between,
          error && { borderColor: tokens.color.danger },
        ]}
      >
        <Text style={value ? ui.body : ui.muted}>
          {value
            ? mode === "date"
              ? displayDate(value)
              : value
            : mode === "time"
              ? "Bez vremena"
              : optional
                ? "Neraspoređeno"
                : "Odaberi datum"}
        </Text>
        <Icon name={mode === "date" ? "calendar" : "clock"} />
      </Pressable>
      {optional && value ? (
        <Button
          title={`Ukloni ${mode === "date" ? "datum" : "vrijeme"}`}
          variant="ghost"
          disabled={disabled}
          onPress={() => {
            onChange("");
            setOpen(false);
          }}
        />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      ) : null}
      {open ? (
        <View>
          <DateTimePicker
            value={draft}
            mode={mode}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            locale={Platform.OS === "ios" ? "hr-HR" : undefined}
            is24Hour
            minimumDate={
              mode === "date" && minimum ? calendarDate(minimum) : undefined
            }
            maximumDate={
              mode === "date" && maximum ? calendarDate(maximum) : undefined
            }
            onChange={(event, date) => {
              if (Platform.OS === "android") {
                setOpen(false);
                if (event.type === "set" && date) commit(date);
              } else if (date) setDraft(date);
            }}
          />
          {Platform.OS === "ios" ? (
            <View style={ui.row}>
              <Button
                title="Odustani od odabira"
                variant="ghost"
                onPress={() => setOpen(false)}
              />
              <Button
                title="Potvrdi odabir"
                onPress={() => {
                  commit(draft);
                  setOpen(false);
                }}
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
