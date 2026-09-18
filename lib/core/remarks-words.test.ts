import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localizeRemarks } from './remarks-words.ts';

test('localizeRemarks — translates the recurring remark for zh', () => {
  assert.equal(localizeRemarks('Repairs and Redecoration', 'zh'), '维修与重新粉刷');
  assert.equal(
    localizeRemarks(
      'Repairs and Redecoration and Hawker Centres Transformation Programme',
      'zh'
    ),
    '维修、重新粉刷及小贩中心转型计划'
  );
});

test('localizeRemarks — unknown remark falls back to the raw string', () => {
  assert.equal(
    localizeRemarks('This hawker centre will commence its operations on 19 Mar 2025.', 'zh'),
    'This hawker centre will commence its operations on 19 Mar 2025.'
  );
});

test('localizeRemarks — en passes the remark through untouched', () => {
  assert.equal(localizeRemarks('Repairs and Redecoration', 'en'), 'Repairs and Redecoration');
});

test('localizeRemarks — empty and missing remarks yield an empty string', () => {
  assert.equal(localizeRemarks(undefined, 'zh'), '');
  assert.equal(localizeRemarks('', 'en'), '');
});
