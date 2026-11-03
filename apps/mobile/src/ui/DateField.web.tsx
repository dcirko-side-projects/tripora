import { useId } from 'react';
import { Text, View } from 'react-native';
import { Button } from './components';
import { tokens, ui } from './theme';
export function DateField({ label, value, onChange, mode = 'date', minimum, maximum, optional, disabled, error }: {
  label: string; value: string; onChange: (value: string) => void; mode?: 'date' | 'time';
  minimum?: string; maximum?: string; optional?: boolean; disabled?: boolean; error?: string;
}) {
  const id = useId();
  return <View style={{ gap: 8 }}>
    <label htmlFor={id} style={{ color: tokens.color.text, fontWeight: 600 }}>{label}{optional ? ' · opcionalno' : ''}</label>
    <input id={id} type={mode} value={value} min={minimum} max={maximum} disabled={disabled}
      aria-invalid={!!error} aria-describedby={error ? id + '-error' : undefined}
      onChange={event => onChange(event.target.value)}
      style={{ boxSizing: 'border-box', width: '100%', minHeight: 48, padding: 12, font: 'inherit', fontSize: 16,
        borderRadius: 12, border: `1px solid ${error ? tokens.color.danger : tokens.color.primary}`, background: tokens.color.surface, color: tokens.color.text }} />
    {optional && value ? <Button title={`Ukloni ${mode === 'date' ? 'datum' : 'vrijeme'}`} variant="ghost" disabled={disabled} onPress={() => onChange('')} /> : null}
    {error ? <Text nativeID={id + '-error'} accessibilityRole="alert" style={ui.error}>{error}</Text> : null}
  </View>;
}
