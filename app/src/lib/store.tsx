import { cleanBody, cleanStyle, FIT_ZONES, fitReport, GARMENT_KINDS, LIVE_STORES, storeOfUrl, type BodyMeasurements, type FitCut, type FitReport, type Garment, type GarmentFit, type GarmentKind, type StyleProfile } from '@twin/shared';
import type { ImagePickerAsset } from 'expo-image-picker';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { CLOSET, DEMO_BODY, LOOKS, OWN_LOOKS, SHOP, type DemoLook, type Item } from '@/data/demo';
import { deviceCountry, STORES } from '@/data/stores';
import { fileUrl, getJob, startJob, uploadAsset, uploadBlob } from '@/lib/api';
import type { CapturedShot } from '@/lib/live-camera';
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
  /** вещь из умного скана: перед, спина, ярлык (дома — в шкаф) или бирка и вещь (в магазине — в примерку); ждёт загрузку */
  importShots: (shots: CapturedShot[], to: 'closet' | 'store') => Promise<void>;
  /** вещи из скана шкафа */
  addGarments: (garments: Garment[]) => void;
  addScan: (jobId: string, kind: ScanRef['kind']) => void;
  removeFromTryOn: (id: string) => void;
  toggleSaved: (lookId: string) => void;
  setOnboarded: (value: boolean) => void;
  /** параметры тела; null — человек их стёр или не вводил */
  body: BodyMeasurements | null;
  setBody: (body: BodyMeasurements | null) => void;
  /** «Show my size» в Me: по умолчанию выключено — нигде нет S/M/L */
  showSize: boolean;
  setShowSize: (value: boolean) => void;
  /** посадка вещи на человеке; null — у вещи нет замеров */
  fitFor: (item: Item) => FitReport | null;
  /** профиль стиля из опроса; null — опрос пропущен или стёрт */
  style: StyleProfile | null;
  setStyle: (style: StyleProfile | null) => void;
  /** свои замеры вещи сантиметром (docs/spec-favorite-piece.md); null — стереть */
  setPieceFit: (id: string, fit: GarmentFit | null) => void;
  /** «сидит идеально»: одна любимая вещь на вид, новые вещи этого вида сравниваются с ней */
  setFavorite: (id: string, kind: GarmentKind, on: boolean) => void;
}

/** Что синхронизируется: только своё. Демо-вещи берутся из приложения — их картинки на другом устройстве не откроются */
interface ClosetDoc {
  closetAdded: Item[];
  tryOnAdded: Item[];
  /** какие демо-вещи остаются в примерке */
  tryOnDemo: string[];
  savedIds: string[];
  scans: ScanRef[];
  body: BodyMeasurements | null;
  showSize: boolean;
  style: StyleProfile | null;
  /** замеры сантиметром — и у своих, и у демо-вещей */
  measured: Record<string, GarmentFit>;
  /** любимая вещь на вид; вида нет — как в демо */
  favoriteByKind: Partial<Record<GarmentKind, string>>;
}

const StoreContext = createContext<Store | null>(null);
const ONBOARDED = 'twin.onboarded';
const KNOWN_SCANS = 'twin.knownScans';

const WAITING_KEY = 'Cut-out and tags come once the Meta key is connected';

// у демо-аккаунта параметры уже заполнены: посадка видна сразу
const freshDoc = (): ClosetDoc => ({ closetAdded: [], tryOnAdded: [], tryOnDemo: SHOP.map((i) => i.id), savedIds: LOOKS.map((l) => l.id), scans: [], body: DEMO_BODY, showSize: false, style: null, measured: {}, favoriteByKind: {} });

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
    // старый раздел без параметров — демо-цифры; стёртые (null) остаются стёртыми
    body: d.body === undefined ? fresh.body : cleanBody(d.body),
    showSize: d.showSize === true,
    style: cleanStyle(d.style),
    measured: cleanMeasured(d.measured),
    favoriteByKind: Object.fromEntries(Object.entries(d.favoriteByKind && typeof d.favoriteByKind === 'object' ? d.favoriteByKind : {}).filter(([k, v]) => (GARMENT_KINDS as readonly string[]).includes(k) && isStr(v))),
  };
}

const CUTS: FitCut[] = ['slim', 'regular', 'relaxed', 'wide', 'oversize'];

/** Свои замеры из памяти или с другого устройства: только известные зоны и числа */
function cleanMeasured(raw: unknown): Record<string, GarmentFit> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, GarmentFit> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const g = v as Partial<GarmentFit> | null;
    const zones = g?.sizes?.[0]?.zones;
    if (!g || !CUTS.includes(g.cut as FitCut) || !zones || typeof zones !== 'object') continue;
    const clean = Object.fromEntries(Object.entries(zones).filter(([z, n]) => (FIT_ZONES as readonly string[]).includes(z) && typeof n === 'number' && n > 0 && n < 250));
    if (Object.keys(clean).length) out[id] = { cut: g.cut as FitCut, stretch: g.stretch === true, size: 'Yours', source: 'tape', sizes: [{ size: 'Yours', zones: clean }] };
  }
  return out;
}

/** Ссылка на товар: живой магазин и номер товара узнаём сразу; страницу прочитает Muse Spark (веб-поиск), пока ждёт ключ */
export function linkPiece(url: string, host: string): Item {
  const known = storeOfUrl(url);
  const name = known ? `${LIVE_STORES[known.storeId].name}${known.productId ? ` · item ${known.productId}` : ''}` : host;
  return { id: `new-${Date.now()}`, name, meta: 'Muse Spark reads the product page once the Meta key is connected', kind: null, image: { uri: '' }, via: 'Link', pending: true, stage: 'waiting', shop: { price: null, url, storeId: known?.storeId ?? null, ref: known?.productId ?? null } };
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

  type AddedList = 'tryOnAdded' | 'closetAdded';
  const patchIn = (list: AddedList, id: string, p: Partial<Item>) => change((d) => ({ ...d, [list]: d[list].map((i) => (i.id === id ? { ...i, ...p } : i)) }));

  /** Следим за разбором вещи, пока задача не закончится (на любом устройстве с этим шкафом) */
  async function follow(id: string, jobId: string, via: Item['via'], list: AddedList = 'tryOnAdded') {
    const patchAdded = (itemId: string, p: Partial<Item>) => patchIn(list, itemId, p);
    if (following.current.has(jobId)) return;
    following.current.add(jobId);
    try {
      let framed = false;
      for (;;) {
        const j = await getJob(jobId);
        if (j.status === 'done' && j.result.item) {
          const ready = { ...garmentToItem(j.result.item, via), similar: j.result.similar?.map((s) => ({ id: s.garmentId, reason: s.reason })) };
          change((d) => ({ ...d, [list]: d[list].map((i) => (i.id === id ? ready : i)) }));
          return;
        }
        // ролик вещи: сервер выбрал кадры — на плитке самый резкий (он же главное фото задачи)
        const frame: Partial<Item> = !framed && j.result.keyframeTimes?.length ? { image: { uri: fileUrl(`/files/${jobId}.jpg`) } } : {};
        if (frame.image) framed = true;
        if (j.status === 'failed') {
          patchAdded(id, { ...frame, ...(j.errorCode === 'no_key' ? { stage: 'waiting', meta: WAITING_KEY } : { stage: 'failed', meta: j.error ?? 'Could not read this photo' }) });
          return;
        }
        patchAdded(id, { ...frame, meta: `${j.progress}…` });
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
    for (const i of doc.data.closetAdded) if (i.stage === 'working' && i.jobId) void follow(i.id, i.jobId, i.via, 'closetAdded');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.data.tryOnAdded, doc.data.closetAdded]);

  useEffect(() => writeSetting(KNOWN_SCANS, JSON.stringify(knownScans.slice(-30))), [knownScans]);

  const value = useMemo<Store>(() => {
    // свои замеры и выбор любимой вещи поверх демо и своих вещей
    const favorites = doc.data.favoriteByKind;
    const closet = [...doc.data.closetAdded, ...CLOSET].map((c) => ({ ...c, fit: doc.data.measured[c.id] ?? c.fit, favorite: c.kind && favorites[c.kind] !== undefined ? favorites[c.kind] === c.id : c.favorite }));
    const tryOn = [...SHOP.filter((i) => doc.data.tryOnDemo.includes(i.id)), ...doc.data.tryOnAdded, ...uploading];
    const all = [...closet, ...SHOP, ...tryOn];
    const item = (id: string) => all.find((i) => i.id === id);
    // с чем сравнить новую вещь и где искать её в магазине (страна — из «Мои магазины»)
    const importExtra = () => ({ closet: closet.filter((c) => !c.pending).map((c) => ({ id: c.id, title: `${c.name}${c.meta ? ` (${c.meta})` : ''}`.slice(0, 80), kind: c.kind, color: null })), country: readSetting('twin.country') ?? deviceCountry() });

    async function importAsset(asset: ImagePickerAsset, via: NonNullable<Item['via']>) {
      const id = `new-${Date.now()}`;
      // ролик картинкой не покажешь — плитка пустая, пока сервер не выберет кадр (follow)
      const video = asset.type === 'video';
      const draft: Item = { id, name: video ? 'New video' : via === 'Screenshot' ? 'New screenshot' : 'New in-store photo', meta: 'Uploading…', kind: null, image: { uri: video ? '' : asset.uri }, via, pending: true, stage: 'uploading', shop: { price: null, url: null } };
      setUploading((list) => [...list, draft]);
      try {
        const upload = await uploadAsset(asset);
        const job = await startJob('import_item', { uploadId: upload.id }, importExtra());
        // дальше — общая вещь: картинка с сервера, её видит и подключённое устройство
        const working: Item = { ...draft, image: video ? draft.image : { uri: fileUrl(upload.url) }, jobId: job.id, stage: 'working', meta: job.progress };
        setUploading((list) => list.filter((i) => i.id !== id));
        change((d) => ({ ...d, tryOnAdded: [...d.tryOnAdded.filter((i) => i.id !== id), working] }));
        void follow(id, job.id, via);
      } catch (e) {
        setUploading((list) => list.map((i) => (i.id === id ? { ...i, stage: 'failed', meta: e instanceof Error ? e.message : String(e) } : i)));
      }
    }

    async function importShots(shots: CapturedShot[], to: 'closet' | 'store') {
      const uploads = await Promise.all(shots.map((s, i) => uploadBlob(s.blob, `${s.view}-${i}.jpg`)));
      const job = await startJob('import_item', { shots: shots.map((s, i) => ({ uploadId: uploads[i].id, view: s.view })) }, importExtra());
      const main = uploads[Math.max(0, shots.findIndex((s) => s.view === 'front'))];
      const via = to === 'store' ? 'Scanned in store' : undefined;
      const item: Item = { id: `new-${Date.now()}`, name: to === 'store' ? 'New in-store piece' : 'New piece', meta: job.progress, kind: null, image: { uri: fileUrl(main.url) }, via, pending: true, stage: 'working', jobId: job.id, ...(to === 'store' ? { shop: { price: null, url: null } } : { isNew: true }) };
      const list: AddedList = to === 'store' ? 'tryOnAdded' : 'closetAdded';
      change((d) => ({ ...d, [list]: list === 'closetAdded' ? [item, ...d.closetAdded] : [...d.tryOnAdded, item] }));
      void follow(item.id, job.id, via, list);
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
      // ответ модели, если он есть; иначе — тот же вид вещи (демо-аккаунт и вещи до ключа)
      similarOwned: (it) => (it.similar ? closet.filter((c) => it.similar!.some((s) => s.id === c.id)) : it.kind ? closet.filter((c) => c.kind === it.kind && c.id !== it.id) : []),
      addToTryOn: (it) =>
        change((d) =>
          SHOP.some((s) => s.id === it.id)
            ? { ...d, tryOnDemo: [...d.tryOnDemo.filter((x) => x !== it.id), it.id] }
            : { ...d, tryOnAdded: [...d.tryOnAdded.filter((i) => i.id !== it.id), it] }
        ),
      importAsset: (asset, via) => void importAsset(asset, via),
      importShots,
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
      body: doc.data.body,
      setBody: (body) => change((d) => ({ ...d, body })),
      showSize: doc.data.showSize,
      setShowSize: (v) => change((d) => ({ ...d, showSize: v })),
      fitFor: (it) => {
        if (!it.fit) return null;
        const fav = closet.find((c) => c.favorite && c.fit && c.kind === it.kind && c.id !== it.id);
        return fitReport(it.kind, it.fit, { body: doc.data.body, showSize: doc.data.showSize, favorite: fav?.fit ? { name: fav.name.toLowerCase(), fit: fav.fit } : null });
      },
      style: doc.data.style,
      setStyle: (style) => change((d) => ({ ...d, style })),
      setPieceFit: (id, fit) =>
        change((d) => {
          const { [id]: _old, ...rest } = d.measured;
          return { ...d, measured: fit ? { ...rest, [id]: fit } : rest };
        }),
      // отметил другую — прежняя перестала быть любимой; снял отметку — у вида любимой нет вовсе (даже демо)
      setFavorite: (id, kind, on) => change((d) => ({ ...d, favoriteByKind: { ...d.favoriteByKind, [kind]: on ? id : '' } })),
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
