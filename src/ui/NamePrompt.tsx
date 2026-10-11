import { useState } from 'react';
import { errorMessage } from '../api';
import { Logo } from './common';

export function NamePrompt({ suggestion, onSave }: { suggestion: string; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(suggestion);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mx-auto mt-8 grid max-w-[420px] gap-5">
      <div className="flex justify-center"><Logo size="lg" /></div>
      <form
        className="px-frame grid gap-3.5 bg-panel p-3.5"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true); setError(null);
          try { await onSave(name.trim()); } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
        }}
      >
        <h2 className="text-[13px]">Pick a leaderboard name</h2>
        <p className="m-0 text-muted">This is what other players see next to your score. 2 to 20 characters.</p>
        <label className="grid gap-1 text-[17px] text-muted" htmlFor="display-name">
          Display name
          <input id="display-name" className="field" value={name} maxLength={20} autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="m-0 text-bad" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={saving || name.trim().length < 2}>
          {saving ? 'Saving…' : '▶ Continue'}
        </button>
      </form>
    </div>
  );
}
