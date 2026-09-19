import { useState } from 'react'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { TopBar, AppFooter } from '../components/AppShell'

const ROLE_CFG = {
  superadmin:{label:'Super Admin',color:'#F59E0B',bg:'#451A03'},
  admin:     {label:'Administrador',color:'#60A5FA',bg:'#1E3A5F'},
  inspector: {label:'Inspector',color:'#4ADE80',bg:'#052E16'},
}
const inp = {
  width:'100%', background:'#0A0F1E', border:'1px solid rgba(255,255,255,0.08)',
  color:'#F1F5F9', borderRadius:10, padding:'0 16px', fontSize:14,
  minHeight:48, outline:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box'
}
const lbl = {fontSize:11,fontWeight:500,color:'#64748B',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.08em'}

const EyeBtn = ({show,onToggle}) => (
  <button type="button" onClick={onToggle}
    style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
            background:'none',border:'none',cursor:'pointer',color:'#475569',padding:4}}>
    {show
      ? <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
      : <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    }
  </button>
)

export default function MyAccount() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const cfg = ROLE_CFG[profile?.role] || ROLE_CFG.inspector

  const [cur, setCur] = useState('')
  const [nw, setNw] = useState('')
  const [conf, setConf] = useState('')
  const [showCur, setShowCur] = useState(false)
  const [showNw, setShowNw] = useState(false)
  const [showConf, setShowConf] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleChange = async () => {
    setMsg(null)
    if (!cur||!nw||!conf) { setMsg({t:'err',v:'Completa todos los campos'}); return }
    if (nw.length<6)       { setMsg({t:'err',v:'Mínimo 6 caracteres'}); return }
    if (nw!==conf)         { setMsg({t:'err',v:'Las contraseñas no coinciden'}); return }
    setSaving(true)
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, cur))
      await updatePassword(user, nw)
      setMsg({t:'ok',v:'Contraseña actualizada'})
      setCur(''); setNw(''); setConf('')
    } catch(err) {
      setMsg({t:'err', v: err.code==='auth/wrong-password'||err.code==='auth/invalid-credential'
        ? 'Contraseña actual incorrecta' : 'Error: '+err.message})
    } finally { setSaving(false) }
  }

  return (
    <div style={{minHeight:'100vh', background:'#0A0F1E', paddingBottom:80}}>
      <TopBar title="Mi cuenta" back/>
      <div style={{padding:'20px 16px', display:'flex', flexDirection:'column', gap:12}}>

        {/* Profile card */}
        <div style={{background:'#111827', border:'1px solid rgba(255,255,255,0.06)',
                     borderRadius:16, padding:20, display:'flex', alignItems:'center', gap:16}}>
          <div style={{width:56, height:56, borderRadius:14, display:'flex', alignItems:'center',
                       justifyContent:'center', background:cfg.bg, border:`1px solid ${cfg.color}33`,
                       flexShrink:0}}>
            <span style={{fontSize:22, fontWeight:700, color:cfg.color}}>
              {profile?.name?.charAt(0)?.toUpperCase()||'?'}
            </span>
          </div>
          <div style={{flex:1, minWidth:0}}>
            <p style={{fontSize:17, fontWeight:700, color:'#F1F5F9', margin:0,
                       letterSpacing:'-0.01em'}}>{profile?.name}</p>
            <p style={{fontSize:12, color:'#64748B', margin:'3px 0 8px',
                       overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{user?.email}</p>
            <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
              <span style={{fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:6,
                            background:cfg.bg, color:cfg.color}}>{cfg.label}</span>
              <span style={{fontSize:11, fontWeight:600, padding:'3px 8px', borderRadius:6,
                            background:'rgba(255,255,255,0.04)', color:'#64748B',
                            fontFamily:'JetBrains Mono,monospace'}}>
                {profile?.airportCode} · {profile?.airportName}
              </span>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div style={{background:'#111827', border:'1px solid rgba(255,255,255,0.06)',
                     borderRadius:16, padding:20, display:'flex', flexDirection:'column', gap:14}}>
          <p style={{fontSize:13, fontWeight:600, color:'#94A3B8', margin:0}}>Cambiar contraseña</p>

          {[
            {label:'Contraseña actual', v:cur, set:setCur, show:showCur, toggle:()=>setShowCur(p=>!p)},
            {label:'Nueva contraseña',  v:nw,  set:setNw,  show:showNw,  toggle:()=>setShowNw(p=>!p)},
            {label:'Confirmar nueva',   v:conf, set:setConf, show:showConf, toggle:()=>setShowConf(p=>!p)},
          ].map(f=>(
            <div key={f.label}>
              <label style={lbl}>{f.label}</label>
              <div style={{position:'relative'}}>
                <input type={f.show?'text':'password'} value={f.v}
                  onChange={e=>f.set(e.target.value)} placeholder="••••••••"
                  style={{...inp, paddingRight:44}}/>
                <EyeBtn show={f.show} onToggle={f.toggle}/>
              </div>
            </div>
          ))}

          {msg && (
            <div style={{borderRadius:8, padding:'10px 14px',
                         background:msg.t==='ok'?'rgba(21,128,61,0.08)':'rgba(220,38,38,0.08)',
                         border:`1px solid ${msg.t==='ok'?'rgba(74,222,128,0.2)':'rgba(248,113,113,0.2)'}`}}>
              <p style={{fontSize:13, color:msg.t==='ok'?'#4ADE80':'#F87171', margin:0}}>
                {msg.t==='ok'?'✓ ':''}{msg.v}
              </p>
            </div>
          )}

          <button onClick={handleChange} disabled={saving}
            style={{minHeight:48, borderRadius:10, border:'none', background:'#1D6FE8',
                    color:'white', fontWeight:600, fontSize:14, cursor:'pointer',
                    opacity:saving?0.7:1, fontFamily:'Inter,sans-serif'}}>
            {saving?'Actualizando...':'Actualizar contraseña'}
          </button>
        </div>

        {/* App info */}
        <div style={{background:'#111827', border:'1px solid rgba(255,255,255,0.06)',
                     borderRadius:16, padding:20}}>
          <p style={{fontSize:13, fontWeight:600, color:'#94A3B8', margin:'0 0 14px'}}>Información del sistema</p>
          {[
            ['Aplicación','REVIX v1.0'],
            ['Sistema','Inspección ARFF · UAEAC'],
            ['Aeropuerto',`${profile?.airportCode} · ${profile?.airportName}`],
            ['Rol',cfg.label],
          ].map(([k,v])=>(
            <div key={k} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                                  padding:'10px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
              <span style={{fontSize:13,color:'#475569'}}>{k}</span>
              <span style={{fontSize:13,fontWeight:500,color:'#94A3B8',fontFamily:k==='Aeropuerto'?'JetBrains Mono,monospace':'Inter,sans-serif'}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <AppFooter/>
    </div>
  )
}
