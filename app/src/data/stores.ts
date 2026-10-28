import type { StoreBrand } from '@twin/shared';

// Популярные бренды одежды. Названия, Wikidata и страны — Name Suggestion Index (OpenStreetMap, BSD-3),
// официальные сайты вписаны вручную. '001' — бренд есть по всему миру. Онлайн-магазины добавлены вручную.
export const STORES: StoreBrand[] = [
  { id: 'zara', name: 'Zara', domain: 'zara.com', wikidata: 'Q147662', countries: ['001'], live: true },
  { id: 'bershka', name: 'Bershka', domain: 'bershka.com', wikidata: 'Q827258', countries: ['001'], live: true },
  { id: 'pull-and-bear', name: 'Pull & Bear', domain: 'pullandbear.com', wikidata: 'Q691029', countries: ['001'], live: true },
  { id: 'stradivarius', name: 'Stradivarius', domain: 'stradivarius.com', wikidata: 'Q3322945', countries: ['001'], live: false },
  { id: 'massimo-dutti', name: 'Massimo Dutti', domain: 'massimodutti.com', wikidata: 'Q788231', countries: ['001'], live: false },
  { id: 'oysho', name: 'Oysho', domain: 'oysho.com', wikidata: 'Q3327046', countries: ['001'], live: false },
  { id: 'lefties', name: 'Lefties', domain: 'lefties.com', wikidata: 'Q12391713', countries: ['ES', 'IC', 'MX', 'PT'], live: false },
  { id: 'h-and-m', name: 'H&M', domain: 'hm.com', wikidata: 'Q188326', countries: ['001'], live: false },
  { id: 'cos', name: 'COS', domain: 'cos.com', wikidata: 'Q60772401', countries: ['001'], live: false },
  { id: '-and--other-stories', name: '& Other Stories', domain: 'stories.com', wikidata: 'Q85322338', countries: ['001'], live: false },
  { id: 'weekday', name: 'Weekday', domain: 'weekday.com', wikidata: 'Q10719514', countries: ['150'], live: false },
  { id: 'monki', name: 'Monki', domain: 'monki.com', wikidata: 'Q10588271', countries: ['001'], live: false },
  { id: 'mango', name: 'Mango', domain: 'mango.com', wikidata: 'Q136503', countries: ['001'], live: false },
  { id: 'uniqlo', name: 'Uniqlo', domain: 'uniqlo.com', wikidata: 'Q26070', countries: ['001'], live: false },
  { id: 'primark', name: 'Primark', domain: 'primark.com', wikidata: 'Q137023', countries: ['001'], live: false },
  { id: 'penneys', name: 'Penneys', domain: 'primark.com', wikidata: 'Q137023', countries: ['IE'], live: false },
  { id: 'gap', name: 'Gap', domain: 'gap.com', wikidata: 'Q420822', countries: ['001'], live: false },
  { id: 'levis', name: "Levi's", domain: 'levi.com', wikidata: 'Q127962', countries: ['001'], live: false },
  { id: 'tommy-hilfiger', name: 'Tommy Hilfiger', domain: 'tommy.com', wikidata: 'Q634881', countries: ['001'], live: false },
  { id: 'calvin-klein', name: 'Calvin Klein', domain: 'calvinklein.com', wikidata: 'Q1068628', countries: ['001'], live: false },
  { id: 'lacoste', name: 'Lacoste', domain: 'lacoste.com', wikidata: 'Q309031', countries: ['001'], live: false },
  { id: 'guess', name: 'Guess', domain: 'guess.com', wikidata: 'Q2470307', countries: ['001'], live: false },
  { id: 'superdry', name: 'Superdry', domain: 'superdry.com', wikidata: 'Q1684445', countries: ['001'], live: false },
  { id: 'next', name: 'Next', domain: 'next.co.uk', wikidata: 'Q246655', countries: ['001'], live: false },
  { id: 'river-island', name: 'River Island', domain: 'riverisland.com', wikidata: 'Q2670328', countries: ['GB', 'IE', 'IM', 'NL', 'PL'], live: false },
  { id: 'new-look', name: 'New Look', domain: 'newlook.com', wikidata: 'Q12063852', countries: ['BE', 'DE', 'FX', 'GB', 'IE', 'PL'], live: false },
  { id: 'reserved', name: 'Reserved', domain: 'reserved.com', wikidata: 'Q21809354', countries: ['001'], live: false },
  { id: 'sinsay', name: 'Sinsay', domain: 'sinsay.com', wikidata: 'Q107410579', countries: ['001'], live: false },
  { id: 'cropp', name: 'Cropp', domain: 'cropp.com', wikidata: 'Q9196793', countries: ['BA', 'BG', 'CZ', 'EE', 'FI', 'HR', 'HU', 'KZ', 'LT', 'LV', 'PL', 'RO', 'RS', 'SI', 'SK', 'UA'], live: false },
  { id: 'house', name: 'House', domain: 'housebrand.com', wikidata: 'Q9294202', countries: ['BA', 'BG', 'CZ', 'EE', 'FI', 'HR', 'HU', 'KZ', 'LT', 'LV', 'PL', 'RO', 'RS', 'SI', 'SK', 'UA'], live: false },
  { id: 'mohito', name: 'Mohito', domain: 'mohito.com', wikidata: 'Q107410616', countries: ['BA', 'BG', 'CZ', 'EE', 'FI', 'HU', 'KZ', 'LT', 'LV', 'PL', 'RO', 'RS', 'SI', 'SK', 'UA'], live: false },
  { id: 'c-and-a', name: 'C&A', domain: 'c-and-a.com', wikidata: 'Q701338', countries: ['001'], live: false },
  { id: 'jack-and-jones', name: 'Jack & Jones', domain: 'jackjones.com', wikidata: 'Q6077665', countries: ['001'], live: false },
  { id: 'only', name: 'Only', domain: 'only.com', wikidata: 'Q12329792', countries: ['001'], live: false },
  { id: 'vero-moda', name: 'Vero Moda', domain: 'veromoda.com', wikidata: 'Q640418', countries: ['001'], live: false },
  { id: 'urban-outfitters', name: 'Urban Outfitters', domain: 'urbanoutfitters.com', wikidata: 'Q3552193', countries: ['001'], live: false },
  { id: 'abercrombie-and-fitch', name: 'Abercrombie & Fitch', domain: 'abercrombie.com', wikidata: 'Q319344', countries: ['AE', 'BE', 'CA', 'CN', 'DE', 'ES', 'FX', 'GB', 'IE', 'IT', 'JP', 'KW', 'MX', 'NL', 'QA', 'SA', 'SG', 'US'], live: false },
  { id: 'hollister', name: 'Hollister', domain: 'hollisterco.com', wikidata: 'Q1257477', countries: ['001'], live: false },
  { id: 'forever-21', name: 'Forever 21', domain: 'forever21.com', wikidata: 'Q1060537', countries: ['001'], live: false },
  { id: 'tezenis', name: 'Tezenis', domain: 'tezenis.com', wikidata: 'Q28056374', countries: ['001'], live: false },
  { id: 'calzedonia', name: 'Calzedonia', domain: 'calzedonia.com', wikidata: 'Q1027874', countries: ['001'], live: false },
  { id: 'intimissimi', name: 'Intimissimi', domain: 'intimissimi.com', wikidata: 'Q305404', countries: ['001'], live: false },
  { id: 'desigual', name: 'Desigual', domain: 'desigual.com', wikidata: 'Q83750', countries: ['001'], live: false },
  { id: 'united-colors-of-benetton', name: 'United Colors of Benetton', domain: 'benetton.com', wikidata: 'Q817139', countries: ['001'], live: false },
  { id: 'diesel', name: 'Diesel', domain: 'diesel.com', wikidata: 'Q158285', countries: ['001'], live: false },
  { id: 'esprit', name: 'Esprit', domain: 'esprit.com', wikidata: 'Q532746', countries: ['001'], live: false },
  { id: 'soliver', name: 's.Oliver', domain: 'soliver.com', wikidata: 'Q265056', countries: ['150', 'CN', 'IN'], live: false },
  { id: 'tom-tailor', name: 'Tom Tailor', domain: 'tom-tailor.com', wikidata: 'Q571206', countries: ['001'], live: false },
  { id: 'pepe-jeans', name: 'Pepe Jeans', domain: 'pepejeans.com', wikidata: 'Q426992', countries: ['001'], live: false },
  { id: 'springfield', name: 'Springfield', domain: 'springfield.com', wikidata: 'Q958209', countries: ['001'], live: false },
  { id: 'lc-waikiki', name: 'LC Waikiki', domain: 'lcwaikiki.com', wikidata: 'Q3205965', countries: ['001'], live: false },
  { id: 'koton', name: 'Koton', domain: 'koton.com', wikidata: 'Q6063877', countries: ['001'], live: false },
  { id: 'defacto', name: 'DeFacto', domain: 'defacto.com', wikidata: 'Q6059861', countries: ['001'], live: false },
  { id: 'promod', name: 'Promod', domain: 'promod.com', wikidata: 'Q3407429', countries: ['001'], live: false },
  { id: 'kiabi', name: 'Kiabi', domain: 'kiabi.com', wikidata: 'Q3196299', countries: ['001'], live: false },
  { id: 'celio', name: 'Celio', domain: 'celio.com', wikidata: 'Q2672003', countries: ['001'], live: false },
  { id: 'pimkie', name: 'Pimkie', domain: 'pimkie.com', wikidata: 'Q1758066', countries: ['AT', 'BE', 'DE', 'ES', 'FR', 'IT'], live: false },
  { id: 'matalan', name: 'Matalan', domain: 'matalan.co.uk', wikidata: 'Q12061509', countries: ['AE', 'GB'], live: false },
  { id: 'kik', name: 'KiK', domain: 'kik.de', wikidata: 'Q883965', countries: ['AT', 'BG', 'CZ', 'DE', 'ES', 'HR', 'HU', 'IT', 'NL', 'PL', 'PT', 'RO', 'SI', 'SK'], live: false },
  { id: 'peek-and-cloppenburg', name: 'Peek & Cloppenburg', domain: 'peek-cloppenburg.com', wikidata: 'Q2066959', countries: ['AT', 'BE', 'DE', 'NL', 'PL', 'SK'], live: false },
  { id: 'asos', name: 'ASOS', domain: 'asos.com', wikidata: null, countries: ['001'], live: false },
  { id: 'zalando', name: 'Zalando', domain: 'zalando.com', wikidata: null, countries: ['001'], live: false },
  { id: 'about-you', name: 'About You', domain: 'aboutyou.com', wikidata: null, countries: ['001'], live: false },
];

/** Страны для выбора региона: названия по-английски, как во всём приложении */
export const COUNTRIES: { code: string; name: string }[] = [
  ['IE', 'Ireland'], ['GB', 'United Kingdom'], ['UA', 'Ukraine'], ['PL', 'Poland'], ['DE', 'Germany'], ['FR', 'France'],
  ['ES', 'Spain'], ['PT', 'Portugal'], ['IT', 'Italy'], ['NL', 'Netherlands'], ['BE', 'Belgium'], ['AT', 'Austria'],
  ['CZ', 'Czechia'], ['SK', 'Slovakia'], ['HU', 'Hungary'], ['RO', 'Romania'], ['BG', 'Bulgaria'], ['HR', 'Croatia'],
  ['LT', 'Lithuania'], ['LV', 'Latvia'], ['EE', 'Estonia'], ['FI', 'Finland'], ['SE', 'Sweden'], ['NO', 'Norway'],
  ['DK', 'Denmark'], ['GR', 'Greece'], ['TR', 'Türkiye'], ['KZ', 'Kazakhstan'], ['AE', 'United Arab Emirates'],
  ['US', 'United States'], ['CA', 'Canada'], ['MX', 'Mexico'], ['AU', 'Australia'],
].map(([code, name]) => ({ code, name }));

export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

/** Регион телефона (en-IE → IE); если не понять — Ирландия */
export function deviceCountry(): string {
  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).maximize().region;
    if (region && COUNTRIES.some((c) => c.code === region)) return region;
  } catch {
    // старый движок без Intl.Locale
  }
  return 'IE';
}

/** Сначала бренды этой страны, потом мировые; живые магазины — первыми в каждой группе */
export function storesFor(country: string): { local: StoreBrand[]; worldwide: StoreBrand[] } {
  const byLive = (a: StoreBrand, b: StoreBrand) => Number(b.live) - Number(a.live);
  return {
    local: STORES.filter((s) => s.countries.includes(country)).sort(byLive),
    worldwide: STORES.filter((s) => s.countries.includes('001')).sort(byLive),
  };
}

export const storeById = (id: string | null | undefined) => STORES.find((s) => s.id === id);
