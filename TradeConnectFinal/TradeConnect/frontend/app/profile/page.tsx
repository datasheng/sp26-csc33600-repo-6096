'use client'

import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useAuth } from '@/context/AuthContext'
import { usersApi, tradespeopleApi } from '@/lib/api'

export default function ProfilePage() {
  const { user, refresh } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [phone,     setPhone]     = useState('')
  const [address,   setAddress]   = useState('')
  const [city,      setCity]      = useState('')
  const [state,     setState]     = useState('')
  const [zip,       setZip]       = useState('')

  const [tradeCategory,   setTradeCategory]   = useState('')
  const [licenseNumber,   setLicenseNumber]   = useState('')
  const [licenseState,    setLicenseState]    = useState('')
  const [licenseExpiry,   setLicenseExpiry]   = useState('')
  const [experienceYears, setExperienceYears] = useState('')

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [error,  setError]  = useState('')

  const isTrade = user?.user_type === 'Tradesperson' || user?.user_type === 'Junior'

  // Hydrate basic fields from user once it's available
  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name ?? '')
    setLastName(user.last_name ?? '')
    setPhone(user.phone ?? '')
    setAddress(user.address ?? '')
    setCity(user.city ?? '')
    setState(user.state ?? '')
    setZip(user.zip ?? '')
  }, [user])

  // Hydrate trade-profile fields if applicable
  useEffect(() => {
    if (!isTrade) return
    tradespeopleApi.getMe()
      .then(res => {
        const t = res.tradesperson
        // Don't show 'Unassigned' placeholder we use server-side
        setTradeCategory(t.trade_category === 'Unassigned' ? '' : t.trade_category)
        setLicenseNumber(t.license_number ?? '')
        setLicenseState(t.license_state ?? '')
        setLicenseExpiry(t.license_expiry ? t.license_expiry.slice(0, 10) : '')
        setExperienceYears(t.experience_year > 0 ? String(t.experience_year) : '')
      })
      .catch(() => { /* no profile yet */ })
  }, [isTrade])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setSaved(false); setError('')
    try {
      // Always update the user fields
      await usersApi.updateProfile({
        first_name: firstName,
        last_name:  lastName,
        phone, address, city, state, zip,
      })

      // For Tradesperson/Junior, also upsert their trade profile
      if (isTrade && tradeCategory) {
        await tradespeopleApi.upsert({
          trade_category:  tradeCategory,
          license_number:  licenseNumber || undefined,
          license_state:   licenseState || undefined,
          license_expiry:  licenseExpiry || undefined,
          experience_year: experienceYears ? Number(experienceYears) : 0,
        })
      }

      // Refresh AuthContext so dashboards see new name immediately
      await refresh()

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="p-8 max-w-2xl mx-auto animate-fade-up">
        <h1 className="font-display text-3xl text-navy mb-1">My Profile</h1>
        <p className="text-brand-muted mb-8">Keep your information up to date.</p>

        <form onSubmit={handleSave} className="flex flex-col gap-6">

          {/* Basic info */}
          <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-navy mb-4">Personal Information</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-muted uppercase tracking-wide">First name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="profile-input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-muted uppercase tracking-wide">Last name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)}
                  className="profile-input" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-brand-muted uppercase tracking-wide">Email</label>
              <input value={user?.email ?? ''} disabled
                className="profile-input opacity-50 cursor-not-allowed" />
              <p className="text-xs text-brand-muted">Email cannot be changed.</p>
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-brand-muted uppercase tracking-wide">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="(555) 000-0000" className="profile-input" />
            </div>

            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs text-brand-muted uppercase tracking-wide">Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder="123 Main St" className="profile-input" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 col-span-1">
                <label className="text-xs text-brand-muted uppercase tracking-wide">City</label>
                <input value={city} onChange={e => setCity(e.target.value)}
                  placeholder="New York" className="profile-input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-muted uppercase tracking-wide">State</label>
                <input value={state} onChange={e => setState(e.target.value.toUpperCase())}
                  placeholder="NY" maxLength={2} className="profile-input" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-brand-muted uppercase tracking-wide">ZIP</label>
                <input value={zip} onChange={e => setZip(e.target.value)}
                  placeholder="10001" className="profile-input" />
              </div>
            </div>
          </section>

          {/* Tradesperson-only section */}
          {isTrade && (
            <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-navy mb-4">Trade Profile</h2>

              <div className="flex flex-col gap-1.5 mb-4">
                <label className="text-xs text-brand-muted uppercase tracking-wide">Trade Category</label>
                <input value={tradeCategory} onChange={e => setTradeCategory(e.target.value)}
                  placeholder="e.g. Plumbing, Electrical…" className="profile-input" />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-brand-muted uppercase tracking-wide">License Number</label>
                  <input value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)}
                    className="profile-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-brand-muted uppercase tracking-wide">License State</label>
                  <input value={licenseState} onChange={e => setLicenseState(e.target.value)}
                    placeholder="NY" className="profile-input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-brand-muted uppercase tracking-wide">License Expiry</label>
                  <input type="date" value={licenseExpiry} onChange={e => setLicenseExpiry(e.target.value)}
                    className="profile-input" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-brand-muted uppercase tracking-wide">Years of Experience</label>
                  <input type="number" value={experienceYears} onChange={e => setExperienceYears(e.target.value)}
                    min={0} placeholder="4" className="profile-input" />
                </div>
              </div>
            </section>
          )}

          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving}
              className="px-8 py-3 bg-brand-navy text-white font-semibold rounded-xl hover:bg-brand-steel disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saved && <p className="text-green-600 text-sm font-medium animate-fade-in">✓ Saved!</p>}
            {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
          </div>
        </form>

        <style jsx global>{`
          .profile-input {
            width: 100%; padding: 0.625rem 0.875rem;
            border: 1px solid #e5e7eb; border-radius: 0.75rem;
            font-size: 0.875rem; color: #0D1B2A;
            transition: border-color 0.2s;
          }
          .profile-input:focus { outline: none; border-color: #00B4D8; }
        `}</style>
      </div>
    </DashboardLayout>
  )
}
