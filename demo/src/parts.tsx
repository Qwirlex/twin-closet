// Детали кадра: логотип, телефон и ноутбук, карточка «нужна запись», плашки моделей, субтитры, метка DRAFT
import { Freeze, interpolate, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, Easing } from 'remotion'
import type { Chip, Footage } from './script'
import { C, fontFamily, glass, label, rise } from './theme'

export interface Cue {
  from: number
  to: number
  text: string
}

/** Разделённая вешалка: белый крючок и левое плечо рисуются линией, потом золотое правое плечо */
export function Logo({ start = 0, size = 220 }: { start?: number; size?: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const draw = (from: number, sec: number) => interpolate(frame, [start + from * fps, start + (from + sec) * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) })
  const stroke = { fill: 'none', strokeWidth: 3.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, pathLength: 1, strokeDasharray: 1 }
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <path d="M27.5 15a4.5 4.5 0 1 1 4.5 4.5V25" stroke={C.text} {...stroke} strokeDashoffset={draw(0, 0.5)} />
      <path d="M32 25L9.5 44.2c-1.4 1.2-.6 3.3 1.2 3.3H32" stroke={C.text} {...stroke} strokeDashoffset={draw(0.35, 0.6)} />
      <path d="M32 25l22.5 19.2c1.4 1.2.6 3.3-1.2 3.3H32" stroke={C.accent} {...stroke} strokeDashoffset={draw(0.8, 0.6)} />
    </svg>
  )
}

export function Wordmark({ size = 96 }: { size?: number }) {
  return (
    <div style={{ fontFamily, fontSize: size, letterSpacing: '-0.03em', color: C.text, lineHeight: 1 }}>
      <span style={{ fontWeight: 600 }}>Twin</span> <span style={{ fontWeight: 300 }}>Closet</span>
    </div>
  )
}

const FRAMES = {
  phone: { width: 400, height: 866, radius: 56, top: 64 },
  laptop: { width: 1040, height: 650, radius: 22, top: 150 }
}

/** Запись в рамке телефона или ноутбука; без записи — честная карточка «нужна запись» */
export function Device({ footage, file, seconds, sceneFrames }: { footage: Footage; file: string | null; seconds: number | null; sceneFrames: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const f = FRAMES[footage.frame]
  // длинную запись ускоряем под голос (как «×3» в сценарии), короткую — замедляем не больше чем вдвое и держим последний кадр
  const rate = seconds ? Math.min(4, Math.max(0.5, seconds / (sceneFrames / fps))) : 1
  const playFrames = seconds ? Math.floor((seconds * fps) / rate) - 1 : 0
  const video = file ? <OffthreadVideo src={staticFile(file)} playbackRate={rate} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null
  const scale = interpolate(frame, [0, sceneFrames], [1, 1.025])
  const device = (
    <div style={{ position: 'absolute', left: (1920 - f.width) / 2, top: f.top, width: f.width, height: f.height, borderRadius: f.radius, border: `1px solid ${C.line}`, background: '#000', overflow: 'hidden', boxShadow: '0 40px 120px rgba(0,0,0,0.6)', ...rise(frame, 0, 400), transform: `${rise(frame, 0, 400).transform} scale(${scale})` }}>
      {video ? frame < playFrames ? video : <Freeze frame={Math.max(0, playFrames)}>{video}</Freeze> : <FootageNeeded footage={footage} />}
    </div>
  )
  return footage.note && file ? (
    <>
      {device}
      <div style={{ position: 'absolute', left: 0, right: 0, top: f.top + f.height + 14, textAlign: 'center', fontFamily, fontSize: 19, color: C.muted, ...rise(frame, 12) }}>{footage.note}</div>
    </>
  ) : (
    device
  )
}

function FootageNeeded({ footage }: { footage: Footage }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.surface, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: footage.frame === 'phone' ? 40 : 80, gap: 22, fontFamily }}>
      <div style={{ ...label, color: C.accent, fontSize: 16 }}>Footage needed</div>
      <div style={{ color: C.text, fontSize: 30, fontWeight: 500, letterSpacing: '-0.01em' }}>{footage.file}</div>
      <div style={{ color: C.muted, fontSize: 24, lineHeight: 1.45, fontWeight: 400 }}>{footage.shot}</div>
      <div style={{ height: 1, background: C.line, margin: '6px 0' }} />
      <div style={{ color: C.muted, fontSize: 18, lineHeight: 1.5 }}>Recorded from the real app with real model output on day 9.</div>
    </div>
  )
}

export function SceneTitle({ index, total, title, sub }: { index: number; total: number; title: string; sub?: string }) {
  const frame = useCurrentFrame()
  return (
    <div style={{ position: 'absolute', left: 120, top: 360, width: 520, fontFamily }}>
      <div style={{ ...label, color: C.muted, ...rise(frame, 6) }}>
        {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>
      <div style={{ color: C.text, fontWeight: 300, fontSize: 68, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: 22, ...rise(frame, 10) }}>{title}</div>
      {sub ? <div style={{ color: C.muted, fontSize: 26, lineHeight: 1.4, marginTop: 22, ...rise(frame, 16) }}>{sub}</div> : null}
    </div>
  )
}

/** Плашки справа: модель Meta (золотая точка) — только когда она работает; note — подпись без модели */
export function Chips({ chips, sceneFrames }: { chips: Chip[]; sceneFrames: number }) {
  const frame = useCurrentFrame()
  const step = Math.min(70, Math.floor((sceneFrames * 0.55) / Math.max(1, chips.length)))
  return (
    <div style={{ position: 'absolute', left: 1300, top: 330, width: 500, display: 'flex', flexDirection: 'column', gap: 18, fontFamily }}>
      {chips.map((c, i) => (
        <div key={i} style={{ ...glass, padding: '20px 24px', ...rise(frame, 24 + i * step) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 9, height: 9, borderRadius: 5, background: c.kind === 'model' ? C.accent : 'transparent', border: c.kind === 'model' ? 'none' : `1.5px solid ${C.muted}` }} />
            <div style={{ color: C.text, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}>{c.name}</div>
          </div>
          <div style={{ color: C.muted, fontSize: 22, marginTop: 8, marginLeft: 21, lineHeight: 1.35 }}>{c.job}</div>
        </div>
      ))}
    </div>
  )
}

const MAX_WORDS = 10

/** Кусок длиннее MAX_WORDS — поровну по словам */
function evenly(text: string): string[] {
  const words = text.split(/\s+/)
  if (words.length <= MAX_WORDS) return [text]
  const n = Math.ceil(words.length / MAX_WORDS)
  const per = Math.ceil(words.length / n)
  const out: string[] = []
  for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(' '))
  return out
}

/** Длинную фразу делим по запятым и двоеточиям (куски до 10 слов), без опоры — поровну; время — по доле символов */
export function splitCues(cues: Cue[]): Cue[] {
  return cues.flatMap((c) => {
    if (c.text.split(/\s+/).length <= MAX_WORDS) return [c]
    const parts: string[] = []
    for (const clause of c.text.split(/(?<=[,:;])\s+/).flatMap(evenly)) {
      const last = parts[parts.length - 1]
      if (last && `${last} ${clause}`.split(/\s+/).length <= MAX_WORDS) parts[parts.length - 1] = `${last} ${clause}`
      else parts.push(clause)
    }
    const chars = parts.reduce((s, p) => s + p.length, 0)
    let t = c.from
    return parts.map((p) => {
      const d = ((c.to - c.from) * p.length) / chars
      const cue = { from: t, to: t + d, text: p }
      t += d
      return cue
    })
  })
}

/** Субтитры вшиты: многие судьи смотрят без звука */
export function Subtitles({ cues }: { cues: Cue[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const t = frame / fps
  const cue = cues.find((c) => t >= c.from && t < c.to)
  if (!cue) return null
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 46, display: 'flex', justifyContent: 'center' }}>
      <div style={{ fontFamily, fontSize: 32, fontWeight: 500, color: C.text, background: 'rgba(11,11,12,0.82)', padding: '10px 22px', borderRadius: 12, maxWidth: 1300, textAlign: 'center', lineHeight: 1.35 }}>{cue.text}</div>
    </div>
  )
}

export function DraftBadge() {
  return (
    <div style={{ position: 'absolute', right: 40, top: 36, ...glass, borderRadius: 999, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, fontFamily }}>
      <div style={{ width: 8, height: 8, borderRadius: 4, background: C.accent }} />
      <div style={{ ...label, fontSize: 15, color: C.text }}>Draft · footage comes on day 9</div>
    </div>
  )
}
