import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOTSPOTS, SORT_ITEMS, ScoringError, THINK_RULES, scoreAction } from './hotspots.ts';

test('choice hotspot returns catalog points and delta', () => {
  const r = scoreAction({ hotspotId: 'solar-eng', choiceId: 'full', reasonId: 'grid', prediction: 116000 });
  assert.equal(r.basePoints, 1160);
  assert.equal(r.points, 1160 * 1.5 + THINK_RULES.predictBonus);
  assert.equal(r.zone, 'campus');
  assert.deepEqual(r.delta, { gridCut: 27, kwh: 162000, co2: 116000 });
});

test('client-supplied points are ignored', () => {
  const r = scoreAction({ hotspotId: 'ewaste-lab', choiceId: 'store', reasonId: 'cash', prediction: 50, points: 999999 });
  assert.equal(r.points, 0);
});

test('unknown hotspot and unknown choice are rejected', () => {
  assert.throws(() => scoreAction({ hotspotId: 'nope', choiceId: 'full' }), ScoringError);
  assert.throws(() => scoreAction({ hotspotId: 'solar-eng', choiceId: 'nope', reasonId: 'grid', prediction: 0 }), ScoringError);
  assert.throws(() => scoreAction(null), ScoringError);
});

test('right reason multiplies by 1.5, wrong reason by 0.5', () => {
  const right = scoreAction({ hotspotId: 'ewaste-lab', choiceId: 'authorised', reasonId: 'leach', prediction: 0 });
  assert.equal(right.reasonCorrect, true);
  assert.equal(right.points, 1800);
  const wrong = scoreAction({ hotspotId: 'ewaste-lab', choiceId: 'authorised', reasonId: 'cash', prediction: 0 });
  assert.equal(wrong.reasonCorrect, false);
  assert.equal(wrong.points, 600);
});

test('a close prediction earns the bonus, a far one does not', () => {
  const hit = scoreAction({ hotspotId: 'ev-parking', choiceId: 'ev-stop', reasonId: 'zero', prediction: 21000 });
  assert.equal(hit.predictionHit, true);
  assert.equal(hit.predictionActual, 24700);
  assert.equal(hit.points, Math.round(1235 * 0.5) + THINK_RULES.predictBonus);
  const miss = scoreAction({ hotspotId: 'ev-parking', choiceId: 'ev-stop', reasonId: 'zero', prediction: 10000 });
  assert.equal(miss.predictionHit, false);
  assert.equal(miss.bonus, 0);
});

test('a zero-impact choice with a guess of zero hits', () => {
  const r = scoreAction({ hotspotId: 'solar-eng', choiceId: 'none', reasonId: 'image', prediction: 0 });
  assert.equal(r.predictionHit, true);
  assert.equal(r.points, THINK_RULES.predictBonus);
});

test('missing reason or prediction is rejected', () => {
  assert.throws(() => scoreAction({ hotspotId: 'solar-eng', choiceId: 'full' }), ScoringError);
  assert.throws(() => scoreAction({ hotspotId: 'solar-eng', choiceId: 'full', reasonId: 'grid' }), ScoringError);
  assert.throws(() => scoreAction({ hotspotId: 'solar-eng', choiceId: 'full', reasonId: 'nope', prediction: 1 }), ScoringError);
  assert.throws(() => scoreAction({ hotspotId: 'solar-eng', choiceId: 'full', reasonId: 'grid', prediction: 999999999 }), ScoringError);
  assert.throws(() => scoreAction({ hotspotId: 'solar-eng', choiceId: 'full', reasonId: 'grid', prediction: '5' }), ScoringError);
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

test('every choice hotspot has three reasons, a valid answer, and in-range actual impacts', () => {
  for (const h of HOTSPOTS.filter((h) => h.kind === 'choice')) {
    assert.equal(h.reasons?.length, 3, h.id);
    assert.ok(h.reasons!.some((r) => r.id === h.correctReason), h.id);
    const p = h.predict!;
    for (const c of h.choices!) {
      const actual = c.delta[p.metric] ?? 0;
      assert.ok(actual >= p.min && actual <= p.max, `${h.id}/${c.id}`);
    }
  }
});
