// Перед рендером: длины абзацев голоса и записей (ffprobe), фразы субтитров → public/manifest.json.
// --final: без хотя бы одной записи или голоса не собираем (финал — только из настоящих записей).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MAX_SECONDS, PAUSE, SCENES } from '../src/script.ts'

const pub = join(import.meta.dirname, '..', 'public')
const final = process.argv.includes('--final')

const seconds = (path) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).toString().trim())

/** «00:00:01,250» → 1.25 */
const srtTime = (t) => {
  const [h, m, s] = t.replace(',', '.').split(':').map(Number)
  return h * 3600 + m * 60 + s
}
function cues(path) {
  if (!existsSync(path)) return null
  return readFileSync(path, 'utf8')
    .split(/\r?\n\r?\n/)
    .map((block) => block.split(/\r?\n/).filter(Boolean))
    .filter((lines) => lines.length >= 3)
    .map(([, time, ...text]) => {
      const [a, b] = time.split(' --> ')
      return { from: srtTime(a), to: srtTime(b), text: text.join(' ') }
    })
}

const missing = []
const scenes = SCENES.map((s, i) => {
  const n = String(i).padStart(2, '0')
  const mp3 = join(pub, 'voice', `${n}.mp3`)
  const voice = existsSync(mp3) ? { file: `voice/${n}.mp3`, seconds: seconds(mp3), cues: cues(join(pub, 'voice', `${n}.srt`)) } : null
  if (!voice) missing.push(`voice/${n}.mp3 (npm run voice)`)
  const path = s.footage && join(pub, 'footage', s.footage.file)
  const footage = path && existsSync(path) ? { file: `footage/${s.footage.file}`, seconds: seconds(path) } : null
  if (s.footage && !footage) missing.push(`footage/${s.footage.file} — ${s.footage.shot}`)
  // без голоса — по словам (≈ 2.4 слова в секунду), чтобы черновик собирался и без синтеза
  const talk = voice?.seconds ?? s.voice.split(/\s+/).length / 2.4
  const min = s.kind === 'logo' ? 3.2 : s.kind === 'end' ? 6 : 0
  return { id: s.id, voice, footage, seconds: Math.max(min, talk + PAUSE) }
})

const total = scenes.reduce((sum, s) => sum + s.seconds, 0)
writeFileSync(join(pub, 'manifest.json'), JSON.stringify({ final, total, scenes }, null, 2))
console.log(`${scenes.length} scenes, ${total.toFixed(1)} s (limit ${MAX_SECONDS} s)`)
for (const m of missing) console.log(`  missing: ${m}`)
if (total > MAX_SECONDS) {
  console.error(`Too long: ${total.toFixed(1)} s > ${MAX_SECONDS} s. Shorten the voice text in src/script.ts.`)
  process.exit(1)
}
if (final && missing.length) {
  console.error('The final video is made only from real footage and voice. Record the missing files first.')
  process.exit(1)
}
