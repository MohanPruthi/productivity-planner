import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
      setToken(storedToken);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
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
  };

  const signup = async (name, email, password) => {
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
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
  };

  const [privacyMode, setPrivacyMode] = useState(() => localStorage.getItem('privacyMode') === 'true');

  const DEFAULT_WORKSPACE_VISIBILITY = {
    dashboard: { showInOffice: true, showOnDashboard: true },
    aiPlan: { showInOffice: true, showOnDashboard: true },
    sdPlan: { showInOffice: true, showOnDashboard: true },
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
        return { ...DEFAULT_WORKSPACE_VISIBILITY, ...normalized };
      }
      return DEFAULT_WORKSPACE_VISIBILITY;
    } catch {
      return DEFAULT_WORKSPACE_VISIBILITY;
    }
  });

  const updateWorkspaceVisibility = (systemKey, updates) => {
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
  };

  const togglePrivacyMode = () => {
    setPrivacyMode(prev => {
      const nextVal = !prev;
      localStorage.setItem('privacyMode', String(nextVal));
      return nextVal;
    });
  };

  const getAuthHeaders = () => {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  return (
    <AuthContext.Provider value={{ 
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
      updateWorkspaceVisibility
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
