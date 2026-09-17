import { useState } from 'react'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { doc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { TopBar, AppFooter } from '../components/AppShell'

const ROLE_LABEL = { superadmin:'Super Admin', admin:'Administrador', inspector:'Bombero Inspector' }
const inputCls = "w-full bg-[#0F172A] border border-white/10 text-white rounded-xl px-4 text-sm focus:outline-none focus:border-[#2563EB] font-mono"
const BG = '#0F172A', CARD = '#1E293B', BLUE = '#2563EB', GREEN = '#16A34A', RED = '#DC2626'

export default function MyAccount() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [currentPwd, setCurrentPwd]   = useState('')
  const [newPwd, setNewPwd]           = useState('')
  const [confirmPwd, setConfirmPwd]   = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [msg, setMsg]                 = useState(null) // {type:'ok'|'err', text}

  const handleChangePassword = async () => {
    setMsg(null)
    if (!currentPwd || !newPwd || !confirmPwd) {
      setMsg({ type:'err', text:'Completa todos los campos' }); return
    }
    if (newPwd.length < 6) {
      setMsg({ type:'err', text:'La nueva contraseña debe tener al menos 6 caracteres' }); return
    }
    if (newPwd !== confirmPwd) {
      setMsg({ type:'err', text:'Las contraseñas nuevas no coinciden' }); return
    }
    setSaving(true)
    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPwd)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPwd)
      setMsg({ type:'ok', text:'Contraseña actualizada correctamente' })
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('')
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setMsg({ type:'err', text:'Contraseña actual incorrecta' })
      } else {
        setMsg({ type:'err', text:'Error: ' + err.message })
      }
    } finally {
      setSaving(false)
    }
  }

  const EyeBtn = ({ show, onToggle }) => (
    <button type="button" onClick={onToggle}
      style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
              background:'none',border:'none',cursor:'pointer',color:'#64748B',padding:4}}>
      {show ? (
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
  )

  return (
    <div className="min-h-screen pb-16" style={{background:BG}}>
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Mi cuenta" back/>

      <div className="px-4 py-5 space-y-4">
        {/* Profile card */}
        <div className="card-highlight rounded-2xl border border-white/8 p-5" style={{background:CARD}}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
                 style={{background:'#2563EB22', color:BLUE, border:'1px solid #2563EB33'}}>
              {profile?.name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-white font-bold text-base leading-tight">{profile?.name}</p>
              <p className="font-mono text-xs text-slate-500 mt-0.5">{user?.email}</p>
              <div className="flex gap-2 mt-1.5">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded"
                      style={{background:'#2563EB22', color:BLUE}}>
                  {ROLE_LABEL[profile?.role] || profile?.role}
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded"
                      style={{background:'#16A34A22', color:GREEN}}>
                  {profile?.airportCode} · {profile?.airportName}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="card-highlight rounded-2xl border border-white/8 p-5 space-y-4" style={{background:CARD}}>
          <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Cambiar contraseña</p>

          {[
            { label:'Contraseña actual', val:currentPwd, set:setCurrentPwd, show:showCurrent, toggle:()=>setShowCurrent(p=>!p) },
            { label:'Nueva contraseña',  val:newPwd,     set:setNewPwd,     show:showNew,     toggle:()=>setShowNew(p=>!p) },
            { label:'Confirmar nueva',   val:confirmPwd, set:setConfirmPwd, show:showConfirm, toggle:()=>setShowConfirm(p=>!p) },
          ].map(f => (
            <div key={f.label}>
              <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-2">{f.label}</label>
              <div style={{position:'relative'}}>
                <input
                  type={f.show ? 'text' : 'password'}
                  value={f.val}
                  onChange={e => f.set(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
                  style={{minHeight:48, paddingRight:44}}
                />
                <EyeBtn show={f.show} onToggle={f.toggle}/>
              </div>
            </div>
          ))}

          {msg && (
            <div className="rounded-xl px-4 py-3 border"
                 style={{background: msg.type==='ok' ? '#052E16' : '#450A0A',
                         borderColor: msg.type==='ok' ? '#16A34A44' : '#DC262644'}}>
              <p className="font-mono text-sm" style={{color: msg.type==='ok' ? GREEN : RED}}>
                {msg.type==='ok' ? '✓ ' : '⚠ '}{msg.text}
              </p>
            </div>
          )}

          <button onClick={handleChangePassword} disabled={saving}
            style={{minHeight:48, width:'100%', background:BLUE, color:'white',
                    borderRadius:12, border:'none', fontWeight:700, fontSize:14,
                    cursor:'pointer', opacity:saving?0.7:1}}>
            {saving ? 'Actualizando...' : 'Actualizar contraseña'}
          </button>
        </div>

        {/* App info */}
        <div className="card-highlight rounded-xl border border-white/8 p-4" style={{background:CARD}}>
          <p className="font-mono text-[10px] text-slate-600 uppercase tracking-widest mb-2">Información</p>
          {[
            ['Aplicación', 'REVIX v1.0'],
            ['Sistema', 'Inspección ARFF · UAEAC'],
            ['Aeropuerto', `${profile?.airportCode} · ${profile?.airportName}`],
          ].map(([k,v]) => (
            <div key={k} className="flex justify-between py-2 border-b border-white/5 last:border-0">
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">{k}</span>
              <span className="font-mono text-xs text-white">{v}</span>
            </div>
          ))}
        </div>
      </div>
      <AppFooter/>
    </div>
  )
}
