// Bang dung 60 giay cho TVC Luu Vi Quan (9:16).
// Day la NGUON SU THAT DUY NHAT: prepare-assets, preview va render deu doc file nay.
// Sua thoi luong / caption / chuyen dong o day, khong sua trong src/.

export const FRAME = { width: 1080, height: 1920, fps: 30 };
export const DURATION = 60;

// Nhac nen: cat 60s tu file goc (117s), fade in 0.5s / fade out 1.5s.
export const AUDIO = {
  file: 'assets/audio/ngon-qua-di.mp3',
  // Do tung doan bai hat: 0s la intro va la doan NHE NHAT (-18.3 LUFS) - do la ly do
  // ban dau nghe yeu. Cua so 60s bat dau tu 50s chac tieng nhat (-12.9 LUFS, LRA 3.5).
  offset: 50,
  fadeIn: 0.4,
  fadeOut: 1.8,
  // Chuan hoa do lon khi xuat. Video tham khao cua khach o -7.4 LUFS; -9.5 du chac
  // tren loa dien thoai ma khong bi ep qua tay.
  loudness: { I: -8.5, TP: -1.0, LRA: 7 },
};

export const BRAND = {
  name: 'LƯU VỊ QUÁN',
  slogan: 'Vị ngon đáng lưu lại',
  line: 'Trái cây • Nem • Cá viên • Mì trộn',
  phone: '0947 815 316',
  ship: 'Freeship bán kính 2km',
  cream: '#fdf3e7',
  red: '#c8401b',
  orange: '#e8801f',
  brown: '#4a2f22',
};

// 4 clip goc, moi clip 10.006s @ 1280x720. `in` = giay bat dau cat trong clip goc.
export const CLIPS = {
  shot01: { file: 'Slow_cinematic_push_in_across', in: 0.6 },
  shot02: { file: 'Slow_dolly_forward_toward_the', in: 0.6 },
  shot03: { file: 'A_nh___Ca_c_to__tra_i_ca_y_mix_', in: 0.8 },
  shot04: { file: 'A_nh___Tra_i_ca_y_da__m___gi', in: 1.0 },
};

// grade mac dinh: am, tuoi, hop khau vi quang cao do an
const WARM = { warmth: 0.045, saturation: 1.05, contrast: 1.02, vignette: 0.10, sharpen: 0.35 };
const HOT  = { warmth: 0.065, saturation: 1.07, contrast: 1.03, vignette: 0.12, sharpen: 0.40 };
const CLEAN = { warmth: 0.02, saturation: 1.02, contrast: 1.00, vignette: 0.06, sharpen: 0.30 };

export const SHOTS = [
  {
    id: 'shot01', n: 1, title: 'Khay trái cây cắt sẵn',
    t0: 0, t1: 6,
    source: { kind: 'frames', clip: 'shot01' },
    still: 'shot01-khay-trai-cay.jpg',
    fit: 'auto',
    // Da kiem tra frame that: clip nay KHONG dinh watermark TikTok (model sinh video
    // da cat mat duoi roi), nen khong can zoom bu - giu tron dien tich anh.
    bias: { x: 0, y: 0 },
    move: 'pushIn', ease: 'inOutSine',
    grade: WARM, glow: 0.035,
    caption: 'Trái cây cắt sẵn — tươi mỗi ngày',
    transition: { type: 'fade', dur: 0.0 },
  },
  {
    id: 'shot02', n: 2, title: 'Nem sống & nem xù',
    t0: 6, t1: 12,
    source: { kind: 'frames', clip: 'shot02' },
    still: 'shot02-nem-song-nem-xu.jpg',
    fit: 'auto', bias: { x: 0, y: 0 },
    move: 'dollyForward', ease: 'inOutSine',
    grade: WARM, glow: 0.040,
    caption: 'Nem chua Trần Công Châu',
    transition: { type: 'fade', dur: 0.45 },
  },
  {
    id: 'shot03', n: 3, title: 'Các tô trái cây mix',
    t0: 12, t1: 18,
    source: { kind: 'frames', clip: 'shot03' },
    still: 'shot03-to-trai-cay-mix.jpg',
    fit: 'auto', bias: { x: 0, y: 0 },
    move: 'overheadGlide', ease: 'inOutSine',
    grade: WARM, glow: 0.055,
    caption: 'Mix đủ vị — dưa hấu, kiwi, việt quất',
    transition: { type: 'fade', dur: 0.45 },
  },
  {
    id: 'shot04', n: 4, title: 'Trái cây dầm sốt kem',
    t0: 18, t1: 24,
    source: { kind: 'frames', clip: 'shot04' },
    still: 'shot04-trai-cay-dam.jpg',
    fit: 'auto', bias: { x: 0, y: 0 },
    move: 'closePush', ease: 'inOutSine',
    grade: WARM, glow: 0.045,
    caption: 'Trái cây dầm sốt kem béo mịn',
    transition: { type: 'fade', dur: 0.45 },
  },
  {
    id: 'shot05', n: 5, title: 'Combo cá viên & rau',
    t0: 24, t1: 30,
    source: { kind: 'still' },
    still: 'shot05-combo-ca-vien.jpg',
    fit: 'auto', bias: { x: 0, y: 0 },
    move: 'topDownPush', ease: 'inOutSine',
    grade: HOT, glow: 0.085,
    caption: 'Combo cá viên mắm tỏi — 50k / 70k / 100k',
    // Doi nhom: trai cay -> do nong. Whip-blur.
    transition: { type: 'fade', dur: 0.50 },
  },
  {
    id: 'shot06', n: 6, title: 'Nem chiên & đồ chiên',
    t0: 30, t1: 35,
    source: { kind: 'still' },
    still: 'shot06-nem-chien.jpg',
    fit: 'auto', bias: { x: 0, y: 0 },
    move: 'orbitPush', ease: 'outCubic',
    grade: HOT, glow: 0.095,
    caption: 'Nem giòn rụm · Phô mai kéo sợi',
    transition: { type: 'fade', dur: 0.35 },
  },
  {
    id: 'shot07', n: 7, title: 'Menu nem',
    t0: 35, t1: 42,
    source: { kind: 'still', fallback: 'menu' },
    still: 'shot07-menu-nem.jpg',
    // 'width' = luon dung tron be ngang anh menu, chi cat/vien theo chieu doc.
    // Khong bao gio cat mat mot cot gia. Camera duoc ghim tu dong (clampCamera):
    // menu cao hon khung -> crawl that; menu thap hon khung -> dung yen giua khung.
    fit: 'width', bias: { x: 0, y: 0 },
    move: 'verticalCrawl', ease: 'linear',
    grade: CLEAN, glow: 0,
    lockText: true,
    caption: null,
    transition: { type: 'fade', dur: 0.45 },
  },
  {
    id: 'shot08', n: 8, title: 'Nem chiên góc rộng',
    t0: 42, t1: 47,
    source: { kind: 'still' },
    still: 'shot08-nem-chien-goc-rong.jpg',
    fit: 'auto', bias: { x: 0, y: 0 },
    move: 'slideLR', ease: 'outCubic',
    grade: HOT, glow: 0.090,
    caption: 'Nem trần · Nem xù · Nem phô mai · Nem bò pía',
    transition: { type: 'fade', dur: 0.50 },
  },
  {
    id: 'shot09', n: 9, title: 'Menu trái cây',
    t0: 47, t1: 53,
    source: { kind: 'still', fallback: 'fruit' },
    still: 'shot09-menu-trai-cay.jpg',
    fit: 'width', bias: { x: 0, y: 0 },
    move: 'slowZoom', ease: 'linear',
    grade: CLEAN, glow: 0,
    lockText: true,
    caption: null,
    transition: { type: 'fade', dur: 0.45 },
  },
  {
    id: 'shot10', n: 10, title: 'Box trái cây cao cấp',
    t0: 53, t1: 56,
    source: { kind: 'still' },
    still: 'shot10-box-trai-cay.jpg',
    fit: 'auto', bias: { x: 0, y: 0 },
    move: 'luxuryPush', ease: 'inOutSine',
    grade: WARM, glow: 0.065,
    caption: 'Box trái cây cao cấp — quà tặng',
    transition: { type: 'fade', dur: 0.45 },
  },
  {
    id: 'shot11', n: 11, title: 'End card',
    t0: 56, t1: 60,
    source: { kind: 'still', fallback: 'endcard' },
    still: 'shot11-logo.png',
    fit: 'contain', bias: { x: 0, y: 0 },
    move: 'holdPush', ease: 'linear',
    grade: CLEAN, glow: 0,
    lockText: true,
    caption: null,
    endcard: true,
    transition: { type: 'cut', dur: 0 },
  },
];

export function shotAt(t) {
  for (let i = 0; i < SHOTS.length; i++) {
    if (t < SHOTS[i].t1 || i === SHOTS.length - 1) return { shot: SHOTS[i], index: i };
  }
  return { shot: SHOTS[SHOTS.length - 1], index: SHOTS.length - 1 };
}
