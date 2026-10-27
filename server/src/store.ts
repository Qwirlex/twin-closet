// Хранилище сервера до Supabase: JSON-файл и папка с файлами в server/data (не попадает в git)
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Job, PricePoint, StoreSale, Upload, WatchItem } from '@twin/shared'

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

export class Store {
  readonly files: string
  private readonly dbPath: string
  private db: Db

  constructor(readonly dir: string) {
    this.files = join(dir, 'files')
    mkdirSync(this.files, { recursive: true })
    this.dbPath = join(dir, 'db.json')
    this.db = { uploads: [], jobs: [], watch: [], prices: [], sales: [], ...(existsSync(this.dbPath) ? (JSON.parse(readFileSync(this.dbPath, 'utf8')) as Partial<Db>) : {}) }
    // задачи, которые шли во время перезапуска, уже не доедут
    for (const j of this.db.jobs) if (j.status === 'queued' || j.status === 'running') Object.assign(j, { status: 'failed', error: 'Сервер перезапустился во время задачи', errorCode: 'internal' })
  }

  id(): string {
    return randomUUID().replace(/-/g, '').slice(0, 16)
  }

  /** Путь к файлу в хранилище; имя — только из id и расширения, без путей от клиента */
  path(name: string): string {
    if (!/^[a-z0-9_.-]+$/i.test(name)) throw new Error(`Плохое имя файла: ${name}`)
    return join(this.files, name)
  }

  addUpload(u: Upload): Upload {
    this.db.uploads.push(u)
    this.save()
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
    this.save()
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
    this.save()
    return j
  }

  watch(): WatchItem[] {
    return this.db.watch
  }

  setWatch(items: WatchItem[]): void {
    this.db.watch = items
    this.save()
  }

  prices(itemId?: string): PricePoint[] {
    return itemId ? this.db.prices.filter((p) => p.itemId === itemId) : this.db.prices
  }

  /** Добавляет проверку и забывает проверки старше 90 дней */
  addPrice(point: PricePoint): void {
    const cutoff = Date.parse(point.checkedAt) - 90 * 86_400_000
    this.db.prices = [...this.db.prices.filter((p) => Date.parse(p.checkedAt) >= cutoff), point]
    this.save()
  }

  sales(): StoreSale[] {
    return this.db.sales
  }

  setSale(sale: StoreSale): void {
    this.db.sales = [...this.db.sales.filter((s) => !(s.storeId === sale.storeId && s.country === sale.country)), sale]
    this.save()
  }

  /** Убирает записи загрузок и задач, для которых keep вернул false */
  prune(keepUpload: (u: Upload) => boolean, keepJob: (j: Job) => boolean): { uploads: Upload[]; jobs: Job[] } {
    const uploads = this.db.uploads.filter((u) => !keepUpload(u))
    const jobs = this.db.jobs.filter((j) => !keepJob(j))
    this.db.uploads = this.db.uploads.filter(keepUpload)
    this.db.jobs = this.db.jobs.filter(keepJob)
    if (uploads.length || jobs.length) this.save()
    return { uploads, jobs }
  }

  private save(): void {
    writeFileSync(this.dbPath, JSON.stringify(this.db, null, 1))
  }
}
