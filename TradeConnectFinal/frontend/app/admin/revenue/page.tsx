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
  // ⬇ ADDED: state for the export button
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    revenueApi.summary()
      .then(setSummary)
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load revenue summary'))
      .finally(() => setLoading(false))
  }, [])

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const blob = await revenueApi.exportReport()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `revenue-report-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

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
        {/* ⬇ CHANGED: header is now a flex row with title left, button right */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="font-display text-3xl text-navy mb-1">Revenue Summary</h1>
            <p className="text-brand-muted">
              Platform-wide earnings from service fees and tradesperson subscriptions.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleExport}
              disabled={exporting || loading || !summary}
              className="bg-navy text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity whitespace-nowrap"
            >
              {exporting ? 'Generating…' : 'Export Report'}
            </button>
            {exportError && (
              <p className="text-xs text-red-600">{exportError}</p>
            )}
          </div>
        </div>

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
