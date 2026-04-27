import { useEffect } from 'react';
import { useAuthStore } from '@/stores';
import { api } from '@/services';

export function useAuth() {
  const { setUser, setSession, setLoading, logout, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const init = async () => {
      try {
        const user = await api.auth.me();
        setUser(user);
      } catch {
        // Not logged in
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [setUser, setLoading]);

  const login = async (email: string, password: string) => {
    const { user, session } = await api.auth.login(email, password);
    setUser(user);
    setSession(session);
    return user;
  };

  const signup = async (name: string, email: string, password: string) => {
    const { user, session } = await api.auth.signup(name, email, password);
    setUser(user);
    setSession(session);
    return user;
  };

  const doLogout = async () => {
    await api.auth.logout();
    logout();
  };

  return { login, signup, logout: doLogout, isAuthenticated };
}
