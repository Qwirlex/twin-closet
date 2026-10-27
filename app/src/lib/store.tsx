import type { Garment } from '@twin/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CLOSET, LOOKS, OWN_LOOKS, SHOP, type DemoLook, type Item } from '@/data/demo';
import { STORES } from '@/data/stores';
import { fileUrl, getJob, startJob, uploadAsset } from '@/lib/api';
import { readSetting, writeSetting } from '@/lib/storage';

// Состояние приложения: демо-аккаунт (шкаф, скан, образы) плюс то, что человек добавляет сам.
// Свои вещи уходят на сервер: загрузка → задача → вырезка и подписи от моделей Meta.

interface Store {
  closet: Item[];
  /** вещи в текущей примерке */
  tryOn: Item[];
  savedIds: string[];
  onboarded: boolean;
  item: (id: string) => Item | undefined;
  /** образы для вещей в примерке */
  looksForTryOn: () => DemoLook[];
  look: (id: string) => DemoLook | undefined;
  /** такие же по виду вещи, которые уже есть в шкафу */
  similarOwned: (item: Item) => Item[];
  addToTryOn: (item: Item) => void;
  /** скриншот или фото из магазина → сервер разбирает вещь, карточка обновляется по ходу */
  importAsset: (asset: ImagePickerAsset, via: NonNullable<Item['via']>) => void;
  /** вещи из скана шкафа */
  addGarments: (garments: Garment[]) => void;
  removeFromTryOn: (id: string) => void;
  toggleSaved: (lookId: string) => void;
  setOnboarded: (value: boolean) => void;
}

const StoreContext = createContext<Store | null>(null);
const ONBOARDED = 'twin.onboarded';

const WAITING_KEY = 'Cut-out and tags come once the Meta key is connected';

/** Ссылка на товар: страницу прочитает Muse Spark (у него есть веб-поиск), пока ждёт ключ */
export function linkPiece(url: string, host: string): Item {
  return { id: `new-${Date.now()}`, name: host, meta: 'Muse Spark reads the product page once the Meta key is connected', kind: null, image: { uri: '' }, via: 'Link', pending: true, stage: 'waiting', shop: { price: null, url } };
}

export function garmentToItem(g: Garment, via?: Item['via']): Item {
  const price = g.shop?.price ? Number.parseFloat(g.shop.price.replace(/[^\d.,]/g, '').replace(',', '.')) : NaN;
  return {
    id: g.id,
    name: g.title,
    meta: [g.shop?.brand, g.material, g.shop?.sizes].filter(Boolean).join(' · ') || g.color,
    kind: g.kind,
    image: { uri: fileUrl(g.cutoutUrl) },
    via,
    shop: {
      price: Number.isFinite(price) ? price : null,
      currency: g.shop?.price?.match(/€|EUR/i) ? 'EUR' : g.shop?.price?.match(/£|GBP/i) ? 'GBP' : g.shop?.price?.match(/\$|USD/i) ? 'USD' : null,
      url: g.shop?.url ?? null,
      storeId: STORES.find((s) => g.shop?.brand && s.name.toLowerCase() === g.shop.brand.toLowerCase())?.id ?? null,
      ref: g.shop?.ref ?? null,
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [closet, setCloset] = useState<Item[]>(CLOSET);
  const [tryOn, setTryOn] = useState<Item[]>(SHOP);
  const [savedIds, setSavedIds] = useState<string[]>(LOOKS.map((l) => l.id));
  const [onboarded, setOnboardedState] = useState(() => readSetting(ONBOARDED) === '1');

  const value = useMemo<Store>(() => {
    const all = [...closet, ...SHOP, ...tryOn];
    const item = (id: string) => all.find((i) => i.id === id);
    const patch = (id: string, p: Partial<Item>) => setTryOn((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));

    async function importAsset(asset: ImagePickerAsset, via: NonNullable<Item['via']>) {
      const id = `new-${Date.now()}`;
      setTryOn((list) => [...list, { id, name: via === 'Screenshot' ? 'New screenshot' : 'New in-store photo', meta: 'Uploading…', kind: null, image: { uri: asset.uri }, via, pending: true, stage: 'uploading', shop: { price: null, url: null } }]);
      try {
        const upload = await uploadAsset(asset);
        const job = await startJob('import_item', { uploadId: upload.id });
        patch(id, { jobId: job.id, stage: 'working', meta: job.progress });
        for (;;) {
          await new Promise((r) => setTimeout(r, 1200));
          const j = await getJob(job.id);
          if (j.status === 'done' && j.result.item) {
            setTryOn((list) => list.map((i) => (i.id === id ? garmentToItem(j.result.item!, via) : i)));
            return;
          }
          if (j.status === 'failed') {
            patch(id, j.errorCode === 'no_key' ? { stage: 'waiting', meta: WAITING_KEY } : { stage: 'failed', meta: j.error ?? 'Could not read this photo' });
            return;
          }
          patch(id, { meta: `${j.progress}…` });
        }
      } catch (e) {
        patch(id, { stage: 'failed', meta: e instanceof Error ? e.message : String(e) });
      }
    }

    return {
      closet,
      tryOn,
      savedIds,
      onboarded,
      item,
      looksForTryOn: () => {
        const ready = new Set(tryOn.filter((i) => !i.pending).map((i) => i.id));
        return LOOKS.filter((l) => l.itemIds.some((id) => ready.has(id)));
      },
      look: (id) => [...LOOKS, ...OWN_LOOKS].find((l) => l.id === id),
      similarOwned: (it) => (it.kind ? closet.filter((c) => c.kind === it.kind && c.id !== it.id) : []),
      addToTryOn: (it) => setTryOn((list) => [...list.filter((i) => i.id !== it.id), it]),
      importAsset: (asset, via) => void importAsset(asset, via),
      addGarments: (gs) => setCloset((list) => [...gs.map((g) => ({ ...garmentToItem(g), isNew: true })), ...list.filter((i) => !gs.some((g) => g.id === i.id))]),
      removeFromTryOn: (id) => setTryOn((list) => list.filter((i) => i.id !== id)),
      toggleSaved: (lookId) => setSavedIds((ids) => (ids.includes(lookId) ? ids.filter((x) => x !== lookId) : [...ids, lookId])),
      setOnboarded: (v) => {
        setOnboardedState(v);
        writeSetting(ONBOARDED, v ? '1' : null);
      },
    };
  }, [closet, tryOn, savedIds, onboarded]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore вне StoreProvider');
  return value;
}
