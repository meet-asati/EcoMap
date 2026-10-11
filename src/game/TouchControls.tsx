import { useEffect, useRef, type RefObject } from 'react';
import type { Hotspot } from '../../shared/hotspots';
import type { MapControls } from './MapCanvas';

// First repeat waits a little longer so a quick tap moves exactly one tile.
const REPEAT_DELAY_MS = 260;
const REPEAT_MS = 120;

const DIRS = [
  { label: 'Walk up', glyph: '▲', d: [0, -1], area: 'col-start-2 row-start-1' },
  { label: 'Walk left', glyph: '◀', d: [-1, 0], area: 'col-start-1 row-start-2' },
  { label: 'Walk right', glyph: '▶', d: [1, 0], area: 'col-start-3 row-start-2' },
  { label: 'Walk down', glyph: '▼', d: [0, 1], area: 'col-start-2 row-start-3' },
] as const;

export function TouchControls({ controls, near, disabled }: {
  controls: RefObject<MapControls | null>;
  near: Hotspot | null;
  disabled: boolean;
}) {
  const timer = useRef<number | undefined>(undefined);
  const stop = () => { clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => stop, []);
  useEffect(() => { if (disabled) stop(); }, [disabled]);

  const start = (dx: number, dy: number) => {
    stop();
    controls.current?.move(dx, dy);
    const tick = () => { controls.current?.move(dx, dy); timer.current = window.setTimeout(tick, REPEAT_MS); };
    timer.current = window.setTimeout(tick, REPEAT_DELAY_MS);
  };

  return (
    // Shown on touch devices and narrow screens; desktop keeps the keyboard hint only.
    <div className="flex touch-none select-none items-center justify-between gap-4 px-1 lg:pointer-fine:hidden">
      <div className="grid grid-cols-[repeat(3,52px)] grid-rows-[repeat(3,52px)] gap-1" role="group" aria-label="Walk">
        {DIRS.map(({ label, glyph, d, area }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            disabled={disabled}
            className={`btn grid place-items-center p-0 text-[22px] ${area}`}
            onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); start(d[0], d[1]); }}
            onPointerUp={stop}
            onPointerCancel={stop}
            onLostPointerCapture={stop}
            onContextMenu={(e) => e.preventDefault()}
            // Keyboard / switch access: Enter or Space on a focused button moves one tile.
            onClick={(e) => { if (e.detail === 0) controls.current?.move(d[0], d[1]); }}
          >
            {glyph}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || !near}
        onClick={() => controls.current?.interact()}
        className={`btn grid min-h-[72px] min-w-[120px] max-w-[50%] place-items-center gap-1 px-3 py-2 text-center ${near && !disabled ? 'btn-primary' : ''}`}
      >
        <span className="font-display text-[12px]">ACT</span>
        <span className="text-[16px] leading-tight">{near ? near.title : 'Walk to a ! spot'}</span>
      </button>
    </div>
  );
}
