import Storage from 'expo-sqlite/kv-store';

// Настройки и данные на телефоне — в SQLite (синхронный kv-store), переживают перезапуск приложения.
// Тот же интерфейс, что у storage.ts на вебе; Metro сам берёт этот файл для iOS и Android
const memory = new Map<string, string>();

export function readSetting(key: string): string | null {
  try {
    return Storage.getItemSync(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeSetting(key: string, value: string | null): void {
  if (value === null) memory.delete(key);
  else memory.set(key, value);
  try {
    if (value === null) Storage.removeItemSync(key);
    else Storage.setItemSync(key, value);
  } catch {
    // база недоступна — останется в памяти до перезапуска
  }
}
