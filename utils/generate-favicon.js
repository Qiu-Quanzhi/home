/**
 * Generate favicon.ico (48×48) from logo.png (project root).
 *
 * Usage: node utils/generate-favicon.js
 */

import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 48;

function buildIco({ width, height, buf }) {
  const offset = 6 + 16;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const dir = Buffer.alloc(16);
  dir.writeUInt8(width, 0);
  dir.writeUInt8(height, 1);
  dir.writeUInt16LE(1, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(buf.length, 8);
  dir.writeUInt32LE(offset, 12);

  return Buffer.concat([header, dir, buf]);
}

const png = await sharp(join(ROOT, 'logo.png'))
  .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

const ico = buildIco({ width: SIZE, height: SIZE, buf: png });
writeFileSync(join(ROOT, 'source', 'favicon.ico'), ico);
console.log(`✅ source/favicon.ico (${SIZE}×${SIZE}, ${(ico.length / 1024).toFixed(1)} KB)`);
