# Architecture Reference

## Runtime flow

| Stage | Owner | Output |
| --- | --- | --- |
| Request validation | `src/schemas/videoPlan.schema.js` | Normalized generation options |
| Story generation | `src/services/ai.service.js` | Validated 5-8 scene plan |
| Persistence | `src/services/planStore.service.js` | Atomic `data/video-plans.json` update |
| Job control | `src/services/render.service.js` | Serialized render and progress updates |
| Media generation | Sharp + bundled FFmpeg | JPEG poster and H.264/AAC MP4 |
| User workflow | `public/` | Create, preview, render, download, delete |

## Status transitions

`draft -> queued -> rendering -> ready`

Any render error changes `rendering` to `failed`. A user may submit render again from `failed` or `ready`. Do not introduce a state that the dashboard cannot display.

## Invariants

- Accept 15-60 second requested durations.
- Produce 5-8 scenes with 2.5-8 seconds per scene.
- Use only `coral`, `mint`, `gold`, `sky`, or `rose` accents.
- Keep API errors shaped as `{ "error": { "code", "message" } }`.
- Keep writes atomic and mutations sequential.
- Store runtime artifacts only under the configured data and render directories.
