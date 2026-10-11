import type { ZoneId } from '../../shared/hotspots';

export const TILE = 16;
export const COLS = 40;
export const ROWS = 24;
export const MAP_W = COLS * TILE;
export const MAP_H = ROWS * TILE;

/**
 * Tile codes:
 * . grass  t tree  = road  # building  p parking  f sports field  w water
 * s stone/sand plaza  g ghat steps  T temple  S stall  k kalash
 */
export type Grid = string[][];

function blank(): Grid {
  return Array.from({ length: ROWS }, () => Array<string>(COLS).fill('.'));
}

function fill(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = c;
}

function trees(g: Grid, points: [number, number][]) {
  points.forEach(([x, y]) => fill(g, x, y, 1, 1, 't'));
}

function campus(): Grid {
  const g = blank();
  fill(g, 0, 0, 40, 1, 't'); fill(g, 0, 23, 40, 1, 't'); fill(g, 0, 0, 1, 24, 't'); fill(g, 39, 0, 1, 24, 't');
  fill(g, 2, 2, 8, 4, '#'); fill(g, 15, 2, 7, 4, '#'); fill(g, 28, 2, 8, 4, '#');
  fill(g, 1, 7, 38, 2, '='); fill(g, 24, 9, 2, 14, '=');
  fill(g, 2, 10, 10, 3, 'p'); fill(g, 16, 10, 6, 4, '#'); fill(g, 28, 10, 7, 3, '#');
  fill(g, 2, 15, 11, 5, 'f'); fill(g, 28, 15, 9, 4, '#');
  trees(g, [[13, 3], [13, 4], [23, 3], [24, 4], [36, 3], [37, 4], [13, 11], [14, 12], [2, 21], [5, 21], [16, 20], [19, 21], [33, 21], [36, 20], [37, 14], [14, 16], [14, 18]]);
  fill(g, 16, 16, 6, 2, 'w');
  return g;
}

function temple(): Grid {
  const g = blank();
  fill(g, 0, 0, 40, 1, 't'); fill(g, 0, 0, 1, 17, 't'); fill(g, 39, 0, 1, 17, 't');
  fill(g, 19, 1, 2, 4, 's'); fill(g, 15, 5, 10, 6, 'T'); fill(g, 11, 11, 18, 3, 's');
  fill(g, 5, 14, 30, 3, 'g'); fill(g, 0, 17, 40, 7, 'w');
  fill(g, 5, 9, 2, 1, 'S'); fill(g, 5, 11, 2, 1, 'S'); fill(g, 8, 9, 2, 1, 'S'); fill(g, 8, 11, 2, 1, 'S'); fill(g, 5, 13, 2, 1, 'S');
  fill(g, 30, 12, 3, 1, 'k');
  trees(g, [[2, 2], [3, 4], [6, 3], [36, 2], [35, 5], [37, 8], [2, 7], [33, 9], [36, 11], [12, 3], [27, 3], [2, 12], [37, 14]]);
  return g;
}

export const GRIDS: Record<ZoneId, Grid> = { campus: campus(), temple: temple() };

export const LABELS: Record<ZoneId, [number, number, string][]> = {
  campus: [[6, 4, 'ENGG BLOCK'], [18.5, 4, 'LIBRARY'], [32, 4, 'ADMIN'], [7, 11.5, 'PARKING LANE'], [19, 12, 'COMP LAB'], [31.5, 11.5, 'CANTEEN'], [7.5, 17.5, 'SPORTS FIELD'], [32.5, 17, 'HOSTEL']],
  temple: [[20, 8, 'OMKARESHWAR'], [20, 15.5, 'MUTHA RIVER GHATS'], [20, 21, 'MUTHA RIVER'], [7, 10.3, 'STALLS'], [31.5, 12.5, 'KALASH']],
};

export const SPAWN: Record<ZoneId, { x: number; y: number }> = {
  campus: { x: 13, y: 9 },
  temple: { x: 20, y: 12 },
};

const WALKABLE = new Set(['.', '=', 'p', 'f', 's', 'g', 'k']);

export function isWalkable(zone: ZoneId, x: number, y: number): boolean {
  const c = GRIDS[zone][y]?.[x];
  return c !== undefined && WALKABLE.has(c);
}
