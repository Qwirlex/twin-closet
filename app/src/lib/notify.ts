import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Локальное уведомление о скидке: показываем, когда приложение узнало о новых снижениях.
// Пуш на закрытое приложение — позже, через dev-сборку (в Expo Go на Android пушей нет). На вебе — только баннер в приложении.

let handlerSet = false;

/** Спросить разрешение на уведомления (когда человек сам ставит цель цены) */
export async function askNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function notifyDrops(names: string[]): Promise<void> {
  if (Platform.OS === 'web' || !names.length) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  if (!handlerSet) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
    });
    handlerSet = true;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: names.length === 1 ? 'Price drop on your wishlist' : `${names.length} price drops on your wishlist`,
      body: names.length === 1 ? `${names[0]} is cheaper now.` : `${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''} got cheaper.`,
    },
    trigger: null,
  });
}
