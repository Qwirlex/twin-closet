// Фото тела и шкафа — личные: загрузки, кадры и результаты задач стираем через RETAIN_HOURS (по умолчанию 48 часов).
// Готовые результаты по образцам для судей (sample) храним — это кэш, на нём не тратятся кредиты.
import { readdirSync, rmSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Store } from './store'

export function retainHours(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.RETAIN_HOURS)
  return Number.isFinite(n) && n > 0 ? n : 48
}

export function cleanup(store: Store, now = Date.now(), hours = retainHours()): { files: number; uploads: number; jobs: number } {
  const cutoff = now - hours * 3_600_000
  const old = (iso: string) => Date.parse(iso) < cutoff
  const { uploads, jobs } = store.prune(
    (u) => !old(u.createdAt),
    (j) => j.sample !== null || !old(j.createdAt)
  )
  // файлы оставшихся задач (и кэша образцов) начинаются с id задачи; файлы оставшихся загрузок — по имени
  const keepJobs = store.jobs().map((j) => j.id)
  const keepUploads = new Set(store.uploads().map((u) => basename(u.url)))
  let files = 0
  for (const name of readdirSync(store.files)) {
    if (keepUploads.has(name) || keepJobs.some((id) => name.startsWith(id))) continue
    const path = join(store.files, name)
    const stale = statSync(path).mtimeMs < cutoff
    const fromRemoved = uploads.some((u) => basename(u.url) === name) || jobs.some((j) => name.startsWith(j.id))
    if (stale || fromRemoved) {
      rmSync(path, { force: true })
      files++
    }
  }
  return { files, uploads: uploads.length, jobs: jobs.length }
}

/** При запуске и каждые 6 часов */
export function scheduleCleanup(store: Store, log: (m: string) => void = console.log): () => void {
  const run = () => {
    try {
      const r = cleanup(store)
      if (r.files || r.uploads || r.jobs) log(`Очистка: файлов ${r.files}, загрузок ${r.uploads}, задач ${r.jobs}`)
    } catch (e) {
      log(`Очистка: ошибка ${e instanceof Error ? e.message : e}`)
    }
  }
  run()
  const t = setInterval(run, 6 * 3_600_000)
  return () => clearInterval(t)
}
