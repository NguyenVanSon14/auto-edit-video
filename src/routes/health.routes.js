const express = require('express');
const router = express.Router();

/**
 * GET /api/health
 * Returns server status and current timestamp.
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'auto-edit-video',
    mockAi: process.env.MOCK_AI !== 'false',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
