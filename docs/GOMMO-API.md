# 79AI API (Gommo) — Hướng dẫn tích hợp

> Tài liệu API cho partner **79AI** (`domain=79ai.net`). Mọi request gọi tới **Gommo** (`v2.api.gommo.net`, `api.gommo.net`); file media trên CDN `ai-cdn.gommo.net`.

---

## Mục lục

1. [Kiến trúc & Base URL](#1-kiến-trúc--base-url)
   - [1.1 CDN media vs domain tenant](#11-cdn-media-vs-domain-tenant)
2. [Xác thực](#2-xác-thực)
3. [Envelope chuẩn & lỗi](#3-envelope-chuẩn--lỗi)
4. [API Reference — Request & Response đầy đủ](#4-api-reference--request--response-đầy-đủ)
   - [4.1 Danh sách model](#41-danh-sách-model)
   - [4.2 Upload ảnh](#42-upload-ảnh)
   - [4.3 Upload video](#43-upload-video)
   - [4.4 Tạo job — response chung](#44-tạo-job--response-chung)
   - [4.5 Poll job — image / video / music](#45-poll-job--image--video--music)
   - [4.6 Tạo ảnh (image)](#46-tạo-ảnh-image)
   - [4.7 Tạo video (video) — các mode](#47-tạo-video-video--các-mode)
   - [4.8 Tạo nhạc (music)](#48-tạo-nhạc-music)
   - [4.9 TTS / Audio API](#49-tts--audio-api)
   - [4.10 Avatar lip-sync](#410-avatar-lip-sync)
   - [4.11 Utility jobs](#411-utility-jobs)
   - [4.12 Platform bridge](#412-platform-bridge)
   - [4.13 Seedance Omni — multi ref (ảnh + video + audio)](#413-seedance-omni--multi-ref-ảnh--video--audio)
5. [Danh sách Job Type](#5-danh-sách-job-type)
   - [Doc gửi khách (Seedance Omni)](#doc-gửi-khách-seedance-omni)
6. [Flow tích hợp chuẩn](#6-flow-tích-hợp-chuẩn)
7. [Quy tắc quan trọng](#7-quy-tắc-quan-trọng)
8. [File tham chiếu trong repo](#8-file-tham-chiếu-trong-repo)

---

## 1. Kiến trúc & Base URL

| Host | Mục đích |
|------|----------|
| `https://v2.api.gommo.net` | Job media: models, create job, poll, upload |
| `https://api.gommo.net` | Auth, TTS/audio, me, newsfeed |

| Cách gọi | Route | Upstream |
|----------|-------|----------|
| Trực tiếp Gommo | `/api/platform/gw.php/v2/...` | `v2.api.gommo.net` |
| Platform bridge | `/api/platform/job-*.php` | Bridge PHP + merchant token |

```env
GOMMO_API_BASE_URL=https://v2.api.gommo.net
GOMMO_AUTH_BASE_URL=https://api.gommo.net
GOMMO_ACCESS_TOKEN=          # Merchant token (server-side)
GOMMO_API_DOMAIN=79ai.net   # Tenant domain — KHÔNG phải CDN
```

### 1.1 CDN media vs domain tenant

Hai khái niệm **khác nhau**, dễ nhầm:

| Khái niệm | Host | Vai trò |
|-----------|------|---------|
| **Domain tenant** | `79ai.net` | Tham số `domain=` gửi lên API — tenant **79AI** trên nền Gommo |
| **CDN media** | `ai-cdn.gommo.net` | Host **thật** lưu file upload & output — URL trả về sau upload/poll |

**URL upload/output thực tế** do Gommo trả về, app không hardcode domain CDN. Code chỉ trích bất kỳ URL `https://...` hợp lệ từ envelope (`extract_upload_url`, `extract_result_url`).

Pattern CDN thường gặp:

```
https://ai-cdn.gommo.net/ai/images/{bucket}/{file_id}.jpg    ← ảnh upload / output
https://ai-cdn.gommo.net/ai/videos/{bucket}/{file_id}.mp4   ← video
https://ai-cdn.gommo.net/ai/audio/{bucket}/{file_id}.mp3    ← TTS / audio ref
https://ai-cdn.gommo.net/ai/music/{bucket}/{file_id}.mp3    ← nhạc AI
```

Ví dụ ảnh upload thật:

```
https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg
```

Dùng URL này trực tiếp trong job payload (`subjects`, `images`, `references`, `video_url`, …).

> **Lưu ý:** Mọi ví dụ URL trong doc dùng `ai-cdn.gommo.net`. Hash/path cụ thể chỉ mang tính minh họa — URL thật lấy từ response API.

---

## 2. Xác thực

| Field | Vị trí |
|-------|--------|
| `access_token` | Body form hoặc query |
| `domain` | VD: `79ai.net` |
| `Authorization: Bearer {access_token}` | Header |

Platform JWT: `Authorization: Bearer {platform_jwt}` — bridge thay bằng merchant token.

Field chung mọi job:

| Field | Mô tả |
|-------|-------|
| `domain` | Tenant API (VD: `79ai.net`) — **không** phải host CDN file |
| `project_id` | Workspace, mặc định `default` |
| `language` | VD: `VI` |
| `device_id`, `device_name`, `device_info` | Khuyến nghị gửi kèm |

---

## 3. Envelope chuẩn & lỗi

Gommo trả JSON dạng **envelope**:

```json
{
  "success": true,
  "message": "OK",
  "data": { },
  "raw": { }
}
```

### Trích field quan trọng

| Mục đích | Keys (theo thứ tự ưu tiên) |
|----------|----------------------------|
| Job ID poll | `data.id_base`, `data.job_id`, `data.id` |
| URL kết quả image | `raw.imageInfo.result_url`, `data.result_url` |
| URL kết quả video | `raw.videoInfo.result_url`, `raw.videoInfo.url` |
| URL kết quả music | `raw.musicInfo.music_url`, `data.music_url` |
| Cover nhạc | `raw.musicInfo.cover_url`, `data.cover_url` |
| URL sau upload | `data.url`, `raw.imageInfo.url`, `raw.videoInfo.url` → host `ai-cdn.gommo.net` |
| Status | `data.status`, `raw.imageInfo.status`, `raw.videoInfo.status`, `raw.musicInfo.status` |
| TTS file | `audioInfo.file_url`, `audioInfo.result_url` |

### Response lỗi chung

```json
{
  "success": false,
  "message": "Không xác định được giá model"
}
```

HTTP 401/403:

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

HTTP 400 — config model sai:

```json
{
  "success": false,
  "message": "ratio không hợp lệ với model này"
}
```

---

## 4. API Reference — Request & Response đầy đủ

> Mọi ví dụ dùng `access_token`, `domain`, `project_id` — thay bằng credential thật của bạn.

---

### 4.1 Danh sách model

**Request**

```http
POST https://v2.api.gommo.net/ai/models?type=video&domain=79ai.net
Content-Type: application/x-www-form-urlencoded
Authorization: Bearer {access_token}

type=video
domain=79ai.net
project_id=default
access_token={access_token}
device_id=web-client-001
device_name=toc-site-ai
device_info={"language":"vi","platform":"web"}
```

**Response 200 — success**

```json
{
  "success": true,
  "data": {
    "models": [
      {
        "model": "kling-v2",
        "name": "Kling V2",
        "status": "ON",
        "status_message": "",
        "description": "Text & image to video",
        "price": 50,
        "sale": 0,
        "ratios": ["16:9", "9:16", "1:1"],
        "modes": [
          { "type": "standard", "name": "Standard" },
          { "type": "pro", "name": "Pro" }
        ],
        "resolutions": ["720p", "1080p"],
        "durations": ["5", "10"],
        "withSubject": true,
        "withReference": true,
        "withMotion": true,
        "withMultiShots": true,
        "withEdit": true,
        "startImage": true,
        "startImageAndEnd": false,
        "maxSubject": 4,
        "configs": {
          "reference": {
            "limits": { "image": 4, "video": 1 },
            "max_size": 10485760
          },
          "motion_video": {
            "max_duration": 30,
            "max_size": 52428800
          },
          "multi_shots": {
            "limits": { "min": 2, "max": 6, "min_duration": 3 }
          }
        },
        "prices": [
          {
            "mode": "standard",
            "resolution": "720p",
            "duration": "5",
            "price": 40,
            "price_default": 50
          },
          {
            "mode": "pro",
            "resolution": "1080p",
            "duration": "10",
            "price": 120
          }
        ]
      }
    ]
  }
}
```

**Response — model OFF**

```json
{
  "model": "some-model",
  "status": "OFF",
  "status_message": "Model đang bảo trì"
}
```

**Platform bridge**

```http
GET /api/platform/job-models.php?type=video
Authorization: Bearer {platform_jwt}
```

```json
{
  "success": true,
  "data": {
    "success": true,
    "data": { "models": [ "..."] }
  }
}
```

---

### 4.2 Upload ảnh

**Request (multipart)**

```http
POST https://v2.api.gommo.net/ai/upload/image
Authorization: Bearer {access_token}
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="file"; filename="portrait.png"
Content-Type: image/png

(binary)
------FormBoundary
Content-Disposition: form-data; name="file_name"

portrait.png
------FormBoundary
Content-Disposition: form-data; name="size"

2048576
------FormBoundary
Content-Disposition: form-data; name="domain"

79ai.net
------FormBoundary
Content-Disposition: form-data; name="project_id"

default
------FormBoundary
Content-Disposition: form-data; name="access_token"

{access_token}
------FormBoundary--
```

**Response 200 — success**

```json
{
  "success": true,
  "message": "Upload thành công",
  "data": {
    "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg",
    "image_url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg"
  },
  "raw": {
    "imageInfo": {
      "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg",
      "status": "SUCCESS"
    }
  }
}
```

**Response 400 — file quá lớn**

```json
{
  "success": false,
  "message": "Ảnh quá lớn (tối đa 15MB)"
}
```

**Platform bridge**

Request:

```http
POST /api/platform/job-upload.php
Authorization: Bearer {platform_jwt}
Content-Type: multipart/form-data

kind=image
file=(binary)
file_name=portrait.png
```

Response:

```json
{
  "success": true,
  "data": {
    "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg",
    "envelope": {
      "success": true,
      "data": { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg" },
      "raw": { "imageInfo": { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg" } }
    },
    "bridgeBuild": "2026-07-20-upload1"
  }
}
```

---

### 4.3 Upload video

**Request (multipart)**

```http
POST https://v2.api.gommo.net/ai/upload/video
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

video_file=(binary)          ← field name KHÁC ảnh
file_name=dance-ref.mp4
size=8388608
domain=79ai.net
project_id=default
access_token={access_token}
```

**Response 200 — success**

```json
{
  "success": true,
  "data": {
    "url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/f1e2d3c4b5a69781.mp4",
    "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/f1e2d3c4b5a69781.mp4"
  },
  "raw": {
    "videoInfo": {
      "url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/f1e2d3c4b5a69781.mp4",
      "status": "SUCCESS"
    }
  }
}
```

**Platform bridge**

```http
POST /api/platform/job-upload.php
kind=video
file=(binary)
file_name=dance-ref.mp4
```

Response tương tự upload ảnh, `url` trỏ tới file video.

---

### 4.4 Tạo job — response chung

**Endpoint**

```http
POST https://v2.api.gommo.net/ai/jobs/{type}/{modelId}
Content-Type: application/x-www-form-urlencoded
Authorization: Bearer {access_token}
```

**Response ngay khi create — job async (phổ biến nhất)**

```json
{
  "success": true,
  "data": {
    "id_base": "img_7f3a9b2c1d4e5f6a",
    "job_id": "img_7f3a9b2c1d4e5f6a",
    "status": "PENDING"
  },
  "raw": {
    "imageInfo": {
      "status": "PENDING_ACTIVE",
      "result_url": null
    }
  }
}
```

Video tương tự:

```json
{
  "success": true,
  "data": {
    "id_base": "vid_8a4b0c3d2e5f6a7b",
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

**Response — fail ngay tại create**

```json
{
  "success": true,
  "data": {
    "id_base": "img_fail_001",
    "status": "FAILED"
  },
  "raw": {
    "imageInfo": {
      "status": "FAILED",
      "result_url": null,
      "message": "NSFW content detected"
    }
  }
}
```

**Response — sync (hiếm, có URL ngay)**

```json
{
  "success": true,
  "data": {
    "id_base": "img_sync_001",
    "status": "SUCCESS",
    "result_url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/a1b2c3d4e5f67801.jpg"
  },
  "raw": {
    "imageInfo": {
      "status": "SUCCESS",
      "result_url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/a1b2c3d4e5f67801.jpg"
    }
  }
}
```

**Platform bridge create**

Request:

```http
POST /api/platform/job-create.php
Authorization: Bearer {platform_jwt}
Content-Type: application/json

{
  "type": "video",
  "modelId": "kling-v2",
  "fields": {
    "prompt": "cinematic drone shot at sunset",
    "ratio": "16:9",
    "duration": "5",
    "resolution": "1080p",
    "mode": "standard"
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "platformJobId": "550e8400-e29b-41d4-a716-446655440000",
    "costCredits": 50,
    "credits": 950,
    "refunded": false,
    "envelope": {
      "success": true,
      "data": {
        "id_base": "vid_8a4b0c3d2e5f6a7b",
        "status": "PENDING"
      },
      "raw": {
        "videoInfo": {
          "status": "MEDIA_GENERATION_STATUS_PENDING"
        }
      }
    },
    "bridgeVersion": "2026-07-24-status-varchar64"
  }
}
```

---

### 4.5 Poll job — image / video / music

**Request**

```http
POST https://v2.api.gommo.net/ai/jobs/vid_8a4b0c3d2e5f6a7b?media=video
Content-Type: application/x-www-form-urlencoded

domain=79ai.net
access_token={access_token}
```

Music poll **bắt buộc** thêm `project_id`:

```
domain=79ai.net
project_id=default
access_token={access_token}
```

**Poll — đang xử lý**

```json
{
  "success": true,
  "data": {
    "id_base": "vid_8a4b0c3d2e5f6a7b",
    "status": "PROCESSING"
  },
  "raw": {
    "videoInfo": {
      "status": "MEDIA_GENERATION_STATUS_ACTIVE",
      "result_url": null
    }
  }
}
```

**Poll — image success**

```json
{
  "success": true,
  "data": {
    "id_base": "img_7f3a9b2c1d4e5f6a",
    "status": "SUCCESS",
    "result_url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/b2c3d4e5f6789012.jpg"
  },
  "raw": {
    "imageInfo": {
      "status": "SUCCESS",
      "result_url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/b2c3d4e5f6789012.jpg"
    }
  }
}
```

**Poll — video success**

```json
{
  "success": true,
  "data": {
    "id_base": "vid_8a4b0c3d2e5f6a7b",
    "status": "SUCCESS",
    "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/c3d4e5f678901234.mp4"
  },
  "raw": {
    "videoInfo": {
      "status": "MEDIA_GENERATION_STATUS_SUCCESSFUL",
      "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/c3d4e5f678901234.mp4",
      "url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/c3d4e5f678901234.mp4"
    }
  }
}
```

**Poll — music success**

```json
{
  "success": true,
  "data": {
    "id_base": "mus_9b5c1d4e3f6a7b8c",
    "status": "SUCCESS",
    "music_url": "https://ai-cdn.gommo.net/ai/music/e5f6a7b8c9d0e1f2/f4e5d6c7b8a90123.mp3",
    "cover_url": "https://ai-cdn.gommo.net/ai/images/e5f6a7b8c9d0e1f2/cover_a1b2c3d4e5f6.jpg"
  },
  "raw": {
    "musicInfo": {
      "status": "SUCCESS",
      "music_url": "https://ai-cdn.gommo.net/ai/music/e5f6a7b8c9d0e1f2/f4e5d6c7b8a90123.mp3",
      "cover_url": "https://ai-cdn.gommo.net/ai/images/e5f6a7b8c9d0e1f2/cover_a1b2c3d4e5f6.jpg"
    }
  }
}
```

**Poll — failed**

```json
{
  "success": true,
  "data": {
    "id_base": "vid_fail_001",
    "status": "FAILED"
  },
  "raw": {
    "videoInfo": {
      "status": "MEDIA_GENERATION_STATUS_FAILED",
      "result_url": null,
      "message": "Generation rejected"
    }
  }
}
```

**Platform bridge poll**

Request:

```json
{
  "providerJobId": "vid_8a4b0c3d2e5f6a7b",
  "media": "video"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "platformJobId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "success",
    "refunded": false,
    "polledVia": "db+gommo",
    "envelope": {
      "success": true,
      "data": {
        "id_base": "vid_8a4b0c3d2e5f6a7b",
        "status": "SUCCESS",
        "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/c3d4e5f678901234.mp4"
      },
      "raw": {
        "videoInfo": {
          "status": "MEDIA_GENERATION_STATUS_SUCCESSFUL",
          "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/c3d4e5f678901234.mp4"
        }
      }
    }
  }
}
```

Poll fail + hoàn credit:

```json
{
  "success": true,
  "data": {
    "status": "failed",
    "refunded": true,
    "credits": 1000,
    "envelope": { "raw": { "videoInfo": { "status": "FAILED" } } }
  }
}
```

---

### 4.6 Tạo ảnh (image)

**Endpoint:** `POST /ai/jobs/image/{modelId}`

#### 4.6.1 Text-to-image

Request (JSON logic):

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "language": "VI",
  "prompt": "a cinematic portrait, soft lighting, 85mm lens, shallow depth of field",
  "ratio": "1:1",
  "resolution": "2K",
  "mode": "standard",
  "privacy": "PRIVATE"
}
```

Form-encoded:

```
domain=79ai.net
project_id=default
language=VI
prompt=a+cinematic+portrait%2C+soft+lighting
ratio=1%3A1
resolution=2K
mode=standard
access_token=...
```

Create response → xem [4.4](#44-tạo-job--response-chung), poll `media=image`.

Poll success → xem [4.5 image success](#45-poll-job--image--video--music).

#### 4.6.2 Ảnh + tham chiếu (subjects)

Request:

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "prompt": "same character in cyberpunk city at night, neon rain",
  "ratio": "16:9",
  "resolution": "2K",
  "subjects": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/e5b06f9c1e148a20.jpg" }
  ]
}
```

Form-encoded:

```
prompt=same+character+in+cyberpunk+city
ratio=16%3A9
subjects[0][url]=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Fimages%2Fd150abd4fb1b83d4%2Fe5b06f9c1e148a20.jpg
```

#### 4.6.3 Reference style (Gommo native — references[])

Request:

```json
{
  "prompt": "product photo on marble table, luxury lighting",
  "ratio": "4:3",
  "references": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/ref_style_a1b2.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/ref_product_b2c3.jpg" }
  ]
}
```

#### 4.6.4 Nhiều output

Request:

```json
{
  "prompt": "minimalist logo design, geometric",
  "ratio": "1:1",
  "num_outputs": 4
}
```

---

### 4.7 Tạo video (video) — các mode

**Endpoint:** `POST /ai/jobs/video/{modelId}`

#### 4.7.1 Text-to-video

Request:

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "prompt": "drone shot flying over mountains at golden sunset, cinematic",
  "ratio": "16:9",
  "resolution": "1080p",
  "duration": "5",
  "mode": "standard"
}
```

Create response:

```json
{
  "success": true,
  "data": { "id_base": "vid_t2v_001", "status": "PENDING" },
  "raw": { "videoInfo": { "status": "MEDIA_GENERATION_STATUS_PENDING" } }
}
```

#### 4.7.2 Start frame (startImage)

Request:

```json
{
  "prompt": "camera slowly zooms in, gentle wind in hair",
  "ratio": "16:9",
  "duration": "5",
  "images": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/start_frame_c3d4.jpg" }
  ]
}
```

Form:

```
images[0][url]=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Fimages%2Fd150abd4fb1b83d4%2Fstart_frame_c3d4.jpg
```

#### 4.7.3 Start + End frame (startImageAndEnd)

Request:

```json
{
  "prompt": "smooth cinematic morph between two scenes",
  "ratio": "16:9",
  "duration": "5",
  "images": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/start_d4e5.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/end_e5f6.jpg" }
  ]
}
```

#### 4.7.4 Reference images — thành phần (references[])

Request (Gommo native):

```json
{
  "prompt": "character walking in rain, neon reflections",
  "ratio": "16:9",
  "duration": "5",
  "references": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/character_f6a7.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/style_ref_g7h8.jpg" }
  ]
}
```

Request (repo UI — subjects[]):

```json
{
  "prompt": "character walking in rain",
  "ratio": "16:9",
  "duration": "5",
  "subjects": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/character_f6a7.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/style_ref_g7h8.jpg" }
  ]
}
```

#### 4.7.5 Reference video

Request:

```json
{
  "prompt": "same motion, different background — tropical beach",
  "ratio": "16:9",
  "duration": "5",
  "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/f1e2d3c4b5a69781.mp4",
  "video_urls": [
    { "url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/f1e2d3c4b5a69781.mp4" }
  ]
}
```

Form:

```
video_url=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Fvideos%2Fa1b2c3d4e5f67890%2Ff1e2d3c4b5a69781.mp4
video_urls[0][url]=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Fvideos%2Fa1b2c3d4e5f67890%2Ff1e2d3c4b5a69781.mp4
```

#### 4.7.6 Reference audio

> **Upload audio:** API công khai hiện **chỉ có** upload image + video. Audio ref dùng URL HTTPS public hoặc `file_url` từ TTS. Chi tiết: [SEEDANCE-OMNI-API.md §1c](./SEEDANCE-OMNI-API.md#1c-audio-tham-chiếu).

Request:

```json
{
  "prompt": "character dancing to the beat",
  "ratio": "16:9",
  "duration": "5",
  "audio_urls": [
    { "url": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/beat_i9j0.mp3" }
  ]
}
```

#### 4.7.7 Motion transfer (subType=motion)

Request:

```json
{
  "subType": "motion",
  "prompt": "character performs the dance move naturally",
  "ratio": "default",
  "image_url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/character_f6a7.jpg",
  "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/driving_k1l2.mp4",
  "images": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/character_f6a7.jpg" }
  ],
  "background_source": "input_video"
}
```

Create response:

```json
{
  "success": true,
  "data": { "id_base": "vid_motion_001", "status": "PENDING" },
  "raw": { "videoInfo": { "status": "MEDIA_GENERATION_STATUS_PENDING" } }
}
```

#### 4.7.8 Edit video (subType=edit)

Request:

```json
{
  "subType": "edit",
  "prompt": "add snow falling gently across the scene",
  "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/source_m3n4.mp4",
  "videos": [
    { "url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/source_m3n4.mp4" }
  ],
  "start_seconds": 0,
  "end_seconds": 10
}
```

#### 4.7.9 Extend video (extendVideo)

Request:

```json
{
  "extendVideo": true,
  "prompt": "continue the scene naturally, same camera angle",
  "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/existing_o5p6.mp4",
  "ratio": "16:9",
  "duration": "5"
}
```

Form:

```
extendVideo=true
video_url=https%3A%2F%2Fai-cdn.gommo.net%2Fai%2Fvideos%2Fa1b2c3d4e5f67890%2Fexisting_o5p6.mp4
prompt=continue+the+scene+naturally
```

#### 4.7.10 Multi-shot (withMultiShots)

Request:

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "ratio": "16:9",
  "duration": "15",
  "multi_shot": true,
  "shot_type": "customize",
  "multi_prompt": [
    { "index": 1, "prompt": "wide establishing shot of futuristic city", "duration": "5" },
    { "index": 2, "prompt": "close-up on protagonist face, emotional", "duration": "4" },
    { "index": 3, "prompt": "pull back to reveal skyline at dusk", "duration": "6" }
  ]
}
```

Form:

```
multi_shot=true
shot_type=customize
multi_prompt[0][index]=1
multi_prompt[0][prompt]=wide+establishing+shot
multi_prompt[0][duration]=5
multi_prompt[1][index]=2
multi_prompt[1][prompt]=close-up+on+face
multi_prompt[1][duration]=4
```

#### 4.7.11 Cameos + Template

Request:

```json
{
  "prompt": "@cameo1 walking in a sunny park, cinematic",
  "ratio": "16:9",
  "duration": "5",
  "cameos": "[{\"id\":\"cameo1\",\"url\":\"https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/face_q7r8.jpg\"}]",
  "template_id": "tpl_summer_walk"
}
```

---

### 4.8 Tạo nhạc (music)

**Endpoint:** `POST /ai/jobs/music/{modelId}`  
**Poll:** `POST /ai/jobs/{id_base}?media=music` (+ `project_id`)

#### 4.8.1 Instrumental (không lời)

Request:

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "name": "Sunset Vibes",
  "styles": "lo-fi chill hop, warm pads, slow tempo, relaxing",
  "style": "lo-fi chill hop, warm pads, slow tempo, relaxing",
  "tags": "lo-fi chill hop, warm pads, slow tempo, relaxing"
}
```

Create response:

```json
{
  "success": true,
  "data": {
    "id_base": "mus_9b5c1d4e3f6a7b8c",
    "status": "PENDING"
  },
  "raw": {
    "musicInfo": {
      "status": "PROCESSING",
      "music_url": null
    }
  }
}
```

Poll success → xem [4.5 music success](#45-poll-job--image--video--music).

#### 4.8.2 Có lời

Request:

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "name": "My Song",
  "styles": "pop ballad, emotional, piano accompaniment",
  "prompt": "Verse 1:\nWalking down the empty street\n\nChorus:\nHold me close tonight"
}
```

#### 4.8.3 Có gender (nếu model hỗ trợ)

Request:

```json
{
  "name": "Power Anthem",
  "styles": "rock, energetic, electric guitar",
  "gender": "female",
  "duration": "120"
}
```

---

### 4.9 TTS / Audio API

**Endpoint:** `POST https://api.gommo.net/ai/audio`  
(Không dùng `/ai/jobs/tts/...` trong production app)

#### 4.9.1 Search voices

Request:

```
action_type=searchVoices
server=elevenlabs_cheap
domain=79ai.net
project_id=default
device_id=web-001
device_name=toc-site-ai
device_info={"language":"vi","platform":"web"}
page=0
page_size=100
search=female
access_token=...
```

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "voice_id": "21m00Tcm4TlvDq8ikWAM",
        "id_base": "21m00Tcm4TlvDq8ikWAM",
        "name": "Rachel",
        "description": "Calm, young American female",
        "preview_url": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/voice_preview_s9t0.mp3",
        "labels": { "language": "en", "accent": "american" },
        "server": "elevenlabs_cheap",
        "price": 5,
        "status": "ON",
        "verified_languages": [
          { "language": "en", "model_id": "eleven_multilingual_v2", "locale": "en-US" },
          { "language": "vi", "model_id": "eleven_multilingual_v2", "locale": "vi-VN" }
        ]
      }
    ],
    "pagination": { "page": 0, "pages": 3 }
  }
}
```

#### 4.9.2 Create TTS (ElevenLabs)

Request:

```
action_type=create
text=Xin chào, đây là thử nghiệm giọng đọc AI bằng tiếng Việt.
voice_id=21m00Tcm4TlvDq8ikWAM
voice_name=Rachel
server=elevenlabs_cheap
model=eleven_multilingual_v2
language=vi
domain=79ai.net
project_id=default
device_id=web-001
device_name=toc-site-ai
device_info={"language":"vi","platform":"web"}
voice_settings[stability]=0.5
voice_settings[similarity_boost]=0.75
voice_settings[speed]=1.0
voice_settings[style]=0
voice_settings[use_speaker_boost]=true
access_token=...
```

Response — success (sync):

```json
{
  "success": true,
  "audioInfo": {
    "id_base": "aud_tts_001",
    "text": "Xin chào, đây là thử nghiệm giọng đọc AI bằng tiếng Việt.",
    "status": "SUCCESS",
    "file_url": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/aud_tts_u1v2.mp3",
    "duration": 8.4,
    "price": 5,
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "model": "eleven_multilingual_v2",
    "server": "elevenlabs_cheap"
  }
}
```

Response — accepted nhưng chưa có file (poll bằng `id_base` nếu cần):

```json
{
  "success": true,
  "audioInfo": {
    "id_base": "aud_tts_pending_001",
    "status": "PROCESSING",
    "file_url": null
  }
}
```

#### 4.9.3 Create TTS (OpenVoice / Minimax)

Request:

```
action_type=create
text=Hello, this is a voice clone test.
voice_id=voice_abc123
server=omnivoice_local
model=openvoice_v2
audio_type=standard
voice_setting[speed]=1.0
voice_setting[pitch]=0
voice_setting[volume]=1.0
voice_setting[quality]=1
domain=79ai.net
project_id=default
access_token=...
```

Response:

```json
{
  "success": true,
  "audioInfo": {
    "id_base": "aud_ov_001",
    "status": "SUCCESS",
    "file_url": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/aud_ov_w3x4.mp3",
    "duration": 6.2,
    "price": 3
  }
}
```

#### 4.9.4 Get audio history

Request:

```
action_type=getLists
domain=79ai.net
project_id=default
device_id=web-001
access_token=...
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "text": "Xin chào, đây là thử nghiệm TTS.",
      "status": "SUCCESS",
      "id_base": "aud_tts_001",
      "duration": 8.4,
      "file_size": 134000,
      "file_url": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/aud_tts_u1v2.mp3",
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "server": "elevenlabs_cheap",
      "model": "eleven_multilingual_v2",
      "price": 5,
      "created_at": "1722000000"
    }
  ]
}
```

---

### 4.10 Avatar lip-sync

**Endpoint:** `POST /ai/jobs/avatar-lipsync/{modelId}`  
**Poll:** `media=video`

Request:

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "prompt": "person speaking naturally to camera, subtle head movement",
  "images": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/face_q7r8.jpg" }
  ],
  "subjects": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/face_q7r8.jpg" },
    { "url": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/speech_y5z6.mp3" }
  ],
  "audio_url": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/speech_y5z6.mp3",
  "audio": "https://ai-cdn.gommo.net/ai/audio/a1b2c3d4e5f67890/speech_y5z6.mp3"
}
```

Create response:

```json
{
  "success": true,
  "data": { "id_base": "lip_001", "status": "PENDING" },
  "raw": { "videoInfo": { "status": "MEDIA_GENERATION_STATUS_PENDING" } }
}
```

Poll success:

```json
{
  "success": true,
  "data": {
    "id_base": "lip_001",
    "status": "SUCCESS",
    "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/lip_a7b8.mp4"
  },
  "raw": {
    "videoInfo": {
      "status": "MEDIA_GENERATION_STATUS_SUCCESSFUL",
      "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/lip_a7b8.mp4"
    }
  }
}
```

---

### 4.11 Utility jobs

#### 4.11.1 Image upscale

`POST /ai/jobs/image-upscale/generative_upscale_v2`

Request:

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "subjects": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/low_res_c9d0.jpg" }
  ],
  "mode": "generative",
  "resolution": "4K",
  "prompt": "upscale"
}
```

Poll success:

```json
{
  "raw": {
    "imageInfo": {
      "status": "SUCCESS",
      "result_url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/upscaled_4k_e1f2.jpg"
    }
  }
}
```

#### 4.11.2 Remove background

`POST /ai/jobs/remove-bg/{modelId}`

Request:

```json
{
  "subjects": [
    { "url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/product_g3h4.jpg" }
  ]
}
```

Poll success:

```json
{
  "raw": {
    "imageInfo": {
      "status": "SUCCESS",
      "result_url": "https://ai-cdn.gommo.net/ai/images/d150abd4fb1b83d4/product_nobg_i5j6.jpg"
    }
  }
}
```

#### 4.11.3 Video upscale

`POST /ai/jobs/video-upscale/{modelId}`

Request:

```json
{
  "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/source_720p_k7l8.mp4",
  "subjects": [
    { "url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/source_720p_k7l8.mp4" }
  ],
  "resolution": "1080p"
}
```

#### 4.11.4 Video VFX

`POST /ai/jobs/video-vfx/{modelId}`

Request:

```json
{
  "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/source_m3n4.mp4",
  "prompt": "add cinematic rain and wet reflections"
}
```

#### 4.11.5 Video subtitle

`POST /ai/jobs/video-subtitle/{modelId}`

Request:

```json
{
  "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/source_m3n4.mp4",
  "text": "Xin chào các bạn, hôm nay chúng ta sẽ học về AI.",
  "language": "vi"
}
```

#### 4.11.6 Video cut

`POST /ai/jobs/video-cut/{modelId}`

Request:

```json
{
  "video_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/source_m3n4.mp4",
  "start_time": 10,
  "end_time": 40,
  "start": 10,
  "end": 40
}
```

Poll success (video utility):

```json
{
  "raw": {
    "videoInfo": {
      "status": "MEDIA_GENERATION_STATUS_SUCCESSFUL",
      "result_url": "https://ai-cdn.gommo.net/ai/videos/a1b2c3d4e5f67890/cut_m9n0.mp4"
    }
  }
}
```

---

### 4.12 Platform bridge — tóm tắt endpoint

| Endpoint | Request mẫu | Response mẫu |
|----------|---------------|--------------|
| `GET job-models.php?type=image` | Header JWT | `{ "success": true, "data": { "success": true, "data": { "models": [...] } } }` |
| `POST job-upload.php` | `kind=image`, `file=binary` | `{ "success": true, "data": { "url": "https://..." } }` |
| `POST job-create.php` | `{ "type":"image", "modelId":"...", "fields":{...} }` | `{ "success": true, "data": { "platformJobId":"...", "costCredits":10, "credits":990, "envelope":{...} } }` |
| `POST job-poll.php` | `{ "providerJobId":"...", "media":"image" }` | `{ "success": true, "data": { "status":"success", "envelope":{...} } }` |

**job-create fail — không đủ credit:**

```json
{
  "success": false,
  "message": "Số dư credit không đủ (cần 50)"
}
```

**job-upload fail — sai định dạng:**

```json
{
  "success": false,
  "message": "Định dạng ảnh không được hỗ trợ (dùng JPG / PNG / WebP)"
}
```

---

### 4.13 Seedance Omni — multi ref (ảnh + video + audio)

> **Gửi khách:** xem file ngắn gọn **[SEEDANCE-OMNI-API.md](./SEEDANCE-OMNI-API.md)** (tiếng Việt + TL;DR English, có cURL copy/paste).

Áp dụng cho **Seedance 2.0 Omni**, Kling Omni, VEO Omni… — model có `withReference: true` và `configs.reference.limits`.

#### Flow tóm tắt

```
models_list → upload ảnh/video → (audio: URL public hoặc TTS) → create job → poll
```

#### Map UI → API

| UI (Omni) | Upload | Field create job |
|-----------|--------|------------------|
| Ảnh ref (vd. 6) | `POST /ai/upload/image` | `references[n][url]` |
| Video ref (vd. 2) | `POST /ai/upload/video` | `video_urls[n][url]` |
| Audio ref (vd. 2) | **Không có `/ai/upload/audio`** | `audio_urls[n][url]` — URL HTTPS hoặc `audioInfo.file_url` từ TTS |

**Không** đặt ref ảnh Omni vào `images[]` — field đó chỉ cho start/end frame.

#### Đọc giới hạn từ models_list

```json
{
  "model": "seedance-2-omni",
  "withReference": true,
  "configs": {
    "reference": {
      "limits": { "image": 6, "video": 2, "audio": 2 }
    }
  }
}
```

#### Create job — ví dụ 2 ảnh + 1 video + 1 audio

```json
{
  "domain": "79ai.net",
  "project_id": "default",
  "prompt": "Cinematic scene with character and motion reference",
  "ratio": "16:9",
  "duration": "5",
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

Endpoint: `POST /ai/jobs/video/{model_slug}` · Poll: `?media=video`

Chi tiết upload response, form-encoded, cURL, FAQ → **[SEEDANCE-OMNI-API.md](./SEEDANCE-OMNI-API.md)**.

---

## 5. Danh sách Job Type

### Doc gửi khách (Seedance Omni)

| File | Mục đích |
|------|----------|
| [SEEDANCE-OMNI-API.md](./SEEDANCE-OMNI-API.md) | Hướng dẫn upload + create + poll cho Seedance Omni (6 ảnh / 2 video / 2 audio ref) |
| [GOMMO-API.md](./GOMMO-API.md) | API reference đầy đủ toàn bộ loại job |

| Type | Poll media | API |
|------|------------|-----|
| `image` | `image` | `/ai/jobs/image/{model}` |
| `video` | `video` | `/ai/jobs/video/{model}` |
| `music` | `music` | `/ai/jobs/music/{model}` |
| `tts` | — | `/ai/audio` (action_type=create) |
| `avatar-lipsync` | `video` | `/ai/jobs/avatar-lipsync/{model}` |
| `image-upscale` | `image` | `/ai/jobs/image-upscale/{model}` |
| `remove-bg` | `image` | `/ai/jobs/remove-bg/{model}` |
| `video-upscale` | `video` | `/ai/jobs/video-upscale/{model}` |
| `video-vfx` | `video` | `/ai/jobs/video-vfx/{model}` |
| `video-subtitle` | `video` | `/ai/jobs/video-subtitle/{model}` |
| `video-cut` | `video` | `/ai/jobs/video-cut/{model}` |

---

## 6. Flow tích hợp chuẩn

```
models_list → upload (nếu cần ref) → create job → poll ?media=...
                                              ↓
                                    id_base + result_url
```

Khuyến nghị poll: **3.5s** interval, **80** lần max.

### cURL nhanh

```bash
# 1. Models
curl -X POST "https://v2.api.gommo.net/ai/models?type=video&domain=79ai.net" \
  -H "Authorization: Bearer $TOKEN" \
  -d "type=video&domain=79ai.net&access_token=$TOKEN&project_id=default"

# 2. Upload ảnh
curl -X POST "https://v2.api.gommo.net/ai/upload/image" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@portrait.png" -F "file_name=portrait.png" \
  -F "domain=79ai.net" -F "project_id=default" -F "access_token=$TOKEN"

# 3. Create video
curl -X POST "https://v2.api.gommo.net/ai/jobs/video/kling-v2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "domain=79ai.net&project_id=default&access_token=$TOKEN" \
  -d "prompt=drone+shot+at+sunset&ratio=16:9&duration=5"

# 4. Poll
curl -X POST "https://v2.api.gommo.net/ai/jobs/vid_xxx?media=video" \
  -H "Authorization: Bearer $TOKEN" \
  -d "domain=79ai.net&access_token=$TOKEN"
```

---

## 7. Quy tắc quan trọng

1. **Không đoán enum** — `ratio`, `resolution`, `duration`, `mode` lấy từ catalog model.
2. **Upload trước** — URL media phải HTTPS công khai (host CDN: `ai-cdn.gommo.net`).
3. **Phân biệt field media:**
   - `images[]` = start/end frame
   - `references[]` = thành phần/style (Gommo native)
   - `subjects[]` = repo UI gộp ref; Gommo chấp nhận
   - `video_url` / `video_urls[]` = video ref / motion / extend / edit
   - `audio_url` / `audio_urls[]` = audio ref
4. **TTS** dùng `/ai/audio`, không poll job API.
5. **Poll music** cần `project_id` trong body.
6. **Nested form:** `subjects[0][url]=...`, `multi_prompt[0][duration]=5`.

---

## 8. File tham chiếu trong repo

| File | Nội dung |
|------|----------|
| `src/services/api.ts` | `GommoClient`, upload, create, poll |
| `src/services/modelSchema.ts` | `buildJobPayload()` |
| `src/services/audioVoices.ts` | TTS API |
| `src/services/mediaGenerationStatus.ts` | Parse envelope |
| `server/php-bridge/gommo.php` | Extract URL/status helpers |
| `server/php-bridge/job-create.php` | Bridge create |
| `server/php-bridge/job-upload.php` | Bridge upload |
| `server/php-bridge/job-poll.php` | Bridge poll |

---

*79AI API doc · `domain=79ai.net` · API Gommo · CDN `ai-cdn.gommo.net` · Cập nhật: 2026-07-29.*
