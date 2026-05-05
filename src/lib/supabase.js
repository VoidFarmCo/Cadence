// Supabase client + auth helpers for Cadence.
//
// Imported by anything that touches the database, auth, or storage. The old
// custom-JWT auth lives at src/lib/AuthContext.jsx + src/api/apiClient.js and
// stays in place during the incremental migration; pages and hooks can switch
// to this client one at a time.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in .env (see .env.example).'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---------------------------------------------------------------------------
// Email + password auth
// ---------------------------------------------------------------------------

export async function signUpWithEmail({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      emailRedirectTo: window.location.origin,
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
    { redirectTo: window.location.origin }
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
