const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
const required = [
  'src/schemas/videoPlan.schema.js',
  'src/services/ai.service.js',
  'src/services/render.service.js',
  'public/index.html',
  'README.md',
];

for (const relativePath of required) {
  if (!fs.existsSync(path.join(projectRoot, relativePath))) {
    console.error(`Missing required workflow file: ${relativePath}`);
    process.exit(1);
  }
}

const result = spawnSync(process.execPath, ['--test'], { cwd: projectRoot, stdio: 'inherit', windowsHide: true });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
