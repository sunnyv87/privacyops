import { create } from 'zustand';
import { api } from '@/lib/api';

interface AuthState {
  token: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;
    roles: string[];
  } | null;
  isAuthenticated: boolean;
  setToken: (token: string) => void;
  setUser: (user: AuthState['user']) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  setToken: (token) => {
    api.setToken(token);
    set({ token, isAuthenticated: true });
  },
  setUser: (user) => set({ user }),
  logout: () => {
    api.setToken('');
    set({ token: null, user: null, isAuthenticated: false });
  },
}));
