import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AuthConfig, AuthContextType } from '../types/auth.ts';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('retailiq_token') || null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);

  // Fetch public auth config (Google OAuth setup status, origin, etc.)
  const fetchAuthConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/config');
      if (res.ok) {
        const data: AuthConfig = await res.json();
        setAuthConfig(data);
      }
    } catch (err) {
      console.warn('Failed to load auth configuration:', err);
    }
  }, []);

  // Validate existing session on load
  const validateSession = useCallback(async (tokenToVerify?: string) => {
    setIsLoading(true);
    const activeToken = tokenToVerify || token || localStorage.getItem('retailiq_token');

    try {
      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch('/api/auth/me', { headers });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          if (activeToken) {
            setToken(activeToken);
            localStorage.setItem('retailiq_token', activeToken);
          }
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('retailiq_token');
        }
      } else {
        setUser(null);
        setToken(null);
        localStorage.removeItem('retailiq_token');
      }
    } catch (err) {
      console.error('Session validation error:', err);
      setUser(null);
      setToken(null);
      localStorage.removeItem('retailiq_token');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Handle URL auth token (e.g. from Google OAuth callback redirect) and popup postMessage
  useEffect(() => {
    fetchAuthConfig();

    // Listen for postMessage from Google OAuth popup window
    const handleMessage = (event: MessageEvent) => {
      // Validate message structure
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.token) {
        const authToken = event.data.token;
        localStorage.setItem('retailiq_token', authToken);
        setToken(authToken);
        validateSession(authToken);
        setIsLoading(false);
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        setError(event.data.error || 'Google authentication was not completed.');
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);

    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get('auth_token');
    const urlError = searchParams.get('auth_error');

    if (urlError) {
      setError(decodeURIComponent(urlError));
      // Clean up URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (urlToken) {
      localStorage.setItem('retailiq_token', urlToken);
      setToken(urlToken);
      // Clean up URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
      validateSession(urlToken);
    } else {
      validateSession();
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [fetchAuthConfig, validateSession]);

  const login = async (email: string, password: string, rememberMe = false): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMessage = data.message || 'Invalid email or password.';
        setError(errMessage);
        setIsLoading(false);
        return { success: false, error: errMessage };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('retailiq_token', data.token);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Connection error. Please try again.';
      setError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    confirmPassword?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, confirmPassword })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMessage = data.message || 'Failed to create account.';
        setError(errMessage);
        setIsLoading(false);
        return { success: false, error: errMessage };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('retailiq_token', data.token);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Network error during registration.';
      setError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    setError(null);
    setIsLoading(true);

    try {
      const originParam = encodeURIComponent(window.location.origin);
      const res = await fetch(`/api/auth/google/url?origin=${originParam}`);
      const data = await res.json();

      if (!res.ok || !data.success || !data.url) {
        if (data.error === 'google_oauth_not_configured') {
          throw new Error(data.message || 'Google OAuth is not yet configured.');
        }
        throw new Error(data.message || 'Failed to start Google sign-in.');
      }

      // Per iframe security rules: Google OAuth blocks iframe embeds (resulting in 403 error).
      // Open the Google OAuth consent flow in a dedicated popup window.
      const width = 540;
      const height = 660;
      const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
      const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

      const authWindow = window.open(
        data.url,
        'retailiq_google_oauth',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,resizable=yes`
      );

      if (!authWindow || authWindow.closed || typeof authWindow.closed === 'undefined') {
        setIsLoading(false);
        throw new Error('Sign-in popup was blocked by your browser. Please allow popups for RetailIQ.');
      }
    } catch (err: any) {
      setError(err.message || 'Unable to connect to Google authentication service.');
      setIsLoading(false);
      throw err;
    }
  };

  const submitGoogleCredential = async (credential: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/google/credential', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMessage = data.message || 'Google token validation failed.';
        setError(errMessage);
        setIsLoading(false);
        return { success: false, error: errMessage };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem('retailiq_token', data.token);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to complete Google sign-in.';
      setError(msg);
      setIsLoading(false);
      return { success: false, error: msg };
    }
  };

  const requestPasswordReset = async (email: string): Promise<{ success: boolean; message: string; resetToken?: string }> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to submit password reset request.');
      }

      return {
        success: true,
        message: data.message || 'Password reset instructions dispatched.',
        resetToken: data.resetToken
      };
    } catch (err: any) {
      const msg = err.message || 'Network error requesting password reset.';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const confirmPasswordReset = async (
    resetToken: string,
    newPassword: string,
    confirmPassword?: string
  ): Promise<{ success: boolean; message: string }> => {
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword, confirmPassword })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password.');
      }

      return {
        success: true,
        message: data.message || 'Password updated successfully. You may now sign in.'
      };
    } catch (err: any) {
      const msg = err.message || 'Failed to complete password reset.';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const activeToken = token || localStorage.getItem('retailiq_token');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {}
      });
    } catch (err) {
      console.warn('Logout API notification failed, clearing local session');
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('retailiq_token');
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        error,
        authConfig,
        login,
        register,
        loginWithGoogle,
        submitGoogleCredential,
        requestPasswordReset,
        confirmPasswordReset,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
