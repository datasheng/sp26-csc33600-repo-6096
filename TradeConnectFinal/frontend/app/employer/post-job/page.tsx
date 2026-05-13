'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { jobPostingsApi } from '@/lib/api'

const TRADE_TYPES = ['Plumbing', 'Electrical', 'Carpentry', 'HVAC', 'Painting']

export default function PostJobPage() {
  const router = useRouter()

  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [tradeType, setTradeType]     = useState('Plumbing')
  const [city, setCity]               = useState('')
  const [address, setAddress]         = useState('')
  const [budgetMin, setBudgetMin]     = useState('')
  const [budgetMax, setBudgetMax]     = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  function validate(): string | null {
    if (!title.trim())     return 'Title is required'
    if (!tradeType)        return 'Trade is required'
    if (!scheduledAt)      return 'Scheduled date is required'
    const min = budgetMin ? parseFloat(budgetMin) : null
    const max = budgetMax ? parseFloat(budgetMax) : null
    if (min !== null && max !== null && max < min) {
      return 'Max budget must be at least min budget'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validate()
    if (v) { setError(v); return }

    setSubmitting(true); setError('')
    try {
      const res = await jobPostingsApi.create({
        title:        title.trim(),
        description:  description.trim() || undefined,
        trade_type:   tradeType,
        city:         city.trim() || undefined,
        address:      address.trim() || undefined,
        budget_min:   budgetMin ? parseFloat(budgetMin) : null,
        budget_max:   budgetMax ? parseFloat(budgetMax) : null,
        scheduled_at: scheduledAt.replace('T', ' ') + ':00',
      })
      router.push('/employer/postings/' + res.job_posting_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post job')
      setSubmitting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-2xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Post a Job</h1>
        <p className="text-muted mb-8">
          Describe the work you need done. Tradespeople in that trade will be able to apply.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-muted uppercase tracking-wide">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Fix leaking kitchen sink"
                className="form-input"
              />
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-muted uppercase tracking-wide">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                placeholder="What needs to be done? Any details that would help a pro give an accurate quote."
                className="form-input resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-muted uppercase tracking-wide">Trade</label>
              <select
                value={tradeType}
                onChange={e => setTradeType(e.target.value)}
                className="form-input"
              >
                {TRADE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted uppercase tracking-wide">When</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="form-input"
              />
            </div>
          </section>

          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-navy mb-4">Location</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-xs text-muted uppercase tracking-wide">Address</label>
                <input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="123 Main St"
                  className="form-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted uppercase tracking-wide">City</label>
                <input
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="New York"
                  className="form-input"
                />
              </div>
            </div>

            <h2 className="font-semibold text-navy mb-4 mt-2">Budget</h2>
            <p className="text-xs text-muted mb-3">Optional. Applicants will see the range you set.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted uppercase tracking-wide">Min ($)</label>
                <input
                  type="number" min={0} step={1}
                  value={budgetMin}
                  onChange={e => setBudgetMin(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted uppercase tracking-wide">Max ($)</label>
                <input
                  type="number" min={0} step={1}
                  value={budgetMax}
                  onChange={e => setBudgetMax(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-navy text-white font-semibold rounded-xl hover:bg-steel disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Posting...' : 'Post Job'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/employer/postings')}
              className="px-6 py-3 border border-gray-200 text-navy font-semibold rounded-xl hover:border-teal transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        <style jsx global>{`
          .form-input {
            width: 100%; padding: 0.625rem 0.875rem;
            border: 1px solid #e5e7eb; border-radius: 0.75rem;
            font-size: 0.875rem; color: #0D1B2A; background: white;
            transition: border-color 0.2s;
          }
          .form-input:focus { outline: none; border-color: #00B4D8; }
        `}</style>
      </div>
    </DashboardLayout>
  )
}
