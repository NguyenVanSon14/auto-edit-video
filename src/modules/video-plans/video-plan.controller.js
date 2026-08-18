const fs = require('node:fs/promises');
const path = require('node:path');
const store = require('./video-plan.store');
const { generateVideoPlan } = require('./video-plan.ai');
const { enqueueRender } = require('./video-plan.renderer');
const { generateRequestSchema, updateVideoPlanSchema } = require('./video-plan.schema');
const { AppError } = require('../../core/app-error');
const config = require('../../core/config');

async function generate(req, res) {
  const parsed = generateRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(`${issue.path.join('.') || 'request'}: ${issue.message}`, 400, 'INVALID_REQUEST');
  }
  const aiResult = await generateVideoPlan(parsed.data);
  const videoPlan = await store.create({ ...parsed.data, ...aiResult });
  res.status(201).json(videoPlan);
}

async function list(req, res) {
  const plans = await store.list();
  res.json(plans.map(({ scenes, ...plan }) => ({ ...plan, sceneCount: scenes.length })));
}

async function detail(req, res) {
  const videoPlan = await store.findById(req.params.id);
  if (!videoPlan) throw new AppError('Video plan not found.', 404, 'PLAN_NOT_FOUND');
  res.json(videoPlan);
}

async function update(req, res) {
  const existing = await store.findById(req.params.id);
  if (!existing) throw new AppError('Video plan not found.', 404, 'PLAN_NOT_FOUND');
  if (['queued', 'rendering'].includes(existing.status)) {
    throw new AppError('Wait for the current render to finish before editing.', 409, 'PLAN_BUSY');
  }
  const parsed = updateVideoPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new AppError(`${issue.path.join('.') || 'request'}: ${issue.message}`, 400, 'INVALID_REQUEST');
  }
  const changesProduction = Object.keys(parsed.data).some((key) => key !== 'approvedForRender');
  await Promise.allSettled([
    fs.rm(path.join(config.renderDir, `${existing.id}.mp4`), { force: true }),
    fs.rm(path.join(config.renderDir, `${existing.id}.jpg`), { force: true }),
  ]);
  const videoPlan = await store.update(existing.id, {
    ...parsed.data,
    approvedForRender: changesProduction ? false : parsed.data.approvedForRender,
    status: 'draft',
    progress: 0,
    outputUrl: null,
    posterUrl: null,
    error: null,
  });
  res.json(videoPlan);
}

async function render(req, res) {
  const plan = await store.findById(req.params.id);
  if (!plan) throw new AppError('Video plan not found.', 404, 'PLAN_NOT_FOUND');
  if (!plan.approvedForRender) {
    throw new AppError('Review and approve the storyboard before rendering.', 409, 'STORYBOARD_NOT_APPROVED');
  }
  if (plan.status === 'rendering') return res.status(202).json(plan);
  await store.update(plan.id, { status: 'queued', progress: 0, error: null });
  enqueueRender(plan.id);
  return res.status(202).json({ ...plan, status: 'queued', progress: 0 });
}

async function remove(req, res) {
  const deleted = await store.remove(req.params.id);
  if (!deleted) throw new AppError('Video plan not found.', 404, 'PLAN_NOT_FOUND');
  await Promise.allSettled([
    fs.rm(path.join(config.renderDir, `${req.params.id}.mp4`), { force: true }),
    fs.rm(path.join(config.renderDir, `${req.params.id}.jpg`), { force: true }),
  ]);
  res.status(204).end();
}

module.exports = { generate, list, detail, update, render, remove };
