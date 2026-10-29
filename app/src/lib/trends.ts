import { CURATED_TRENDS, trendHits, type Trend, type TrendDigest } from '@twin/shared';
import { useEffect, useState } from 'react';

import type { Item } from '@/data/demo';
import { getTrends } from '@/lib/api';
import { useShopping } from '@/lib/shopping';
import { readSetting } from '@/lib/storage';

// Тренды сезона (docs/spec-trends.md): с сервера по стране человека; сервера нет — выжимка из shared, экран не пустеет

let cache: { country: string; digest: TrendDigest } | null = null;

export function useTrends(): TrendDigest {
  const { country } = useShopping();
  const [digest, setDigest] = useState<TrendDigest>(() => (cache?.country === country ? cache.digest : CURATED_TRENDS));
  useEffect(() => {
    if (cache?.country === country) return setDigest(cache.digest);
    let alive = true;
    getTrends(country)
      .then((d) => {
        if (!alive || !Array.isArray(d?.trends) || !d.trends.length) return;
        cache = { country, digest: d };
        setDigest(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [country]);
  return digest;
}

/** Чьи образы смотрел в опросе стиля: мужские (по умолчанию), женские или все */
export function wearOf(): 'men' | 'women' | 'all' {
  const w = readSetting('twin.wear');
  return w === 'women' || w === 'all' ? w : 'men';
}

export const itemText = (i: Pick<Item, 'name' | 'meta'>): string => `${i.name} ${i.meta}`;

/** Какие тренды есть в вещах (без повторов) */
export function trendsIn(items: Pick<Item, 'name' | 'meta'>[], digest: TrendDigest): Trend[] {
  return [...new Map(items.flatMap((i) => trendHits(itemText(i), digest)).map((t) => [t.id, t])).values()];
}
