# Seedance Omni — API upload & tạo video (ảnh + video + audio ref)

> Hướng dẫn ngắn gọn để gửi khách tích hợp API **79AI** (`domain=79ai.net`). Mọi endpoint gọi tới **Gommo**; file media trên `ai-cdn.gommo.net`. Áp dụng cho **Seedance 2.0 Omni** và các model video **Omni / withReference** tương tự (Kling Omni, VEO Omni…).

**English summary:** Upload images & videos via Gommo CDN → pass URLs in `references[]`, `video_urls[]`, `audio_urls[]` when creating a video job → poll until `result_url` is ready. Audio has **no public upload endpoint** in current API — use a public HTTPS URL or TTS output URL.

---

## TL;DR — 3 bước

```
① Upload từng file → lấy URL trên ai-cdn.gommo.net
② POST /ai/jobs/video/{model_slug}  (gửi references + video_urls + audio_urls)
③ POST /ai/jobs/{id_base}?media=video  (poll đến khi có result_url)
```

---

## 0. Lấy model slug & giới hạn ref

Gọi catalog **trước** khi create:

```http
POST https://v2.api.gommo.net/ai/models?type=video&domain=79ai.net
Content-Type: application/x-www-form-urlencoded

type=video
domain=79ai.net
access_token=YOUR_TOKEN
project_id=default
```

Tìm model có tên kiểu **Seedance 2.0 Omni** (field `model` hoặc `slug` — đây là `{model_slug}` dùng ở bước ②).

**Giới hạn ref** (vd. Web UI: 6 ảnh + 2 video + 2 audio) nằm trong response:

```json
{
  "model": "seedance-2-omni",
  "name": "Seedance 2.0 - Omni",
  "withReference": true,
  "configs": {
    "reference": {
      "limits": {
        "image": 6,
        "video": 2,
        "audio": 2
      }
    }
  }
}
```

> Luôn đọc `configs.reference.limits` từ **models_list** — không hardcode 6/2/2 nếu model khác.

| Loại file trên UI | Field API khi create job | Upload API |
|-------------------|--------------------------|------------|
| Ảnh tham chiếu (ref image) | `references[]` | `POST /ai/upload/image` |
| Video tham chiếu | `video_urls[]` hoặc `video_url` | `POST /ai/upload/video` |
| Audio tham chiếu | `audio_urls[]` | **Không có endpoint upload audio công khai** — xem [Bước 1c](#1c-audio-tham-chiếu) |

**Quan trọng — đừng nhầm field:**

| Field | Dùng cho |
|-------|----------|
| `images[]` | **Start / end frame** (ảnh khung đầu-cuối) — **không** dùng cho ref thành phần Omni |
| `references[]` | **Ảnh ref** (character, style, component…) |
| `video_urls[]` | **Video ref** |
| `audio_urls[]` | **Audio ref** |

---

## 1. Upload file → lấy URL CDN

Mọi URL trả về dạng:

```
https://ai-cdn.gommo.net/ai/images/{bucket}/{file_id}.jpg
https://ai-cdn.gommo.net/ai/videos/{bucket}/{file_id}.mp4
https://ai-cdn.gommo.net/ai/audio/{bucket}/{file_id}.mp3   ← thường từ TTS output
```

### 1a. Upload ảnh

```http
POST https://v2.api.gommo.net/ai/upload/image
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data

file=(binary)
file_name=ref-01.jpg
size=2048576
domain=79ai.net
project_id=default
access_token=YOUR_TOKEN
```

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg"
  }
}
```

Lặp lại cho tối đa **N ảnh** (theo `limits.image`, vd. 6).

### 1b. Upload video

```http
POST https://v2.api.gommo.net/ai/upload/video
Authorization: Bearer YOUR_TOKEN
Content-Type: multipart/form-data

video_file=(binary)     ← tên field là video_file, KHÁC ảnh
file_name=ref-motion.mp4
size=8388608
domain=79ai.net
project_id=default
access_token=YOUR_TOKEN
```

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/f1e2d3c4b5a69781.mp4"
  }
}
```

Lặp lại cho tối đa **N video** (theo `limits.video`, vd. 2).

Giới hạn gợi ý: MP4/WebM/MOV, thường ≤ 50–100 MB, duration theo `configs.reference` của model.

### 1c. Audio tham chiếu

Hiện **không có** `POST /ai/upload/audio` trong API công khai (chỉ có upload **image** và **video**).

**Cách lấy URL audio hợp lệ cho `audio_urls[]`:**

| Cách | Mô tả |
|------|--------|
| **A. URL HTTPS công khai** | Host file `.mp3` / `.wav` trên S3, CDN, server của bạn |
| **B. Output TTS** | Tạo giọng qua `POST /ai/audio` (`action_type=create`) → dùng `audioInfo.file_url` (host `ai-cdn.gommo.net/ai/audio/...`) |
| **C. URL có sẵn** | Link audio public bất kỳ mà upstream chấp nhận |

Ví dụ URL từ TTS:

```
https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/aud_tts_u1v2.mp3
```

Gửi tối đa **N audio** trong `audio_urls[]` (theo `limits.audio`, vd. 2) — **chỉ khi model hỗ trợ** (`configs.reference` cho phép audio).

---

## 2. Tạo job Seedance Omni

```http
POST https://v2.api.gommo.net/ai/jobs/video/{model_slug}
Content-Type: application/x-www-form-urlencoded
Authorization: Bearer YOUR_TOKEN
```

### Payload mẫu đầy đủ (2 ảnh + 1 video + 1 audio)

Thay `{model_slug}` bằng slug thật từ models_list (vd. tên model Seedance Omni).

**JSON logic (dễ đọc):**

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "access_token": "YOUR_TOKEN",
  "prompt": "Cinematic scene combining character, motion reference and background music rhythm",
  "ratio": "16:9",
  "resolution": "1080p",
  "duration": "5",
  "mode": "standard",
  "references": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/ref_style_a1b2.jpg" }
  ],
  "video_urls": [
    { "url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/f1e2d3c4b5a69781.mp4" }
  ],
  "audio_urls": [
    { "url": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/beat_i9j0.mp3" }
  ]
}
```

**Form-encoded (gửi thật):**

```
domain=79ai.net
project_id=default
access_token=YOUR_TOKEN
prompt=Cinematic+scene+combining+character+motion+and+music
ratio=16%3A9
resolution=1080p
duration=5
mode=standard
references[0][url]=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Fimages%2Fd150abd4fb1b83d4%2Fe5b06f9c1e148a20.jpg
references[1][url]=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Fimages%2Fd150abd4fb1b83d4%2Fref_style_a1b2.jpg
video_urls[0][url]=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Fvideos%2Fa1b2c3d4e5f67890%2Ff1e2d3c4b5a69781.mp4
audio_urls[0][url]=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Faudio%2Fa1b2c3d4e5f67890%2Fbeat_i9j0.mp3
```

### Payload tối đa (6 + 2 + 2) — cấu trúc

```json
{
  "references": [
    { "url": "https://ai-cdn.gommo.net/ai/images/.../ref1.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/.../ref2.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/.../ref3.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/.../ref4.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/.../ref5.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/.../ref6.jpg" }
  ],
  "video_urls": [
    { "url": "https://ai-cdn.gommo.net/ai/videos/.../v1.mp4" },
    { "url": "https://ai-cdn.gommo.net/ai/videos/.../v2.mp4" }
  ],
  "audio_urls": [
    { "url": "https://ai-cdn.gommo.net/ai/audio/.../a1.mp3" },
    { "url": "https://ai-cdn.gommo.net/ai/audio/.../a2.mp3" }
  ]
}
```

**Create response (job async):**

```json
{
  "success": true,
  "data": {
    "id_base": "vid_seedance_001",
    "status": "PENDING"
  },
  "raw": {
    "videoInfo": {
      "status": "MEDIA_GENERATION_STATUS_PENDING",
      "result_url": null
    }
  }
}
```

Lưu `id_base` để poll.

---

## 3. Poll trạng thái

```http
POST https://v2.api.gommo.net/ai/jobs/vid_seedance_001?media=video
Content-Type: application/x-www-form-urlencoded

domain=79ai.net
access_token=YOUR_TOKEN
```

Poll mỗi **3–5 giây**, tối đa ~30 phút.

**Đang xử lý:**

```json
{
  "raw": {
    "videoInfo": {
      "status": "MEDIA_GENERATION_STATUS_ACTIVE",
      "result_url": null
    }
  }
}
```

**Thành công:**

```json
{
  "data": {
    "id_base": "vid_seedance_001",
    "status": "SUCCESS",
    "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/output_final.mp4"
  },
  "raw": {
    "videoInfo": {
      "status": "MEDIA_GENERATION_STATUS_SUCCESSFUL",
      "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/output_final.mp4"
    }
  }
}
```

---

## cURL — copy/paste

```bash
TOKEN="your_access_token"
DOMAIN="79ai.net"
MODEL="seedance-2-omni"   # thay bằng slug từ models_list

# 1) Upload ảnh ref
IMG_URL=$(curl -s -X POST "https://v2.api.gommo.net/ai/upload/image" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@ref.jpg" -F "file_name=ref.jpg" \
  -F "domain=$DOMAIN" -F "project_id=default" -F "access_token=$TOKEN" \
  | jq -r '.data.url')

# 2) Upload video ref
VID_URL=$(curl -s -X POST "https://v2.api.gommo.net/ai/upload/video" \
  -H "Authorization: Bearer $TOKEN" \
  -F "video_file=@ref.mp4" -F "file_name=ref.mp4" \
  -F "domain=$DOMAIN" -F "project_id=default" -F "access_token=$TOKEN" \
  | jq -r '.data.url')

# 3) Audio — URL có sẵn hoặc từ TTS output
AUD_URL="https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/beat.mp3"

# 4) Create job
CREATE=$(curl -s -X POST "https://v2.api.gommo.net/ai/jobs/video/$MODEL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "domain=$DOMAIN&project_id=default&access_token=$TOKEN" \
  -d "prompt=cinematic+scene&ratio=16:9&duration=5" \
  --data-urlencode "references[0][url]=$IMG_URL" \
  --data-urlencode "video_urls[0][url]=$VID_URL" \
  --data-urlencode "audio_urls[0][url]=$AUD_URL")

JOB_ID=$(echo "$CREATE" | jq -r '.data.id_base')
echo "Job ID: $JOB_ID"

# 5) Poll
curl -s -X POST "https://v2.api.gommo.net/ai/jobs/$JOB_ID?media=video" \
  -H "Authorization: Bearer $TOKEN" \
  -d "domain=$DOMAIN&access_token=$TOKEN"
```

---

## FAQ / Lỗi thường gặp

| Vấn đề | Nguyên nhân | Cách xử lý |
|--------|-------------|------------|
| Doc chỉ có image ref | Doc cũ thiếu `video_urls` / `audio_urls` | Dùng field riêng theo bảng trên — **không** gom video/audio vào `references[]` |
| Đặt ref ảnh vào `images[]` | `images[]` chỉ cho start/end frame | Ref Omni → `references[]` |
| Audio không upload được | Không có `/ai/upload/audio` | Dùng URL HTTPS public hoặc TTS `file_url` |
| Vượt giới hạn 6/2/2 | Gửi quá số slot | Đọc `configs.reference.limits` từ models_list |
| `ratio` / `duration` reject | Tự đoán enum | Chỉ dùng giá trị từ `model.ratios`, `model.durations` |
| Poll mãi không xong | Job nặng hoặc lỗi upstream | Poll 3–5s; nếu status FAILED → xem message trong `videoInfo` |

---

## So sánh Web UI vs API

| Web UI (Seedance Omni) | API tương đương |
|------------------------|-----------------|
| Thêm ảnh ref (≤6) | Upload → `references[n][url]` |
| Thêm video ref (≤2) | Upload → `video_urls[n][url]` |
| Thêm audio ref (≤2) | URL public / TTS → `audio_urls[n][url]` |
| Prompt + ratio + duration | Cùng field trong create job |
| Nút Generate | `POST /ai/jobs/video/{model_slug}` |
| Xem tiến độ | Poll `POST /ai/jobs/{id_base}?media=video` |

---

## Tài liệu liên quan

- Chi tiết API đầy đủ: [GOMMO-API.md](./GOMMO-API.md)
- Upload ảnh/video: [§4.2](./GOMMO-API.md#42-upload-ảnh), [§4.3](./GOMMO-API.md#43-upload-video)
- Video ref / audio ref: [§4.7.5](./GOMMO-API.md#475-reference-video), [§4.7.6](./GOMMO-API.md#476-reference-audio)

---

*Cập nhật: 2026-07-29 · 79AI (`domain=79ai.net`) · API host Gommo · CDN `ai-cdn.gommo.net`*
