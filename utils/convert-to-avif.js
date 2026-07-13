/**
 * Convert webp/png/jpg images in the project to AVIF format.
 * Only keeps the AVIF if it is smaller than the original.
 * Original files are always preserved.
 *
 * Usage: node utils/convert-to-avif.js
 */

import { readdir, stat, unlink } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const EXCLUDE_DIRS = new Set(['node_modules', '.git', '.claude', 'tmp']);

// Quality levels to try (descending). First one that beats the original wins.
const QUALITY_LEVELS = [45, 35, 25];
const EFFORT = 9; // 0-9, higher = better compression but slower

const kept = [];   // { file, avif, origKB, avifKB, pct, quality }
const skipped = []; // { file, origKB, reason }
const errors = [];  // { file, error }

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || EXCLUDE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

async function tryConvert(filePath, ext, avifPath, origSize, quality) {
  await sharp(filePath)
    .avif({ quality, effort: EFFORT })
    .toFile(avifPath);
  const avifInfo = await stat(avifPath);
  return avifInfo.size;
}

async function convert(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (!['.webp', '.png', '.jpg', '.jpeg'].includes(ext)) return;

  const avifPath = filePath.replace(ext, '.avif');
  const relPath = filePath.replace(ROOT + '/', '');

  try {
    const origInfo = await stat(filePath);
    const origKB = origInfo.size / 1024;

    // Try quality levels until we find one that produces a smaller file
    let bestSize = Infinity;
    let bestQuality = null;

    for (const q of QUALITY_LEVELS) {
      const size = await tryConvert(filePath, ext, avifPath, origInfo.size, q);
      if (size < origInfo.size) {
        bestSize = size;
        bestQuality = q;
        break; // Found a winner
      }
      // Result is larger — this version gets overwritten on next iteration anyway
    }

    if (bestQuality !== null) {
      const avifKB = bestSize / 1024;
      const pct = ((1 - avifKB / origKB) * 100).toFixed(1);
      console.log(`  ✓ ${relPath}  (${origKB.toFixed(1)}KB → ${avifKB.toFixed(1)}KB, -${pct}%, q=${bestQuality})`);
      kept.push({ file: relPath, avif: avifPath.replace(ROOT + '/', ''), origKB, avifKB, pct: parseFloat(pct), quality: bestQuality });
    } else {
      // All quality levels produced larger files — delete the last attempt
      try { await unlink(avifPath); } catch {}
      const reason = `min AVIF > original (${origKB.toFixed(1)}KB)`;
      console.log(`  ✗ ${relPath}  skipped: ${reason}`);
      skipped.push({ file: relPath, origKB, reason });
    }
  } catch (err) {
    try { await unlink(avifPath); } catch {}
    errors.push({ file: relPath, error: err.message });
    console.error(`  ⚠ ${relPath}: ${err.message}`);
  }
}

console.log('Converting images to AVIF...');
console.log(`Settings: effort=${EFFORT}, quality levels=[${QUALITY_LEVELS}]`);
console.log('Only keeping AVIF when smaller than original.\n');

for await (const file of walk(ROOT)) {
  await convert(file);
}

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log(`Kept:    ${kept.length} files (AVIF smaller than original)`);
console.log(`Skipped: ${skipped.length} files (AVIF not beneficial)`);
console.log(`Errors:  ${errors.length}`);
console.log(`${'='.repeat(60)}`);

if (kept.length > 0) {
  const totalOrig = kept.reduce((s, k) => s + k.origKB, 0);
  const totalAvif = kept.reduce((s, k) => s + k.avifKB, 0);
  console.log(`Total savings: ${totalOrig.toFixed(1)}KB → ${totalAvif.toFixed(1)}KB  (-${((1 - totalAvif/totalOrig) * 100).toFixed(1)}%)`);
}
