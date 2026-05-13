'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import Link from 'next/link'
import { tradespeopleApi, jobsApi, endorsementsApi } from '@/lib/api'
import type { TradespersonWithUser, EndorsementRequest } from '@/types'

export default function JuniorDashboard() {
  const [tp, setTp] = useState<TradespersonWithUser | null>(null)
  const [requests, setRequests] = useState<EndorsementRequest[]>([])
  const [cap, setCap] = useState({ job_limit: 5, jobs_taken: 0, remaining: 5 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      try {
        const [me, c, er] = await Promise.all([
          tradespeopleApi.getMe(),
          jobsApi.cap(),
          endorsementsApi.mine(),
        ])
        setTp(me.tradesperson)
        setCap(c)
        setRequests(er.requests)
      } catch {
        // Profile may not exist yet — that's fine, show empty steps
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Derive completion from real backend data
  const profileFilled       = !!tp && tp.trade_category !== 'Unassigned' && tp.experience_year > 0
  const hasPendingRequest   = requests.some(r => r.status === 'pending')
  const hasApprovedRequest  = !!tp?.endorse_id   // set by Trigger 6 on approval
  const requestSent         = hasPendingRequest || hasApprovedRequest
  const hasAcceptedJob      = cap.jobs_taken > 0

  const steps = [
    { n: 1, label: 'Complete your trade profile',         done: profileFilled,      href: '/profile' },
    { n: 2, label: 'Request senior endorsement',          done: requestSent,        href: '/junior/setup' },
    { n: 3, label: 'Get approved by supervisor',          done: hasApprovedRequest, href: '/junior/setup' },
    { n: 4, label: 'Start applying to jobs',              done: hasAcceptedJob,     href: '/junior/jobs' },
  ]

  const completed = steps.filter(s => s.done).length
  const pct = Math.round((completed / steps.length) * 100)

  return (
    <DashboardLayout>
      <div className="p-8 max-w-3xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Welcome, Apprentice 👷</h1>
        <p className="text-brand-muted mb-8">Complete your setup to start taking on jobs.</p>

        {/* Progress */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-navy">Profile Completion</p>
            <p className="text-brand-muted text-sm">{completed}/{steps.length} steps</p>
          </div>
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-teal rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-brand-muted mt-2">
            {loading ? 'Loading…' : `${pct}% complete`}
          </p>
        </div>

        {/* Steps */}
        <div className="flex flex-col gap-3 mb-8">
          {steps.map(step => (
            <Link key={step.n} href={step.href}
              className={`flex items-center gap-4 px-5 py-4 rounded-xl border transition-all ${
                step.done
                  ? 'bg-green-50 border-green-200 opacity-70'
                  : 'bg-white border-gray-200 hover:border-brand-teal hover:shadow-sm'
              }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                step.done ? 'bg-green-500 text-white' : 'bg-gray-100 text-brand-muted'
              }`}>
                {step.done ? '✓' : step.n}
              </div>
              <p className={`font-medium ${step.done ? 'text-green-700 line-through' : 'text-navy'}`}>
                {step.label}
              </p>
            </Link>
          ))}
        </div>

        {/* Info box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <p className="font-semibold text-amber-800 mb-1">Job Cap Notice</p>
          <p className="text-sm text-amber-700">
            As a Junior, you can accept up to {cap.job_limit} active job{cap.job_limit !== 1 ? 's' : ''} at a time
            ({cap.remaining} remaining). Your supervisor can raise this limit over time.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
