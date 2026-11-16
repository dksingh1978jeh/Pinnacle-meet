import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AppScreen } from '../types';

interface NavbarProps {
  currentScreen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentScreen, onNavigate }) => {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: Array<{ label: string; screen: AppScreen }> = user
    ? [
        { label: 'Dashboard', screen: 'dashboard' },
        { label: 'Join', screen: 'join-meeting' },
        { label: 'Recordings', screen: 'recordings' },
        { label: 'Plans', screen: 'subscription' },
        ...(user.role === 'super_admin'
          ? [{ label: 'Admin', screen: 'admin' as AppScreen }]
          : [{ label: 'Profile', screen: 'profile' as AppScreen }]),
      ]
    : [
        { label: 'Overview', screen: 'welcome' },
        { label: 'Join', screen: 'join-meeting' },
        { label: 'Plans', screen: 'subscription' },
        { label: 'Sign In', screen: 'auth' },
      ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate(user ? 'dashboard' : 'welcome')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
        >
          Pinnacle Meet
        </button>

        {/* Zone 2: 4-5 Concise Single-Line Text Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
          {navItems.map((item) => {
            const active = currentScreen === item.screen;
            return (
              <button
                key={item.screen}
                type="button"
                onClick={() => onNavigate(item.screen)}
                className={`whitespace-nowrap shrink-0 cursor-pointer py-1 transition-colors border-b-2 ${
                  active
                    ? 'border-blue-600 text-slate-950 dark:text-white font-semibold'
                    : 'border-transparent hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate(user ? 'new-meeting' : 'auth')}
            className="hidden sm:inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            {user ? 'New Meeting' : 'Get Started'}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="inline-flex md:hidden items-center justify-center rounded-lg p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[44px] min-w-[44px]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.screen}
              type="button"
              onClick={() => {
                onNavigate(item.screen);
                setMobileOpen(false);
              }}
              className={`block w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium ${
                currentScreen === item.screen
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onNavigate(user ? 'new-meeting' : 'auth');
              setMobileOpen(false);
            }}
            className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {user ? 'New Meeting' : 'Get Started'}
          </button>
        </div>
      )}
    </header>
  );
};
