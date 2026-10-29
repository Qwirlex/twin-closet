// Сценарий демо-видео — единственный источник: сцены по порядку, текст голоса, записи и подписи моделей.
// Правила и чеклист записей — docs/demo-video.md, черновик — docs/spec-demo-draft.md.
// Без импортов: этот файл читают и Remotion, и node-скрипты (scripts/*.mjs).

export type Frame = 'phone' | 'laptop'

export interface Chip {
  /** модель Meta — только когда она работает в кадре; note — подпись без модели */
  kind: 'model' | 'note'
  name: string
  job: string
}

export interface Footage {
  file: string
  frame: Frame
  /** что снять — для карточки «нужна запись» */
  shot: string
  /** подпись под рамкой: откуда данные на записи */
  note?: string
}

export interface Scene {
  id: string
  kind: 'hook' | 'logo' | 'app' | 'how' | 'end'
  title?: string
  sub?: string
  footage?: Footage
  chips?: Chip[]
  voice: string
}

export const VOICE = 'en-US-AvaNeural'
export const VOICE_RATE = '-4%'
/** пауза после абзаца голоса, с */
export const PAUSE = 0.5
/** лимит правил — 3:00; оставляем запас */
export const MAX_SECONDS = 175

export const LINKS = { web: 'twin-closet.vercel.app', code: 'github.com/Qwirlex/twin-closet' }

export const SCENES: Scene[] = [
  {
    id: 'hook',
    kind: 'hook',
    voice: 'You see a piece you love. You buy it. It arrives, and it looks different on you. And somewhere in your closet, there was already something just like it.'
  },
  { id: 'logo', kind: 'logo', voice: 'This is Twin Closet. Your closet, on you.' },
  {
    id: 'body',
    kind: 'app',
    title: 'Scan yourself once',
    sub: 'A slow turn · 4 angles',
    footage: { file: '01-body-scan.mp4', frame: 'phone', shot: 'Phone on a shelf, the coach card and voice, a slow turn, the 4 angles appear' },
    chips: [
      { kind: 'note', name: 'On the phone', job: 'pose, light and sharpness checked live' },
      { kind: 'model', name: 'SAM 3.1', job: 'maps your face, hands and clothes' }
    ],
    voice: 'First, you scan yourself once. Prop the phone up and turn around slowly. The app coaches you by voice and takes each angle by itself when you stand right. SAM 3.1 maps your face, your hands and your clothes.'
  },
  {
    id: 'closet',
    kind: 'app',
    title: 'Film your closet',
    sub: 'One slow pass along the rail',
    footage: { file: '02-closet-scan.mp4', frame: 'phone', shot: 'A slow pass along the rail, then the grid of cut-outs with tags (with the SAM masks overlay from 02b)' },
    chips: [
      { kind: 'model', name: 'Muse Spark', job: 'finds every piece' },
      { kind: 'model', name: 'SAM 3.1', job: 'tracks it through the video and cuts it out' },
      { kind: 'model', name: 'Muse Spark', job: 'names it: kind, colour, fabric' }
    ],
    voice: 'Then you film your closet, one slow pass along the rail. Only the sharpest frames go to the models. Muse Spark finds every piece, SAM 3.1 tracks it through the video and cuts out its best frame, and Muse Spark tags it: what it is, the colour, the fabric.'
  },
  {
    id: 'owned',
    kind: 'app',
    title: 'You already own this',
    sub: 'Before you buy',
    footage: { file: '03-share-instagram.mp4', frame: 'phone', shot: 'Instagram → Share → Twin Closet → "Already in your closet" with the similar pieces' },
    chips: [{ kind: 'model', name: 'Muse Spark', job: 'compares it with your closet' }],
    voice: 'Now you see jeans on Instagram. Share the screenshot to Twin Closet. Before anything else, it tells you: you already own something like these.'
  },
  {
    id: 'fit',
    kind: 'app',
    title: 'Will it fit?',
    sub: 'Zone by zone, against the pair that fits you best',
    footage: { file: '08-fit.mp4', frame: 'phone', shot: 'A piece → fit by zones → "Fits me perfectly" → measure it flat with a tape', note: 'Demo account · the fit maths runs in the app' },
    chips: [
      { kind: 'note', name: 'Your favourite pair', job: 'measured flat with a tape, once' },
      { kind: 'note', name: 'Fit by zones', job: 'waist, hips, thigh, length' }
    ],
    voice: 'Still want them? First, will they fit? Size alone does not tell you. Mark the pair that fits you perfectly, measure it flat with a tape once, and every new piece is compared with it, zone by zone: waist, hips, thigh and length.'
  },
  {
    id: 'tryon',
    kind: 'app',
    title: 'See it on you',
    sub: '4 angles · your face and hands stay yours',
    footage: { file: '04-try-on.mp4', frame: 'phone', shot: '"See it on me" → the render, before/after slider, front → 3/4 → side → back (and the 04b mask still)' },
    chips: [
      { kind: 'model', name: 'Muse Image', job: 'dresses your real photo' },
      { kind: 'model', name: 'SAM 3.1', job: 'keeps your face and hands real' },
      { kind: 'model', name: 'Muse Spark', job: 'checks the result' }
    ],
    voice: 'Then see them on you. Muse Image dresses your real photo in the new jeans and the clothes you already own. Turn around: front, three quarters, side, back. Your face and hands are never generated. SAM 3.1 keeps them as your real pixels.'
  },
  {
    id: 'store',
    kind: 'app',
    title: 'In the store',
    sub: 'Zara, Bershka, Pull&Bear and more',
    footage: { file: '05-in-store.mp4', frame: 'phone', shot: 'Scan the price tag, then the piece → card with brand, price, size and the store link' },
    chips: [
      { kind: 'model', name: 'Muse Spark', job: 'reads the tag, finds it online' },
      { kind: 'model', name: 'SAM 3.1', job: 'cuts out the piece' }
    ],
    voice: 'In a store? Scan the price tag, then the piece. Muse Spark reads the brand, the price and the size, and finds the same piece online. SAM 3.1 cuts it out, ready to mix with your own wardrobe.'
  },
  {
    id: 'twin',
    kind: 'app',
    title: 'Twin, your stylist',
    sub: 'In your style, with this week’s trends',
    footage: { file: '06-twin.mp4', frame: 'phone', shot: 'Ask Twin "Dinner on Friday, smart but relaxed" → the outfit from the closet → Try it on' },
    chips: [{ kind: 'model', name: 'Muse Spark', job: 'builds the outfit from your closet' }],
    voice: 'Not sure what to wear? Ask Twin. Dinner on Friday, smart but relaxed. Muse Spark builds the outfit from your own closet, in your style and with this week’s trends, and you can try it on right away.'
  },
  { id: 'how', kind: 'how', title: 'How it works', voice: 'Under the hood, each Meta model does one clear job. SAM 3.1 sees and cuts out. Muse Spark understands and decides. Muse Image dresses you.' },
  {
    id: 'end',
    kind: 'end',
    footage: { file: '07-web-judges.mp4', frame: 'laptop', shot: 'The web version on a laptop: judge panel → Explore the demo account → Try on', note: 'The web version with the demo account' },
    voice: 'Twin Closet. Buy less. Wear more of what you own. Try it in your browser, no camera needed.'
  }
]

/** Модели в схеме «How it works» — одна строка роли у каждой */
export const MODELS = [
  { name: 'SAM 3.1', job: 'sees and cuts out: pieces, your body, face and hands' },
  { name: 'Muse Spark', job: 'understands and decides: tags, fit, stores, outfits, Twin' },
  { name: 'Muse Image', job: 'dresses your real photo' }
]
