'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { marked } = require('marked');
const { gfmHeadingId } = require('marked-gfm-heading-id');

marked.use(gfmHeadingId());

const DIST = path.join(__dirname, 'dist');
const ROOT = path.join(__dirname, '..');

const pages = [
  { src: path.join(ROOT, 'README.md'), out: 'index.html', title: 'etcd v3 Browser' },
  { src: path.join(__dirname, 'QUICKSTART.md'), out: 'quickstart.html', title: 'Quick Start' },
  { src: path.join(__dirname, 'DEVELOPMENT.md'), out: 'development.html', title: 'Development' },
  { src: path.join(__dirname, 'API.md'), out: 'api.html', title: 'API Reference' },
  { src: path.join(__dirname, 'ARCHITECTURE.md'), out: 'architecture.html', title: 'Architecture' },
  { src: path.join(__dirname, 'LICENSE-COMPLIANCE.md'), out: 'license.html', title: 'License Compliance' },
];

const nav = pages.map(p => `<a href="${p.out}">${p.title}</a>`).join('\n        ');

function template(title, content) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} - etcd v3 Browser</title>
  <style>
    :root {
      --bg: #ffffff;
      --fg: #1f2937;
      --nav-bg: #f3f4f6;
      --link: #2563eb;
      --code-bg: #f9fafb;
      --border: #e5e7eb;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #111827;
        --fg: #f9fafb;
        --nav-bg: #1f2937;
        --link: #60a5fa;
        --code-bg: #1f2937;
        --border: #374151;
      }
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: var(--fg);
      background: var(--bg);
      margin: 0;
      display: flex;
      min-height: 100vh;
    }
    nav {
      width: 240px;
      min-height: 100vh;
      background: var(--nav-bg);
      padding: 1.5rem 1rem;
      border-right: 1px solid var(--border);
      position: sticky;
      top: 0;
      align-self: flex-start;
    }
    nav a {
      display: block;
      padding: 0.4rem 0.75rem;
      margin: 0.2rem 0;
      color: var(--link);
      text-decoration: none;
      border-radius: 4px;
    }
    nav a:hover { background: var(--border); }
    main {
      flex: 1;
      max-width: 900px;
      padding: 2rem 3rem;
    }
    h1, h2, h3, h4 { margin-top: 1.5em; }
    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
    }
    code {
      background: var(--code-bg);
      padding: 0.15em 0.35em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
    th { background: var(--nav-bg); }
    img { max-width: 100%; border-radius: 6px; }
    @media (max-width: 768px) {
      body { flex-direction: column; }
      nav { width: 100%; min-height: auto; position: static; display: flex; flex-wrap: wrap; gap: 0.25rem; }
      main { padding: 1rem; }
    }
  </style>
</head>
<body>
  <nav>
    <strong>etcd v3 Browser</strong>
    <hr>
    ${nav}
  </nav>
  <main>
    ${content}
  </main>
</body>
</html>`;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

for (const page of pages) {
  if (!fs.existsSync(page.src)) {
    console.warn(`Skipping ${page.src} (not found)`);
    continue;
  }
  let md = fs.readFileSync(page.src, 'utf-8');
  md = md.replace(/images\//g, 'images/');
  const html = marked.parse(md);
  fs.writeFileSync(path.join(DIST, page.out), template(page.title, html));
  console.log(`Built: ${page.out}`);
}

const imagesDir = path.join(ROOT, 'images');
if (fs.existsSync(imagesDir)) {
  const distImages = path.join(DIST, 'images');
  fs.mkdirSync(distImages, { recursive: true });
  for (const file of fs.readdirSync(imagesDir)) {
    fs.copyFileSync(path.join(imagesDir, file), path.join(distImages, file));
  }
  console.log('Copied images/');
}

console.log('Documentation build complete.');
