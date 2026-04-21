import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../utils/supabaseClient';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Dashboard } from './components/Dashboard';
import { ClientPortal } from './components/ClientPortal';

export default function App() {
  const [view, setView] = useState<'login' | 'signup' | 'dashboard' | 'client-portal'>('login');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadToken, setUploadToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for upload token in URL (client portal mode)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('upload');

    if (token) {
      setUploadToken(token);
      setView('client-portal');
      return;
    }

    // Check for existing session
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const supabase = getSupabaseClient();

      const { data } = await supabase.auth.getSession();

      if (data.session) {
        setAccessToken(data.session.access_token);
        setUserId(data.session.user.id);
        setView('dashboard');
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  const handleLogin = (token: string, id: string) => {
    setAccessToken(token);
    setUserId(id);
    setView('dashboard');
  };

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();

      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }

    setAccessToken(null);
    setUserId(null);
    setView('login');
  };

  const handleSignupSuccess = () => {
    setView('login');
  };

  // Client Portal View
  if (view === 'client-portal' && uploadToken) {
    return <ClientPortal uploadToken={uploadToken} />;
  }

  // Login View
  if (view === 'login') {
    return (
      <Login
        onLogin={handleLogin}
        onSwitchToSignup={() => setView('signup')}
      />
    );
  }

  // Signup View
  if (view === 'signup') {
    return (
      <Signup
        onSignupSuccess={handleSignupSuccess}
        onSwitchToLogin={() => setView('login')}
      />
    );
  }

  // Dashboard View
  if (view === 'dashboard' && accessToken) {
    return (
      <Dashboard
        accessToken={accessToken}
        onLogout={handleLogout}
      />
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">LO Accountants</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  );
}