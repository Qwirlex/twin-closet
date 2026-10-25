# Twin Closet

See new clothes on your real body, styled with what you already own, before you buy.
Built for the Meta Global AI Developer Hackathon on Meta's models: SAM 3.1, Muse Spark and Muse Image.

- `app/` — Expo (React Native) app: iOS, Android and web from one codebase
- `server/` — Node + Hono API; the Meta Model API key lives only here
- `packages/shared/` — types shared by app and server

## Run

```bash
npm install
cp server/.env.example server/.env   # add MODEL_API_KEY
npm run server                        # http://localhost:8787
npm run app                           # Expo dev server; open in Expo Go or press w for web
```

On a phone, set `EXPO_PUBLIC_API_URL` in `app/.env` to the computer's address on the home network.

Plan (in Russian): [PLAN.md](PLAN.md).
