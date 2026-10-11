import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { ZONES, type ZoneId } from '../shared/hotspots';
import { api, errorMessage, type Profile } from './api';
import { AuthScreen } from './auth/AuthScreen';
import { GameScreen } from './ui/GameScreen';
import { NamePrompt } from './ui/NamePrompt';
import { ZoneSelect } from './ui/ZoneSelect';
import { Spinner, Toast, TopBar } from './ui/common';

type Screen = 'boot' | 'auth' | 'loadFailed' | 'name' | 'zones' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('boot');
  const [zone, setZone] = useState<ZoneId>('campus');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const loadProfile = useCallback(async () => {
    setScreen('boot');
    try {
      const user = await getCurrentUser();
      setEmail(user.signInDetails?.loginId ?? '');
    } catch {
      setScreen('auth');
      return;
    }
    try {
      const p = await api.me();
      setProfile(p);
      setScreen(p.displayName ? 'zones' : 'name');
    } catch (e) {
      setToast(errorMessage(e));
      setScreen('loadFailed');
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const doSignOut = async () => {
    await signOut().catch(() => undefined);
    setProfile(null);
    setScreen('auth');
  };

  const top = profile && (screen === 'zones' || screen === 'game') && (
    <TopBar
      name={profile.displayName ?? 'player'}
      score={profile.totalScore}
      zoneLabel={screen === 'game' ? ZONES[zone].name : undefined}
      onBack={screen === 'game' ? () => setScreen('zones') : undefined}
      onSignOut={doSignOut}
    />
  );

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-3">
      {top}
      {screen === 'boot' && <div className="mt-24"><Spinner label="Loading EcoMap…" /></div>}
      {screen === 'auth' && <AuthScreen onSignedIn={loadProfile} />}
      {screen === 'loadFailed' && (
        <div className="mx-auto mt-24 grid max-w-[420px] gap-3 text-center">
          <p>EcoMap could not load your profile.</p>
          <div className="flex justify-center gap-2">
            <button type="button" className="btn btn-primary" onClick={loadProfile}>Try again</button>
            <button type="button" className="btn btn-ghost" onClick={doSignOut}>Sign out</button>
          </div>
        </div>
      )}
      {screen === 'name' && (
        <NamePrompt
          suggestion={email.split('@')[0].replace(/[^A-Za-z0-9_.\- ]/g, '').slice(0, 20)}
          onSave={async (name) => { const p = await api.setName(name); setProfile(p); setScreen('zones'); }}
        />
      )}
      {screen === 'zones' && profile && <ZoneSelect profile={profile} onPick={(z) => { setZone(z); setScreen('game'); }} />}
      {screen === 'game' && profile && <GameScreen zone={zone} profile={profile} setProfile={setProfile} onError={setToast} />}
      <Toast message={toast} onDone={clearToast} />
    </main>
  );
}
