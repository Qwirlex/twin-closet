import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';

import { T } from '@/components/ui';
import { ANGLES } from '@/data/demo';
import { useTheme } from '@/theme/theme';

/** Диск ракурсов: шкала делений, золотая стрелка, под ней Front · 3/4 · Side · Back. Тянется пальцем */
export function AngleDial({ value, onChange, rendered }: { value: number; onChange: (i: number) => void; rendered?: boolean[] }) {
  const { t } = useTheme();
  const [width, setWidth] = useState(0);
  const start = useRef(0);
  const latest = useRef({ value, width, onChange });
  latest.current = { value, width, onChange };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { width: w, onChange: set } = latest.current;
        if (!w) return;
        const i = Math.max(0, Math.min(3, Math.floor((e.nativeEvent.locationX / w) * 4)));
        start.current = i;
        set(i);
      },
      onPanResponderMove: (_, g) => {
        const { width: w, value: v, onChange: set } = latest.current;
        if (!w) return;
        const i = Math.max(0, Math.min(3, start.current + Math.round((g.dx / w) * 4)));
        if (i !== v) set(i);
      },
    })
  ).current;

  const ticks = width ? Math.floor(width / 9) + 1 : 0;
  const label = ANGLES[value].label;

  return (
    <View style={{ gap: 6 }}>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: 34 }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Rotate: ${label}`}
        accessibilityValue={{ min: 0, max: 3, now: value, text: label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.max(0, Math.min(3, value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))}
        {...pan.panHandlers}>
        {Array.from({ length: ticks }, (_, i) => (
          <View key={i} pointerEvents="none" style={{ position: 'absolute', left: i * 9, top: 8, width: 1, height: 18, backgroundColor: t.line }} />
        ))}
        <LinearGradient pointerEvents="none" colors={[t.bg, `${t.bg}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '12%' }} />
        <LinearGradient pointerEvents="none" colors={[`${t.bg}00`, t.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '12%' }} />
        <View pointerEvents="none" style={{ position: 'absolute', top: 2, left: `${12.5 + value * 25}%`, marginLeft: -1, width: 2, height: 30, borderRadius: 2, backgroundColor: t.accent }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        {ANGLES.map((a, i) => {
          const on = i === value;
          const ready = rendered?.[i] ?? true;
          return (
            <Pressable key={a.key} onPress={() => onChange(i)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={ready ? a.label : `${a.label}, not rendered yet`} style={{ flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <T size={13} w={on ? 500 : 400} tracking={0.04} color={on ? t.text : t.muted} style={{ opacity: ready || on ? 1 : 0.55 }}>
                {a.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
