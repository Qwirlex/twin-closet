import { cmToIn, garmentFitFromTape, TAPE_LIMITS, TAPE_ZONES, type FitCut, type FitZone } from '@twin/shared';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { Cta, GlassButton, Label, T } from '@/components/ui';
import { readSetting, writeSetting } from '@/lib/storage';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { FONT, PHOTO_BG } from '@/theme/tokens';

// Вещь шкафа (docs/spec-favorite-piece.md): «сидит идеально» и замер плашмя сантиметром — новые вещи этого вида
// сравниваются с ней. Обхваты считаем сами: поперёк × 2. Замер по фото рядом с листом A4 (SAM 3.1) — с ключом Meta

type Units = 'cm' | 'in';
const UNITS = 'twin.units';
const CUTS: { id: FitCut; name: string }[] = [
  { id: 'slim', name: 'Slim' },
  { id: 'regular', name: 'Regular' },
  { id: 'relaxed', name: 'Relaxed' },
  { id: 'wide', name: 'Wide' },
  { id: 'oversize', name: 'Oversize' },
];

/** Замер плашмя в см → число на экране (дюймы — до половинки) */
const shown = (cm: number | undefined, units: Units): string => (cm == null || !Number.isFinite(cm) ? '' : String(units === 'in' ? cmToIn(cm) : Math.round(cm * 2) / 2));

export default function PieceScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, setPieceFit, setFavorite } = useStore();
  const piece = item(String(id));
  const [units, setUnitsState] = useState<Units>(() => (readSetting(UNITS) === 'in' ? 'in' : 'cm'));
  const zones = TAPE_ZONES(piece?.kind ?? null);
  const saved = piece?.fit?.source === 'tape' || piece?.fit?.source === 'demo' ? piece.fit.sizes.find((s) => s.size === piece.fit!.size)?.zones : undefined;
  // точные см плашмя — источник правды; на экране — округлённые, переключение см ↔ дюймы ничего не сдвигает
  const [flatCm, setFlatCm] = useState<Partial<Record<FitZone, number>>>(() => Object.fromEntries(zones.flatMap((z) => (saved?.[z.zone] != null ? [[z.zone, z.flat ? saved[z.zone]! / 2 : saved[z.zone]!]] : []))));
  const [texts, setTexts] = useState<Partial<Record<FitZone, string>>>(() => Object.fromEntries(zones.map((z) => [z.zone, shown(flatCm[z.zone], units)])));
  const [cut, setCut] = useState<FitCut>(piece?.fit?.cut ?? 'regular');
  const [stretch, setStretch] = useState(piece?.fit?.stretch ?? false);
  const [errors, setErrors] = useState<FitZone[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!piece) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 8, paddingHorizontal: 16, gap: 16 }}>
        <GlassButton icon="back" label="Back" onPress={back} />
        <T color={t.muted}>This piece is not in your closet any more.</T>
      </View>
    );
  }

  const setUnits = (u: Units) => {
    setTexts(Object.fromEntries(zones.map((z) => [z.zone, shown(flatCm[z.zone], u)])));
    setUnitsState(u);
    writeSetting(UNITS, u === 'in' ? 'in' : null);
  };
  const edit = (zone: FitZone, text: string) => {
    setTexts((s) => ({ ...s, [zone]: text }));
    setFlatCm((s) => {
      const { [zone]: _old, ...rest } = s;
      return text.trim() ? { ...rest, [zone]: toCm(text, units) } : rest;
    });
  };

  const save = () => {
    const r = garmentFitFromTape(piece.kind, flatCm, cut, stretch);
    setErrors(r.errors);
    if (!r.fit) return setNote(r.errors.length ? null : 'Add at least one measurement.');
    setPieceFit(piece.id, r.fit);
    if (piece.kind) setFavorite(piece.id, piece.kind, true);
    setNote(`Saved. New ${piece.kind === 'bottom' ? 'trousers and jeans' : 'pieces like this'} are compared with your ${piece.name.toLowerCase()}.`);
  };

  const card = { borderRadius: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line } as const;
  const range = (z: FitZone) => {
    const [lo, hi] = TAPE_LIMITS[z];
    return units === 'in' ? `${cmToIn(lo)}–${cmToIn(hi)} in` : `${lo}–${hi} cm`;
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: insets.bottom + 28, gap: 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <GlassButton icon="back" label="Back" onPress={back} />
        {zones.length ? (
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
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 96, height: 120, borderRadius: 18, overflow: 'hidden', backgroundColor: PHOTO_BG }}>
          <Image source={piece.image} contentFit="contain" style={{ position: 'absolute', inset: 6 }} accessible={false} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <T size={24} tracking={-0.02} lh={1.1} accessibilityRole="header">
            {piece.name}
          </T>
          <T size={14} color={t.muted}>
            {piece.meta}
          </T>
        </View>
      </View>

      {zones.length && piece.kind ? (
        <>
          <View style={[card, { paddingHorizontal: 16, minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <Icon name="heart" size={20} color={piece.favorite ? t.accent : t.muted} filled={!!piece.favorite} />
            <View style={{ flex: 1, gap: 2 }}>
              <T size={15} w={500}>
                Fits me perfectly
              </T>
              <T size={12} color={t.muted} lh={1.35}>
                New {piece.kind === 'bottom' ? 'trousers and jeans' : 'pieces of this kind'} are compared with it
              </T>
            </View>
            <Switch value={!!piece.favorite} onValueChange={(on) => setFavorite(piece.id, piece.kind!, on)} trackColor={{ true: t.accent, false: t.line }} accessibilityLabel="Fits me perfectly" />
          </View>

          <View style={{ gap: 6 }}>
            <Label accent>Measure it flat</Label>
            <T size={14} color={t.muted} lh={1.45}>
              Lay it flat on the floor, smooth it out and measure straight across. We double the flat numbers into the full size for you.
            </T>
          </View>

          <View style={card}>
            {zones.map((z, i) => {
              const bad = errors.includes(z.zone);
              return (
                <View key={z.zone} style={{ paddingHorizontal: 16, borderBottomWidth: i === zones.length - 1 ? 0 : 1, borderColor: t.line }}>
                  <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <T size={15} style={{ flex: 1 }}>
                      {z.label}
                    </T>
                    <TextInput
                      value={texts[z.zone] ?? ''}
                      onChangeText={(v) => edit(z.zone, v)}
                      inputMode="decimal"
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor={t.muted}
                      maxLength={5}
                      selectTextOnFocus
                      accessibilityLabel={`${z.label}, ${units}`}
                      style={{ width: 64, height: 44, textAlign: 'right', fontFamily: FONT[500], fontSize: 17, color: bad ? t.warn : t.text, outlineStyle: 'none' } as never}
                    />
                    <T size={13} color={t.muted} style={{ width: 22 }}>
                      {units}
                    </T>
                  </View>
                  <T size={12} color={bad ? t.warn : t.muted} lh={1.4} style={{ paddingBottom: 10 }} accessibilityLiveRegion={bad ? 'polite' : 'none'}>
                    {bad ? `Flat, this is usually ${range(z.zone)}. Check the number.` : z.hint}
                  </T>
                </View>
              );
            })}
          </View>

          <View style={{ gap: 10 }}>
            <Label>Cut</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CUTS.map((c) => {
                const on = cut === c.id;
                return (
                  <Pressable key={c.id} onPress={() => setCut(c.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.accent : 'transparent', justifyContent: 'center' }}>
                    <T size={13} w={on ? 600 : 400} color={on ? t.onAccent : t.text}>
                      {c.name}
                    </T>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
              <T size={15} style={{ flex: 1 }}>
                Stretchy fabric
              </T>
              <Switch value={stretch} onValueChange={setStretch} trackColor={{ true: t.accent, false: t.line }} accessibilityLabel="Stretchy fabric" />
            </View>
          </View>

          <Cta title="Save" sub="Becomes your favorite of this kind" onPress={save} />
          {note ? (
            <T size={13} color={t.accent} lh={1.4} accessibilityLiveRegion="polite">
              {note}
            </T>
          ) : null}
          <T size={12} color={t.muted} lh={1.45}>
            Coming with the Meta key: measure it from one photo next to an A4 sheet — SAM 3.1 cuts it out and the sheet gives the scale.
          </T>
        </>
      ) : (
        <T size={14} color={t.muted} lh={1.45}>
          Fit is checked for tops, outerwear, dresses, trousers and jeans. Nothing to measure for this piece.
        </T>
      )}
    </ScrollView>
  );
}

/** Число с экрана → см, без округления (округляет только экран) */
function toCm(text: string, units: Units): number {
  const n = Number(text.trim().replace(',', '.'));
  return units === 'in' ? n * 2.54 : n;
}
