import { STYLES, trendHits, trendsFor, type Trend, type TrendKind } from '@twin/shared';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/icons';
import { Label, T } from '@/components/ui';
import { itemText, useTrends, wearOf } from '@/lib/trends';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';

// Looks → Trending (docs/spec-trends.md): тренды сезона под стиль человека и его вещи, которые уже в тренде

const KIND: Record<TrendKind, string> = { silhouette: 'Silhouette', colour: 'Colour', piece: 'Piece', pattern: 'Pattern', texture: 'Texture', styling: 'Styling' };

export function Trending() {
  const { t } = useTheme();
  const { closet, style } = useStore();
  const digest = useTrends();
  const trends = trendsFor(digest, style, wearOf());
  const mine = (tr: Trend) => style?.styles.filter((s) => tr.styles.includes(s.id)).map((s) => STYLES[s.id].name) ?? [];

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 4 }}>
        <Label accent>{`${digest.season} · ${digest.region}`}</Label>
        <T size={13} color={t.muted} lh={1.45}>
          {style ? 'What people wear this season, ranked for your style. Outfits and Twin use these, never more than one or two at a time.' : 'What people wear this season. Take the style quiz in Me and this list follows your taste.'}
        </T>
      </View>

      {trends.map((tr) => {
        const owned = closet.filter((i) => trendHits(itemText(i), digest).some((h) => h.id === tr.id));
        const yours = mine(tr);
        return (
          <View key={tr.id} style={{ gap: 8, padding: 16, borderRadius: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T size={11} w={600} upper tracking={0.1} color={t.muted}>
                {KIND[tr.kind]}
              </T>
              {yours.length ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: t.accent }}>
                  <T size={10} w={600} upper tracking={0.1} color={t.onAccent}>
                    For your style
                  </T>
                </View>
              ) : null}
            </View>
            <T size={17} w={500} tracking={-0.01}>
              {tr.name}
            </T>
            <T size={14} color={t.muted} lh={1.45}>
              {tr.line}
            </T>
            <T size={13} color={owned.length ? t.text : t.muted} lh={1.4}>
              {owned.length ? `You own: ${owned.map((i) => i.name).join(', ')}` : 'Not in your closet yet'}
            </T>
            <Pressable
              onPress={() => router.push({ pathname: '/twin', params: { ask: `Build me an outfit around ${tr.name.toLowerCase()}` } })}
              accessibilityRole="button"
              accessibilityLabel={`Style ${tr.name} with Twin`}
              style={({ pressed }) => ({ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}>
              <T size={14} w={500} color={t.accent}>
                Style it with Twin
              </T>
              <Icon name="next" size={16} color={t.accent} />
            </Pressable>
          </View>
        );
      })}

      <T size={12} color={t.muted} lh={1.45}>
        {digest.source === 'spark'
          ? `Found this week by Muse Spark web search · ${digest.updatedAt}`
          : `Curated from autumn/winter 2026 coverage (${digest.sources.length} sources). With the Meta key, Muse Spark refreshes it every week for your country.`}
      </T>
    </View>
  );
}
