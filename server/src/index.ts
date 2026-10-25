// Сервер Twin Closet: телефон шлёт сюда видео и скриншоты, ключ Meta живёт только здесь
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { networkInterfaces } from 'node:os'
import { MetaApi } from './meta'

const meta = new MetaApi(process.env.MODEL_API_KEY ?? '')
const app = new Hono()

app.use('*', cors())
app.get('/health', (c) => c.json({ ok: true, meta: meta.configured }))

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
  if (!meta.configured) console.log('MODEL_API_KEY не задан — запросы к Meta пока недоступны')
})
