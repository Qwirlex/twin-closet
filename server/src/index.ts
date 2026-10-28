// Сервер Twin Closet: телефон шлёт сюда видео и скриншоты, ключ Meta живёт только здесь
import { serve } from '@hono/node-server'
import { networkInterfaces } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app'
import { scheduleCleanup } from './cleanup'
import { Jobs } from './jobs'
import { MetaApi } from './meta'
import { Store } from './store'
import { Supabase } from './supabase'
import { PriceWatch } from './watch'

const root = join(import.meta.dirname, '..')
const meta = new MetaApi(process.env.MODEL_API_KEY ?? '')
// с SUPABASE_URL и SUPABASE_SECRET_KEY состояние и файлы живут в Supabase; без них — в DATA_DIR (для разработки)
const supabase = Supabase.fromEnv()
const store = await Store.open(process.env.DATA_DIR ?? join(root, 'data'), supabase)
const jobs = new Jobs(store, meta, join(root, 'samples'))
const watch = new PriceWatch(store, meta, PriceWatch.jobSearch(jobs, meta))
const app = createApp({ store, jobs, meta, watch })
watch.schedule()
scheduleCleanup(store)

// хостинг перед остановкой (новый деплой) шлёт SIGTERM: дописываем состояние в Supabase и выходим
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    void store.flush().finally(() => process.exit(0))
  })
}

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, () => {
  // адрес в локальной сети — его вписываем в приложение на телефоне
  // домашняя сеть (192.168.*, 10.*, 172.16–31.*), а не адреса VPN
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address)
  const lan = ips.find((a) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a)) ?? ips[0]
  console.log(`Twin Closet server: http://localhost:${port}${lan ? `  (телефон: http://${lan}:${port})` : ''}`)
  console.log(supabase ? `Хранилище: Supabase (${supabase.url})` : `Хранилище: локально (${store.dir})`)
  if (!meta.configured) console.log('MODEL_API_KEY не задан — запросы к Meta пока недоступны')
})
