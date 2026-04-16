import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '@/api/apiClient';
import { setTokens, clearTokens, hasTokens } from '@/utils/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      setAuthError(null);
      // Only attempt auth check if we have tokens stored
      if (!hasTokens()) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }
      const { data } = await api.get('/api/auth/me');
      setUser(data);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
      if (error.response?.status === 401 || error.response?.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        setAuthError({ type: 'unknown', message: error.message || 'Auth check failed' });
      }
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = async (email, password) => {
    const { data } = await api.post('/api/auth/login', { email, password });
    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
    }
    setUser(data.user);
    setIsAuthenticated(true);
    setAuthError(null);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post('/api/auth/register', payload);
    if (data.accessToken && data.refreshToken) {
      setTokens(data.accessToken, data.refreshToken);
    }
    setUser(data.user);
    setIsAuthenticated(true);
    setAuthError(null);
    return data;
  };

  const logout = async (redirectTo = '/') => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    clearTokens();
    setUser(null);
    setIsAuthenticated(false);
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      login,
      register,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
