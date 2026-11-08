import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findViolations } from './style-guard.mjs';

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
  assert.deepEqual(rules('a.html', '<div class="row mb-3">'), ['bootstrap-class']);
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
