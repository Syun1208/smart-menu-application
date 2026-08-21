// Doc kich thuoc anh tu header file (JPEG/PNG/WebP) - khong can thu vien ngoai.
import fs from 'node:fs';

export function imageSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(64 * 1024);
    const n = fs.readSync(fd, head, 0, head.length, 0);
    const b = head.subarray(0, n);
    if (b[0] === 0x89 && b[1] === 0x50) {                     // PNG
      return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    }
    if (b[0] === 0xff && b[1] === 0xd8) {                     // JPEG
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
          return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') {
      if (b.subarray(12, 16).toString('latin1') === 'VP8X') {
        return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      }
    }
  } finally { fs.closeSync(fd); }
  return null;
}
