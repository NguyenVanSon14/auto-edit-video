# Auto Edit Video

Ứng dụng tạo video dọc theo một quy trình duy nhất: nhập chủ đề, sinh storyboard, dựng MP4, xem trước và tải xuống. Chế độ mock chạy hoàn toàn cục bộ; khi cần nội dung AI thật có thể chọn Gemini hoặc OpenAI.

## Chạy nhanh

Yêu cầu Node.js 20 trở lên.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Mở `http://localhost:3001`. Cấu hình mặc định `MOCK_AI=true` không cần API key và không cần PostgreSQL hay FFmpeg cài toàn hệ thống.

## Cấu trúc dự án

```text
auto-edit-video/
├── .codex/skills/produce-short-video/  # Skill vận hành và kiểm tra workflow
├── .github/workflows/                  # GitHub Actions
├── assets/demo-focus/                  # Ảnh nền mẫu đã tạo cho video demo
├── data/                               # Dữ liệu runtime, không commit
├── public/
│   ├── css/                            # Giao diện
│   ├── js/                             # Logic dashboard trên trình duyệt
│   └── index.html
├── renders/                            # MP4 và poster, không commit
├── scripts/                            # Tiện ích chạy bằng CLI
├── src/
│   ├── core/                           # Cấu hình và thành phần dùng chung
│   ├── modules/
│   │   ├── health/                     # Health endpoint
│   │   └── video-plans/                # Toàn bộ workflow tạo và dựng video
│   ├── app.js                          # Ghép middleware và routes
│   └── server.js                       # Khởi động và dừng HTTP server
└── test/integration/                   # Test workflow từ API đến MP4
```

Mỗi tính năng nghiệp vụ nằm trong một thư mục dưới `src/modules/`. Module `video-plans` tự sở hữu schema, AI, lưu trữ, renderer, controller và routes; `src/core/` chỉ chứa hạ tầng dùng chung. Khi thêm tính năng mới, tạo module mới thay vì đưa thêm logic vào `app.js` hoặc `server.js`.

## Quy trình

1. Nhập production brief: chủ đề, mục tiêu, đối tượng, nền tảng, ngôn ngữ, phong cách hình ảnh và thời lượng 15-60 giây.
2. API tạo storyboard 5-8 cảnh và kiểm tra chặt cấu trúc đầu ra.
3. Sửa chữ trên màn hình, lời đọc, chỉ dẫn hình ảnh và lựa chọn voice-over cho từng dự án.
4. Kiểm tra toàn bộ storyboard và xác nhận duyệt. Dự án chưa duyệt không thể render.
5. Nhấn **Dựng MP4**. Job được xếp hàng và cập nhật tiến độ trên giao diện.
6. Renderer tạo video H.264 dọc 720x1280, hiệu ứng chuyển cảnh, poster và voice-over tùy chọn.
7. Xem trước hoặc tải file trong thư viện dự án.

Tài liệu chi tiết:

- [Quy trình sản xuất chuẩn](docs/PRODUCTION_WORKFLOW.md)
- [Nghiên cứu các công cụ AI video](docs/AI_VIDEO_BENCHMARK.md)

Video kết hợp ảnh nền thật và kinetic typography. Storyboard mock dùng bộ ảnh đồng nhất trong `assets/demo-focus/`; nội dung AI khác vẫn có thể dùng nền typography khi chưa có asset phù hợp. Mặc định renderer dùng audio im lặng; chỉ gọi Gemini TTS khi người dùng chủ động chọn trên giao diện. Trường `visual` trong mỗi cảnh là chỉ dẫn B-roll để mở rộng pipeline sau này.

## Dùng AI thật

Trong `.env`:

```dotenv
MOCK_AI=false
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview
GEMINI_TTS_VOICE=Kore
```

Hoặc đặt `AI_PROVIDER=openai`, `OPENAI_API_KEY` và `OPENAI_MODEL`. Không commit file `.env`.

## Lệnh chính

```powershell
npm run dev          # Server tự reload
npm test             # Test API, schema và render MP4 thật
npm run check        # Test và audit dependency
npm run assets:prepare # Cắt lại ba ảnh demo từ storyboard atlas
npm run render:demo  # Tạo renders/demo.mp4
```

## API

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| `GET` | `/api/health` | Kiểm tra server |
| `POST` | `/api/video-plans/generate` | Tạo storyboard |
| `GET` | `/api/video-plans` | Danh sách dự án |
| `GET` | `/api/video-plans/:id` | Chi tiết và progress |
| `PATCH` | `/api/video-plans/:id` | Sửa storyboard và lựa chọn voice |
| `POST` | `/api/video-plans/:id/render` | Xếp hàng dựng MP4 |
| `DELETE` | `/api/video-plans/:id` | Xóa dự án và file render |

Dữ liệu runtime nằm trong `data/`, video trong `renders/`; cả hai đã được loại khỏi Git, ngoại trừ file `.gitkeep`.
