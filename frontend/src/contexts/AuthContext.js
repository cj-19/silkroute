import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Jeton court terme garde en memoire uniquement (jamais persiste) : sert
  // exclusivement au handshake Socket.IO, qui ne peut pas lire le cookie httpOnly.
  const [wsToken, setWsToken] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      const { ws_token, ...userData } = response.data;
      setUser(userData);
      setWsToken(ws_token || null);
    } catch (error) {
      setUser(null);
      setWsToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { user: userData } = response.data;
    setUser(userData);
    // Recupere le ws_token via /auth/me (le cookie httpOnly vient d'etre pose par /auth/login)
    await checkAuth();
    return userData;
  };

  const register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    const { user: newUser } = response.data;
    setUser(newUser);
    await checkAuth();
    return newUser;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
    setWsToken(null);
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  const value = {
    user,
    wsToken,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
