# Favorite Piece Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any closet piece can be marked "fits me perfectly" and measured flat with a tape; new pieces of that kind are compared with it (spec: `docs/spec-favorite-piece.md`).

**Architecture:** Pure `TAPE_ZONES` / `TAPE_LIMITS` / `garmentFitFromTape` in `packages/shared/src/fit.ts`; closet document gets `measured` and `favoriteByKind`, merged into closet items; new screen `app/src/app/piece/[id].tsx` opened from the closet grid; a link from the fit sheet when no favorite exists.

**Tech Stack:** TypeScript, vitest, Expo Router.

---

### Task 1: Tape → GarmentFit (TDD)
- [ ] Tests in `server/test/fit.test.ts`: jeans flat `{ waist: 41, hips: 49, thigh: 30, inseam: 83 }` → zones `{ waist: 82, hips: 98, thigh: 60, inseam: 83 }`, `source: 'tape'`, size `'Yours'`; `{ waist: 10 }` → errors `['waist']`, fit null; `{}` → fit null, no errors; top → only chest used; `fitReport` with this favorite → `vsFavorite` "Next to your black jeans: …".
- [ ] Implement, run → PASS.

### Task 2: Store
- [ ] `ClosetDoc` + `measured`, `favoriteByKind`; `readDoc` cleans them; `closet` merges; store methods `setPieceFit(id, fit | null)`, `setFavorite(id, on)`; `item(id)` sees merged fit.

### Task 3: Screen and links
- [ ] `app/src/app/piece/[id].tsx` (toggle, tape fields with units, cut chips, stretch, save, errors near fields, A4 note), registered in `_layout.tsx`; closet tiles open it; fit sheet link when there is no measured favorite.
- [ ] `cd app && npx tsc --noEmit`; browser check at 390 px.

### Task 4: Verify and commit
- [ ] `npm test -w @twin/server`, `npm run typecheck`, commit.
