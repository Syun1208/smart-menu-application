# Lưu Vị Quán — video marketing (Three.js)

Video quảng cáo dọc **1080×1920 (9:16)**, dài **34 giây**, dựng hoàn toàn bằng code:
Three.js dựng hình, chữ tiếng Việt bằng HTML/CSS, nhạc nền và hiệu ứng âm thanh
tổng hợp bằng Python. Render lại lúc nào cũng ra đúng một kết quả.

Repo có **hai bản dựng** dùng chung timeline, chữ, giá và hệ thống âm thanh:

| Bản dựng | Hình ảnh | Lệnh | Kết quả |
|---|---|---|---|
| **photo** (mặc định) | Ảnh chụp thật của quán, cắt theo nhịp nhạc | `bash scripts/build.sh` | `output/luu-vi-quan-promo-photo.mp4` |
| **cg** | Món ăn 3D procedural (không dùng ảnh) | `FILM=cg bash scripts/build.sh` | `output/luu-vi-quan-promo.mp4` |

Bản **photo** là bản nên đăng: món ăn là ảnh thật nên trông ngon và đáng tin;
bản **cg** giữ lại làm nền cho các cảnh không có ảnh.

## Nội dung video

| Thời gian | Phân cảnh | Nội dung |
|---|---|---|
| 0–4s | Hook | Cận cá viên sốt cay → "ĐÓI CHƯA?" → logo **LƯU VỊ QUÁN** |
| 4–10s | Nem | Nem rán, nem phô mai, nem xù (chỉ nem chiên) + bảng giá 50k/60k/12k/65k |
| 10–16s | Cá viên chiên | Cá viên sốt mắm tỏi, cận đậu phộng, hộp combo, combo 50k/70k/100k |
| 16–22s | Mì trộn | Mì trộn cá viên, cận phô mai mozzarella, 50–70k / 60–80k |
| 22–27s | Trái cây | Khay trái cây ở quầy, ly mix vị, ly trái cây dầm, box quà, 40k/50k/199–399k |
| 27–34s | CTA | **0947 815 316**, freeship 2km, giờ mở cửa, slogan |

Toàn bộ giá và chữ lấy từ menu thật của quán, khai báo tập trung trong
[`scene/timeline.js`](scene/timeline.js) — sửa giá ở đó là cả hai bản tự cập nhật.

## Chạy thử

```bash
npm install          # three + playwright
npm run preview      # http://localhost:5173/scene/film.html?preview=1   (bản ảnh thật)
                     # http://localhost:5173/scene/index.html?preview=1  (bản 3D)
```

Preview chạy real-time trong trình duyệt, tua lại từ đầu sau mỗi 34 giây.

## Xuất video

```bash
bash scripts/build.sh                                        # bản ảnh thật, 1080x1920 @30fps
FILM=cg bash scripts/build.sh                                # bản 3D
FPS=12 SCALE=0.42 OUT=output/draft.mp4 bash scripts/build.sh # bản nháp nhanh
```

Trên máy 4 nhân (Chromium render WebGL bằng CPU, 3 worker): bản ảnh thật khoảng
**20–25 phút**, bản 3D khoảng **40 phút**. Bản nháp 12fps chỉ mất ~5 phút.

Xuất thêm bản nhẹ để đăng mạng xã hội:

```bash
ffmpeg -i output/luu-vi-quan-promo-photo.mp4 -c:v libx264 -crf 26 -preset slow \
       -c:a aac -b:a 160k -movflags +faststart output/luu-vi-quan-promo-photo-social.mp4
```

Pipeline gồm 4 bước:

1. `scripts/export-timeline.mjs` — xuất timeline + cue âm thanh sang JSON.
2. `audio/soundtrack.py` — tổng hợp nhạc + SFX ra file WAV.
3. `scripts/render.mjs` — Chromium render từng khung hình, chia đều cho nhiều
   worker; chụp cả canvas WebGL lẫn chữ HTML trong một ảnh.
4. `ffmpeg` — ghép ảnh + tiếng thành MP4 (H.264 + AAC, `+faststart`).

Biến môi trường: `FILM`, `FPS`, `SCALE`, `WORKERS`, `DURATION`, `OUT`, `FRAMES`, `FFMPEG`.

## Cấu trúc

```
scene/timeline.js    ← nguồn sự thật: độ dài, phân cảnh, câu chữ, giá, cue âm thanh
scene/overlay.js     ← lớp chữ HTML/CSS, dùng chung cho cả hai bản dựng
scene/ui.css         ← toàn bộ typography và bố cục chữ

# bản ảnh thật
assets/photos/       ← ảnh gốc của quán (nem chiên, combo, menu, trái cây)
assets/photos/enhanced/ ← bản phóng to đã xử lý của các ảnh nhỏ cắt từ menu in
scene/photos.js      ← khai báo vùng cắt (region) trong từng tấm ảnh
scene/shots.js       ← kịch bản quay: shot nào, khung nào, chuyển cảnh gì, cue tiếng gì
scene/film.js        ← shader dựng phim: khung hình, chuyển cảnh, grade, bloom, tàn lửa
scene/film.html      ← trang render bản ảnh thật

# bản 3D
scene/promo.js       ← scene 3D: ánh sáng, máy quay, hạt, post-processing
scene/props.js       ← món ăn procedural: nem, cá viên, mì, phô mai kéo sợi, trái cây
scene/textures.js    ← vân gỗ, giấy kraft in logo, lớp vỏ chiên giòn, sprite khói/lửa
scene/index.html     ← trang render bản 3D

audio/soundtrack.py  ← trống, bass, marimba và 14 loại SFX (xèo xèo, whoosh, ding, kéo phô mai…)
audio/voice.py       ← kịch bản lời đọc + tổng hợp giọng nữ (xem phần Giọng đọc)
scripts/            ← server tĩnh, renderer, export timeline/region, build, chụp ảnh kiểm tra
```

Mọi chuyển động đều là hàm thuần của thời gian `t` (không `Math.random()`,
không `requestAnimationFrame` khi render) nên khung hình nào cũng tái tạo được,
và tiếng khớp hình tuyệt đối.

## Bản ảnh thật hoạt động thế nào

- **Không cắt ảnh ra file rời.** Mỗi "vùng" chỉ là một hình chữ nhật toạ độ 0–1
  trong ảnh gốc (`scene/photos.js`), shader lấy đúng cửa sổ đó ở độ phân giải
  đầy đủ. Muốn đổi khung hình chỉ cần sửa hai con số.
- **Chuyển động máy quay** = cửa sổ đó tự thu/phóng và trôi theo thời gian, cộng
  thêm rung tay rất nhẹ nên ảnh tĩnh vẫn "thở".
- **Chuyển cảnh** viết thẳng trong shader: whip pan (nhoè theo hướng), zoom punch
  (nhoè xuyên tâm), flash cut, slide, wipe chéo có viền sáng, dissolve.
- **Card** dành cho ảnh không hợp khung dọc (mì trộn cắt từ menu in, ly trái cây
  dầm chụp dọc): ảnh nổi lên như một tấm thẻ bo góc có viền sáng và bóng đổ, đặt
  trên nền gradient màu thương hiệu — vừa hợp bố cục, vừa tránh phóng to ảnh nhỏ
  lên toàn khung.
- **Ảnh nhỏ cắt từ menu in** được phóng to sẵn bằng `scripts/enhance-crops.py`
  (Lanczos 3× + unsharp trên kênh sáng + tăng tương phản cục bộ) thay vì để GPU
  nội suy tuyến tính; shader còn lấy mẫu **bicubic Catmull-Rom** nên cạnh không bị nhoè.
- **Mỗi cú cắt tự sinh ra tiếng của nó**: `scene/shots.js` gắn whoosh/impact/
  sparkle vào từng transition rồi trộn với lớp foley theo món ăn, nên hình và
  tiếng không bao giờ lệch nhau.

Kiểm tra nhanh khung hình đã cắt đúng món chưa:

```bash
node scripts/export-regions.mjs && python3 scripts/check-regions.py   # preview/regions.jpg
node scripts/shots.mjs --page scene/film.html --times 0.9,6.2,13,23.5 # preview/*.png
```

## Giọng đọc (voice-over)

Kịch bản lời đọc và mốc thời gian nằm trong `LINES` của [`audio/voice.py`](audio/voice.py).
Ghép giọng vào phim:

```bash
python3 audio/soundtrack.py --timeline audio/timeline-photo.json \
        --out audio/soundtrack-photo.wav --voice audio/voice.wav
VOICE=audio/voice.wav bash scripts/build.sh          # hoặc build thẳng
```

Nhạc và tiếng động **tự động hạ xuống** (ducking) mỗi khi có tiếng đọc rồi trả
lại như cũ, nên lời thoại luôn nghe rõ.

`audio/voice.wav` hiện tại do máy đọc (Piper, giọng nữ ~200 Hz). **Hạn chế cần
biết**: mô hình tiếng Việt offline duy nhất lấy được ở đây không có thanh điệu
trong bảng âm vị, nên giọng đọc bị mất dấu — nghe như người nước ngoài nói tiếng
Việt. Muốn giọng chuẩn, thu một người thật (ghi âm điện thoại là đủ) hoặc dùng
TTS tiếng Việt có thanh điệu (CapCut, Vbee, FPT.AI, Zalo) rồi đưa file WAV vào
`--voice` — phần còn lại của pipeline giữ nguyên.

## Âm thanh

Nhạc nền 120 BPM (kick/clap/hi-hat/bass/pad/marimba, vòng hợp âm C–G–Am–F) có
sidechain "thở" theo tiếng trống. Lớp foley gồm: `riser`, `impact`, `whoosh`,
`sizzle` (tiếng chiên), `crunch`, `pop`, `ding`, `sparkle`, `chime`, `bell`,
`stretch` (kéo phô mai), `pour` (rưới sốt), `slurp`, `splash`.

## Chỉnh sửa nhanh

- **Đổi giá / câu chữ**: `COPY` trong `scene/timeline.js`.
- **Đổi thứ tự hoặc độ dài từng cảnh quay**: `SHOTS` trong `scene/shots.js`.
- **Thêm ảnh mới**: bỏ file vào `assets/photos/`, khai báo trong `scene/photos.js`,
  rồi dùng tên vùng đó trong `scene/shots.js`.
- **Đổi tông màu**: các uniform `uExposure/uContrast/uSat/uVignette` trong `scene/film.js`.
- **Xuất bản vuông 1:1 hoặc ngang 16:9**: đổi `VIDEO.width/height` trong `timeline.js`
  rồi chỉnh lại vị trí chữ trong `scene/ui.css`.
