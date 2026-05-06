// Supabase client + auth helpers for Cadence.
//
// This is the new auth/data path replacing the custom JWT/Express backend in
// backend/src/routes/auth. During the migration it lives alongside the legacy
// src/api/apiClient.js + src/lib/AuthContext.jsx, which read VITE_API_URL and
// will be removed at cutover.
//
// Module-load is graceful: if VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are
// missing, this still exports a client (with placeholder values), and pages
// can check `isSupabaseConfigured` before showing UI that depends on it. That
// way an unconfigured deploy still loads — only the Supabase-aware pages
// degrade to a friendly "set env vars" message.
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(url && anonKey);

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are not set. ' +
    'See .env.example. The Supabase client will fail at request time.'
  );
}

export const supabase = createClient(
  url     || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// ---------------------------------------------------------------------------
// Email + password auth
// ---------------------------------------------------------------------------

export async function signUpWithEmail({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: window.location.origin + '/supabase-auth',
      data: fullName ? { full_name: fullName, name: fullName } : undefined,
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: window.location.origin + '/supabase-auth' }
  );
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
