# AI Video Product Benchmark

Research date: 2026-08-18. This document records product patterns, not marketing claims or a plan to copy another interface.

## Products reviewed

| Product | Observed workflow | Pattern adopted here |
| --- | --- | --- |
| CapCut | Topic or script -> format/style -> scenes -> voice/captions/music -> edit -> export | Collect output constraints before generation and keep scene editing before export. |
| Invideo AI | Prompt with audience/platform/appearance -> generate -> conversational edits -> publish | Treat the prompt as a production brief and preserve an editable draft. |
| VEED | Describe or paste script -> choose ratio/voice/music/captions -> replace media -> editor -> export | Separate story, media, audio, captions, and final export decisions. |
| Pictory | Parse script -> logical scenes -> matched visuals/captions/audio -> storyboard editor -> export | Keep one idea per scene and make visual matching reviewable. |
| HeyGen | Agent/autopilot draft -> scene and voice setup -> AI Studio fine-tuning -> preview -> generate | Require human review before spending render credits or time. |

## Primary sources

- CapCut, AI video generator: https://www.capcut.com/tools/digen-ai-video-generator
- Invideo AI, AI video generator: https://invideo.io/make/ai-video-generator/
- Invideo Help, editing with Magic Box: https://help.invideo.io/en/articles/9387692-what-is-magic-box-and-how-to-use-it
- VEED, script to video: https://www.veed.io/tools/ai-video/script-to-video
- Pictory Academy, script to video workflow: https://pictory.ai/academy/how-to-turn-script-into-video-pictory-ai
- HeyGen Help, Video Agent workflow: https://help.heygen.com/en/articles/12402907-how-to-get-started-with-video-agent

## Product conclusions

1. A single topic is insufficient. A useful brief includes objective, audience, platform, duration, language, tone, and visual style.
2. The first AI result is a draft. Users need scene-level control over narration, screen copy, visuals, and timing.
3. Media selection is a distinct production stage. A visual description is not the same as a generated, uploaded, or licensed asset.
4. Voice, captions, and music are separate tracks with separate costs and review requirements.
5. Preview and explicit approval should happen before final rendering.
6. Generated output must remain editable. Revisions invalidate the previous render.

## Current scope

The repository now implements the brief, validated storyboard, editable visual directions, voice choice, approval gate, render queue, preview, and download stages. The bundled focus demo has matched media.

The following remain future integrations and must not be described as complete:

- Topic-specific image/video generation for every scene.
- Stock media search with license metadata.
- Music selection and audio ducking.
- Word-level subtitle timing.
- Brand kits, reusable templates, collaboration, and direct publishing.
