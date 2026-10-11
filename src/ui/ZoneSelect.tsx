import { useEffect, useRef } from 'react';
import { ZONES, hotspotsFor, type ZoneId } from '../../shared/hotspots';
import type { Profile } from '../api';
import { drawMap } from '../game/render';
import { MAP_H, MAP_W } from '../game/maps';

function Thumb({ zone, completed }: { zone: ZoneId; completed: Set<string> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const paint = () => {
      const ctx = ref.current?.getContext('2d');
      if (ctx) drawMap(ctx, zone, 0, hotspotsFor(zone), completed);
    };
    paint();
    document.fonts?.ready.then(paint);
  }, [zone, completed]);
  return <canvas ref={ref} width={MAP_W} height={MAP_H} className="pixelated block h-auto w-full" aria-hidden="true" />;
}

export function ZoneSelect({ profile, onPick }: { profile: Profile; onPick: (z: ZoneId) => void }) {
  const completed = new Set(Object.keys(profile.completed));
  return (
    <section>
      <div className="mx-auto mb-6 mt-2 max-w-180 text-center">
        <h2 className="text-[13px]">Choose a zone</h2>
        <p className="mt-2.5 text-muted">Each zone is a real Pune micro-environment with live hotspots. Your progress is saved to your profile.</p>
      </div>
      <div className="mx-auto grid max-w-225 gap-4.5 sm:grid-cols-2">
        {(Object.keys(ZONES) as ZoneId[]).map((z) => {
          const hs = hotspotsFor(z);
          const done = hs.filter((h) => completed.has(h.id)).length;
          return (
            <button key={z} type="button" onClick={() => onPick(z)} className="px-frame grid gap-3 bg-panel p-0 text-left hover:bg-panel2">
              <Thumb zone={z} completed={completed} />
              <div className="px-3.5 pb-3.5">
                <h2 className="text-[13px]">{ZONES[z].name.toUpperCase()}</h2>
                <p className="mt-1.5 text-muted">{ZONES[z].blurb}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ZONES[z].tags.map((t) => <span key={t} className="pill">{t}</span>)}
                  <span className="pill text-gold">{done}/{hs.length} hotspots done</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
