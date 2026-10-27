import { readSetting, writeSetting } from '@/lib/storage';

// Случайный id этого устройства: по нему сервер хранит вишлист отдельно от других посетителей.
// Это не вход и не секрет — просто чтобы два судьи не затирали друг другу списки.
const KEY = 'twin.device';

let cached: string | null = null;

export function deviceId(): string {
  if (cached) return cached;
  const saved = readSetting(KEY);
  if (saved && /^[a-z0-9-]{8,64}$/i.test(saved)) return (cached = saved);
  const rand = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  cached = `d-${Date.now().toString(36)}-${rand()}${rand()}`;
  writeSetting(KEY, cached);
  return cached;
}
