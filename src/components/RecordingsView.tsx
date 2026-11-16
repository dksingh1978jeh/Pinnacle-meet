import React, { useCallback, useEffect, useState } from 'react';
import { Download, Film, Play, Trash2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AppScreen, RecordingLibraryItem } from '../types';

interface RecordingsViewProps {
  onNavigate: (screen: AppScreen) => void;
}

export const RecordingsView: React.FC<RecordingsViewProps> = ({ onNavigate }) => {
  const { user, authFetch } = useAuth();
  const [recordings, setRecordings] = useState<RecordingLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingTitle, setPlayingTitle] = useState<string | null>(null);
  const [playingBlobUrl, setPlayingBlobUrl] = useState<string | null>(null);

  const loadRecordings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await authFetch('/api/recordings');
      if (res.ok) {
        const data = (await res.json()) as { recordings: RecordingLibraryItem[] };
        setRecordings(data.recordings);
      }
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  useEffect(() => {
    return () => {
      if (playingBlobUrl) URL.revokeObjectURL(playingBlobUrl);
    };
  }, [playingBlobUrl]);

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h2 className="font-display text-2xl font-bold">
          Sign in to access Cloud Recordings
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Recording access is restricted to authorized hosts and session participants.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('auth')}
          className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handlePlay = async (item: RecordingLibraryItem) => {
    const res = await authFetch(`/api/recordings/${item.recording.id}/download`);
    if (!res.ok) return;
    const blob = await res.blob();
    if (playingBlobUrl) URL.revokeObjectURL(playingBlobUrl);
    setPlayingBlobUrl(URL.createObjectURL(blob));
    setPlayingTitle(item.recording.title);
  };

  const handleDownload = async (item: RecordingLibraryItem) => {
    const res = await authFetch(
      `/api/recordings/${item.recording.id}/download?download=1`
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.recording.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: number) => {
    const res = await authFetch(`/api/recordings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRecordings((prev) => prev.filter((r) => r.recording.id !== id));
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Recording Library
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Authorized cloud recordings from your hosted and attended sessions.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {recordings.length} recordings available
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center space-y-3">
            <Film className="h-10 w-10 mx-auto text-slate-400" />
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              No recordings yet
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              Start a meeting or classroom session and click Record in the meeting toolbar to save cloud recordings here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            {recordings.map((item) => (
              <div
                key={item.recording.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4"
              >
                <div className="space-y-1">
                  <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                    {item.recording.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="font-mono">{item.meetingCode}</span> · Host:{' '}
                    {item.hostName} · {item.recording.durationSeconds}s ·{' '}
                    {formatBytes(item.recording.fileSizeBytes)} ·{' '}
                    {new Date(item.recording.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePlay(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Play</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.recording.id)}
                    aria-label="Delete recording"
                    className="rounded-lg border border-red-200 dark:border-red-900/60 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {playingBlobUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">{playingTitle}</h3>
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(playingBlobUrl);
                  setPlayingBlobUrl(null);
                }}
                className="rounded-lg p-1.5 hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <video
              src={playingBlobUrl}
              controls
              autoPlay
              className="w-full max-h-[70vh] rounded-xl bg-black"
            />
          </div>
        </div>
      )}
    </div>
  );
};
