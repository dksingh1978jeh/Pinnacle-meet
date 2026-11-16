import React, { useCallback, useEffect, useState } from 'react';
import { Check, CreditCard, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { AppScreen } from '../types';

interface PlanDto {
  id: 'free' | 'pro' | 'business';
  name: string;
  audience: string;
  priceInr: number;
  maxParticipants: number;
  maxDurationMinutes: number;
  features: string[];
}

interface BillingRecord {
  id: number;
  plan: string;
  amountInr: number;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  status: string;
  createdAt: string;
}

interface SubscriptionViewProps {
  onNavigate: (screen: AppScreen) => void;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
  onNavigate,
}) => {
  const { user, authFetch, refreshProfile } = useAuth();
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [history, setHistory] = useState<BillingRecord[]>([]);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sandboxModal, setSandboxModal] = useState<{
    orderId: string;
    plan: 'pro' | 'business';
    amountInr: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    const pRes = await fetch('/api/billing/plans');
    if (pRes.ok) {
      const pData = await pRes.json();
      setPlans(pData.plans || []);
    }
    if (user) {
      const hRes = await authFetch('/api/billing/history');
      if (hRes.ok) {
        const hData = await hRes.json();
        setHistory(hData.history || []);
      }
    }
  }, [user, authFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startUpgrade = async (planId: 'pro' | 'business') => {
    if (!user) {
      onNavigate('auth');
      return;
    }
    setBusyPlan(planId);
    setNotice(null);
    try {
      const res = await authFetch('/api/billing/razorpay/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not initiate checkout');

      if (data.mode === 'live' && (window as any).Razorpay) {
        const rzp = new (window as any).Razorpay({
          key: data.keyId,
          amount: data.amountPaise,
          currency: 'INR',
          name: 'Pinnacle Meet',
          description: `${planId.toUpperCase()} Monthly Subscription`,
          order_id: data.orderId,
          handler: async (resp: any) => {
            await completeVerification({
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature,
              plan: planId,
            });
          },
          prefill: {
            name: user.name,
            email: user.email,
            contact: user.mobile || '',
          },
        });
        rzp.open();
      } else {
        setSandboxModal({
          orderId: data.orderId,
          plan: planId,
          amountInr: data.amountInr,
        });
      }
    } catch (err: any) {
      setNotice(err?.message || 'Payment initialization failed.');
    } finally {
      setBusyPlan(null);
    }
  };

  const completeVerification = async (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    plan: 'pro' | 'business';
  }) => {
    const res = await authFetch('/api/billing/razorpay/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      await refreshProfile();
      await loadData();
      setNotice(data.message || 'Plan upgraded successfully.');
    } else {
      setNotice(data.error || 'Payment verification failed.');
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            Transparent INR Pricing · Razorpay UPI, Cards &amp; Netbanking
          </p>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Plans built for individuals, educators, and enterprises
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Start free with up to 10 participants, or upgrade via Razorpay to unlock cloud recording, extended meetings, and 500-participant SFU rooms.
          </p>
        </div>

        {notice && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm font-medium text-blue-800 dark:text-blue-200">
            {notice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((p) => {
            const isCurrent = user?.plan === p.id;
            const highlighted = p.id === 'pro';
            return (
              <div
                key={p.id}
                className={`flex flex-col justify-between rounded-2xl border p-6 bg-white dark:bg-slate-900 ${
                  highlighted
                    ? 'border-blue-600 ring-1 ring-blue-600'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {p.audience}
                    </p>
                    <h2 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">
                      {p.name}
                    </h2>
                  </div>

                  <div className="flex items-baseline gap-1 tabular-nums">
                    <span className="font-display text-3xl font-bold text-slate-900 dark:text-white">
                      ₹{p.priceInr.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs text-slate-500">/ month</span>
                  </div>

                  <div className="border-t border-b border-slate-100 dark:border-slate-800 py-3 text-xs text-slate-600 dark:text-slate-300 tabular-nums space-y-1">
                    <div className="flex justify-between">
                      <span>Participant Capacity</span>
                      <span className="font-semibold">{p.maxParticipants}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Max Meeting Length</span>
                      <span className="font-semibold">{p.maxDurationMinutes} min</span>
                    </div>
                  </div>

                  <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-sm font-semibold text-slate-500"
                    >
                      Active Plan
                    </button>
                  ) : p.id === 'free' ? (
                    <button
                      type="button"
                      onClick={() => onNavigate(user ? 'dashboard' : 'auth')}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      {user ? 'Included' : 'Start Free'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyPlan === p.id}
                      onClick={() => startUpgrade(p.id as 'pro' | 'business')}
                      className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {busyPlan === p.id
                        ? 'Preparing Razorpay...'
                        : `Upgrade to ${p.name}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Billing History */}
        {user && history.length > 0 && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <h3 className="font-display text-base font-bold">Payment History</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 tabular-nums">
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-6 py-3 font-mono">{h.razorpayOrderId}</td>
                      <td className="px-6 py-3 uppercase font-semibold">{h.plan}</td>
                      <td className="px-6 py-3">₹{h.amountInr.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3 capitalize">{h.status}</td>
                      <td className="px-6 py-3 text-right">
                        {new Date(h.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Razorpay Checkout Modal (Sandbox Mode when RAZORPAY_KEY_ID is not set) */}
      {sandboxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="font-display text-base font-bold">
                    Razorpay Checkout (Test Mode)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {sandboxModal.orderId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSandboxModal(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 text-sm space-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span className="text-slate-500">Subscription</span>
                <span className="font-semibold uppercase">{sandboxModal.plan} Plan</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payable Total</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ₹{sandboxModal.amountInr.toLocaleString('en-IN')} INR
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                Authorize test payment via UPI / Card to activate your plan immediately.
              </span>
            </div>

            <button
              type="button"
              onClick={async () => {
                const modal = sandboxModal;
                setSandboxModal(null);
                await completeVerification({
                  razorpayOrderId: modal.orderId,
                  razorpayPaymentId: `pay_test_${Date.now()}`,
                  razorpaySignature: 'sandbox_verified',
                  plan: modal.plan,
                });
              }}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Pay ₹{sandboxModal.amountInr.toLocaleString('en-IN')} &amp; Activate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
