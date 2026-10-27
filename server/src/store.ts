// Хранилище сервера до Supabase: JSON-файл и папка с файлами в server/data (не попадает в git)
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Job, Upload } from '@twin/shared'

interface Db {
  uploads: Upload[]
  jobs: Job[]
}

export class Store {
  readonly files: string
  private readonly dbPath: string
  private db: Db

  constructor(readonly dir: string) {
    this.files = join(dir, 'files')
    mkdirSync(this.files, { recursive: true })
    this.dbPath = join(dir, 'db.json')
    this.db = existsSync(this.dbPath) ? (JSON.parse(readFileSync(this.dbPath, 'utf8')) as Db) : { uploads: [], jobs: [] }
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

  private save(): void {
    writeFileSync(this.dbPath, JSON.stringify(this.db, null, 1))
  }
}
