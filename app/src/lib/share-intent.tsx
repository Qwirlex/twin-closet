import Constants, { ExecutionEnvironment } from 'expo-constants';
import type { ImagePickerAsset } from 'expo-image-picker';
import { router } from 'expo-router';
import { useShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { linkPiece, useStore } from '@/lib/store';

// «Поделиться → Twin Closet» из Instagram или приложения магазина: картинка или ссылка сразу попадает в примерку.
// Нужна своя сборка (dev client / APK): в Expo Go и на вебе нативного модуля нет — отключаем, как советует пакет.
const unsupported = Platform.OS === 'web' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ disabled: unsupported });
  const { importAsset, addToTryOn } = useStore();

  useEffect(() => {
    if (!hasShareIntent) return;
    const image = shareIntent.files?.find((f) => f.mimeType.startsWith('image/'));
    if (image) {
      const asset: ImagePickerAsset = { uri: image.path.startsWith('file://') ? image.path : `file://${image.path}`, width: image.width ?? 0, height: image.height ?? 0, type: 'image', mimeType: image.mimeType, fileName: image.fileName };
      importAsset(asset, 'Screenshot');
    } else {
      const url = shareIntent.webUrl ?? shareIntent.text?.match(/https?:\/\/\S+/)?.[0] ?? null;
      const host = url?.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)?.[1];
      if (url && host) addToTryOn(linkPiece(url, host));
    }
    resetShareIntent();
    router.push('/try');
  }, [hasShareIntent, shareIntent, resetShareIntent, importAsset, addToTryOn]);

  return null;
}
