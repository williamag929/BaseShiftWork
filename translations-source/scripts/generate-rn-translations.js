#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const stringsPath = path.resolve(__dirname, '../strings.json');
const outputDirs = [
  path.resolve(__dirname, '../../ShiftWork.Mobile/i18n/translations'),
  path.resolve(__dirname, '../../ShiftWork.Kiosk/i18n/translations'),
];

const strings = JSON.parse(fs.readFileSync(stringsPath, 'utf-8'));

function setNested(obj, keys, value) {
  const last = keys[keys.length - 1];
  const parent = keys.slice(0, -1).reduce((acc, key) => {
    if (!acc[key]) acc[key] = {};
    return acc[key];
  }, obj);
  parent[last] = value;
}

function buildLocale(lang) {
  const result = {};
  let hasError = false;
  for (const [flatKey, translations] of Object.entries(strings)) {
    const value = translations[lang];
    if (value === undefined) {
      console.error(`  Missing "${lang}" for key: ${flatKey}`);
      hasError = true;
      continue;
    }
    setNested(result, flatKey.split('.'), value);
  }
  if (hasError) process.exitCode = 1;
  return result;
}

function writeLocale(lang) {
  const locale = buildLocale(lang);
  const json = JSON.stringify(locale, null, 2);
  const content =
    `// Auto-generated — do not edit manually.\n` +
    `// Source: translations-source/strings.json — run: npm run generate:rn\n` +
    `export default ${json} as const;\n`;

  for (const outputDir of outputDirs) {
    fs.mkdirSync(outputDir, { recursive: true });
    const outPath = path.join(outputDir, `${lang}.ts`);
    fs.writeFileSync(outPath, content, 'utf-8');
    console.log(`  ✓ ${outPath}`);
  }
}

console.log('Generating React Native translations…');
writeLocale('en');
writeLocale('es');
console.log('Done.');
