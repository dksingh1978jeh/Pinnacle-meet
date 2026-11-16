import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarPlus,
  Check,
  Copy,
  Film,
  LogOut,
  Mail,
  MessageSquareShare,
  Moon,
  Plus,
  Shield,
  Sun,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AppScreen, AttendanceRecord, MeetingItem } from '../types';

interface DashboardViewProps {
  onNavigate: (screen: AppScreen, prefillCode?: string) => void;
  onStartMeetingDirect: (meetingCode: string, passcode?: string) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onStartMeetingDirect,
}) => {
  const { user, theme, toggleTheme, authFetch, logout } = useAuth();
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [attendanceModal, setAttendanceModal] = useState<{
    meeting: MeetingItem;
    records: AttendanceRecord[];
  } | null>(null);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/meetings');
      if (res.ok) {
        const data = (await res.json()) as { meetings: MeetingItem[] };
        setMeetings(data.meetings);
      }
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const getInviteUrl = (code: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('join', code);
    return url.toString();
  };

  const handleCopyInvite = async (m: MeetingItem) => {
    const link = getInviteUrl(m.meetingCode);
    const text = `Join "${m.title}" on Pinnacle Meet\nMeeting ID: ${m.meetingCode}${
      m.invitePasscode ? `\nPasscode: ${m.invitePasscode}` : ''
    }\nLink: ${link}`;
    await navigator.clipboard.writeText(text);
    setCopiedCode(m.meetingCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleWhatsAppShare = (m: MeetingItem) => {
    const link = getInviteUrl(m.meetingCode);
    const msg = encodeURIComponent(
      `Join "${m.title}" on Pinnacle Meet\nMeeting ID: ${m.meetingCode}${
        m.invitePasscode ? `\nPasscode: ${m.invitePasscode}` : ''
      }\nJoin Link: ${link}`
    );
    window.location.assign(`https://wa.me/?text=${msg}`);
  };

  const handleEmailShare = (m: MeetingItem) => {
    const link = getInviteUrl(m.meetingCode);
    const subject = encodeURIComponent(`Invitation: ${m.title} (${m.meetingCode})`);
    const body = encodeURIComponent(
      `You are invited to join "${m.title}" on Pinnacle Meet.\n\nMeeting ID: ${
        m.meetingCode
      }${
        m.invitePasscode ? `\nPasscode: ${m.invitePasscode}` : ''
      }\nJoin Link: ${link}\nDuration: ${m.durationMinutes} minutes`
    );
    window.location.assign(`mailto:?subject=${subject}&body=${body}`);
  };

  const openAttendance = async (m: MeetingItem) => {
    const res = await authFetch(`/api/meetings/${m.meetingCode}/attendance`);
    if (res.ok) {
      const data = (await res.json()) as { attendance: AttendanceRecord[] };
      setAttendanceModal({ meeting: m, records: data.attendance });
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Workspace Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {user.role.replace('_', ' ')} · {user.plan.toUpperCase()} Plan ·{' '}
              {user.email}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
              Welcome back, {user.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5" />
                  <span>Dark</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('profile')}
              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Profile
            </button>
            {user.role === 'super_admin' && (
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Admin Panel</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => logout().then(() => onNavigate('welcome'))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* 4 Primary Action Cards */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => onNavigate('new-meeting')}
            className="flex flex-col justify-between rounded-2xl bg-blue-600 p-5 text-left text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Video className="h-6 w-6" />
            <div className="mt-6">
              <p className="font-display text-base font-bold">New Meeting</p>
              <p className="mt-0.5 text-xs text-blue-100">
                Launch an instant conference or classroom room
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('join-meeting')}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-blue-500 transition-colors cursor-pointer"
          >
            <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div className="mt-6">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                Join Meeting
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Enter a Meeting ID and optional passcode
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('schedule-meeting')}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-blue-500 transition-colors cursor-pointer"
          >
            <CalendarPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div className="mt-6">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                Schedule
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Set date, duration, recurrence &amp; waiting room
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('recordings')}
            className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-left hover:border-blue-500 transition-colors cursor-pointer"
          >
            <Film className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div className="mt-6">
              <p className="font-display text-base font-bold text-slate-900 dark:text-white">
                Recordings
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Authorized cloud recordings &amp; downloads
              </p>
            </div>
          </button>
        </div>

        {/* Meetings List */}
        <div className="mt-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Your Meetings &amp; History
            </h2>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {meetings.length} total
            </span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              <div className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
          ) : meetings.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You have not created or scheduled any meetings yet.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('new-meeting')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
              >
                Create First Meeting
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {meetings.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-semibold text-slate-900 dark:text-white">
                        {m.title}
                      </span>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        · {m.status === 'live' ? 'Live' : m.status === 'ended' ? 'Ended' : 'Scheduled'}
                      </span>
                      {m.isClassroomMode && (
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                          · Classroom
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      <span className="font-mono text-slate-700 dark:text-slate-200">
                        {m.meetingCode}
                      </span>
                      {m.invitePasscode && (
                        <>
                          <span>·</span>
                          <span className="font-mono">
                            Passcode: {m.invitePasscode}
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span>{m.durationMinutes} min</span>
                      {m.recurrence !== 'none' && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{m.recurrence}</span>
                        </>
                      )}
                      {m.scheduledAt && (
                        <>
                          <span>·</span>
                          <span>
                            {new Date(m.scheduledAt).toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyInvite(m)}
                      title="Copy Meeting Invitation"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {copiedCode === m.meetingCode ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWhatsAppShare(m)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <MessageSquareShare className="h-3.5 w-3.5" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEmailShare(m)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openAttendance(m)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Users className="h-3.5 w-3.5" />
                      <span>Attendance</span>
                    </button>
                    {m.status !== 'ended' && (
                      <button
                        type="button"
                        onClick={() =>
                          onStartMeetingDirect(
                            m.meetingCode,
                            m.invitePasscode || undefined
                          )
                        }
                        className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                      >
                        Enter Room
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Attendance Modal */}
      {attendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Attendance Report
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {attendanceModal.meeting.title} ·{' '}
                  {attendanceModal.meeting.meetingCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceModal(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto">
              {attendanceModal.records.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  No participants have joined this session yet.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Participant</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Joined</th>
                      <th className="py-2 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {attendanceModal.records.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 pr-4 font-medium text-slate-900 dark:text-white">
                          {r.displayName}
                        </td>
                        <td className="py-2.5 pr-4 capitalize">{r.role}</td>
                        <td className="py-2.5 pr-4 capitalize">{r.status}</td>
                        <td className="py-2.5 pr-4">
                          {new Date(r.joinedAt).toLocaleTimeString()}
                        </td>
                        <td className="py-2.5 text-right font-mono">
                          {Math.floor(r.durationSeconds / 60)}m{' '}
                          {r.durationSeconds % 60}s
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
