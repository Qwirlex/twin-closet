// Supabase для сервера, через REST без SDK: состояние — таблица server_state, файлы — закрытый bucket server-files
// (supabase/migrations/0002_server_state.sql). Ключ секретный (sb_secret_…), живёт только в окружении сервера.
// Новые ключи — не JWT: шлём их только в заголовке apikey, Authorization Supabase подставит сам
import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export const BUCKET = 'server-files'
/** Предел одного файла на бесплатном тарифе Supabase; файлы больше остаются только на диске сервера */
export const MAX_REMOTE_FILE = 50 * 1024 * 1024

export interface StateRow {
  key: string
  data: unknown
}

export interface RemoteFile {
  name: string
  updatedAt: string | null
}

/**
 * Пространство в проекте: у сервера на Render — main, у сервера на ПК — dev. Каждый держит состояние в памяти
 * и пишет его целиком, поэтому в общих строках они затирали бы друг друга. Строки — `<space>/<коллекция>`, файлы — в папке <space>/
 */
export const DEFAULT_SPACE = 'main'

export class Supabase {
  constructor(
    readonly url: string,
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = fetch,
    readonly space = DEFAULT_SPACE
  ) {
    if (!/^[a-z0-9-]{1,32}$/.test(space)) throw new Error(`SUPABASE_SPACE: только латиница, цифры и дефис, а не «${space}»`)
  }

  /** null — Supabase не настроен, сервер хранит всё у себя в DATA_DIR */
  static fromEnv(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Supabase | null {
    const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '')
    const key = env.SUPABASE_SECRET_KEY?.trim()
    return url && key ? new Supabase(url, key, fetchImpl, env.SUPABASE_SPACE?.trim() || DEFAULT_SPACE) : null
  }

  private object(name: string): string {
    return `${this.space}/${encodeURIComponent(name)}`
  }

  private async request(path: string, init: RequestInit = {}, allow: number[] = []): Promise<Response> {
    const res = await this.fetchImpl(`${this.url}${path}`, { ...init, headers: { apikey: this.key, ...(init.headers as Record<string, string> | undefined) } })
    if (!res.ok && !allow.includes(res.status)) {
      const detail = (await res.text().catch(() => '')).slice(0, 200)
      throw new Error(`Supabase ${init.method ?? 'GET'} ${path.split('?')[0]}: ${res.status} ${detail}`)
    }
    return res
  }

  async loadState(): Promise<StateRow[]> {
    const prefix = `${this.space}/`
    const rows = (await (await this.request(`/rest/v1/server_state?select=key,data&key=like.${encodeURIComponent(`${prefix}*`)}`)).json()) as StateRow[]
    return rows.filter((r) => r.key.startsWith(prefix)).map((r) => ({ key: r.key.slice(prefix.length), data: r.data }))
  }

  /** Записывает строки целиком (upsert по key) */
  async saveState(rows: StateRow[]): Promise<void> {
    const at = new Date().toISOString()
    await this.request('/rest/v1/server_state', {
      method: 'POST',
      headers: { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.map((r) => ({ key: `${this.space}/${r.key}`, data: r.data, updated_at: at })))
    })
  }

  async putFile(name: string, bytes: Uint8Array<ArrayBuffer>, type: string): Promise<void> {
    await this.request(`/storage/v1/object/${BUCKET}/${this.object(name)}`, { method: 'POST', headers: { 'content-type': type, 'x-upsert': 'true' }, body: bytes })
  }

  /** Скачивает файл потоком в dest; false — такого файла нет */
  async download(name: string, dest: string): Promise<boolean> {
    // Storage отвечает на отсутствующий файл то 404, то 400 с «not_found» — оба значат «нет»
    const res = await this.request(`/storage/v1/object/authenticated/${BUCKET}/${this.object(name)}`, {}, [400, 404])
    if (!res.ok || !res.body) {
      await res.body?.cancel()
      return false
    }
    const tmp = `${dest}.part`
    try {
      await pipeline(Readable.fromWeb(res.body as import('node:stream/web').ReadableStream), createWriteStream(tmp))
      await rename(tmp, dest)
      return true
    } catch (e) {
      await rm(tmp, { force: true })
      throw e
    }
  }

  async removeFiles(names: string[]): Promise<void> {
    for (let i = 0; i < names.length; i += 100) {
      await this.request(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prefixes: names.slice(i, i + 100).map((n) => `${this.space}/${n}`) }) })
    }
  }

  async listFiles(): Promise<RemoteFile[]> {
    const out: RemoteFile[] = []
    for (let offset = 0; ; offset += 1000) {
      const res = await this.request(`/storage/v1/object/list/${BUCKET}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // файлы своего пространства; имена приходят без папки
        body: JSON.stringify({ prefix: this.space, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
      })
      const page = (await res.json()) as { name: string; id: string | null; updated_at?: string | null; created_at?: string | null }[]
      // id = null — вложенная папка, у нас их нет
      out.push(...page.filter((f) => f.id !== null).map((f) => ({ name: f.name, updatedAt: f.updated_at ?? f.created_at ?? null })))
      if (page.length < 1000) return out
    }
  }
}
