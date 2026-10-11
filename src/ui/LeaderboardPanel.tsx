import type { Leaderboard } from '../api';
import { fmt } from './common';

export function LeaderboardPanel({ data, error }: { data: Leaderboard | null; error: string | null }) {
  return (
    <aside className="px-frame bg-panel p-3.5" aria-label="Global leaderboard">
      <h3 className="label-caps mb-2.5">Global leaderboard</h3>
      {error && <p className="text-[16px] text-bad">{error}</p>}
      {!data && !error && <p className="animate-pulse text-muted">Loading scores…</p>}
      {data && (
        <ol className="m-0 grid list-none gap-1.5 p-0">
          {data.entries.length === 0 && <li className="text-muted">No scores yet. Be the first.</li>}
          {data.entries.map((e) => (
            <li key={e.rank} className={`grid grid-cols-[28px_1fr_auto] items-center gap-2 bg-panel2 px-2 py-1.5 ${e.isMe ? 'shadow-[0_0_0_2px_var(--color-gold)]' : ''}`}>
              <span className={`font-display text-[10px] ${e.isMe || e.rank === 1 ? 'text-gold' : 'text-muted'}`}>{String(e.rank).padStart(2, '0')}</span>
              <span className="min-w-0 truncate">{e.isMe ? `${e.displayName} (you)` : e.displayName}</span>
              <span className="font-display text-[10px] tabular-nums">{fmt(e.totalScore)}</span>
            </li>
          ))}
          {data.me && (
            <>
              <li aria-hidden="true" className="text-center text-muted">⋯</li>
              <li className="grid grid-cols-[28px_1fr_auto] items-center gap-2 bg-panel2 px-2 py-1.5 shadow-[0_0_0_2px_var(--color-gold)]">
                <span className="font-display text-[10px] text-gold">--</span>
                <span className="min-w-0 truncate">{data.me.displayName ?? 'You'} (you)</span>
                <span className="font-display text-[10px] tabular-nums">{fmt(data.me.totalScore)}</span>
              </li>
            </>
          )}
        </ol>
      )}
      <p className="mt-2.5 text-[15px] text-muted">Top 10 players. Updates after every action.</p>
    </aside>
  );
}
