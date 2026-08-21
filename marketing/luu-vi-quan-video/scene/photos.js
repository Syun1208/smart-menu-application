// The real photographs of the shop, plus the named regions we frame inside them.
//
// Nothing is pre-cropped on disk: a region is just a rectangle in UV space
// (0,0 = top-left of the source file) and the film shader samples that window
// out of the full-resolution image. That keeps every shot sharp and lets us
// re-frame a shot by editing two numbers.

import { HD_PHOTOS, HD_REGIONS } from './photos-enhanced.js';

export const PHOTOS = {
  ...HD_PHOTOS,
  combo:    { src: '../assets/photos/combo-boxes.jpg',    w: 1500, h: 1500 },
  menuNem:  { src: '../assets/photos/menu-nem.jpg',       w: 1229, h: 2000 },
  nemTall:  { src: '../assets/photos/nem-chien-tall.jpg', w: 1201, h: 1500 },
  nemWide:  { src: '../assets/photos/nem-chien-wide.jpg', w: 1500, h: 837  },
  menuFruit:{ src: '../assets/photos/menu-fruit.jpg',     w: 909,  h: 1500 },

  // sent later by the shop - proper high-resolution product photography
  fruitTrays:  { src: '../assets/photos/fruit-trays-counter.jpg', w: 2000, h: 1500 },
  fruitCups:   { src: '../assets/photos/fruit-cups-many.jpg',     w: 1320, h: 1630 },
  fruitCup:    { src: '../assets/photos/fruit-cup-hand.jpg',      w: 1814, h: 2000 },
  fruitGift:   { src: '../assets/photos/fruit-gift-box.jpg',      w: 1012, h: 901  },
  nemSongReal: { src: '../assets/photos/nem-song-board.jpg',      w: 2000, h: 1536 },
};

/**
 * Regions, as [x0, y0, x1, y1] fractions of the source photo.
 * Names describe the dish so the shot list reads like a shooting script.
 */
export const REGIONS = {
  // --- combo-boxes.jpg: the hero shot, two kraft boxes on the wooden table ---
  caVienSauce:   { photo: 'combo', rect: [0.42, 0.14, 0.90, 0.46] },  // fish balls under chilli sauce
  caVienPeanut:  { photo: 'combo', rect: [0.50, 0.16, 0.74, 0.34] },  // macro: crushed peanuts on top
  rauMuong:      { photo: 'combo', rect: [0.63, 0.20, 0.92, 0.46] },  // garlic morning glory
  comboBox:      { photo: 'combo', rect: [0.12, 0.46, 0.68, 0.86] },  // the mixed fried combo box
  comboMacro:    { photo: 'combo', rect: [0.26, 0.60, 0.52, 0.78] },  // sausage + dumpling close-up
  peanutBowl:    { photo: 'combo', rect: [0.74, 0.55, 0.96, 0.72] },  // fried shallot & peanut dip bowl
  brandPaper:    { photo: 'combo', rect: [0.02, 0.02, 0.52, 0.42] },  // branded wrapping paper
  comboWide:     { photo: 'combo', rect: [0.04, 0.06, 0.98, 0.94] },  // the whole table

  // --- nem-chien-tall.jpg / nem-chien-wide.jpg: fried nem on the board -------
  nemPhoMai:     { photo: 'nemTall', rect: [0.02, 0.17, 0.42, 0.47] }, // cheese nem balls in a bowl
  nemRan:        { photo: 'nemTall', rect: [0.52, 0.14, 1.00, 0.42] }, // golden rolls in the tray
  nemXu:         { photo: 'nemTall', rect: [0.24, 0.31, 0.78, 0.65] }, // battered nem sticks
  nemSauce:      { photo: 'nemTall', rect: [0.60, 0.60, 0.98, 0.80] }, // chilli garlic dip
  nemBoardWide:  { photo: 'nemWide', rect: [0.03, 0.04, 0.97, 0.92] }, // the whole board
  nemTallFull:   { photo: 'nemTall', rect: [0.00, 0.03, 1.00, 0.97] }, // portrait framing of the board
  nemBoardLeft:  { photo: 'nemWide', rect: [0.03, 0.10, 0.55, 0.90] },
  nemBoardRight: { photo: 'nemWide', rect: [0.42, 0.06, 0.98, 0.86] },

  // --- menu-nem.jpg: the printed menu and the product shots inside it --------
  menuNemFull:   { photo: 'menuNem', rect: [0.00, 0.00, 1.00, 1.00] },
  menuNemHead:   { photo: 'menuNem', rect: [0.03, 0.01, 0.97, 0.21] },
  nemSongTray:   { photo: 'menuNem', rect: [0.100, 0.262, 0.450, 0.392] },
  nemChienBowls: { photo: 'menuNem', rect: [0.556, 0.258, 0.918, 0.386] },
  comboPhoto:    { photo: 'menuNem', rect: [0.535, 0.590, 0.930, 0.782] },
  miTronPhoto:   { photo: 'menuNem', rect: [0.088, 0.800, 0.487, 0.947] },
  miTronEgg:     { photo: 'menuNem', rect: [0.230, 0.802, 0.470, 0.884] },
  miTronCheese:  { photo: 'menuNem', rect: [0.105, 0.856, 0.360, 0.944] },

  // --- menu-fruit.jpg -------------------------------------------------------
  fruitDam:      { photo: 'menuFruit', rect: [0.190, 0.360, 0.378, 0.500] },
  fruitMix:      { photo: 'menuFruit', rect: [0.535, 0.364, 0.922, 0.462] },
  fruitBox:      { photo: 'menuFruit', rect: [0.632, 0.632, 0.950, 0.748] },
  menuFruitHead: { photo: 'menuFruit', rect: [0.03, 0.01, 0.97, 0.20] },

  // --- the real fruit photography ------------------------------------------
  // NOTE: fruit-trays-counter.jpg carries a TikTok watermark along the bottom,
  // so every framing of it stops above y = 0.90.
  fruitCounter:   { photo: 'fruitTrays', rect: [0.02, 0.04, 0.98, 0.82] },
  fruitCounterHero:{ photo: 'fruitTrays', rect: [0.26, 0.20, 0.86, 0.76] },
  fruitCupsAll:   { photo: 'fruitCups',  rect: [0.02, 0.02, 0.98, 0.88] },
  fruitCupsTight: { photo: 'fruitCups',  rect: [0.18, 0.26, 0.86, 0.74] },
  fruitDamCup:    { photo: 'fruitCup',   rect: [0.04, 0.03, 0.96, 0.94] },
  fruitDamLabel:  { photo: 'fruitCup',   rect: [0.12, 0.50, 0.82, 0.96] },
  fruitBoxReal:   { photo: 'fruitGift',  rect: [0.02, 0.02, 0.98, 0.98] },
  fruitBoxTight:  { photo: 'fruitGift',  rect: [0.18, 0.18, 0.86, 0.82] },
  nemSongReal:    { photo: 'nemSongReal', rect: [0.05, 0.14, 0.95, 0.94] },

  // --- rescued crops: same framing, enlarged offline so cards stay sharp -----
  ...HD_REGIONS,
};

/** Region -> {photo, rect} with the photo record resolved. */
export function region(name) {
  const r = REGIONS[name];
  if (!r) throw new Error(`unknown region: ${name}`);
  return { name, photo: PHOTOS[r.photo], key: r.photo, rect: r.rect };
}
