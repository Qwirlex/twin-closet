// Видео целиком: сцены подряд, длина каждой — по её абзацу голоса (public/manifest.json от scripts/prepare.mjs)
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { Chips, type Cue, Device, DraftBadge, Logo, SceneTitle, splitCues, Subtitles, Wordmark } from './parts'
import { LINKS, MODELS, SCENES, type Scene } from './script'
import { C, fontFamily, glass, label, rise } from './theme'

export interface SceneTiming {
  id: string
  seconds: number
  voice: { file: string; seconds: number; cues: Cue[] | null } | null
  footage: { file: string; seconds: number } | null
}

// type, а не interface: Remotion ждёт пропсы, совместимые с Record<string, unknown>
export type DemoProps = {
  final: boolean
  scenes: SceneTiming[]
}

export function framesOf(t: SceneTiming, fps: number): number {
  return Math.ceil(t.seconds * fps)
}

export function Demo({ final, scenes }: DemoProps) {
  const { fps } = useVideoConfig()
  const apps = SCENES.filter((s) => s.kind === 'app')
  let at = 0
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {SCENES.map((s, i) => {
        const t = scenes[i]
        const from = at
        const frames = framesOf(t, fps)
        at += frames
        return (
          <Sequence key={s.id} from={from} durationInFrames={frames} name={s.id}>
            <SceneBody scene={s} timing={t} frames={frames} index={apps.indexOf(s) + 1} total={apps.length} />
            {t.voice ? <Audio src={staticFile(t.voice.file)} /> : null}
            <Subtitles cues={splitCues(t.voice?.cues ?? [{ from: 0, to: t.seconds, text: s.voice }])} />
          </Sequence>
        )
      })}
      {final ? null : <DraftBadge />}
    </AbsoluteFill>
  )
}

function SceneBody({ scene, timing, frames, index, total }: { scene: Scene; timing: SceneTiming; frames: number; index: number; total: number }) {
  const fade = useFadeOut(frames)
  const body =
    scene.kind === 'hook' ? <Hook /> : scene.kind === 'logo' ? <LogoScene /> : scene.kind === 'how' ? <How /> : scene.kind === 'end' ? <End scene={scene} timing={timing} frames={frames} /> : (
      <>
        <SceneTitle index={index} total={total} title={scene.title!} sub={scene.sub} />
        {scene.footage ? <Device footage={scene.footage} file={timing.footage?.file ?? null} seconds={timing.footage?.seconds ?? null} sceneFrames={frames} /> : null}
        {scene.chips ? <Chips chips={scene.chips} sceneFrames={frames} /> : null}
      </>
    )
  return <AbsoluteFill style={{ opacity: fade }}>{body}</AbsoluteFill>
}

/** Сцена уходит в чёрный за последние 0.3 с — переход без вспышек */
function useFadeOut(frames: number): number {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return interpolate(frame, [frames - 0.3 * fps, frames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
}

/** Хук — только типографика на чёрном, без нарисованных экранов */
function Hook() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const line = (text: string, at: number, color = C.text) => (
    <div style={{ fontFamily, fontWeight: 300, fontSize: 92, letterSpacing: '-0.03em', color, lineHeight: 1.12, ...rise(frame, at * fps, 420) }}>{text}</div>
  )
  return (
    <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 220 }}>
      {line('You saw it. You bought it.', 0.2)}
      {line('It looked different on you.', 3.4)}
      {line('And you already had one like it.', 7.2, C.accent)}
    </AbsoluteFill>
  )
}

function LogoScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 34 }}>
      <Logo size={230} />
      <div style={rise(frame, 1.3 * fps, 400)}>
        <Wordmark size={104} />
      </div>
      <div style={{ fontFamily, fontSize: 32, color: C.muted, ...rise(frame, 1.8 * fps, 400) }}>Your closet, on you.</div>
    </AbsoluteFill>
  )
}

/** Схема: телефон → сервер → модели Meta, у каждой одна строка роли; линии рисуются по очереди */
function How() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const draw = (at: number) => interpolate(frame, [at * fps, (at + 0.5) * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const node = (title: string, sub: string, x: number, y: number, w: number, at: number, accent = false) => (
    <div style={{ position: 'absolute', left: x, top: y, width: w, ...glass, padding: '22px 26px', fontFamily, ...rise(frame, at * fps) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {accent ? <div style={{ width: 9, height: 9, borderRadius: 5, background: C.accent }} /> : null}
        <div style={{ color: C.text, fontSize: 28, fontWeight: 600 }}>{title}</div>
      </div>
      <div style={{ color: C.muted, fontSize: 21, marginTop: 8, lineHeight: 1.35, marginLeft: accent ? 21 : 0 }}>{sub}</div>
    </div>
  )
  const ys = [300, 470, 640]
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 120, top: 120, fontFamily, color: C.text, fontWeight: 300, fontSize: 68, letterSpacing: '-0.03em', ...rise(frame, 4) }}>How it works</div>
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0 }}>
        <path d="M520 525 H700" stroke={C.line} strokeWidth={2} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={draw(0.5)} />
        {ys.map((y, i) => (
          <path key={y} d={`M1080 525 C1150 525 1150 ${y + 55} 1220 ${y + 55}`} stroke={C.accent} strokeOpacity={0.6} strokeWidth={2} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={draw(1.2 + i * 0.5)} />
        ))}
      </svg>
      {node('Your phone', 'camera, live checks, the app', 120, 470, 400, 0.2)}
      {node('Twin Closet server', 'best frames, jobs, try-on compositing', 700, 470, 380, 0.8)}
      {MODELS.map((m, i) => node(m.name, m.job, 1220, ys[i], 580, 1.4 + i * 0.5, true))}
    </AbsoluteFill>
  )
}

function End({ scene, timing, frames }: { scene: Scene; timing: SceneTiming; frames: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const cardAt = Math.max(1.5, frames / fps - 3.2)
  const footageOut = interpolate(frame, [(cardAt - 0.4) * fps, cardAt * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: footageOut }}>
        {scene.footage ? <Device footage={scene.footage} file={timing.footage?.file ?? null} seconds={timing.footage?.seconds ?? null} sceneFrames={Math.round(cardAt * fps)} /> : null}
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 30, opacity: 1 - footageOut }}>
        <Logo size={150} start={cardAt * fps} />
        <Wordmark size={84} />
        <div style={{ fontFamily, fontSize: 30, color: C.muted }}>Buy less. Wear more of what you own.</div>
        <div style={{ display: 'flex', gap: 18, marginTop: 20 }}>
          {[LINKS.web, LINKS.code].map((l) => (
            <div key={l} style={{ ...glass, borderRadius: 999, padding: '14px 26px', fontFamily, fontSize: 26, color: C.text }}>
              {l}
            </div>
          ))}
        </div>
        <div style={{ ...label, color: C.muted, marginTop: 10 }}>Meta Global AI Developer Hackathon</div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
