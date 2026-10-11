import type { Hotspot, ZoneId } from '../../shared/hotspots';
import { COLS, GRIDS, LABELS, ROWS, TILE as T } from './maps';

/** Deterministic hash so speckles and windows don't flicker between frames. */
function h2(x: number, y: number): number {
  let n = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return n / 4294967295;
}

const PALETTE: Record<string, string[]> = {
  '.': ['#4f8f3a', '#4a8636', '#57993f'],
  t: ['#2f6b2a'],
  '=': ['#4a4a52', '#46464e', '#515159'],
  '#': ['#6b5b73'],
  p: ['#5a5a66', '#55555f'],
  f: ['#3f9a46', '#3b9242'],
  w: ['#2d6f9e', '#2a6893'],
  s: ['#c9a56a', '#c39f66', '#cfab70'],
  g: ['#b9a07c'],
  T: ['#d8c28f'],
  S: ['#b0423a'],
  k: ['#c9a56a'],
};

function base(c: string, x: number, y: number): string {
  const p = PALETTE[c] ?? PALETTE['.'];
  return p[Math.floor(h2(x, y) * p.length)];
}

function drawTile(ctx: CanvasRenderingContext2D, c: string, x: number, y: number, time: number) {
  const px = x * T, py = y * T;
  ctx.fillStyle = base(c, x, y);
  ctx.fillRect(px, py, T, T);
  switch (c) {
    case '.':
    case 'f':
      ctx.fillStyle = '#3e7a2e';
      for (let k = 0; k < 3; k++) ctx.fillRect(px + Math.floor(h2(x * 7 + k, y * 3) * 14), py + Math.floor(h2(y * 5 + k, x) * 14), 2, 2);
      if (c === 'f' && x % 4 === 0) { ctx.fillStyle = '#e8f1dc'; ctx.fillRect(px, py, 1, T); }
      break;
    case '=':
      ctx.fillStyle = '#2b2b31'; ctx.fillRect(px, py, T, 1);
      if (h2(x, y) > 0.5) { ctx.fillStyle = '#d9d04a'; ctx.fillRect(px + 4, py + 7, 8, 2); }
      break;
    case 'p':
      ctx.fillStyle = '#e6e6ea'; ctx.fillRect(px, py, 1, T);
      if (h2(x, y) > 0.45) {
        ctx.fillStyle = ['#cc3333', '#3366cc', '#dddddd', '#2a2a2a'][Math.floor(h2(y, x) * 4)];
        ctx.fillRect(px + 3, py + 4, 10, 8);
        ctx.fillStyle = '#99ffee'; ctx.fillRect(px + 5, py + 5, 6, 2);
      }
      break;
    case 'w': {
      const wv = Math.floor((time / 300 + x * 0.7 + y) % 6);
      ctx.fillStyle = '#4a94c4'; ctx.fillRect(px + ((wv * 3) % T), py + ((x + y) % 3) * 5, 5, 1);
      break;
    }
    case 's':
      ctx.fillStyle = '#b08c56'; ctx.fillRect(px, py + T - 1, T, 1); ctx.fillRect(px + T - 1, py, 1, T);
      break;
    case 'g':
      ctx.fillStyle = '#8a7357'; ctx.fillRect(px, py + 5, T, 1); ctx.fillRect(px, py + 11, T, 1);
      ctx.fillStyle = '#d1b893'; ctx.fillRect(px, py, T, 1);
      break;
    case 'k':
      ctx.fillStyle = '#c0392b'; ctx.fillRect(px + 3, py + 6, 10, 9);
      ctx.fillStyle = '#e67e22'; ctx.fillRect(px + 2, py + 4, 12, 2);
      ctx.fillStyle = '#ffd166'; ctx.fillRect(px + 5, py + 1, 6, 3);
      break;
    case 'S':
      ctx.fillStyle = '#ffd166'; ctx.fillRect(px, py, T, 3);
      ctx.fillStyle = '#7a2d28'; ctx.fillRect(px + 2, py + 8, 12, 8);
      ctx.fillStyle = '#ff8ad0'; ctx.fillRect(px + 3, py + 5, 3, 3);
      ctx.fillStyle = '#ffb02e'; ctx.fillRect(px + 8, py + 5, 3, 3);
      break;
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, temple: boolean) {
  ctx.fillStyle = temple ? '#b8894a' : '#5e5068'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = temple ? '#e9d9a6' : '#8a7a96'; ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = '#000'; ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x + w - 2, y, 2, h);
  if (temple) {
    // Shikhara spire and saffron flag
    ctx.fillStyle = '#f0e2b0'; ctx.fillRect(x + w / 2 - 20, y - 26, 40, 30); ctx.fillRect(x + w / 2 - 12, y - 40, 24, 16);
    ctx.fillStyle = '#ffb02e'; ctx.fillRect(x + w / 2 - 4, y - 48, 8, 10);
    ctx.fillStyle = '#e85d3c'; ctx.fillRect(x + w / 2 - 2, y - 56, 4, 8);
    ctx.fillStyle = '#7a4a1e'; ctx.fillRect(x + w / 2 - 6, y + h - 18, 12, 18);
    return;
  }
  for (let j = y + 10; j < y + h - 6; j += 10) for (let i = x + 4; i < x + w - 6; i += 8) {
    ctx.fillStyle = h2(i, j) > 0.3 ? '#ffe9a3' : '#3a3144'; ctx.fillRect(i, j, 4, 5);
  }
  ctx.fillStyle = '#4e8c3d';
  for (let q = x + 3; q < x + w - 10; q += 12) ctx.fillRect(q, y + 1, 8, 4);
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const px = x * T, py = y * T;
  ctx.fillStyle = '#5a3a1e'; ctx.fillRect(px + 7, py + 11, 2, 5);
  ctx.fillStyle = '#2f7a2f'; ctx.fillRect(px + 2, py + 3, 12, 9); ctx.fillRect(px + 4, py + 1, 8, 2);
  ctx.fillStyle = '#48a63a'; ctx.fillRect(px + 4, py + 3, 4, 3); ctx.fillRect(px + 9, py + 6, 3, 3);
}

function drawPip(ctx: CanvasRenderingContext2D, h: Hotspot, done: boolean, time: number) {
  const cx = (h.x + h.w / 2) * T, cy = h.y * T - 2;
  if (!done) {
    const r = 8 + ((time / 40) % 10);
    ctx.strokeStyle = 'rgba(255,209,102,.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(cx - r, cy + 8 - r, r * 2, r * 2);
  }
  const y0 = cy - 16 + Math.round(Math.sin(time / 220) * 3);
  ctx.fillStyle = '#000'; ctx.fillRect(cx - 7, y0 - 1, 14, 22);
  ctx.fillStyle = done ? '#7ddc5a' : '#ffd166'; ctx.fillRect(cx - 6, y0, 12, 20);
  ctx.fillStyle = done ? '#3f9b33' : '#ff8a5b'; ctx.fillRect(cx - 6, y0 + 16, 12, 4);
  ctx.fillStyle = '#000';
  if (done) {
    ctx.fillRect(cx - 4, y0 + 8, 2, 2); ctx.fillRect(cx - 2, y0 + 10, 2, 2); ctx.fillRect(cx, y0 + 8, 2, 2);
    ctx.fillRect(cx + 2, y0 + 6, 2, 2); ctx.fillRect(cx + 4, y0 + 4, 2, 2);
  } else {
    ctx.fillRect(cx - 1, y0 + 3, 2, 8); ctx.fillRect(cx - 1, y0 + 13, 2, 2);
  }
}

export function drawAvatar(ctx: CanvasRenderingContext2D, ax: number, ay: number, time: number) {
  const px = ax * T + 2, py = ay * T - 4, step = Math.floor(time / 180) % 2;
  ctx.fillStyle = '#000'; ctx.fillRect(px - 1, py - 1, 14, 22);
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(px, py, 12, 4);
  ctx.fillStyle = '#e0ac7e'; ctx.fillRect(px, py + 4, 12, 6);
  ctx.fillStyle = '#000'; ctx.fillRect(px + 2, py + 6, 2, 2); ctx.fillRect(px + 8, py + 6, 2, 2);
  ctx.fillStyle = '#7ddc5a'; ctx.fillRect(px, py + 10, 12, 7);
  ctx.fillStyle = '#1f3b7a'; ctx.fillRect(px + 1, py + 17, 4, 4 - step); ctx.fillRect(px + 7, py + 17, 4, 3 + step);
}

export function drawMap(ctx: CanvasRenderingContext2D, zone: ZoneId, time: number, hotspots: Hotspot[], completed: Set<string>) {
  const g = GRIDS[zone];
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) drawTile(ctx, g[y][x], x, y, time);

  // Merge contiguous building tiles into single blocks.
  const seen = new Set<string>();
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const c = g[y][x];
    if ((c === '#' || c === 'T') && !seen.has(`${x},${y}`)) {
      let w = 0, h = 0;
      while (g[y][x + w] === c) w++;
      while (g[y + h]?.[x] === c) h++;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) seen.add(`${x + i},${y + j}`);
      drawBuilding(ctx, x * T, y * T, w * T, h * T, c === 'T');
    }
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === 't') drawTree(ctx, x, y);

  ctx.font = '7px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const [lx, ly, text] of LABELS[zone]) {
    const px = lx * T, py = ly * T, mw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(px - mw / 2 - 3, py - 6, mw + 6, 12);
    ctx.fillStyle = '#f3f3f3'; ctx.fillText(text, px, py + 1);
  }
  for (const h of hotspots) drawPip(ctx, h, completed.has(h.id), time);
}
