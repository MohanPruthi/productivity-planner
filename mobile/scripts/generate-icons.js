// Draws the Planner logo (indigo square with a 2x2 grid of tiles) into the PNGs Expo needs.
// No dependencies: rounded rectangles are rasterised with 4x4 supersampling and encoded with zlib.
// Run from mobile/: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const INDIGO = [0x63, 0x66, 0xf1, 255];
const WHITE = [255, 255, 255, 255];
const LIGHT = [0xa5, 0xb4, 0xfc, 255];
const SS = 4;

function inRoundedRect(px, py, s) {
  if (px < s.x || py < s.y || px > s.x + s.w || py > s.y + s.h) return false;
  const r = s.r;
  const cx = Math.min(Math.max(px, s.x + r), s.x + s.w - r);
  const cy = Math.min(Math.max(py, s.y + r), s.y + s.h - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function render(size, shapes) {
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let color = null;
          for (const s of shapes) if (inRoundedRect(px, py, s)) color = s.color;
          if (color) {
            const alpha = color[3] / 255;
            r += color[0] * alpha; g += color[1] * alpha; b += color[2] * alpha; a += alpha;
          }
        }
      }
      const i = (y * size + x) * 4;
      if (a > 0) {
        data[i] = Math.round(r / a);
        data[i + 1] = Math.round(g / a);
        data[i + 2] = Math.round(b / a);
      }
      data[i + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return data;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typeAndBody = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndBody));
  return Buffer.concat([len, typeAndBody, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Tiles from the 64-unit favicon (x/y 13 and 34, size 17, radius 4), scaled and centred.
function tiles(size, scale, colors = [WHITE, LIGHT, LIGHT, WHITE]) {
  const offset = size / 2 - 32 * scale;
  const pos = [[13, 13], [34, 13], [13, 34], [34, 34]];
  return pos.map(([x, y], i) => ({
    x: offset + x * scale,
    y: offset + y * scale,
    w: 17 * scale,
    h: 17 * scale,
    r: 4 * scale,
    color: colors[i],
  }));
}

const square = (size, r) => ({ x: 0, y: 0, w: size, h: size, r, color: INDIGO });

const outputs = {
  // iOS masks the corners itself, so the app icon is a full square
  'icon.png': [1024, (s) => [square(s, 0), ...tiles(s, s / 64)]],
  // Android adaptive icon: tiles kept inside the safe zone, indigo comes from backgroundColor
  'android-icon-foreground.png': [1024, (s) => tiles(s, s / 96)],
  'android-icon-monochrome.png': [1024, (s) => tiles(s, s / 96, [WHITE, WHITE, WHITE, WHITE])],
  'splash-icon.png': [512, (s) => [square(s, (s / 64) * 14), ...tiles(s, s / 64)]],
  'favicon.png': [48, (s) => [square(s, (s / 64) * 14), ...tiles(s, s / 64)]],
};

const outDir = path.join(__dirname, '..', 'assets', 'images');
fs.mkdirSync(outDir, { recursive: true });
for (const [name, [size, build]] of Object.entries(outputs)) {
  fs.writeFileSync(path.join(outDir, name), encodePng(size, render(size, build(size))));
  console.log(`wrote assets/images/${name} (${size}x${size})`);
}
