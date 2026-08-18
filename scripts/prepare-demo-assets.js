const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const assetDir = path.join(projectRoot, 'assets', 'demo-focus');
const atlasPath = path.join(assetDir, 'storyboard-atlas.png');

async function main() {
  const metadata = await sharp(atlasPath).metadata();
  if (!metadata.width || !metadata.height || metadata.width % 3 !== 0) {
    throw new Error('Storyboard atlas must contain three equal vertical panels.');
  }
  const panelWidth = metadata.width / 3;
  const names = ['distracted', 'focused', 'complete'];
  await Promise.all(names.map((name, index) =>
    sharp(atlasPath)
      .extract({ left: panelWidth * index, top: 0, width: panelWidth, height: metadata.height })
      .resize(720, 1280, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88, mozjpeg: true })
      .toFile(path.join(assetDir, `${name}.jpg`)),
  ));
  const files = await fs.readdir(assetDir);
  console.log(`Prepared ${files.filter((file) => file.endsWith('.jpg')).length} demo scene backgrounds.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
