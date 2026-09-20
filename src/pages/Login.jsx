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
    try { await login(email, password); navigate('/') }
    catch { setError('Correo o contraseña incorrectos') }
    finally { setLoading(false) }
  }

  const inp = {
    width:'100%', background:'#111827', border:'1px solid rgba(255,255,255,0.12)',
    color:'#F1F5F9', borderRadius:10, padding:'0 16px', fontSize:14,
    minHeight:48, outline:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box'
  }

  return (
    <div style={{minHeight:'100vh', background:'#111827', display:'flex', flexDirection:'column',
                 backgroundImage:'radial-gradient(ellipse at 50% 0%, rgba(29,111,232,0.08) 0%, transparent 60%)'}}>
      <div style={{height:2, background:'linear-gradient(90deg,#1D6FE8 0%,#15803D 100%)', opacity:0.7}}/>

      <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                   justifyContent:'center', padding:'0 24px'}}>

        {/* Logo */}
        <div style={{textAlign:'center', marginBottom:40}}>
          <div style={{width:72, height:72, borderRadius:18, overflow:'hidden',
                       border:'1px solid rgba(255,255,255,0.12)', margin:'0 auto 16px',
                       background:'#1E293B', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <img src="/pwa-192x192.png" alt="REVIX" style={{width:'100%', height:'100%', objectFit:'cover'}}
                 onError={e=>{ e.target.style.display='none' }}/>
          </div>
          <h1 style={{fontSize:28, fontWeight:700, color:'#F1F5F9', margin:0, letterSpacing:'-0.02em'}}>
            REVIX
          </h1>
          <p style={{fontSize:12, color:'#475569', margin:'6px 0 0',
                     fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.1em',
                     textTransform:'uppercase'}}>
            ARFF · UAEAC · Colombia
          </p>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit}
          style={{width:'100%', maxWidth:360, background:'#1E293B',
                  border:'1px solid rgba(255,255,255,0.10)', borderRadius:16, padding:24,
                  display:'flex', flexDirection:'column', gap:16}}>

          <div>
            <label style={{fontSize:11, fontWeight:500, color:'#64748B', display:'block',
                           marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em'}}>
              Correo electrónico
            </label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
              placeholder="inspector@aerocivil.gov.co" style={inp}/>
          </div>

          <div>
            <label style={{fontSize:11, fontWeight:500, color:'#64748B', display:'block',
                           marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em'}}>
              Contraseña
            </label>
            <div style={{position:'relative'}}>
              <input type={showPwd?'text':'password'} value={password}
                onChange={e=>setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{...inp, paddingRight:48}}/>
              <button type="button" onClick={()=>setShowPwd(p=>!p)}
                style={{position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                        background:'none', border:'none', cursor:'pointer', color:'#475569', padding:4}}>
                {showPwd
                  ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {error && (
            <div style={{background:'rgba(220,38,38,0.08)', border:'1px solid rgba(220,38,38,0.2)',
                         borderRadius:8, padding:'10px 14px'}}>
              <p style={{fontSize:13, color:'#F87171', margin:0}}>{error}</p>
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{minHeight:48, borderRadius:10, border:'none', background:'#1D6FE8',
                    color:'white', fontWeight:600, fontSize:15, cursor:'pointer',
                    opacity:loading?0.7:1, marginTop:4, fontFamily:'Inter,sans-serif'}}>
            {loading ? 'Verificando...' : 'Ingresar al sistema'}
          </button>
        </form>

        <p style={{fontSize:11, color:'#1E293B', margin:'24px 0 0',
                   fontFamily:'JetBrains Mono,monospace', letterSpacing:'0.08em',
                   textTransform:'uppercase'}}>
          Bomberos Aeronáuticos · Sistema de Inspección
        </p>
      </div>
    </div>
  )
}
