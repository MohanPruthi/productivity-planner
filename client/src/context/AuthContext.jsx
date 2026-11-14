import React, { createContext, useState, useContext, useLayoutEffect, useCallback, useMemo } from 'react';
import { API_BASE_URL } from '../config';
import { clearQueryCache } from '../lib/queryClient';

const AuthContext = createContext(null);

// The saved session, read synchronously so the first render already has the user
const readStoredSession = () => {
  try {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) return { user: JSON.parse(storedUser), token: storedToken };
  } catch {
    /* unreadable session: start signed out */
  }
  return { user: null, token: null };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => readStoredSession().user);
  const [token, setToken] = useState(() => readStoredSession().token);
  // Kept for consumers; the session is known before the first render, so never loading
  const [loading] = useState(false);

  const login = useCallback(async (email, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setToken(data.token);
      return data.user;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, []);

  const signup = useCallback(async (name, email, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Signup failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setToken(data.token);
      return data.user;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Cached pages belong to this account: drop them (memory and localStorage)
    clearQueryCache();
    setUser(null);
    setToken(null);
  }, []);

  // The server answers 403 only for an invalid/expired token: sign out instead of showing broken pages.
  // A layout effect, so it is in place before the pages' own effects make their first requests.
  useLayoutEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 403 && localStorage.getItem('token')) {
        logout();
      }
      return res;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('privacyMode') === 'true');

  const DEFAULT_WORKSPACE_VISIBILITY = {
    dashboard: { showInOffice: true, showOnDashboard: true },
    plans: { showInOffice: true, showOnDashboard: true },
    dsaLog: { showInOffice: false, showOnDashboard: false },
    taskHistory: { showInOffice: true, showOnDashboard: true },
    meds: { showInOffice: true, showOnDashboard: true },
    hrDirectory: { showInOffice: false, showOnDashboard: true },
    notes: { showInOffice: true, showOnDashboard: false },
  };

  const [workspaceVisibility, setWorkspaceVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem('workspaceVisibilityConfig');
      if (saved) {
        const parsed = JSON.parse(saved);
        const normalized = {};
        for (const [key, val] of Object.entries(parsed)) {
          normalized[key] = {
            ...val,
            showOnDashboard: val.showOnDashboard !== undefined 
              ? val.showOnDashboard 
              : (val.hideFromDashboard !== undefined ? !val.hideFromDashboard : true)
          };
        }
        // AI and SD plans were merged into Plans: carry the AI plan's settings over once
        if (!normalized.plans && normalized.aiPlan) {
          normalized.plans = normalized.aiPlan;
        }
        return { ...DEFAULT_WORKSPACE_VISIBILITY, ...normalized };
      }
      return DEFAULT_WORKSPACE_VISIBILITY;
    } catch {
      return DEFAULT_WORKSPACE_VISIBILITY;
    }
  });

  const updateWorkspaceVisibility = useCallback((systemKey, updates) => {
    setWorkspaceVisibility(prev => {
      const updated = {
        ...prev,
        [systemKey]: {
          ...(prev[systemKey] || {}),
          ...updates
        }
      };
      localStorage.setItem('workspaceVisibilityConfig', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const togglePrivacyMode = useCallback(() => {
    setPrivacyMode(prev => {
      const nextVal = !prev;
      localStorage.setItem('privacyMode', String(nextVal));
      return nextVal;
    });
  }, []);

  const getAuthHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }, [token]);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    login,
    signup,
    logout,
    getAuthHeaders,
    privacyMode,
    togglePrivacyMode,
    workspaceVisibility,
    updateWorkspaceVisibility,
  }), [user, token, loading, login, signup, logout, getAuthHeaders, privacyMode, togglePrivacyMode, workspaceVisibility, updateWorkspaceVisibility]);

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
