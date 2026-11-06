// Generates the placeholder property photos (one per listing type) as PNGs
// using only Node built-ins, so the repo needs no image tooling or remote hosts.
// Run: node scripts/generate-images.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const W = 1200;
const H = 800;
const PALETTES = {
  apartment: [[41, 98, 160], [168, 206, 232]],
  house: [[46, 112, 78], [214, 232, 170]],
  studio: [[150, 70, 110], [244, 200, 190]],
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png([from, to]) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    const row = Buffer.alloc(1 + W * 3); // filter byte 0 + RGB
    for (let x = 0; x < W; x++) {
      const t = (x / W + y / H) / 2; // diagonal gradient
      for (let i = 0; i < 3; i++) row[1 + x * 3 + i] = Math.round(from[i] + (to[i] - from[i]) * t);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync(new URL("../src/assets", import.meta.url), { recursive: true });
for (const [name, palette] of Object.entries(PALETTES)) {
  writeFileSync(new URL(`../src/assets/${name}.png`, import.meta.url), png(palette));
}
