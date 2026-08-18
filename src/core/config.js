const path = require('node:path');

const rootDir = path.resolve(__dirname, '..', '..');

function resolveFromRoot(value, fallback) {
  return path.resolve(rootDir, value || fallback);
}

const dataDir = resolveFromRoot(process.env.DATA_DIR, 'data');

module.exports = {
  rootDir,
  port: Number.parseInt(process.env.PORT || '3001', 10),
  dataDir,
  mediaDir: process.env.MEDIA_DIR ? resolveFromRoot(process.env.MEDIA_DIR) : path.join(dataDir, 'media'),
  renderDir: resolveFromRoot(process.env.RENDER_DIR, 'renders'),
  publicDir: path.join(rootDir, 'public'),
};
