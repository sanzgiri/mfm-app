import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  normalizeProgress,
  computeStreak,
  prettyWeekTitle,
  formatText
} from '../public/lib.js';
import { meditationData } from '../public/data.js';

test('escapeHtml neutralizes HTML/script injection', () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
  );
  assert.equal(escapeHtml("a & b ' c"), 'a &amp; b &#39; c');
  assert.equal(escapeHtml(null), '');
});

test('normalizeProgress fills defaults and tolerates junk', () => {
  assert.deepEqual(normalizeProgress(null, 1), { completed: {}, notes: {}, lastActiveDay: 1 });
  const p = normalizeProgress({ completed: { 1: 123 }, notes: { 1: 'hi' }, lastActiveDay: '5' }, 1);
  assert.deepEqual(p.completed, { 1: 123 });
  assert.equal(p.lastActiveDay, 5);
});

test('computeStreak finds the longest consecutive run', () => {
  const valid = Array.from({ length: 30 }, (_, i) => i + 1);
  assert.equal(computeStreak({}, valid), 0);
  assert.equal(computeStreak({ 1: 1, 2: 1, 3: 1 }, valid), 3);
  // Gap breaks the run; longest is 1,2,3 then 5,6 => 3.
  assert.equal(computeStreak({ 1: 1, 2: 1, 3: 1, 5: 1, 6: 1 }, valid), 3);
  // Ignores days outside the valid set.
  assert.equal(computeStreak({ 99: 1, 1: 1, 2: 1 }, valid), 2);
});

test('prettyWeekTitle title-cases the source heading', () => {
  assert.equal(prettyWeekTitle({ title: 'WEEK 1: EMBRACING REALITY' }), 'Week 1: Embracing Reality');
  assert.equal(prettyWeekTitle({ number: 3, title: 'Week 3' }), 'Week 3');
});

test('formatText escapes content and renders lists + section headers', () => {
  const out = formatText("Core Insight: be <kind>\n* one\n* two");
  assert.match(out, /<strong class="section-header">Core Insight:<\/strong>/);
  assert.match(out, /be &lt;kind&gt;/); // user/source content escaped
  assert.match(out, /<ul class="content-list"><li>one<\/li><li>two<\/li><\/ul>/);
});

test('generated data has 30 contiguous days across 5 weeks', () => {
  const weeks = meditationData.weeks.filter(Boolean);
  assert.equal(weeks.length, 5);
  const days = weeks.flatMap(w => w.days || []).map(d => d.day).sort((a, b) => a - b);
  assert.equal(days.length, 30);
  assert.deepEqual(days, Array.from({ length: 30 }, (_, i) => i + 1));
});

test('every week has a title and every day has content', () => {
  for (const w of meditationData.weeks.filter(Boolean)) {
    assert.ok(w.title && w.title.trim().length > 0, `week ${w.number} missing title`);
    for (const d of (w.days || [])) {
      assert.ok(d.title && d.title.trim().length > 0, `day ${d.day} missing title`);
      assert.ok(d.fullText && d.fullText.trim().length > 0, `day ${d.day} missing fullText`);
    }
  }
});
