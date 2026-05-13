import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-navy text-white overflow-hidden">
      {/* ── Nav ── */}
      <nav className="flex items-center justify-between px-8 py-6">
        <span className="font-display text-2xl text-teal">TradeConnect</span>
        <div className="flex gap-4">
          <Link href="/login"
            className="px-4 py-2 rounded-lg border border-white/20 hover:border-teal hover:text-teal transition-colors text-sm font-medium">
            Log in
          </Link>
          <Link href="/register"
            className="px-4 py-2 rounded-lg bg-teal text-navy font-semibold text-sm hover:opacity-90 transition-opacity">
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative px-8 pt-20 pb-32 max-w-5xl mx-auto">
        {/* Decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-teal/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative animate-fade-up">
          <p className="text-teal text-sm font-semibold uppercase tracking-widest mb-4">
            Skilled Trades Platform
          </p>
          <h1 className="font-display text-6xl md:text-7xl leading-tight mb-6">
            Work that gets<br />
            <span className="italic text-teal">done right.</span>
          </h1>
          <p className="text-white/60 text-xl max-w-xl mb-10">
            TradeConnect pairs verified tradespeople with employers who need real skills —
            plumbing, electrical, and more. Trusted. Local. Professional.
          </p>
          <Link href="/register"
            className="inline-block px-8 py-4 bg-amber text-navy font-semibold rounded-xl text-lg hover:opacity-90 transition-opacity">
            Find a tradesperson →
          </Link>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-steel px-8 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-4xl mb-12 text-center">Four steps to get started</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { n: '01', title: 'Set your role',        desc: 'Employer, tradesperson, or junior apprentice.' },
              { n: '02', title: 'Build your profile',   desc: 'Upload your licence, certs, and availability.' },
              { n: '03', title: 'Post or browse jobs',  desc: 'Employers post. Tradespeople apply. Simple.' },
              { n: '04', title: 'Connect & rate',       desc: 'Complete the job and leave a review.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex flex-col gap-3">
                <span className="font-display text-5xl text-teal/40">{n}</span>
                <h3 className="font-semibold text-lg">{title}</h3>
                <p className="text-white/50 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── User types ── */}
      <section className="px-8 py-20 max-w-5xl mx-auto">
        <h2 className="font-display text-4xl mb-12 text-center">Who is it for?</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { role: 'Employer / Contractor', color: 'border-teal',  desc: 'Post jobs, browse verified tradespeople, hire and pay with confidence.' },
            { role: 'Skilled Tradesperson',  color: 'border-amber', desc: 'Set your region, list your services, and get matched with quality work.' },
            { role: 'Junior / Apprentice',   color: 'border-purple-400', desc: 'Upload training docs, get endorsed by a senior, and level up over time.' },
          ].map(({ role, color, desc }) => (
            <div key={role} className={`border ${color} border-opacity-50 rounded-2xl p-6 bg-steel/40 backdrop-blur`}>
              <h3 className="font-semibold text-lg mb-3">{role}</h3>
              <p className="text-white/50 text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-teal text-navy px-8 py-16 text-center">
        <h2 className="font-display text-4xl mb-4">Ready to get connected?</h2>
        <p className="mb-8 text-navy/70">Join TradeConnect today — it's free to get started.</p>
        <Link href="/register"
          className="inline-block px-8 py-4 bg-navy text-white font-semibold rounded-xl text-lg hover:opacity-90 transition-opacity">
          Create your account
        </Link>
      </section>

      <footer className="bg-navy border-t border-white/10 px-8 py-6 text-center text-white/30 text-sm">
        © 2026 TradeConnect · Skilled trades platform
      </footer>
    </main>
  )
}
