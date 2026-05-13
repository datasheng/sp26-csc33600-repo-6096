'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authApi } from '@/lib/api'
import type { UserType } from '@/types'
import { getDashboardRoute } from '@/context/AuthContext'

const USER_TYPES: { value: UserType; label: string; desc: string }[] = [
  { value: 'Employer',     label: 'Employer / Contractor', desc: 'I need to hire tradespeople.' },
  { value: 'Tradesperson', label: 'Skilled Tradesperson',  desc: 'I offer professional trade services.' },
  { value: 'Junior',       label: 'Junior / Apprentice',   desc: 'I am learning under a senior tradesperson.' },
]

export default function RegisterPage() {
  const router = useRouter()
  const [step,      setStep]      = useState<1 | 2>(1)
  const [userType,  setUserType]  = useState<UserType | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [city,      setCity]      = useState('')
  const [state,     setState]     = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userType) return
    setError('')
    setLoading(true)
    try {
      await authApi.register({ first_name: firstName, last_name: lastName, email, password, user_type: userType, city, state })
      // Persist minimal user for session rehydration after login
      const userObj = { first_name: firstName, last_name: lastName, email, user_type: userType, city, state }
      localStorage.setItem('tc_user', JSON.stringify(userObj))
      router.push(getDashboardRoute(userType))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-navy flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <Link href="/" className="font-display text-3xl text-teal">TradeConnect</Link>
          <p className="text-white/40 mt-2 text-sm">Create your account</p>
        </div>

        <div className="bg-steel rounded-2xl p-8 shadow-xl border border-white/10 animate-fade-up">

          {/* Step 1 – pick role */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-display text-2xl text-white mb-2">Who are you?</h2>
              {USER_TYPES.map(ut => (
                <button
                  key={ut.value}
                  onClick={() => { setUserType(ut.value); setStep(2) }}
                  className={`text-left px-5 py-4 rounded-xl border transition-all ${
                    userType === ut.value
                      ? 'border-teal bg-teal/10 text-white'
                      : 'border-white/10 hover:border-white/30 text-white/70'
                  }`}
                >
                  <p className="font-semibold">{ut.label}</p>
                  <p className="text-sm text-white/40 mt-0.5">{ut.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2 – fill details */}
          {step === 2 && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-teal text-sm hover:underline text-left mb-1"
              >
                ← Change role
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-white/60">First name</label>
                  <input value={firstName} onChange={e => setFirstName(e.target.value)} required
                    className="input-field" placeholder="Alice" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-white/60">Last name</label>
                  <input value={lastName} onChange={e => setLastName(e.target.value)} required
                    className="input-field" placeholder="Smith" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-white/60">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="input-field" placeholder="you@example.com" />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-white/60">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="input-field" placeholder="Min. 8 characters" minLength={8} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-white/60">City</label>
                  <input value={city} onChange={e => setCity(e.target.value)}
                    className="input-field" placeholder="New York" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-white/60">State (2-letter)</label>
                  <input value={state} onChange={e => setState(e.target.value.toUpperCase())}
                    className="input-field" placeholder="NY" maxLength={2} />
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-teal text-navy font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
              >
                {loading ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          <p className="text-center text-white/40 text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-teal hover:underline">Sign in</Link>
          </p>
        </div>
      </div>

      {/* Shared input style via global CSS injection */}
      <style jsx global>{`
        .input-field {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          background: rgba(13,27,42,0.6);
          border: 1px solid rgba(255,255,255,0.1);
          color: white;
          font-size: 0.875rem;
          transition: border-color 0.2s;
        }
        .input-field:focus { outline: none; border-color: #00B4D8; }
        .input-field::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  )
}
