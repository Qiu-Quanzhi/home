/**
 * 通用错误页生成器
 * 将 HTML 模板内置，根据参数生成各 HTTP 状态码对应的纯静态页面
 *
 * @author 邱泉智 QIU Quanzhi (旅禾Ryoine)
 *
 * 优先读取 error-pages.config.json，CLI 参数可覆盖配置文件中的值
 * 用法: node scripts/generate-error-pages.js [--domain <域名>] [--name <网站名>] [--email <邮箱>] [--author <作者>] [--out <输出目录>]
 *
 * 占位符: __CODE__ __TITLE__ __DESC__ __BTN__ __YEAR__ __DOMAIN__ __NAME__ __EMAIL__ __AUTHOR__
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '2.0.0';
const root = resolve(process.cwd());

// ── 读取配置文件 ──
function loadConfig() {
  const configPath = resolve(root, 'error-pages.config.json');
  if (existsSync(configPath)) {
    try { return JSON.parse(readFileSync(configPath, 'utf-8')); }
    catch { /* 解析失败则忽略 */ }
  }
  return {};
}

// ── 解析 CLI 参数（覆盖配置文件） ──
function parseArgs(argv) {
  const args = loadConfig();
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--domain'  && argv[i + 1]) { args.domain = argv[++i]; continue; }
    if (argv[i] === '--name'    && argv[i + 1]) { args.name   = argv[++i]; continue; }
    if (argv[i] === '--email'   && argv[i + 1]) { args.email  = argv[++i]; continue; }
    if (argv[i] === '--author'  && argv[i + 1]) { args.author  = argv[++i]; continue; }
    if (argv[i] === '--out'     && argv[i + 1]) { args.out     = argv[++i]; continue; }
    if (argv[i] === '-d'        && argv[i + 1]) { args.domain  = argv[++i]; continue; }
    if (argv[i] === '-n'        && argv[i + 1]) { args.name    = argv[++i]; continue; }
    if (argv[i] === '-e'        && argv[i + 1]) { args.email   = argv[++i]; continue; }
    if (argv[i] === '-a'        && argv[i + 1]) { args.author  = argv[++i]; continue; }
    if (argv[i] === '-o'        && argv[i + 1]) { args.out     = argv[++i]; continue; }
  }
  if (!args.domain) { console.error('缺少 --domain 参数（或 error-pages.config.json 中未配置）'); process.exit(1); }
  if (!args.name)   { console.error('缺少 --name 参数（或 error-pages.config.json 中未配置）');   process.exit(1); }
  if (!args.email)  { console.error('缺少 --email 参数（或 error-pages.config.json 中未配置）');  process.exit(1); }
  if (!args.author) { console.error('缺少 --author 参数（或 error-pages.config.json 中未配置）'); process.exit(1); }
  if (!args.out)    { console.error('缺少 --out 参数（或 error-pages.config.json 中未配置）');    process.exit(1); }
  return args;
}

const { domain, name, email, author, out } = parseArgs(process.argv);
const year = new Date().getFullYear().toString();

// ── 错误码 → 标题/描述（中英双语） ──
const ERRORS = {
  '400': { zh: '请求有误',       en: 'Bad Request',            desc: ['服务器无法理解当前请求，请检查后重试。',                      'The server cannot understand this request. Please check and try again.'] },
  '401': { zh: '需要登录',       en: 'Unauthorized',           desc: ['此页面需要登录才能访问。',                                    'You need to log in to access this page.'] },
  '403': { zh: '禁止访问',       en: 'Forbidden',              desc: ['你没有权限查看此页面。',                                      "You don't have permission to view this page."] },
  '404': { zh: '页面好像走丢了……', en: 'Page Not Found',         desc: ['你访问的页面不存在或已被移除。',                                "The page you're looking for doesn't exist or has been moved."] },
  '405': { zh: '方法不被允许',    en: 'Method Not Allowed',     desc: ['该请求方法不被服务器支持。',                                    'This request method is not supported by the server.'] },
  '408': { zh: '请求超时',       en: 'Request Timeout',        desc: ['服务器等待请求超时，请检查网络后重试。',                          'The server timed out waiting for the request. Please check your network and try again.'] },
  '410': { zh: '内容已消失',     en: 'Gone',                   desc: ['此页面已被永久移除。',                                        'This page has been permanently removed.'] },
  '413': { zh: '请求体过大',     en: 'Payload Too Large',      desc: ['请求体超过了服务器允许的大小限制。',                             'The request body exceeds the maximum size allowed by the server.'] },
  '414': { zh: 'URI 过长',       en: 'URI Too Long',           desc: ['请求的 URI 超过了服务器允许的长度限制。',                         'The request URI exceeds the maximum length allowed by the server.'] },
  '429': { zh: '请求太频繁',     en: 'Too Many Requests',      desc: ['你发送了太多请求，请稍后再试。',                                "You've sent too many requests. Please try again later."] },
  '431': { zh: '请求头过大',     en: 'Request Header Fields Too Large', desc: ['请求头字段超过了服务器允许的大小限制。',                   'The request header fields exceed the maximum size allowed by the server.'] },
  '500': { zh: '服务器出了点问题', en: 'Internal Server Error',  desc: ['服务器内部发生错误，请稍后再试。',                                'Something went wrong on our end. Please try again later.'] },
  '502': { zh: '网关错误',       en: 'Bad Gateway',            desc: ['上游服务器返回了无效响应，请稍后再试。',                          'The upstream server returned an invalid response. Please try again later.'] },
  '503': { zh: '服务暂时不可用',  en: 'Service Unavailable',    desc: ['服务器正在维护或暂时过载，请稍后再试。',                           'The server is temporarily down for maintenance or overloaded. Please try again later.'] },
  '504': { zh: '网关超时',       en: 'Gateway Timeout',        desc: ['上游服务器未及时响应，请稍后再试。',                              "The upstream server didn't respond in time. Please try again later."] },
  'error': { zh: '出了点问题',   en: 'Something Went Wrong',   desc: ['发生了未知错误，请稍后再试。',                                  'An unknown error occurred. Please try again later.'] },
};

// ── HTML 模板 ──
const TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>__CODE__ __TITLE__ | __NAME__</title>
  <meta name="color-scheme" content="light dark">
  <meta name="robots" content="noindex">
  <link rel="icon" href="https://__DOMAIN__/favicon.ico">
  __MARKER__
  <style>
    *,
    *::before,
    *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    :root {
      --c-primary: #66ccff;
      --c-text: rgba(0, 0, 0, 0.85);
      --c-text-secondary: rgba(0, 0, 0, 0.55);
      --c-bg: #f0f4f8;
      --c-card-bg: rgba(255, 255, 255, 0.75);
      --c-card-border: rgba(255, 255, 255, 0.5);
      --c-shadow: rgba(0, 0, 0, 0.08);
      --backdrop: blur(16px) saturate(140%);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --c-text: rgba(255, 255, 255, 0.9);
        --c-text-secondary: rgba(255, 255, 255, 0.5);
        --c-bg: #1a1d22;
        --c-card-bg: rgba(255, 255, 255, 0.06);
        --c-card-border: rgba(255, 255, 255, 0.08);
        --c-shadow: rgba(0, 0, 0, 0.3);
      }
    }

    html { height: 100%; }

    body {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      background: var(--c-bg);
      color: var(--c-text);
      padding: 24px;
    }

    body::before,
    body::after {
      content: "";
      position: fixed;
      border-radius: 50%;
      opacity: 0.12;
      pointer-events: none;
      z-index: 0;
    }

    body::before {
      width: 500px; height: 500px;
      background: radial-gradient(circle, var(--c-primary), transparent 70%);
      top: -200px; left: -150px;
    }

    body::after {
      width: 400px; height: 400px;
      background: radial-gradient(circle, var(--c-primary), transparent 70%);
      bottom: -150px; right: -100px;
    }

    .card {
      position: relative; z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 48px 40px;
      background: var(--c-card-bg);
      border: 1px solid var(--c-card-border);
      border-radius: 20px;
      box-shadow: 0 8px 32px var(--c-shadow);
      backdrop-filter: var(--backdrop);
      -webkit-backdrop-filter: var(--backdrop);
    }

    .code {
      font-size: clamp(80px, 18vw, 135px);
      font-weight: 700;
      line-height: 1;
      color: var(--c-primary);
      letter-spacing: -0.02em;
    }

    .title {
      margin-top: 8px;
      font-size: clamp(16px, 4vw, 20px);
      font-weight: 500;
      color: var(--c-text);
      text-align: center;
    }

    .desc {
      margin-top: 12px;
      font-size: 14px;
      color: var(--c-text-secondary);
      text-align: center;
      line-height: 1.6;
      max-width: 400px;
    }

    .desc a {
      color: var(--c-primary);
      text-decoration: none;
    }

    .desc a:hover { text-decoration: underline; }

    .btn-home {
      display: inline-block;
      margin-top: 28px;
      padding: 10px 32px;
      background: var(--c-primary);
      border-radius: 6px;
      color: #fff;
      font-size: 15px;
      font-weight: 500;
      text-decoration: none;
      transition: opacity 0.2s, transform 0.2s;
    }

    .btn-home:hover {
      opacity: 0.85;
      transform: translateY(-1px);
    }

    .btn-home:active {
      opacity: 0.65;
      transform: translateY(0);
    }

    .footer {
      position: fixed;
      bottom: 40px;
      font-size: 13px;
      color: var(--c-text-secondary);
      z-index: 1;
    }
  </style>
</head>

<body>
  <div class="card">
    <div class="code">__CODE__</div>
    <div class="title">__TITLE__</div>
    <p class="desc">__DESC__</p>
    <a href="https://__DOMAIN__/" class="btn-home" rel="noreferrer">__BTN__</a>
  </div>

  <footer class="footer">&copy; <span class="copyright-year">__YEAR__</span> __AUTHOR__</footer>

  <script>
    (function(){var y=new Date().getFullYear();var e=document.querySelector('.copyright-year');if(e){e.textContent=y;}})();
  </script>
</body>
</html>`;

const MARKER = `<!-- generated by generate-error-pages.js v${VERSION} (${year}) -->`;
const outDir = resolve(root, out);
mkdirSync(outDir, { recursive: true });

let count = 0;
let skipped = 0;
for (const [code, msg] of Object.entries(ERRORS)) {
  const isFallback = code === 'error';
  const filename = isFallback ? 'error.html' : `${code}.html`;
  const filePath = resolve(outDir, filename);

  // 冲突检测：如果文件已存在且不含脚本标记，跳过以避免覆盖非本脚本生成的文件
  if (existsSync(filePath)) {
    const existing = readFileSync(filePath, 'utf-8');
    if (!existing.includes(MARKER)) { skipped++; continue; }
  }

  const displayCode = isFallback ? '[!]' : code;
  const title = `${msg.zh} / ${msg.en}`;
  const desc = `${msg.desc[0]}<br>${msg.desc[1]}<br><br>如有疑问请联系 / Please contact <br><a href="mailto:__EMAIL__">__EMAIL__</a>`;
  const btn = '返回首页 / Homepage';

  const html = TEMPLATE
    .replace(/__CODE__/g,   displayCode)
    .replace(/__TITLE__/g,  title)
    .replace(/__DESC__/g,   desc)
    .replace(/__BTN__/g,    btn)
    .replace(/__YEAR__/g,   year)
    .replace(/__DOMAIN__/g, domain)
    .replace(/__NAME__/g,   name)
    .replace(/__AUTHOR__/g, author)
    .replace(/__EMAIL__/g,  email)
    .replace(/__MARKER__/g,  MARKER);

  writeFileSync(filePath, html, 'utf-8');
  count++;
}

console.log(`✓ Generated ${count} error pages → ${out} (${skipped} skipped due to existing files)`);
