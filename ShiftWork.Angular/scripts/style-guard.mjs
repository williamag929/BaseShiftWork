import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
const BOOTSTRAP = [
  /^btn(-[a-z-]+)?$/,
  /^form-(control|select|group|label)$/,
  /^row$/,
  /^col(-[a-z0-9-]+)?$/,
  /^card(-[a-z]+)?$/,
  /^d-[a-z-]+$/,
  /^[mp][trblxy]?-[0-5]$/,
  /^text-(muted|center|end|start)$/,
  /^badge$/,
  /^table(-[a-z]+)?$/,
  /^container(-fluid)?$/,
  /^justify-content-[a-z]+$/,
  /^align-items-[a-z]+$/,
];
const LEGACY_ICON = /^(bi|bi-[a-z0-9-]+|fa|fas|far|fab|fa-[a-z0-9-]+)$/;

export function findViolations(filePath, content) {
  const out = [];
  const ext = path.extname(filePath).toLowerCase();
  const isStyle = ext === '.css' || ext === '.scss';
  const isHtml = ext === '.html';
  const add = (line, rule, text) => out.push({ path: filePath, line, rule, text: text.trim() });

  content.split(/\r?\n/).forEach((text, i) => {
    const line = i + 1;
    if (isStyle) {
      if (COLOR.test(text)) add(line, 'raw-color', text);
      if (/\bfont-size\s*:/.test(text) && !/var\(/.test(text)) add(line, 'raw-font-size', text);
      if (/\bbox-shadow\s*:/.test(text) && !/box-shadow\s*:\s*(none|var\(--[^)]*\))\s*;?\s*$/.test(text)) {
        add(line, 'raw-shadow', text);
      }
      if (/\b(?:repeating-)?(?:linear|radial|conic)-gradient\(/.test(text)) add(line, 'gradient', text);
      if (/\bbackdrop-filter\s*:/.test(text)) add(line, 'backdrop', text);
    }
    if (isHtml) {
      for (const m of text.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) {
        const tokens = m[1].split(/\s+/).filter(Boolean);
        if (tokens.some((t) => BOOTSTRAP.some((re) => re.test(t)))) add(line, 'bootstrap-class', text);
        if (tokens.some((t) => LEGACY_ICON.test(t))) add(line, 'legacy-icon', text);
        if (tokens.some((t) => t.includes('[') && COLOR.test(t))) add(line, 'raw-color', text);
      }
      for (const m of text.matchAll(/\bstyle\s*=\s*"([^"]*)"/g)) {
        if (COLOR.test(m[1])) add(line, 'raw-color', text);
      }
    }
  });
  return out;
}

function expandGlob(pattern, root) {
  if (!/[*?]/.test(pattern)) return fs.existsSync(path.join(root, pattern)) ? [pattern] : [];
  const re = new RegExp(
    '^' +
      pattern
        .split('/')
        .map((seg) => (seg === '**' ? '(?:.*)' : seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]')))
        .join('/')
        .replace(/\/\(\?:\.\*\)\//g, '/(?:.*/)?') +
      '$',
  );
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) walk(rel);
      else if (re.test(rel)) files.push(rel);
    }
  };
  walk('');
  return files;
}

export function run(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'style-guard.json'), 'utf8'));
  const files = [...new Set(config.migrated.flatMap((p) => expandGlob(p, root)))].sort();
  const violations = files.flatMap((f) => findViolations(f, fs.readFileSync(path.join(root, f), 'utf8')));
  for (const v of violations) console.log(`${v.path}:${v.line} ${v.rule} ${v.text}`);
  console.log(`${violations.length} violations in ${files.length} files`);
  return violations.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(run(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
}
