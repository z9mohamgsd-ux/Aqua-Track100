import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface AuthUser {
  id: number;
  email: string;
  role: 'owner' | 'admin' | 'user';
  status: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  applyToken: (token: string, user: AuthUser) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyToken = (t: string, u: AuthUser) => {
    localStorage.setItem('aquatrack_token', t);
    setToken(t);
    setUser(u);
  };

  // Handle Google OAuth callback — token comes back in ?auth_token= URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authToken = params.get('auth_token');
    const authError = params.get('auth_error');

    if (authToken) {
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.setItem('aquatrack_token', authToken);
      setToken(authToken);
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${authToken}` } })
        .then((r) => r.json())
        .then((data) => { if (data.success) setUser(data.user); })
        .catch(() => {})
        .finally(() => setLoading(false));
      return;
    }

    if (authError) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    const stored = localStorage.getItem('aquatrack_token');
    if (stored) {
      setToken(stored);
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${stored}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setUser(data.user);
          else {
            localStorage.removeItem('aquatrack_token');
            setToken(null);
          }
        })
        .catch(() => {
          localStorage.removeItem('aquatrack_token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Login failed');
    applyToken(data.token, data.user);
  };

  const logout = () => {
    localStorage.removeItem('aquatrack_token');
    setToken(null);
    setUser(null);
  };

  // Global 401 handler
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        const url = typeof args[0] === 'string' ? args[0] : '';
        if (!url.includes('/api/auth/')) logout();
      }
      return res;
    };
    return () => { window.fetch = originalFetch; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, applyToken, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
