import type { Job, JobKind, LookupQuery, SampleName, Upload, WatchItem } from '@twin/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Адрес сервера: EXPO_PUBLIC_API_URL в app/.env (на телефоне — IP компьютера в домашней сети или туннель)
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export class ApiError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError('Cannot reach the Twin Closet server. Check that it is running and the phone is on the same Wi-Fi.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? `Server error ${res.status}`);
  return body as T;
}

export function health(): Promise<{ ok: boolean; meta: boolean }> {
  return call('/health');
}

/** Полный адрес файла на сервере (/files/…) */
export function fileUrl(path: string): string {
  return path.startsWith('http') ? path : `${API_URL}${path}`;
}

/** Фото или видео из камеры или галереи → сервер */
export async function uploadAsset(asset: ImagePickerAsset): Promise<Upload> {
  const video = asset.type === 'video';
  const mime = asset.mimeType ?? (video ? 'video/mp4' : 'image/jpeg');
  const name = asset.fileName ?? `${video ? 'video' : 'photo'}.${mime.split('/')[1] ?? 'bin'}`;
  const form = new FormData();
  if (Platform.OS === 'web') {
    // в браузере у ассета есть сам File; если нет — достаём blob по адресу
    const file = asset.file ?? new File([await (await fetch(asset.uri)).blob()], name, { type: mime });
    form.append('file', file);
  } else {
    // React Native сам читает файл по uri
    form.append('file', { uri: asset.uri, name, type: mime } as unknown as Blob);
  }
  return call('/uploads', { method: 'POST', body: form });
}

export function startJob(kind: JobKind, input: { uploadId: string } | { sample: SampleName } | { lookup: LookupQuery }): Promise<Job> {
  return call('/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, ...input }) });
}

export function getJob(id: string): Promise<Job> {
  return call(`/jobs/${id}`);
}

/** Задача с опросом раз в секунду, пока не закончится */
export function useJob(id: string | null): { job: Job | null; error: string | null } {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJob(null);
    setError(null);
    if (!id) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const j = await getJob(id);
        if (stop) return;
        setJob(j);
        if (j.status === 'done' || j.status === 'failed') return;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : String(e));
      }
      timer = setTimeout(tick, 1000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  return { job, error };
}

/** Вишлист для слежки за ценой: сервер хранит только вещи живых магазинов */
export async function putWatch(items: Omit<WatchItem, 'lastPrice' | 'onSale' | 'checkedAt'>[]): Promise<WatchItem[]> {
  return (await call<{ items: WatchItem[] }>('/watch', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ items }) })).items;
}

export async function getWatch(): Promise<WatchItem[]> {
  return (await call<{ items: WatchItem[] }>('/watch')).items;
}
