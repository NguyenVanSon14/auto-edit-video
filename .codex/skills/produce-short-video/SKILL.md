---
name: produce-short-video
description: Create, repair, render, and validate vertical short-video projects in the Auto Edit Video repository. Use when Codex is asked to turn a topic into a storyboard or MP4, improve short-video quality, diagnose generation or FFmpeg failures, change the video workflow, or verify the dashboard/API/render pipeline.
---

# Produce Short Video

Follow the repository's single supported flow: topic -> validated storyboard -> queued render -> playable MP4. Keep mock mode working so the project remains usable without external keys.

## Execute the workflow

1. Read `README.md` and inspect `src/modules/video-plans/video-plan.schema.js` before changing the plan contract.
2. Preserve the 5-8 scene structure. Give each scene one narration line, brief on-screen text, a filmable visual direction, a 2.5-8 second duration, and a supported accent.
3. Use `POST /api/video-plans/generate` to create plans. Do not write runtime JSON by hand.
4. Use `PATCH /api/video-plans/:id` for edits. Preserve non-edited scene fields and expect the previous render to be invalidated.
5. Keep `voiceProvider=none` unless the user explicitly requests Gemini TTS and accepts an API call.
6. Use only `backgroundAsset` values allowed by the scene schema. Keep the bundled focus images limited to the focus mock; do not attach them to unrelated AI topics.
7. Run `npm run assets:prepare` only after replacing the source atlas in `assets/demo-focus/`.
8. Use `POST /api/video-plans/:id/render` to queue rendering. Poll the detail endpoint until `ready` or `failed`.
9. Verify the output exists, has a poster, uses a 9:16 frame, and plays as H.264 MP4 before reporting success.
10. Run `node .codex/skills/produce-short-video/scripts/check-workflow.js` after code or prompt changes.

## Guard content quality

- Open with tension, curiosity, or a specific promise.
- Deliver one idea rather than a list of unrelated facts.
- Keep on-screen copy readable within two seconds and free of clipped long words.
- Make scene progression concrete: hook, context, method, proof or consequence, payoff, action.
- Keep all copy original and all visual directions copyright-safe.
- Match the requested language and tone consistently.

## Change the system safely

Read [architecture.md](references/architecture.md) before changing API routes, status transitions, persistence, or renderer behavior. Keep render jobs serialized unless resource limits and concurrency behavior are explicitly redesigned. Never commit `.env`, generated JSON, posters, or MP4 files.

If external AI fails, return a typed provider error; do not silently substitute mock content when `MOCK_AI=false`. If FFmpeg fails, preserve the error on the project with status `failed` so the dashboard can recover and rerun it.
