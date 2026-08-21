# TVC 60 giây — Lưu Vị Quán

Quảng cáo dọc 9:16 (1080×1920, 30fps) dựng bằng **three.js** rồi xuất **MP4** bằng ffmpeg.

Điểm mấu chốt: mọi chuyển động đều là **phép lấy mẫu UV trên ảnh gốc** trong shader —
ảnh không bao giờ bị model sinh lại. Nhờ vậy chữ, giá, số điện thoại và logo trên ảnh
menu giữ nguyên từng điểm ảnh, đúng yêu cầu trong storyboard.

## Chạy

```bash
npm install
npm run prepare-assets     # tách frame từ 4 clip, tải font, copy nhạc
npm run check-assets       # bảng slot: cảnh nào đã có ảnh, cảnh nào còn thiếu
npm run preview            # http://127.0.0.1:5178 — xem realtime kèm nhạc
npm run render             # -> dist/luu-vi-quan-60s-9x16.mp4
```

Cờ hữu ích khi render:

```bash
node scripts/render.mjs --draft            # 540×960 @24fps, nhanh gấp ~4 lần, để duyệt nhịp
node scripts/render.mjs --range 35:42      # chỉ render một cảnh, để soi lại
node scripts/render.mjs --no-audio         # không ghép nhạc
```

Phím trong preview: `Space` phát/dừng · `←/→` lùi/tới 1 frame (giữ `Shift` = 1 giây) ·
`↑/↓` nhảy cảnh · `Home` về đầu.

## Bảng dựng

| # | Cảnh | Thời gian | Nguồn | Chuyển động |
|---|---|---|---|---|
| 1 | Khay trái cây cắt sẵn | 0:00–0:06 | video | push-in chậm |
| 2 | Nem sống & nem xù | 0:06–0:12 | video | dolly forward |
| 3 | Các tô trái cây mix | 0:12–0:18 | video | overhead glide |
| 4 | Trái cây dầm sốt kem | 0:18–0:24 | video | close-up push |
| 5 | Combo cá viên & rau | 0:24–0:30 | ảnh | top-down push |
| 6 | Nem chiên & đồ chiên | 0:30–0:35 | ảnh | orbit + push — cảnh mạnh nhất |
| 7 | **Menu nem** | 0:35–0:42 | ảnh | crawl dọc, khoá chữ |
| 8 | Nem chiên góc rộng | 0:42–0:47 | ảnh | slide trái→phải |
| 9 | **Menu trái cây** | 0:47–0:53 | ảnh | zoom rất chậm, khoá chữ |
| 10 | Box trái cây cao cấp | 0:53–0:56 | ảnh | luxury push |
| 11 | End card | 0:56–1:00 | ảnh/typeset | gần như đứng yên |

Nhịp theo đúng ghi chú storyboard: cảnh 1→5 mượt và chậm (tươi mát), cảnh 6 & 8 nhanh
và biên độ lớn hơn (giòn, nóng), cảnh 9→10 giảm tốc, cảnh 11 tĩnh.

Chuyển cảnh: crossfade 0.35–0.45s trong cùng nhóm; whip-blur 0.28s tại hai điểm đổi
nhóm (4→5 trái cây sang đồ nóng, 8→9 đồ chiên sang menu); cut thẳng vào end card.

## Khoá an toàn cho chữ

Cảnh 7, 9, 11 đặt `lockText: true`. Khi bật cờ này, code tự ép:

- `rot = 0` — không bao giờ xoay khung có chữ
- `fit: 'width'` — dùng trọn bề ngang ảnh, không bao giờ cắt mất một cột giá
- tắt glow và tắt film grain — giữ nét chữ và con số
- đổi scale ≤ 6% trên cả cảnh
- `clampCamera()` ghim camera trong lòng ảnh, không lia ra ngoài mép

## Sửa bản dựng

Gần như mọi thứ nằm trong hai file, không phải đụng vào `src/`:

- **`content/timeline.js`** — thời lượng, thứ tự cảnh, chuyển động camera, caption, grade, nhạc
- **`content/menu.json`** — text và giá trên thẻ menu typeset

Thêm/sửa chuyển động camera thì vào `src/cameraMoves.js` (mỗi chuyển động là một hàm thuần).

## Cấu trúc

```
content/timeline.js        bảng dựng — nguồn sự thật duy nhất
content/menu.json          text menu (đã transcribe từ ảnh menu gốc)
assets/stills/             SLOT THẢ ẢNH — xem assets/stills/README.md
assets/audio/              nhạc nền
src/scene.js               scene three.js (ortho camera + quad + EffectComposer)
src/shaders/shot.js        fit 16:9→9:16, camera UV, grade, unsharp, glow, crossfade/whip
src/shaders/grain.js       pass cuối: film grain + S-curve
src/cameraMoves.js         11 chuyển động camera + clampCamera()
src/overlay.js             caption, end card, thẻ menu typeset, placeholder
scripts/prepare-assets.mjs tách frame, tải font, dựng manifest
scripts/render.mjs         Chromium render từng frame -> ffmpeg -> MP4
scripts/check-assets.mjs   bảng slot ảnh
.claude/skills/            10 skill three.js dùng khi viết scene này
```

## Ghi chú kỹ thuật

- **Vì sao tách clip thành chuỗi JPEG** thay vì dùng `<video>` làm texture: Chromium trong
  môi trường này không chắc có codec H.264, video texture rất dễ ra khung đen. Chuỗi frame
  còn cho render offline chính xác từng frame, không phụ thuộc timing playback.
- **Màu**: đây là bộ dựng 2D nên tắt hết chuyển đổi color space hai đầu
  (`texture.colorSpace = NoColorSpace`, `renderer.outputColorSpace = LinearSRGBColorSpace`).
  Để three tự giải mã sRGB→linear thì EffectComposer không mã hoá ngược ở pass cuối, ảnh ra
  tối và bết màu.
- **Render bằng SwiftShader** (container không có GPU) — khoảng 0.14s/frame ở 540×960.
- Clip gốc **không** dính watermark TikTok (đã kiểm tra frame thật), nên không cắt bù.
