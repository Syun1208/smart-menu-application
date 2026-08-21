# Ảnh cho từng cảnh

Thả ảnh vào **chính thư mục này**, đúng tên file bên dưới. Không cần sửa code —
`npm run prepare-assets` sẽ tự nhận, `npm run render` dựng lại là có ngay.

| File | Cảnh | Ghi chú |
|---|---|---|
| `shot01-khay-trai-cay.jpg` | 1 — Khay trái cây cắt sẵn | tự sinh từ clip, chỉ dùng khi thiếu frame |
| `shot02-nem-song-nem-xu.jpg` | 2 — Nem sống & nem xù | tự sinh từ clip |
| `shot03-to-trai-cay-mix.jpg` | 3 — Các tô trái cây mix | tự sinh từ clip |
| `shot04-trai-cay-dam.jpg` | 4 — Trái cây dầm | tự sinh từ clip |
| `shot05-combo-ca-vien.jpg` | 5 — Combo cá viên & rau | **cần thả** |
| `shot06-nem-chien.jpg` | 6 — Nem chiên & đồ chiên | **cần thả** |
| `shot07-menu-nem.jpg` | 7 — Menu nem | **cần thả** — chưa có thì dùng thẻ typeset từ `content/menu.json` |
| `shot08-nem-chien-goc-rong.jpg` | 8 — Nem chiên góc rộng | **cần thả** |
| `shot09-menu-trai-cay.jpg` | 9 — Menu trái cây | **cần thả** — chưa có thì dùng thẻ typeset |
| `shot10-box-trai-cay.jpg` | 10 — Box trái cây cao cấp | **cần thả** |
| `shot11-logo.png` | 11 — End card / logo | tuỳ chọn — chưa có thì dùng end card typeset |

## Ảnh menu (cảnh 7 và 9)

Hai cảnh này để `fit: 'width'`: **luôn dùng trọn bề ngang ảnh**, chỉ cắt hoặc thêm
viền theo chiều dọc. Nghĩa là không bao giờ cắt mất một cột giá.

Camera được ghim tự động (`clampCamera`), nên ảnh tỉ lệ nào cũng an toàn:

- ảnh **cao hơn** khung 9:16 (tỉ lệ ngang/dọc < 0.5625) → camera crawl dọc thật, đi hết menu
- ảnh **thấp hơn** khung → tự giữ nguyên giữa khung, thêm viền màu kem trên/dưới, không lia ra ngoài mép ảnh

Ảnh menu càng cao thì cảnh càng đẹp. Ảnh menu bạn đang có tỉ lệ ~0.61 (thấp hơn khung)
nên nó sẽ hiển thị trọn vẹn và đứng yên — vẫn đọc được hết giá, chỉ là không có crawl.

`npm run check-assets` in ra ảnh nào rơi vào trường hợp nào.
