import { useMemo, useState } from 'react';
import { BINS, METRICS, SORT_ITEMS, type ActionInput, type ActionResult, type BinId, type Hotspot, type MetricKey } from '../../shared/hotspots';
import { errorMessage } from '../api';
import { Modal, fmt } from './common';

function deltaLabel(k: MetricKey, v: number): string {
  const sign = v > 0 ? '+' : '−';
  const a = Math.abs(v).toLocaleString('en-IN', { maximumFractionDigits: 1 });
  switch (k) {
    case 'gridCut': return `${v > 0 ? '−' : '+'}${a} points of grid dependency`;
    case 'kwh': return `${sign}${a} kWh of solar per year`;
    case 'metals': return `${sign}${a} kg of heavy metals diverted`;
    case 'co2': return v > 0 ? `${a} kg CO₂e prevented per year` : `${a} kg CO₂e more emitted per year`;
    case 'compost': return `${sign}${a} kg of compost`;
    case 'income': return `${sign}₹${a} recycler income`;
    case 'plastic': return `${sign}${a} kg of plastic kept out of the river`;
  }
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function predictLabel(k: MetricKey, v: number): string {
  return `${fmt(v)} ${METRICS[k].unit}`;
}

function Outcome({ hotspot, result }: { hotspot: Hotspot; result: ActionResult }) {
  const entries = Object.entries(result.delta).filter(([, v]) => v !== 0) as [MetricKey, number][];
  const metric = hotspot.predict?.metric;
  const rightReason = hotspot.reasons?.find((r) => r.id === hotspot.correctReason)?.text;
  return (
    <div className="grid gap-1.5 bg-[#0f1b12] p-3 shadow-[0_0_0_2px_var(--color-leafdk)]" role="status">
      <span className="font-display text-[16px] text-gold">
        {result.total !== undefined ? `${result.correct}/${result.total} correct · ` : ''}
        {result.points ? `+${fmt(result.points)} PTS` : 'NO POINTS'}
      </span>
      {result.basePoints !== undefined && (
        <span className="text-[16px] text-muted">
          {fmt(result.basePoints)} base × {result.multiplier} ({result.reasonCorrect ? 'right reason' : 'wrong reason'})
          {result.bonus ? ` + ${fmt(result.bonus)} prediction bonus` : ''} = {fmt(result.points)}
        </span>
      )}
      {result.reasonCorrect !== undefined && (
        <span className={result.reasonCorrect ? 'text-leaf' : 'text-warn'}>
          {result.reasonCorrect ? '✓ Right reason: ' : '✗ The key reason: '}{rightReason}
        </span>
      )}
      {metric && result.prediction !== undefined && result.predictionActual !== undefined && (
        <span className={result.predictionHit ? 'text-leaf' : 'text-warn'}>
          {result.predictionHit ? '✓' : '✗'} You guessed {predictLabel(metric, result.prediction)}. Actual: {predictLabel(metric, result.predictionActual)}.
        </span>
      )}
      <span>{result.outcome}</span>
      {entries.map(([k, v]) => (
        <span key={k} className={`animate-pop text-[16px] ${(k === 'co2' && v < 0) ? 'text-warn' : 'text-leaf'}`}>{deltaLabel(k, v)}</span>
      ))}
    </div>
  );
}

function SortGame({ disabled, graded, onSubmit }: {
  disabled: boolean;
  graded: boolean;
  onSubmit: (placements: Record<string, BinId>) => void;
}) {
  const [placements, setPlacements] = useState<Record<string, BinId>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const pool = SORT_ITEMS.filter((i) => !placements[i.id]);
  const placedCount = Object.keys(placements).length;
  const locked = disabled || graded;

  const place = (bin: BinId) => {
    if (!selected || locked) return;
    setPlacements((p) => ({ ...p, [selected]: bin }));
    setSelected(null);
  };
  const unplace = (id: string) => {
    if (locked) return;
    setPlacements((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  return (
    <div className="grid gap-2.5">
      <div className="flex min-h-11 flex-wrap gap-2" aria-label="Items to sort">
        {pool.map((it) => (
          <button key={it.id} type="button" disabled={locked} aria-pressed={selected === it.id}
            className={`btn flex items-center gap-2 px-2.5 py-1.5 text-[18px] ${selected === it.id ? 'shadow-[0_0_0_2px_var(--color-gold)]' : ''}`}
            onClick={() => setSelected(selected === it.id ? null : it.id)}>
            <i className="inline-block h-4 w-4 flex-none" style={{ background: it.color }} />{it.name}
          </button>
        ))}
        {pool.length === 0 && !graded && <span className="text-muted">All items sorted. Submit when ready, or tap an item to move it back.</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {BINS.map((b) => (
          <div key={b.id}
            role="button"
            tabIndex={locked ? -1 : 0}
            aria-label={`Put selected item in ${b.title}`}
            onClick={() => place(b.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); place(b.id); } }}
            className={`grid min-h-27.5 content-start gap-1.5 bg-well p-2 ${selected ? 'cursor-pointer shadow-[inset_0_0_0_2px_var(--color-gold)]' : 'shadow-[inset_0_0_0_2px_var(--color-line)]'}`}>
            <h3 className="label-caps">{b.title}</h3>
            <span className="text-[15px] text-muted">{b.route}</span>
            {SORT_ITEMS.filter((i) => placements[i.id] === b.id).map((it) => {
              const right = it.bin === b.id;
              return (
                <button key={it.id} type="button" disabled={locked}
                  onClick={(e) => { e.stopPropagation(); unplace(it.id); }}
                  className={`btn flex items-center gap-2 px-2 py-0.5 text-left text-[16px] ${graded ? (right ? 'shadow-[0_0_0_2px_var(--color-leaf)]' : 'shadow-[0_0_0_2px_var(--color-bad)]') : ''}`}>
                  <i className="inline-block h-4 w-4 flex-none" style={{ background: it.color }} />
                  {it.name}{graded && !right ? ` → ${BINS.find((x) => x.id === it.bin)!.title.split(' /')[0]}` : ''}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!graded && (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-primary" disabled={disabled || placedCount < SORT_ITEMS.length} onClick={() => onSubmit(placements)}>
            {disabled ? 'Saving…' : `Submit sort (${placedCount}/${SORT_ITEMS.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

type Step = 'pick' | 'why' | 'predict';

function ChoiceFlow({ hotspot, disabled, graded, onSubmit }: {
  hotspot: Hotspot;
  disabled: boolean;
  graded: boolean;
  onSubmit: (input: { choiceId: string; reasonId: string; prediction: number }) => void;
}) {
  const p = hotspot.predict!;
  // Shuffled once per modal open so the position of an option says nothing about its score.
  const choices = useMemo(() => shuffle(hotspot.choices!), [hotspot]);
  const reasons = useMemo(() => shuffle(hotspot.reasons!), [hotspot]);
  const [step, setStep] = useState<Step>('pick');
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [prediction, setPrediction] = useState(() => Math.round((p.min + p.max) / 2 / p.step) * p.step);
  const locked = disabled || graded;
  const chosen = choices.find((c) => c.id === choiceId);

  const option = (key: string, active: boolean, onClick: () => void, label: string, sub?: string) => (
    <button key={key} type="button" disabled={locked} aria-pressed={active} onClick={onClick}
      className={`btn grid gap-1 px-3 py-2.5 text-left ${active ? 'outline-3 outline-gold' : ''}`}>
      <b className="text-[20px] font-normal">{label}</b>
      {sub && <small className="text-[16px] text-muted">{sub}</small>}
    </button>
  );

  return (
    <div className="grid gap-2.5">
      <span className="label-caps">
        {step === 'pick' ? 'Step 1 of 3 · Choose an action' : step === 'why' ? 'Step 2 of 3 · Why is this the right call?' : 'Step 3 of 3 · Predict the impact'}
      </span>

      {step === 'pick' && (
        <div className="grid gap-2">
          {choices.map((c) => option(c.id, choiceId === c.id, () => setChoiceId(c.id), c.label, c.sub || undefined))}
        </div>
      )}

      {step === 'why' && (
        <div className="grid gap-2">
          <span className="text-muted">You chose: {chosen?.label}</span>
          {reasons.map((r) => option(r.id, reasonId === r.id, () => setReasonId(r.id), r.text))}
        </div>
      )}

      {step === 'predict' && (
        <div className="grid gap-2">
          <label htmlFor={`predict-${hotspot.id}`}>{p.question}</label>
          <span className="text-muted text-[16px]">Use the facts above. Within 25% earns a bonus.</span>
          <input id={`predict-${hotspot.id}`} type="range" min={p.min} max={p.max} step={p.step} value={prediction}
            disabled={locked} onChange={(e) => setPrediction(Number(e.target.value))} className="w-full accent-gold" />
          <span className="font-display text-[12px] text-gold" aria-live="polite">{predictLabel(p.metric, prediction)}</span>
        </div>
      )}

      {!graded && (
        <div className="flex flex-wrap justify-end gap-2">
          {step !== 'pick' && (
            <button type="button" className="btn" disabled={disabled} onClick={() => setStep(step === 'predict' ? 'why' : 'pick')}>◀ Back</button>
          )}
          {step === 'pick' && <button type="button" className="btn btn-primary" disabled={!choiceId} onClick={() => setStep('why')}>Next ▶</button>}
          {step === 'why' && <button type="button" className="btn btn-primary" disabled={!reasonId} onClick={() => setStep('predict')}>Next ▶</button>}
          {step === 'predict' && (
            <button type="button" className="btn btn-primary" disabled={disabled}
              onClick={() => onSubmit({ choiceId: choiceId!, reasonId: reasonId!, prediction })}>
              {disabled ? 'Saving…' : 'Submit'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function HotspotModal({ hotspot, alreadyDone, onClose, onSubmit }: {
  hotspot: Hotspot;
  alreadyDone: boolean;
  onClose: () => void;
  onSubmit: (input: ActionInput) => Promise<ActionResult>;
}) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (input: ActionInput) => {
    setSaving(true); setError(null);
    try { setResult(await onSubmit(input)); }
    catch (e) { setError(errorMessage(e)); }
    finally { setSaving(false); }
  };

  const titleId = `hotspot-${hotspot.id}`;
  return (
    <Modal labelledBy={titleId} onClose={onClose} wide={hotspot.kind === 'sort'}>
      <span className="text-[16px] uppercase text-river">{hotspot.eyebrow}</span>
      <h2 id={titleId} className="text-[13px]">{hotspot.title}</h2>
      <p className="m-0">{hotspot.desc}</p>
      <ul className="m-0 grid list-none gap-1 bg-well px-3 py-2.5 text-[18px] shadow-[inset_0_0_0_2px_var(--color-line)]">
        {hotspot.facts.map((f) => <li key={f}>▸ {f}</li>)}
      </ul>

      {alreadyDone && !result ? (
        <div className="grid gap-1.5 bg-[#0f1b12] p-3 shadow-[0_0_0_2px_var(--color-leafdk)]">
          <span className="font-display text-[14px] text-gold">ALREADY DONE</span>
          <span>You completed this hotspot. Use "Reset my progress" to play it again.</span>
        </div>
      ) : hotspot.kind === 'sort' ? (
        <SortGame disabled={saving} graded={Boolean(result)} onSubmit={(placements) => submit({ hotspotId: hotspot.id, placements })} />
      ) : (
        <ChoiceFlow hotspot={hotspot} disabled={saving} graded={Boolean(result)}
          onSubmit={(input) => submit({ hotspotId: hotspot.id, ...input })} />
      )}

      {result && <Outcome hotspot={hotspot} result={result} />}
      {error && <p className="m-0 text-bad" role="alert">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`btn ${result ? 'btn-primary' : ''}`} onClick={onClose}>{result ? 'Back to map' : alreadyDone ? 'Close' : 'Not now'}</button>
      </div>
    </Modal>
  );
}
