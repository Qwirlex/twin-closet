# Smart Frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Models get the sharpest distinct frames of every video instead of an even grid, and a new piece can be added as a short video (spec: `docs/spec-smart-frames.md`).

**Architecture:** Pure `pickFrames` in `packages/shared/src/scan.ts`; `smartKeyframes` in `server/src/media.ts` (ffmpeg grey thumbnails → scores → full frames); `jobs.ts` uses it for closet, body and piece videos and stores `result.keyframeTimes`; `pipeline/closet.ts` and `pipeline/item.ts` read those times and frames.

**Tech Stack:** TypeScript, ffmpeg, vitest.

---

### Task 1: pickFrames (TDD) — tests in `server/test/scan.test.ts`: blurred half skipped, duplicates merged, dark only as fallback, sorted by time. Implement, PASS.
### Task 2: smartKeyframes + jobs — `media.ts`, `jobs.ts` (keyframes step for closet/body/import_item, `keyframeTimes`, import_item video ≤ 15 s, main photo = sharpest), `shared` JobResult `keyframeTimes`, `closet.ts` uses the times, `item.ts` reads video frames. Tests in `server/test/pipeline.test.ts` and `jobs.test.ts`.
### Task 3: App — Try on → Screenshot accepts a short video.
### Task 4: Verify (`npm test -w @twin/server`, typecheck) and commit.
