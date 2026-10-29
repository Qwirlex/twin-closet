// Образы (docs/spec-models.md, «G»): новые вещи + шкаф → Muse Spark собирает 3 образа в стиле человека с трендами сезона;
// образ без живой детали («белая футболка + джинсы + кеды») ставим последним
import type { StyleProfile, TrendDigest } from '@twin/shared'
import { JobError } from '../errors'
import type { MetaApi } from '../meta'
import { buildLooks, looksBrief, markPlain, runTask, text } from '../models/spark'

export interface LookPiece {
  id: string
  title: string
  kind: string
  color: string | null
  material: string | null
  isNew: boolean
}

export async function buildOutfits(meta: MetaApi, pieces: LookPiece[], style: StyleProfile | null, who: 'men' | 'women' | 'all', digest: TrendDigest) {
  const line = (p: LookPiece) => `- id ${p.id}: ${p.title}; ${p.kind}${p.color ? `; ${p.color}` : ''}${p.material ? `; ${p.material}` : ''}`
  const fresh = pieces.filter((p) => p.isNew)
  const owned = pieces.filter((p) => !p.isNew)
  if (!fresh.length) throw new JobError('bad_input', 'Add a new piece to style first.')
  const { data } = await runTask(meta, buildLooks, [text(looksBrief(style, digest, who)), text(`New pieces:\n${fresh.map(line).join('\n')}`), text(`Their closet:\n${owned.map(line).join('\n') || '(empty)'}`)]).catch((e: unknown) => {
    throw new JobError('model', `Muse Spark could not build outfits: ${e instanceof Error ? e.message : e}`)
  })
  const byId = Object.fromEntries(pieces.map((p) => [p.id, { kind: p.kind, title: p.title, color: p.color, material: p.material }]))
  // только id из списков: выдуманные вещи отбрасываем, пустые образы — тоже
  const looks = data.looks.map((l) => ({ ...l, item_ids: l.item_ids.filter((id) => id in byId) })).filter((l) => l.item_ids.length > 1)
  return markPlain(looks, byId, digest)
}
