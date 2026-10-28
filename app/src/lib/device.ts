import { randomUUID } from 'expo-crypto';

import { readSetting, writeSetting } from '@/lib/storage';

// Случайный id этого устройства: по нему сервер хранит вишлист и шкаф отдельно от других посетителей.
// Через QR «Продолжить на телефоне» его получает и телефон — тогда id работает как ключ доступа,
// поэтому он криптостойкий (не Math.random) и нигде не показывается текстом.
const KEY = 'twin.device';

let cached: string | null = null;

export function deviceId(): string {
  if (cached) return cached;
  const saved = readSetting(KEY);
  if (saved && isDeviceId(saved)) return (cached = saved);
  cached = `d-${randomUUID().replace(/-/g, '')}`;
  writeSetting(KEY, cached);
  return cached;
}

export function isDeviceId(value: string): boolean {
  return /^[a-z0-9-]{8,64}$/i.test(value);
}

/** Телефон подключается к компьютеру: берёт id его устройства и с ним — его шкаф и вишлист */
export function adoptDeviceId(id: string): void {
  if (!isDeviceId(id)) throw new Error('Bad device id');
  cached = id;
  writeSetting(KEY, id);
}
