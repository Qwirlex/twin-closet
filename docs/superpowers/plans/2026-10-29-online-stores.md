# Online Stores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ASOS, Zalando, H&M, Shein, AliExpress and Temu work like Zara (search, price, price watch via Muse Spark web search), with one source of truth for live stores, product ids parsed from pasted links and honest sizing notes (spec: `docs/spec-online-stores.md`).

**Architecture:** New `packages/shared/src/stores.ts` owns `LIVE_STORES` (names, all domains, type, sizing note, product-id pattern) and host/URL helpers; `index.ts` re-exports the old `LIVE_STORE_IDS` / `LIVE_STORE_DOMAINS` from it. Server and app read live flags, names and domain checks from it.

**Tech Stack:** TypeScript, vitest, Hono, Expo Router.

---

### Task 1: Shared store registry (TDD)

**Files:** Create `packages/shared/src/stores.ts`; Modify `packages/shared/src/index.ts` (remove the old constants, `export * from './stores'`); Test `server/test/stores.test.ts`.

- [ ] Failing tests: registry completeness; `isStoreHost('zalando','www.zalando.ie')` true, `('zalando','zalando.evil.com')` false, `('asos','asos.com.evil.io')` false, `('h-and-m','www2.hm.com')` true, `('shein','ie.shein.com')` true; `storeOfUrl` for
  `https://www.asos.com/asos-design/x/prd/205123456` → `{ storeId: 'asos', productId: '205123456' }`,
  `https://www.zalando.ie/levis-501-straight-le221n0ab-k11.html` → `LE221N0AB-K11`,
  `https://www2.hm.com/en_gb/productpage.1234567001.html` → `1234567001`,
  `https://ie.shein.com/Men-Sweatshirt-p-12345678.html` → `12345678`,
  `https://www.aliexpress.com/item/1005006123456789.html` → `1005006123456789`,
  `https://www.temu.com/ie/mens-jacket-g-601099512345678.html` → `601099512345678`,
  `https://www.zara.com/ie/en/wide-leg-jeans-p04048213.html` → `04048213`,
  `https://www.bershka.com/ie/jeans-c0p123.html` → `{ storeId: 'bershka', productId: null }`,
  `https://example.com/x` → `null`, `not a url` → `null`.
- [ ] Implement, run → PASS.

### Task 2: Server uses the registry

**Files:** `server/src/jobs.ts` (`STORE_NAMES` from registry, live check, `onStore` via `isStorePage`), `server/src/watch.ts` (`sameStorePage` → `isStorePage`), `server/src/models/spark.ts` (`findProduct(store: LiveStore)` with type rules and all domains, `storeSale(store: LiveStore)`, `storeLinks(raw, storeId)`), `server/test/models.test.ts` (calls with `LIVE_STORES.zara`).

- [ ] Tests: `storeLinks` for zalando keeps a zalando.ie citation and drops zalando.evil.com; `findProduct(LIVE_STORES.temu).system` mentions sellers and `temu.com`; `product_lookup` for `temu` starts and ends `no_key`, `mango` → 404 "coming soon".
- [ ] Implement, all server tests → PASS.

### Task 3: App

**Files:** `app/src/data/stores.ts` (`live: isLiveStore(id)`), `app/src/app/stores.tsx` (live list text from registry), `app/src/lib/shopping.tsx` (`DEFAULT_FAVORITES = ['zara','bershka','pull-and-bear']`), `app/src/app/(tabs)/try.tsx` + `app/src/lib/store.tsx` (`linkPiece` uses `storeOfUrl`), sizing note on try-on cards and wishlist detail.

- [ ] `cd app && npx tsc --noEmit`; browser: Stores shows 9 Live, ASOS link → "ASOS · item 205123456", Shein link shows sizing note.

### Task 4: Verify and commit

- [ ] `npm test -w @twin/server`, `npm run typecheck`; commit `Stores: ASOS, Zalando, H&M, Shein, AliExpress, Temu live; one store registry`.
