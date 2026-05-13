'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { notificationsApi, type NotificationItem } from '@/lib/api'

export default function NotificationsPage() {
  const [notes, setNotes] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    notificationsApi.getAll()
      .then(r => setNotes(r.notifications))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const unread = notes.filter(n => !n.read).length

  async function markRead(n: NotificationItem) {
    if (n.read) return
    // Optimistic update first
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    try {
      await notificationsApi.markRead(n.id, n.key)
    } catch {
      // Revert on failure
      setNotes(prev => prev.map(x => x.id === n.id ? { ...x, read: false } : x))
    }
  }

  async function markAllRead() {
    const previous = notes
    setNotes(prev => prev.map(n => ({ ...n, read: true })))
    try {
      await notificationsApi.markAllRead()
    } catch {
      setNotes(previous)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-2xl mx-auto animate-fade-up">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-3xl text-navy">Notifications</h1>
          {unread > 0 && (
            <span className="text-xs bg-brand-teal text-white px-2.5 py-1 rounded-full font-semibold">
              {unread} new
            </span>
          )}
        </div>
        <p className="text-brand-muted mb-8">Stay up to date on your jobs and activity.</p>

        {unread > 0 && (
          <button onClick={markAllRead}
            className="text-sm text-brand-teal hover:underline mb-6 block">
            Mark all as read
          </button>
        )}

        {loading ? (
          <p className="text-brand-muted text-center py-16">Loading…</p>
        ) : error ? (
          <p className="text-red-600 text-center py-16">{error}</p>
        ) : notes.length === 0 ? (
          <p className="text-brand-muted text-center py-16">
            No notifications yet — activity will show up here as it happens.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {notes.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n)}
                className={`px-5 py-4 rounded-xl border cursor-pointer transition-all ${
                  n.read
                    ? 'bg-white border-gray-100 text-brand-muted'
                    : 'bg-white border-brand-teal/30 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex items-start gap-3">
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-brand-teal shrink-0 mt-1.5" />
                  )}
                  <div className={n.read ? 'pl-5' : ''}>
                    <p className={`text-sm ${n.read ? 'text-brand-muted' : 'text-navy font-medium'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-brand-muted mt-1">{n.time}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && notes.length > 0 && notes.every(n => n.read) && (
          <p className="text-center text-brand-muted text-sm mt-10">
            You&apos;re all caught up ✓
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
