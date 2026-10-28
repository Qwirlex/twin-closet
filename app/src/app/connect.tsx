import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { QrCode } from '@/components/qr';
import { GlassButton, GoldRim, Label, T } from '@/components/ui';
import { deviceId } from '@/lib/device';
import { webOrigin } from '@/lib/platform';
import { useStore } from '@/lib/store';
import { setPaired } from '@/lib/sync';
import { useTheme } from '@/theme/theme';

// «Продолжить на телефоне»: компьютер показывает QR, телефон открывает тот же шкаф (сайт, ставить ничего не нужно).
// Что снято на телефоне, появляется здесь: скан — сразу с ходом шагов, вещи — в шкафу через несколько секунд.

export default function ConnectScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ to?: string; mode?: string }>();
  const { scans, isKnownScan, markScanSeen } = useStore();
  const to = params.to === 'scan' ? 'scan' : 'closet';
  const mode = params.mode === 'body' ? 'body' : 'rail';
  const link = `${webOrigin()}/pair?d=${encodeURIComponent(deviceId())}&to=${to}&mode=${mode}`;
  // сканы, которые уже были до открытия экрана, — не новые
  const [before] = useState(() => new Set(scans.map((s) => s.jobId)));

  // пока экран открыт и после — синхронизируемся часто: телефон вот-вот начнёт присылать
  useEffect(() => setPaired(true), []);

  // телефон начал скан — показываем его ход здесь
  useEffect(() => {
    const fromPhone = scans.filter((s) => !before.has(s.jobId) && !isKnownScan(s.jobId)).at(-1);
    if (!fromPhone) return;
    markScanSeen(fromPhone.jobId);
    router.replace({ pathname: '/scan', params: { job: fromPhone.jobId, mode: fromPhone.kind === 'body_scan' ? 'body' : 'rail' } });
  }, [scans, before, isKnownScan, markScanSeen]);

  const steps = [
    ['camera', 'Point your phone’s camera at the code and open the link.'],
    ['check', 'Tap Connect. Your closet opens on the phone — nothing to install.'],
    ['video', to === 'scan' ? (mode === 'body' ? 'Film a slow spin. The steps show up here as they run.' : 'Film your rail. The pieces show up here as they are found.') : 'Scan, add or try on there — it shows up here in a few seconds.'],
  ] as const;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <GlassButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <T size={26} tracking={-0.03} accessibilityRole="header">
          Continue on your phone
        </T>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 22, alignItems: 'stretch' }}>
        <T size={14} color={t.muted} lh={1.45}>
          {to === 'scan' ? 'A laptop camera can’t film your rail or a full-height spin. Your phone can — and the result lands right here.' : 'Use your phone’s camera with this closet. Everything stays in sync.'}
        </T>

        <View style={{ alignItems: 'center' }}>
          <GoldRim radius={28} style={{ padding: 16, backgroundColor: '#FFFFFF' }}>
            <QrCode value={link} size={228} label="QR code that opens this closet on your phone" />
          </GoldRim>
        </View>

        <View style={{ gap: 14 }}>
          {steps.map(([icon, text], i) => (
            <View key={icon} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={16} color={t.text} />
              </View>
              <View style={{ flex: 1, gap: 2, paddingTop: 1 }}>
                <Label>Step {i + 1}</Label>
                <T size={14} lh={1.45}>
                  {text}
                </T>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLiveRegion="polite">
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent }} />
          <T size={13} color={t.muted}>
            Waiting for your phone…
          </T>
        </View>
      </ScrollView>
    </View>
  );
}
