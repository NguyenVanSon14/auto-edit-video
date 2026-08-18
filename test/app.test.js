const path = require('node:path');
const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { before, after, test } = require('node:test');
const request = require('supertest');

const tempRoot = path.resolve(__dirname, '.tmp-app');
process.env.DATA_DIR = path.join(tempRoot, 'data');
process.env.RENDER_DIR = path.join(tempRoot, 'renders');
process.env.RENDER_WIDTH = '360';
process.env.RENDER_HEIGHT = '640';
process.env.MOCK_AI = 'true';

const app = require('../src/app');
const { generateMock, parseAiResponse } = require('../src/services/ai.service');
let generatedPlanId;

before(async () => {
  assert.ok(tempRoot.startsWith(path.resolve(__dirname)));
  await fs.rm(tempRoot, { recursive: true, force: true });
});

after(async () => {
  assert.ok(tempRoot.startsWith(path.resolve(__dirname)));
  await fs.rm(tempRoot, { recursive: true, force: true });
});

test('health and dashboard are available', async () => {
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.status, 'ok');
  const dashboard = await request(app).get('/').expect(200);
  assert.match(dashboard.text, /Auto Edit Video/);
});

test('generation rejects invalid input and stores a valid storyboard', async () => {
  await request(app).post('/api/video-plans/generate').send({ niche: '' }).expect(400);
  const created = await request(app).post('/api/video-plans/generate').send({
    niche: 'quản lý thời gian', language: 'vi', tone: 'educational', durationSeconds: 15,
  }).expect(201);
  assert.equal(created.body.scenes.length, 6);
  assert.equal(created.body.status, 'draft');
  generatedPlanId = created.body.id;

  const detail = await request(app).get(`/api/video-plans/${created.body.id}`).expect(200);
  assert.equal(detail.body.title, created.body.title);
  const listing = await request(app).get('/api/video-plans').expect(200);
  assert.equal(listing.body[0].sceneCount, 6);
});

test('AI parser accepts fenced JSON and rejects malformed plans', () => {
  const plan = generateMock({ niche: 'focus', language: 'en', durationSeconds: 30 });
  const parsed = parseAiResponse('```json\n' + JSON.stringify(plan) + '\n```', 30);
  assert.equal(parsed.scenes.length, 6);
  const longPlan = generateMock({ niche: 'focus', language: 'en', durationSeconds: 60 });
  assert.equal(longPlan.scenes.length, 8);
  assert.ok(longPlan.scenes.every((scene) => scene.durationSeconds <= 8));
  assert.throws(() => parseAiResponse('{"topic":"missing fields"}', 30), /failed validation/);
});

test('render endpoint reaches ready with a playable MP4 and poster', { timeout: 90_000 }, async () => {
  await request(app).post(`/api/video-plans/${generatedPlanId}/render`).expect(202);
  let plan;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    plan = (await request(app).get(`/api/video-plans/${generatedPlanId}`).expect(200)).body;
    if (['ready', 'failed'].includes(plan.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(plan.status, 'ready', plan.error);
  const [video, poster] = await Promise.all([
    fs.stat(path.join(process.env.RENDER_DIR, `${generatedPlanId}.mp4`)),
    fs.stat(path.join(process.env.RENDER_DIR, `${generatedPlanId}.jpg`)),
  ]);
  assert.ok(video.size > 20_000);
  assert.ok(poster.size > 5_000);
});
