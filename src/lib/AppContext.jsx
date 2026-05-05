// Cadence app context: Supabase Auth session + the user's currently-selected
// company. Wraps the DB calls in src/lib/db.js so pages get reactive state
// for the things that change as the user signs in / switches companies.
//
// The legacy src/lib/AuthContext.jsx (custom-JWT) stays in place during the
// migration. Pages get ported to <AppProvider> + useApp() one at a time.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import {
  listMyCompanies,
  createCompany as dbCreateCompany,
  leaveCompany as dbLeaveCompany,
  getMyWorkerProfile,
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

  // Subscribe to Supabase Auth.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setAuthLoading(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const setCurrentCompany = useCallback((id) => {
    if (id) {
      try { localStorage.setItem(CURRENT_COMPANY_KEY, id); } catch { /* private mode */ }
    } else {
      try { localStorage.removeItem(CURRENT_COMPANY_KEY); } catch { /* private mode */ }
    }
    setCurrentCompanyIdState(id);
  }, []);

  // Load the user's companies and pick a current one.
  const refreshCompanies = useCallback(async () => {
    setCompanyLoading(true);
    setError(null);
    try {
      const cs = await listMyCompanies();
      setCompanies(cs);
      const stored = (() => {
        try { return localStorage.getItem(CURRENT_COMPANY_KEY); } catch { return null; }
      })();
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

  // Re-load companies on sign-in / clear on sign-out.
  useEffect(() => {
    if (session) {
      refreshCompanies();
    } else {
      setCompanies([]);
      setCurrentCompany(null);
      setMyWorkerProfile(null);
    }
  }, [session, refreshCompanies, setCurrentCompany]);

  // Re-load this user's worker_profile whenever they switch companies.
  useEffect(() => {
    let cancelled = false;
    if (!session || !currentCompanyId) {
      setMyWorkerProfile(null);
      return;
    }
    getMyWorkerProfile(currentCompanyId)
      .then(wp => { if (!cancelled) setMyWorkerProfile(wp); })
      .catch(e => {
        if (!cancelled) {
          console.error('getMyWorkerProfile failed', e);
          setMyWorkerProfile(null);
        }
      });
    return () => { cancelled = true; };
  }, [session, currentCompanyId]);

  // ----- Mutations -------------------------------------------------------
  const createCompany = async (name, state) => {
    const newId = await dbCreateCompany(name, state);
    await refreshCompanies();
    setCurrentCompany(newId);
    return newId;
  };

  const leaveCompany = async (id) => {
    const remaining = companies.filter(c => c.id !== id);
    setCompanies(remaining);
    if (currentCompanyId === id) setCurrentCompany(remaining[0]?.id || null);
    try {
      await dbLeaveCompany(id);
    } catch (e) {
      refreshCompanies();
      throw e;
    }
  };

  const currentMembership = companies.find(c => c.id === currentCompanyId) || null;
  const value = {
    // Auth
    session,
    user: session?.user || null,
    authLoading,

    // Companies
    companies,
    currentCompanyId,
    currentCompany: currentMembership,
    currentRole: currentMembership?.role || null,
    companyLoading,
    setCurrentCompany,
    refreshCompanies,
    createCompany,
    leaveCompany,

    // The signed-in user's worker_profile in the current company (or null).
    myWorkerProfile,

    error,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
