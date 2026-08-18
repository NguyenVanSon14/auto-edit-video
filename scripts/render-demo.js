require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');
const { generateMock } = require('../src/modules/video-plans/video-plan.ai');
const { renderPlan } = require('../src/modules/video-plans/video-plan.renderer');

async function main() {
  const input = { niche: 'làm việc tập trung', language: 'vi', tone: 'energetic', durationSeconds: 30, voiceProvider: 'none' };
  const plan = {
    id: 'demo',
    ...input,
    ...generateMock(input),
  };
  const result = await renderPlan(plan, (progress) => process.stdout.write(`\rRendering: ${progress}%`));
  const size = (await fs.stat(result.outputPath)).size;
  console.log(`\nCreated ${path.relative(process.cwd(), result.outputPath)} (${Math.round(size / 1024)} KB)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
