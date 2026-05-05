// AppContext: Supabase-backed session + company switcher.
//
// Mirrors WorkHub's src/lib/AppContext.jsx pattern but scoped to what Cadence
// needs at this stage: auth session, the user's companies, and the active
// company. Per-company entity lists (punches, time_entries, etc.) are NOT
// preloaded here yet — pages can call the entity helpers in src/lib/db.js
// directly via React Query (already a dep) for now, and we can move shared
// data into this context later if it becomes a bottleneck.
//
// Coexists with the legacy src/lib/AuthContext.jsx (custom JWT) during the
// migration. The legacy file will be removed at cutover.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  listMyCompanies,
  createCompany as dbCreateCompany,
  leaveCompany as dbLeaveCompany,
  getMyWorkerProfile as dbGetMyWorkerProfile,
} from './db';

const AppContext = createContext(null);
const CURRENT_COMPANY_KEY = 'cadence.currentCompanyId';

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [companies, setCompanies] = useState([]);
  const [currentCompanyId, setCurrentCompanyIdState] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [myWorkerProfile, setMyWorkerProfile] = useState(null);

  const [error, setError] = useState(null);

  // 1. Subscribe to Supabase auth state.
  useEffect(() => {
    let mounted = true;
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return () => { mounted = false; };
    }
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session ?? null);
        setAuthLoading(false);
      })
      .catch(e => {
        if (!mounted) return;
        // Failure here is usually a misconfigured URL/key. Surface via error
        // state so the page can show a friendly message rather than spinning.
        console.warn('supabase.auth.getSession failed:', e);
        setError(e);
        setAuthLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // 2. Persist the active company across reloads.
  const setCurrentCompany = useCallback((id) => {
    try {
      if (id) localStorage.setItem(CURRENT_COMPANY_KEY, id);
      else    localStorage.removeItem(CURRENT_COMPANY_KEY);
    } catch { /* private mode */ }
    setCurrentCompanyIdState(id);
  }, []);

  // 3. Load the user's companies after sign-in.
  const refreshCompanies = useCallback(async () => {
    setCompanyLoading(true);
    setError(null);
    try {
      const cs = await listMyCompanies();
      setCompanies(cs);
      let stored = null;
      try { stored = localStorage.getItem(CURRENT_COMPANY_KEY); } catch { /* private mode */ }
      const isValid = stored && cs.find(c => c.id === stored);
      const next = isValid ? stored : (cs[0]?.id || null);
      setCurrentCompany(next);
      return cs;
    } catch (e) {
      console.error('listMyCompanies failed', e);
      setError(e);
      return [];
    } finally {
      setCompanyLoading(false);
    }
  }, [setCurrentCompany]);

  useEffect(() => {
    if (session) {
      refreshCompanies();
    } else {
      setCompanies([]);
      setCurrentCompany(null);
      setMyWorkerProfile(null);
    }
  }, [session, refreshCompanies, setCurrentCompany]);

  // 4. Whenever the active company changes, fetch the caller's worker_profile
  //    in that company (if any). Workers' punch/time-entry pages need this.
  useEffect(() => {
    let cancelled = false;
    if (!session || !currentCompanyId) {
      setMyWorkerProfile(null);
      return () => {};
    }
    dbGetMyWorkerProfile(currentCompanyId)
      .then(wp => { if (!cancelled) setMyWorkerProfile(wp); })
      .catch(e => { if (!cancelled) { console.error('getMyWorkerProfile failed', e); setMyWorkerProfile(null); } });
    return () => { cancelled = true; };
  }, [session, currentCompanyId]);

  // ----- Mutations ---------------------------------------------------------
  const createCompany = useCallback(async (name, state = 'NM') => {
    const newId = await dbCreateCompany(name, state);
    await refreshCompanies();
    setCurrentCompany(newId);
    return newId;
  }, [refreshCompanies, setCurrentCompany]);

  const leaveCompany = useCallback(async (id) => {
    const remaining = companies.filter(c => c.id !== id);
    setCompanies(remaining);
    if (currentCompanyId === id) setCurrentCompany(remaining[0]?.id || null);
    try { await dbLeaveCompany(id); }
    catch (e) { refreshCompanies(); throw e; }
  }, [companies, currentCompanyId, refreshCompanies, setCurrentCompany]);

  // ----- Derived -----------------------------------------------------------
  const currentCompany    = companies.find(c => c.id === currentCompanyId) || null;
  const currentMembership = currentCompany;  // role + state live on the same record

  const value = {
    session,
    user: session?.user || null,
    authLoading,
    isSupabaseConfigured,

    companies,
    currentCompanyId,
    currentCompany,
    currentMembership,
    companyLoading,

    myWorkerProfile,

    error,

    setCurrentCompany,
    refreshCompanies,
    createCompany,
    leaveCompany,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
