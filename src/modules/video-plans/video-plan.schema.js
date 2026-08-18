const { z } = require('zod');

const PALETTE = ['coral', 'mint', 'gold', 'sky', 'rose'];
const BACKGROUND_ASSETS = [
  'demo-focus/distracted.jpg',
  'demo-focus/focused.jpg',
  'demo-focus/complete.jpg',
];

const sceneMediaSchema = z.object({
  type: z.enum(['generated', 'demo', 'upload', 'stock']),
  provider: z.string().trim().min(2).max(40),
  model: z.string().trim().min(2).max(80).nullable().optional(),
  prompt: z.string().trim().min(3).max(1200),
  path: z.string().regex(/^(?:[0-9a-f-]+\/scene-\d{2}\.jpg|demo-focus\/(?:distracted|focused|complete)\.jpg)$/),
  sourceUrl: z.string().url().nullable().optional(),
  license: z.string().trim().min(2).max(120),
  createdAt: z.string().datetime(),
});

const sceneSchema = z.object({
  narration: z.string().trim().min(8).max(320),
  onScreenText: z.string().trim().min(2).max(90),
  visual: z.string().trim().min(3).max(180),
  durationSeconds: z.number().min(2.5).max(8),
  accent: z.enum(PALETTE),
  backgroundAsset: z.enum(BACKGROUND_ASSETS).optional(),
  media: sceneMediaSchema.optional(),
});

const videoPlanSchema = z.object({
  topic: z.string().trim().min(3).max(160),
  hook: z.string().trim().min(3).max(120),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(600),
  scenes: z.array(sceneSchema).min(5).max(8),
  hashtags: z.array(z.string().trim().regex(/^#[\p{L}\p{N}_]+$/u)).min(1).max(5),
});

const generateRequestSchema = z.object({
  niche: z.string().trim().min(2).max(120),
  objective: z.enum(['awareness', 'education', 'conversion']).default('education'),
  targetAudience: z.string().trim().min(2).max(120).default('Người xem mạng xã hội'),
  platform: z.enum(['tiktok', 'reels', 'shorts']).default('tiktok'),
  visualStyle: z.enum(['realistic', 'cinematic', 'minimal']).default('realistic'),
  imageProvider: z.enum(['gemini', 'openai', 'demo']).default('gemini'),
  language: z.enum(['vi', 'en']).default('vi'),
  tone: z.enum(['energetic', 'cinematic', 'educational', 'calm']).default('energetic'),
  durationSeconds: z.coerce.number().int().min(15).max(60).default(30),
  voiceProvider: z.enum(['none', 'gemini']).default('none'),
});

const updateVideoPlanSchema = videoPlanSchema
  .pick({ title: true, description: true, hook: true, scenes: true, hashtags: true })
  .partial()
  .extend({
    voiceProvider: z.enum(['none', 'gemini']).optional(),
    approvedForRender: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one editable field is required.' });

function normalizeDurations(plan, targetDuration) {
  const total = plan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
  const achievableDuration = Math.min(Math.max(targetDuration, plan.scenes.length * 2.5), plan.scenes.length * 8);
  const scale = achievableDuration / total;
  return {
    ...plan,
    scenes: plan.scenes.map((scene) => ({
      ...scene,
      durationSeconds: Number(Math.min(8, Math.max(2.5, scene.durationSeconds * scale)).toFixed(2)),
    })),
  };
}

module.exports = { PALETTE, BACKGROUND_ASSETS, sceneMediaSchema, videoPlanSchema, generateRequestSchema, updateVideoPlanSchema, normalizeDurations };
