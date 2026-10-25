// Адрес сервера: EXPO_PUBLIC_API_URL в app/.env (на телефоне — IP компьютера в домашней сети или туннель)
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export async function health(): Promise<{ ok: boolean; meta: boolean }> {
  const res = await fetch(`${API_URL}/health`);
  if (!res.ok) throw new Error(`Сервер ответил ${res.status}`);
  return res.json();
}
