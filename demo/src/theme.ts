// Дизайн-система Noir (docs/design.md): почти чёрный фон, один золотой акцент, Inter Tight, тонкие линии
import { loadFont } from '@remotion/google-fonts/InterTight'
import { Easing, interpolate } from 'remotion'

export const { fontFamily } = loadFont('normal', { weights: ['300', '400', '500', '600'], subsets: ['latin'] })

export const C = {
  bg: '#0B0B0C',
  surface: '#141416',
  surface2: '#1C1C1F',
  line: '#2A2A2D',
  text: '#F5F5F4',
  muted: '#A8A29E',
  accent: '#C8B68A'
}

export const W = 1920
export const H = 1080
export const FPS = 30

/** Спокойное появление: 150–400 мс, ease-out, без пружин */
export function rise(frame: number, start: number, ms = 360): { opacity: number; transform: string } {
  const p = interpolate(frame, [start, start + (ms / 1000) * FPS], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) })
  return { opacity: p, transform: `translateY(${(1 - p) * 14}px)` }
}

export const label = { fontFamily, fontWeight: 500, fontSize: 18, letterSpacing: '0.14em', textTransform: 'uppercase' as const }

/** Стеклянная плашка */
export const glass = {
  background: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))',
  border: `1px solid rgba(255,255,255,0.10)`,
  boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
  borderRadius: 18
}
