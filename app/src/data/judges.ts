// Панель судьи на сайте с компьютера (docs/spec-judges.md): что попробовать и какая модель Meta что делает.
// Тот же смысл, что в README — правится в обоих местах

export interface JudgeStep {
  title: string;
  sub: string;
  href: '/try' | '/result' | '/scan' | '/me';
}

export const JUDGE_STEPS: JudgeStep[] = [
  { title: 'Drop a screenshot from any store', sub: 'Try on: drag it onto the page or pick a file', href: '/try' },
  { title: 'See it on you, then tap Fit', sub: 'Four angles, and how it fits zone by zone', href: '/result' },
  { title: 'Scan with your phone', sub: 'A QR code: film on the phone, the steps run here', href: '/scan' },
  { title: 'Your style and measurements', sub: 'A quiz of 59 styles, fit without a size label', href: '/me' },
];

export interface ModelUse {
  model: 'SAM 3.1' | 'Muse Spark' | 'Muse Image' | 'Muse Voice Transcribe';
  jobs: string;
}

export const MODEL_USES: ModelUse[] = [
  { model: 'SAM 3.1', jobs: 'Tracks and cuts out pieces in the closet video; masks you, your face and hands.' },
  { model: 'Muse Spark', jobs: 'Finds and tags pieces, reads price tags, spots what you already own, builds outfits, finds pieces in stores and checks every try-on.' },
  { model: 'Muse Image', jobs: 'Dresses your own photo. Face, hair and hands are pasted back as your real pixels.' },
  { model: 'Muse Voice Transcribe', jobs: 'Voice in the chat with Twin, the stylist.' },
];

export const ON_DEVICE_NOTE = 'Pose, light and stillness in the body scan are checked on your device (MediaPipe), not by a Meta model.';

export const REPO_URL = 'https://github.com/Qwirlex/twin-closet';

/** Уже окна — панели нет: колонка приложения и так занимает почти весь экран */
export const PANEL_MIN_WIDTH = 1100;
export const PANEL_WIDTH = 360;
