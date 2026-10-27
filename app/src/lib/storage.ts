import { Platform } from 'react-native';

// Мелкие настройки (тема, пройден ли гайд). На вебе — localStorage, на телефоне пока в памяти до перезапуска
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
