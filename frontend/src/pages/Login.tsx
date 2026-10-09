import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('admin@dentor.in')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Enter your email / user ID and password.')
      return
    }
    setLoading(true)
    try {
      await login(email.trim(), password, remember)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* Brand panel (desktop) */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-ink-900 p-10 text-white lg:flex">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
            <svg viewBox="0 0 32 32" className="h-6 w-6 fill-white">
              <path d="M16 4c-4.4 0-8 3.2-8 7.6 0 3 1.1 5 2.1 7.4.9 2 1.5 5.4 2 7.6.3 1.1 1.7 1.2 2.2.1l1.2-5.1c.2-.6.9-.6 1 0l1.2 5.1c.4 1.1 1.9 1 2.2-.1.5-2.2 1.1-5.6 2-7.6 1-2.4 2.1-4.4 2.1-7.4C24 7.2 20.4 4 16 4z" />
            </svg>
          </span>
          <div>
            <div className="text-xl font-bold tracking-tight">DENTOR</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-300">
              Clinical Management Ecosystem
            </div>
          </div>
        </div>
        <div className="relative max-w-md">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-brand-300">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" /> LIVE CLINIC COMMAND CENTRE
          </p>
          <h1 className="text-4xl font-bold leading-tight">
            Smarter dentistry <span className="text-brand-300">starts here.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            One secure workspace for clinical care, patients, appointments, prescriptions, billing and
            real-time clinic operations.
          </p>
        </div>
        <div className="relative flex gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">✓ Protected access</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">✓ Session timeout</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">✓ Clinical data privacy</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
              <svg viewBox="0 0 32 32" className="h-6 w-6 fill-white">
                <path d="M16 4c-4.4 0-8 3.2-8 7.6 0 3 1.1 5 2.1 7.4.9 2 1.5 5.4 2 7.6.3 1.1 1.7 1.2 2.2.1l1.2-5.1c.2-.6.9-.6 1 0l1.2 5.1c.4 1.1 1.9 1 2.2-.1.5-2.2 1.1-5.6 2-7.6 1-2.4 2.1-4.4 2.1-7.4C24 7.2 20.4 4 16 4z" />
              </svg>
            </span>
            <div>
              <div className="text-lg font-bold text-slate-900">DENTOR</div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-brand-700">
                Clinic Management
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-800">
              <ShieldCheck className="h-3 w-3" /> Secure clinic access
            </span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Enter your administrator credentials to continue.</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
              <Field label="Email or User ID" required>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    placeholder="you@clinic.in"
                  />
                </div>
              </Field>
              <Field label="Password" required>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    placeholder="••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:text-slate-600"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <div className="flex items-center justify-between text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 accent-brand-700"
                  />
                  Keep me signed in
                </label>
              </div>

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Login to Dashboard →
              </Button>
            </form>

            {/* Demo credentials exist only in development (SEED_DEMO) — never advertise them in production builds. */}
            {import.meta.env.DEV && (
            <div className="mt-6 grid gap-2 text-xs leading-relaxed text-slate-600 sm:grid-cols-2">
              <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-3.5 py-3">
                <b className="text-brand-800">Clinic admin</b>
                <br />
                admin@dentor.in
                <br />
                Dentor@2026
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                <b className="text-slate-700">Super admin</b>
                <br />
                superadmin@dentor.in
                <br />
                SuperAdmin@2026
              </div>
            </div>
            )}
            <p className="mt-4 text-center text-[11px] text-slate-400">
              256-bit encrypted session · Authorized clinic personnel only
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
