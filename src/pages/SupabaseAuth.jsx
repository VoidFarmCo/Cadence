// /supabase-auth — proof-of-life for the new Supabase stack.
//
// Standalone page (not inside <ProtectedRoute>) that exercises the full
// new auth + tenancy round-trip. Imported eagerly from App.jsx (was lazy,
// but the lazy chunk failed silently in prod — see App.jsx note).
//
// Includes a deliberately visible debug header at the top so we can tell at
// a glance whether the page actually rendered, regardless of dark-mode
// rendering quirks. Wrapped in a tiny ErrorBoundary so render-time errors
// surface inline instead of producing a blank page.
import { Component, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppProvider, useApp } from '@/lib/AppContext';
import {
  signUpWithEmail,
  signInWithEmail,
  sendPasswordReset,
  signOut,
  isSupabaseConfigured,
} from '@/lib/supabase';

function Card({ children, title }) {
  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
      {title && <h2 className="text-xl font-semibold mb-4">{title}</h2>}
      {children}
    </div>
  );
}

function NotConfigured() {
  return (
    <Card title="Supabase env vars not set">
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
        This page needs <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">VITE_SUPABASE_URL</code> and{' '}
        <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">VITE_SUPABASE_ANON_KEY</code> set in the deploy environment.
      </p>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
        See <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">.env.example</code> in the repo. For Vercel, set them under Project Settings → Environment Variables.
      </p>
      <p className="text-xs text-slate-500">
        The legacy <code>/login</code> route still works if you only need the Express+Prisma backend.
      </p>
    </Card>
  );
}

function SignedOut() {
  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true); setErr(null); setInfo(null);
    try {
      if (tab === 'signup') {
        await signUpWithEmail({ email, password, fullName });
        setInfo('Check your email for a confirmation link, then sign in. (You can disable email confirmation in the Supabase dashboard → Authentication → Sign-In/Up.)');
      } else {
        await signInWithEmail({ email, password });
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onForgot() {
    if (!email) { setErr('Enter your email first.'); return; }
    setBusy(true); setErr(null); setInfo(null);
    try {
      await sendPasswordReset(email);
      setInfo('Password reset email sent.');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Cadence — Supabase auth (preview)">
      <div className="flex gap-2 mb-4 text-sm">
        <button
          type="button"
          onClick={() => setTab('signin')}
          className={`px-3 py-1.5 rounded ${tab==='signin' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
        >Sign in</button>
        <button
          type="button"
          onClick={() => setTab('signup')}
          className={`px-3 py-1.5 rounded ${tab==='signup' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}
        >Sign up</button>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {tab === 'signup' && (
          <input
            className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded p-2 text-sm"
            placeholder="Full name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            autoComplete="name"
          />
        )}
        <input
          className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded p-2 text-sm"
          type="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <input
          className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded p-2 text-sm"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
          required
          minLength={6}
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-slate-900 text-white rounded p-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? '…' : tab === 'signup' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <button
        type="button"
        onClick={onForgot}
        disabled={busy}
        className="text-xs text-slate-500 mt-3 hover:underline disabled:opacity-50"
      >Forgot password?</button>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      {info && <p className="mt-3 text-sm text-emerald-600">{info}</p>}

      <p className="mt-6 text-xs text-slate-500 leading-relaxed">
        This is the new Supabase-backed auth, exercised end-to-end as a preview. The legacy{' '}
        <Link to="/login" className="underline">/login</Link> page still works for the Express+Prisma backend.
      </p>
    </Card>
  );
}

function SignedIn() {
  const {
    user, companies, currentCompany, currentCompanyId,
    setCurrentCompany, createCompany, leaveCompany,
    myWorkerProfile, companyLoading, error,
  } = useApp();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await createCompany(name.trim());
      setName('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    try { await signOut(); } catch (e) { console.error(e); }
  }

  async function onLeave(id) {
    try { await leaveCompany(id); }
    catch (e) { setErr(e.message || String(e)); }
  }

  return (
    <Card title={`Signed in as ${user?.email}`}>
      <div className="space-y-4 text-sm">
        <section>
          <h3 className="font-medium mb-2">Your companies ({companies.length})</h3>
          {companyLoading && <p className="text-slate-500">Loading…</p>}
          {!companyLoading && companies.length === 0 && (
            <p className="text-slate-500">You aren't in any companies yet. Create one below.</p>
          )}
          {companies.length > 0 && (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded border border-slate-200 dark:border-slate-700">
              {companies.map(c => (
                <li key={c.id} className="p-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentCompany(c.id)}
                    className={`text-left flex-1 ${currentCompanyId === c.id ? 'font-semibold' : ''}`}
                  >
                    {c.name}{' '}
                    <span className="text-xs text-slate-500">({c.role})</span>
                  </button>
                  {c.role !== 'owner' && (
                    <button
                      type="button"
                      onClick={() => onLeave(c.id)}
                      className="text-xs text-red-600 hover:underline"
                    >Leave</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={onCreate} className="flex gap-2">
          <input
            className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 rounded p-2 text-sm"
            placeholder="New company name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="bg-slate-900 text-white rounded px-3 text-sm font-medium disabled:opacity-50"
          >{busy ? '…' : 'Create'}</button>
        </form>

        {currentCompany && (
          <section className="bg-slate-50 dark:bg-slate-800 rounded p-3">
            <div className="font-medium">{currentCompany.name}</div>
            <div className="text-xs text-slate-500">role: {currentCompany.role} · state: {currentCompany.state}</div>
            <div className="text-xs text-slate-500 mt-1">
              {myWorkerProfile
                ? `worker_profile: ${myWorkerProfile.full_name}`
                : 'no worker_profile in this company yet'}
            </div>
          </section>
        )}

        {error && <p className="text-red-600 text-xs">{String(error.message || error)}</p>}
        {err && <p className="text-red-600 text-xs">{err}</p>}

        <button
          type="button"
          onClick={onSignOut}
          className="text-sm text-slate-500 hover:underline"
        >Sign out</button>
      </div>
    </Card>
  );
}

// Replaces the previous tiny FullScreenSpinner so a stuck `authLoading`
// state shows a clearly-visible message instead of an invisible spinner on
// a dark phone screen.
function LoadingCard() {
  return (
    <Card title="Loading session…">
      <p className="text-sm text-slate-500">
        Checking Supabase auth state. Usually instant; if this stays for more than a few
        seconds the Supabase URL or key may be wrong.
      </p>
    </Card>
  );
}

function Inner() {
  const { authLoading, session } = useApp();
  if (authLoading) return <LoadingCard />;
  return session ? <SignedIn /> : <SignedOut />;
}

// True when the visitor has explicitly opted in to seeing internal stack
// traces via `?debug=1` in the URL. Lets us debug live prod issues without
// surfacing internal file paths / module names to every visitor.
function wantsDebug() {
  if (typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

// Catch render-time errors anywhere in the page so they surface inline
// instead of producing a blank screen with no console access on mobile.
//
// The error MESSAGE is always shown (a real failure must be debuggable), but
// the full STACK is gated behind `import.meta.env.DEV` or `?debug=1` so
// production visitors don't see internal paths and module structure.
class DebugErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[supabase-auth] render error', error, info);
  }
  render() {
    if (this.state.error) {
      const e = this.state.error;
      const showStack = import.meta.env.DEV || wantsDebug();
      return (
        <div className="min-h-screen bg-red-50 dark:bg-red-950 py-12 px-4">
          <Card title="Page error">
            <p className="text-sm text-red-700 dark:text-red-300 mb-2 font-medium">
              {e.message || String(e)}
            </p>
            {showStack && e.stack ? (
              <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-800 rounded p-2 max-h-96 overflow-auto">
                {e.stack}
              </pre>
            ) : (
              <p className="text-xs text-slate-500">
                Add <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">?debug=1</code> to the URL to see the stack trace.
              </p>
            )}
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SupabaseAuth() {
  return (
    <DebugErrorBoundary>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
        {/* Visible breadcrumb so we can confirm the page rendered at all */}
        <p className="text-center mb-6 text-sm font-mono text-emerald-600 dark:text-emerald-400">
          /supabase-auth loaded · configured: {String(isSupabaseConfigured)}
        </p>

        {!isSupabaseConfigured ? (
          <NotConfigured />
        ) : (
          <AppProvider>
            <Inner />
          </AppProvider>
        )}

        <p className="text-center text-xs text-slate-500 mt-6">
          <Link to="/" className="hover:underline">← Back to home</Link>
        </p>
      </div>
    </DebugErrorBoundary>
  );
}
