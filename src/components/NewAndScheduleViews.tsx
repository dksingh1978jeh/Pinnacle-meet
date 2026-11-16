import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Mail,
  MessageSquareShare,
  Mic,
  MicOff,
  Video,
  VideoOff,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { ActiveJoinSession, AppScreen, MeetingItem } from '../types';

interface NewMeetingViewProps {
  onJoined: (session: ActiveJoinSession) => void;
  onNavigate: (screen: AppScreen) => void;
}

export const NewMeetingView: React.FC<NewMeetingViewProps> = ({
  onJoined,
  onNavigate,
}) => {
  const { user, authFetch } = useAuth();
  const [title, setTitle] = useState('Instant Pinnacle Meeting');
  const [isClassroomMode, setIsClassroomMode] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [requirePassword, setRequirePassword] = useState(true);
  const [allowJoinBeforeHost, setAllowJoinBeforeHost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold">Sign in to host a meeting</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Create a free account or sign in with Google to launch instant meetings.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('auth')}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  const handleCreateAndStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const createRes = await authFetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          isInstant: true,
          isClassroomMode,
          durationMinutes: user.plan === 'free' ? 40 : 120,
          waitingRoomEnabled,
          allowJoinBeforeHost,
          requirePassword,
        }),
      });
      const createData = (await createRes.json()) as {
        meeting?: MeetingItem;
        error?: string;
      };
      if (!createRes.ok || !createData.meeting) {
        throw new Error(createData.error || 'Could not create meeting.');
      }

      const joinRes = await authFetch(
        `/api/meetings/${createData.meeting.meetingCode}/join`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            passcode: createData.meeting.invitePasscode || undefined,
          }),
        }
      );
      const joinData = (await joinRes.json()) as ActiveJoinSession & {
        error?: string;
      };
      if (!joinRes.ok || !joinData.meetingToken) {
        throw new Error(joinData.error || 'Could not enter meeting room.');
      }
      onJoined({ ...joinData, initialAudio: true, initialVideo: true });
    } catch (err: any) {
      setError(err?.message || 'Failed to launch meeting.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Start an Instant Meeting
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Generate a unique Meeting ID and enter the live WebRTC room in one click.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleCreateAndStart} className="mt-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Meeting Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Online Classroom Mode
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Enables digital whiteboard, polls/quizzes, Q&amp;A, and teaching files
                </p>
              </div>
              <input
                type="checkbox"
                checked={isClassroomMode}
                onChange={(e) => setIsClassroomMode(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Waiting Room
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Approve or reject participants before they enter the call
                </p>
              </div>
              <input
                type="checkbox"
                checked={waitingRoomEnabled}
                onChange={(e) => setWaitingRoomEnabled(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Require Meeting Passcode
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Automatically creates a 6-character encrypted passcode
                </p>
              </div>
              <input
                type="checkbox"
                checked={requirePassword}
                onChange={(e) => setRequirePassword(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>

            <label className="flex items-center justify-between gap-4 cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Allow Join Before Host
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Participants can enter the room before you arrive
                </p>
              </div>
              <input
                type="checkbox"
                checked={allowJoinBeforeHost}
                onChange={(e) => setAllowJoinBeforeHost(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Video className="h-4 w-4" />
              <span>{busy ? 'Creating Room...' : 'Launch Meeting Now'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ScheduleMeetingViewProps {
  onNavigate: (screen: AppScreen) => void;
  onStartMeetingDirect: (meetingCode: string, passcode?: string) => Promise<void>;
}

export const ScheduleMeetingView: React.FC<ScheduleMeetingViewProps> = ({
  onNavigate,
  onStartMeetingDirect,
}) => {
  const { user, authFetch } = useAuth();
  const defaultLocalDate = new Date(Date.now() + 3600 * 1000)
    .toISOString()
    .slice(0, 16);

  const [title, setTitle] = useState('Team Weekly Sync');
  const [description, setDescription] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultLocalDate);
  const [durationMinutes, setDurationMinutes] = useState(40);
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [isClassroomMode, setIsClassroomMode] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [allowJoinBeforeHost, setAllowJoinBeforeHost] = useState(false);
  const [requirePassword, setRequirePassword] = useState(true);
  const [customPasscode, setCustomPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<MeetingItem | null>(null);
  const [copied, setCopied] = useState(false);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold">Sign in to schedule meetings</h2>
        <button
          type="button"
          onClick={() => onNavigate('auth')}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
        >
          Sign In / Register
        </button>
      </div>
    );
  }

  const maxPlanDuration =
    user.plan === 'business' ? 1440 : user.plan === 'pro' ? 480 : 40;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authFetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          isInstant: false,
          isClassroomMode,
          scheduledAt: new Date(scheduledAt).toISOString(),
          durationMinutes: Math.min(durationMinutes, maxPlanDuration),
          recurrence,
          waitingRoomEnabled,
          allowJoinBeforeHost,
          requirePassword,
          customPasscode: customPasscode.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { meeting?: MeetingItem; error?: string };
      if (!res.ok || !data.meeting) {
        throw new Error(data.error || 'Could not schedule meeting.');
      }
      setCreated(data.meeting);
    } catch (err: any) {
      setError(err?.message || 'Scheduling failed.');
    } finally {
      setBusy(false);
    }
  };

  if (created) {
    const url = new URL(window.location.href);
    url.searchParams.set('join', created.meetingCode);
    const inviteLink = url.toString();
    const inviteText = `Join "${created.title}" on Pinnacle Meet\nWhen: ${
      created.scheduledAt ? new Date(created.scheduledAt).toLocaleString() : 'Now'
    }\nMeeting ID: ${created.meetingCode}${
      created.invitePasscode ? `\nPasscode: ${created.invitePasscode}` : ''
    }\nLink: ${inviteLink}`;

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 px-4 py-10">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Meeting Scheduled
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white">
              {created.title}
            </h1>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2 text-sm tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-500">Meeting ID</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {created.meetingCode}
              </span>
            </div>
            {created.invitePasscode && (
              <div className="flex justify-between">
                <span className="text-slate-500">Passcode</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white">
                  {created.invitePasscode}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500">Duration</span>
              <span>{created.durationMinutes} minutes</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Recurrence</span>
              <span className="capitalize">{created.recurrence}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(inviteText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Invitation Copied' : 'Copy Invite Link'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                window.location.assign(
                  `https://wa.me/?text=${encodeURIComponent(inviteText)}`
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <MessageSquareShare className="h-4 w-4" />
              <span>Share via WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() =>
                window.location.assign(
                  `mailto:?subject=${encodeURIComponent(
                    `Invite: ${created.title}`
                  )}&body=${encodeURIComponent(inviteText)}`
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Mail className="h-4 w-4" />
              <span>Share via Email</span>
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold cursor-pointer"
            >
              Back to Dashboard
            </button>
            <button
              type="button"
              onClick={() =>
                onStartMeetingDirect(
                  created.meetingCode,
                  created.invitePasscode || undefined
                )
              }
              className="flex-1 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Start Meeting Early
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Schedule a Meeting
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Your {user.plan.toUpperCase()} plan supports meetings up to{' '}
          <span className="tabular-nums font-semibold">{maxPlanDuration}</span>{' '}
          minutes.
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Meeting Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Agenda / Description (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Topics, reading materials, or preparation notes"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2 text-sm focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date &amp; Time
              </label>
              <input
                type="datetime-local"
                required
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                min={15}
                max={maxPlanDuration}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm tabular-nums focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Recurrence
              </label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="none">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium">Online Teaching Classroom Mode</span>
              <input
                type="checkbox"
                checked={isClassroomMode}
                onChange={(e) => setIsClassroomMode(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-sm font-medium">Enable Waiting Room</span>
              <input
                type="checkbox"
                checked={waitingRoomEnabled}
                onChange={(e) => setWaitingRoomEnabled(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-sm font-medium">Allow Participants Before Host</span>
              <input
                type="checkbox"
                checked={allowJoinBeforeHost}
                onChange={(e) => setAllowJoinBeforeHost(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-sm font-medium">Require Passcode</span>
              <input
                type="checkbox"
                checked={requirePassword}
                onChange={(e) => setRequirePassword(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
            {requirePassword && (
              <input
                type="text"
                value={customPasscode}
                onChange={(e) => setCustomPasscode(e.target.value)}
                placeholder="Custom passcode (leave blank to auto-generate)"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60"
            >
              <Calendar className="h-4 w-4" />
              <span>{busy ? 'Scheduling...' : 'Save Scheduled Meeting'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface JoinMeetingViewProps {
  initialCode?: string;
  onJoined: (session: ActiveJoinSession) => void;
  onNavigate: (screen: AppScreen) => void;
}

export const JoinMeetingView: React.FC<JoinMeetingViewProps> = ({
  initialCode = '',
  onJoined,
  onNavigate,
}) => {
  const { user, authFetch } = useAuth();
  const [meetingCode, setMeetingCode] = useState(initialCode);
  const [passcode, setPasscode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [previewAudio, setPreviewAudio] = useState(true);
  const [previewVideo, setPreviewVideo] = useState(true);
  const [meetingInfo, setMeetingInfo] = useState<{
    title: string;
    hostName: string;
    hasPassword: boolean;
    isClassroomMode: boolean;
    waitingRoomEnabled: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    async function startPreview() {
      if (!previewVideo && !previewAudio) {
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach((t) => t.stop());
          previewStreamRef.current = null;
        }
        if (previewVideoRef.current) previewVideoRef.current.srcObject = null;
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: previewVideo ? { width: 1280, height: 720 } : false,
          audio: previewAudio
            ? { echoCancellation: true, noiseSuppression: true }
            : false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        previewStreamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
        }
      } catch {
        // User may deny or have no camera/mic attached; allow audio/view-only join
      }
    }
    startPreview();
    return () => {
      active = false;
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
    };
  }, [previewVideo, previewAudio]);

  useEffect(() => {
    const clean = meetingCode.trim().toUpperCase();
    if (clean.length < 6) {
      setMeetingInfo(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/meetings/${encodeURIComponent(clean)}`);
        if (res.ok) {
          const data = await res.json();
          setMeetingInfo(data.meeting);
          setError(null);
        } else {
          setMeetingInfo(null);
        }
      } catch {
        setMeetingInfo(null);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [meetingCode, authFetch]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const code = meetingCode.trim().toUpperCase();
      const res = await authFetch(`/api/meetings/${encodeURIComponent(code)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passcode: passcode.trim() || undefined,
          guestName: !user ? guestName.trim() : undefined,
        }),
      });
      const data = (await res.json()) as ActiveJoinSession & { error?: string };
      if (!res.ok || !data.meetingToken) {
        throw new Error(data.error || 'Could not join meeting.');
      }
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
      onJoined({
        ...data,
        initialAudio: previewAudio,
        initialVideo: previewVideo,
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to join meeting.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Hardware Camera & Mic Check */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden">
          <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center">
            {previewVideo ? (
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover -scale-x-100"
              />
            ) : (
              <div className="text-center space-y-2 text-slate-400">
                <VideoOff className="h-10 w-10 mx-auto" />
                <p className="text-sm">Camera is turned off</p>
              </div>
            )}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewAudio((v) => !v)}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors cursor-pointer ${
                  previewAudio
                    ? 'bg-slate-800/90 text-white hover:bg-slate-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
                aria-label="Toggle microphone preview"
              >
                {previewAudio ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setPreviewVideo((v) => !v)}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors cursor-pointer ${
                  previewVideo
                    ? 'bg-slate-800/90 text-white hover:bg-slate-700'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
                aria-label="Toggle camera preview"
              >
                {previewVideo ? (
                  <Video className="h-5 w-5" />
                ) : (
                  <VideoOff className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
          <div className="px-4 py-3 text-xs text-slate-300 flex justify-between">
            <span>Echo cancellation &amp; noise suppression enabled</span>
            <span>Pre-join check</span>
          </div>
        </div>

        {/* Join Form */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Join a Meeting
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Enter your Meeting ID to connect directly.
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={handleJoin} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Meeting ID
              </label>
              <input
                type="text"
                required
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                placeholder="PM-482-9103-K7A"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono uppercase focus:border-blue-600 focus:outline-none"
              />
            </div>

            {meetingInfo && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-3 text-xs space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {meetingInfo.title}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Host: {meetingInfo.hostName}
                  {meetingInfo.isClassroomMode ? ' · Classroom Mode' : ''}
                  {meetingInfo.waitingRoomEnabled ? ' · Waiting Room Active' : ''}
                </p>
              </div>
            )}

            {!user && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Your Display Name
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}

            {(!meetingInfo || meetingInfo.hasPassword) && (
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Meeting Passcode {meetingInfo?.hasPassword ? '(Required)' : '(If required)'}
                </label>
                <input
                  type="text"
                  required={Boolean(meetingInfo?.hasPassword)}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="6-character passcode"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm font-mono focus:border-blue-600 focus:outline-none"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Connecting...' : 'Join Meeting'}
            </button>
          </form>

          {!user && (
            <p className="mt-4 text-center text-xs text-slate-500">
              Have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('auth')}
                className="font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
