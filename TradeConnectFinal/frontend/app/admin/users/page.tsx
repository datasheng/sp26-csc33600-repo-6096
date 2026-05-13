'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { adminApi, type AdminUserRow } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

const TYPE_FILTERS = ['All', 'Admin', 'Employer', 'Tradesperson', 'Junior'] as const
type TypeFilter = typeof TYPE_FILTERS[number]

export default function AdminUsersPage() {
  const { user } = useAuth()
  const [users, setUsers]     = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [filter, setFilter]   = useState<TypeFilter>('All')
  const [busyId, setBusyId]   = useState<number | null>(null)

  async function refresh() {
    try {
      const res = await adminApi.listUsers()
      setUsers(res.users)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users')
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [])

  async function handleDelete(u: AdminUserRow) {
    if (u.user_id === user?.user_id) {
      alert('You cannot delete your own admin account.')
      return
    }
    const ok = confirm(
      `Delete ${u.first_name} ${u.last_name} (${u.email})?\n\n` +
      `This cascades to their tradesperson record, bookings, applications, ` +
      `endorsements, and uploaded documents. This cannot be undone.`,
    )
    if (!ok) return

    setBusyId(u.user_id)
    try {
      await adminApi.deleteUser(u.user_id)
      await refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const filtered = users.filter(u => filter === 'All' || u.user_type === filter)

  const counts = {
    All:          users.length,
    Admin:        users.filter(u => u.user_type === 'Admin').length,
    Employer:     users.filter(u => u.user_type === 'Employer').length,
    Tradesperson: users.filter(u => u.user_type === 'Tradesperson').length,
    Junior:       users.filter(u => u.user_type === 'Junior').length,
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-6xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">Users</h1>
        <p className="text-brand-muted mb-6">
          {loading ? 'Loading…' : `${users.length} user${users.length === 1 ? '' : 's'} in the system.`}
        </p>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap mb-6">
          {TYPE_FILTERS.map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                filter === t
                  ? 'bg-brand-navy text-white border-brand-navy'
                  : 'bg-white text-brand-muted border-gray-200 hover:border-brand-navy'
              }`}
            >
              {t}
              <span className="ml-2 text-xs opacity-70">{counts[t]}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-600 bg-red-50 rounded-lg px-4 py-3 mb-4 text-sm">{error}</p>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-muted text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3">ID</th>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">City</th>
                <th className="px-5 py-3">Bookings</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-brand-muted">
                    No users match the filter.
                  </td>
                </tr>
              ) : filtered.map(u => {
                const bookings =
                  u.user_type === 'Employer' ? u.employer_booking_count :
                  u.user_type === 'Tradesperson' || u.user_type === 'Junior' ? u.tradesperson_booking_count :
                  0
                const isSelf = u.user_id === user?.user_id
                return (
                  <tr key={u.user_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-5 py-3 font-mono text-xs text-brand-muted">{u.user_id}</td>
                    <td className="px-5 py-3 font-medium text-navy">
                      {u.first_name} {u.last_name}
                      {isSelf && <span className="ml-2 text-xs bg-brand-teal/20 text-brand-teal rounded px-2 py-0.5">you</span>}
                    </td>
                    <td className="px-5 py-3 text-brand-muted">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${
                        u.user_type === 'Admin'        ? 'bg-purple-50 text-purple-700' :
                        u.user_type === 'Employer'     ? 'bg-blue-50 text-blue-700'   :
                        u.user_type === 'Tradesperson' ? 'bg-emerald-50 text-emerald-700' :
                                                          'bg-amber-50 text-amber-700'
                      }`}>
                        {u.user_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-brand-muted">{u.city || '—'}</td>
                    <td className="px-5 py-3 text-brand-muted">{bookings}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        disabled={isSelf || busyId === u.user_id}
                        onClick={() => handleDelete(u)}
                        className="px-3 py-1.5 border border-gray-200 text-red-600 text-xs font-semibold rounded-lg hover:border-red-400 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {busyId === u.user_id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  )
}
