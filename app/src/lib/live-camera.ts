import { brightness, glare, motion, sharpness, type FrameQuality, type PosePoint, type ShotView } from '@twin/shared';
import { Platform } from 'react-native';

import { readSetting, writeSetting } from '@/lib/storage';

// Умный скан в браузере (сайт = приложение, и на телефоне тоже): камера, оценка кадра, поза, голос.
// Поза — MediaPipe Pose Landmarker (Google, Apache 2.0), грузится с CDN только на экране скана и работает
// на устройстве: кадры никуда не уходят. В сборке Expo Go — обычная камера телефона (scan.tsx)

/** Снимок умного скана: ракурс, сам JPEG и его локальный адрес для превью */
export interface CapturedShot {
  view: ShotView;
  blob: Blob;
  uri: string;
}

const MEDIAPIPE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const VOICE = 'twin.voice';

/** Умный скан доступен: браузер с камерой */
export function canLiveScan(): boolean {
  return Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/** Камера: user — фронтальная (скан себя, экран видно издалека), environment — основная (вещи, бирки) */
export async function openCamera(facing: 'user' | 'environment'): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } } });
  } catch (e) {
    const name = e instanceof DOMException ? e.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new Error('Camera access is off. Allow the camera for this site in the browser settings, or upload a photo instead.');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new Error('No camera found on this device. Upload a photo or use the sample instead.');
    throw new Error('The camera did not start. Close other apps that use it and try again.');
  }
}

export function stopCamera(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop());
}

interface Landmarker {
  detectForVideo(video: HTMLVideoElement, timestamp: number): { landmarks: PosePoint[][] };
}

let pose: Promise<Landmarker> | null = null;

/** Модель позы — одна на всё приложение; GPU, а если не вышло — процессор */
export function loadPose(): Promise<Landmarker> {
  if (!pose) {
    pose = (async () => {
      // import по адресу: сборщик не трогает, браузер грузит модуль сам
      const load = new Function('u', 'return import(u)') as (u: string) => Promise<Record<string, any>>;
      const vision = await load(`${MEDIAPIPE}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${MEDIAPIPE}/wasm`);
      const create = (delegate: 'GPU' | 'CPU') => vision.PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: POSE_MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1 }) as Promise<Landmarker>;
      try {
        return await create('GPU');
      } catch {
        return await create('CPU');
      }
    })();
    pose.catch(() => (pose = null));
  }
  return pose;
}

/** Точки позы на текущем кадре видео; null — человека нет или модель не готова */
export function detectPose(model: Landmarker, video: HTMLVideoElement, last: { t: number }): PosePoint[] | null {
  // MediaPipe требует растущее время кадра
  const t = Math.max(performance.now(), last.t + 1);
  last.t = t;
  try {
    return model.detectForVideo(video, t).landmarks[0] ?? null;
  } catch {
    return null;
  }
}

/** Оценка кадра на маленькой копии (240 px по ширине): свет, резкость, движение, блик */
export class FrameReader {
  private readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  private prev: Uint8Array | null = null;
  private gray: Uint8Array | null = null;
  private w = 0;
  private h = 0;

  read(video: HTMLVideoElement): FrameQuality | null {
    if (!video.videoWidth || !video.videoHeight) return null;
    const w = 240;
    const h = Math.round((w * video.videoHeight) / video.videoWidth);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.prev = null;
    }
    this.ctx.drawImage(video, 0, 0, w, h);
    const rgba = this.ctx.getImageData(0, 0, w, h).data;
    const gray = new Uint8Array(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
    const q = { light: brightness(gray), sharp: sharpness(gray, w, h), move: this.prev ? motion(this.prev, gray) : 99, glare: glare(gray, w, h) };
    this.prev = gray;
    this.gray = gray;
    this.w = w;
    this.h = h;
    return q;
  }

  /** Свет на самом человеке (рамка в долях кадра): тёмный фон не должен мешать, если человек освещён */
  lightIn(x0: number, y0: number, x1: number, y1: number): number | null {
    if (!this.gray) return null;
    const [a, b] = [Math.max(0, Math.floor(Math.min(x0, x1) * this.w)), Math.min(this.w, Math.ceil(Math.max(x0, x1) * this.w))];
    const [c, d] = [Math.max(0, Math.floor(Math.min(y0, y1) * this.h)), Math.min(this.h, Math.ceil(Math.max(y0, y1) * this.h))];
    let sum = 0;
    let n = 0;
    for (let y = c; y < d; y++) {
      for (let x = a; x < b; x++) {
        sum += this.gray[y * this.w + x];
        n++;
      }
    }
    return n ? sum / n : null;
  }
}

/** Снимок кадра в полном разрешении камеры, JPEG */
export function grab(video: HTMLVideoElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not take the photo'))), 'image/jpeg', 0.92));
}

// ── Голос и звук ───────────────────────────────────────────────────────────

export function voiceOn(): boolean {
  return readSetting(VOICE) !== 'off';
}

export function setVoice(on: boolean): void {
  writeSetting(VOICE, on ? null : 'off');
  if (!on && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** Сказать вслух (на iPhone голос включается только после нажатия — первое «speak» зовём из кнопки) */
export function speak(text: string): void {
  if (!voiceOn() || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = 1.02;
  speechSynthesis.speak(u);
}

let audio: AudioContext | null = null;

/** Короткий щелчок затвора — слышно с 2 м, что снимок сделан */
export function shutter(): void {
  try {
    audio ??= new AudioContext();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // звук — приятный бонус, без него скан работает
  }
}
