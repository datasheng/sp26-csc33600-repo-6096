'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { revenueApi, type RevenueSummary } from '@/lib/api'

function money(n: number) {
  return `$${Number(n || 0).toFixed(2)}`
}

export default function AdminRevenuePage() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    revenueApi.summary()
      .then(setSummary)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load revenue summary'))
      .finally(() => setLoading(false))
  }, [])

  const cards = summary ? [
    { label: 'Total Payment Volume', value: money(summary.total_payment_volume) },
    { label: 'Platform Fee Revenue', value: money(summary.total_platform_fees) },
    { label: 'Active Subscriptions', value: String(summary.active_subscriptions) },
    { label: 'Monthly Subscription Revenue', value: money(summary.monthly_subscription_revenue) },
    { label: 'Estimated Total Revenue', value: money(summary.total_estimated_revenue) },
  ] : []

  return (
    <DashboardLayout>
      <div className="p-8 max-w-5xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Revenue Summary</h1>
        <p className="text-brand-muted mb-8">
          Platform-wide earnings from service fees and tradesperson subscriptions.
        </p>

        {loading ? (
          <p className="text-brand-muted text-center py-16">Loading…</p>
        ) : error ? (
          <p className="text-red-600 text-center py-16">{error}</p>
        ) : summary && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {cards.map(card => (
                <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                  <p className="text-2xl font-display text-navy">{card.value}</p>
                  <p className="text-sm text-brand-muted mt-0.5">{card.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-display text-xl text-navy mb-4">Revenue Streams</h2>
              <div className="flex flex-col gap-3">
                {summary.streams.map(stream => (
                  <div key={stream.stream_name} className="flex justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <span className="text-navy font-medium">{stream.stream_name}</span>
                    <span className="text-brand-muted">{money(stream.revenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
