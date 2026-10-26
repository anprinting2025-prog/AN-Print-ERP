import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { UserProfile, UserRole } from '../types/erp.ts';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
  authModalMode: 'login' | 'signup';
  setAuthModalMode: (mode: 'login' | 'signup') => void;
  openAuthModal: (mode?: 'login' | 'signup') => void;
  loginWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string; isPending?: boolean }>;
  submitSignupRequest: (data: {
    email: string;
    fullName: string;
    password?: string;
    role?: string;
    phone?: string;
    notes?: string;
  }) => Promise<{ success: boolean; message?: string; error?: string }>;
  loginAsDemoOwner: () => Promise<{ success: boolean; error?: string; isPending?: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  // Helper to ensure profile and its permissions are properly parsed
  const normalizeProfile = (data: any): UserProfile => {
    if (!data) return data;
    let perms = data.permissions;
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms);
      } catch {
        perms = [];
      }
    }
    if (!Array.isArray(perms)) {
      perms = data.role === 'owner' || data.role === 'admin'
        ? ['all']
        : ['orders', 'customers', 'inactive_clients'];
    }
    return {
      ...data,
      permissions: perms,
    };
  };

  // Sync profile from backend
  const fetchProfile = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const rawData = await res.json();
        const data = normalizeProfile(rawData);
        setProfile(data);
        localStorage.setItem('an_printing_profile', JSON.stringify(data));
      } else {
        const fallback: UserProfile = {
          id: user?.uid || 'user-1',
          email: user?.email || 'owner@anprinting.dz',
          fullName: user?.displayName || 'An Printing Owner',
          role: 'owner',
          permissions: ['all'],
          isActive: true,
        };
        setProfile(fallback);
      }
    } catch (err) {
      console.warn('Could not fetch remote profile, using fallback:', err);
    }
  };

  useEffect(() => {
    // Check saved credentials in localStorage first
    const savedToken = localStorage.getItem('an_printing_token');
    const savedProfileStr = localStorage.getItem('an_printing_profile');

    if (savedToken && savedProfileStr) {
      try {
        const parsed = JSON.parse(savedProfileStr);
        setToken(savedToken);
        setProfile(normalizeProfile(parsed));
        setLoading(false);
        // Silently validate and refresh in background
        fetchProfile(savedToken).catch(() => {});
      } catch {
        // Fall through to firebase listener
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const idToken = await currentUser.getIdToken();
          setToken(idToken);
          localStorage.setItem('an_printing_token', idToken);
          await fetchProfile(idToken);
        } catch (e) {
          console.error('Error fetching token:', e);
        }
      } else if (!savedToken) {
        // User is not logged in: they will face the login page
        setToken(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithCredentials = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Authentication failed', isPending: data.isPending };
      }

      const normalized = normalizeProfile(data.profile);
      setToken(data.token);
      setProfile(normalized);
      localStorage.setItem('an_printing_token', data.token);
      localStorage.setItem('an_printing_profile', JSON.stringify(normalized));
      setShowAuthModal(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const submitSignupRequest = async (data: {
    email: string;
    fullName: string;
    password?: string;
    role?: string;
    phone?: string;
    notes?: string;
  }) => {
    try {
      const res = await fetch('/api/auth/signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        return { success: false, error: result.error || 'Failed to submit signup request' };
      }
      return { success: true, message: result.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup request error' };
    }
  };

  const loginAsDemoOwner = async () => {
    return loginWithCredentials('abdallahcrypto036@gmail.com', 'abdou2003');
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const res = await signInWithPopup(auth, googleAuthProvider);
      setUser(res.user);
      const idToken = await res.user.getIdToken();
      setToken(idToken);
      localStorage.setItem('an_printing_token', idToken);
      await fetchProfile(idToken);
      setShowAuthModal(false);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth).catch(() => {});
      setUser(null);
      setProfile(null);
      setToken(null);
      localStorage.removeItem('an_printing_token');
      localStorage.removeItem('an_printing_profile');
      setShowAuthModal(false);
    } catch (err) {
      console.error('Sign Out failed:', err);
    }
  };

  const refreshProfile = async () => {
    if (token) {
      await fetchProfile(token);
    }
  };

  const switchRole = async (newRole: UserRole) => {
    // Security: Only the genuine owner can simulate the Commerciale view
    if (profile && (profile.email === 'abdallahcrypto036@gmail.com' || profile.role === 'owner')) {
      const updated = { ...profile, role: newRole };
      setProfile(updated);
      localStorage.setItem('an_printing_profile', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        token,
        loading,
        isAuthenticated: !!profile,
        showAuthModal,
        setShowAuthModal,
        authModalMode,
        setAuthModalMode,
        openAuthModal,
        loginWithCredentials,
        submitSignupRequest,
        loginAsDemoOwner,
        signInWithGoogle,
        signOut,
        refreshProfile,
        switchRole,
      }}
    >
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
