// Generates the PWA icons: a 3x3 grid of rounded blocks mimicking the d3
// calendar/heatmap cells. Blocks 1, 2, 4 and 9 (the last) are heatmap-green; the
// rest use the empty-cell color, on the app's dark background. No dependencies —
// a minimal PNG encoder with supersampled rounded rects.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
mkdirSync(PUBLIC, { recursive: true });

// Color schemes matching the app's themes. "lite" mirrors the light theme:
// white background, pale empty cells, a medium green for active cells.
const SCHEMES = {
  dark: {
    bg: [13, 17, 23], // #0d1117 app background
    empty: [22, 27, 34], // #161b22 empty heatmap cell
    green: [57, 211, 83], // #39d353 active (level 4) cell
  },
  lite: {
    bg: [255, 255, 255], // #ffffff light background
    empty: [175, 184, 193], // #afb8c1 empty cell — darker grey for contrast on white
    green: [45, 164, 78], // #2da44e active cell (light theme)
  },
};
const ACTIVE = new Set([1, 2, 4, 9]); // 1-indexed, row-major; 9 = last block

// CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// Is a point inside an axis-aligned rounded rectangle?
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const rx = Math.min(r, (x1 - x0) / 2);
  let cxC = null,
    cyC = null;
  if (x < x0 + rx) cxC = x0 + rx;
  else if (x > x1 - rx) cxC = x1 - rx;
  if (y < y0 + rx) cyC = y0 + rx;
  else if (y > y1 - rx) cyC = y1 - rx;
  if (cxC !== null && cyC !== null) {
    return (x - cxC) ** 2 + (y - cyC) ** 2 <= rx * rx; // corner region
  }
  return true; // edge/interior
}

function makePng(size, { maskable = false, scheme = SCHEMES.dark } = {}) {
  const BG = scheme.bg,
    EMPTY = scheme.empty,
    GREEN = scheme.green;
  // Smaller grid (more padding) for maskable so it sits inside the safe zone.
  const pad = size * (maskable ? 0.22 : 0.14);
  const gap = size * 0.05;
  const span = size - 2 * pad;
  const cell = (span - 2 * gap) / 3;
  const stride = cell + gap;
  const cr = cell * 0.22;

  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col + 1;
      cells.push({
        x0: pad + col * stride,
        y0: pad + row * stride,
        x1: pad + col * stride + cell,
        y1: pad + row * stride + cell,
        color: ACTIVE.has(idx) ? GREEN : EMPTY,
      });
    }
  }

  const S = 4; // supersampling for smooth corners
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // PNG filter byte: none
    for (let x = 0; x < size; x++) {
      let cov = 0,
        color = null;
      for (const c of cells) {
        if (x < c.x0 - 1 || x > c.x1 + 1 || y < c.y0 - 1 || y > c.y1 + 1)
          continue;
        let hits = 0;
        for (let sy = 0; sy < S; sy++) {
          for (let sx = 0; sx < S; sx++) {
            const px = x + (sx + 0.5) / S,
              py = y + (sy + 0.5) / S;
            if (inRoundRect(px, py, c.x0, c.y0, c.x1, c.y1, cr)) hits++;
          }
        }
        const cv = hits / (S * S);
        if (cv > cov) {
          cov = cv;
          color = c.color;
        }
      }
      const out = color
        ? [
            Math.round(BG[0] + (color[0] - BG[0]) * cov),
            Math.round(BG[1] + (color[1] - BG[1]) * cov),
            Math.round(BG[2] + (color[2] - BG[2]) * cov),
          ]
        : BG;
      raw[p++] = out[0];
      raw[p++] = out[1];
      raw[p++] = out[2];
      raw[p++] = 255;
    }
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // 8-bit RGBA
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const targets = [
  ["pwa-192.png", 192, {}],
  ["pwa-512.png", 512, {}],
  ["pwa-512-maskable.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, {}],
  // Lite (light-theme) variants.
  ["pwa-192-lite.png", 192, { scheme: SCHEMES.lite }],
  ["pwa-512-lite.png", 512, { scheme: SCHEMES.lite }],
  ["pwa-512-maskable-lite.png", 512, { maskable: true, scheme: SCHEMES.lite }],
  ["apple-touch-icon-lite.png", 180, { scheme: SCHEMES.lite }],
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(PUBLIC, name), makePng(size, opts));
  console.log(`wrote public/${name} (${size}x${size})`);
}
