import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Mail, Phone, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AppScreen, UserProfile } from '../types';

interface AuthViewProps {
  onSuccess: (screen: AppScreen) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onSuccess }) => {
  const { setSession, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'host' | 'co_host' | 'participant'>('host');
  const [showPassword, setShowPassword] = useState(false);

  // Password recovery state
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>('request');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      onSuccess('dashboard');
    } catch (err: any) {
      setError(err?.message || 'Google Sign-In failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: UserProfile;
        error?: string;
      };
      if (!res.ok || !data.token || !data.user) {
        throw new Error(data.error || 'Sign in failed.');
      }
      setSession(data.token, data.user);
      onSuccess('dashboard');
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, mobile, password, role }),
      });
      const data = (await res.json()) as {
        token?: string;
        user?: UserProfile;
        error?: string;
      };
      if (!res.ok || !data.token || !data.user) {
        throw new Error(data.error || 'Registration failed.');
      }
      setSession(data.token, data.user);
      onSuccess('dashboard');
    } catch (err: any) {
      setError(err?.message || 'Unable to register account.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRecoveryNotice(null);
    setBusy(true);
    try {
      if (recoveryStep === 'request') {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = (await res.json()) as {
          message?: string;
          recoveryCodePreview?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Request failed.');
        setRecoveryNotice(
          data.recoveryCodePreview
            ? `${data.message} Recovery code: ${data.recoveryCodePreview}`
            : data.message || 'Check your email for the 6-digit recovery code.'
        );
        setRecoveryStep('reset');
      } else {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, resetCode, newPassword }),
        });
        const data = (await res.json()) as { message?: string; error?: string };
        if (!res.ok) throw new Error(data.error || 'Reset failed.');
        setRecoveryNotice(data.message || 'Password updated.');
        setMode('login');
        setRecoveryStep('request');
        setPassword('');
      }
    } catch (err: any) {
      setError(err?.message || 'Password recovery failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {mode === 'login'
              ? 'Sign in to Pinnacle Meet'
              : mode === 'signup'
                ? 'Create your account'
                : 'Recover your password'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {mode === 'login'
              ? 'Access scheduled meetings, classrooms, and cloud recordings.'
              : mode === 'signup'
                ? 'Start hosting HD video calls and interactive sessions.'
                : 'Reset your password using a 6-digit verification code.'}
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="mt-6 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'signup'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setError(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'forgot'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Recover
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {recoveryNotice && (
          <div className="mt-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-800 dark:text-blue-200 font-mono">
            {recoveryNotice}
          </div>
        )}

        {mode !== 'forgot' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignIn}
              className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span>or with email</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>
          </>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@organization.com"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-10 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="aarav@company.in"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Default Role
                </label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as 'host' | 'co_host' | 'participant')
                  }
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="host">Host / Educator</option>
                  <option value="co_host">Co-host</option>
                  <option value="participant">Participant / Student</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Account Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organization.com"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            {recoveryStep === 'reset' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    6-Digit Recovery Code
                  </label>
                  <input
                    type="text"
                    required
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy
                ? 'Processing...'
                : recoveryStep === 'request'
                  ? 'Generate Recovery Code'
                  : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
