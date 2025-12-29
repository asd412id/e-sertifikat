import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

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
  const [ssoIdentities, setSsoIdentities] = useState([]);

  const fetchSsoIdentities = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setSsoIdentities([]);
      return;
    }
    
    try {
      const response = await api.get('/auth/sso/identities');
      setSsoIdentities(response.data.data.identities || []);
    } catch (err) {
      console.log('Failed to fetch SSO identities:', err.message);
      setSsoIdentities([]);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      setUser(JSON.parse(userData));
      // Fetch SSO identities if logged in
      fetchSsoIdentities();
    }
    setLoading(false);
  }, [fetchSsoIdentities]);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, token } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      
      // Fetch SSO identities after login
      fetchSsoIdentities();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  /**
   * Login with SSO token (called from SsoCallback)
   */
  const loginWithToken = async (token) => {
    try {
      localStorage.setItem('token', token);
      
      // Fetch user profile with new token
      const profileResponse = await api.get('/auth/profile');
      const user = profileResponse.data.data.user;

      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);
      
      // Fetch SSO identities
      fetchSsoIdentities();

      return { success: true, user };
    } catch (error) {
      localStorage.removeItem('token');
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to authenticate'
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const { user, token } = response.data.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setSsoIdentities([]);
  };

  const updateUser = (updatedUser) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const isAuthenticated = () => {
    return !!user && !!localStorage.getItem('token');
  };

  /**
   * Link SSO identity to current user
   */
  const linkSsoIdentity = async (code, state, provider) => {
    try {
      const response = await api.post('/auth/sso/link', { code, state, provider });
      await fetchSsoIdentities(); // Refresh identities
      return { success: true, data: response.data.data };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to link SSO identity'
      };
    }
  };

  /**
   * Unlink SSO identity from current user
   */
  const unlinkSsoIdentity = async (provider) => {
    try {
      await api.delete(`/auth/sso/link/${provider}`);
      await fetchSsoIdentities(); // Refresh identities
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Failed to unlink SSO identity'
      };
    }
  };

  const value = {
    user,
    login,
    loginWithToken,
    register,
    logout,
    updateUser,
    isAuthenticated,
    loading,
    ssoIdentities,
    fetchSsoIdentities,
    linkSsoIdentity,
    unlinkSsoIdentity
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
