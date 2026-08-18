const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function resolveFromRoot(value, fallback) {
  return path.resolve(rootDir, value || fallback);
}

module.exports = {
  rootDir,
  port: Number.parseInt(process.env.PORT || '3001', 10),
  dataDir: resolveFromRoot(process.env.DATA_DIR, 'data'),
  renderDir: resolveFromRoot(process.env.RENDER_DIR, 'renders'),
  publicDir: path.join(rootDir, 'public'),
};
