# Демо-видео Twin Closet — сценарий и промпт

**Решение (27.10):** видео не снимаем и не монтируем руками. Его собирает Claude кодом — motion design
(видео как код: сцены, анимации, титры, переходы, рендер в MP4). Голос тоже кодом — синтез речи по тексту ниже.
Запасной вариант голоса — ты читаешь текст сам, Claude подкладывает запись.

Видео — 25% оценки. Поэтому делаем его последним (день 9, 3 ноября), когда весь функционал и дизайн готовы,
и только из **настоящих** записей экрана и настоящих ответов моделей.

---

## 1. Правила видео

- **Только настоящее приложение.** Записи экрана с телефона и веба, настоящие вырезки SAM, настоящие ответы
  Spark, настоящие рендеры Muse Image. Анимация — вокруг записей (рамка телефона, подписи, переходы),
  но не вместо них. Нарисованный «как будто интерфейс» или выдуманный результат судьи заметят — и это нечестно.
- **Каждая модель Meta подписана в кадре** в момент, когда она работает (польза моделей — 25% оценки).
- **Цифры только из настоящего прогона:** сколько вещей нашёл скан, сколько похожих, время. В сценарии они в скобках `[…]`.
- Длина 2:30–2:50 (проверить лимит в Official Rules). 16:9, 1920×1080, 30 fps; телефон в рамке по центру.
- Язык — английский, субтитры вшиты (многие судьи смотрят без звука).
- Стиль — дизайн-система Noir (docs/design.md): почти чёрный фон, один золотой акцент, Inter Tight, стекло.
  Никаких ярких градиентов, неона и эмодзи.

## 2. Что записать, когда приложение готово (чеклист)

Записывает Claude сам (веб — записью браузера) или ты на телефоне (запись экрана, 60 fps, вертикально).
Имена файлов — как в списке, папка `demo/footage/` (не в git).

| Файл | Что на записи | Где |
|---|---|---|
| `01-body-scan.mp4` | Скан себя: телефон на полке, поворот 6 с, появление 4 ракурсов | телефон + камера со стороны |
| `02-closet-scan.mp4` | Скан шкафа: проход вдоль вешалок, счётчик вещей, сетка вырезок | телефон |
| `02b-sam-overlay.mp4` | То же видео шкафа с наложенными масками SAM (рендер с сервера) | сервер |
| `03-share-instagram.mp4` | Instagram → «Поделиться» → Twin Closet → «Already in your closet» | телефон |
| `04-try-on.mp4` | «See it on me» → результат, ползунок до/после, поворот 4 ракурсов | телефон |
| `04b-protect-mask.png` | Маска «лицо, волосы, руки» поверх фото (показать, что они настоящие) | сервер |
| `05-in-store.mp4` | Фото вещи в магазине + ценник → бренд, цена, размер | телефон |
| `06-twin-voice.mp4` | Twin: голосом «Dinner on Friday…» → образ → «Try it on» | телефон |
| `07-web-judges.mp4` | Веб-версия: судья кидает скриншот → примерка (короткий кусок) | браузер |
| `logo.svg`, `icon.png` | Логотип — `app/assets/images/` | репозиторий |

## 3. Сценарий

| Время | Кадр | Текст на экране | Модель |
|---|---|---|---|
| 0:00–0:10 | Чёрный фон, быстрые кадры: скриншот вещи из магазина → посылка → «Return» | **You bought it. It looked different on you.** | — |
| 0:10–0:18 | Логотип: белая половина вешалки рисуется линией, потом золотая | **Twin Closet** · Your closet, on you. | — |
| 0:18–0:40 | `01-body-scan` ускоренно ×3, потом 4 ракурса раскладываются веером | Scan yourself once · 6 seconds | Muse Spark — picks 4 angles · SAM 3.1 — masks |
| 0:40–1:05 | `02-closet-scan` ×4, поверх `02b-sam-overlay`, вырезки летят в сетку, счётчик | [N] pieces found, cut out and tagged | SAM 3.1 — tracks every piece · Muse Spark — tags |
| 1:05–1:22 | `03-share-instagram`: скриншот джинсов → «Already in your closet · [2]» | You already own something similar | Muse Spark — compares with your closet |
| 1:22–1:52 | `04-try-on`: ползунок до/после, поворот Front → 3/4 → Side → Back; на 1:40 — `04b-protect-mask` | On your real body · 4 angles · face and hands stay yours | Muse Image — dresses you · SAM 3.1 — protects face and hands |
| 1:52–2:08 | `05-in-store`: вещь на вешалке + ценник → карточка с ценой и размером, образ 2 из 3 | Two stores and your own clothes, in one look | SAM 3.1 — cut-out · Muse Spark — reads the tag |
| 2:08–2:24 | `06-twin-voice`: волна микрофона, образ «Friday dinner», «Try it on» | Twin, your stylist | Muse Voice Transcribe · Muse Spark |
| 2:24–2:38 | Схема: телефон → сервер → 5 моделей, у каждой одна строка роли | How it works | все пять |
| 2:38–2:50 | `07-web-judges` коротко, затем финал на чёрном | Try it: [web link] · [GitHub] | — |

## 4. Текст голоса (английский, ~330 слов, спокойно, 130–140 слов в минуту)

> You see a piece you love. You buy it. It arrives, and it looks different on you.
> And somewhere in your closet there was already something just like it.
>
> This is Twin Closet. Your closet, on you.
>
> First, you scan yourself once. Prop the phone up and turn around for six seconds.
> Muse Spark picks your four best angles, and SAM 3.1 maps your face, hands and clothes.
>
> Then you film your closet. One slow pass along the rail.
> SAM 3.1 tracks every piece through the video, cuts out its best frame,
> and Muse Spark tags it: what it is, the colour, the fabric. [N] pieces, in about a minute.
>
> Now the fun part. You see jeans on Instagram. Share them to Twin Closet.
> Before anything else, it tells you: you already own two pairs like these.
>
> Still want them? See them on you. Muse Image dresses your real photo in the new jeans
> and the clothes you already own. Slide to compare. Turn around: front, three quarters, side, back.
> Your face and hands are never generated. SAM 3.1 keeps them as your real pixels.
>
> In a store? Snap the piece and its price tag. Muse Spark reads the brand, price and size.
> Mix two stores and your own wardrobe in one look.
>
> And if you are not sure what to wear, ask Twin. "Dinner on Friday, smart but relaxed."
> Muse Voice Transcribe hears you, Muse Spark builds the outfit from your closet, and you can try it on right away.
>
> Under the hood: five Meta models, each doing one clear job.
> SAM 3.1 sees and cuts out. Muse Spark understands and decides. Muse Image dresses you.
>
> Twin Closet. Buy less. Wear more of what you own.
> Try it in your browser: no camera needed.

Цифры в скобках заменить на настоящие из прогона. Если какой-то функции к 3 ноября нет — вырезаем её сцену и фразу.

## 5. Голос

1. **Синтез речи кодом** — основной вариант. Спокойный мужской или женский голос, без «рекламной» интонации;
   генерируем по абзацам (тогда легко подогнать к сценам), паузы между абзацами 0.4–0.6 с.
2. **Запасной** — ты читаешь текст выше на телефон в тихой комнате, одним файлом; Claude режет по абзацам
   и подгоняет сцены под твою речь.
3. Музыка — тихий минимальный эмбиент без слов, только из бесплатной библиотеки с лицензией на использование;
   под голосом −18 dB.

## 6. Промпт для Claude (вставить, когда всё готово)

```text
Make the demo video for Twin Closet, my entry to the Meta Global AI Developer Hackathon, as a motion-design
video built in code and rendered to MP4.

Read first: docs/demo-video.md (rules, scenes, voiceover), docs/design.md (design system "Noir"),
README.md (what each Meta model does). Footage is in demo/footage/ with the file names from section 2.

Format: 1920x1080, 30 fps, 2:30–2:50 (stay under the limit in the hackathon rules), English,
burned-in subtitles. The phone is shown in a thin dark frame in the centre; scene titles on the left,
model callouts on the right.

Style: the app's own design system. Background #0B0B0C, text #F5F5F4, muted #A8A29E, one accent gold #C8B68A,
lines #2A2A2D. Font Inter Tight (300 for big titles with -0.03em tracking, 500 for labels, uppercase labels
with 0.14em tracking). Glass chips: white 10%→2% gradient, 1px border, soft shadow. Motion is calm:
150–400 ms ease-out, slow push-ins on footage, no bounces, no neon, no bright gradients, no emoji,
no italic serif accents.

Logo animation: the split hanger from app/assets/images (SVG paths in docs/design.md). Draw the white hook
and left shoulder as a line, then the gold right shoulder, then fade in the wordmark "Twin" (600) "Closet" (300).

Scenes, timing, on-screen text and model callouts: follow the table in section 3 exactly. Every time a Meta
model works on screen, show a callout chip with the model name and its one-line job
(e.g. "SAM 3.1 · tracks every piece"). The "How it works" scene is an animated diagram:
phone → server → SAM 3.1, Muse Spark, Muse Image, Muse Voice Transcribe, with one line per model.

Honesty: use only the real footage and real model outputs from demo/footage/. Do not draw fake app screens,
invent numbers or results. Replace every [placeholder] with the real value from the footage, or ask me.
If a scene's footage is missing, cut the scene and its voiceover line and tell me.

Voice: generate the voiceover from section 4 with text-to-speech, paragraph by paragraph, calm and natural,
130–140 words per minute; fit the scenes to the voice, not the other way round. If there is a file
demo/voice.m4a, use my recording instead and cut it by paragraph. Music: quiet ambient, royalty-free with a
licence that allows this use, at about -18 dB under the voice.

Deliver: the MP4, the source project, and a 1280x720 thumbnail (logo + "Your closet, on you." on #0B0B0C).
Then show me the video before anything is uploaded anywhere.
```
