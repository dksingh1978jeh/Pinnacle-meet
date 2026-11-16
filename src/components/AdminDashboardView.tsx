import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { MeetingItem, UserProfile } from '../types';

interface AdminOverviewData {
  stats: {
    totalUsers: number;
    totalMeetings: number;
    activeMeetings: number;
    scheduledMeetings: number;
    totalDurationMinutes: number;
    avgDurationMinutes: number;
    storageUsedBytes: number;
    recordingCount: number;
    totalRevenueInr: number;
  };
  users: UserProfile[];
  meetings: MeetingItem[];
  payments: Array<{
    id: number;
    plan: string;
    amountInr: number;
    status: string;
    razorpayOrderId: string | null;
    userName: string;
    userEmail: string;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: number;
    actorName: string;
    action: string;
    targetType: string;
    targetId: string | null;
    details: string | null;
    createdAt: string;
  }>;
}

export const AdminDashboardView: React.FC = () => {
  const { user, authFetch } = useAuth();
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<
    'users' | 'meetings' | 'payments' | 'logs'
  >('users');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : '';
      const res = await authFetch(`/api/admin/overview${q}`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to load admin overview.');
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err?.message || 'Admin access required.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, search]);

  useEffect(() => {
    if (user?.role === 'super_admin') {
      loadOverview();
    }
  }, [user?.role, loadOverview]);

  if (!user || user.role !== 'super_admin') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 mx-auto text-red-500" />
        <h2 className="font-display text-xl font-bold">
          Super Admin Privileges Required
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your account role ({user?.role || 'guest'}) does not have administrative permissions.
        </p>
      </div>
    );
  }

  const updateUser = async (
    targetId: number,
    updates: { status?: string; role?: string; plan?: string }
  ) => {
    const res = await authFetch(`/api/admin/users/${targetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) loadOverview();
  };

  const forceEndMeeting = async (meetingId: number) => {
    const res = await authFetch(`/api/admin/meetings/${meetingId}/end`, {
      method: 'POST',
    });
    if (res.ok) loadOverview();
  };

  const formatMb = (bytes: number) =>
    `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Super Admin Console
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Platform telemetry, user governance, meeting oversight, storage, and audit logs.
            </p>
          </div>
          <button
            type="button"
            onClick={loadOverview}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh Data</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
              {[
                { label: 'Registered Users', value: data.stats.totalUsers },
                { label: 'Total Meetings', value: data.stats.totalMeetings },
                { label: 'Active Live Rooms', value: data.stats.activeMeetings },
                { label: 'Scheduled Meetings', value: data.stats.scheduledMeetings },
                {
                  label: 'Avg Meeting Duration',
                  value: `${data.stats.avgDurationMinutes} min`,
                },
                {
                  label: 'Cumulative Scheduled',
                  value: `${data.stats.totalDurationMinutes} min`,
                },
                {
                  label: `Storage (${data.stats.recordingCount} files)`,
                  value: formatMb(data.stats.storageUsedBytes),
                },
                {
                  label: 'Razorpay Revenue',
                  value: `₹${data.stats.totalRevenueInr.toLocaleString('en-IN')}`,
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
                >
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {stat.label}
                  </p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Section Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-1 rounded-xl bg-slate-200/70 dark:bg-slate-900 p-1">
                {(
                  [
                    { id: 'users', label: `Users (${data.users.length})` },
                    { id: 'meetings', label: `Meetings (${data.meetings.length})` },
                    { id: 'payments', label: `Payments (${data.payments.length})` },
                    { id: 'logs', label: `Audit Logs (${data.auditLogs.length})` },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold cursor-pointer ${
                      activeTab === t.id
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === 'users' && (
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user name or email..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Users Table */}
            {activeTab === 'users' && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Mobile</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Moderation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {data.users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {u.name}
                          </p>
                          <p className="text-slate-500">{u.email}</p>
                        </td>
                        <td className="px-4 py-3 font-mono">{u.mobile || '—'}</td>
                        <td className="px-4 py-3">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              updateUser(u.id, { role: e.target.value })
                            }
                            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs"
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="host">Host</option>
                            <option value="co_host">Co-host</option>
                            <option value="participant">Participant</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={u.plan}
                            onChange={(e) =>
                              updateUser(u.id, { plan: e.target.value })
                            }
                            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 text-xs uppercase"
                          >
                            <option value="free">Free</option>
                            <option value="pro">Pro</option>
                            <option value="business">Business</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 capitalize font-medium">
                          {u.status}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5">
                          {u.status !== 'active' ? (
                            <button
                              type="button"
                              onClick={() => updateUser(u.id, { status: 'active' })}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white cursor-pointer"
                            >
                              Activate
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  updateUser(u.id, { status: 'suspended' })
                                }
                                className="rounded-lg border border-amber-400 px-2.5 py-1 text-amber-600 dark:text-amber-400 cursor-pointer"
                              >
                                Suspend
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  updateUser(u.id, { status: 'blocked' })
                                }
                                className="rounded-lg border border-red-400 px-2.5 py-1 text-red-600 dark:text-red-400 cursor-pointer"
                              >
                                Block
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Meetings Table */}
            {activeTab === 'meetings' && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Meeting ID</th>
                      <th className="px-4 py-3">Title &amp; Host</th>
                      <th className="px-4 py-3">Duration</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {data.meetings.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-3 font-mono font-semibold">
                          {m.meetingCode}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {m.title}
                          </p>
                          <p className="text-slate-500">Host: {m.hostName}</p>
                        </td>
                        <td className="px-4 py-3">{m.durationMinutes} min</td>
                        <td className="px-4 py-3 capitalize">{m.status}</td>
                        <td className="px-4 py-3 text-right">
                          {m.status !== 'ended' && (
                            <button
                              type="button"
                              onClick={() => forceEndMeeting(m.id)}
                              className="rounded-lg bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 cursor-pointer"
                            >
                              Force End
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Payments Table */}
            {activeTab === 'payments' && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Order ID</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3">
                          <p className="font-semibold">{p.userName}</p>
                          <p className="text-slate-500">{p.userEmail}</p>
                        </td>
                        <td className="px-4 py-3 uppercase font-semibold">{p.plan}</td>
                        <td className="px-4 py-3 font-mono">{p.razorpayOrderId}</td>
                        <td className="px-4 py-3">
                          ₹{p.amountInr.toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right capitalize">{p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Audit Logs */}
            {activeTab === 'logs' && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Administrator</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Target</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                    {data.auditLogs.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-3 font-semibold">{l.actorName}</td>
                        <td className="px-4 py-3 font-mono">{l.action}</td>
                        <td className="px-4 py-3">
                          {l.targetType} #{l.targetId}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{l.details}</td>
                        <td className="px-4 py-3 text-right">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <div className="h-48 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        )}
      </div>
    </div>
  );
};
