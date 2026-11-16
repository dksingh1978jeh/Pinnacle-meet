import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { WelcomePage } from './components/WelcomePage';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import {
  JoinMeetingView,
  NewMeetingView,
  ScheduleMeetingView,
} from './components/NewAndScheduleViews';
import { LiveMeetingRoom } from './components/LiveMeetingRoom';
import { RecordingsView } from './components/RecordingsView';
import { ProfileView } from './components/ProfileView';
import { SubscriptionView } from './components/SubscriptionView';
import { AdminDashboardView } from './components/AdminDashboardView';
import type { ActiveJoinSession, AppScreen } from './types';

function AppShell() {
  const { user, loading, authFetch } = useAuth();
  const [screen, setScreen] = useState<AppScreen>('welcome');
  const [prefillCode, setPrefillCode] = useState<string>('');
  const [activeSession, setActiveSession] = useState<ActiveJoinSession | null>(
    null
  );

  // Check URL query parameter ?join=PM-XXX-XXXX-XXX on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      setPrefillCode(joinCode.toUpperCase());
      setScreen('join-meeting');
    }
  }, []);

  // Redirect authenticated user from auth screen to dashboard
  useEffect(() => {
    if (!loading && user && screen === 'auth') {
      setScreen('dashboard');
    }
  }, [user, loading, screen]);

  const handleNavigate = (next: AppScreen, code?: string) => {
    if (code !== undefined) setPrefillCode(code);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartMeetingDirect = async (
    meetingCode: string,
    passcode?: string
  ) => {
    const res = await authFetch(
      `/api/meetings/${encodeURIComponent(meetingCode)}/join`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as ActiveJoinSession;
      setActiveSession({ ...data, initialAudio: true, initialVideo: true });
      setScreen('live-room');
    } else {
      setPrefillCode(meetingCode);
      setScreen('join-meeting');
    }
  };

  if (screen === 'live-room' && activeSession) {
    return (
      <LiveMeetingRoom
        session={activeSession}
        onLeave={() => {
          setActiveSession(null);
          setScreen(user ? 'dashboard' : 'welcome');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar currentScreen={screen} onNavigate={(s) => handleNavigate(s)} />

      {screen === 'welcome' && (
        <WelcomePage onNavigate={(s, code) => handleNavigate(s, code)} />
      )}

      {screen === 'auth' && (
        <AuthView onSuccess={(s) => handleNavigate(s)} />
      )}

      {screen === 'dashboard' && (
        <DashboardView
          onNavigate={(s, code) => handleNavigate(s, code)}
          onStartMeetingDirect={handleStartMeetingDirect}
        />
      )}

      {screen === 'new-meeting' && (
        <NewMeetingView
          onNavigate={(s) => handleNavigate(s)}
          onJoined={(sess) => {
            setActiveSession(sess);
            setScreen('live-room');
          }}
        />
      )}

      {screen === 'schedule-meeting' && (
        <ScheduleMeetingView
          onNavigate={(s) => handleNavigate(s)}
          onStartMeetingDirect={handleStartMeetingDirect}
        />
      )}

      {screen === 'join-meeting' && (
        <JoinMeetingView
          initialCode={prefillCode}
          onNavigate={(s) => handleNavigate(s)}
          onJoined={(sess) => {
            setActiveSession(sess);
            setScreen('live-room');
          }}
        />
      )}

      {screen === 'recordings' && (
        <RecordingsView onNavigate={(s) => handleNavigate(s)} />
      )}

      {screen === 'profile' && (
        <ProfileView onNavigate={(s) => handleNavigate(s)} />
      )}

      {screen === 'subscription' && (
        <SubscriptionView onNavigate={(s) => handleNavigate(s)} />
      )}

      {screen === 'admin' && <AdminDashboardView />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
