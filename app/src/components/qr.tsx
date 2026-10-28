import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { toQR } from 'toqr';

/** QR-код: тёмные модули одним путём, белое поле вокруг — его читает любая камера телефона */
export function QrCode({ value, size, label }: { value: string; size: number; label: string }) {
  const { d, n } = useMemo(() => {
    const m = toQR(value);
    const side = Math.round(Math.sqrt(m.length));
    let path = '';
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) if (m[y * side + x]) path += `M${x} ${y}h1v1h-1z`;
    return { d: path, n: side };
  }, [value]);
  const q = 3;
  return (
    <Svg width={size} height={size} viewBox={`${-q} ${-q} ${n + 2 * q} ${n + 2 * q}`} accessibilityLabel={label} accessibilityRole="image">
      <Rect x={-q} y={-q} width={n + 2 * q} height={n + 2 * q} fill="#FFFFFF" />
      <Path d={d} fill="#0B0B0C" />
    </Svg>
  );
}
