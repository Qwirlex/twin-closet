import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Icon, LogoMark } from '@/components/icons';
import { Label, T } from '@/components/ui';
import { JUDGE_STEPS, MODEL_USES, ON_DEVICE_NOTE, PANEL_MIN_WIDTH, PANEL_WIDTH, REPO_URL } from '@/data/judges';
import { health } from '@/lib/api';
import { isDesktopWeb } from '@/lib/platform';
import { useTheme } from '@/theme/theme';

// Панель судьи (docs/spec-judges.md): только сайт на компьютере, рядом с колонкой приложения. На телефоне её нет

export function useJudgePanel(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && isDesktopWeb() && width >= PANEL_MIN_WIDTH;
}

type Status = 'checking' | 'live' | 'waiting' | 'down';

const STATUS_TEXT: Record<Status, string> = {
  checking: 'Checking the server…',
  live: 'Meta models are live',
  waiting: 'Waiting for the hackathon API key — steps that need a model say so on screen',
  down: 'Server is waking up…',
};

/** Ключ Meta на сервере: раз в минуту, а пока сервер не ответил — каждые 10 с */
function useModelStatus(): Status {
  const [status, setStatus] = useState<Status>('checking');
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      let next: Status;
      try {
        next = (await health()).meta ? 'live' : 'waiting';
      } catch {
        next = 'down';
      }
      if (!alive) return;
      setStatus(next);
      timer = setTimeout(check, next === 'down' ? 10_000 : 60_000);
    };
    void check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);
  return status;
}

export function JudgePanel() {
  const { t } = useTheme();
  const status = useModelStatus();
  const dot = status === 'live' ? t.accent : status === 'waiting' ? t.warn : t.muted;

  return (
    <ScrollView style={{ width: PANEL_WIDTH, flexGrow: 0 }} contentContainerStyle={{ gap: 22, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LogoMark size={30} ink={t.text} accent={t.accent} />
          <T size={18} w={600} tracking={-0.02} accessibilityRole="header">
            Twin Closet
            <T size={18} w={300} color={t.muted}>
              {' '}· for judges
            </T>
          </T>
        </View>
        <T size={14} color={t.muted} lh={1.45}>
          See any piece on your real body, styled with what you already own. The app runs right here, next to this guide.
        </T>
      </View>

      <View accessibilityRole="text" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 18, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, marginTop: 6 }} />
        <T size={13} lh={1.45} style={{ flex: 1 }}>
          {STATUS_TEXT[status]}
        </T>
      </View>

      <View style={{ gap: 10 }}>
        <Label accent>Try this</Label>
        {JUDGE_STEPS.map((s, i) => (
          <Pressable key={s.href} onPress={() => router.push(s.href)} accessibilityRole="button" accessibilityLabel={`${s.title}. ${s.sub}`} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
                <T size={12} w={600} color={t.accent}>
                  {i + 1}
                </T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={14} w={500}>
                  {s.title}
                </T>
                <T size={12} color={t.muted} lh={1.4}>
                  {s.sub}
                </T>
              </View>
              <Icon name="next" size={16} color={t.muted} />
            </View>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: 12 }}>
        <Label accent>Meta models in this demo</Label>
        {MODEL_USES.map((m) => (
          <View key={m.model} style={{ gap: 2 }}>
            <T size={14} w={500}>
              {m.model}
            </T>
            <T size={13} color={t.muted} lh={1.45}>
              {m.jobs}
            </T>
          </View>
        ))}
        <T size={12} color={t.muted} lh={1.45}>
          {ON_DEVICE_NOTE}
        </T>
      </View>

      <Pressable onPress={() => router.push('/connect')} accessibilityRole="button" accessibilityLabel="Continue on your phone: a QR code opens this closet on your phone, nothing to install" style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: t.line }}>
          <Icon name="phone" size={20} color={t.accent} />
          <View style={{ flex: 1 }}>
            <T size={14} w={500}>
              Continue on your phone
            </T>
            <T size={12} color={t.muted}>
              A QR code, nothing to install
            </T>
          </View>
          <Icon name="next" size={16} color={t.muted} />
        </View>
      </Pressable>

      <View style={{ flexDirection: 'row', gap: 18 }}>
        <PanelLink label="How it works" url={`${REPO_URL}#readme`} />
        <PanelLink label="Source code" url={REPO_URL} />
      </View>
    </ScrollView>
  );
}

function PanelLink({ label, url }: { label: string; url: string }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T size={13} w={500} style={{ textDecorationLine: 'underline' }}>
        {label}
      </T>
      <Icon name="open" size={14} color={t.muted} />
    </Pressable>
  );
}
