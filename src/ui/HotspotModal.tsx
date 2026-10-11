import { useState } from 'react';
import { BINS, SORT_ITEMS, type ActionInput, type ActionResult, type BinId, type Hotspot, type MetricKey } from '../../shared/hotspots';
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

function Outcome({ result }: { result: ActionResult }) {
  const entries = Object.entries(result.delta).filter(([, v]) => v !== 0) as [MetricKey, number][];
  return (
    <div className="grid gap-1.5 bg-[#0f1b12] p-3 shadow-[0_0_0_2px_var(--color-leafdk)]" role="status">
      <span className="font-display text-[16px] text-gold">
        {result.total !== undefined ? `${result.correct}/${result.total} correct · ` : ''}
        {result.points ? `+${fmt(result.points)} PTS` : 'NO POINTS'}
      </span>
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
      <div className="flex min-h-[44px] flex-wrap gap-2" aria-label="Items to sort">
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
            className={`grid min-h-[110px] content-start gap-1.5 bg-well p-2 ${selected ? 'cursor-pointer shadow-[inset_0_0_0_2px_var(--color-gold)]' : 'shadow-[inset_0_0_0_2px_var(--color-line)]'}`}>
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

export function HotspotModal({ hotspot, alreadyDone, onClose, onSubmit }: {
  hotspot: Hotspot;
  alreadyDone: boolean;
  onClose: () => void;
  onSubmit: (input: ActionInput) => Promise<ActionResult>;
}) {
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const submit = async (input: ActionInput) => {
    setSaving(true); setError(null);
    try { setResult(await onSubmit(input)); }
    catch (e) { setError(errorMessage(e)); setPicked(null); }
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
        <div className="grid gap-2">
          {hotspot.choices!.map((c) => (
            <button key={c.id} type="button" disabled={saving || Boolean(result)}
              className={`btn grid grid-cols-[1fr_auto] gap-x-2.5 gap-y-1 px-3 py-2.5 text-left ${c.sustainable ? 'shadow-[0_0_0_2px_var(--color-leafdk),inset_0_-3px_0_#0007]' : ''} ${picked === c.id ? 'outline-3 outline-gold' : ''}`}
              onClick={() => { setPicked(c.id); submit({ hotspotId: hotspot.id, choiceId: c.id }); }}>
              <b className="col-start-1 row-start-1 text-[20px] font-normal">{c.label}</b>
              {c.sub && <small className="col-start-1 row-start-2 text-[16px] text-muted">{c.sub}</small>}
              <span className="col-start-2 row-span-2 row-start-1 self-center whitespace-nowrap font-display text-[10px] text-gold">
                {saving && picked === c.id ? 'Saving…' : `${c.points ? '+' + fmt(c.points) : '0'} pts`}
              </span>
            </button>
          ))}
        </div>
      )}

      {result && <Outcome result={result} />}
      {error && <p className="m-0 text-bad" role="alert">{error}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={`btn ${result ? 'btn-primary' : ''}`} onClick={onClose}>{result ? 'Back to map' : alreadyDone ? 'Close' : 'Not now'}</button>
      </div>
    </Modal>
  );
}
