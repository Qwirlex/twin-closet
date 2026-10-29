// Умный скан (PLAN.md §1.2 Ж, З): проверки кадра прямо на телефоне, без моделей Meta.
// Свет, резкость и неподвижность — по пикселям; поза и ракурс — по 33 точкам MediaPipe Pose (в браузере, кадры никуда не уходят).
// Команда одна за раз и короткая: человек стоит в 2 м и слышит её голосом

/** Точка позы: x, y — доли кадра (0–1), visibility — уверенность модели */
export interface PosePoint {
  x: number
  y: number
  z?: number
  visibility?: number
}

export type BodyView = 'front' | 'three_quarter' | 'side' | 'back'
export const BODY_VIEWS: BodyView[] = ['front', 'three_quarter', 'side', 'back']

// ── Пиксели (серое изображение, по байту на точку) ─────────────────────────────

/** Средняя яркость 0–255 */
export function brightness(gray: ArrayLike<number>): number {
  let sum = 0
  for (let i = 0; i < gray.length; i++) sum += gray[i]
  return gray.length ? sum / gray.length : 0
}

/** Резкость: дисперсия лапласиана (чем больше, тем чётче края) */
export function sharpness(gray: ArrayLike<number>, w: number, h: number): number {
  let sum = 0
  let sq = 0
  let n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const lap = gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i]
      sum += lap
      sq += lap * lap
      n++
    }
  }
  if (!n) return 0
  const mean = sum / n
  return sq / n - mean * mean
}

/** Движение между двумя кадрами: средняя разница яркости */
export function motion(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i])
  return n ? sum / n : 0
}

/** Блик: доля пересвеченных точек в середине кадра (бирка, глянцевая ткань) */
export function glare(gray: ArrayLike<number>, w: number, h: number): number {
  let hot = 0
  let n = 0
  for (let y = Math.floor(h * 0.25); y < Math.ceil(h * 0.75); y++) {
    for (let x = Math.floor(w * 0.25); x < Math.ceil(w * 0.75); x++) {
      // белая бирка — это ещё не блик: считаем только почти чистый белый пересвет
      if (gray[y * w + x] >= 254) hot++
      n++
    }
  }
  return n ? hot / n : 0
}

/** Пороги для кадра 240 px по ширине (так считает телефон) */
export const FRAME = {
  dark: 55,
  bright: 240,
  /** движение между соседними кадрами, при котором снимок ещё не смазан */
  still: 7,
  sharpItem: 60,
  sharpTag: 110,
  glare: 0.04
}

// ── Поза ────────────────────────────────────────────────────────────────

const P = { nose: 0, lEye: 2, rEye: 5, lEar: 7, rEar: 8, lShoulder: 11, rShoulder: 12, lWrist: 15, rWrist: 16, lHip: 23, rHip: 24, lAnkle: 27, rAnkle: 28, lHeel: 29, rHeel: 30, lToe: 31, rToe: 32 }

export interface PoseCheck {
  /** плечи и бёдра в кадре — человек есть */
  person: boolean
  head: boolean
  feet: boolean
  /** доля высоты кадра, которую занимает человек */
  fill: number
  /** где человек в кадре камеры (сырой кадр, без зеркала) */
  offset: 'left' | 'center' | 'right'
  /** руки чуть в стороны, не прижаты и не подняты */
  arms: boolean
  view: BodyView | 'turning' | null
}

const seen = (p: PosePoint | undefined, min = 0.5) => !!p && (p.visibility ?? 1) >= min

/** Проверка позы по точкам MediaPipe; пустой список — человека нет */
export function checkPose(lm: PosePoint[] | null | undefined): PoseCheck {
  const none: PoseCheck = { person: false, head: false, feet: false, fill: 0, offset: 'center', arms: false, view: null }
  if (!lm || lm.length < 33) return none
  const ls = lm[P.lShoulder]
  const rs = lm[P.rShoulder]
  const lh = lm[P.lHip]
  const rh = lm[P.rHip]
  if (![ls, rs, lh, rh].every((p) => seen(p, 0.3))) return none

  const shoulderY = (ls.y + rs.y) / 2
  const hipY = (lh.y + rh.y) / 2
  const torso = Math.max(0.01, hipY - shoulderY)
  // макушка: выше глаз и ушей примерно на треть расстояния от плеч до носа (со спины лица нет — считаем от плеч)
  const face = [lm[P.nose], lm[P.lEye], lm[P.rEye], lm[P.lEar], lm[P.rEar]]
  const faceTop = Math.min(...face.map((p) => p.y))
  const headTop = Math.min(faceTop - (shoulderY - faceTop) * 0.6, shoulderY - torso * 0.75)
  const feet = [lm[P.lHeel], lm[P.rHeel], lm[P.lToe], lm[P.rToe], lm[P.lAnkle], lm[P.rAnkle]]
  const feetY = Math.max(...feet.map((p) => p.y))
  const feetSeen = seen(lm[P.lAnkle], 0.35) && seen(lm[P.rAnkle], 0.35) && feetY <= 0.985

  const midX = (lh.x + rh.x + ls.x + rs.x) / 4
  const offset = midX < 0.38 ? 'left' : midX > 0.62 ? 'right' : 'center'

  // ракурс: ширина плеч к длине корпуса; лицом или спиной — по лицу и порядку плеч
  const width = Math.abs(ls.x - rs.x)
  const ratio = width / torso
  const facing = seen(lm[P.nose], 0.5) && (seen(lm[P.lEye], 0.5) || seen(lm[P.rEye], 0.5))
  // со спины модель часто «видит» лицо на затылке — главное тут порядок плеч: левое плечо слева в кадре = спиной
  let view: PoseCheck['view']
  if (ratio < 0.28) view = 'side'
  else if (ratio < 0.58) view = facing && ls.x > rs.x ? 'three_quarter' : 'turning'
  else view = ls.x > rs.x && facing ? 'front' : 'back'

  // руки: кисти ниже плеч и отведены от бёдер хотя бы на четверть ширины плеч
  const away = (wrist: PosePoint, hip: PosePoint) => Math.abs(wrist.x - hip.x) > Math.max(0.025, width * 0.22)
  const below = (wrist: PosePoint) => wrist.y > shoulderY + torso * 0.25
  const lw = lm[P.lWrist]
  const rw = lm[P.rWrist]
  const arms = view === 'side' || view === 'turning' ? true : away(lw, lh) && away(rw, rh) && below(lw) && below(rw)

  return { person: true, head: headTop >= 0.015, feet: feetSeen, fill: Math.max(0, feetY - headTop), offset, arms, view }
}

/** Сдвиг позы между кадрами: среднее смещение плеч и бёдер (доли кадра) */
export function poseShift(a: PosePoint[] | null | undefined, b: PosePoint[] | null | undefined): number {
  if (!a || !b || a.length < 33 || b.length < 33) return 1
  const ids = [P.lShoulder, P.rShoulder, P.lHip, P.rHip]
  return ids.reduce((s, i) => s + Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y), 0) / ids.length
}

export type BodyCue = 'loading' | 'enter' | 'light' | 'back' | 'closer' | 'left' | 'right' | 'arms' | 'turn' | 'still' | 'ok'

/** Одна команда за раз, самая важная первой. Ракурс — тот, который снимаем сейчас */
export function bodyCue(pose: PoseCheck, light: number, target: BodyView): BodyCue {
  if (light < FRAME.dark) return 'light'
  if (!pose.person) return 'enter'
  if (!pose.head || !pose.feet) return 'back'
  if (pose.fill < 0.6) return 'closer'
  // человек слева в кадре — с его стороны это справа: идти влево
  if (pose.offset !== 'center') return pose.offset === 'left' ? 'left' : 'right'
  if (pose.view !== target) return 'turn'
  if (!pose.arms) return 'arms'
  return 'ok'
}

/** Текст команды: крупно на экране и голосом */
export function bodyCueText(cue: BodyCue, target: BodyView): { title: string; sub: string } {
  switch (cue) {
    case 'loading':
      return { title: 'Getting ready', sub: 'Loading the pose guide, a few seconds' }
    case 'light':
      return { title: 'More light, please', sub: 'Face a window or turn on a lamp' }
    case 'enter':
      return { title: 'Step into the frame', sub: 'Stand about 2 metres from the camera' }
    case 'back':
      return { title: 'Step back a little', sub: 'Head and feet need to be in the frame' }
    case 'closer':
      return { title: 'Come a little closer', sub: 'Fill the frame from head to feet' }
    case 'left':
      return { title: 'Move a little to your left', sub: 'Stand in the middle of the frame' }
    case 'right':
      return { title: 'Move a little to your right', sub: 'Stand in the middle of the frame' }
    case 'arms':
      return { title: 'Arms out a little', sub: 'Hands away from your hips, feet hip-width apart' }
    case 'turn':
      return target === 'front'
        ? { title: 'Face the camera', sub: 'Look straight ahead' }
        : target === 'three_quarter'
          ? { title: 'Turn a little to your right', sub: 'About an eighth of a turn, then stop' }
          : target === 'side'
            ? { title: 'Keep turning, side on', sub: 'Your shoulder points at the camera' }
            : { title: 'Turn your back to the camera', sub: 'Keep standing in the same spot' }
    case 'still':
      return { title: 'Hold still', sub: 'Taking the photo' }
    case 'ok':
      return { title: 'Perfect, hold still', sub: 'Taking the photo' }
  }
}

// ── Вещь по одной и бирка ────────────────────────────────────────────────────

export type ItemStep = 'front' | 'back' | 'label' | 'tag'
export type ItemCue = 'light' | 'bright' | 'glare' | 'blur' | 'still' | 'ok'

export interface FrameQuality {
  light: number
  sharp: number
  move: number
  glare: number
}

/** Вещь: свет, без бликов, резко, не двигается. Бирке и ярлыку нужна резкость выше — там текст */
export function itemCue(q: FrameQuality, step: ItemStep): ItemCue {
  if (q.light < FRAME.dark) return 'light'
  if (q.light > FRAME.bright) return 'bright'
  if ((step === 'tag' || step === 'label') && q.glare > FRAME.glare) return 'glare'
  if (q.move > FRAME.still) return 'still'
  if (q.sharp < (step === 'tag' || step === 'label' ? FRAME.sharpTag : FRAME.sharpItem)) return 'blur'
  return 'ok'
}

export function itemCueText(cue: ItemCue, step: ItemStep): { title: string; sub: string } {
  const what = step === 'tag' ? 'the tag' : step === 'label' ? 'the label' : step === 'back' ? 'the back' : 'the front'
  switch (cue) {
    case 'light':
      return { title: 'More light, please', sub: 'Move closer to a window or lamp' }
    case 'bright':
      return { title: 'Too bright', sub: 'Step out of direct sunlight' }
    case 'glare':
      return { title: 'Glare, tilt it', sub: 'Turn it a little so the light doesn’t shine on it' }
    case 'still':
      return { title: 'Hold still', sub: `Keep ${what} steady for a second` }
    case 'blur':
      return { title: step === 'tag' || step === 'label' ? 'Move closer' : 'A bit closer', sub: `Fill the corners with ${what}, it has to be sharp` }
    case 'ok':
      return { title: 'Hold still', sub: 'Taking the photo' }
  }
}
