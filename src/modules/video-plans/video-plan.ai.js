const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');
const { videoPlanSchema, normalizeDurations } = require('./video-plan.schema');
const { AppError } = require('../../core/app-error');

const JSON_SHAPE = `{
  "topic": "specific angle",
  "hook": "opening line",
  "title": "platform title",
  "description": "short post caption",
  "scenes": [{
    "narration": "spoken sentence",
    "onScreenText": "short readable phrase",
    "visual": "specific b-roll direction",
    "durationSeconds": 4,
    "accent": "coral"
  }],
  "hashtags": ["#example"]
}`;

function buildPrompt({ niche, language, tone, durationSeconds }) {
  const languageName = language === 'vi' ? 'natural Vietnamese' : 'natural English';
  return `Act as a senior short-form video producer. Create one original ${durationSeconds}-second vertical video about "${niche}".

Write in ${languageName}. Use a ${tone} tone. Start with tension or curiosity, deliver one useful idea, and end with a concrete payoff or call to action. Create ${durationSeconds > 48 ? 'exactly 8' : '5-8'} scenes. Each scene must have concise narration, on-screen text readable in under two seconds, a filmable copyright-safe visual direction, duration, and one accent from: coral, mint, gold, sky, rose. Keep total scene duration close to ${durationSeconds} seconds. Use no copyrighted characters, brands, lyrics, or copied scripts.

Return only valid JSON matching this exact shape and no extra fields:
${JSON_SHAPE}`;
}

function parseAiResponse(text, targetDuration) {
  if (!text) throw new AppError('AI returned an empty response.', 502, 'AI_EMPTY_RESPONSE');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new AppError('AI returned invalid JSON.', 502, 'AI_INVALID_JSON');
  }
  const result = videoPlanSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError(`AI response failed validation at ${issue.path.join('.')}: ${issue.message}`, 502, 'AI_INVALID_PLAN');
  }
  return normalizeDurations(result.data, targetDuration);
}

async function generateWithGemini(input) {
  if (!process.env.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY is not configured.', 503, 'PROVIDER_NOT_CONFIGURED');
  }
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: buildPrompt(input),
    config: { responseMimeType: 'application/json' },
  });
  return parseAiResponse(response.text, input.durationSeconds);
}

async function generateWithOpenAI(input) {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError('OPENAI_API_KEY is not configured.', 503, 'PROVIDER_NOT_CONFIGURED');
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    input: buildPrompt(input),
    text: { format: { type: 'json_object' } },
  });
  return parseAiResponse(response.output_text, input.durationSeconds);
}

function generateMock({ niche, language, durationSeconds }) {
  const isVietnamese = language === 'vi';
  const copy = isVietnamese
    ? [
        ['Bạn không thiếu thời gian. Bạn đang đặt sai thứ tự.', 'ĐỪNG ĐỔ LỖI CHO THỜI GIAN', 'Cận cảnh một bàn làm việc lộn xộn chuyển sang tối giản'],
        ['Mỗi sáng, hãy chọn đúng một việc tạo ra kết quả lớn nhất.', 'CHỌN 1 VIỆC QUAN TRỌNG', 'Bàn tay khoanh một mục duy nhất trong sổ kế hoạch'],
        ['Làm việc đó trong hai mươi lăm phút trước khi mở tin nhắn.', '25 PHÚT KHÔNG XAO NHÃNG', 'Điện thoại úp xuống cạnh đồng hồ đếm giờ'],
        ['Sau đó nghỉ năm phút, đứng dậy và để bộ não phục hồi.', 'NGHỈ ĐỂ ĐI XA HƠN', 'Người làm việc bước ra ban công trong ánh sáng ban ngày'],
        ['Lặp lại ba vòng. Một buổi sáng tập trung sẽ thay đổi cả ngày.', '3 VÒNG. 1 NGÀY KHÁC BIỆT.', 'Ba dấu kiểm xuất hiện trên lịch tối giản'],
        ['Tắt thông báo và giữ một tờ giấy bên cạnh để ghi việc phát sinh.', 'BẢO VỆ SỰ TẬP TRUNG', 'Thông báo trên màn hình được tắt, một tờ ghi chú đặt cạnh bàn phím'],
        ['Cuối buổi, ghi lại điều đã hoàn thành thay vì chỉ nhìn việc còn lại.', 'ĐO KẾT QUẢ THẬT', 'Một dòng kết quả được viết dưới ba dấu kiểm'],
        ['Ngày mai, thử cách này trước chín giờ và tự xem kết quả.', 'BẮT ĐẦU TRƯỚC 9 GIỜ', 'Ánh nắng sớm trên thành phố, nhân vật bắt đầu làm việc'],
      ]
    : [
        ['You do not need more time. You need a better first move.', "TIME ISN'T THE PROBLEM", 'A cluttered desk transforms into a focused workspace'],
        ['Every morning, choose the one task that changes the outcome.', 'PICK THE ONE MOVE', 'A hand circles one priority in a paper planner'],
        ['Work on it for twenty-five minutes before opening messages.', '25 MINUTES. NO NOISE.', 'A phone turns face down beside a running timer'],
        ['Then take five minutes away and let your focus recover.', 'RECOVERY BUILDS FOCUS', 'A creator steps into daylight and takes a breath'],
        ['Repeat three rounds. One focused morning can reshape your day.', '3 ROUNDS. A BETTER DAY.', 'Three bold checks appear on a clean calendar'],
        ['Mute notifications and keep a note nearby for anything that interrupts.', 'PROTECT YOUR FOCUS', 'Notifications switch off beside a simple paper note'],
        ['At the end, record what moved forward instead of only what remains.', 'MEASURE REAL PROGRESS', 'A clear result is written beneath three completed checks'],
        ['Try it before nine tomorrow and measure what actually changes.', 'START BEFORE NINE', 'Morning light moves across a city workspace'],
      ];
  const accents = ['coral', 'mint', 'gold', 'sky', 'rose', 'mint', 'gold', 'coral'];
  const selectedCopy = durationSeconds > 48 ? copy : [...copy.slice(0, 5), copy.at(-1)];
  const baseDuration = durationSeconds / selectedCopy.length;
  return videoPlanSchema.parse({
    topic: isVietnamese ? `Cách tập trung sâu cho người bận rộn: ${niche}` : `A practical focus reset for ${niche}`,
    hook: copy[0][0],
    title: isVietnamese ? 'Thử quy tắc 25 phút vào sáng mai' : 'Try this 25-minute reset tomorrow',
    description: isVietnamese
      ? 'Một quy trình nhỏ, rõ ràng để bắt đầu ngày mới với công việc thật sự quan trọng.'
      : 'A small, repeatable routine for starting the day with the work that matters.',
    scenes: selectedCopy.map(([narration, onScreenText, visual], index) => ({
      narration,
      onScreenText,
      visual,
      durationSeconds: Number(baseDuration.toFixed(2)),
      accent: accents[index],
      backgroundAsset: index === 0
        ? 'demo-focus/distracted.jpg'
        : index === selectedCopy.length - 1
          ? 'demo-focus/complete.jpg'
          : 'demo-focus/focused.jpg',
    })),
    hashtags: isVietnamese ? ['#taptrung', '#nangsuat', '#kynang'] : ['#focus', '#productivity', '#habits'],
  });
}

async function generateVideoPlan(input) {
  if (process.env.MOCK_AI !== 'false') return generateMock(input);
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  if (provider === 'openai') return generateWithOpenAI(input);
  if (provider === 'gemini') return generateWithGemini(input);
  throw new AppError(`Unsupported AI_PROVIDER: ${provider}`, 503, 'INVALID_PROVIDER');
}

module.exports = { buildPrompt, parseAiResponse, generateMock, generateVideoPlan };
