# Сервер Twin Closet (Render): Node 22 + ffmpeg + sharp. Приложение (Expo) в образ не попадает — только server и shared.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

# сначала только манифесты: слой с зависимостями пересобирается, лишь когда они меняются.
# app/package.json нужен npm, чтобы увидеть все рабочие области, но зависимости ставим только серверу
COPY package.json package-lock.json ./
COPY app/package.json app/package.json
COPY server/package.json server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace @twin/server --omit=dev --no-audit --no-fund \
  # sharp под Linux: если lockfile с Windows не дал нужную сборку — ставим её явно
  && (node -e "require('sharp')" || npm install --no-save --os=linux --cpu=x64 --libc=glibc sharp@0.34.4) \
  && node -e "require('sharp'); console.log('sharp ok')" \
  && ffmpeg -version | head -1

COPY packages/shared packages/shared
COPY server server

ENV NODE_ENV=production \
    PORT=8787 \
    DATA_DIR=/data

WORKDIR /srv/server
EXPOSE 8787
# node напрямую (не через npm): сигнал остановки от хостинга доходит до процесса
CMD ["node", "--import", "tsx", "src/index.ts"]
