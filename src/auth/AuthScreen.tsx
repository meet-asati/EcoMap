import { useState, type FormEvent, type ReactNode } from 'react';
import {
  autoSignIn,
  confirmResetPassword,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  signIn,
  signUp,
} from 'aws-amplify/auth';
import { Logo } from '../ui/common';

type Mode = 'signIn' | 'signUp' | 'confirm' | 'forgot' | 'forgotConfirm';

const PASSWORD_HINT = 'At least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol.';

/** Turn Cognito error names into instructions a player can act on. */
function friendly(e: unknown): string {
  const err = e as { name?: string; message?: string };
  switch (err?.name) {
    case 'NotAuthorizedException': return 'That email and password do not match. Check them and try again.';
    case 'UserNotFoundException': return 'No account uses that email. Create an account first.';
    case 'UsernameExistsException': return 'An account already uses that email. Sign in instead.';
    case 'InvalidPasswordException': return `That password is too weak. ${PASSWORD_HINT}`;
    case 'CodeMismatchException': return 'That code is not right. Check the latest email and try again.';
    case 'ExpiredCodeException': return 'That code has expired. Send a new one and try again.';
    case 'LimitExceededException':
    case 'TooManyRequestsException': return 'Too many attempts. Wait a few minutes and try again.';
    case 'UserAlreadyAuthenticatedException': return 'You are already signed in. Reload the page.';
    case 'EmptySignInUsername':
    case 'EmptySignUpUsername': return 'Enter your email address.';
    case 'EmptySignInPassword':
    case 'EmptySignUpPassword': return 'Enter your password.';
    default: return err?.message || 'Something went wrong. Try again.';
  }
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <label htmlFor={id} className="grid gap-1 text-[17px] text-muted">
      {label}
      {children}
    </label>
  );
}

export function AuthScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const go = (m: Mode) => { setMode(m); setError(null); setNotice(null); setCode(''); };

  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await fn(); } catch (err) { setError(friendly(err)); } finally { setBusy(false); }
  };

  const doSignIn = run(async () => {
    const res = await signIn({ username: email.trim(), password });
    if (res.isSignedIn) return onSignedIn();
    if (res.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
      await resendSignUpCode({ username: email.trim() });
      go('confirm');
      setNotice(`Your account is not verified yet. We sent a new code to ${email.trim()}.`);
      return;
    }
    if (res.nextStep.signInStep === 'RESET_PASSWORD') { go('forgot'); return; }
    throw new Error('This account needs a step EcoMap does not support. Contact the organisers.');
  });

  const doSignUp = run(async () => {
    const res = await signUp({ username: email.trim(), password, options: { userAttributes: { email: email.trim() }, autoSignIn: true } });
    if (res.isSignUpComplete) { onSignedIn(); return; }
    go('confirm');
    setNotice(`We sent a 6-digit code to ${email.trim()}. It can take a minute to arrive.`);
  });

  const doConfirm = run(async () => {
    const res = await confirmSignUp({ username: email.trim(), confirmationCode: code.trim() });
    if (res.nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
      const s = await autoSignIn();
      if (s.isSignedIn) return onSignedIn();
    }
    // Auto sign-in is unavailable (for example after a page reload), so sign in directly.
    if (password) {
      const s = await signIn({ username: email.trim(), password });
      if (s.isSignedIn) return onSignedIn();
    }
    go('signIn');
    setNotice('Your email is verified. Sign in to start.');
  });

  const doForgot = run(async () => {
    await resetPassword({ username: email.trim() });
    go('forgotConfirm');
    setNotice(`We sent a reset code to ${email.trim()}.`);
  });

  const doForgotConfirm = run(async () => {
    await confirmResetPassword({ username: email.trim(), confirmationCode: code.trim(), newPassword: password });
    go('signIn');
    setNotice('Password changed. Sign in with your new password.');
  });

  const emailField = (
    <Field id="email" label="Email">
      <input id="email" className="field" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
    </Field>
  );
  const passwordField = (label: string, autoComplete: string) => (
    <Field id="password" label={label}>
      <input id="password" className="field" type="password" autoComplete={autoComplete} required value={password} onChange={(e) => setPassword(e.target.value)} />
    </Field>
  );
  const codeField = (
    <Field id="code" label="6-digit code">
      <input id="code" className="field tracking-[6px]" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
    </Field>
  );

  const submitLabel: Record<Mode, string> = {
    signIn: '▶ Press start',
    signUp: '▶ Create account',
    confirm: '▶ Verify email',
    forgot: 'Send reset code',
    forgotConfirm: 'Set new password',
  };
  const handler: Record<Mode, (e: FormEvent) => void> = {
    signIn: doSignIn, signUp: doSignUp, confirm: doConfirm, forgot: doForgot, forgotConfirm: doForgotConfirm,
  };

  return (
    <div className="pb-8">
      <div className="mx-auto mb-6 mt-6 max-w-180 text-center">
        <div className="flex justify-center"><Logo size="lg" /></div>
        <p className="mt-2.5 text-muted">Two real places in Pune. Small choices. See exactly what they add up to.</p>
      </div>

      <form className="px-frame mx-auto grid max-w-105 gap-3.5 bg-panel p-3.5" onSubmit={handler[mode]} noValidate={false}>
        {(mode === 'signIn' || mode === 'signUp') && (
          <div className="flex gap-1.5" role="tablist" aria-label="Account">
            {(['signIn', 'signUp'] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m}
                className={`btn flex-1 text-[17px] ${mode === m ? 'btn-primary' : ''}`} onClick={() => go(m)}>
                {m === 'signIn' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
        )}
        {mode === 'confirm' && <h2 className="text-[13px]">Verify your email</h2>}
        {mode === 'forgot' && <h2 className="text-[13px]">Reset your password</h2>}
        {mode === 'forgotConfirm' && <h2 className="text-[13px]">Choose a new password</h2>}

        {notice && <p className="m-0 text-river" role="status">{notice}</p>}

        {mode !== 'confirm' && mode !== 'forgotConfirm' && emailField}
        {mode === 'signIn' && passwordField('Password', 'current-password')}
        {mode === 'signUp' && passwordField('Password', 'new-password')}
        {(mode === 'confirm' || mode === 'forgotConfirm') && codeField}
        {mode === 'forgotConfirm' && passwordField('New password', 'new-password')}
        {(mode === 'signUp' || mode === 'forgotConfirm') && <p className="m-0 text-[16px] text-muted">{PASSWORD_HINT}</p>}

        {error && <p className="m-0 text-bad" role="alert">{error}</p>}

        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Please wait…' : submitLabel[mode]}</button>

        <div className="flex flex-wrap justify-between gap-2 text-[17px]">
          {mode === 'signIn' && <button type="button" className="text-river underline" onClick={() => go('forgot')}>Forgot password?</button>}
          {mode === 'confirm' && (
            <button type="button" className="text-river underline" disabled={busy}
              onClick={async () => {
                setError(null);
                try { await resendSignUpCode({ username: email.trim() }); setNotice(`We sent a new code to ${email.trim()}.`); }
                catch (err) { setError(friendly(err)); }
              }}>
              Send a new code
            </button>
          )}
          {mode !== 'signIn' && mode !== 'signUp' && <button type="button" className="text-river underline" onClick={() => go('signIn')}>Back to sign in</button>}
        </div>

        <p className="m-0 text-center text-[16px] text-muted">Secured by Amazon Cognito.</p>
      </form>
    </div>
  );
}
