import React, { useState } from 'react';
import {
  ArrowRight,
  Lock,
  MonitorPlay,
  Moon,
  PenTool,
  ShieldCheck,
  Sun,
  Video,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AppScreen } from '../types';

interface WelcomePageProps {
  onNavigate: (screen: AppScreen, prefillCode?: string) => void;
}

export const WelcomePage: React.FC<WelcomePageProps> = ({ onNavigate }) => {
  const { user, theme, toggleTheme } = useAuth();
  const [joinCode, setJoinCode] = useState('');

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onNavigate('join-meeting', joinCode.trim().toUpperCase());
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Hero Split */}
      <section className="mx-auto max-w-7xl px-4 pt-10 pb-14 sm:px-6 lg:px-8 lg:pt-16">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Video Conferencing · Online Classrooms · Enterprise Administration
            </p>
            <h1
              className="font-display text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:leading-[1.1]"
              style={{ textWrap: 'balance' }}
            >
              Crystal-clear meetings and interactive classrooms in every browser.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Pinnacle Meet unites low-latency WebRTC video, live screen sharing,
              collaborative whiteboards, quizzes, cloud recording, and role-based
              access control across desktop, tablet, Android, and iOS.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate(user ? 'new-meeting' : 'auth')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <Video className="h-4 w-4" />
                <span>{user ? 'Start Instant Meeting' : 'Create Free Account'}</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('schedule-meeting')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <span>Schedule Session</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Join Input */}
            <form
              onSubmit={handleQuickJoin}
              className="flex flex-col sm:flex-row gap-2.5 max-w-md pt-2"
            >
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter Meeting ID (e.g. PM-482-9103-K7A)"
                className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-blue-600 focus:outline-none font-mono"
              />
              <button
                type="submit"
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Join Room
              </button>
            </form>
          </div>

          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-900">
              <img
                src="/src/assets/images/hero_conference_room_1794841380255.jpg"
                alt="Pinnacle Meet architectural conference studio"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-6">
                <p className="text-sm font-medium text-white">
                  End-to-end encrypted WebRTC transport · Adaptive 1080p video ·
                  LiveKit SFU ready
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 4-column Capability Strip below hero */}
        <div className="mt-12 grid grid-cols-1 gap-6 border-t border-b border-slate-200 dark:border-slate-800 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <MonitorPlay className="h-4 w-4" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                HD Video &amp; Screen Share
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              720p/1080p camera feeds, front/rear mobile switching, echo
              cancellation, and tab or window sharing.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <PenTool className="h-4 w-4" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Online Teaching Mode
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Shared whiteboard, PDF/PPT/image uploads, live polls, graded
              quizzes, Q&amp;A queue, and attendance logs.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Lock className="h-4 w-4" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Waiting Rooms &amp; Passcodes
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Host admission queue, meeting lock, participant mute/remove, and
              role-gated cloud recordings.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Admin &amp; Razorpay Billing
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Full organizational console, user moderation, storage telemetry,
              and INR subscription plans.
            </p>
          </div>
        </div>
      </section>

      {/* Bento Showcase */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
              <img
                src="/src/assets/images/classroom_hybrid_teaching_1794841380334.jpg"
                alt="Educator teaching on digital whiteboard"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-6 space-y-2">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                01. Classroom Mode
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Built for live instruction, cohorts, and workshops
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Lock student drawing access, launch instant quizzes, broadcast
                announcements, track attendance durations automatically, and
                publish course slides directly in the room.
              </p>
            </div>
          </div>

          <div className="lg:col-span-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
              <img
                src="/src/assets/images/enterprise_team_studio_1794841390013.jpg"
                alt="Remote engineering team collaborating"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="p-6 space-y-2">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                02. Enterprise &amp; Teams
              </p>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Scale from 10-person standups to 500-seat town halls
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Co-host delegation, host privilege transfer, 1-to-1 private
                chat, WhatsApp &amp; email calendar invites, and Super Admin
                audit logs keep every session accountable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="font-display font-semibold text-slate-900 dark:text-white">
              Pinnacle Meet
            </span>
            <span aria-hidden="true">·</span>
            <span>Secure Video Conferencing &amp; Learning Platform</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => onNavigate('subscription')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Plans &amp; Pricing
            </button>
            <button
              type="button"
              onClick={() => onNavigate('join-meeting')}
              className="hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Join Meeting
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
