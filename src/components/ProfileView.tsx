import React, { useState } from 'react';
import { Camera, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AppScreen } from '../types';

interface ProfileViewProps {
  onNavigate: (screen: AppScreen) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onNavigate }) => {
  const { user, theme, toggleTheme, authFetch, refreshProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const res = await authFetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile }),
      });
      if (res.ok) {
        await refreshProfile();
        setNotice('Profile saved.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const res = await authFetch('/api/profile/avatar', {
        method: 'POST',
        body: form,
      });
      if (res.ok) {
        await refreshProfile();
        setNotice('Profile photo updated.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-blue-600/15 border border-blue-600/30 flex items-center justify-center font-display text-xl font-bold text-blue-600 dark:text-blue-400">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                user.name.slice(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {user.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {user.email} · {user.role.replace('_', ' ')} ·{' '}
                {user.plan.toUpperCase()} Plan
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <Camera className="h-4 w-4" />
            <span>{uploading ? 'Uploading...' : 'Change Photo'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>
        </div>

        {notice && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {notice}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Mobile Number
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <div>
              <p className="text-sm font-semibold">Appearance Theme</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Switch between light and dark interface
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => onNavigate('subscription')}
              className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
            >
              Manage Subscription Plan →
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
