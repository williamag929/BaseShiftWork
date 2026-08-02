#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const stringsPath = path.resolve(__dirname, '../strings.json');
const outputDir = path.resolve(__dirname, '../../ShiftWork.Angular/src/locale');

const strings = JSON.parse(fs.readFileSync(stringsPath, 'utf-8'));

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const VAR_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

// Angular names interpolation placeholders positionally: INTERPOLATION, INTERPOLATION_1, …
// Positions are taken from the English source so a different variable order in Spanish
// still maps each variable to the right template expression.
function placeholderIds(enText) {
  const ids = {};
  let i = 0;
  for (const m of enText.matchAll(VAR_RE)) {
    const name = m[1];
    if (!(name in ids)) {
      ids[name] = i === 0 ? 'INTERPOLATION' : `INTERPOLATION_${i}`;
      i++;
    }
  }
  return ids;
}

// Escape text segments and replace {{var}} with <x id="…"/> placeholder elements.
function toXliffText(text, ids) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(VAR_RE)) {
    out += escapeXml(text.slice(last, m.index));
    const id = ids[m[1]];
    out += id
      ? `<x id="${id}" equiv-text="{{ ${escapeXml(m[1])} }}"/>`
      : escapeXml(m[0]);
    last = m.index + m[0].length;
  }
  out += escapeXml(text.slice(last));
  return out;
}

function buildUnits(includTarget) {
  return Object.entries(strings)
    .map(([id, t]) => {
      const ids = placeholderIds(t.en);
      const src = `        <source>${toXliffText(t.en, ids)}</source>`;
      const tgt = includTarget
        ? `\n        <target state="translated">${toXliffText(t.es, ids)}</target>`
        : '';
      return `      <trans-unit id="${id}" datatype="html">\n${src}${tgt}\n      </trans-unit>`;
    })
    .join('\n');
}

function buildXliff({ targetLang } = {}) {
  const fileLang = targetLang
    ? ` target-language="${targetLang}"`
    : '';
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">\n` +
    `  <file source-language="en-US"${fileLang} datatype="plaintext" original="ng2.template">\n` +
    `    <body>\n` +
    buildUnits(!!targetLang) + '\n' +
    `    </body>\n` +
    `  </file>\n` +
    `</xliff>\n`
  );
}

fs.mkdirSync(outputDir, { recursive: true });

console.log('Generating Angular XLIFF files…');

const sourcePath = path.join(outputDir, 'messages.xlf');
fs.writeFileSync(sourcePath, buildXliff(), 'utf-8');
console.log(`  ✓ ${sourcePath}`);

const esPath = path.join(outputDir, 'messages.es.xlf');
fs.writeFileSync(esPath, buildXliff({ targetLang: 'es-SP' }), 'utf-8');
console.log(`  ✓ ${esPath}`);

console.log('Done.');
