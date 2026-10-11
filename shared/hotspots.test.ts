import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOTSPOTS, SORT_ITEMS, ScoringError, scoreAction } from './hotspots.ts';

test('choice hotspot returns catalog points and delta', () => {
  const r = scoreAction({ hotspotId: 'solar-eng', choiceId: 'full' });
  assert.equal(r.points, 1160);
  assert.equal(r.zone, 'campus');
  assert.deepEqual(r.delta, { gridCut: 27, kwh: 162000, co2: 116000 });
});

test('client-supplied points are ignored', () => {
  const r = scoreAction({ hotspotId: 'ewaste-lab', choiceId: 'store', points: 999999 });
  assert.equal(r.points, 0);
});

test('unknown hotspot and unknown choice are rejected', () => {
  assert.throws(() => scoreAction({ hotspotId: 'nope', choiceId: 'full' }), ScoringError);
  assert.throws(() => scoreAction({ hotspotId: 'solar-eng', choiceId: 'nope' }), ScoringError);
  assert.throws(() => scoreAction(null), ScoringError);
});

test('perfect sort scores every item', () => {
  const placements = Object.fromEntries(SORT_ITEMS.map((i) => [i.id, i.bin]));
  const r = scoreAction({ hotspotId: 'nirmalya-ghat', placements });
  assert.equal(r.correct, 8);
  assert.equal(r.points, 1200);
  assert.deepEqual(r.delta, { compost: 750, income: 1200, plastic: 75 });
});

test('partial sort scores only correct items', () => {
  const placements = Object.fromEntries(SORT_ITEMS.map((i) => [i.id, 'reject']));
  const r = scoreAction({ hotspotId: 'nirmalya-ghat', placements });
  assert.equal(r.correct, 2);
  assert.equal(r.points, 300);
  assert.deepEqual(r.delta, { compost: 0, income: 0, plastic: 0 });
});

test('incomplete or invalid sort is rejected', () => {
  assert.throws(() => scoreAction({ hotspotId: 'nirmalya-ghat', placements: { marigold: 'compost' } }), ScoringError);
  const bad = Object.fromEntries(SORT_ITEMS.map((i) => [i.id, 'river']));
  assert.throws(() => scoreAction({ hotspotId: 'nirmalya-ghat', placements: bad }), ScoringError);
});

test('every choice hotspot has exactly one sustainable best option', () => {
  for (const h of HOTSPOTS.filter((h) => h.kind === 'choice')) {
    const sus = h.choices!.filter((c) => c.sustainable);
    assert.equal(sus.length, 1, h.id);
    assert.equal(Math.max(...h.choices!.map((c) => c.points)), sus[0].points, h.id);
  }
});
