// Moi thu ve bang chu deu di qua day: caption, end card, the menu typeset,
// va placeholder cho canh chua co anh. Ve len <canvas> roi dua vao three.js
// duoi dang CanvasTexture => chu net, dung dau tieng Viet, khong qua model sinh anh.

export const FONT = '"Be Vietnam Pro", "Montserrat", "DejaVu Sans", "Liberation Sans", sans-serif';

function ctxOf(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.textBaseline = 'alphabetic';
  return { canvas: c, ctx: x };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}


// Ve chu can giua, tu thu nho co chu neu vuot qua be rong cho phep.
function fitText(ctx, text, cx, y, maxWidth, weight, size, minSize) {
  let fs = size;
  ctx.font = `${weight} ${fs}px ${FONT}`;
  while (ctx.measureText(text).width > maxWidth && fs > minSize) {
    fs -= 1;
    ctx.font = `${weight} ${fs}px ${FONT}`;
  }
  ctx.fillText(text, cx, y);
  return fs;
}

// Xuong dong theo be ngang, tra ve mang dong.
function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Caption 1/3 duoi khung, nen gradient mo de chu luon doc duoc tren moi anh. */
export function makeCaption(text, W, H, brand) {
  const { canvas, ctx } = ctxOf(W, H);
  if (!text) return canvas;

  const pad = Math.round(W * 0.075);
  const fs = Math.round(W * 0.052);
  ctx.font = `700 ${fs}px ${FONT}`;
  const lines = wrap(ctx, text, W - pad * 2);
  const lh = Math.round(fs * 1.32);
  const blockH = lines.length * lh;
  const baseY = Math.round(H * 0.815);

  // gradient chan khung
  const g = ctx.createLinearGradient(0, baseY - blockH - fs * 1.6, 0, H);
  g.addColorStop(0, 'rgba(20,10,6,0)');
  g.addColorStop(0.45, 'rgba(20,10,6,0.55)');
  g.addColorStop(1, 'rgba(20,10,6,0.80)');
  ctx.fillStyle = g;
  ctx.fillRect(0, baseY - blockH - fs * 1.6, W, H - (baseY - blockH - fs * 1.6));

  // gach mau thuong hieu
  ctx.fillStyle = brand.orange;
  ctx.fillRect(pad, baseY - blockH - Math.round(fs * 0.75), Math.round(W * 0.13), Math.round(fs * 0.11));

  ctx.font = `700 ${fs}px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = Math.round(fs * 0.35);
  lines.forEach((l, i) => ctx.fillText(l, pad, baseY - blockH + (i + 1) * lh - Math.round(lh * 0.28)));
  ctx.shadowBlur = 0;
  return canvas;
}

/** Placeholder co nhan cho canh chua co anh - de duyet nhip ngay khi con thieu asset. */
export function makePlaceholder(shot, W, H, brand) {
  const { canvas, ctx } = ctxOf(W, H);
  ctx.fillStyle = brand.cream;
  ctx.fillRect(0, 0, W, H);

  // van soc cheo nhat cho ro day la o trong
  ctx.save();
  ctx.globalAlpha = 0.055;
  ctx.strokeStyle = brand.brown;
  ctx.lineWidth = 26;
  for (let i = -H; i < W + H; i += 92) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke();
  }
  ctx.restore();

  const pad = Math.round(W * 0.10);
  ctx.fillStyle = brand.red;
  ctx.font = `900 ${Math.round(W * 0.30)}px ${FONT}`;
  ctx.globalAlpha = 0.18;
  ctx.fillText(String(shot.n).padStart(2, '0'), pad, Math.round(H * 0.36));
  ctx.globalAlpha = 1;

  ctx.fillStyle = brand.brown;
  ctx.font = `700 ${Math.round(W * 0.030)}px ${FONT}`;
  ctx.fillText(`CẢNH ${shot.n} · ${shot.t0}s – ${shot.t1}s`, pad, Math.round(H * 0.42));

  ctx.fillStyle = brand.red;
  ctx.font = `900 ${Math.round(W * 0.062)}px ${FONT}`;
  wrap(ctx, shot.title, W - pad * 2).forEach((l, i) =>
    ctx.fillText(l, pad, Math.round(H * 0.49) + i * Math.round(W * 0.075)));

  ctx.fillStyle = 'rgba(74,47,34,0.72)';
  ctx.font = `400 ${Math.round(W * 0.030)}px ${FONT}`;
  const note = `Chưa có ảnh cho cảnh này. Thả file vào assets/stills/${shot.still} rồi chạy lại npm run render — không cần sửa code.`;
  wrap(ctx, note, W - pad * 2).forEach((l, i) =>
    ctx.fillText(l, pad, Math.round(H * 0.60) + i * Math.round(W * 0.042)));

  ctx.strokeStyle = brand.orange;
  ctx.lineWidth = 6;
  roundRect(ctx, pad * 0.6, pad * 0.6, W - pad * 1.2, H - pad * 1.2, 28);
  ctx.stroke();
  return canvas;
}

/** The menu typeset lai tu menu.json - dung khi chua co anh menu goc. */
export function makeMenuCard(menu, W, brand) {
  const H = Math.round(W * 2.15);          // cao hon khung 9:16 => co duong cho camera crawl
  const { canvas, ctx } = ctxOf(W, H);
  const c = menu.brand.colors;
  const pad = Math.round(W * 0.055);

  ctx.fillStyle = c.cream; ctx.fillRect(0, 0, W, H);

  let y = Math.round(H * 0.045);
  ctx.textAlign = 'center';
  ctx.fillStyle = c.red;
  ctx.font = `900 ${Math.round(W * 0.098)}px ${FONT}`;
  ctx.fillText(menu.brand.name, W / 2, y); y += Math.round(W * 0.062);

  ctx.fillStyle = c.brown;
  ctx.font = `italic 700 ${Math.round(W * 0.042)}px ${FONT}`;
  ctx.fillText(menu.brand.sub, W / 2, y); y += Math.round(W * 0.046);

  ctx.font = `400 ${Math.round(W * 0.031)}px ${FONT}`;
  ctx.fillStyle = 'rgba(74,47,34,0.85)';
  ctx.fillText(menu.brand.tagline, W / 2, y); y += Math.round(W * 0.055);

  // hang dat hang + freeship
  const bw = Math.round(W * 0.50), bh = Math.round(W * 0.082);
  ctx.fillStyle = c.red;
  roundRect(ctx, pad, y, bw, bh, bh * 0.28); ctx.fill();
  ctx.fillStyle = '#fff';
  fitText(ctx, 'ĐẶT HÀNG  ' + menu.brand.phone, pad + bw / 2, y + bh * 0.68,
    bw - Math.round(W * 0.045), 900, Math.round(W * 0.040), Math.round(W * 0.026));

  ctx.strokeStyle = c.orange; ctx.lineWidth = 3;
  const bw2 = W - pad * 2 - bw - Math.round(W * 0.02);
  roundRect(ctx, pad + bw + Math.round(W * 0.02), y, bw2, bh, bh * 0.28); ctx.stroke();
  ctx.fillStyle = c.brown;
  fitText(ctx, menu.brand.ship, pad + bw + Math.round(W * 0.02) + bw2 / 2, y + bh * 0.66,
    bw2 - Math.round(W * 0.030), 700, Math.round(W * 0.030), Math.round(W * 0.020));
  y += bh + Math.round(W * 0.022);

  // gio mo cua
  ctx.fillStyle = c.brown;
  roundRect(ctx, pad, y, W - pad * 2, Math.round(W * 0.068), Math.round(W * 0.02)); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(W * 0.029)}px ${FONT}`;
  const hrs = 'GIỜ MỞ CỬA   ' + menu.brand.hours.map((h) => `${h.label}: ${h.value}`).join('   |   ');
  fitText(ctx, hrs, W / 2, y + Math.round(W * 0.046),
    W - pad * 2 - Math.round(W * 0.040), 700, Math.round(W * 0.029), Math.round(W * 0.020));
  y += Math.round(W * 0.068) + Math.round(W * 0.040);

  ctx.textAlign = 'left';
  // cac khoi mon
  for (const sec of menu.sections) {
    const dark = sec.theme === 'dark';
    const rows = sec.items.length;
    const boxH = Math.round(W * 0.075) + rows * Math.round(W * 0.062) + Math.round(W * 0.030);
    ctx.fillStyle = dark ? c.brown : c.paper;
    roundRect(ctx, pad, y, W - pad * 2, boxH, Math.round(W * 0.022)); ctx.fill();
    if (!dark) { ctx.strokeStyle = 'rgba(74,47,34,0.35)'; ctx.lineWidth = 3; ctx.stroke(); }

    let iy = y + Math.round(W * 0.062);
    ctx.fillStyle = dark ? c.orange : c.red;
    ctx.font = `900 ${Math.round(W * 0.044)}px ${FONT}`;
    ctx.fillText(sec.title, pad + Math.round(W * 0.035), iy);
    iy += Math.round(W * 0.052);

    for (const it of sec.items) {
      const px = W - pad - Math.round(W * 0.035);
      const nameX = pad + Math.round(W * 0.035);

      // Do be rong khoi gia truoc, roi moi ve ten trong phan con lai.
      ctx.font = `900 ${Math.round(W * 0.040)}px ${FONT}`;
      const priceW = ctx.measureText(it.price).width;
      ctx.font = `500 ${Math.round(W * 0.026)}px ${FONT}`;
      const unitW = it.unit ? ctx.measureText(' ' + it.unit).width : 0;
      const nameRoom = px - unitW - priceW - nameX - Math.round(W * 0.030);

      // Ten dai thi thu nho co chu cho vua, khong bao gio de de len gia.
      let fsName = Math.round(W * 0.034);
      ctx.font = `600 ${fsName}px ${FONT}`;
      while (ctx.measureText(it.name).width > nameRoom && fsName > Math.round(W * 0.021)) {
        fsName -= 1;
        ctx.font = `600 ${fsName}px ${FONT}`;
      }
      ctx.fillStyle = dark ? 'rgba(255,255,255,0.92)' : c.ink;
      ctx.fillText(it.name, nameX, iy);

      ctx.textAlign = 'right';
      ctx.fillStyle = dark ? c.orange : c.red;
      ctx.font = `900 ${Math.round(W * 0.040)}px ${FONT}`;
      ctx.fillText(it.price, px - unitW, iy);
      if (it.unit) {
        ctx.fillStyle = dark ? 'rgba(255,255,255,0.65)' : 'rgba(42,26,18,0.6)';
        ctx.font = `500 ${Math.round(W * 0.026)}px ${FONT}`;
        ctx.fillText(it.unit, px, iy);
      }
      ctx.textAlign = 'left';
      iy += Math.round(W * 0.062);
    }
    y += boxH + Math.round(W * 0.028);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(74,47,34,0.8)';
  ctx.font = `italic 600 ${Math.round(W * 0.030)}px ${FONT}`;
  ctx.fillText(menu.brand.footer, W / 2, Math.min(H - Math.round(W * 0.045), y + Math.round(W * 0.055)));
  return canvas;
}

/** The menu trai cay - dung khi chua co anh menu trai cay goc. */
export function makeFruitCard(menu, W, brand) {
  const H = Math.round(W * 1.95);
  const { canvas, ctx } = ctxOf(W, H);
  const c = menu.brand.colors;
  const pad = Math.round(W * 0.075);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#fff6ea'); g.addColorStop(1, '#ffe8d2');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  let y = Math.round(H * 0.11);
  ctx.fillStyle = c.red;
  ctx.font = `900 ${Math.round(W * 0.092)}px ${FONT}`;
  ctx.fillText(menu.brand.name, W / 2, y); y += Math.round(W * 0.085);

  ctx.fillStyle = c.orange;
  ctx.font = `900 ${Math.round(W * 0.072)}px ${FONT}`;
  ctx.fillText(menu.fruit.title, W / 2, y); y += Math.round(W * 0.075);

  ctx.textAlign = 'left';
  for (const it of menu.fruit.items) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    roundRect(ctx, pad, y, W - pad * 2, Math.round(W * 0.105), Math.round(W * 0.024)); ctx.fill();
    ctx.fillStyle = c.ink;
    ctx.font = `700 ${Math.round(W * 0.040)}px ${FONT}`;
    ctx.fillText(it.name, pad + Math.round(W * 0.040), y + Math.round(W * 0.068));
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(42,26,18,0.6)';
    ctx.font = `500 ${Math.round(W * 0.030)}px ${FONT}`;
    ctx.fillText(it.unit, W - pad - Math.round(W * 0.040), y + Math.round(W * 0.068));
    ctx.textAlign = 'left';
    y += Math.round(W * 0.128);
  }

  ctx.textAlign = 'center';
  y += Math.round(W * 0.030);
  ctx.fillStyle = c.red;
  roundRect(ctx, pad, y, W - pad * 2, Math.round(W * 0.098), Math.round(W * 0.030)); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${Math.round(W * 0.044)}px ${FONT}`;
  ctx.fillText(menu.brand.phone, W / 2, y + Math.round(W * 0.066));
  y += Math.round(W * 0.098) + Math.round(W * 0.050);

  ctx.fillStyle = 'rgba(74,47,34,0.85)';
  ctx.font = `400 ${Math.round(W * 0.031)}px ${FONT}`;
  wrap(ctx, menu.fruit.note, W - pad * 2).forEach((l, i) =>
    ctx.fillText(l, W / 2, y + i * Math.round(W * 0.044)));
  return canvas;
}

/** End card: ten quan, dong san pham, so dien thoai, freeship. Dung khung 9:16. */
export function makeEndcard(brand, W, H) {
  const { canvas, ctx } = ctxOf(W, H);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#fff7ec'); g.addColorStop(1, '#f7e2c9');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  const cx = W / 2;
  let y = Math.round(H * 0.315);

  // dau nhan: thia + nia, khop voi tem tren hop
  ctx.strokeStyle = brand.brown; ctx.lineWidth = Math.round(W * 0.009);
  ctx.lineCap = 'round';
  const s = Math.round(W * 0.072);
  const my = y - Math.round(W * 0.055);           // day dau thia/nia len, tranh de len ten quan
  ctx.beginPath(); ctx.moveTo(cx - s * 1.5, my - s * 1.5); ctx.lineTo(cx - s * 1.5, my - s * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx - s * 1.5, my - s * 1.95, s * 0.34, s * 0.52, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + s * 1.5, my - s * 1.5); ctx.lineTo(cx + s * 1.5, my - s * 0.1); ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + s * 1.5 + i * s * 0.26, my - s * 2.3);
    ctx.lineTo(cx + s * 1.5 + i * s * 0.26, my - s * 1.62);
    ctx.stroke();
  }

  ctx.fillStyle = brand.red;
  fitText(ctx, brand.name, cx, y + Math.round(W * 0.115),
    W - Math.round(W * 0.12), 900, Math.round(W * 0.125), Math.round(W * 0.075));
  y += Math.round(W * 0.205);

  ctx.fillStyle = brand.brown;
  ctx.font = `italic 700 ${Math.round(W * 0.044)}px ${FONT}`;
  ctx.fillText(brand.slogan, cx, y); y += Math.round(W * 0.095);

  ctx.fillStyle = 'rgba(74,47,34,0.9)';
  fitText(ctx, brand.line, cx, y, W - Math.round(W * 0.12), 600,
    Math.round(W * 0.042), Math.round(W * 0.028)); y += Math.round(W * 0.105);

  const bw = Math.round(W * 0.72), bh = Math.round(W * 0.125);
  ctx.fillStyle = brand.red;
  roundRect(ctx, cx - bw / 2, y, bw, bh, bh * 0.30); ctx.fill();
  ctx.fillStyle = '#fff';
  fitText(ctx, brand.phone, cx, y + bh * 0.70, bw - Math.round(W * 0.070), 900,
    Math.round(W * 0.068), Math.round(W * 0.042));
  y += bh + Math.round(W * 0.055);

  ctx.strokeStyle = brand.orange; ctx.lineWidth = 4;
  const bw2 = Math.round(W * 0.62), bh2 = Math.round(W * 0.088);
  roundRect(ctx, cx - bw2 / 2, y, bw2, bh2, bh2 * 0.32); ctx.stroke();
  ctx.fillStyle = brand.brown;
  fitText(ctx, brand.ship, cx, y + bh2 * 0.66, bw2 - Math.round(W * 0.055), 700,
    Math.round(W * 0.038), Math.round(W * 0.026));
  return canvas;
}
