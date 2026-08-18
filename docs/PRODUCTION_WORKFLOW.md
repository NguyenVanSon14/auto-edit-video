# Short Video Production Workflow

This is the source of truth for product behavior, implementation, tests, and the `produce-short-video` skill.

## 1. Production brief

Required input:

- Topic: the single subject or promise.
- Objective: awareness, education, or conversion.
- Target audience: a specific viewer group.
- Platform: TikTok, Instagram Reels, or YouTube Shorts.
- Duration: 15-60 seconds.
- Language, tone, visual style, and voice choice.

Output: a normalized request accepted by `generateRequestSchema`. Do not call an AI provider until this validation passes.

## 2. Script and storyboard

Generate 5-8 scenes. Every scene contains:

- One narration beat.
- Short on-screen copy readable in under two seconds.
- A visual direction naming subject, action, setting, framing, and lighting.
- Duration between 2.5 and 8 seconds.
- A supported accent color.

Story order: hook -> context -> useful method -> proof or consequence -> payoff -> action. Total scene duration must stay close to the requested duration.

## 3. Media plan

For each scene, choose one media source:

- Generated image or video.
- Licensed stock asset.
- User upload.
- Typography fallback.

The `visual` field is the media brief. `backgroundAsset` is a local asset reference and must be on the schema allowlist. Never attach a convenient but unrelated image. Record provider, prompt, license, and source URL when external media support is added.

## 4. Audio and captions

Voice is opt-in. `none` produces a silent AAC track; `gemini` may spend API quota. On-screen text currently acts as designed captions, not word-level speech subtitles. Music is outside the current product scope.

## 5. Human review

The user reviews every scene for factual accuracy, language, visual relevance, pacing, and copyright safety. The dashboard must save `approvedForRender=true` before rendering. Any subsequent storyboard edit resets approval and invalidates old output.

## 6. Render and quality control

The renderer produces H.264/AAC MP4 at 720x1280 with a JPEG poster. Jobs run serially. A successful delivery requires:

- Status reaches `ready` and progress reaches 100.
- MP4 and poster both exist and are non-empty.
- Video is portrait 9:16 and uses H.264/AAC.
- Scene text is readable and does not overflow.
- Voice, when requested, is present and not cut short.

Run:

```powershell
node .codex\skills\produce-short-video\scripts\check-workflow.js
```

## 7. Revision

Editing a ready or failed project removes the old render, returns the project to `draft`, clears approval, and requires review again. Never overwrite a reviewed output while a render is queued or running.

## State model

```text
brief validated
  -> draft storyboard
  -> media/audio choices
  -> approved draft
  -> queued
  -> rendering
  -> ready
```

Failures transition to `failed`; the same approved draft may be retried. Content edits always transition back to an unapproved `draft`.
