import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findViolations, run, uncoveredTemplates } from './style-guard.mjs';

const rules = (path, content) => findViolations(path, content).map((v) => v.rule);

test('flags hex colors in css', () => {
  const v = findViolations('a.css', 'color: #667eea;');
  assert.equal(v.length, 1);
  assert.equal(v[0].rule, 'raw-color');
  assert.equal(v[0].line, 1);
});

test('flags rgb/rgba but not var()', () => {
  assert.deepEqual(rules('a.css', 'background: rgba(0,0,0,.1)'), ['raw-color']);
  assert.deepEqual(rules('a.scss', 'color: var(--lz-ink)'), []);
});

test('flags literal font-size and box-shadow in css', () => {
  assert.deepEqual(rules('a.css', 'font-size: 13px'), ['raw-font-size']);
  assert.deepEqual(rules('a.css', 'box-shadow: 0 1px 2px x'), ['raw-shadow']);
});

test('flags gradients and backdrop-filter', () => {
  assert.deepEqual(rules('a.css', 'background: linear-gradient(red, blue)'), ['gradient']);
  assert.deepEqual(rules('a.css', 'backdrop-filter: blur(4px)'), ['backdrop']);
});

test('flags bootstrap classes in html class attributes', () => {
  const v = findViolations('a.html', '<div class="row mb-3">');
  assert.deepEqual(v.map((x) => x.rule), ['bootstrap-class']);
  assert.equal(rules('a.html', '<div class="mb-3">').length, 0);
  assert.deepEqual(rules('a.html', '<div class="flex gap-4">'), []);
  assert.deepEqual(rules('a.html', '<span class="rowdy">'), []);
});

test('flags legacy icon fonts', () => {
  assert.deepEqual(rules('a.html', '<i class="bi bi-trash">'), ['legacy-icon']);
  assert.deepEqual(rules('a.html', '<i class="fa fa-user">'), ['legacy-icon']);
});

test('ignores Tailwind arbitrary color classes only when they use var()', () => {
  assert.deepEqual(rules('a.html', '<div class="bg-[#fff]">'), ['raw-color']);
  assert.deepEqual(rules('a.html', '<div class="bg-[var(--lz-paper)]">'), []);
});

test('allows the draft hatch utility', () => {
  assert.deepEqual(rules('a.html', '<div class="bg-draft-hatch">'), []);
});

test('flags raw colors in inline style attributes, not tailwind text sizes', () => {
  assert.deepEqual(rules('a.html', '<p style="color: #123456">'), ['raw-color']);
  assert.deepEqual(rules('a.html', '<p class="text-[13px]">'), []);
});

test('reports 1-based line numbers', () => {
  assert.equal(findViolations('a.css', 'a{}\n\ncolor: #fff;')[0].line, 3);
});

test('does not flag common Tailwind utilities', () => {
  assert.deepEqual(
    rules('a.html', '<div class="p-4 m-2 mb-1 px-3 text-center table container col-span-2 row-span-2">'),
    [],
  );
});

test('scans single-quoted class attributes', () => {
  assert.deepEqual(rules('a.html', "<div class='btn btn-primary'>"), ['bootstrap-class']);
});

test('run fails on migrated entries that match no files', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-'));
  fs.mkdirSync(path.join(root, 'src/dir'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/ok.css'), 'a{color:var(--lz-ink)}');
  const logs = [];
  const orig = console.log;
  console.log = (m) => logs.push(m);
  try {
    const entries = ['src/typo/*.css', 'src/{a,b}.css', 'src/dir'];
    fs.writeFileSync(path.join(root, 'style-guard.json'), JSON.stringify({ migrated: ['src/ok.css'] }));
    assert.equal(run(root), 0);
    fs.writeFileSync(path.join(root, 'style-guard.json'), JSON.stringify({ migrated: ['src/ok.css', ...entries] }));
    assert.equal(run(root), 1);
  } finally {
    console.log = orig;
  }
  for (const e of ['src/typo/*.css', 'src/{a,b}.css', 'src/dir']) assert.ok(logs.includes(`${e}: matches no files`), e);
});

test('routed screens are all migrated', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  assert.deepEqual(uncoveredTemplates(root), []);
});

test('exempt entries need a reason', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-'));
  fs.mkdirSync(path.join(root, 'src/app'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/app/a.html'), '<p></p>');
  const logs = [];
  const orig = console.log;
  console.log = (m) => logs.push(m);
  try {
    fs.writeFileSync(path.join(root, 'style-guard.json'), JSON.stringify({ migrated: [], exempt: [{ path: 'src/app/a.html', reason: 'legacy' }] }));
    assert.equal(run(root), 0);
    fs.writeFileSync(path.join(root, 'style-guard.json'), JSON.stringify({ migrated: [], exempt: [{ path: 'src/app/a.html' }] }));
    assert.equal(run(root), 1);
  } finally {
    console.log = orig;
  }
});

test('flags arbitrary text sizes off the 12/13/15/18/26 scale', () => {
  assert.deepEqual(rules('a.html', '<p class="text-[13.5px]">x</p>'), ['off-scale-text']);
  assert.deepEqual(rules('a.html', '<p class="sm:text-[11px]">x</p>'), ['off-scale-text']);
  assert.deepEqual(rules('a.html', '<p class="text-[13px] md:text-[26px] text-lg">x</p>'), []);
  assert.deepEqual(rules('a.html', '<p class="text-[var(--lz-ink)]">x</p>'), []);
});
