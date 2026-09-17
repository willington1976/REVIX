import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch {
      setError('Correo o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{background:'linear-gradient(160deg,#0F172A 60%,#1E293B 100%)'}}>
      <div className="h-1 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 overflow-hidden border border-white/10"
               style={{background:'#1E293B'}}>
            <img src="/pwa-192x192.png" alt="REVIX" className="w-full h-full object-cover"
                 onError={e => { e.target.style.display='none' }}/>
          </div>
          <h1 className="text-white text-3xl font-bold tracking-tight">REVIX</h1>
          <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mt-1">
            ARFF · UAEAC · Colombia
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="card-highlight rounded-2xl border border-white/8 p-6 space-y-4"
               style={{background:'#1E293B'}}>

            {/* Email */}
            <div>
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="inspector@aerocivil.gov.co"
                className="w-full bg-[#0F172A] border border-white/10 text-white rounded-xl px-4 text-sm focus:outline-none focus:border-[#2563EB] transition-colors font-mono"
                style={{minHeight:48}}
              />
            </div>

            {/* Password with eye */}
            <div>
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-[#0F172A] border border-white/10 text-white rounded-xl px-4 pr-12 text-sm focus:outline-none focus:border-[#2563EB] transition-colors"
                  style={{minHeight:48}}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                  style={{background:'none',border:'none',cursor:'pointer',padding:4}}>
                  {showPwd ? (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-950/60 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="font-mono text-sm text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full font-semibold rounded-xl text-sm transition-colors"
              style={{minHeight:48, background:'#2563EB', color:'white', opacity: loading ? 0.7 : 1}}>
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </div>
        </form>

        <p className="font-mono text-[10px] text-slate-700 uppercase tracking-widest mt-8">
          Bomberos Aeronáuticos · Sistema de Inspección
        </p>
      </div>
    </div>
  )
}
