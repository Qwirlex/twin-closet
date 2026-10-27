import type { Job } from '@twin/shared';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, View } from 'react-native';

import { Icon } from '@/components/icons';
import { GoldRim, Label, T } from '@/components/ui';
import { useTheme } from '@/theme/theme';

/** Шаги задачи с галочками и подписью модели Meta — судья видит, какая модель что делает */
export function JobSteps({ job }: { job: Job }) {
  const { t } = useTheme();
  return (
    <View style={{ gap: 10 }} accessibilityLabel="Progress">
      {job.steps.map((s) => {
        const color = s.status === 'pending' ? t.muted : t.text;
        return (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: s.status === 'pending' ? 0.6 : 1 }} accessible accessibilityLabel={`${s.label}: ${s.status}`}>
            <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: s.status === 'done' ? t.accent : 'transparent', borderWidth: s.status === 'done' ? 0 : 1.5, borderColor: s.status === 'failed' ? t.accent : t.line }}>
              {s.status === 'done' ? <Icon name="check" size={14} color={t.onAccent} stroke={2.2} /> : null}
              {s.status === 'running' ? <ActivityIndicator size="small" color={t.accent} style={{ transform: [{ scale: 0.7 }] }} /> : null}
              {s.status === 'failed' ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accent }} /> : null}
            </View>
            <T size={14} color={color} style={{ flex: 1 }} numberOfLines={1}>
              {s.label}
            </T>
            {s.model ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: t.line }}>
                <T size={11} color={t.muted}>
                  {s.model}
                </T>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Полоса прогресса: плавно догоняет процент задачи */
export function ProgressBar({ value }: { value: number }) {
  const { t } = useTheme();
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 300, useNativeDriver: false }).start();
  }, [anim, value]);
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: t.line, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
      <Animated.View style={{ height: '100%', backgroundColor: t.accent, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
    </View>
  );
}

/** Карточка «ждём ключ Meta» или ошибка задачи */
export function JobNotice({ job, error }: { job: Job | null; error: string | null }) {
  const { t } = useTheme();
  if (error) {
    return (
      <T size={14} color={t.muted} lh={1.45} accessibilityLiveRegion="polite">
        {error}
      </T>
    );
  }
  if (!job || job.status !== 'failed') return null;
  const waiting = job.errorCode === 'no_key';
  return (
    <GoldRim radius={18} style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
      <Label accent>{waiting ? 'Waiting for the Meta key' : 'Could not finish'}</Label>
      <T size={14} lh={1.45} accessibilityLiveRegion="polite">
        {job.error}
      </T>
    </GoldRim>
  );
}
