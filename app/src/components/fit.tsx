import type { FitReport, FitTone, FitVerdict, FitZone, ZoneFit } from '@twin/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { Icon } from '@/components/icons';
import { Label, T } from '@/components/ui';
import type { Item } from '@/data/demo';
import { useTheme } from '@/theme/theme';
import { FIT_ON_PHOTO } from '@/theme/tokens';

// Посадка на примерке (docs/spec-fit.md, вариант B): метки по зонам прямо на рендере и шторка с выводом;
// «All zones» раскрывает ряды со шкалой tight → loose (вариант A). Цвет всегда рядом со словом.

export interface FitPiece {
  item: Item;
  report: FitReport;
  /** любимая вещь того же вида — с ней сравнение */
  favorite: Item | null;
}

export const ZONE_TITLE: Record<FitZone, string> = { chest: 'Chest', waist: 'Waist', hips: 'Hips', thigh: 'Leg', inseam: 'Length' };

/**
 * Где зона на фото демо-рендера (доля высоты) и где тело по ширине (доля ширины, центр — 0,5).
 * С ключом Meta места берутся из масок SAM
 */
const SPOT: Record<FitZone, { y: number; x: number }> = {
  chest: { y: 0.28, x: 0.5 },
  waist: { y: 0.48, x: 0.5 },
  hips: { y: 0.54, x: 0.47 },
  thigh: { y: 0.63, x: 0.55 },
  // у щиколотки — переключатель Look / Fit, метку длины ставим на голень
  inseam: { y: 0.84, x: 0.46 },
};

const SCALE: FitVerdict[] = ['tight', 'snug', 'right', 'relaxed', 'loose'];

function toneColor(tone: FitTone, t: ReturnType<typeof useTheme>['t']): string {
  return tone === 'good' ? t.accent : tone === 'problem' ? t.warn : t.text;
}

/** Каких цифр не хватает: бедро считается по бёдрам, отдельно его не просим; длина — это длина ноги */
function missingText(zones: FitZone[]): string {
  const words = zones.filter((z) => z !== 'thigh').map((z) => (z === 'inseam' ? 'inside leg' : z));
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

const roomText = (z: ZoneFit) => `${z.estimated ? '≈ ' : ''}${z.roomCm > 0 ? '+' : z.roomCm < 0 ? '−' : '±'}${Math.abs(z.roomCm)} cm`;

/** Метки на фото: точка на теле, тонкая линия, стеклянная плашка «Waist · tight» — по очереди справа и слева */
export function FitLabels({ pieces, top, left, photoW, photoH }: { pieces: FitPiece[]; top: number; left: number; photoW: number; photoH: number }) {
  const zones = pieces.flatMap((p) => p.report.zones).sort((a, b) => SPOT[a.zone].y - SPOT[b.zone].y);
  const reach = photoW * 0.17;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top, left, width: photoW, height: photoH }}>
      <Svg width={photoW} height={photoH} style={{ position: 'absolute', top: 0, left: 0 }}>
        {zones.map((z, i) => {
          const right = i % 2 === (zones[0]?.zone === 'chest' ? 1 : 0);
          const x = SPOT[z.zone].x * photoW;
          const y = SPOT[z.zone].y * photoH;
          return (
            <Line key={`l-${z.zone}`} x1={x} y1={y} x2={right ? x + reach : x - reach} y2={y} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
          );
        })}
        {zones.map((z) => (
          <Circle key={`c-${z.zone}`} cx={SPOT[z.zone].x * photoW} cy={SPOT[z.zone].y * photoH} r={4} fill={FIT_ON_PHOTO[z.tone]} stroke="#0B0B0C" strokeWidth={1.5} />
        ))}
      </Svg>
      {zones.map((z, i) => {
        const right = i % 2 === (zones[0]?.zone === 'chest' ? 1 : 0);
        const x = SPOT[z.zone].x * photoW;
        const y = SPOT[z.zone].y * photoH;
        return (
          <View
            key={z.zone}
            accessible
            accessibilityLabel={`${ZONE_TITLE[z.zone]}: ${z.label}`}
            style={{
              position: 'absolute',
              top: y - 16,
              ...(right ? { left: x + reach } : { right: photoW - (x - reach) }),
              height: 32,
              paddingHorizontal: 11,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: 'rgba(20,20,22,0.74)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.18)',
            }}>
            <T size={12} w={500} color="#F5F5F4" numberOfLines={1}>
              {ZONE_TITLE[z.zone]}
            </T>
            <T size={12} w={500} color={FIT_ON_PHOTO[z.tone]} numberOfLines={1}>
              {` · ${z.short}`}
            </T>
          </View>
        );
      })}
    </View>
  );
}

/** Шторка посадки: вывод, совет, сравнение с любимой вещью и «All zones» */
export function FitSheet({ pieces, showSize }: { pieces: FitPiece[]; showSize: boolean }) {
  const { t } = useTheme();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const piece = pieces[Math.min(index, pieces.length - 1)];
  if (!piece) return null;
  const r = piece.report;

  return (
    <View style={{ gap: 12 }}>
      {pieces.length > 1 ? (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 8 }}>
          {pieces.map((p, i) => {
            const on = i === index;
            return (
              <Pressable
                key={p.item.id}
                onPress={() => setIndex(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', backgroundColor: on ? t.ctaBg : t.surface, borderWidth: 1, borderColor: on ? t.ctaBg : t.line }}>
                <T size={13} w={on ? 500 : 400} color={on ? t.ctaText : t.text}>
                  {p.item.name}
                </T>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 6 }} accessibilityLiveRegion="polite">
        <Label accent>{`Fit · ${piece.item.name}${showSize ? ` · ${r.size}` : ''}`}</Label>
        <T size={22} tracking={-0.02} lh={1.15}>
          {r.title}
        </T>
        <T size={14} color={t.muted} lh={1.45}>
          {r.advice ? `${r.summary} ${r.advice}` : r.summary}
        </T>
      </View>

      {r.missing.length ? (
        <Pressable onPress={() => router.push('/measurements')} accessibilityRole="button" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="ruler" size={18} color={t.accent} />
          <T size={13} color={t.accent} style={{ flex: 1 }}>
            {`Add your ${missingText(r.missing)} for an exact fit`}
          </T>
        </Pressable>
      ) : null}

      {r.vsFavorite && piece.favorite ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: t.line }}>
          <Image source={piece.favorite.image} contentFit="contain" style={{ width: 38, height: 46, borderRadius: 8, backgroundColor: t.render }} accessible={false} />
          <T size={13} lh={1.4} style={{ flex: 1 }}>
            {r.vsFavorite}
          </T>
        </View>
      ) : piece.item.kind === 'bottom' || piece.item.kind === 'top' || piece.item.kind === 'outerwear' || piece.item.kind === 'dress' ? (
        // сравнить не с чем — предложим замерить свою вещь, которая сидит идеально
        <Pressable onPress={() => router.push('/')} accessibilityRole="button" style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="heart" size={18} color={t.accent} />
          <T size={13} color={t.accent} style={{ flex: 1 }}>
            {`Measure ${piece.item.kind === 'bottom' ? 'a pair' : 'a piece'} that fits you perfectly — open it in your closet`}
          </T>
        </Pressable>
      ) : null}

      {r.zones.length ? (
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderRadius: 999, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
          <T size={14} w={500}>
            {open ? 'Hide zones' : 'All zones'}
          </T>
          <View style={{ transform: [{ rotate: open ? '-90deg' : '90deg' }] }}>
            <Icon name="next" size={16} color={t.muted} />
          </View>
        </Pressable>
      ) : null}

      {open ? (
        <View style={{ borderRadius: 22, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
          {r.zones.map((z, i) => (
            <View key={z.zone} style={{ paddingVertical: 13, paddingHorizontal: 16, gap: 9, borderTopWidth: i ? 1 : 0, borderColor: t.line }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <T size={15} style={{ width: 64 }}>
                  {ZONE_TITLE[z.zone]}
                </T>
                <T size={15} w={500} color={toneColor(z.tone, t)} style={{ flex: 1 }}>
                  {z.label}
                </T>
                <T size={13} color={t.muted}>
                  {roomText(z)}
                </T>
              </View>
              <View style={{ flexDirection: 'row', gap: 3 }} accessible={false}>
                {SCALE.map((v) => (
                  <View key={v} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: v === z.verdict ? toneColor(z.tone, t) : t.line }} />
                ))}
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 }} accessible={false}>
            {SCALE.map((v) => (
              <T key={v} size={11} color={t.muted}>
                {v}
              </T>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
