'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { adminApi, type AdminSubscriptionPlan, type PlatformSettings } from '@/lib/api'

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null)
  const [plans, setPlans]       = useState<AdminSubscriptionPlan[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [savedMsg, setSavedMsg] = useState('')

  // Per-input working values
  const [feeInput, setFeeInput] = useState('')
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState<string | null>(null) // 'fee' | `plan-${id}`

  async function load() {
    setLoading(true); setError('')
    try {
      const [s, p] = await Promise.all([
        adminApi.getSettings(),
        adminApi.listPlans(),
      ])
      setSettings(s.settings)
      setFeeInput(String(s.settings.platform_fee_percentage))
      setPlans(p.plans)
      setPriceDrafts(
        Object.fromEntries(p.plans.map(pl => [pl.plan_id, String(pl.monthly_price)])),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function flashSaved(msg: string) {
    setSavedMsg(msg)
    setTimeout(() => setSavedMsg(''), 2500)
  }

  async function saveFee() {
    const n = Number(feeInput)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      alert('Platform fee % must be a number between 0 and 100.')
      return
    }
    setBusy('fee')
    try {
      const res = await adminApi.updateSettings(n)
      setSettings(prev => prev
        ? { ...prev, platform_fee_percentage: res.platform_fee_percentage }
        : { platform_fee_percentage: res.platform_fee_percentage })
      flashSaved(`Platform fee updated to ${res.platform_fee_percentage}%`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setBusy(null)
    }
  }

  async function savePlan(plan: AdminSubscriptionPlan) {
    const draft = priceDrafts[plan.plan_id]
    const n = Number(draft)
    if (!Number.isFinite(n) || n < 0) {
      alert('Monthly price must be a non-negative number.')
      return
    }
    setBusy(`plan-${plan.plan_id}`)
    try {
      const res = await adminApi.updatePlan(plan.plan_id, { monthly_price: n })
      setPlans(prev => prev.map(p => p.plan_id === plan.plan_id ? res.plan : p))
      flashSaved(`${res.plan.plan_name} updated to $${res.plan.monthly_price.toFixed(2)}/mo`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save plan')
    } finally {
      setBusy(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-3xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Platform Settings</h1>
        <p className="text-brand-muted mb-8">
          Tune the platform fee and subscription prices. Changes take effect immediately for new payments.
        </p>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-6 text-sm">{error}</p>
        )}
        {savedMsg && (
          <p className="text-green-700 bg-green-50 rounded-lg px-4 py-3 mb-6 text-sm">{savedMsg}</p>
        )}

        {loading ? (
          <p className="text-brand-muted text-center py-16">Loading…</p>
        ) : (
          <>
            {/* Platform fee */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
              <h2 className="font-display text-xl text-navy mb-1">Platform Service Fee</h2>
              <p className="text-sm text-brand-muted mb-5">
                Percentage taken from each paid booking. Existing payment records keep their original
                fee percentage; only new payments use the updated value.
              </p>
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-brand-muted mb-1.5">
                    Fee percentage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      value={feeInput}
                      onChange={e => setFeeInput(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand-teal"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-muted text-sm">%</span>
                  </div>
                </div>
                <button
                  onClick={saveFee}
                  disabled={busy === 'fee'}
                  className="px-5 py-3 bg-brand-teal text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {busy === 'fee' ? 'Saving…' : 'Save'}
                </button>
              </div>
              {settings && (
                <p className="text-xs text-brand-muted mt-3">
                  Current: {settings.platform_fee_percentage}%
                  {settings.updated_at && ` · last updated ${new Date(settings.updated_at).toLocaleString()}`}
                </p>
              )}
            </section>

            {/* Subscription plans */}
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-display text-xl text-navy mb-1">Subscription Plans</h2>
              <p className="text-sm text-brand-muted mb-5">
                Edit the monthly price of each plan. Existing subscribers keep the price they signed up at.
              </p>

              <div className="flex flex-col gap-4">
                {plans.map(p => (
                  <div key={p.plan_id} className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                    <div className="flex-1">
                      <p className="font-semibold text-navy">{p.plan_name}</p>
                      <p className="text-xs text-brand-muted mt-0.5">
                        Job limit: {p.job_limit}
                        {!p.is_active && ' · inactive'}
                      </p>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted text-sm">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={priceDrafts[p.plan_id] ?? ''}
                        onChange={e => setPriceDrafts(prev => ({ ...prev, [p.plan_id]: e.target.value }))}
                        className="w-32 pl-7 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-teal"
                      />
                    </div>
                    <button
                      onClick={() => savePlan(p)}
                      disabled={busy === `plan-${p.plan_id}`}
                      className="px-4 py-2 bg-brand-navy text-white font-semibold rounded-lg text-xs hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      {busy === `plan-${p.plan_id}` ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
