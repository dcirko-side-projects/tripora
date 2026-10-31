import { ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon, IconName } from "./Icon";
import { tokens, ui } from "./theme";
const c = tokens.color;

export function Button({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
}) {
  const foreground =
    variant === "primary"
      ? c.onPrimary
      : variant === "danger"
        ? c.danger
        : c.primaryInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary"
          ? styles.primary
          : variant === "secondary"
            ? styles.secondary
            : styles.ghost,
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? <Icon name={icon} color={foreground} size={20} /> : null}
      <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  optional,
  ...props
}: TextInputProps & { label: string; error?: string; optional?: boolean }) {
  return (
    <View>
      <Text style={ui.label}>
        {label}
        {optional ? " · opcionalno" : ""}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[
          ui.input,
          props.multiline && { minHeight: 100, textAlignVertical: "top" },
          error ? { borderColor: c.danger } : null,
          props.style,
        ]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
export function FormError({ message }: { message?: string }) {
  return message ? (
    <View style={ui.errorBox}>
      <Text accessibilityRole="alert" style={ui.error}>
        {message}
      </Text>
    </View>
  ) : null;
}
export function Empty({
  title,
  detail,
  icon = "trips",
}: {
  title: string;
  detail: string;
  icon?: IconName;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} color={c.accentInk} size={28} />
      </View>
      <Text style={ui.subheading}>{title}</Text>
      <Text style={[ui.muted, { textAlign: "center" }]}>{detail}</Text>
    </View>
  );
}
export function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label?: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      {label ? <Text style={ui.label}>{label}</Text> : null}
      <View style={ui.wrap}>
        {options.map(([key, title]) => (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={title}
            accessibilityState={{ selected: key === value, disabled }}
            disabled={disabled}
            onPress={() => onChange(key)}
            style={[styles.choice, key === value && styles.choiceSelected]}
          >
            <Text
              style={[
                styles.choiceText,
                key === value && { color: c.primaryInk, fontWeight: "700" },
              ]}
            >
              {title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function MenuRow({
  title,
  detail,
  icon,
  onPress,
  disabled = false,
}: {
  title: string;
  detail?: string;
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[ui.between, ui.item, disabled && { opacity: 0.45 }]}
    >
      <View style={[ui.row, ui.flex]}>
        <View style={styles.menuIcon}>
          <Icon name={icon} color={c.primaryInk} />
        </View>
        <View style={ui.flex}>
          <Text style={ui.subheading}>{title}</Text>
          {detail ? <Text style={ui.muted}>{detail}</Text> : null}
        </View>
      </View>
      <Icon name="next" size={18} />
    </Pressable>
  );
}
export function FormSheet({
  title,
  visible,
  onClose,
  busy,
  children,
  error,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  busy?: boolean;
  children: ReactNode;
  error?: string;
}) {
  if (!visible) return null;
  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (Platform.OS === "android" && Keyboard.isVisible()) {
          Keyboard.dismiss();
          return;
        }
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={ui.safe}>
        <View style={styles.modalHeader}>
          <Text accessibilityRole="header" style={[ui.heading, ui.flex]}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zatvori obrazac"
            accessibilityState={{ disabled: !!busy }}
            disabled={busy}
            onPress={onClose}
            style={{
              minWidth: 48,
              minHeight: 48,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close" color={c.primary} />
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={ui.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={ui.page}
          >
            <FormError message={error} />
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export function BottomNav<T extends string>({
  items,
  value,
  onChange,
  disabled = false,
}: {
  items: readonly (readonly [T, string, IconName])[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.nav}>
      {items.map(([key, title, icon]) => (
        <Pressable
          key={key}
          accessibilityLabel={title}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === key, disabled }}
          disabled={disabled}
          onPress={() => onChange(key)}
          style={styles.navItem}
        >
          <View
            style={[
              styles.navIcon,
              value === key && { backgroundColor: c.accentSoft },
            ]}
          >
            <Icon name={icon} color={value === key ? c.accentInk : c.muted} />
          </View>
          <Text
            style={[
              styles.navText,
              value === key && { color: c.accentInk, fontWeight: "700" },
            ]}
          >
            {title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
export function Loading() {
  return <ActivityIndicator accessibilityLabel="Obrada" color={c.primary} />;
}
const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  primary: { backgroundColor: c.primary },
  secondary: { backgroundColor: c.primarySoft },
  ghost: { backgroundColor: "transparent" },
  buttonText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  empty: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 12,
    alignItems: "center",
  },
  emptyIcon: { padding: 16, borderRadius: 20, backgroundColor: c.accentSoft },
  choice: {
    paddingHorizontal: 14,
    minHeight: 44,
    paddingVertical: 10,
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.border,
  },
  choiceSelected: { backgroundColor: c.primarySoft, borderColor: c.primaryInk },
  choiceText: { fontSize: 14, color: c.muted },
  menuIcon: { backgroundColor: c.sky, padding: 12, borderRadius: 12 },
  modalHeader: {
    backgroundColor: c.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  nav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  navItem: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navIcon: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 12 },
  navText: { fontSize: 11, color: c.muted, textAlign: "center" },
});
