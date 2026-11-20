import type { ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../ui/Icon';
import { tokens, ui } from '../../ui/theme';

// Keep controls outside the map's gesture surface and sheets above both.
export function FullscreenMapFrame({ search, filters, empty, onClose, children, overlay, location }: {
  search?: ReactNode; filters?: ReactNode; empty: boolean; onClose: () => void;
  children: ReactNode; overlay?: ReactNode;
  location?: { locate: () => void; title: string; busy: boolean; status: ReactNode };
}) {
  // Web SafeAreaView adds numeric insets to padding; CSS env() needs a plain View.
  const Frame = Platform.OS === 'web' ? View : SafeAreaView;
  return <Frame testID="fullscreen-map-frame" style={[ui.safe, styles.safe, Platform.OS === 'web' ? {
    paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)',
  } as unknown as ViewStyle : undefined]}>
    <View style={styles.header}>
      <View style={{ flex: 1, minWidth: 0 }}>{search}</View>
      {location ? <Pressable accessibilityRole="button" accessibilityLabel={location.title}
        accessibilityState={{ busy: location.busy, disabled: location.busy }} disabled={location.busy}
        onPress={location.locate} style={({ pressed }) => [styles.close, { opacity: pressed ? 0.65 : 1 }]}>
        {location.busy ? <ActivityIndicator color={tokens.color.primaryInk} /> : <Icon name="locate" size={24} color={tokens.color.primaryInk} />}
      </Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Zatvori kartu" onPress={onClose}
        style={({ pressed }) => [styles.close, { opacity: pressed ? 0.65 : 1 }]}>
        <Icon name="close" size={24} color={tokens.color.primaryInk} />
      </Pressable>
    </View>
    {location?.status ? <View style={styles.location}>{location.status}</View> : null}
    <View style={styles.map}>
      {children}
      {empty ? <View pointerEvents="none" style={styles.empty}><Text style={ui.caption}>Nema mjesta s položajem za odabrane filtre.</Text></View> : null}
      <View pointerEvents="box-none" style={styles.filters}><View style={styles.filterPanel}>{filters}</View></View>
    </View>
    {overlay}
  </Frame>;
}
const styles = StyleSheet.create({
  safe: { backgroundColor: tokens.color.surface, minHeight: 0 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8, flexShrink: 0 },
  location: { paddingHorizontal: 8, paddingBottom: 8, flexShrink: 0 },
  close: { width: 48, height: 48, flexShrink: 0, borderRadius: 14, backgroundColor: tokens.color.primarySoft, alignItems: 'center', justifyContent: 'center' },
  map: { flex: 1, minHeight: 0, overflow: 'hidden' },
  empty: { position: 'absolute', top: 8, left: 56, right: 8, padding: 8, borderRadius: 10, backgroundColor: tokens.color.surface },
  // Leave the provider attribution visible below the floating controls.
  filters: { position: 'absolute', bottom: 32, left: 8, right: 8, alignItems: 'center' },
  filterPanel: { width: '100%', maxWidth: 760, flexDirection: 'row', flexWrap: 'wrap', borderRadius: 14, padding: 4, backgroundColor: tokens.color.surface, borderWidth: 1, borderColor: tokens.color.border, gap: 2 },
});
