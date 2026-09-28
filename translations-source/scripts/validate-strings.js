#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const stringsPath = path.resolve(__dirname, '../strings.json');
const SUPPORTED_LANGS = ['en', 'es'];
const VAR_RE = /\{\{(\w+)\}\}/g;

const strings = JSON.parse(fs.readFileSync(stringsPath, 'utf-8'));
const errors = [];

for (const [key, translations] of Object.entries(strings)) {
  for (const lang of SUPPORTED_LANGS) {
    const value = translations[lang];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      errors.push(`[${key}] Missing or empty "${lang}" translation`);
    }
  }

  const en = translations['en'];
  const es = translations['es'];
  if (en && es) {
    const enVars = [...en.matchAll(VAR_RE)].map((m) => m[1]).sort();
    const esVars = [...es.matchAll(VAR_RE)].map((m) => m[1]).sort();
    if (JSON.stringify(enVars) !== JSON.stringify(esVars)) {
      errors.push(
        `[${key}] Variable mismatch — en: {${enVars.join(', ')}} vs es: {${esVars.join(', ')}}`
      );
    }
  }
}

if (errors.length > 0) {
  console.error(`\n❌ Validation failed with ${errors.length} error(s):\n`);
  errors.forEach((e) => console.error('  •', e));
  console.error();
  process.exit(1);
} else {
  console.log(`✓ All ${Object.keys(strings).length} keys validated successfully.`);
}
