// Хранилище сервера. Состояние в памяти; сохраняется в Supabase (таблица server_state), а без него — в JSON-файл в dir.
// Файлы (видео, кадры, фото) лежат в dir/files — это рабочая папка для ffmpeg и sharp; с Supabase готовые файлы
// копируются в закрытый bucket и скачиваются обратно, если папку стёр перезапуск или новый деплой
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import type { Job, PricePoint, StoreSale, Upload, WatchItem } from '@twin/shared'
import { MAX_REMOTE_FILE, type RemoteFile, type Supabase } from './supabase'

interface Db {
  uploads: Upload[]
  jobs: Job[]
  /** вишлист для слежки за ценой */
  watch: WatchItem[]
  /** все проверки цен (90 дней) */
  prices: PricePoint[]
  /** распродажи по магазинам и странам */
  sales: StoreSale[]
}

type Collection = keyof Db
const COLLECTIONS: Collection[] = ['uploads', 'jobs', 'watch', 'prices', 'sales']

export const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm' }

/** Пауза перед записью в Supabase: шаги задачи меняют её часто, отправляем пачкой */
const FLUSH_DELAY = 300
const RETRY_DELAY = 5_000

export class Store {
  readonly files: string
  private readonly dbPath: string
  private db: Db
  private readonly dirty = new Set<Collection>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private flushing: Promise<void> = Promise.resolve()
  private readonly downloads = new Map<string, Promise<boolean>>()

  constructor(
    readonly dir: string,
    private readonly remote: Supabase | null = null,
    saved?: Partial<Db>,
    private readonly log: (m: string) => void = console.log
  ) {
    this.files = join(dir, 'files')
    mkdirSync(this.files, { recursive: true })
    this.dbPath = join(dir, 'db.json')
    const local = !remote && existsSync(this.dbPath) ? (JSON.parse(readFileSync(this.dbPath, 'utf8')) as Partial<Db>) : {}
    this.db = { uploads: [], jobs: [], watch: [], prices: [], sales: [], ...(saved ?? local) }
    // задачи, которые шли во время перезапуска, уже не доедут
    const stuck = this.db.jobs.filter((j) => j.status === 'queued' || j.status === 'running')
    for (const j of stuck) Object.assign(j, { status: 'failed', error: 'Сервер перезапустился во время задачи', errorCode: 'internal' })
    if (stuck.length) this.save('jobs')
  }

  /** С Supabase — состояние оттуда (переживает перезапуски и деплои), без него — из dir/db.json */
  static async open(dir: string, remote: Supabase | null, log: (m: string) => void = console.log): Promise<Store> {
    if (!remote) return new Store(dir, null, undefined, log)
    const rows = await remote.loadState()
    const saved = Object.fromEntries(rows.filter((r) => (COLLECTIONS as string[]).includes(r.key) && Array.isArray(r.data)).map((r) => [r.key, r.data])) as Partial<Db>
    return new Store(dir, remote, saved, log)
  }

  get kind(): 'supabase' | 'local' {
    return this.remote ? 'supabase' : 'local'
  }

  id(): string {
    return randomUUID().replace(/-/g, '').slice(0, 16)
  }

  /** Путь к файлу в рабочей папке; имя — только из id и расширения, без путей от клиента */
  path(name: string): string {
    if (!/^[a-z0-9_.-]+$/i.test(name)) throw new Error(`Плохое имя файла: ${name}`)
    return join(this.files, name)
  }

  addUpload(u: Upload): Upload {
    this.db.uploads.push(u)
    this.save('uploads')
    return u
  }

  uploads(): Upload[] {
    return this.db.uploads
  }

  upload(id: string): Upload | undefined {
    return this.db.uploads.find((u) => u.id === id)
  }

  addJob(j: Job): Job {
    this.db.jobs.push(j)
    this.save('jobs')
    return j
  }

  job(id: string): Job | undefined {
    return this.db.jobs.find((j) => j.id === id)
  }

  jobs(): Job[] {
    return this.db.jobs
  }

  updateJob(id: string, patch: Partial<Job>): Job {
    const j = this.job(id)
    if (!j) throw new Error(`Нет задачи ${id}`)
    Object.assign(j, patch, { updatedAt: new Date().toISOString() })
    this.save('jobs')
    return j
  }

  watch(): WatchItem[] {
    return this.db.watch
  }

  setWatch(items: WatchItem[]): void {
    this.db.watch = items
    this.save('watch')
  }

  prices(itemId?: string): PricePoint[] {
    return itemId ? this.db.prices.filter((p) => p.itemId === itemId) : this.db.prices
  }

  /** Добавляет проверку и забывает проверки старше 90 дней */
  addPrice(point: PricePoint): void {
    const cutoff = Date.parse(point.checkedAt) - 90 * 86_400_000
    this.db.prices = [...this.db.prices.filter((p) => Date.parse(p.checkedAt) >= cutoff), point]
    this.save('prices')
  }

  sales(): StoreSale[] {
    return this.db.sales
  }

  setSale(sale: StoreSale): void {
    this.db.sales = [...this.db.sales.filter((s) => !(s.storeId === sale.storeId && s.country === sale.country)), sale]
    this.save('sales')
  }

  /** Убирает записи загрузок и задач, для которых keep вернул false */
  prune(keepUpload: (u: Upload) => boolean, keepJob: (j: Job) => boolean): { uploads: Upload[]; jobs: Job[] } {
    const uploads = this.db.uploads.filter((u) => !keepUpload(u))
    const jobs = this.db.jobs.filter((j) => !keepJob(j))
    this.db.uploads = this.db.uploads.filter(keepUpload)
    this.db.jobs = this.db.jobs.filter(keepJob)
    if (uploads.length) this.save('uploads')
    if (jobs.length) this.save('jobs')
    return { uploads, jobs }
  }

  /** Дописывает несохранённое в Supabase (перед остановкой сервера и в тестах); записи идут по одной, по порядку */
  flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.flushing = this.flushing.then(async () => {
      if (!this.remote || !this.dirty.size) return
      const keys = [...this.dirty]
      this.dirty.clear()
      try {
        await this.remote.saveState(keys.map((key) => ({ key, data: this.db[key] })))
      } catch (e) {
        for (const k of keys) this.dirty.add(k)
        this.log(`Supabase: состояние не записалось, повторю через ${RETRY_DELAY / 1000} с (${e instanceof Error ? e.message : e})`)
        this.timer ??= setTimeout(() => void this.flush(), RETRY_DELAY)
      }
    })
    return this.flushing
  }

  /** Копирует готовые файлы в Supabase; без Supabase и для файлов больше предела — ничего не делает */
  async keep(names: string[]): Promise<number> {
    if (!this.remote) return 0
    let sent = 0
    for (const name of names) {
      const path = this.path(name)
      if (!existsSync(path) || statSync(path).size > MAX_REMOTE_FILE) continue
      await this.remote.putFile(name, readFileSync(path), MIME[extname(name).toLowerCase()] ?? 'application/octet-stream')
      sent++
    }
    return sent
  }

  /** Все файлы задачи: их имена начинаются с её id */
  keepJobFiles(id: string): Promise<number> {
    return this.keep(readdirSync(this.files).filter((n) => n.startsWith(id) && !n.endsWith('.part')))
  }

  /** Есть ли файл в рабочей папке; если нет — скачивает его из Supabase */
  async ensure(name: string): Promise<boolean> {
    const path = this.path(name)
    if (existsSync(path)) return true
    if (!this.remote) return false
    // два запроса одного файла разом качают его один раз
    let p = this.downloads.get(name)
    if (!p) {
      p = this.remote.download(name, path).finally(() => this.downloads.delete(name))
      this.downloads.set(name, p)
    }
    return p
  }

  remoteFiles(): Promise<RemoteFile[]> {
    return this.remote ? this.remote.listFiles() : Promise.resolve([])
  }

  async forget(names: string[]): Promise<void> {
    if (this.remote && names.length) await this.remote.removeFiles(names)
  }

  private save(key: Collection): void {
    if (!this.remote) {
      writeFileSync(this.dbPath, JSON.stringify(this.db, null, 1))
      return
    }
    this.dirty.add(key)
    this.timer ??= setTimeout(() => void this.flush(), FLUSH_DELAY)
  }
}
