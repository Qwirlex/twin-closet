import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CLOSET, LOOKS, OWN_LOOKS, SHOP, type DemoLook, type Item } from '@/data/demo';
import { readSetting, writeSetting } from '@/lib/storage';

// Состояние приложения на демо-данных. Когда сервер начнёт сканировать и примерять,
// эти же действия будут ходить в API, а экраны останутся как есть.

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
  removeFromTryOn: (id: string) => void;
  toggleSaved: (lookId: string) => void;
  setOnboarded: (value: boolean) => void;
}

const StoreContext = createContext<Store | null>(null);
const ONBOARDED = 'twin.onboarded';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tryOn, setTryOn] = useState<Item[]>(SHOP);
  const [savedIds, setSavedIds] = useState<string[]>(LOOKS.map((l) => l.id));
  const [onboarded, setOnboardedState] = useState(() => readSetting(ONBOARDED) === '1');

  const value = useMemo<Store>(() => {
    const all = [...CLOSET, ...SHOP, ...tryOn];
    const item = (id: string) => all.find((i) => i.id === id);
    return {
      closet: CLOSET,
      tryOn,
      savedIds,
      onboarded,
      item,
      looksForTryOn: () => {
        const ready = new Set(tryOn.filter((i) => !i.pending).map((i) => i.id));
        return LOOKS.filter((l) => l.itemIds.some((id) => ready.has(id)));
      },
      look: (id) => [...LOOKS, ...OWN_LOOKS].find((l) => l.id === id),
      similarOwned: (it) => (it.kind ? CLOSET.filter((c) => c.kind === it.kind && c.id !== it.id) : []),
      addToTryOn: (it) => setTryOn((list) => [...list.filter((i) => i.id !== it.id), it]),
      removeFromTryOn: (id) => setTryOn((list) => list.filter((i) => i.id !== id)),
      toggleSaved: (lookId) => setSavedIds((ids) => (ids.includes(lookId) ? ids.filter((x) => x !== lookId) : [...ids, lookId])),
      setOnboarded: (v) => {
        setOnboardedState(v);
        writeSetting(ONBOARDED, v ? '1' : null);
      },
    };
  }, [tryOn, savedIds, onboarded]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore вне StoreProvider');
  return value;
}
