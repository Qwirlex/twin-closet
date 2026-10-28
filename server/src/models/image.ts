// Muse Image: примерка. Подписанные входные картинки, поиск в интернете выключен (иначе модель подтянет чужие фото вещей).
// Первый ракурс — несколько вариантов сразу; остальные ракурсы — продолжение того же ответа (previous_response_id),
// чтобы вещь выглядела одинаково со всех сторон (docs/meta-api.md, «Muse Image»).
import type { Angle } from '@twin/shared'
import { MODELS } from '../meta'
import type { Part } from './spark'

export interface GarmentInput {
  /** «wide-leg jeans from a store», «my black hoodie» */
  label: string
  image: Part
  /** как вещь сядет на этом человеке по зонам (fitPrompt): «tight at the waist; light break at the shoe» */
  fit?: string
}

const ANGLE_WORDS: Record<Angle, string> = { front: 'from the front', three_quarter: 'from a three-quarter angle', side: 'from the side', back: 'from the back' }

/** Инструкция примерки: та же поза и кадр, меняется только одежда; лицо и руки потом всё равно вклеиваются из оригинала */
export function tryOnPrompt(garments: GarmentInput[], angle: Angle): string {
  const list = garments.map((g, i) => `garment ${i + 1} (${g.label})`).join(', ')
  // посадка из расчёта по замерам: без неё модель рисует любую вещь «как на манекене»
  const fits = garments.flatMap((g, i) => (g.fit ? [`garment ${i + 1} sits ${g.fit}`] : []))
  return `Dress the person in the first photo in ${list}, photographed ${ANGLE_WORDS[angle]}.
Keep exactly the same person, pose, body shape, framing, camera position, lighting and background as the first photo.
Change only the clothes: replace what they wear in the zones these garments cover, keep everything else.
Reproduce each garment faithfully: colour, fabric, print, length, fit and details like buttons, zips and stitching.
Shoes must sit naturally on both feet. Photorealistic, no text, no logos that are not on the garments.${fits.length ? `\nHow the garments sit on this person, from their measurements: ${fits.join('; ')}.` : ''}`
}

/** Первый ракурс: Responses API с инструментом image_generation, поиск по картинкам и вебу выключен */
export function tryOnRequest(person: Part, garments: GarmentInput[], angle: Angle): Record<string, unknown> {
  const content: unknown[] = [{ type: 'input_text', text: 'Photo of the person (keep this person, pose and background):' }, person]
  garments.forEach((g, i) => content.push({ type: 'input_text', text: `Garment ${i + 1}: ${g.label}` }, g.image))
  content.push({ type: 'input_text', text: tryOnPrompt(garments, angle) })
  return {
    model: MODELS.image,
    input: [{ role: 'user', content }],
    tools: [{ type: 'image_generation', enable_image_search: false, enable_web_search: false, enable_shell: false }]
  }
}

/** Следующий ракурс того же образа: продолжение ответа + фото человека в этом ракурсе */
export function nextAngleRequest(previousResponseId: string, person: Part, angle: Angle): Record<string, unknown> {
  return {
    model: MODELS.image,
    previous_response_id: previousResponseId,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: `Same outfit, same garments exactly. Now this photo of the same person ${ANGLE_WORDS[angle]}:` },
          person,
          { type: 'input_text', text: 'Keep this pose, framing and background; change only the clothes to the same outfit.' }
        ]
      }
    ],
    tools: [{ type: 'image_generation', enable_image_search: false, enable_web_search: false, enable_shell: false }]
  }
}
