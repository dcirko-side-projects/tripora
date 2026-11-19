import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from '../../ui/Icon';
import { tokens } from '../../ui/theme';

export function CompactMapFilters<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  const positions = useRef(new Map<T, { x: number; width: number }>());
  const [width, setWidth] = useState(0);
  const [content, setContent] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const offsetRef = useRef(0);
  function updateScrollHints(offset: number) {
    setCanScrollLeft(offset > 2);
    setCanScrollRight(width > 0 && offset + width < content - 2);
  }
  function revealSelection() {
    const selected = positions.current.get(value);
    if (!selected || !width) return;
    const left = offsetRef.current;
    const right = left + width;
    if (selected.x < left || selected.x + selected.width > right) {
      scroll.current?.scrollTo({ x: Math.max(0, selected.x - (width - selected.width) / 2), animated: false });
    }
  }
  useEffect(revealSelection, [value, width]);
  useEffect(() => updateScrollHints(offsetRef.current), [width, content]);
  return <View style={{ flexBasis: 290, flexGrow: 1, maxWidth: '100%', minWidth: 0 }}>
    <ScrollView ref={scroll} horizontal accessibilityLabel={label} keyboardShouldPersistTaps="handled"
      onLayout={event => setWidth(event.nativeEvent.layout.width)} onContentSizeChange={contentWidth => setContent(contentWidth)}
      onScroll={event => { offsetRef.current = event.nativeEvent.contentOffset.x; updateScrollHints(offsetRef.current); }}
      scrollEventThrottle={32} contentContainerStyle={{ gap: 4 }}>
    {options.map(([key, title]) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={title}
      accessibilityState={{ selected: value === key }} onPress={() => onChange(key)}
      onLayout={event => { positions.current.set(key, event.nativeEvent.layout); if (key === value) revealSelection(); }}
      style={{ minHeight: 44, minWidth: 44, paddingHorizontal: width > 0 && width < 320 ? 6 : 12,
        alignItems: 'center', justifyContent: 'center', borderRadius: 10,
        backgroundColor: value === key ? tokens.color.primarySoft : tokens.color.surface }}>
      <Text style={{ fontSize: 14, color: value === key ? tokens.color.primaryInk : tokens.color.muted, fontWeight: value === key ? '700' : '500' }}>{title === 'Sve kategorije' ? 'Sve' : title}</Text>
    </Pressable>)}
    </ScrollView>
    {canScrollLeft ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 14, backgroundColor: tokens.color.surface, transform: [{ rotate: '180deg' }] }}>
      <Icon name="next" size={14} color={tokens.color.primaryInk} />
    </View> : null}
    {canScrollRight ? <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 14, backgroundColor: tokens.color.surface }}>
      <Icon name="next" size={14} color={tokens.color.primaryInk} />
    </View> : null}
  </View>;
}
