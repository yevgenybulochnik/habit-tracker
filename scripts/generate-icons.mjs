// Generates the PWA icons (dark background + glowing green dot, matching the
// app's header motif) with no external dependencies — a minimal PNG encoder.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
mkdirSync(PUBLIC, { recursive: true });

const BG = [13, 17, 23]; // #0d1117
const DOT = [57, 211, 83]; // #39d353

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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function makePng(size, { maskable = false } = {}) {
  const cx = size / 2, cy = size / 2;
  // Smaller core when maskable so it stays inside the safe zone.
  const core = size * (maskable ? 0.22 : 0.26);
  const glow = size * (maskable ? 0.34 : 0.42);
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter byte: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      let col;
      if (d <= core) col = DOT;
      else if (d <= glow) {
        const t = 1 - (d - core) / (glow - core); // 1 → 0 falloff
        const e = t * t; // ease for a softer glow
        col = [
          Math.round(BG[0] + (DOT[0] - BG[0]) * e),
          Math.round(BG[1] + (DOT[1] - BG[1]) * e),
          Math.round(BG[2] + (DOT[2] - BG[2]) * e),
        ];
      } else col = BG;
      raw[p++] = col[0];
      raw[p++] = col[1];
      raw[p++] = col[2];
      raw[p++] = 255;
    }
  }
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const targets = [
  ["pwa-192.png", 192, {}],
  ["pwa-512.png", 512, {}],
  ["pwa-512-maskable.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, {}],
];
for (const [name, size, opts] of targets) {
  writeFileSync(join(PUBLIC, name), makePng(size, opts));
  console.log(`wrote public/${name} (${size}x${size})`);
}
