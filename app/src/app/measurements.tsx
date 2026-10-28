import { BODY_LIMITS, EMPTY_BODY, cmToIn, inToCm, kgToLb, lbToKg, type BodyMeasurements } from '@twin/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { Cta, GlassButton, Label, T } from '@/components/ui';
import { readSetting, writeSetting } from '@/lib/storage';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { FONT } from '@/theme/tokens';

// Параметры тела (docs/spec-fit.md, вариант A): сразу после входа (first=1) и из Me.
// Хранятся в см и кг, на экране — см или дюймы. Всё по желанию, кроме роста; посадка считается по каждой зоне.

type Key = keyof BodyMeasurements;
type Units = 'cm' | 'in';
type Kind = 'length' | 'weight' | 'shoe';

interface Field {
  key: Key;
  label: string;
  hint: string;
  kind: Kind;
}

const UNITS = 'twin.units';

const MAIN: Field[] = [
  { key: 'heightCm', label: 'Height', hint: 'Barefoot, back against a wall.', kind: 'length' },
  { key: 'weightKg', label: 'Weight', hint: 'Helps estimate what you skip.', kind: 'weight' },
];

const AROUND: Field[] = [
  { key: 'chestCm', label: 'Chest', hint: 'Around the fullest part, under the arms, tape level.', kind: 'length' },
  { key: 'waistCm', label: 'Waist', hint: 'Where your trousers usually sit. Relaxed, not pulled in.', kind: 'length' },
  { key: 'hipsCm', label: 'Hips', hint: 'Around the fullest part, feet together.', kind: 'length' },
  { key: 'inseamCm', label: 'Inside leg', hint: 'From the crotch to the floor, barefoot.', kind: 'length' },
  { key: 'shoeEu', label: 'Shoe size', hint: 'The EU size you usually buy.', kind: 'shoe' },
];

const unitOf = (kind: Kind, units: Units) => (kind === 'shoe' ? 'EU' : kind === 'weight' ? (units === 'in' ? 'lb' : 'kg') : units);

function toShown(kind: Kind, stored: number | null, units: Units): string {
  if (stored == null) return '';
  if (kind === 'length' && units === 'in') return String(cmToIn(stored));
  if (kind === 'weight' && units === 'in') return String(kgToLb(stored));
  return String(stored);
}

/** Число с экрана → см/кг; undefined — пусто, NaN — не число */
function toStored(kind: Kind, text: string, units: Units): number | undefined {
  const s = text.trim().replace(',', '.');
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  if (kind === 'length') return units === 'in' ? inToCm(n) : Math.round(n * 2) / 2;
  if (kind === 'weight') return units === 'in' ? lbToKg(n) : Math.round(n);
  return Math.round(n * 2) / 2;
}

const FIELDS = [...MAIN, ...AROUND];

function textsFrom(body: BodyMeasurements, units: Units): Record<Key, string> {
  return Object.fromEntries(FIELDS.map((f) => [f.key, toShown(f.kind, body[f.key], units)])) as Record<Key, string>;
}

export default function MeasurementsScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { first } = useLocalSearchParams<{ first?: string }>();
  const isFirst = first === '1';
  const { body, setBody } = useStore();
  const [units, setUnitsState] = useState<Units>(() => (readSetting(UNITS) === 'in' ? 'in' : 'cm'));
  const [texts, setTexts] = useState<Record<Key, string>>(() => textsFrom(body ?? EMPTY_BODY, units));
  const [tips, setTips] = useState(false);
  const [tried, setTried] = useState(false);

  const values = Object.fromEntries(FIELDS.map((f) => [f.key, toStored(f.kind, texts[f.key], units)])) as Record<Key, number | undefined>;
  const errorOf = (f: Field): string | null => {
    const v = values[f.key];
    if (v === undefined) return f.key === 'heightCm' && tried ? 'Height is needed for an exact fit. Or skip for now.' : null;
    const [lo, hi] = BODY_LIMITS[f.key];
    return Number.isNaN(v) || v < lo || v > hi ? 'Check this number' : null;
  };
  const hasErrors = FIELDS.some((f) => errorOf(f)) || values.heightCm === undefined;

  const setUnits = (next: Units) => {
    if (next === units) return;
    // пересчитываем введённое в новые единицы, чтобы цифры не потерялись
    const now = Object.fromEntries(FIELDS.map((f) => [f.key, values[f.key] ?? null])) as unknown as BodyMeasurements;
    setTexts(textsFrom(now, next));
    setUnitsState(next);
    writeSetting(UNITS, next === 'in' ? 'in' : null);
  };

  const leave = () => {
    // при входе дальше опрос стиля; вход закончится там
    if (isFirst) router.replace({ pathname: '/style', params: { first: '1' } });
    else if (router.canGoBack()) router.back();
    else router.replace('/me');
  };

  const save = () => {
    setTried(true);
    if (hasErrors) return;
    setBody(Object.fromEntries(FIELDS.map((f) => [f.key, values[f.key] ?? null])) as unknown as BodyMeasurements);
    leave();
  };

  const row = (f: Field, last: boolean) => {
    const error = errorOf(f);
    const unit = unitOf(f.kind, units);
    return (
      <View key={f.key} style={{ paddingHorizontal: 16, borderBottomWidth: last ? 0 : 1, borderColor: t.line }}>
        <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <T size={15} style={{ flex: 1 }}>
            {f.label}
          </T>
          {f.key === 'heightCm' ? (
            <T size={11} w={600} upper tracking={0.08} color={t.accent}>
              Needed
            </T>
          ) : f.key === 'weightKg' ? (
            <T size={12} color={t.muted}>
              optional
            </T>
          ) : null}
          <TextInput
            value={texts[f.key]}
            onChangeText={(v) => setTexts((s) => ({ ...s, [f.key]: v }))}
            inputMode="decimal"
            keyboardType="decimal-pad"
            placeholder="—"
            placeholderTextColor={t.muted}
            maxLength={5}
            selectTextOnFocus
            accessibilityLabel={`${f.label}, ${unit === 'EU' ? 'EU size' : unit}`}
            style={{ width: 64, height: 44, textAlign: 'right', fontFamily: FONT[500], fontSize: 17, color: error ? t.warn : t.text, outlineStyle: 'none' } as never}
          />
          <T size={13} color={t.muted} style={{ width: 22 }}>
            {unit}
          </T>
        </View>
        {error ? (
          <T size={12} color={t.warn} lh={1.4} style={{ paddingBottom: 10 }} accessibilityLiveRegion="polite">
            {error}
          </T>
        ) : tips ? (
          <T size={12} color={t.muted} lh={1.4} style={{ paddingBottom: 10 }}>
            {f.hint}
          </T>
        ) : null}
      </View>
    );
  };

  const card = { borderRadius: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line } as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 14, paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {isFirst ? <View style={{ width: 44 }} /> : <GlassButton icon="back" label="Back" onPress={leave} />}
        <View accessibilityRole="radiogroup" accessibilityLabel="Units" style={{ flexDirection: 'row', padding: 3, borderRadius: 999, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
          {(['cm', 'in'] as const).map((u) => {
            const on = units === u;
            return (
              <Pressable key={u} onPress={() => setUnits(u)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={u === 'cm' ? 'Centimetres' : 'Inches'} style={{ minHeight: 38, minWidth: 52, paddingHorizontal: 14, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.ctaBg : 'transparent' }}>
                <T size={13} w={on ? 500 : 400} color={on ? t.ctaText : t.muted}>
                  {u}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Label accent>For an exact fit</Label>
        <T size={32} tracking={-0.03} lh={1.05} accessibilityRole="header">
          Your measurements
        </T>
        <T size={14} color={t.muted} lh={1.45}>
          Every piece is checked zone by zone: waist, hips, length. Never one size label. Only you see these.
        </T>
      </View>

      <View style={card}>{MAIN.map((f, i) => row(f, i === MAIN.length - 1))}</View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <Label>Around the body · optional</Label>
        <Pressable onPress={() => setTips((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: tips }} hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T size={13} color={t.accent}>
            {tips ? 'Hide tips' : 'How to measure'}
          </T>
        </Pressable>
      </View>

      <View style={card}>{AROUND.map((f, i) => row(f, i === AROUND.length - 1))}</View>

      <View style={{ marginTop: 'auto', gap: 12 }}>
        <Cta title={isFirst ? 'Save and continue' : 'Save'} sub="Only height? Fit leans on your favorite pieces for the rest" disabled={tried && hasErrors} onPress={save} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Icon name="lock" size={14} color={t.muted} />
            <T size={12} color={t.muted}>
              Private · delete any time in Me
            </T>
          </View>
          {isFirst ? (
            <Pressable onPress={leave} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={14} color={t.muted}>
                Skip for now
              </T>
            </Pressable>
          ) : body ? (
            <Pressable
              onPress={() => {
                setBody(null);
                leave();
              }}
              accessibilityRole="button"
              style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={14} color={t.warn}>
                Delete my measurements
              </T>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
