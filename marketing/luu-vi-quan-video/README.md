# Lưu Vị Quán — video marketing 3D (Three.js)

Video quảng cáo dọc **1080×1920 (9:16)**, dài **34 giây**, dựng hoàn toàn bằng code:
món ăn 3D procedural bằng Three.js + chữ tiếng Việt bằng HTML/CSS + nhạc nền và
hiệu ứng âm thanh tổng hợp bằng Python. Không dùng ảnh/nhạc bên ngoài, không cần
bản quyền, và render lại lúc nào cũng ra đúng một kết quả.

> Kết quả:
> - `output/luu-vi-quan-promo.mp4` — bản gốc (H.264 CRF 19, ~37 MB)
> - `output/luu-vi-quan-promo-social.mp4` — bản nhẹ để đăng Facebook/TikTok (~12 MB)

## Nội dung video

| Thời gian | Phân cảnh | Nội dung |
|---|---|---|
| 0–4s | Hook | Đèn bật, hộp đồ ăn hạ xuống, "ĐÓI CHƯA?" → logo **LƯU VỊ QUÁN** |
| 4–10s | Nem | Nem trần / nem xù / nem phô mai / nem bò pía bay vào chảo, kéo phô mai, bảng giá |
| 10–16s | Cá viên chiên | Cá viên rơi vào hộp, rưới sốt mắm tỏi, rắc đậu phộng, combo 50k/70k/100k |
| 16–22s | Mì trộn | Vắt mì, topping rơi xuống, trứng ốp la, phô mai mozzarella kéo sợi bằng đũa |
| 22–27s | Trái cây | Ánh sáng đổi tông mát, trái cây cắt sẵn rơi vào ly, giá 40k/50k/box |
| 27–34s | CTA | Số điện thoại **0947 815 316**, freeship 2km, giờ mở cửa, slogan |

Toàn bộ giá và chữ lấy từ menu thật của quán, khai báo tập trung trong
[`scene/timeline.js`](scene/timeline.js) — sửa giá ở đó là video tự cập nhật.

## Chạy thử

```bash
npm install          # three + playwright
npm run preview      # mở http://localhost:5173/scene/index.html?preview=1
```

Preview chạy real-time trong trình duyệt, tua lại từ đầu sau mỗi 34 giây.

## Xuất video

```bash
bash scripts/build.sh                                   # bản đầy đủ 1080x1920 @30fps
FPS=12 SCALE=0.4 OUT=output/draft.mp4 bash scripts/build.sh   # bản nháp nhanh
```

Bản đầy đủ mất khoảng 40 phút trên máy 4 nhân (Chromium render WebGL bằng CPU:
~2,3 giây/khung hình chia cho 3 worker). Bản nháp chỉ mất ~15 phút.

Xuất thêm bản nhẹ để đăng mạng xã hội:

```bash
ffmpeg -i output/luu-vi-quan-promo.mp4 -c:v libx264 -crf 26 -preset slow \
       -c:a aac -b:a 160k -movflags +faststart output/luu-vi-quan-promo-social.mp4
```

Pipeline gồm 4 bước:

1. `scripts/export-timeline.mjs` — xuất timeline sang JSON cho phần âm thanh.
2. `audio/soundtrack.py` — tổng hợp nhạc + SFX ra `audio/soundtrack.wav`.
3. `scripts/render.mjs` — Chromium (WebGL phần mềm) render từng khung hình,
   chia đều cho nhiều worker; chụp cả canvas 3D lẫn chữ HTML trong một ảnh.
4. `ffmpeg` — ghép ảnh + tiếng thành MP4 (H.264 + AAC, `+faststart`).

Biến môi trường: `FPS`, `SCALE`, `WORKERS`, `DURATION`, `OUT`, `FRAMES`, `FFMPEG`.

## Cấu trúc

```
scene/timeline.js    ← nguồn sự thật: độ dài, phân cảnh, câu chữ, giá, cue âm thanh
scene/promo.js       ← scene 3D: ánh sáng, máy quay, hạt, post-processing, renderFrame(t)
scene/props.js       ← món ăn procedural: nem, cá viên, mì, phô mai kéo sợi, trái cây, hộp giấy
scene/textures.js    ← vân gỗ, giấy kraft in logo, lớp vỏ chiên giòn, sprite khói/lửa
scene/overlay.js     ← lớp chữ HTML/CSS chạy theo cùng đồng hồ với 3D
audio/soundtrack.py  ← trống, bass, marimba, và 14 loại SFX (xèo xèo, whoosh, ding, kéo phô mai…)
scripts/            ← server tĩnh, renderer, export timeline, build
```

Mọi chuyển động đều là hàm thuần của thời gian `t` (không `Math.random()`,
không `requestAnimationFrame` khi render) nên khung hình nào cũng tái tạo được,
và tiếng khớp hình tuyệt đối.

## Âm thanh

Nhạc nền 120 BPM (kick/clap/hi-hat/bass/pad/marimba, vòng hợp âm C–G–Am–F) có
sidechain "thở" theo tiếng trống. Lớp foley gồm: `riser`, `impact`, `whoosh`,
`sizzle` (tiếng chiên), `crunch`, `pop`, `ding`, `sparkle`, `chime`, `bell`,
`stretch` (kéo phô mai), `pour` (rưới sốt), `slurp`, `splash` — thời điểm phát
lấy từ `CUES` trong `scene/timeline.js`.

## Chỉnh sửa nhanh

- **Đổi giá / câu chữ**: `COPY` trong `scene/timeline.js`.
- **Đổi độ dài phân cảnh**: `SCENES` (nhớ chỉnh `CUES` cho khớp).
- **Đổi góc máy**: `SHOTS` trong `scene/promo.js`.
- **Đổi tông màu/ánh sáng**: phần `lighting` và `GradeShader` trong `scene/promo.js`.
- **Xuất bản vuông 1:1 hoặc ngang 16:9**: đổi `VIDEO.width/height` trong `timeline.js`
  rồi chỉnh lại vị trí chữ trong `scene/index.html`.
