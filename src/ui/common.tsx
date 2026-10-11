import { useEffect, type ReactNode } from 'react';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

export function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size === 'lg' ? 28 : 22} height={size === 'lg' ? 28 : 22} viewBox="0 0 22 22" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="4" y="0" width="6" height="6" fill="#7ddc5a" />
        <rect x="0" y="6" width="14" height="6" fill="#7ddc5a" />
        <rect x="4" y="12" width="6" height="10" fill="#3f9b33" />
        <rect x="14" y="14" width="8" height="8" fill="#4fb6d8" />
      </svg>
      <h1 className={size === 'lg' ? 'text-[22px]' : 'text-[18px]'}>ECOMAP</h1>
    </div>
  );
}

export function TopBar({ name, score, zoneLabel, onBack, onSignOut }: {
  name: string;
  score: number;
  zoneLabel?: string;
  onBack?: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="px-frame mb-3.5 flex flex-wrap items-center gap-4 bg-panel px-3.5 py-2.5">
      <Logo />
      {zoneLabel && <span className="pill">Zone: {zoneLabel}</span>}
      {onBack && <button type="button" className="btn btn-ghost" onClick={onBack}>◀ Zones</button>}
      <div className="flex-1" />
      <span className="pill">{name}</span>
      <div className="font-display text-[14px] text-gold tabular-nums" aria-live="polite">
        {fmt(score)}
        <small className="block font-body text-[15px] text-muted">total pts</small>
      </div>
      <button type="button" className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
    </header>
  );
}

export function Modal({ labelledBy, onClose, children, wide = false }: { labelledBy: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-[#030508cc] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`px-frame grid max-h-[92vh] w-full gap-3 overflow-auto bg-panel p-[18px] ${wide ? 'max-w-[760px]' : 'max-w-[680px]'}`}>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 5000);
    return () => clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div role="alert" className="fixed bottom-4 left-1/2 z-20 w-[min(560px,calc(100%-32px))] -translate-x-1/2 bg-[#2a1418] px-4 py-3 shadow-[0_0_0_2px_var(--color-bad)]">
      {message}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return <p className="animate-pulse text-center text-muted" role="status">{label}</p>;
}
