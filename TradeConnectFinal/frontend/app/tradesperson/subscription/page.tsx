'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { subscriptionsApi, type SubscriptionPlanOption } from '@/lib/api'
import type { Subscription } from '@/types'

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<SubscriptionPlanOption[]>([])
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function load() {
    const [plansRes, mineRes] = await Promise.all([
      subscriptionsApi.plans(),
      subscriptionsApi.mine(),
    ])
    setPlans(plansRes.plans)
    setSubscription(mineRes.subscription)
  }

  useEffect(() => {
    load()
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load subscription'))
      .finally(() => setLoading(false))
  }, [])

  async function activate(planName: 'Pro' | 'Elite') {
    setBusy(planName); setError('')
    try {
      await subscriptionsApi.activate(planName)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Subscription update failed')
    } finally {
      setBusy(null)
    }
  }

  async function cancel() {
    setBusy('cancel'); setError('')
    try {
      await subscriptionsApi.cancel()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Subscription cancellation failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Subscription</h1>
        <p className="text-brand-muted mb-8">
          Upgrade your TradeConnect account to increase your job limit and support the subscription revenue stream.
        </p>

        {error && <p className="bg-red-50 text-red-700 border border-red-100 rounded-xl px-4 py-3 mb-6 text-sm">{error}</p>}

        {loading ? (
          <p className="text-brand-muted text-center py-16">Loading…</p>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
              <p className="text-sm text-brand-muted uppercase tracking-wide mb-1">Current plan</p>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-display text-2xl text-navy">{subscription?.plan_name ?? 'Free'}</p>
                  <p className="text-brand-muted text-sm">
                    {subscription
                      ? `$${Number(subscription.price_at_purchase).toFixed(2)}/month · active since ${subscription.start_date}`
                      : '$0.00/month · default job limit'}
                  </p>
                </div>
                {subscription && (
                  <button
                    disabled={busy === 'cancel'}
                    onClick={cancel}
                    className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:border-red-400 disabled:opacity-40"
                  >
                    {busy === 'cancel' ? 'Cancelling…' : 'Cancel plan'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {plans.map(plan => {
                const active = (subscription?.plan_name ?? 'Free') === plan.plan_name
                const paid = plan.plan_name !== 'Free'
                return (
                  <div key={plan.plan_name} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
                    <p className="font-display text-2xl text-navy">{plan.plan_name}</p>
                    <p className="text-3xl font-display text-navy mt-4">${Number(plan.monthly_price).toFixed(2)}</p>
                    <p className="text-brand-muted text-sm mb-6">per month</p>
                    <ul className="text-sm text-brand-muted space-y-2 mb-6 flex-1">
                      <li>Job limit: {plan.job_limit}</li>
                      <li>{paid ? 'Premium access for more opportunities' : 'Basic marketplace access'}</li>
                      <li>{paid ? 'Supports TradeConnect subscription revenue' : 'No monthly fee'}</li>
                    </ul>
                    {active ? (
                      <button disabled className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-semibold">
                        Current plan
                      </button>
                    ) : paid ? (
                      <button
                        disabled={busy === plan.plan_name}
                        onClick={() => activate(plan.plan_name as 'Pro' | 'Elite')}
                        className="px-4 py-2 rounded-lg bg-brand-teal text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                      >
                        {busy === plan.plan_name ? 'Activating…' : `Choose ${plan.plan_name}`}
                      </button>
                    ) : (
                      <button disabled className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm font-semibold">
                        Default
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
