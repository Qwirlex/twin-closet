import type { StyleId } from '@twin/shared';

import type { Pic } from '@/data/demo';

// Фото стилей для опроса: по одному мужскому (m) и женскому (w) образу на стиль, студийный тёмный фон.
// Файл собирается скриптом из assets/demo/style_<id>_<m|w>.webp — правьте картинки, а не список

export type Wear = 'men' | 'women' | 'all';

const PICS: Partial<Record<StyleId, { m?: Pic; w?: Pic }>> = {
  acubi: { m: require('@/assets/demo/style_acubi_m.webp'), w: require('@/assets/demo/style_acubi_w.webp') },
  amekaji: { m: require('@/assets/demo/style_amekaji_m.webp'), w: require('@/assets/demo/style_amekaji_w.webp') },
  archive: { m: require('@/assets/demo/style_archive_m.webp'), w: require('@/assets/demo/style_archive_w.webp') },
  athleisure: { m: require('@/assets/demo/style_athleisure_m.webp'), w: require('@/assets/demo/style_athleisure_w.webp') },
  baddie: { w: require('@/assets/demo/style_baddie_w.webp') },
  balletcore: { w: require('@/assets/demo/style_balletcore_w.webp') },
  blokecore: { m: require('@/assets/demo/style_blokecore_m.webp') },
  boho: { m: require('@/assets/demo/style_boho_m.webp'), w: require('@/assets/demo/style_boho_w.webp') },
  city_boy: { m: require('@/assets/demo/style_city_boy_m.webp'), w: require('@/assets/demo/style_city_boy_w.webp') },
  clean_girl: { w: require('@/assets/demo/style_clean_girl_w.webp') },
  coastal: { m: require('@/assets/demo/style_coastal_m.webp'), w: require('@/assets/demo/style_coastal_w.webp') },
  coquette: { w: require('@/assets/demo/style_coquette_w.webp') },
  cottagecore: { m: require('@/assets/demo/style_cottagecore_m.webp'), w: require('@/assets/demo/style_cottagecore_w.webp') },
  cyberpunk: { m: require('@/assets/demo/style_cyberpunk_m.webp'), w: require('@/assets/demo/style_cyberpunk_w.webp') },
  dark_academia: { m: require('@/assets/demo/style_dark_academia_m.webp'), w: require('@/assets/demo/style_dark_academia_w.webp') },
  dark_avant: { m: require('@/assets/demo/style_dark_avant_m.webp'), w: require('@/assets/demo/style_dark_avant_w.webp') },
  eclectic_grandpa: { m: require('@/assets/demo/style_eclectic_grandpa_m.webp'), w: require('@/assets/demo/style_eclectic_grandpa_w.webp') },
  fairycore: { w: require('@/assets/demo/style_fairycore_w.webp') },
  glamoratti: { m: require('@/assets/demo/style_glamoratti_m.webp'), w: require('@/assets/demo/style_glamoratti_w.webp') },
  gorpcore: { m: require('@/assets/demo/style_gorpcore_m.webp'), w: require('@/assets/demo/style_gorpcore_w.webp') },
  goth: { m: require('@/assets/demo/style_goth_m.webp'), w: require('@/assets/demo/style_goth_w.webp') },
  grunge: { m: require('@/assets/demo/style_grunge_m.webp'), w: require('@/assets/demo/style_grunge_w.webp') },
  harajuku: { m: require('@/assets/demo/style_harajuku_m.webp'), w: require('@/assets/demo/style_harajuku_w.webp') },
  hiphop_90s: { m: require('@/assets/demo/style_hiphop_90s_m.webp'), w: require('@/assets/demo/style_hiphop_90s_w.webp') },
  indie_sleaze: { m: require('@/assets/demo/style_indie_sleaze_m.webp'), w: require('@/assets/demo/style_indie_sleaze_w.webp') },
  ivy_prep: { m: require('@/assets/demo/style_ivy_prep_m.webp'), w: require('@/assets/demo/style_ivy_prep_w.webp') },
  japanese_minimal: { m: require('@/assets/demo/style_japanese_minimal_m.webp'), w: require('@/assets/demo/style_japanese_minimal_w.webp') },
  japanese_workwear: { m: require('@/assets/demo/style_japanese_workwear_m.webp'), w: require('@/assets/demo/style_japanese_workwear_w.webp') },
  khaki_coded: { m: require('@/assets/demo/style_khaki_coded_m.webp'), w: require('@/assets/demo/style_khaki_coded_w.webp') },
  light_academia: { m: require('@/assets/demo/style_light_academia_m.webp'), w: require('@/assets/demo/style_light_academia_w.webp') },
  maximalist: { m: require('@/assets/demo/style_maximalist_m.webp'), w: require('@/assets/demo/style_maximalist_w.webp') },
  military: { m: require('@/assets/demo/style_military_m.webp'), w: require('@/assets/demo/style_military_w.webp') },
  mob_wife: { w: require('@/assets/demo/style_mob_wife_w.webp') },
  mod: { m: require('@/assets/demo/style_mod_m.webp'), w: require('@/assets/demo/style_mod_w.webp') },
  nineties_minimal: { m: require('@/assets/demo/style_nineties_minimal_m.webp'), w: require('@/assets/demo/style_nineties_minimal_w.webp') },
  normcore: { m: require('@/assets/demo/style_normcore_m.webp'), w: require('@/assets/demo/style_normcore_w.webp') },
  office_siren: { w: require('@/assets/demo/style_office_siren_w.webp') },
  old_money: { m: require('@/assets/demo/style_old_money_m.webp'), w: require('@/assets/demo/style_old_money_w.webp') },
  opium: { m: require('@/assets/demo/style_opium_m.webp'), w: require('@/assets/demo/style_opium_w.webp') },
  parisian: { m: require('@/assets/demo/style_parisian_m.webp'), w: require('@/assets/demo/style_parisian_w.webp') },
  poetcore: { m: require('@/assets/demo/style_poetcore_m.webp'), w: require('@/assets/demo/style_poetcore_w.webp') },
  punk: { m: require('@/assets/demo/style_punk_m.webp'), w: require('@/assets/demo/style_punk_w.webp') },
  rockabilly: { m: require('@/assets/demo/style_rockabilly_m.webp'), w: require('@/assets/demo/style_rockabilly_w.webp') },
  romantic: { m: require('@/assets/demo/style_romantic_m.webp'), w: require('@/assets/demo/style_romantic_w.webp') },
  run_club: { m: require('@/assets/demo/style_run_club_m.webp'), w: require('@/assets/demo/style_run_club_w.webp') },
  scandi_minimal: { m: require('@/assets/demo/style_scandi_minimal_m.webp'), w: require('@/assets/demo/style_scandi_minimal_w.webp') },
  seventies: { m: require('@/assets/demo/style_seventies_m.webp'), w: require('@/assets/demo/style_seventies_w.webp') },
  skater: { m: require('@/assets/demo/style_skater_m.webp'), w: require('@/assets/demo/style_skater_w.webp') },
  soft_boy: { m: require('@/assets/demo/style_soft_boy_m.webp') },
  sport_chic: { m: require('@/assets/demo/style_sport_chic_m.webp'), w: require('@/assets/demo/style_sport_chic_w.webp') },
  sprezzatura: { m: require('@/assets/demo/style_sprezzatura_m.webp'), w: require('@/assets/demo/style_sprezzatura_w.webp') },
  streetwear: { m: require('@/assets/demo/style_streetwear_m.webp'), w: require('@/assets/demo/style_streetwear_w.webp') },
  techwear: { m: require('@/assets/demo/style_techwear_m.webp'), w: require('@/assets/demo/style_techwear_w.webp') },
  tenniscore: { m: require('@/assets/demo/style_tenniscore_m.webp'), w: require('@/assets/demo/style_tenniscore_w.webp') },
  western: { m: require('@/assets/demo/style_western_m.webp'), w: require('@/assets/demo/style_western_w.webp') },
  whimsigoth: { w: require('@/assets/demo/style_whimsigoth_w.webp') },
  workwear: { m: require('@/assets/demo/style_workwear_m.webp'), w: require('@/assets/demo/style_workwear_w.webp') },
  y2k: { m: require('@/assets/demo/style_y2k_m.webp'), w: require('@/assets/demo/style_y2k_w.webp') },
  y3k: { m: require('@/assets/demo/style_y3k_m.webp'), w: require('@/assets/demo/style_y3k_w.webp') },
};

/** Фото стиля: мужское или женское по выбору; «All» — по очереди; нет нужного — берём другое */
export function stylePic(id: StyleId, wear: Wear, index: number): Pic | undefined {
  const p = PICS[id];
  if (!p) return undefined;
  const women = wear === 'women' || (wear === 'all' && index % 2 === 1);
  return women ? (p.w ?? p.m) : (p.m ?? p.w);
}
