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

## Quy trình

1. Nhập chủ đề, ngôn ngữ, phong cách và thời lượng 15-60 giây.
2. API tạo storyboard 5-8 cảnh và kiểm tra chặt cấu trúc đầu ra.
3. Nhấn **Dựng MP4**. Job được xếp hàng và cập nhật tiến độ trên giao diện.
4. Renderer tạo video H.264 dọc 720x1280, audio track im lặng, hiệu ứng chuyển cảnh và poster.
5. Xem trước hoặc tải file trong thư viện dự án.

Đây là phong cách kinetic typography, nên video chạy được mà không phụ thuộc kho stock, bản quyền nhạc hoặc dịch vụ TTS. Trường `visual` trong mỗi cảnh là chỉ dẫn B-roll để mở rộng pipeline sau này.

## Dùng AI thật

Trong `.env`:

```dotenv
MOCK_AI=false
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

Hoặc đặt `AI_PROVIDER=openai`, `OPENAI_API_KEY` và `OPENAI_MODEL`. Không commit file `.env`.

## Lệnh chính

```powershell
npm run dev          # Server tự reload
npm test             # Test API, schema và render MP4 thật
npm run check        # Test và audit dependency
npm run render:demo  # Tạo renders/demo.mp4
```

## API

| Method | Endpoint | Chức năng |
| --- | --- | --- |
| `GET` | `/api/health` | Kiểm tra server |
| `POST` | `/api/video-plans/generate` | Tạo storyboard |
| `GET` | `/api/video-plans` | Danh sách dự án |
| `GET` | `/api/video-plans/:id` | Chi tiết và progress |
| `POST` | `/api/video-plans/:id/render` | Xếp hàng dựng MP4 |
| `DELETE` | `/api/video-plans/:id` | Xóa dự án và file render |

Dữ liệu runtime nằm trong `data/`, video trong `renders/`; cả hai đã được loại khỏi Git, ngoại trừ file `.gitkeep`.
