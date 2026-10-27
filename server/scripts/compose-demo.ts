// Проверка склейки примерки на настоящих фото без SAM: маски грубые — человек по отличию от фона студии,
// голова — верх фигуры. С ключом маски дадут SAM 3.1, а склейка останется той же.
// Запуск: npx tsx scripts/compose-demo.ts <фото> <генерация> <папка для результата>
import sharp from 'sharp'
import { composeTryOn } from '../src/tryon/compose'
import { bbox, binary, blur, dilate, erode, map, mask, readImg, writeImg, writeMask, type Img, type Mask } from '../src/tryon/raster'

/** Человек на студийном фоне: фон в каждой строке оцениваем по краям кадра */
function personMask(img: Img): Mask {
  const { width: w, height: h } = img
  const m = mask(w, h)
  const edge = Math.round(w * 0.06)
  for (let y = 0; y < h; y++) {
    const bg = [0, 0, 0]
    let n = 0
    for (const x of [...Array(edge).keys(), ...[...Array(edge).keys()].map((k) => w - 1 - k)]) {
      for (let c = 0; c < 3; c++) bg[c] += img.data[(y * w + x) * 3 + c]
      n++
    }
    for (let x = 0; x < w; x++) {
      let d = 0
      for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(img.data[(y * w + x) * 3 + c] - bg[c] / n))
      m.data[y * w + x] = d > 14 ? 1 : 0
    }
  }
  // закрываем дырки и убираем шум
  const clean = binary(blur(erode(dilate(erode(m, 1), 6), 5), 2))
  // пол у края кадра светлее фона: оставляем только столбцы, где фигура есть в верхних 70% кадра
  let x0 = w, x1 = 0
  for (let y = 0; y < h * 0.7; y++) for (let x = 0; x < w; x++) if (clean.data[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x) }
  return map(clean, (v, i) => ((i % w) >= x0 - 12 && (i % w) <= x1 + 12 ? v : 0))
}

/**
 * Голова — верх фигуры до подбородка, но только узкая колонка по центру (как маска face + hair от SAM),
 * чтобы плечи остались в зоне одежды; одежда — остальной силуэт
 */
function split(person: Mask): { head: Mask; clothes: Mask } {
  const b = bbox(person)!
  const cut = b.y0 + Math.round((b.y1 - b.y0) * 0.13)
  const cx = (b.x0 + b.x1) / 2
  const half = (b.x1 - b.x0) * 0.17
  const head = map(person, (v, i) => {
    const x = i % person.width
    return Math.floor(i / person.width) < cut && Math.abs(x - cx) < half ? v : 0
  })
  return { head, clothes: map(person, (v, i) => Math.min(v, 1 - head.data[i])) }
}

const [origPath, genPath, outDir] = process.argv.slice(2)
const original = await readImg(origPath)
// генерацию отдаём в другом разрешении и чуть сдвинутой — как вернёт Muse Image
const genBuf = await sharp(genPath).resize(Math.round(original.width * 1.33)).extend({ top: 24, left: 10, background: '#272727' }).toBuffer()
const generated = await readImg(genBuf)

const personOrig = personMask(original)
const personGen = personMask(generated)
const o = split(personOrig)
const g = split(personGen)
const result = composeTryOn({ original, generated, personOrig, protectedOrig: o.head, clothesOrig: o.clothes, personGen, clothesGen: g.clothes })

await writeImg(result.image, `${outDir}/result.png`)
await writeMask(result.blend, `${outDir}/blend.png`)
await writeMask(personOrig, `${outDir}/person-orig.png`)
await writeMask(o.head, `${outDir}/protected.png`)
console.log(JSON.stringify(result.report, null, 1))
