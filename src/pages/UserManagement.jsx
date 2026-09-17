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
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}, 'secondary')
const secondaryAuth = getAuth(secondaryApp)

const ROLE_CONFIG = {
  superadmin: { label:'Super Admin', color:'#F59E0B', bg:'#451A03' },
  admin:       { label:'Administrador', color:'#2563EB', bg:'#1E3A5F' },
  inspector:   { label:'Inspector', color:'#22C55E', bg:'#052E16' },
}

const inputCls = "w-full bg-[#0F172A] border border-white/10 text-white rounded-xl px-4 text-sm focus:outline-none focus:border-[#2563EB] transition-colors font-mono"
const selectCls = inputCls

function Field({ label, children }) {
  return (
    <div>
      <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-2">{label}</label>
      {children}
    </div>
  )
}

export default function UserManagement() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'inspector', airportCode:'', airportName:'' })
  const isSuperAdmin = profile?.role === 'superadmin'
  const isAdmin = profile?.role === 'admin' || isSuperAdmin

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
    const airport = AIRPORTS_CO.find(a=>a.code===code)
    set('airportCode', code)
    set('airportName', airport?.name||code)
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
      setForm({ name:'', email:'', password:'', role:'inspector', airportCode:'', airportName:'' })
      loadUsers()
    } catch(err) {
      alert(err.code==='auth/email-already-in-use' ? 'Correo ya registrado' : 'Error: '+err.message)
    } finally { setCreating(false) }
  }

  const handleTransfer = async (userId, newCode) => {
    const airport = AIRPORTS_CO.find(a=>a.code===newCode)
    await updateDoc(doc(db,'users',userId), { airportCode:newCode, airportName:airport?.name||newCode })
    loadUsers()
  }


  const handleDeleteUser = async (u) => {
    try {
      await deleteDoc(doc(db,'users',u.id))
      setConfirmDelete(null)
      loadUsers()
    } catch(err) { alert('Error: '+err.message) }
  }

  const handleToggleActive = async (u) => {
    await updateDoc(doc(db,'users',u.id), { active: !(u.active !== false) })
    loadUsers()
  }

  // Group users by airport
  const grouped = users.reduce((acc,u) => {
    const key = u.airportCode||'Sin aeropuerto'
    if (!acc[key]) acc[key]=[]
    acc[key].push(u)
    return acc
  }, {})

  if (showForm) return (
    <div className="min-h-screen bg-[#0F172A] pb-16">
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Nuevo Usuario" back/>

      <div className="px-4 py-5 space-y-4">
        {/* Role selector — visual cards */}
        <Field label="Rol">
          <div className="grid grid-cols-3 gap-2">
            {[
              { v:'inspector', l:'Inspector', icon:'🔍' },
              { v:'admin',     l:'Admin',     icon:'⚙️' },
              ...(isSuperAdmin ? [{ v:'superadmin', l:'SuperAdmin', icon:'👑' }] : []),
            ].map(r => {
              const cfg = ROLE_CONFIG[r.v]
              const active = form.role === r.v
              return (
                <button key={r.v} onClick={() => set('role', r.v)}
                  className="rounded-xl border p-3 text-center transition-all"
                  style={{
                    background: active ? cfg.bg : '#1E293B',
                    borderColor: active ? cfg.color : 'rgba(255,255,255,0.08)',
                    minHeight: 64,
                  }}>
                  <span className="text-xl block mb-1">{r.icon}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider"
                        style={{color: active ? cfg.color : '#64748B'}}>{r.l}</span>
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Nombre completo">
          <input value={form.name} onChange={e=>set('name',e.target.value)}
            placeholder="Pedro Bombero García"
            className={inputCls} style={{minHeight:48}}/>
        </Field>

        <Field label="Correo electrónico">
          <input type="email" value={form.email} onChange={e=>set('email',e.target.value)}
            placeholder="inspector@aerocivil.gov.co"
            className={inputCls} style={{minHeight:48}}/>
        </Field>

        <Field label="Contraseña temporal">
          <input type="password" value={form.password} onChange={e=>set('password',e.target.value)}
            placeholder="Mínimo 6 caracteres"
            className={inputCls} style={{minHeight:48}}/>
        </Field>

        <Field label="Aeropuerto asignado">
          <select value={form.airportCode} onChange={e=>handleAirportChange(e.target.value)}
            className={selectCls} style={{minHeight:48}}>
            <option value="">Selecciona aeropuerto</option>
            {AIRPORTS_CO.map(a=>(
              <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
            ))}
          </select>
        </Field>

        {/* Preview card */}
        {form.name && form.airportCode && (
          <div className="card-highlight rounded-xl border border-white/8 p-4" style={{background:'#1E293B'}}>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">Vista previa</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                   style={{background:ROLE_CONFIG[form.role].bg, color:ROLE_CONFIG[form.role].color}}>
                {form.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{form.name}</p>
                <p className="font-mono text-xs text-slate-500">{form.email||'—'} · {form.airportCode}</p>
              </div>
              <span className="ml-auto font-mono text-[10px] px-2 py-1 rounded"
                    style={{background:ROLE_CONFIG[form.role].bg, color:ROLE_CONFIG[form.role].color}}>
                {ROLE_CONFIG[form.role].label}
              </span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button onClick={() => setShowForm(false)}
            className="flex-1 border border-white/10 text-slate-500 hover:text-white font-mono rounded-xl text-sm transition-colors"
            style={{minHeight:48}}>
            Cancelar
          </button>
          <button onClick={handleCreate} disabled={creating}
            className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
            style={{minHeight:48}}>
            {creating ? 'Creando...' : 'Crear usuario'}
          </button>
        </div>
      </div>
      <AppFooter/>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0F172A] pb-16">
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Gestión de Usuarios" back/>

      {/* Summary strip */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className="card-highlight flex-1 rounded-xl border border-white/8 px-4 py-3 flex items-center justify-between"
             style={{background:'#1E293B'}}>
          <div>
            <p className="font-mono text-2xl font-bold text-white">{users.length}</p>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Usuarios activos</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-bold text-blue-400">{Object.keys(grouped).length}</p>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Aeropuertos</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center justify-center w-14 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-2xl transition-colors flex-shrink-0"
          style={{height:64}}>
          +
        </button>
      </div>

      {/* User list grouped by airport */}
      {loading ? (
        <div className="px-4 space-y-3 pt-2">
          {[1,2,3].map(i=><div key={i} className="skeleton h-20 rounded-xl"/>)}
        </div>
      ) : (
        <div className="px-4 pt-2 pb-4 space-y-5">
          {Object.entries(grouped).map(([airportCode, airportUsers]) => (
            <div key={airportCode}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600 mb-2 px-1">
                {airportCode} · {AIRPORTS_CO.find(a=>a.code===airportCode)?.name||airportCode}
              </p>
              <div className="space-y-2">
                {airportUsers.map(u => {
                  const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.inspector
                  return (
                    <div key={u.id} className="card-highlight rounded-xl border border-white/8 p-4"
                         style={{background:'#1E293B'}}>
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                             style={{background:cfg.bg, color:cfg.color}}>
                          {u.name?.charAt(0)?.toUpperCase()||'?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm leading-tight">{u.name}</p>
                          <p className="font-mono text-xs text-slate-500 truncate mt-0.5">{u.email}</p>
                          <div className="flex gap-1.5 mt-1 flex-wrap">
                            <span className="inline-block font-mono text-[10px] px-2 py-0.5 rounded"
                                  style={{background:cfg.bg, color:cfg.color}}>
                              {cfg.label}
                            </span>
                            {u.active === false && (
                              <span className="inline-block font-mono text-[10px] px-2 py-0.5 rounded"
                                    style={{background:'#1C1A07', color:'#D97706'}}>
                                INACTIVO
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Transfer dropdown — superadmin only */}
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {isSuperAdmin && (
                            <select
                              onChange={e => e.target.value && handleTransfer(u.id, e.target.value)}
                              defaultValue=""
                              className="text-[10px] font-mono bg-[#0F172A] text-slate-400 border border-white/10 rounded-lg px-2 focus:outline-none"
                              style={{minHeight:32}}>
                              <option value="">Trasladar</option>
                              {AIRPORTS_CO.filter(a=>a.code!==u.airportCode).map(a=>(
                                <option key={a.code} value={a.code}>{a.code}</option>
                              ))}
                            </select>
                          )}
                          {isAdmin && u.role !== 'superadmin' && (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleToggleActive(u)}
                                className="font-mono text-[10px] px-2 rounded-lg border flex-1"
                                style={{minHeight:28,
                                  background: u.active===false ? '#1C1A07' : '#052E16',
                                  color: u.active===false ? '#D97706' : '#16A34A',
                                  borderColor: u.active===false ? '#D9770644' : '#16A34A44'}}>
                                {u.active===false ? 'Activar' : 'Desactivar'}
                              </button>
                              {isSuperAdmin && (
                                <button
                                  onClick={() => setConfirmDelete(u)}
                                  className="font-mono text-[10px] px-2 rounded-lg border"
                                  style={{minHeight:28, background:'#450A0A22', color:'#EF4444', borderColor:'#EF444433'}}>
                                  Eliminar
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="text-center py-16">
              <p className="font-mono text-slate-600 text-sm uppercase tracking-widest">0 USUARIOS</p>
            </div>
          )}
        </div>
      )}
      {/* Delete user modal */}
      {confirmDelete && (
        <div className="fixed inset-0 flex items-end justify-center z-50 px-4 pb-6"
             style={{background:'rgba(0,0,0,0.85)'}}>
          <div className="card-highlight w-full max-w-md rounded-2xl border p-5"
               style={{background:'#1C0A0A', borderColor:'#EF444444'}}>
            <p className="font-bold text-base mb-1" style={{color:'#EF4444'}}>⚠ Eliminar usuario</p>
            <p className="text-slate-300 text-sm mb-1">
              ¿Eliminar a <span className="font-bold text-white">{confirmDelete.name}</span>?
            </p>
            <p className="font-mono text-xs text-slate-500 mb-4">
              {confirmDelete.email} · {confirmDelete.airportCode}
            </p>
            <p className="font-mono text-[10px] text-slate-600 mb-4">
              Esta acción elimina el acceso permanentemente. Los informes generados por este usuario no se ven afectados.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="font-semibold rounded-xl text-sm border border-white/10 text-slate-400"
                style={{minHeight:48}}>
                Cancelar
              </button>
              <button onClick={() => handleDeleteUser(confirmDelete)}
                className="font-bold rounded-xl text-sm"
                style={{minHeight:48, background:'#EF4444', color:'white'}}>
                Eliminar usuario
              </button>
            </div>
          </div>
        </div>
      )}

      <AppFooter/>
    </div>
  )
}
