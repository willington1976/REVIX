import { useState, useEffect } from 'react'
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { useAuth } from '../contexts/AuthContext'
import { TopBar, AppFooter } from '../components/AppShell'
import { useNavigate } from 'react-router-dom'

const AIRPORTS_CO = [
  { code:'EYP', name:'El Yopal' }, { code:'BOG', name:'El Dorado (Bogotá)' },
  { code:'MDE', name:'José María Córdova (Medellín)' }, { code:'CLO', name:'Alfonso B. Aragón (Cali)' },
  { code:'BAQ', name:'Ernesto Cortissoz (Barranquilla)' }, { code:'CTG', name:'Rafael Núñez (Cartagena)' },
  { code:'BGA', name:'Palonegro (Bucaramanga)' }, { code:'PEI', name:'Matecaña (Pereira)' },
  { code:'SMR', name:'Simón Bolívar (Santa Marta)' }, { code:'ADZ', name:'Gustavo Rojas (San Andrés)' },
  { code:'MTR', name:'Los Garzones (Montería)' }, { code:'UIB', name:'El Caraño (Quibdó)' },
  { code:'TCO', name:'La Florida (Tumaco)' }, { code:'LET', name:'Alfredo Vásquez (Leticia)' },
  { code:'VVC', name:'Vanguardia (Villavicencio)' }, { code:'CUC', name:'Camilo Daza (Cúcuta)' },
  { code:'MZL', name:'La Nubia (Manizales)' }, { code:'AXM', name:'El Edén (Armenia)' },
  { code:'PSO', name:'Antonio Nariño (Pasto)' }, { code:'IBE', name:'Perales (Ibagué)' },
  { code:'NVA', name:'La Marquerita (Neiva)' }, { code:'GIR', name:'Santiago Vila (Girardot)' },
  { code:'SVI', name:'Eduardo Falla (San Vicente)' }, { code:'RCH', name:'Almirante Padilla (Riohacha)' },
  { code:'PCR', name:'German Olano (Puerto Carreno)' }, { code:'MVP', name:'Fabio León Numpaque (Mitu)' },
  { code:'PDA', name:'Obando (Puerto Inírida)' }, { code:'ECO', name:'El Embrujo (Providencia)' },
  { code:'APO', name:'Antonio Roldán Betancourt (Apartadó)' }, { code:'TLU', name:'Golfo de Morrosquillo (Tolú)' },
  { code:'CSR', name:'Casuarito' }, { code:'ACD', name:'Alcides Fernández (Acandí)' },
  { code:'CPB', name:'Capurganá' }, { code:'TIB', name:'Tibú' }, { code:'ORC', name:'Orocué' }, { code:'HAV', name:'Hacarí' },
]

const secondaryApp = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}, 'secondary')
const secondaryAuth = getAuth(secondaryApp)

const ROLE_CFG = {
  superadmin: { label:'Super Admin', color:'#F59E0B', bg:'#451A03' },
  admin:      { label:'Admin',       color:'#60A5FA', bg:'#1E3A5F' },
  inspector:  { label:'Inspector',   color:'#4ADE80', bg:'#052E16' },
}

const inputStyle = {
  width:'100%', background:'#111827', border:'1px solid rgba(255,255,255,0.12)',
  color:'#F1F5F9', borderRadius:10, padding:'0 16px', fontSize:14,
  minHeight:48, outline:'none', fontFamily:'Inter,sans-serif'
}
const selectStyle = { ...inputStyle, cursor:'pointer' }

export default function UserManagement() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [sheet, setSheet] = useState(null) // user object for bottom sheet
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'inspector', airportCode:'', airportName:'' })

  const isSuperAdmin = profile?.role === 'superadmin'
  const isAdmin = profile?.role === 'admin' || isSuperAdmin
  const [confirmDelete2, setConfirmDelete2] = useState(null)

  useEffect(() => { loadUsers() }, [])

  const loadUsers = async () => {
    setLoading(true)
    const snap = await getDocs(collection(db,'users'))
    const all = snap.docs.map(d=>({id:d.id,...d.data()}))
    setUsers(isSuperAdmin ? all : all.filter(u=>u.airportCode===profile.airportCode))
    setLoading(false)
  }

  const set = (k,v) => setForm(p=>({...p,[k]:v}))
  const handleAirportChange = (code) => {
    const a = AIRPORTS_CO.find(a=>a.code===code)
    set('airportCode',code); set('airportName',a?.name||code)
  }

  const handleCreate = async () => {
    if (!form.name||!form.email||!form.password||!form.airportCode) { alert('Completa todos los campos'); return }
    setCreating(true)
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, form.email, form.password)
      await setDoc(doc(db,'users',cred.user.uid), {
        name:form.name, email:form.email, role:form.role,
        airportCode:form.airportCode, airportName:form.airportName,
        createdAt:new Date().toISOString(),
      })
      await secondaryAuth.signOut()
      setShowForm(false)
      setForm({name:'',email:'',password:'',role:'inspector',airportCode:'',airportName:''})
      loadUsers()
    } catch(err) {
      alert(err.code==='auth/email-already-in-use' ? 'Correo ya registrado' : 'Error: '+err.message)
    } finally { setCreating(false) }
  }

  const handleTransfer = async (userId, newCode) => {
    const a = AIRPORTS_CO.find(a=>a.code===newCode)
    await updateDoc(doc(db,'users',userId), { airportCode:newCode, airportName:a?.name||newCode })
    setSheet(null); loadUsers()
  }

  const handleChangeRole = async (userId, newRole) => {
    await updateDoc(doc(db,'users',userId), { role:newRole })
    setSheet(null); loadUsers()
  }

  const handleToggleActive = async (u) => {
    await updateDoc(doc(db,'users',u.id), { active:!(u.active!==false) })
    setSheet(null); loadUsers()
  }

  const handleDeleteUser = async (u) => {
    await deleteDoc(doc(db,'users',u.id))
    setConfirmDelete(null); setSheet(null); loadUsers()
  }

  const grouped = users.reduce((acc,u) => {
    const k = u.airportCode||'Sin aeropuerto'
    if (!acc[k]) acc[k]=[]
    acc[k].push(u)
    return acc
  }, {})

  // ── NEW USER FORM ─────────────────────────────────────
  if (showForm) return (
    <div style={{minHeight:'100vh',background:'#111827',paddingBottom:80}}>
      <TopBar title="Nuevo usuario" back/>
      <div style={{padding:'20px 16px',display:'flex',flexDirection:'column',gap:16}}>

        {/* Role selector */}
        <div>
          <p style={{fontSize:11,fontWeight:500,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Rol</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
            {[
              {v:'inspector',l:'Inspector',icon:'🔍'},
              {v:'admin',    l:'Admin',    icon:'⚙️'},
              ...(isSuperAdmin?[{v:'superadmin',l:'Super Admin',icon:'👑'}]:[]),
            ].map(r => {
              const cfg = ROLE_CFG[r.v]
              const active = form.role===r.v
              return (
                <button key={r.v} onClick={()=>set('role',r.v)}
                  style={{padding:'12px 8px',borderRadius:10,cursor:'pointer',textAlign:'center',
                          background:active?cfg.bg:'#1E293B',
                          border:`1px solid ${active?cfg.color:'rgba(255,255,255,0.10)'}`,
                          transition:'all .15s'}}>
                  <span style={{fontSize:18,display:'block',marginBottom:4}}>{r.icon}</span>
                  <span style={{fontSize:11,fontWeight:600,color:active?cfg.color:'#64748B'}}>{r.l}</span>
                </button>
              )
            })}
          </div>
        </div>

        {[
          {label:'Nombre completo', key:'name', placeholder:'Pedro García', type:'text'},
          {label:'Correo electrónico', key:'email', placeholder:'inspector@aerocivil.gov.co', type:'email'},
          {label:'Contraseña temporal', key:'password', placeholder:'Mínimo 6 caracteres', type:'password'},
        ].map(f => (
          <div key={f.key}>
            <p style={{fontSize:11,fontWeight:500,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>{f.label}</p>
            <input type={f.type} value={form[f.key]} onChange={e=>set(f.key,e.target.value)}
              placeholder={f.placeholder} style={inputStyle}/>
          </div>
        ))}

        <div>
          <p style={{fontSize:11,fontWeight:500,color:'#64748B',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Aeropuerto</p>
          <select value={form.airportCode} onChange={e=>handleAirportChange(e.target.value)} style={selectStyle}>
            <option value="">Selecciona aeropuerto</option>
            {AIRPORTS_CO.map(a=><option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
          </select>
        </div>

        {/* Preview */}
        {form.name && form.airportCode && (
          <div style={{background:'#1E293B',border:'1px solid rgba(255,255,255,0.10)',borderRadius:12,padding:16,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:40,height:40,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',
                         background:ROLE_CFG[form.role].bg,flexShrink:0}}>
              <span style={{fontSize:16,fontWeight:700,color:ROLE_CFG[form.role].color}}>
                {form.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p style={{fontSize:14,fontWeight:600,color:'#F1F5F9',margin:0}}>{form.name}</p>
              <p style={{fontSize:12,color:'#64748B',margin:'2px 0 0'}}>{form.email||'—'}</p>
            </div>
            <span style={{marginLeft:'auto',fontSize:11,fontWeight:600,padding:'3px 8px',borderRadius:6,
                          background:ROLE_CFG[form.role].bg,color:ROLE_CFG[form.role].color}}>
              {ROLE_CFG[form.role].label}
            </span>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:4}}>
          <button onClick={()=>setShowForm(false)}
            style={{minHeight:48,borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',
                    background:'transparent',color:'#64748B',fontWeight:500,fontSize:14,cursor:'pointer'}}>
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={creating}
            style={{minHeight:48,borderRadius:10,border:'none',background:'#1D6FE8',
                    color:'white',fontWeight:600,fontSize:14,cursor:'pointer',opacity:creating?.7:1}}>
            {creating?'Creando...':'Crear usuario'}
          </button>
        </div>
      </div>
      <AppFooter/>
    </div>
  )

  // ── MAIN LIST ─────────────────────────────────────────
  return (
    <div style={{minHeight:'100vh',background:'#111827',paddingBottom:80}}>
      <TopBar title="Gestión de Usuarios"
        back
        right={
          <button onClick={()=>setShowForm(true)}
            style={{width:36,height:36,borderRadius:8,border:'none',background:'#1D6FE8',
                    color:'white',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            +
          </button>
        }
      />

      {/* Summary */}
      <div style={{padding:'16px 16px 8px',display:'flex',gap:8}}>
        <div style={{flex:1,background:'#1E293B',border:'1px solid rgba(255,255,255,0.10)',borderRadius:12,padding:'12px 16px'}}>
          <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:24,fontWeight:700,color:'#F1F5F9',margin:0}}>{users.length}</p>
          <p style={{fontSize:11,color:'#64748B',margin:'2px 0 0',textTransform:'uppercase',letterSpacing:'0.06em'}}>Usuarios activos</p>
        </div>
        <div style={{flex:1,background:'#1E293B',border:'1px solid rgba(255,255,255,0.10)',borderRadius:12,padding:'12px 16px'}}>
          <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:24,fontWeight:700,color:'#60A5FA',margin:0}}>{Object.keys(grouped).length}</p>
          <p style={{fontSize:11,color:'#64748B',margin:'2px 0 0',textTransform:'uppercase',letterSpacing:'0.06em'}}>Aeropuertos</p>
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div style={{padding:'8px 16px',display:'flex',flexDirection:'column',gap:8}}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:72}}/>)}
        </div>
      ) : (
        <div style={{padding:'8px 16px',display:'flex',flexDirection:'column',gap:20}}>
          {Object.entries(grouped).map(([code, airportUsers]) => (
            <div key={code}>
              <p style={{fontSize:11,fontWeight:500,color:'#334155',textTransform:'uppercase',
                         letterSpacing:'0.08em',marginBottom:8,fontFamily:'JetBrains Mono,monospace'}}>
                {code} · {AIRPORTS_CO.find(a=>a.code===code)?.name||code}
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:2}}>
                {airportUsers.map(u => {
                  const cfg = ROLE_CFG[u.role]||ROLE_CFG.inspector
                  const isMe = u.id === user?.uid
                  return (
                    <div key={u.id}
                      style={{background:'#1E293B',border:'1px solid rgba(255,255,255,0.10)',
                              borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,
                              opacity:u.active===false?0.5:1}}>
                      {/* Avatar */}
                      <div style={{width:42,height:42,borderRadius:10,flexShrink:0,
                                   display:'flex',alignItems:'center',justifyContent:'center',
                                   background:cfg.bg,border:`1px solid ${cfg.color}33`}}>
                        <span style={{fontSize:16,fontWeight:700,color:cfg.color}}>
                          {u.name?.charAt(0)?.toUpperCase()||'?'}
                        </span>
                      </div>
                      {/* Info */}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <p style={{fontSize:14,fontWeight:600,color:'#F1F5F9',margin:0,
                                     overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {u.name}
                          </p>
                          {isMe && <span style={{fontSize:10,color:'#475569'}}>(tú)</span>}
                        </div>
                        <p style={{fontSize:12,color:'#64748B',margin:'2px 0 0',
                                   overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {u.email}
                        </p>
                        <div style={{display:'flex',gap:6,marginTop:6}}>
                          <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,
                                        background:cfg.bg,color:cfg.color}}>
                            {cfg.label}
                          </span>
                          {u.active===false && (
                            <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:6,
                                          background:'#1C1A07',color:'#D97706'}}>
                              INACTIVO
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Three dots — only for non-self and admin */}
                      {isAdmin && !isMe && (
                        <button onClick={()=>setSheet(u)}
                          style={{width:36,height:36,borderRadius:8,border:'1px solid rgba(255,255,255,0.12)',
                                  background:'rgba(255,255,255,0.04)',cursor:'pointer',
                                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
                                  color:'#64748B',fontSize:18,fontWeight:700}}>
                          ⋮
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {users.length===0&&!loading&&(
            <p style={{textAlign:'center',color:'#334155',fontSize:13,padding:'48px 0'}}>Sin usuarios registrados</p>
          )}
        </div>
      )}

      {/* BOTTOM SHEET */}
      {sheet && (
        <div className="backdrop" onClick={()=>setSheet(null)}>
          <div className="bottom-sheet" onClick={e=>e.stopPropagation()}>
            <div className="sheet-handle"/>

            {/* User info in sheet */}
            <div style={{padding:'0 20px 16px',borderBottom:'1px solid rgba(255,255,255,0.10)'}}>
              <p style={{fontSize:15,fontWeight:600,color:'#F1F5F9',margin:0}}>{sheet.name}</p>
              <p style={{fontSize:12,color:'#64748B',margin:'2px 0 0'}}>{sheet.email}</p>
              <p style={{fontSize:11,fontWeight:600,marginTop:6,fontFamily:'JetBrains Mono,monospace',color:'#475569'}}>
                {sheet.airportCode} · {ROLE_CFG[sheet.role]?.label}
              </p>
            </div>

            {/* Change role */}
            {isSuperAdmin && (
              <div style={{padding:'8px 20px',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                <p style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em',margin:'8px 0 10px'}}>Cambiar rol</p>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                  {['inspector','admin','superadmin'].map(r => {
                    const cfg = ROLE_CFG[r]
                    const active = sheet.role===r
                    return (
                      <button key={r} onClick={()=>handleChangeRole(sheet.id,r)}
                        style={{padding:'8px 4px',borderRadius:8,cursor:'pointer',textAlign:'center',
                                background:active?cfg.bg:'rgba(255,255,255,0.03)',
                                border:`1px solid ${active?cfg.color:'rgba(255,255,255,0.10)'}`,
                                fontSize:11,fontWeight:600,color:active?cfg.color:'#64748B'}}>
                        {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Transfer */}
            {isSuperAdmin && (
              <div style={{padding:'8px 20px',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                <p style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em',margin:'8px 0 10px'}}>Trasladar a</p>
                <select onChange={e=>e.target.value&&handleTransfer(sheet.id,e.target.value)}
                  defaultValue=""
                  style={{...selectStyle,minHeight:40,fontSize:13}}>
                  <option value="">Selecciona aeropuerto</option>
                  {AIRPORTS_CO.filter(a=>a.code!==sheet.airportCode).map(a=>(
                    <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Actions */}
            <div>
              <div className="sheet-action" onClick={()=>handleToggleActive(sheet)}>
                <span style={{fontSize:18}}>{sheet.active===false?'✅':'⏸'}</span>
                <span>{sheet.active===false?'Activar usuario':'Desactivar usuario'}</span>
              </div>
              {isSuperAdmin && (
                <div className="sheet-action danger" onClick={()=>{ setConfirmDelete(sheet); setSheet(null) }}>
                  <span style={{fontSize:18}}>🗑</span>
                  <span>Eliminar usuario</span>
                </div>
              )}
              <div className="sheet-action" onClick={()=>setSheet(null)}
                   style={{color:'#475569',borderTop:'1px solid rgba(255,255,255,0.04)'}}>
                <span style={{fontSize:18}}>✕</span>
                <span>Cancelar</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="backdrop">
          <div style={{background:'#243044',border:'1px solid rgba(220,38,38,0.3)',borderRadius:'20px 20px 0 0',
                       width:'100%',maxWidth:480,padding:'24px 20px 32px'}}>
            <p style={{fontSize:16,fontWeight:700,color:'#F87171',margin:'0 0 6px'}}>⚠ Eliminar usuario</p>
            <p style={{fontSize:14,color:'#94A3B8',margin:'0 0 4px'}}>
              ¿Eliminar a <strong style={{color:'#F1F5F9'}}>{confirmDelete.name}</strong>?
            </p>
            <p style={{fontSize:12,color:'#475569',margin:'0 0 20px'}}>
              Esta acción es permanente. Los informes generados no se ven afectados.
            </p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <button onClick={()=>setConfirmDelete(null)}
                style={{minHeight:48,borderRadius:10,border:'1px solid rgba(255,255,255,0.12)',
                        background:'transparent',color:'#64748B',fontWeight:500,fontSize:14,cursor:'pointer'}}>
                Cancelar
              </button>
              <button onClick={()=>handleDeleteUser(confirmDelete)}
                style={{minHeight:48,borderRadius:10,border:'none',background:'#DC2626',
                        color:'white',fontWeight:600,fontSize:14,cursor:'pointer'}}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <AppFooter/>
    </div>
  )
}
