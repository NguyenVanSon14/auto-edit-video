const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const config = require('../config');
const store = require('./planStore.service');
const { AppError } = require('../lib/errors');

const COLORS = {
  coral: '#ff6b57',
  mint: '#55d6a7',
  gold: '#ffc857',
  sky: '#59b9ff',
  rose: '#ff77a8',
};
const WIDTH = Number.parseInt(process.env.RENDER_WIDTH || '720', 10);
const HEIGHT = Number.parseInt(process.env.RENDER_HEIGHT || '1280', 10);
const FPS = 30;
const TRANSITION = 0.35;
let renderQueue = Promise.resolve();

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapText(text, maxChars) {
  const words = text.trim().split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function textBlock(lines, x, y, lineHeight, attributes) {
  return `<text x="${x}" y="${y}" ${attributes}>${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join('')}</text>`;
}

function sceneSvg(plan, scene, index) {
  const accent = COLORS[scene.accent] || COLORS.coral;
  const headline = wrapText(scene.onScreenText.toUpperCase(), 18);
  const narration = wrapText(scene.narration, 35);
  const visual = wrapText(scene.visual, 42);
  const sceneNumber = String(index + 1).padStart(2, '0');
  const visualLabel = plan.language === 'vi' ? 'GỢI Ý HÌNH ẢNH' : 'VISUAL DIRECTION';
  return `
  <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#111315"/>
    <rect x="0" y="0" width="${WIDTH}" height="28" fill="${accent}"/>
    <rect x="52" y="105" width="616" height="500" rx="4" fill="#1b1e21" stroke="#34383c" stroke-width="2"/>
    <path d="M52 606 L668 105" stroke="${accent}" stroke-opacity="0.22" stroke-width="90"/>
    <rect x="52" y="645" width="82" height="8" fill="${accent}"/>
    <text x="52" y="76" fill="#8e969d" font-family="Arial, sans-serif" font-size="19" font-weight="700">AUTO EDIT / VERTICAL STORY</text>
    <text x="668" y="76" fill="${accent}" text-anchor="end" font-family="Arial, sans-serif" font-size="21" font-weight="700">${sceneNumber}</text>
    ${textBlock(headline, 74, 250, 82, 'fill="#f7f7f2" font-family="Arial, sans-serif" font-size="66" font-weight="800"')}
    ${textBlock(narration, 52, 745, 42, 'fill="#edf0ed" font-family="Arial, sans-serif" font-size="30" font-weight="400"')}
    <rect x="52" y="1018" width="616" height="1" fill="#34383c"/>
    <text x="52" y="1060" fill="#8e969d" font-family="Arial, sans-serif" font-size="18" font-weight="700">${visualLabel}</text>
    ${textBlock(visual, 52, 1102, 29, 'fill="#c7ccca" font-family="Arial, sans-serif" font-size="21"')}
    <rect x="52" y="1213" width="616" height="5" fill="#292d30"/>
    <rect x="52" y="1213" width="${Math.round((616 * (index + 1)) / plan.scenes.length)}" height="5" fill="${accent}"/>
  </svg>`;
}

async function makeSceneImages(plan, workDir, onProgress) {
  for (let index = 0; index < plan.scenes.length; index += 1) {
    const target = path.join(workDir, `scene-${index}.png`);
    await sharp(Buffer.from(sceneSvg(plan, plan.scenes[index], index))).png().toFile(target);
    onProgress(Math.round(8 + ((index + 1) / plan.scenes.length) * 32));
  }
}

function buildFfmpegArgs(plan, workDir, outputPath) {
  const args = ['-y'];
  for (let index = 0; index < plan.scenes.length; index += 1) {
    args.push('-loop', '1', '-framerate', String(FPS), '-t', String(plan.scenes[index].durationSeconds), '-i', path.join(workDir, `scene-${index}.png`));
  }
  const totalDuration = plan.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0) - TRANSITION * (plan.scenes.length - 1);
  args.push('-f', 'lavfi', '-t', String(totalDuration), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100');

  const filters = plan.scenes.map((scene, index) =>
    `[${index}:v]scale=${WIDTH}:${HEIGHT},fps=${FPS},settb=AVTB,format=yuv420p,setpts=PTS-STARTPTS[v${index}]`,
  );
  let previous = 'v0';
  let elapsed = plan.scenes[0].durationSeconds;
  for (let index = 1; index < plan.scenes.length; index += 1) {
    const output = index === plan.scenes.length - 1 ? 'video' : `x${index}`;
    const offset = Math.max(0, elapsed - TRANSITION * index);
    filters.push(`[${previous}][v${index}]xfade=transition=fade:duration=${TRANSITION}:offset=${offset.toFixed(2)}[${output}]`);
    previous = output;
    elapsed += plan.scenes[index].durationSeconds;
  }

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '[video]', '-map', `${plan.scenes.length}:a`,
    '-r', String(FPS), '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart',
    '-progress', 'pipe:2', '-nostats', outputPath,
  );
  return { args, totalDuration };
}

function runFfmpeg(args, totalDuration, onProgress) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr = `${stderr}${text}`.slice(-8000);
      const match = text.match(/out_time_us=(\d+)/);
      if (match) {
        const ratio = Number(match[1]) / 1_000_000 / totalDuration;
        onProgress(Math.min(96, Math.round(45 + ratio * 51)));
      }
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-1200)}`));
    });
  });
}

async function renderPlan(plan, onProgress = () => {}) {
  if (!ffmpegPath) throw new AppError('Bundled FFmpeg binary is unavailable.', 500, 'FFMPEG_UNAVAILABLE');
  const workDir = path.join(config.renderDir, '.work', plan.id);
  const outputPath = path.join(config.renderDir, `${plan.id}.mp4`);
  const posterPath = path.join(config.renderDir, `${plan.id}.jpg`);
  await fs.rm(workDir, { recursive: true, force: true });
  await fs.mkdir(workDir, { recursive: true });
  await fs.mkdir(config.renderDir, { recursive: true });
  try {
    onProgress(5);
    await makeSceneImages(plan, workDir, onProgress);
    await sharp(path.join(workDir, 'scene-0.png')).jpeg({ quality: 88 }).toFile(posterPath);
    const { args, totalDuration } = buildFfmpegArgs(plan, workDir, outputPath);
    await runFfmpeg(args, totalDuration, onProgress);
    onProgress(100);
    return { outputPath, outputUrl: `/renders/${plan.id}.mp4`, posterUrl: `/renders/${plan.id}.jpg` };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

function enqueueRender(id) {
  renderQueue = renderQueue.then(async () => {
    const plan = await store.findById(id);
    if (!plan || plan.status === 'rendering') return;
    await store.update(id, { status: 'rendering', progress: 1, error: null });
    try {
      const result = await renderPlan(plan, (progress) => {
        store.update(id, { progress }).catch((error) => console.error('[render progress]', error.message));
      });
      await store.update(id, { status: 'ready', progress: 100, outputUrl: result.outputUrl, posterUrl: result.posterUrl });
    } catch (error) {
      console.error('[render]', error);
      await store.update(id, { status: 'failed', progress: 0, error: error.message });
    }
  });
  return renderQueue;
}

module.exports = { renderPlan, enqueueRender, buildFfmpegArgs, wrapText };
