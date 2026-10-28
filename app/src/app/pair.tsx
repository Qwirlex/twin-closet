import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { Cta, T } from '@/components/ui';
import { CLOSET, SHOP } from '@/data/demo';
import { adoptDeviceId, deviceId, isDeviceId } from '@/lib/device';
import { useStore } from '@/lib/store';
import { resyncAll, setPaired } from '@/lib/sync';
import { useTheme } from '@/theme/theme';

// Телефон открыл QR с компьютера: после «Connect» у них один шкаф и вишлист (общий id устройства на сервере)

export default function PairScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ d?: string; to?: string; mode?: string }>();
  const { closet, tryOn, setOnboarded } = useStore();
  const id = typeof params.d === 'string' && isDeviceId(params.d) ? params.d : null;
  const ownAdded = closet.length - CLOSET.length + tryOn.filter((i) => !SHOP.some((s) => s.id === i.id)).length;

  const next = () => {
    if (params.to === 'scan') router.replace({ pathname: '/scan', params: { mode: params.mode === 'body' ? 'body' : 'rail' } });
    else router.replace('/');
  };

  const connect = () => {
    if (!id) return;
    if (id !== deviceId()) {
      adoptDeviceId(id);
      resyncAll();
    }
    setPaired(true);
    setOnboarded(true);
    next();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24, paddingHorizontal: 24, justifyContent: 'space-between' }}>
      <View style={{ gap: 18 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={id ? 'phone' : 'close'} size={24} color={t.text} />
        </View>
        <T size={32} tracking={-0.03} lh={1.05} accessibilityRole="header">
          {id ? 'Connect to your computer?' : 'This link is broken'}
        </T>
        <T size={15} color={t.muted} lh={1.5}>
          {id ? 'This phone opens the same closet and wishlist as your computer. Whatever you film here shows up there in a few seconds.' : 'Open the QR code on your computer again and scan it with the phone’s camera.'}
        </T>
        {id && ownAdded > 0 ? (
          <T size={13} color={t.muted} lh={1.45}>
            {ownAdded === 1 ? 'The piece you added on this phone is replaced' : `The ${ownAdded} pieces you added on this phone are replaced`} by the computer’s closet.
          </T>
        ) : null}
      </View>
      <View style={{ gap: 12 }}>
        {id ? <Cta title="Connect" sub={params.to === 'scan' ? 'Then film your scan' : 'Then use your phone camera'} onPress={connect} /> : null}
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <T size={14} color={t.text} style={{ textDecorationLine: 'underline' }}>
            {id ? 'Not now' : 'Open the app'}
          </T>
        </Pressable>
      </View>
    </View>
  );
}
