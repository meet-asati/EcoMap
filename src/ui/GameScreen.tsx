import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActionInput, Hotspot, ZoneId } from '../../shared/hotspots';
import { api, errorMessage, type Leaderboard, type Profile } from '../api';
import { MapCanvas } from '../game/MapCanvas';
import { HotspotModal } from './HotspotModal';
import { Hud } from './Hud';
import { LeaderboardPanel } from './LeaderboardPanel';
import { SourcesPanel } from './SourcesPanel';

const LEADERBOARD_POLL_MS = 30_000;

export function GameScreen({ zone, profile, setProfile, onError }: {
  zone: ZoneId;
  profile: Profile;
  setProfile: (p: Profile) => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState<Hotspot | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const completed = useMemo(() => new Set(Object.keys(profile.completed)), [profile.completed]);

  const refreshBoard = useCallback(async () => {
    try { setBoard(await api.leaderboard()); setBoardError(null); }
    catch (e) { setBoardError(errorMessage(e)); }
  }, []);

  useEffect(() => {
    refreshBoard();
    const t = setInterval(refreshBoard, LEADERBOARD_POLL_MS);
    return () => clearInterval(t);
  }, [refreshBoard]);

  const submit = async (input: ActionInput) => {
    const { result, profile: next } = await api.act(input);
    setProfile(next);
    refreshBoard();
    return result;
  };

  const reset = async () => {
    setResetting(true);
    try { setProfile(await api.reset()); refreshBoard(); }
    catch (e) { onError(errorMessage(e)); }
    finally { setResetting(false); }
  };

  return (
    <div className="grid items-start gap-3.5 lg:grid-cols-[230px_minmax(0,1fr)_250px]">
      <Hud zone={zone} profile={profile} onOpen={setOpen} onReset={reset} resetting={resetting} />

      <div className="grid gap-2">
        <div className="px-stage relative bg-[#06090d] p-2">
          <MapCanvas zone={zone} completed={completed} paused={Boolean(open) || showSources} onOpen={setOpen} />
          {zone === 'temple' && (
            <div className="absolute right-3 top-3 bg-[#5a2a7a] px-2 py-1.5 font-display text-[9px] text-[#ffd9f7] shadow-[0_0_0_2px_#c57bff]">
              GANESHOTSAV · VISARJAN DAY
            </div>
          )}
          <div className="absolute bottom-3 left-3 bg-[#000b] px-2 py-1 text-[16px] text-muted">
            Arrow keys or WASD to walk · E to interact · or click a ! pip
          </div>
        </div>
        <div className="flex justify-end">
          <button type="button" className="text-[17px] text-river underline" onClick={() => setShowSources(true)}>Sources and assumptions</button>
        </div>
      </div>

      <LeaderboardPanel data={board} error={boardError} />

      {open && (
        <HotspotModal
          key={open.id}
          hotspot={open}
          alreadyDone={completed.has(open.id)}
          onClose={() => setOpen(null)}
          onSubmit={submit}
        />
      )}
      {showSources && <SourcesPanel onClose={() => setShowSources(false)} />}
    </div>
  );
}
