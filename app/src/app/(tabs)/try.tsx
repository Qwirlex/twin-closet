import { isLiveStore, LIVE_STORES } from '@twin/shared';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, TextInput, View } from 'react-native';

import { Thumb } from '@/components/garments';
import { Icon, type IconName } from '@/components/icons';
import { TabScreen } from '@/components/layout';
import { Cta, Glass, Label, T, ThemeToggle } from '@/components/ui';
import type { Item } from '@/data/demo';
import { canLiveScan } from '@/lib/live-camera';
import { isDesktopWeb } from '@/lib/platform';
import { useShopping } from '@/lib/shopping';
import { linkPiece, useStore } from '@/lib/store';
import { useTheme } from '@/theme/theme';
import { FONT } from '@/theme/tokens';

const SOURCES: { key: NonNullable<Item['via']>; label: string; sub: string; icon: IconName }[] = [
  { key: 'Screenshot', label: 'Screenshot', sub: 'Any store or post', icon: 'phone' },
  { key: 'Scanned in store', label: 'In store', sub: 'Item + price tag', icon: 'camera' },
  { key: 'Link', label: 'Link', sub: 'Paste a product URL', icon: 'link' },
];

const STAGE: Record<NonNullable<Item['stage']>, string> = { uploading: 'uploading', working: 'reading', waiting: 'needs Meta key', failed: 'could not read' };

export default function TryScreen() {
  const { t } = useTheme();
  const { tryOn, addToTryOn, importAsset, removeFromTryOn, looksForTryOn } = useStore();
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const looks = looksForTryOn();
  const { isWished, toggleWish } = useShopping();

  // на компьютере скриншот можно бросить прямо на страницу (до трёх за раз)
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return;
      const over = (e: DragEvent) => {
        if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
      };
      const drop = (e: DragEvent) => {
        const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'));
        if (!files.length) return;
        e.preventDefault();
        for (const file of files.slice(0, 3)) {
          importAsset({ uri: URL.createObjectURL(file), file, mimeType: file.type, fileName: file.name, type: 'image', width: 0, height: 0 } as ImagePicker.ImagePickerAsset, 'Screenshot');
        }
      };
      window.addEventListener('dragover', over);
      window.addEventListener('drop', drop);
      return () => {
        window.removeEventListener('dragover', over);
        window.removeEventListener('drop', drop);
      };
    }, [importAsset])
  );

  async function pick(via: NonNullable<Item['via']>) {
    setError(null);
    if (via === 'Link') {
      setLinkOpen((v) => !v);
      return;
    }
    if (via === 'Scanned in store') {
      // умный скан: бирка → перед → спина, с подсказками; в сборке без живой камеры — обычное фото
      if (canLiveScan()) {
        router.push({ pathname: '/scan', params: { mode: 'store' } });
        return;
      }
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setError('Camera access is off. Turn it on in Settings to scan a piece in the store.');
        return;
      }
    }
    const res = via === 'Screenshot' ? await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 }) : await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (res.canceled || !res.assets[0]) return;
    importAsset(res.assets[0], via);
  }

  function addLink() {
    // на телефоне URL не бросает ошибку на плохой ссылке, а отдаёт пустой адрес — проверяем оба случая
    let host = '';
    try {
      host = new URL(link.trim()).hostname.replace(/^www\./, '');
    } catch {
      host = '';
    }
    if (!/^https?:\/\//i.test(link.trim()) || !host.includes('.')) {
      setError('That does not look like a link. Copy the product URL from the store and paste it here.');
      return;
    }
    addToTryOn(linkPiece(link.trim(), host));
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
      ) : isDesktopWeb() ? (
        <T size={13} color={t.muted} lh={1.4}>
          On a computer, drop a screenshot anywhere on this page.
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
              {isLiveStore(it.shop?.storeId) && LIVE_STORES[it.shop.storeId].sizing ? (
                <T size={12} color={t.warn} lh={1.35}>
                  {LIVE_STORES[it.shop.storeId].sizing}
                </T>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 2, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: it.pending ? t.accent : t.line }}>
                {it.stage === 'uploading' || it.stage === 'working' ? <ActivityIndicator size="small" color={t.accent} style={{ transform: [{ scale: 0.6 }], width: 12, height: 12 }} /> : null}
                <T size={11} color={it.pending ? t.accent : t.muted}>
                  {it.pending && it.stage ? `${it.via} · ${STAGE[it.stage]}` : it.via}
                </T>
              </View>
            </View>
            <Pressable onPress={() => toggleWish(it)} accessibilityRole="button" accessibilityLabel={isWished(it.id) ? `Remove ${it.name} from wishlist` : `Save ${it.name} to wishlist`} accessibilityState={{ selected: isWished(it.id) }} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="heart" size={19} color={isWished(it.id) ? t.accent : t.muted} filled={isWished(it.id)} />
            </Pressable>
            <Pressable onPress={() => removeFromTryOn(it.id)} accessibilityRole="button" accessibilityLabel={`Remove ${it.name}`} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
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
