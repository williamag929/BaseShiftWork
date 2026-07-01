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

function buildUnits(includTarget) {
  return Object.entries(strings)
    .map(([id, t]) => {
      const src = `        <source>${escapeXml(t.en)}</source>`;
      const tgt = includTarget
        ? `\n        <target state="translated">${escapeXml(t.es)}</target>`
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
