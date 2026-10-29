# Demo Video Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A rendered, clearly marked draft of the demo video built in code, ready to take real footage on day 9 (spec: `docs/spec-demo-draft.md`).

**Architecture:** Standalone Remotion project in `demo/`; `src/script.ts` holds scenes and voice text; scene length comes from TTS durations; missing footage renders as a "Footage needed" card; `final` refuses to render with missing footage.

**Tech Stack:** Remotion 4 (React, TypeScript), edge-tts (Python), ffmpeg/ffprobe, Playwright (footage).

---

### Task 1: Project — `demo/package.json`, `tsconfig.json`, `remotion.config.ts`, `src/index.ts`, `src/Root.tsx`; `.gitignore` gets `demo/node_modules`, `demo/out/`, `demo/public/footage/`.
### Task 2: Script and timing — `src/script.ts` (scenes, voice paragraphs, footage names, model chips), `src/timing.ts` (frames per scene from `public/voice/durations.json`, pause 0.5 s); unit check that the total is ≤ 175 s.
### Task 3: Voice — `scripts/voice.mjs`: edge-tts per paragraph → `public/voice/NN.mp3` + `durations.json` (ffprobe).
### Task 4: Components — Logo (stroke draw), SceneTitle, Phone (OffthreadVideo or FootageNeeded card), ModelChip, Subtitles (word timing spread over the paragraph), HowItWorks diagram, EndCard, Draft badge. Noir tokens in `src/theme.ts`, Inter Tight via `@remotion/google-fonts`.
### Task 5: Footage now — Playwright on the local web (phone 400×866, laptop 1440×900): `07-web-judges.mp4`, `08-fit.mp4` into `public/footage/`, trimmed and converted with ffmpeg.
### Task 6: Render and check — `npm run draft` → `out/draft.mp4`; ffprobe size/fps/length/audio; frame stills per scene; `npm run final` fails listing missing footage. Update `docs/demo-video.md` (§3–4 new scene and texts). Commit.
