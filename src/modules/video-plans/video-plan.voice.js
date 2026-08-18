const fs = require('node:fs/promises');
const { GoogleGenAI } = require('@google/genai');
const { AppError } = require('../../core/app-error');

function pcmToWav(pcmData, sampleRate = 24_000, channels = 1, bitDepth = 16) {
  const pcm = Buffer.isBuffer(pcmData) ? pcmData : Buffer.from(pcmData);
  const header = Buffer.alloc(44);
  const bytesPerSample = bitDepth / 8;
  const byteRate = sampleRate * channels * bytesPerSample;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * bytesPerSample, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function voicePrompt(plan) {
  const language = plan.language === 'vi' ? 'Vietnamese' : 'English';
  const narration = plan.scenes.map((scene) => scene.narration).join('\n');
  return `Read the following ${language} short-video narration exactly as written. Use a ${plan.tone} delivery, natural pacing, clear pronunciation, and brief pauses between lines. Fit the complete reading into about ${plan.durationSeconds} seconds. Do not add any words.\n\n${narration}`;
}

async function generateVoiceover(plan, targetPath) {
  if (plan.voiceProvider !== 'gemini') return null;
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY is required for Gemini voice-over.', 503, 'VOICE_PROVIDER_NOT_CONFIGURED');
  }
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const interaction = await client.interactions.create({
    model: process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview',
    input: voicePrompt(plan),
    response_format: { type: 'audio' },
    generation_config: {
      speech_config: [{ voice: process.env.GEMINI_TTS_VOICE || 'Kore' }],
    },
  });
  const encodedAudio = interaction.output_audio?.data;
  if (!encodedAudio) {
    throw new AppError('Gemini TTS returned no audio.', 502, 'VOICE_EMPTY_RESPONSE');
  }
  await fs.writeFile(targetPath, pcmToWav(Buffer.from(encodedAudio, 'base64')));
  return targetPath;
}

module.exports = { pcmToWav, voicePrompt, generateVoiceover };
