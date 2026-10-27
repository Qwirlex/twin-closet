// Сборка веб-версии для судей. Локальные .env не читаем (EXPO_NO_DOTENV), чтобы домашний адрес не попал в сборку:
// адрес сервера — только явно, из TWIN_API_URL. Без него приложение работает на демо-аккаунте и честно пишет,
// что сканы и примерка ждут сервер.
import { spawnSync } from 'node:child_process';

const api = process.env.TWIN_API_URL ?? '';
if (api && !/^https:\/\//.test(api)) {
  console.error('TWIN_API_URL должен быть https:// — браузер не пустит страницу https к серверу по http');
  process.exit(1);
}
const out = process.argv[2] ?? '../dist-web';
const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', out, '--clear'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, EXPO_NO_DOTENV: '1', EXPO_PUBLIC_API_URL: api, CI: '1' },
});
process.exit(r.status ?? 1);
