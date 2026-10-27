import type { StoreBrand } from '@twin/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icons';
import { Glass, GlassButton, GoldRim, Label, T } from '@/components/ui';
import { COUNTRIES, countryName, STORES, storesFor } from '@/data/stores';
import { useShopping } from '@/lib/shopping';
import { useTheme } from '@/theme/theme';
import { FONT } from '@/theme/tokens';

// Любимые магазины: регион только сортирует, искать можно по всем брендам

export default function StoresScreen() {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { country, setCountry, favoriteIds, toggleFavorite } = useShopping();
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(false);

  const q = query.trim().toLowerCase();
  const { local, worldwide } = storesFor(country);
  const found = q ? STORES.filter((s) => `${s.name} ${s.domain}`.toLowerCase().includes(q)) : [];
  const favorites = STORES.filter((s) => favoriteIds.includes(s.id));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <GlassButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/me'))} />
        <T size={26} tracking={-0.03} accessibilityRole="header">
          Stores
        </T>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40, gap: 18 }} keyboardShouldPersistTaps="handled">
        <T size={14} color={t.muted} lh={1.45}>
          Pick the shops you buy from. Twin looks for pieces there and tells you when something on your wishlist drops in price.
        </T>

        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setPicking((v) => !v)} accessibilityRole="button" accessibilityLabel={`Region: ${countryName(country)}`} accessibilityState={{ expanded: picking }}>
            <Glass style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
              <Icon name="globe" size={18} color={t.glass.text} />
              <T size={15} w={500} color={t.glass.text} style={{ flex: 1 }}>
                {countryName(country)}
              </T>
              <T size={12} color={t.muted}>
                Only sorts the list
              </T>
              <Icon name="chevronDown" size={18} color={t.muted} />
            </Glass>
          </Pressable>
          {picking ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Region">
              {COUNTRIES.map((c) => {
                const on = c.code === country;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      setCountry(c.code);
                      setPicking(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: on ? t.accent : t.line, backgroundColor: on ? t.surface2 : 'transparent' }}>
                    <T size={13} w={on ? 500 : 400} color={on ? t.text : t.muted}>
                      {c.name}
                    </T>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <Glass style={{ height: 48, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="search" size={18} color={t.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search any brand"
            placeholderTextColor={t.muted}
            accessibilityLabel="Search any brand"
            autoCapitalize="none"
            style={{ flex: 1, fontFamily: FONT[400], fontSize: 15, color: t.text, outlineStyle: 'none' } as never}
          />
        </Glass>

        {q ? (
          <Section title={found.length ? `Results · ${found.length}` : 'No brand like that yet'} stores={found} favoriteIds={favoriteIds} onToggle={toggleFavorite} />
        ) : (
          <>
            {favorites.length ? <Section title={`Your stores · ${favorites.length}`} stores={favorites} favoriteIds={favoriteIds} onToggle={toggleFavorite} /> : null}
            {local.length ? <Section title={`In ${countryName(country)}`} stores={local.filter((s) => !favoriteIds.includes(s.id))} favoriteIds={favoriteIds} onToggle={toggleFavorite} /> : null}
            <Section title="Worldwide" stores={worldwide.filter((s) => !favoriteIds.includes(s.id))} favoriteIds={favoriteIds} onToggle={toggleFavorite} />
          </>
        )}

        <GoldRim radius={18} style={{ paddingVertical: 12, paddingHorizontal: 14, gap: 4 }}>
          <Label accent>Other shops coming soon</Label>
          <T size={14} lh={1.45}>
            Zara, Bershka and Pull & Bear are live: Twin finds pieces there and watches prices. You can already add the rest to your stores.
          </T>
        </GoldRim>
        <T size={11} color={t.muted} lh={1.5}>
          Brand list: Name Suggestion Index, OpenStreetMap contributors (BSD-3).
        </T>
      </ScrollView>
    </View>
  );
}

function Section({ title, stores, favoriteIds, onToggle }: { title: string; stores: StoreBrand[]; favoriteIds: string[]; onToggle: (id: string) => void }) {
  if (!stores.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Label>{title}</Label>
      {stores.map((s) => (
        <StoreRow key={s.id} store={s} on={favoriteIds.includes(s.id)} onToggle={() => onToggle(s.id)} />
      ))}
    </View>
  );
}

function StoreRow({ store, on, onToggle }: { store: StoreBrand; on: boolean; onToggle: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={`${store.name}${store.live ? '' : ', coming soon'}`} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 10, paddingRight: 12, borderRadius: 18, backgroundColor: t.surface, borderWidth: 1, borderColor: on ? t.accent : t.line }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <T size={14} w={600} color={t.text}>
            {initials(store.name)}
          </T>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={15} w={500} numberOfLines={1}>
            {store.name}
          </T>
          <T size={12} color={t.muted} numberOfLines={1}>
            {store.domain}
          </T>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: store.live ? 0 : 1, borderColor: t.line, backgroundColor: store.live ? t.accent : 'transparent' }}>
          <T size={10} w={600} upper tracking={0.1} color={store.live ? t.onAccent : t.muted}>
            {store.live ? 'Live' : 'Coming soon'}
          </T>
        </View>
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.accent : 'transparent', borderWidth: on ? 0 : 1.5, borderColor: t.line }}>
          {on ? <Icon name="check" size={15} color={t.onAccent} stroke={2.2} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(' ').filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}
