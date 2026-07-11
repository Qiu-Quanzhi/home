/**
 * 预压缩静态资源脚本
 * 遍历 dist/ 目录，为可压缩的静态文件生成 .gz (gzip) 和 .br (brotli) 副本，
 * 配合 Nginx gzip_static / brotli_static 模块使用。
 *
 * 优先读取 build.config.json，CLI 参数可覆盖配置文件中的值
 * 用法: node scripts/generate-compressed.mjs [--dir <目录>] [--threshold <字节>]
 *
 * @author 邱泉智 QIU Quanzhi (旅禾Ryoine)
 */

import { readFileSync, writeFileSync, unlinkSync, readdirSync, existsSync } from 'node:fs';
import { resolve, extname, relative } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';

const VERSION = '1.0.0';

// ── 读取配置文件 ──
function loadConfig() {
  const configPath = resolve(process.cwd(), 'build.config.json');
  if (existsSync(configPath)) {
    try { return JSON.parse(readFileSync(configPath, 'utf-8')); }
    catch { /* 解析失败则忽略 */ }
  }
  return {};
}

// ── 解析 CLI 参数（覆盖配置文件） ──
function parseArgs(argv) {
  const config = loadConfig();
  const args = {
    dir: config.out || 'dist',
    threshold: config.threshold || 150,
  };
  for (let i = 2; i < argv.length; i++) {
    if ((argv[i] === '--dir' || argv[i] === '-d') && argv[i + 1]) { args.dir = argv[++i]; continue; }
    if ((argv[i] === '--threshold' || argv[i] === '-t') && argv[i + 1]) { args.threshold = parseInt(argv[++i], 10); continue; }
  }
  return args;
}

const { dir, threshold } = parseArgs(process.argv);
const root = resolve(process.cwd(), dir);

// ── 可压缩的文件扩展名 ──
// 参考 Nginx gzip_types 常用配置，覆盖以下 MIME 对应的扩展名：
//   text/html .html .htm
//   text/css .css
//   text/javascript .js .mjs .cjs
//   text/plain .txt
//   text/xml .xml
//   text/x-markdown .md
//   application/javascript .js .mjs
//   application/json .json .geojson .jsonld
//   application/xml .xml
//   application/rss+xml .rss .xml
//   application/xhtml+xml .xhtml
//   application/manifest+json .webmanifest
//   application/wasm .wasm
//   image/svg+xml .svg
//   image/x-icon .ico
//   font/ttf .ttf
//   font/otf .otf
//   font/x-woff .woff
//   application/vnd.ms-fontobject .eot
const COMPRESSIBLE = new Set([
  '.html', '.htm', '.xhtml',
  '.css',
  '.js', '.mjs', '.cjs',
  '.json', '.geojson', '.jsonld',
  '.svg',
  '.xml', '.rss',
  '.txt', '.csv', '.md',
  '.ico',
  '.webmanifest', '.map',
  '.ttf', '.otf', '.woff', '.eot',
  '.wasm',
]);

// ── 已经是高度压缩的格式（跳过） ──
const SKIP = new Set([
  '.gz', '.br', '.zip', '.zst',
  '.webp', '.avif', '.heic', '.heif',
  '.png', '.jpg', '.jpeg', '.gif',
  '.mp4', '.webm', '.mp3', '.ogg', '.flac',
  '.woff2',
]);

// ── 递归收集文件 ──
function walk(d) {
  const entries = readdirSync(d, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = resolve(d, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

if (!exists(root)) {
  console.error(`✗ Directory not found: ${dir}`);
  process.exit(1);
}

const allFiles = walk(root);

// ── 过滤可压缩文件 ──
const targets = allFiles.filter(f => {
  const ext = extname(f).toLowerCase();
  if (SKIP.has(ext)) return false;
  if (ext === '.gz' || ext === '.br') return false;
  if (!COMPRESSIBLE.has(ext)) return false;
  return true;
});

if (targets.length === 0) {
  console.log(`⚠ No compressible files found in "${dir}/"`);
  process.exit(0);
}

console.log(`Found ${targets.length} compressible file(s) in "${dir}/"\n`);

// ── 压缩参数 ──
const GZIP_OPTS = { level: 9 };
const BROTLI_OPTS = { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } };

let gzCount = 0, brCount = 0;
let gzSkipped = 0, brSkipped = 0;
let totalOriginal = 0, totalGz = 0, totalBr = 0;

const BAR_WIDTH = 40;

for (const file of targets) {
  const raw = readFileSync(file);
  const originalSize = raw.length;

  // 跳过小于阈值的文件（压缩后可能更大）
  if (originalSize < threshold) {
    continue;
  }

  const rel = relative(root, file);

  // ── gzip ──
  const gzPath = file + '.gz';
  const gz = gzipSync(raw, GZIP_OPTS);
  if (gz.length < originalSize) {
    writeFileSync(gzPath, gz);
    gzCount++;
    totalGz += gz.length;
  } else {
    try { unlinkSync(gzPath); } catch {}
    gzSkipped++;
  }

  // ── brotli ──
  const brPath = file + '.br';
  const br = brotliCompressSync(raw, BROTLI_OPTS);
  if (br.length < originalSize) {
    writeFileSync(brPath, br);
    brCount++;
    totalBr += br.length;
  } else {
    try { unlinkSync(brPath); } catch {}
    brSkipped++;
  }

  totalOriginal += originalSize;

  // 进度（以 gzip 压缩比为准）
  const ratio = gz.length < originalSize
    ? ((1 - gz.length / originalSize) * 100).toFixed(0)
    : '--';
  const barLen = gz.length < originalSize
    ? Math.round((1 - gz.length / originalSize) * BAR_WIDTH)
    : 0;
  const bar = '█'.repeat(Math.max(0, barLen)) + '░'.repeat(Math.max(0, BAR_WIDTH - barLen));
  console.log(`  ${bar}  ${ratio.padStart(3)}%  ${formatSize(originalSize).padStart(8)} → ${formatSize(gz.length).padStart(8)}  ${rel}`);
}

// ── 汇总 ──
console.log('');
const totalSaved = totalOriginal - totalGz;
const pct = totalOriginal > 0 ? ((totalSaved / totalOriginal) * 100).toFixed(1) : '0.0';
console.log(`  gzip:  ${gzCount} generated, ${gzSkipped} skipped`);
console.log(`  br:    ${brCount} generated, ${brSkipped} skipped`);
console.log(`  Total: ${formatSize(totalOriginal)} → ${formatSize(totalGz)} (gzip), saved ${formatSize(totalSaved)} (${pct}%)`);
console.log(`\n✓ Pre-compression complete.`);
if (gzCount > 0 || brCount > 0) {
  console.log('  Ensure Nginx has: gzip_static on;  brotli_static on;');
}

// ── 辅助 ──
function exists(p) {
  try { readdirSync(p); return true; } catch { return false; }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
