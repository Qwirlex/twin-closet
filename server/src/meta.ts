// Клиент Meta Model API (https://api.meta.ai/v1): Muse Spark, Muse Image, SAM 3.1.
// Формы запросов SAM и ответов уточняем в первый день по документации и живым ответам.

const BASE = 'https://api.meta.ai/v1'

export const MODELS = {
  spark: 'muse-spark-1.3',
  image: 'muse-image-1.0',
  sam: 'sam-3.1'
} as const

export class MetaApi {
  constructor(
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  get configured(): boolean {
    return Boolean(this.key)
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.key) throw new Error('Нет MODEL_API_KEY в server/.env')
    const res = await this.fetchImpl(`${BASE}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${this.key}`, ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...init.headers },
      signal: init.signal ?? AbortSignal.timeout(180_000)
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`Meta ${path} ${res.status}: ${text.slice(0, 400)}`)
    return JSON.parse(text) as T
  }

  /** Responses API: текст + картинки на входе, текст (или JSON) на выходе */
  responses<T = unknown>(body: Record<string, unknown>): Promise<T> {
    return this.call<T>('/responses', { method: 'POST', body: JSON.stringify(body) })
  }

  /** Загрузка файла (видео для SAM) */
  async uploadFile(data: Blob, name: string, purpose = 'user_data'): Promise<{ id: string }> {
    const form = new FormData()
    form.append('file', data, name)
    form.append('purpose', purpose)
    return this.call('/files', { method: 'POST', body: form })
  }

  /** Muse Image: правка/сборка из нескольких входных картинок (data: URL или URL) */
  imageEdit(prompt: string, images: string[], opts: { n?: number; size?: string } = {}): Promise<{ data: { b64_json?: string; url?: string }[] }> {
    return this.call('/images/edits', {
      method: 'POST',
      body: JSON.stringify({ model: MODELS.image, prompt, images: images.map((image_url) => ({ image_url })), n: opts.n ?? 1, ...(opts.size ? { size: opts.size } : {}) })
    })
  }
}
