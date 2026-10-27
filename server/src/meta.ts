// Клиент Meta Model API (https://api.meta.ai/v1): Muse Spark, Muse Image, SAM 3.1 (docs/meta-api.md).
// Обычный fetch: API совместим с OpenAI, но SDK не нужен — запросов немного, формы описаны в models/*.

const BASE = 'https://api.meta.ai/v1'

export const MODELS = {
  spark: 'muse-spark-1.3',
  image: 'muse-image-1.0',
  sam: 'sam-3.1'
} as const

/** Ответ Responses API — только поля, которые читаем */
export interface ResponsesOutput {
  id: string
  status?: string
  output: ({ type: 'message'; content: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[] } | { type: 'web_search_call'; results?: { type: string; title: string; url: string; snippet: string }[] } | { type: 'image_generation_call'; result?: string } | { type: string; [k: string]: unknown })[]
  output_text?: string
}

export class MetaError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

export class MetaApi {
  constructor(
    private readonly key: string,
    private readonly fetchImpl: typeof fetch = fetch,
    /** паузы между повторами: в тестах — нули */
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
  ) {}

  get configured(): boolean {
    return Boolean(this.key)
  }

  /** 429 и 503 — повтор с растущей паузой и разбросом, по Retry-After, если он есть (docs/meta-api.md, «Цены и лимиты») */
  private async call<T>(path: string, init: RequestInit, attempts = 4): Promise<T> {
    if (!this.key) throw new MetaError(0, 'Нет MODEL_API_KEY в server/.env')
    for (let attempt = 1; ; attempt++) {
      const res = await this.fetchImpl(`${BASE}${path}`, {
        ...init,
        headers: { authorization: `Bearer ${this.key}`, ...(init.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...init.headers },
        signal: AbortSignal.timeout(180_000)
      })
      const text = await res.text()
      if (res.ok) return JSON.parse(text) as T
      if ((res.status === 429 || res.status === 503) && attempt < attempts) {
        const retryAfter = Number(res.headers.get('retry-after'))
        await this.sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 500 + Math.random() * 400)
        continue
      }
      throw new MetaError(res.status, `Meta ${path} ${res.status}: ${text.slice(0, 400)}`)
    }
  }

  /** Responses API: текст + картинки на входе, текст, JSON или картинка на выходе */
  responses(body: Record<string, unknown>): Promise<ResponsesOutput> {
    return this.call<ResponsesOutput>('/responses', { method: 'POST', body: JSON.stringify(body) })
  }

  /** Загрузка файла (видео для SAM); файлы сами не истекают — просим удалить через сутки */
  async uploadFile(data: Blob, name: string, purpose = 'user_data'): Promise<{ id: string }> {
    const form = new FormData()
    form.append('file', data, name)
    form.append('purpose', purpose)
    form.append('expires_after[anchor]', 'created_at')
    form.append('expires_after[seconds]', '86400')
    return this.call('/files', { method: 'POST', body: form })
  }
}

/** Весь текст ответа модели */
export function outputText(r: ResponsesOutput): string {
  if (typeof r.output_text === 'string') return r.output_text
  return r.output
    .filter((o): o is Extract<ResponsesOutput['output'][number], { type: 'message' }> => o.type === 'message')
    .flatMap((o) => (o as { content: { type: string; text?: string }[] }).content)
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text ?? '')
    .join('')
}

/** Ссылки, на которые модель сослалась (url_citation) */
export function citations(r: ResponsesOutput): { url: string; title: string }[] {
  return r.output
    .filter((o) => o.type === 'message')
    .flatMap((o) => (o as { content: { annotations?: { type: string; url?: string; title?: string }[] }[] }).content)
    .flatMap((c) => c.annotations ?? [])
    .filter((a) => a.type === 'url_citation' && a.url)
    .map((a) => ({ url: a.url!, title: a.title ?? '' }))
}

/** Картинка из image_generation_call (base64) */
export function generatedImages(r: ResponsesOutput): Buffer[] {
  return r.output.filter((o) => o.type === 'image_generation_call' && typeof (o as { result?: unknown }).result === 'string').map((o) => Buffer.from((o as { result: string }).result, 'base64'))
}
