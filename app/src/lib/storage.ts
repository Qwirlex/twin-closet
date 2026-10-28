import { Platform } from 'react-native';

// Настройки и данные на вебе — localStorage (в приватном режиме браузера — в памяти до перезагрузки).
// На телефоне вместо этого файла Metro берёт storage.native.ts (SQLite)
const memory = new Map<string, string>();

function web(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readSetting(key: string): string | null {
  try {
    return web()?.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeSetting(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) web()?.removeItem(key);
    else web()?.setItem(key, value);
  } catch {
    // приватный режим браузера — останется в памяти
  }
}
