const express = require('express');
const router = express.Router();
const { generate, list, detail, update, prepareMedia, render, remove } = require('./video-plan.controller');

// POST /api/video-plans/generate  — Generate a new video plan via AI
router.post('/generate', generate);

// POST /api/video-plans/:id/media     - Generate context-specific scene images
router.post('/:id/media', prepareMedia);

// POST /api/video-plans/:id/render    - Queue an MP4 render
router.post('/:id/render', render);

// PATCH /api/video-plans/:id         - Edit a storyboard before rendering
router.patch('/:id', update);

// GET /api/video-plans             — List all saved video plans
router.get('/', list);

// GET /api/video-plans/:id         — Get one video plan by ID
router.get('/:id', detail);

// DELETE /api/video-plans/:id      — Delete one video plan by ID
router.delete('/:id', remove);

module.exports = router;
