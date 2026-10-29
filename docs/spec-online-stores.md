# Спека: онлайн и дешёвые магазины (без ключа)

План — PLAN.md §1.2 Г. Пользователь 29.10: «без ключа делай по порядку всё, спека → план → реализация, с проверкой».

## Что есть сейчас

- Живые магазины — Zara, Bershka, Pull & Bear (`LIVE_STORE_IDS` в shared). ASOS, Zalando, H&M, Shein, AliExpress, Temu
  в списке брендов с меткой «Coming soon»: их можно отметить любимыми, но поиск, цена и слежка выключены.
- Сайт магазина проверяется по **одному** домену (`LIVE_STORE_DOMAINS`), а у Zalando свой домен на каждую страну
  (zalando.ie, zalando.de, zalando.pl…), у Shein — поддомены стран (ie.shein.com) и shein.co.uk.
- Метка «Live» в приложении задана руками в `app/src/data/stores.ts` отдельно от сервера — легко разойтись.
- «Try on → Link»: вставленная ссылка становится карточкой с именем сайта («asos.com»), магазин и номер товара
  не распознаются.

## Цель

Шесть онлайн-магазинов работают так же, как Zara: поиск вещи по описанию или номеру, цена, ссылка, слежка за ценой
(всё через Muse Spark `web_search`, без роботов на сайтах). В дешёвом сегменте человек заранее знает про размеры:
«размеры маломерят — сравни таблицу в сантиметрах».

## 1. Один источник правды — `packages/shared/src/stores.ts`

```ts
type StoreType = 'brand' | 'multibrand' | 'marketplace'
interface LiveStore { id; name; domains: string[]; type: StoreType; sizing: string | null; productPath: RegExp | null }
LIVE_STORE_IDS = ['zara', 'bershka', 'pull-and-bear', 'asos', 'zalando', 'h-and-m', 'shein', 'aliexpress', 'temu']
LIVE_STORES: Record<LiveStoreId, LiveStore>
isLiveStore(id), isStoreHost(id, host), isStorePage(url, id), storeOfUrl(url) → { storeId, productId } | null
LIVE_STORE_DOMAINS — главный домен (как раньше, для подсказок модели)
```

- **Домены**: zara.com, bershka.com, pullandbear.com, asos.com, hm.com; zalando — все страновые домены Zalando;
  shein.com и shein.co.uk; aliexpress.com и aliexpress.us; temu.com. Совпадение — сам домен или его поддомен
  (`www2.hm.com`, `ie.shein.com`); `asos.com.evil.io` и `zalando.evil.com` — нет.
- **Номер товара из ссылки** (`productPath`): ASOS `/prd/<цифры>`, Zalando `<артикул>.html` (например `LE221N0AB-K11`),
  H&M `productpage.<цифры>.html`, Shein `-p-<цифры>`, AliExpress `/item/<цифры>.html`, Temu `-g-<цифры>.html`,
  Zara `-p<8 цифр>.html`. Для Bershka и Pull & Bear формат не проверен — номер не достаём, магазин узнаём по домену.
- **Размеры** (`sizing`, честно и без чисел, которых не знаем):
  - Shein: «Sizes often run small and change from item to item — compare the size chart in cm, not the letter.»
  - AliExpress, Temu: «Every seller has its own chart, often Asian sizing that runs one or two sizes small — check it in cm.»
  - ASOS, Zalando: «Many brands, each with its own size chart — check the chart of this brand.»
  - Zara, Bershka, Pull & Bear, H&M: нет пометки.

## 2. Сервер

- `STORE_NAMES`, проверки «живой ли магазин» и «страница этого магазина» — из `LIVE_STORES` (jobs.ts, watch.ts,
  `storeLinks` в spark.ts принимает id магазина и пропускает все его домены).
- `findProduct(store)` знает тип магазина и все домены:
  - marketplace: «одну вещь продают многие продавцы — бери страницу товара с большим числом заказов и хорошими
    отзывами; только страницы товара (/item/…, -g-…), не поиск и не магазины продавцов»;
  - multibrand: «ищи бренд + модель; страница товара этого магазина»;
  - домены перечислены все: «Only product pages on zalando.ie, zalando.de, … count».
- Слежка за ценой и «идёт ли распродажа» — без изменений, теперь и для новых магазинов.

## 3. Приложение

- `live` у брендов в `app/src/data/stores.ts` берётся из `LIVE_STORE_IDS` (руками больше не ставим).
- Экран Stores: строка «Live: Zara, Bershka, … Temu» собирается из списка; любимые по умолчанию — прежние три.
- **Try on → Link**: `storeOfUrl` → карточка «ASOS · item 205123456» с магазином и номером (`shop.storeId`, `shop.ref`);
  чужой сайт — как раньше, по имени сайта. С ключом по номеру сразу ищется цена.
- **Пометка о размерах** (`sizing`): на карточке вещи в Try on и в вишлисте рядом с магазином.

## Не делаем

- Не ходим на сайты и во внутренние API магазинов — только веб-поиск Muse Spark (как для Zara).
- Наличие размера: без браузера его часто не видно — честно «check stock on the store page» со ссылкой.
- Как Spark находит вещи на AliExpress и Temu, проверим с ключом (риск: мало страниц товара в выдаче поиска).

## Проверка

- Тесты (`server/test/stores.test.ts`): у всех живых магазинов есть домены и имя; `isStoreHost` — страновые
  домены Zalando, поддомены H&M и Shein да, подделки нет; `storeOfUrl` достаёт номер для ASOS, Zalando, H&M, Shein,
  AliExpress, Temu, Zara; Bershka — магазин без номера; чужой сайт → null; `storeLinks` для zalando пропускает
  zalando.ie; задача `product_lookup` для `temu` начинается (ждёт ключ), для `mango` — «coming soon».
- Существующие тесты слежки за ценой проходят без изменений.
- В браузере: Stores — шесть новых «Live», вставка ссылки ASOS → «ASOS · item …» и пометка о размерах у Shein.
