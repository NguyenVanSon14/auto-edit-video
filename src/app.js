require('dotenv').config();
const express = require('express');
const cors = require('cors');
const config = require('./core/config');
const healthRoutes = require('./modules/health/health.routes');
const videoPlanRoutes = require('./modules/video-plans/video-plan.routes');
const { AppError } = require('./core/app-error');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '64kb' }));
app.use(express.static(config.publicDir));
app.use('/renders', express.static(config.renderDir, { fallthrough: false }));
app.use('/api/health', healthRoutes);
app.use('/api/video-plans', videoPlanRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'API route not found.' } });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const known = error instanceof AppError;
  const status = known ? error.status : 500;
  if (!known) console.error('[unhandled]', error);
  return res.status(status).json({
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : 'An unexpected error occurred.',
    },
  });
});

module.exports = app;
