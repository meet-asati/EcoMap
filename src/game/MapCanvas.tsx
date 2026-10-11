import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type Ref } from 'react';
import { hotspotsFor, type Hotspot, type ZoneId } from '../../shared/hotspots';
import { drawAvatar, drawMap } from './render';
import { COLS, MAP_H, MAP_W, ROWS, SPAWN, isWalkable } from './maps';

interface Props {
  zone: ZoneId;
  completed: Set<string>;
  paused: boolean;
  onOpen: (h: Hotspot) => void;
  /** Fires when the avatar steps next to a hotspot, or away from one. */
  onNear?: (h: Hotspot | null) => void;
  ref?: Ref<MapControls>;
}

/** Imperative walking for on-screen controls. */
export interface MapControls {
  move: (dx: number, dy: number) => void;
  interact: () => void;
}

const KEYS: Record<string, [number, number]> = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0],
};

function hotspotAtTile(hs: Hotspot[], x: number, y: number) {
  // Include two rows above each rectangle so clicking the floating pip works.
  return hs.find((h) => x >= h.x && x < h.x + h.w && y >= h.y - 2 && y < h.y + h.h);
}

function hotspotNear(hs: Hotspot[], x: number, y: number) {
  return hs.find((h) => x >= h.x - 1 && x <= h.x + h.w && y >= h.y - 1 && y <= h.y + h.h);
}

export function MapCanvas({ zone, completed, paused, onOpen, onNear, ref }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatar = useRef({ ...SPAWN[zone] });
  const near = useRef<Hotspot | null>(null);
  const live = useRef({ completed, paused, onOpen, onNear });
  live.current = { completed, paused, onOpen, onNear };
  const hotspots = useMemo(() => hotspotsFor(zone), [zone]);

  const updateNear = useCallback(() => {
    const h = hotspotNear(hotspots, avatar.current.x, avatar.current.y) ?? null;
    if (h !== near.current) { near.current = h; live.current.onNear?.(h); }
  }, [hotspots]);

  useEffect(() => {
    avatar.current = { ...SPAWN[zone] };
    updateNear();
  }, [zone, updateNear]);

  const move = useCallback((dx: number, dy: number) => {
    if (live.current.paused) return;
    const nx = avatar.current.x + dx, ny = avatar.current.y + dy;
    if (isWalkable(zone, nx, ny)) { avatar.current = { x: nx, y: ny }; updateNear(); }
  }, [zone, updateNear]);

  const interact = useCallback(() => {
    if (live.current.paused) return false;
    const h = hotspotNear(hotspots, avatar.current.x, avatar.current.y);
    if (h) live.current.onOpen(h);
    return Boolean(h);
  }, [hotspots]);

  useImperativeHandle(ref, () => ({ move, interact }), [move, interact]);

  // Render loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const frame = (t: number) => {
      drawMap(ctx, zone, t, hotspots, live.current.completed);
      drawAvatar(ctx, avatar.current.x, avatar.current.y, t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [zone, hotspots]);

  // Keyboard: walk and interact
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (live.current.paused) return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const key = e.key.toLowerCase();
      const dir = KEYS[key];
      if (dir) {
        e.preventDefault();
        move(dir[0], dir[1]);
        return;
      }
      if (key === 'e' || (key === 'enter' && target?.tagName !== 'BUTTON')) {
        if (interact()) e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, interact]);

  const tileFromEvent = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.floor(((e.clientX - r.left) / r.width) * COLS),
      y: Math.floor(((e.clientY - r.top) / r.height) * ROWS),
    };
  };

  return (
    <canvas
      ref={canvasRef}
      width={MAP_W}
      height={MAP_H}
      className="pixelated block h-auto w-full"
      aria-label={zone === 'campus' ? 'Pixel map of the college campus' : 'Pixel map of Omkareshwar temple and the Mutha river ghats'}
      onClick={(e) => {
        const { x, y } = tileFromEvent(e);
        const h = hotspotAtTile(hotspots, x, y);
        if (h) onOpen(h);
      }}
      onMouseMove={(e) => {
        const { x, y } = tileFromEvent(e);
        e.currentTarget.style.cursor = hotspotAtTile(hotspots, x, y) ? 'pointer' : 'crosshair';
      }}
    />
  );
}
