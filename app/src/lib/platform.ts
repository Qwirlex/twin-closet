import { Platform } from 'react-native';

/** Адрес веб-версии для судей: туда ведёт QR «Продолжить на телефоне» */
export const WEB_URL = 'https://twin-closet.vercel.app';

/**
 * Сайт открыт на компьютере: мышь и наведение (на телефоне и планшете — палец).
 * Тогда «снять видео» честнее заменить на «снять телефоном»: камера ноутбука для скана не годится
 */
export function isDesktopWeb(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return window.matchMedia?.('(hover: hover) and (pointer: fine)').matches ?? false;
}

/** Откуда открыт сайт (локально — localhost), в приложении — веб-версия */
export function webOrigin(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : WEB_URL;
}
