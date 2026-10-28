import type { DeviceState } from '@twin/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { API_URL, getState, putState } from '@/lib/api';
import { readSetting, writeSetting } from '@/lib/storage';

// Разделы, общие для компьютера и телефона (шкаф, вишлист): хранятся на устройстве и на сервере под id устройства.
// Правило одно: новее — значит главнее. Изменения уходят на сервер через секунду; чужие подтягиваются
// каждые 4 секунды, пока телефон подключён к компьютеру по QR, иначе — раз в минуту и при возврате в приложение.

export interface Doc<T> {
  /** миллисекунды последнего изменения; 0 — ещё ничего не меняли */
  updatedAt: number;
  data: T;
}

const PAIRED = 'twin.paired';
const PUSH_DELAY = 800;
const PULL_PAIRED = 4_000;
const PULL_ALONE = 60_000;

/** Это устройство подключено к другому по QR — тогда синхронизируемся часто */
export function isPaired(): boolean {
  return readSetting(PAIRED) === '1';
}

export function setPaired(value: boolean): void {
  writeSetting(PAIRED, value ? '1' : null);
}

const resyncListeners = new Set<() => void>();

/** Телефон взял id компьютера: свои разделы забываем и берём с сервера */
export function resyncAll(): void {
  for (const listener of resyncListeners) listener();
}

/**
 * Раздел, общий для устройств с одним id. read проверяет данные с сервера и из памяти (null — мусор),
 * merge решает, что оставить из своего, когда приходит новее (например, вещь, которая ещё грузится)
 */
export function useSyncedDoc<T>(slice: string, fallback: () => T, read: (raw: unknown) => T | null, merge: (remote: T, local: T) => T = (remote) => remote): [Doc<T>, (change: (data: T) => T) => void] {
  const key = `twin.doc.${slice}`;
  const [doc, setDoc] = useState<Doc<T>>(() => {
    try {
      const saved = JSON.parse(readSetting(key) ?? 'null') as Doc<unknown> | null;
      const data = saved && typeof saved.updatedAt === 'number' ? read(saved.data) : null;
      if (saved && data) return { updatedAt: saved.updatedAt, data };
    } catch {
      // испорченная запись — начинаем с чистого
    }
    return { updatedAt: 0, data: fallback() };
  });
  const latest = useRef(doc);
  /** самое новое, что точно лежит на сервере */
  const synced = useRef(0);
  const lastPull = useRef(0);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (remote: DeviceState) => {
    synced.current = Math.max(synced.current, remote.updatedAt);
    if (remote.updatedAt <= latest.current.updatedAt) return;
    const data = read(remote.data);
    if (!data) return;
    setDoc((local) => (remote.updatedAt > local.updatedAt ? { updatedAt: remote.updatedAt, data: merge(data, local.data) } : local));
  };

  const push = async () => {
    const current = latest.current;
    if (!API_URL || current.updatedAt <= synced.current) return;
    try {
      apply(await putState(slice, { updatedAt: current.updatedAt, data: current.data as Record<string, unknown> }));
      synced.current = Math.max(synced.current, current.updatedAt);
    } catch {
      // нет связи — уйдёт со следующим изменением или опросом
    }
  };

  const pull = async () => {
    if (!API_URL) return;
    lastPull.current = Date.now();
    try {
      apply(await getState(slice));
      if (latest.current.updatedAt > synced.current) void push();
    } catch {
      // нет связи — попробуем в следующий раз
    }
  };

  // своё — в память устройства и на сервер
  useEffect(() => {
    latest.current = doc;
    writeSetting(key, JSON.stringify(doc));
    if (doc.updatedAt > synced.current) {
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => void push(), PUSH_DELAY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  // чужое — с сервера
  useEffect(() => {
    const first = setTimeout(() => void pull(), 0);
    const tick = setInterval(() => {
      if (isPaired() || Date.now() - lastPull.current >= PULL_ALONE) void pull();
    }, PULL_PAIRED);
    const onActive = AppState.addEventListener('change', (s) => s === 'active' && void pull());
    const onVisible = () => document.visibilityState === 'visible' && void pull();
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisible);
    const resync = () => {
      synced.current = 0;
      setDoc((d) => ({ ...d, updatedAt: 0 }));
      latest.current = { ...latest.current, updatedAt: 0 };
      void pull();
    };
    resyncListeners.add(resync);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
      onActive.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisible);
      resyncListeners.delete(resync);
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slice]);

  // ничего не поменялось по сути (тот же статус задачи ещё раз) — не считаем изменением и не шлём на сервер
  const update = useCallback(
    (change: (data: T) => T) =>
      setDoc((d) => {
        const data = change(d.data);
        return data === d.data || JSON.stringify(data) === JSON.stringify(d.data) ? d : { updatedAt: Math.max(Date.now(), d.updatedAt + 1), data };
      }),
    []
  );

  return [doc, update];
}
