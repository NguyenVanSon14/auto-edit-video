const fs = require('node:fs/promises');
const path = require('node:path');
const OpenAI = require('openai');
const { GoogleGenAI } = require('@google/genai');
const sharp = require('sharp');
const config = require('../../core/config');
const store = require('./video-plan.store');
const { AppError } = require('../../core/app-error');

let mediaQueue = Promise.resolve();

function hasSceneMedia(scene) {
  return Boolean(scene.backgroundAsset || scene.media?.path);
}

function hasCompleteMedia(plan) {
  return plan.scenes.length > 0 && plan.scenes.every(hasSceneMedia);
}

function resolveSceneMediaPath(scene) {
  if (scene.media?.type === 'generated') {
    const target = path.resolve(config.mediaDir, scene.media.path);
    if (!target.startsWith(`${path.resolve(config.mediaDir)}${path.sep}`)) return null;
    return target;
  }
  const asset = scene.backgroundAsset || (scene.media?.type === 'demo' ? scene.media.path : null);
  if (!asset) return null;
  const target = path.resolve(config.rootDir, 'assets', asset);
  if (!target.startsWith(`${path.resolve(config.rootDir, 'assets')}${path.sep}`)) return null;
  return target;
}

async function verifyCompleteMedia(plan) {
  if (!hasCompleteMedia(plan)) return false;
  const results = await Promise.all(plan.scenes.map(async (scene) => {
    const target = resolveSceneMediaPath(scene);
    if (!target) return false;
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }));
  return results.every(Boolean);
}

function buildSceneImagePrompt(plan, scene, index) {
  const style = {
    realistic: 'natural editorial photography, believable materials and lighting',
    cinematic: 'cinematic live-action frame, controlled contrast and motivated lighting',
    minimal: 'minimal editorial composition, few objects, clean negative space',
  }[plan.visualStyle] || 'natural editorial photography';
  return `Create one original portrait background image for scene ${index + 1} of ${plan.scenes.length} in a vertical short video.

Project topic: ${plan.topic}
Audience: ${plan.targetAudience}
Platform: ${plan.platform}
Visual direction: ${scene.visual}
Style: ${style}

Keep the same world, color treatment, time period, and recurring person appearance across the project. Show the concrete subject and action described by this scene. Compose for a 9:16 crop with the key subject in the center and useful darker negative space in the lower third for captions. No text, letters, numbers, logos, trademarks, UI, borders, split panels, collage, or watermark.`;
}

function projectMediaDir(planId) {
  if (!/^[0-9a-f-]{36}$/.test(planId)) throw new AppError('Invalid project media path.', 500, 'INVALID_MEDIA_PATH');
  const target = path.resolve(config.mediaDir, planId);
  const root = `${path.resolve(config.mediaDir)}${path.sep}`;
  if (!target.startsWith(root)) throw new AppError('Invalid project media path.', 500, 'INVALID_MEDIA_PATH');
  return target;
}

async function generateProjectMedia(plan, onProgress = () => {}) {
  if (!['gemini', 'openai'].includes(plan.imageProvider)) {
    throw new AppError('This project is not configured for generated scene images.', 409, 'INVALID_IMAGE_PROVIDER');
  }
  const isOpenAI = plan.imageProvider === 'openai';
  const apiKey = isOpenAI ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AppError(`${isOpenAI ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'} is required to generate scene images.`, 503, 'PROVIDER_NOT_CONFIGURED');
  }
  const client = isOpenAI ? new OpenAI({ apiKey }) : new GoogleGenAI({ apiKey });
  const model = isOpenAI
    ? process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'
    : process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  const quality = process.env.OPENAI_IMAGE_QUALITY || 'low';
  const directory = projectMediaDir(plan.id);
  await fs.mkdir(directory, { recursive: true });
  const scenes = [];

  for (let index = 0; index < plan.scenes.length; index += 1) {
    const scene = plan.scenes[index];
    const relativePath = `${plan.id}/scene-${String(index + 1).padStart(2, '0')}.jpg`;
    const target = path.join(config.mediaDir, relativePath);
    const prompt = buildSceneImagePrompt(plan, scene, index);
    try {
      await fs.access(target);
    } catch {
      let encoded;
      if (isOpenAI) {
        const result = await client.images.generate({ model, prompt, size: '1024x1536', quality });
        encoded = result.data?.[0]?.b64_json;
      } else {
        const interaction = await client.interactions.create({
          model,
          input: prompt,
          response_format: { type: 'image', aspect_ratio: '9:16', image_size: '1K' },
        });
        encoded = interaction.output_image?.data;
      }
      if (!encoded) throw new AppError('Image provider returned no image data.', 502, 'IMAGE_EMPTY_RESPONSE');
      await sharp(Buffer.from(encoded, 'base64'))
        .resize(720, 1280, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 88 })
        .toFile(target);
    }
    scenes.push({
      ...scene,
      media: {
        type: 'generated',
        provider: plan.imageProvider,
        model,
        prompt,
        path: relativePath,
        sourceUrl: null,
        license: 'generated-content',
        createdAt: new Date().toISOString(),
      },
    });
    onProgress(Math.round(((index + 1) / plan.scenes.length) * 100));
  }
  return scenes;
}

function enqueueMedia(planId) {
  mediaQueue = mediaQueue.then(async () => {
    const plan = await store.findById(planId);
    if (!plan || plan.mediaStatus === 'generating') return;
    await store.update(planId, { mediaStatus: 'generating', mediaProgress: 0, mediaError: null, approvedForRender: false });
    try {
      const scenes = await generateProjectMedia(plan, (mediaProgress) => {
        store.update(planId, { mediaProgress }).catch((error) => console.error('[media progress]', error.message));
      });
      await store.update(planId, { scenes, mediaStatus: 'ready', mediaProgress: 100, mediaError: null });
    } catch (error) {
      console.error('[media]', error);
      await store.update(planId, { mediaStatus: 'failed', mediaProgress: 0, mediaError: error.message });
    }
  });
  return mediaQueue;
}

async function removeProjectMedia(planId) {
  await fs.rm(projectMediaDir(planId), { recursive: true, force: true });
}

module.exports = {
  buildSceneImagePrompt,
  enqueueMedia,
  generateProjectMedia,
  hasCompleteMedia,
  hasSceneMedia,
  removeProjectMedia,
  resolveSceneMediaPath,
  verifyCompleteMedia,
};
