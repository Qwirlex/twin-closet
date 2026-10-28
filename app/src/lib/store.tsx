import type { Garment } from '@twin/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CLOSET, LOOKS, OWN_LOOKS, SHOP, type DemoLook, type Item } from '@/data/demo';
import { STORES } from '@/data/stores';
import { fileUrl, getJob, startJob, uploadAsset } from '@/lib/api';
import { readSetting, writeSetting } from '@/lib/storage';
import { useSyncedDoc } from '@/lib/sync';

// Состояние приложения: демо-аккаунт (шкаф, скан, образы) плюс то, что человек добавляет сам.
// Свои вещи уходят на сервер: загрузка → задача → вырезка и подписи от моделей Meta.
// Своё хранится на устройстве и в разделе «closet» на сервере — его же видит телефон, подключённый по QR.

/** Скан, запущенный на этом или подключённом устройстве: компьютер показывает, как идёт скан с телефона */
export interface ScanRef {
  jobId: string;
  kind: 'closet_scan' | 'body_scan';
  at: number;
}

interface Store {
  closet: Item[];
  /** вещи в текущей примерке */
  tryOn: Item[];
  savedIds: string[];
  onboarded: boolean;
  /** последние сканы — свои и с подключённого телефона */
  scans: ScanRef[];
  /** скан начат на этом устройстве или уже открыт здесь — плашку «с телефона» не показываем */
  isKnownScan: (jobId: string) => boolean;
  /** скан с телефона открыт на этом устройстве */
  markScanSeen: (jobId: string) => void;
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
  addScan: (jobId: string, kind: ScanRef['kind']) => void;
  removeFromTryOn: (id: string) => void;
  toggleSaved: (lookId: string) => void;
  setOnboarded: (value: boolean) => void;
}

/** Что синхронизируется: только своё. Демо-вещи берутся из приложения — их картинки на другом устройстве не откроются */
interface ClosetDoc {
  closetAdded: Item[];
  tryOnAdded: Item[];
  /** какие демо-вещи остаются в примерке */
  tryOnDemo: string[];
  savedIds: string[];
  scans: ScanRef[];
}

const StoreContext = createContext<Store | null>(null);
const ONBOARDED = 'twin.onboarded';
const KNOWN_SCANS = 'twin.knownScans';

const WAITING_KEY = 'Cut-out and tags come once the Meta key is connected';

const freshDoc = (): ClosetDoc => ({ closetAdded: [], tryOnAdded: [], tryOnDemo: SHOP.map((i) => i.id), savedIds: LOOKS.map((l) => l.id), scans: [] });

const isStr = (v: unknown): v is string => typeof v === 'string';

/** Вещь с сервера или из памяти: только то, что можно показать (картинка — адрес) */
function readItem(raw: unknown): Item | null {
  const i = raw as Partial<Item> | null;
  const uri = (i?.image as { uri?: unknown } | undefined)?.uri;
  if (!i || !isStr(i.id) || !isStr(i.name) || !isStr(uri)) return null;
  return { ...i, id: i.id, name: i.name, meta: isStr(i.meta) ? i.meta : '', kind: i.kind ?? null, image: { uri } } as Item;
}

function readDoc(raw: unknown): ClosetDoc | null {
  const d = raw as Partial<Record<keyof ClosetDoc, unknown>> | null;
  if (!d || typeof d !== 'object') return null;
  const items = (v: unknown) => (Array.isArray(v) ? v.map(readItem).filter((x): x is Item => !!x) : []);
  const ids = (v: unknown, fallback: string[]) => (Array.isArray(v) ? v.filter(isStr) : fallback);
  const fresh = freshDoc();
  return {
    closetAdded: items(d.closetAdded),
    tryOnAdded: items(d.tryOnAdded),
    tryOnDemo: ids(d.tryOnDemo, fresh.tryOnDemo),
    savedIds: ids(d.savedIds, fresh.savedIds),
    scans: Array.isArray(d.scans) ? (d.scans as ScanRef[]).filter((s) => s && isStr(s.jobId) && (s.kind === 'closet_scan' || s.kind === 'body_scan') && typeof s.at === 'number') : [],
  };
}

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
  const [doc, change] = useSyncedDoc('closet', freshDoc, readDoc);
  /** вещи, которые ещё грузятся с этого устройства: локальная картинка, в синхронизацию не идут */
  const [uploading, setUploading] = useState<Item[]>([]);
  const [onboarded, setOnboardedState] = useState(() => readSetting(ONBOARDED) === '1');
  const [knownScans, setKnownScans] = useState<string[]>(() => {
    try {
      return JSON.parse(readSetting(KNOWN_SCANS) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  /** задачи, за которыми уже следим (своими загрузками или после перезапуска) */
  const following = useRef(new Set<string>());

  const patchAdded = (id: string, p: Partial<Item>) => change((d) => ({ ...d, tryOnAdded: d.tryOnAdded.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  /** Следим за разбором вещи, пока задача не закончится (на любом устройстве с этим шкафом) */
  async function follow(id: string, jobId: string, via: Item['via']) {
    if (following.current.has(jobId)) return;
    following.current.add(jobId);
    try {
      for (;;) {
        const j = await getJob(jobId);
        if (j.status === 'done' && j.result.item) {
          const ready = garmentToItem(j.result.item, via);
          change((d) => ({ ...d, tryOnAdded: d.tryOnAdded.map((i) => (i.id === id ? ready : i)) }));
          return;
        }
        if (j.status === 'failed') {
          patchAdded(id, j.errorCode === 'no_key' ? { stage: 'waiting', meta: WAITING_KEY } : { stage: 'failed', meta: j.error ?? 'Could not read this photo' });
          return;
        }
        patchAdded(id, { meta: `${j.progress}…` });
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch (e) {
      patchAdded(id, { stage: 'failed', meta: e instanceof Error ? e.message : String(e) });
    } finally {
      following.current.delete(jobId);
    }
  }

  // после перезапуска или с подключённого телефона: доводим вещи, которые ещё разбираются
  useEffect(() => {
    for (const i of doc.data.tryOnAdded) if (i.stage === 'working' && i.jobId) void follow(i.id, i.jobId, i.via);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.data.tryOnAdded]);

  useEffect(() => writeSetting(KNOWN_SCANS, JSON.stringify(knownScans.slice(-30))), [knownScans]);

  const value = useMemo<Store>(() => {
    const closet = [...doc.data.closetAdded, ...CLOSET];
    const tryOn = [...SHOP.filter((i) => doc.data.tryOnDemo.includes(i.id)), ...doc.data.tryOnAdded, ...uploading];
    const all = [...closet, ...SHOP, ...tryOn];
    const item = (id: string) => all.find((i) => i.id === id);

    async function importAsset(asset: ImagePickerAsset, via: NonNullable<Item['via']>) {
      const id = `new-${Date.now()}`;
      const draft: Item = { id, name: via === 'Screenshot' ? 'New screenshot' : 'New in-store photo', meta: 'Uploading…', kind: null, image: { uri: asset.uri }, via, pending: true, stage: 'uploading', shop: { price: null, url: null } };
      setUploading((list) => [...list, draft]);
      try {
        const upload = await uploadAsset(asset);
        const job = await startJob('import_item', { uploadId: upload.id });
        // дальше — общая вещь: картинка с сервера, её видит и подключённое устройство
        const working: Item = { ...draft, image: { uri: fileUrl(upload.url) }, jobId: job.id, stage: 'working', meta: job.progress };
        setUploading((list) => list.filter((i) => i.id !== id));
        change((d) => ({ ...d, tryOnAdded: [...d.tryOnAdded.filter((i) => i.id !== id), working] }));
        void follow(id, job.id, via);
      } catch (e) {
        setUploading((list) => list.map((i) => (i.id === id ? { ...i, stage: 'failed', meta: e instanceof Error ? e.message : String(e) } : i)));
      }
    }

    return {
      closet,
      tryOn,
      savedIds: doc.data.savedIds,
      onboarded,
      scans: doc.data.scans,
      isKnownScan: (jobId) => knownScans.includes(jobId),
      markScanSeen: (jobId) => setKnownScans((list) => (list.includes(jobId) ? list : [...list, jobId])),
      item,
      looksForTryOn: () => {
        const ready = new Set(tryOn.filter((i) => !i.pending).map((i) => i.id));
        return LOOKS.filter((l) => l.itemIds.some((id) => ready.has(id)));
      },
      look: (id) => [...LOOKS, ...OWN_LOOKS].find((l) => l.id === id),
      similarOwned: (it) => (it.kind ? closet.filter((c) => c.kind === it.kind && c.id !== it.id) : []),
      addToTryOn: (it) =>
        change((d) =>
          SHOP.some((s) => s.id === it.id)
            ? { ...d, tryOnDemo: [...d.tryOnDemo.filter((x) => x !== it.id), it.id] }
            : { ...d, tryOnAdded: [...d.tryOnAdded.filter((i) => i.id !== it.id), it] }
        ),
      importAsset: (asset, via) => void importAsset(asset, via),
      addGarments: (gs) =>
        change((d) => ({ ...d, closetAdded: [...gs.map((g) => ({ ...garmentToItem(g), isNew: true })), ...d.closetAdded.filter((i) => !gs.some((g) => g.id === i.id))] })),
      addScan: (jobId, kind) => {
        setKnownScans((list) => [...list, jobId]);
        change((d) => ({ ...d, scans: [...d.scans.filter((s) => s.jobId !== jobId), { jobId, kind, at: Date.now() }].slice(-10) }));
      },
      removeFromTryOn: (id) => {
        setUploading((list) => list.filter((i) => i.id !== id));
        change((d) => ({ ...d, tryOnDemo: d.tryOnDemo.filter((x) => x !== id), tryOnAdded: d.tryOnAdded.filter((i) => i.id !== id) }));
      },
      toggleSaved: (lookId) => change((d) => ({ ...d, savedIds: d.savedIds.includes(lookId) ? d.savedIds.filter((x) => x !== lookId) : [...d.savedIds, lookId] })),
      setOnboarded: (v) => {
        setOnboardedState(v);
        writeSetting(ONBOARDED, v ? '1' : null);
      },
    };
    // change и follow стабильны по смыслу; пересчитываем, когда меняются данные
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, uploading, onboarded, knownScans]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore вне StoreProvider');
  return value;
}
