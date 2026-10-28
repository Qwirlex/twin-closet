// Фото тела и шкафа — личные: загрузки, кадры и результаты задач стираем через RETAIN_HOURS (по умолчанию 48 часов),
// и в рабочей папке сервера, и в Supabase. Готовые результаты по образцам для судей (sample) храним — это кэш,
// на нём не тратятся кредиты.
import { readdirSync, rmSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { Store } from './store'

export function retainHours(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.RETAIN_HOURS)
  return Number.isFinite(n) && n > 0 ? n : 48
}

export async function cleanup(store: Store, now = Date.now(), hours = retainHours()): Promise<{ files: number; remote: number; uploads: number; jobs: number }> {
  const cutoff = now - hours * 3_600_000
  const old = (iso: string) => Date.parse(iso) < cutoff
  const { uploads, jobs } = store.prune(
    (u) => !old(u.createdAt),
    (j) => j.sample !== null || !old(j.createdAt)
  )
  // файлы оставшихся задач (и кэша образцов) начинаются с id задачи; файлы оставшихся загрузок — по имени
  const keepJobs = store.jobs().map((j) => j.id)
  const keepUploads = new Set(store.uploads().map((u) => basename(u.url)))
  const kept = (name: string) => keepUploads.has(name) || keepJobs.some((id) => name.startsWith(id))
  const fromRemoved = (name: string) => uploads.some((u) => basename(u.url) === name) || jobs.some((j) => name.startsWith(j.id))

  let files = 0
  for (const name of readdirSync(store.files)) {
    if (kept(name)) continue
    const path = join(store.files, name)
    if (statSync(path).mtimeMs < cutoff || fromRemoved(name)) {
      rmSync(path, { force: true })
      files++
    }
  }

  const gone = (await store.remoteFiles()).filter((f) => !kept(f.name) && (fromRemoved(f.name) || !f.updatedAt || old(f.updatedAt))).map((f) => f.name)
  await store.forget(gone)
  return { files, remote: gone.length, uploads: uploads.length, jobs: jobs.length }
}

/** При запуске и каждые 6 часов */
export function scheduleCleanup(store: Store, log: (m: string) => void = console.log): () => void {
  const run = async () => {
    try {
      const r = await cleanup(store)
      if (r.files || r.remote || r.uploads || r.jobs) log(`Очистка: файлов ${r.files}, в Supabase ${r.remote}, загрузок ${r.uploads}, задач ${r.jobs}`)
    } catch (e) {
      log(`Очистка: ошибка ${e instanceof Error ? e.message : e}`)
    }
  }
  void run()
  const t = setInterval(() => void run(), 6 * 3_600_000)
  return () => clearInterval(t)
}
