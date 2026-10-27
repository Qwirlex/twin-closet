import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Thumb } from '@/components/garments';
import { Icon, type IconName } from '@/components/icons';
import { TabScreen } from '@/components/layout';
import { Cta, Glass, Label, T, ThemeToggle } from '@/components/ui';
import type { Item } from '@/data/demo';
import { useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { FONT } from '@/theme/tokens';

const SOURCES: { key: NonNullable<Item['via']>; label: string; sub: string; icon: IconName }[] = [
  { key: 'Screenshot', label: 'Screenshot', sub: 'Any store or post', icon: 'phone' },
  { key: 'Scanned in store', label: 'In store', sub: 'Item + price tag', icon: 'camera' },
  { key: 'Link', label: 'Link', sub: 'Paste a product URL', icon: 'link' },
];

/** Новая вещь до разбора: вырезку, вид, бренд и цену сделают SAM 3.1 и Muse Spark */
function pendingItem(via: NonNullable<Item['via']>, image: Item['image'], name: string): Item {
  return { id: `new-${Date.now()}`, name, meta: 'Cut-out and tags come from the Meta models', kind: null, image, via, pending: true, shop: { price: null, url: null } };
}

export default function TryScreen() {
  const { t } = useTheme();
  const { tryOn, addToTryOn, removeFromTryOn, looksForTryOn } = useStore();
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const looks = looksForTryOn();

  async function pick(via: NonNullable<Item['via']>) {
    setError(null);
    if (via === 'Link') {
      setLinkOpen((v) => !v);
      return;
    }
    if (via === 'Scanned in store') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera access is off. Turn it on in Settings to scan a piece in the store.');
        return;
      }
    }
    const res = via === 'Screenshot' ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 }) : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    addToTryOn(pendingItem(via, { uri: res.assets[0].uri }, via === 'Screenshot' ? 'New screenshot' : 'New in-store photo'));
  }

  function addLink() {
    let host: string;
    try {
      host = new URL(link.trim()).hostname.replace(/^www\./, '');
    } catch {
      setError('That does not look like a link. Copy the product URL from the store and paste it here.');
      return;
    }
    addToTryOn({ ...pendingItem('Link', { uri: '' }, host), shop: { price: null, url: link.trim() } });
    setLink('');
    setLinkOpen(false);
    setError(null);
  }

  const ready = tryOn.filter((i) => !i.pending);
  const sub = looks.length
    ? `${looks.length} ${looks.length === 1 ? 'look' : 'looks'} · up to 4 angles`
    : ready.length || !tryOn.length
      ? 'Add a piece to try on'
      : 'New pieces render once the Meta key is connected';

  return (
    <TabScreen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <View style={{ gap: 6 }}>
          <T size={36} tracking={-0.03} lh={1} accessibilityRole="header">
            Try on
          </T>
          <T size={14} color={t.muted}>
            Anything you are thinking of buying
          </T>
        </View>
        <ThemeToggle />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {SOURCES.map((s) => (
          <Pressable key={s.key} onPress={() => pick(s.key)} accessibilityRole="button" accessibilityLabel={`${s.label}. ${s.sub}`} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.8 : 1 })}>
            <Glass radius={22} style={{ minHeight: 128, padding: 12, paddingTop: 14, gap: 4 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 'auto' }}>
                <Icon name={s.icon} size={22} color={t.accent} />
              </View>
              <T size={14} w={500}>
                {s.label}
              </T>
              <T size={12} color={t.muted} lh={1.3}>
                {s.sub}
              </T>
            </Glass>
          </Pressable>
        ))}
      </View>

      {linkOpen ? (
        <Glass style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6, height: 56, gap: 8 }}>
          <TextInput
            autoFocus
            value={link}
            onChangeText={setLink}
            onSubmitEditing={addLink}
            placeholder="https://store.com/product"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            keyboardType="url"
            accessibilityLabel="Product link"
            style={{ flex: 1, fontFamily: FONT[400], fontSize: 15, color: t.text, outlineStyle: 'none' } as never}
          />
          <Pressable onPress={addLink} accessibilityRole="button" accessibilityLabel="Add link" style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: t.ctaBg, justifyContent: 'center' }}>
            <T size={14} w={500} color={t.ctaText}>
              Add
            </T>
          </Pressable>
        </Glass>
      ) : null}

      {error ? (
        <T size={13} color={t.muted} lh={1.4} accessibilityLiveRegion="polite">
          {error}
        </T>
      ) : null}

      <View style={{ gap: 10 }}>
        <Label>In this try-on · {tryOn.length}</Label>
        {tryOn.map((it) => (
          <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingLeft: 10, paddingRight: 6, borderRadius: 20, backgroundColor: t.surface, borderWidth: 1, borderColor: t.line }}>
            {it.via === 'Link' ? (
              <View style={{ width: 64, height: 72, borderRadius: 14, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="link" size={22} color={t.muted} />
              </View>
            ) : (
              <Thumb item={it} />
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <T size={15} w={500} numberOfLines={1}>
                {it.name}
              </T>
              <T size={13} color={t.muted} numberOfLines={2}>
                {it.meta}
              </T>
              <View style={{ alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: it.pending ? t.accent : t.line }}>
                <T size={11} color={it.pending ? t.accent : t.muted}>
                  {it.pending ? `${it.via} · waiting for cut-out` : it.via}
                </T>
              </View>
            </View>
            <Pressable onPress={() => removeFromTryOn(it.id)} accessibilityRole="button" accessibilityLabel={`Remove ${it.name}`} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={18} color={t.muted} />
            </Pressable>
          </View>
        ))}
        <T size={13} color={t.muted} style={{ marginTop: 2 }}>
          {tryOn.length ? 'We will style them with pieces from your closet.' : 'Add a screenshot, a photo from the store or a link.'}
        </T>
      </View>

      <Cta title="See it on me" sub={sub} disabled={!looks.length} onPress={() => router.push('/result')} />
    </TabScreen>
  );
}
