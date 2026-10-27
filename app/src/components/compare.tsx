import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState, type ReactNode } from 'react';
import { PanResponder, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Glass, PhotoChip } from '@/components/ui';
import type { Pic } from '@/data/demo';
import { PHOTO_BG, PHOTO_GLASS } from '@/theme/tokens';

const CLEAR = 'rgba(39,39,39,0)';

/**
 * Рендер «до / после» на всю ширину: фото 3:4, слева твоя одежда, справа примерка.
 * Вертикальная линия со стеклянной ручкой тянется пальцем; края фото гаснут в фон.
 */
export function CompareRender({ width, top = 80, before, after, overlay, children }: { width: number; top?: number; before: Pic; after: Pic | null; overlay?: ReactNode; children?: ReactNode }) {
  const [split, setSplit] = useState(52);
  const splitRef = useRef(split);
  splitRef.current = split;
  const startRef = useRef(split);
  const widthRef = useRef(width);
  widthRef.current = width;

  const photoW = width * 0.92;
  const photoH = (photoW * 4) / 3;
  const photoLeft = width * 0.04;
  const height = top + photoH;
  const clip = Math.max(0, Math.min(photoW, (split / 100) * width - photoLeft));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startRef.current = splitRef.current;
      },
      onPanResponderMove: (_, g) => setSplit(Math.max(4, Math.min(96, startRef.current + (g.dx / widthRef.current) * 100))),
    })
  ).current;

  const fade = (side: 'left' | 'right') => (
    <LinearGradient
      pointerEvents="none"
      colors={side === 'left' ? [PHOTO_BG, CLEAR] : [CLEAR, PHOTO_BG]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: photoW * 0.1 }}
    />
  );

  return (
    <View style={{ height, backgroundColor: PHOTO_BG, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', top, left: photoLeft, width: photoW, height: photoH }}>
        <Image source={before} contentFit="cover" style={{ width: photoW, height: photoH }} accessibilityLabel="You in your own clothes" />
        {after ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: clip, right: 0, overflow: 'hidden' }}>
            <Image source={after} contentFit="cover" style={{ position: 'absolute', top: 0, left: -clip, width: photoW, height: photoH }} accessibilityLabel="Try-on result" />
          </View>
        ) : null}
        {fade('left')}
        {fade('right')}
      </View>
      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 110 }} />

      {after ? (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', top: top + 32, bottom: 0, left: `${split}%`, width: 1.5, marginLeft: -0.75, backgroundColor: 'rgba(255,255,255,0.8)' }}>
            <Glass variant="photo" style={{ position: 'absolute', top: '46%', left: -21.25, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="compare" size={18} color={PHOTO_GLASS.text} stroke={1.8} />
            </Glass>
          </View>
          <View
            style={{ position: 'absolute', left: 0, right: 0, top: top + 40, bottom: 70 }}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Compare your clothes and the try-on"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(split) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => setSplit((s) => Math.max(4, Math.min(96, s + (e.nativeEvent.actionName === 'increment' ? 10 : -10))))}
            {...pan.panHandlers}
          />
          <PhotoChip style={{ position: 'absolute', left: 16, bottom: 16 }}>Yours</PhotoChip>
          <PhotoChip style={{ position: 'absolute', right: 16, bottom: 16 }}>Try-on</PhotoChip>
        </>
      ) : null}
      {overlay}
      {children}
    </View>
  );
}
