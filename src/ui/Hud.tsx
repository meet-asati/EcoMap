import { useState } from 'react';
import { METRICS, hotspotsFor, type Hotspot, type MetricKey, type ZoneId } from '../../shared/hotspots';
import type { Profile } from '../api';
import { fmt } from './common';

const ZONE_METRICS: Record<ZoneId, MetricKey[]> = {
  campus: ['gridCut', 'kwh', 'metals', 'co2'],
  temple: ['compost', 'income', 'plastic'],
};

function MetricRow({ k, value }: { k: MetricKey; value: number }) {
  const m = METRICS[k];
  if (k === 'gridCut') {
    const dep = Math.max(0, Math.min(100, 100 - value));
    return (
      <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 border-t-2 border-line py-2 first:border-t-0">
        <span className="text-[18px] text-muted">{m.label}</span>
        <span className={`self-center text-right font-display text-[12px] tabular-nums ${dep > 70 ? 'text-warn' : 'text-leaf'}`}>{fmt(dep)}%</span>
        <div className="col-span-2 mt-1 h-2.5 bg-well shadow-[inset_0_0_0_2px_var(--color-line)]" aria-hidden="true">
          <i className={`block h-full transition-[width] duration-700 ${dep > 70 ? 'bg-warn' : 'bg-leaf'}`} style={{ width: `${dep}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 border-t-2 border-line py-2 first:border-t-0">
      <span className="text-[18px] text-muted">{m.label}</span>
      <span className="self-center text-right font-display text-[12px] tabular-nums">
        {k === 'income' && <span className="font-body text-[20px]">₹</span>}
        {fmt(value)}
      </span>
      <span className="col-span-2 text-[15px] text-muted">{m.unit}</span>
    </div>
  );
}

export function Hud({ zone, profile, onOpen, onReset, resetting }: {
  zone: ZoneId;
  profile: Profile;
  onOpen: (h: Hotspot) => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  return (
    <aside className="px-frame bg-panel p-3.5" aria-label="Impact and hotspots">
      <h3 className="label-caps mb-2.5">{zone === 'campus' ? 'Campus impact' : 'Ghat impact'}</h3>
      {ZONE_METRICS[zone].map((k) => <MetricRow key={k} k={k} value={profile.metrics[k] ?? 0} />)}

      <h3 className="label-caps mt-3.5">Hotspots</h3>
      <div className="mt-2.5 grid gap-1.5">
        {hotspotsFor(zone).map((h) => {
          const done = Boolean(profile.completed[h.id]);
          return (
            <button key={h.id} type="button" className="btn flex justify-between gap-2 px-2.5 py-1.5 text-left text-[18px]" onClick={() => onOpen(h)}>
              <span>{h.title}</span>
              <span className={done ? 'text-leaf' : 'text-gold'} aria-label={done ? 'completed' : 'not done yet'}>{done ? '✔' : '!'}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className={`btn mt-3 w-full text-[16px] ${confirming ? 'btn-primary' : 'btn-ghost'}`}
        disabled={resetting}
        onClick={() => {
          if (!confirming) { setConfirming(true); setTimeout(() => setConfirming(false), 4000); return; }
          setConfirming(false);
          onReset();
        }}
      >
        {resetting ? 'Resetting…' : confirming ? 'Click again to reset everything' : 'Reset my progress'}
      </button>
    </aside>
  );
}
