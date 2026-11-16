import { Pressable, ScrollView, Text } from 'react-native';
import { tokens } from '../../ui/theme';

export function CompactMapFilters<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void;
}) {
  return <ScrollView horizontal accessibilityLabel={label} keyboardShouldPersistTaps="handled"
    style={{ flexBasis: 290, flexGrow: 1, maxWidth: '100%' }} contentContainerStyle={{ gap: 4 }}>
    {options.map(([key, title]) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={title}
      accessibilityState={{ selected: value === key }} onPress={() => onChange(key)}
      style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 10,
        backgroundColor: value === key ? tokens.color.primarySoft : tokens.color.surface }}>
      <Text style={{ fontSize: 14, color: value === key ? tokens.color.primaryInk : tokens.color.muted, fontWeight: value === key ? '700' : '500' }}>{title === 'Sve kategorije' ? 'Sve' : title}</Text>
    </Pressable>)}
  </ScrollView>;
}
