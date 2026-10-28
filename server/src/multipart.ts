// Загрузка файла потоком прямо на диск. c.req.parseBody() держит весь файл в памяти (и arrayBuffer — ещё копию):
// видео на 300 MB на сервере с 512 MB памяти его роняет. Здесь в памяти только текущий кусок потока.
import { open, rm } from 'node:fs/promises'

export class UploadTooLarge extends Error {}
export class BadForm extends Error {}

export interface SavedFile {
  /** null — тип файла не подошёл (openPath вернул null), на диск ничего не записано */
  path: string | null
  filename: string
  type: string
  size: number
}

const CRLF = Buffer.from('\r\n')
const CRLF2 = Buffer.from('\r\n\r\n')
const MAX_HEADERS = 16 * 1024

function boundaryOf(contentType: string): string {
  const m = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i)
  const b = m?.[1] ?? m?.[2]
  if (!/^multipart\/form-data/i.test(contentType.trim()) || !b) throw new BadForm('Not a multipart form')
  return b
}

function parseHeaders(block: string): { name: string | null; filename: string | null; type: string } {
  let name: string | null = null
  let filename: string | null = null
  let type = ''
  for (const line of block.split('\r\n')) {
    const i = line.indexOf(':')
    if (i < 0) continue
    const key = line.slice(0, i).trim().toLowerCase()
    const value = line.slice(i + 1).trim()
    if (key === 'content-type') type = value.toLowerCase()
    if (key === 'content-disposition') {
      name = value.match(/(?:^|;)\s*name="([^"]*)"/i)?.[1] ?? null
      filename = value.match(/(?:^|;)\s*filename="([^"]*)"/i)?.[1] ?? null
    }
  }
  return { name, filename, type }
}

/**
 * Сохраняет первое поле field с файлом. openPath получает имя и тип файла и отвечает, куда писать (null — тип не подходит).
 * Больше max байт — UploadTooLarge, недописанный файл удаляется. Нет такого поля с файлом — null
 */
export async function saveFileField(
  body: ReadableStream<Uint8Array>,
  contentType: string,
  field: string,
  max: number,
  openPath: (file: { filename: string; type: string }) => string | null
): Promise<SavedFile | null> {
  const boundary = boundaryOf(contentType)
  const first = Buffer.from(`--${boundary}`)
  // внутри формы граница всегда идёт после перевода строки
  const delimiter = Buffer.from(`\r\n--${boundary}`)
  const reader = body.getReader()

  // состояние меняется внутри step(); приведение типов — чтобы TypeScript не сузил его до начальных значений
  let buf = Buffer.alloc(0)
  let state = 'start' as 'start' | 'after-boundary' | 'headers' | 'body' | 'done'
  let saved = null as SavedFile | null
  let inFile = false as boolean
  let fh = null as Awaited<ReturnType<typeof open>> | null

  const write = async (chunk: Buffer) => {
    if (!inFile || !saved || !chunk.length) return
    saved.size += chunk.length
    if (saved.size > max) throw new UploadTooLarge(`The file is larger than ${max} bytes`)
    await fh?.write(chunk)
  }

  // один шаг разбора того, что уже лежит в буфере; false — нужно читать поток дальше
  const step = async (): Promise<boolean> => {
    if (state === 'start') {
      const i = buf.indexOf(first)
      if (i < 0) {
        if (buf.length > first.length) buf = buf.subarray(buf.length - first.length)
        return false
      }
      buf = buf.subarray(i + first.length)
      state = 'after-boundary'
      return true
    }
    if (state === 'after-boundary') {
      if (buf.length < 2) return false
      if (buf[0] === 0x2d && buf[1] === 0x2d) {
        state = 'done'
        return true
      }
      const eol = buf.indexOf(CRLF)
      if (eol < 0) return false
      buf = buf.subarray(eol + CRLF.length)
      state = 'headers'
      return true
    }
    if (state === 'headers') {
      const end = buf.indexOf(CRLF2)
      if (end < 0) {
        if (buf.length > MAX_HEADERS) throw new BadForm('Form part headers are too long')
        return false
      }
      const h = parseHeaders(buf.subarray(0, end).toString('utf8'))
      buf = buf.subarray(end + CRLF2.length)
      inFile = !saved && h.name === field && h.filename !== null
      if (inFile) {
        const path = openPath({ filename: h.filename!, type: h.type })
        saved = { path, filename: h.filename!, type: h.type, size: 0 }
        if (path) fh = await open(path, 'w')
      }
      state = 'body'
      return true
    }
    if (state === 'body') {
      const i = buf.indexOf(delimiter)
      if (i < 0) {
        // хвост длиной с границу оставляем: она могла разрезаться между кусками потока
        if (buf.length > delimiter.length) {
          const keep = buf.length - delimiter.length
          await write(buf.subarray(0, keep))
          buf = buf.subarray(keep)
        }
        return false
      }
      await write(buf.subarray(0, i))
      buf = buf.subarray(i + delimiter.length)
      if (inFile) {
        // файл целиком на диске — остальная форма не нужна
        await fh?.close()
        fh = null
        inFile = false
        state = 'done'
        return true
      }
      state = 'after-boundary'
      return true
    }
    return false
  }

  try {
    while (state !== 'done') {
      if (await step()) continue
      const { value, done } = await reader.read()
      if (done) break
      buf = buf.length ? Buffer.concat([buf, value]) : Buffer.from(value)
    }
    if (inFile) throw new BadForm('The form ended in the middle of the file')
    if (saved && !saved.path) saved.size = 0
    return saved
  } catch (e) {
    await fh?.close().catch(() => {})
    if (saved?.path) await rm(saved.path, { force: true })
    throw e
  } finally {
    await reader.cancel().catch(() => {})
  }
}
