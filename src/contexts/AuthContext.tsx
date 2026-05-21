import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { STORAGE_KEYS, API_ENDPOINTS } from '../constants';

// --- Types ---
interface AuthState {
  authToken: string | null;
  requiresAuth: boolean | null;
  isCheckingAuth: boolean;
  capabilities: { upload: boolean };
}

type AuthAction =
  | { type: 'SET_TOKEN'; payload: string | null }
  | { type: 'SET_REQUIRES_AUTH'; payload: boolean }
  | { type: 'SET_CHECKING'; payload: boolean }
  | { type: 'SET_CAPABILITIES'; payload: { upload: boolean } }
  | { type: 'LOGOUT' };

interface AuthContextValue extends AuthState {
  login: (password: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

// --- Reducer ---
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_TOKEN':
      return { ...state, authToken: action.payload };
    case 'SET_REQUIRES_AUTH':
      return { ...state, requiresAuth: action.payload };
    case 'SET_CHECKING':
      return { ...state, isCheckingAuth: action.payload };
    case 'SET_CAPABILITIES':
      return { ...state, capabilities: action.payload };
    case 'LOGOUT':
      return { ...state, authToken: null };
    default:
      return state;
  }
}

// --- Context ---
const AuthContext = createContext<AuthContextValue | null>(null);

// --- Provider ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    authToken: localStorage.getItem(STORAGE_KEYS.AUTH_KEY),
    requiresAuth: null,
    isCheckingAuth: true,
    capabilities: { upload: true },
  });

  const checkAuth = useCallback(async () => {
    dispatch({ type: 'SET_CHECKING', payload: true });
    try {
      const res = await fetch(`${API_ENDPOINTS.STORAGE}?checkAuth=true`);
      const data = await res.json();
      dispatch({ type: 'SET_REQUIRES_AUTH', payload: data.requiresAuth });
      if (data.capabilities) {
        dispatch({ type: 'SET_CAPABILITIES', payload: data.capabilities });
      }
    } catch (e) {
      console.error('Check auth failed:', e);
      dispatch({ type: 'SET_REQUIRES_AUTH', payload: false });
    } finally {
      dispatch({ type: 'SET_CHECKING', payload: false });
    }
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s 超时

      const res = await fetch(API_ENDPOINTS.AUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Login failed:', res.status, errData);
        return false;
      }

      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem(STORAGE_KEYS.AUTH_KEY, data.token);
        dispatch({ type: 'SET_TOKEN', payload: data.token });
        return true;
      }

      console.error('Login response missing token:', data);
      return false;
    } catch (e) {
      if (e.name === 'AbortError') {
        console.error('Login timeout');
      } else {
        console.error('Login error:', e);
      }
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_KEY);
    dispatch({ type: 'LOGOUT' });
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Hook ---
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
