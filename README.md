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

## Stores and price drops

Favourite stores and a wishlist. Zara, Bershka and Pull & Bear are live: Muse Spark web search finds a piece
online by the REF on its tag, and the server checks wishlist prices once a day. Other shops are coming soon.
Product data comes only from the user's own photos and from Muse Spark search results; the app does not
scrape store websites or call their private APIs.

Brand list: [Name Suggestion Index](https://github.com/osmlab/name-suggestion-index) by OpenStreetMap
contributors, BSD 3-Clause.
