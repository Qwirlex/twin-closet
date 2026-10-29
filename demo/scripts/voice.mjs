// Голос кодом: каждый абзац сценария → edge-tts (нейроголос Microsoft) → public/voice/NN.mp3 + NN.srt (фразы по времени).
// Своя запись (demo/voice.m4a) — запасной вариант, docs/demo-video.md §5.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCENES, VOICE, VOICE_RATE } from '../src/script.ts'

const out = join(import.meta.dirname, '..', 'public', 'voice')
mkdirSync(out, { recursive: true })
const only = process.argv[2]

for (const [i, s] of SCENES.entries()) {
  if (only && s.id !== only) continue
  const n = String(i).padStart(2, '0')
  const text = join(out, `${n}.txt`)
  writeFileSync(text, s.voice)
  const raw = join(out, `${n}.raw.mp3`)
  execFileSync('python', ['-m', 'edge_tts', '--voice', VOICE, `--rate=${VOICE_RATE}`, '-f', text, '--write-media', raw, '--write-subtitles', join(out, `${n}.srt`)], { stdio: 'inherit' })
  // громкость как у роликов в сети (−16 LUFS): синтез выходит тихим
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', join(out, `${n}.mp3`)])
  rmSync(raw)
  console.log(`${n} ${s.id}`)
}
