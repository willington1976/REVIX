import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { AppFooter } from '../components/AppShell'
import AlertsBanner from '../components/AlertsBanner'
import { useNotifications } from '../hooks/useNotifications'

const ROLE_LABEL = { superadmin:'Super Admin', admin:'Administrador', inspector:'Inspector' }

export default function Dashboard() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const role = profile?.role || 'inspector'
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  useNotifications(user?.uid)

  useEffect(() => {
    const load = async () => {
      if (!profile?.airportCode) return
      try {
        const now = new Date()
        const y = now.getFullYear(), m = now.getMonth()
        const firstDay = `${y}-${String(m+1).padStart(2,'0')}-01`
        const lastDay  = `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
        const extSnap = await getDocs(collection(db,'airports',profile.airportCode,'extinguishers'))
        const reportsSnap = await getDocs(query(
          collection(db,'airports',profile.airportCode,'reports'),
          where('date','>=',firstDay), where('date','<=',lastDay), orderBy('date','desc')
        ))
        if (reportsSnap.empty) {
          setStats({ total:extSnap.size, ok:0, nov:0, insp:0, sinInspeccion:true })
        } else {
          let ok=0, nov=0; const ids=new Set()
          reportsSnap.docs.forEach(d=>{
            const r=d.data(); ok+=r.totalOk||0; nov+=r.totalNovedad||0
            ;(r.items||[]).forEach(i=>ids.add(i.extinguisherId))
          })
          setStats({
            total:extSnap.size, ok, nov, insp:ids.size, sinInspeccion:false,
            pct:extSnap.size>0?Math.round((ids.size/extSnap.size)*100):0,
            ultima:reportsSnap.docs[0].data().date,
            inspector:reportsSnap.docs[0].data().inspectorName,
          })
        }
      } catch(e){console.error(e)} finally {setLoadingStats(false)}
    }
    load()
  }, [profile])

  const adminActions = [
    { label:'Nueva Inspección', sub:'Escanear extintores', icon:'scan', path:'/inspect', primary:true },
    { label:'Registrar Extintor', sub:'Añadir equipo + QR', icon:'plus', path:'/extinguishers/new' },
    { label:'Inventario', sub:`${stats?.total??'—'} equipos`, icon:'list', path:'/extinguishers' },
    { label:'Informes', sub:'Historial y PDFs', icon:'doc', path:'/reports' },
    ...(role==='superadmin'?[{ label:'Usuarios', sub:'Gestión de acceso', icon:'users', path:'/users' }]:[]),
  ]

  const inspectorActions = [
    { label:'Nueva Inspección', sub:'Escanear extintores', icon:'scan', path:'/inspect', primary:true },
    { label:'Mis Informes', sub:'Historial y PDFs', icon:'doc', path:'/reports' },
    { label:'Inventario', sub:'Ver extintores', icon:'list', path:'/extinguishers' },
  ]

  const actions = role==='inspector' ? inspectorActions : adminActions
  const mes = new Date().toLocaleDateString('es-CO',{month:'long',year:'numeric'})

  const IconSVG = ({ name, size=18 }) => {
    const icons = {
      scan: <><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></>,
      plus: <><path d="M12 5v14M5 12h14"/></>,
      list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
      doc:  <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
      users:<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    }
    return (
      <svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
           strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        {icons[name]}
      </svg>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'#0A0F1E',paddingBottom:80}}>

      {/* Header */}
      <div style={{padding:'20px 16px 16px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',
                   borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
        <button onClick={()=>navigate('/account')} style={{background:'none',border:'none',cursor:'pointer',textAlign:'left',padding:0}}>
          <p style={{fontSize:17,fontWeight:700,color:'#F1F5F9',margin:0,letterSpacing:'-0.01em'}}>
            {profile?.name}
          </p>
          <p style={{fontSize:12,color:'#475569',margin:'3px 0 0'}}>
            {ROLE_LABEL[role]} · <span style={{fontFamily:'JetBrains Mono,monospace'}}>{profile?.airportCode}</span>
            <span style={{color:'#1D6FE8',marginLeft:6}}>Mi cuenta →</span>
          </p>
        </button>
        <button onClick={logout}
          style={{padding:'6px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,0.08)',
                  background:'transparent',color:'#475569',fontSize:12,fontWeight:500,cursor:'pointer'}}>
          Salir
        </button>
      </div>

      {/* Alert banner */}
      <div style={{padding:'12px 16px 0'}}>
        <AlertsBanner/>
      </div>

      {/* Hero — Estado del mes */}
      <div style={{margin:'12px 16px',background:'#111827',border:'1px solid rgba(255,255,255,0.06)',
                   borderRadius:16,padding:20,overflow:'hidden',position:'relative'}}>
        {/* Subtle accent */}
        <div style={{position:'absolute',top:0,left:0,right:0,height:2,
                     background:'linear-gradient(90deg,#1D6FE8,#15803D)',opacity:0.6}}/>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
          <div>
            <p style={{fontSize:11,fontWeight:500,color:'#475569',textTransform:'uppercase',
                       letterSpacing:'0.08em',margin:0}}>Estado del mes</p>
            <p style={{fontSize:14,fontWeight:600,color:'#94A3B8',margin:'4px 0 0',textTransform:'capitalize'}}>{mes}</p>
          </div>
          {!loadingStats && stats && !stats.sinInspeccion && (
            <div style={{textAlign:'right'}}>
              <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:32,fontWeight:700,
                         color:'#F1F5F9',margin:0,lineHeight:1}}>
                {stats.pct}<span style={{fontSize:16,color:'#475569'}}>%</span>
              </p>
              <p style={{fontSize:11,color:'#475569',margin:'2px 0 0'}}>cobertura</p>
            </div>
          )}
        </div>

        {loadingStats ? (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <div className="skeleton" style={{height:8,borderRadius:4}}/>
            <div className="skeleton" style={{height:8,width:'60%',borderRadius:4}}/>
          </div>
        ) : stats?.sinInspeccion ? (
          <div>
            <div style={{height:4,background:'rgba(255,255,255,0.04)',borderRadius:4,marginBottom:12}}/>
            <p style={{fontSize:12,color:'#B45309',margin:0}}>Sin inspecciones este mes</p>
            <p style={{fontSize:12,color:'#475569',margin:'4px 0 0'}}>
              <span style={{fontFamily:'JetBrains Mono,monospace',color:'#F1F5F9'}}>{stats.total}</span> equipos registrados
            </p>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:4,overflow:'hidden',marginBottom:16}}>
              <div style={{height:'100%',borderRadius:4,transition:'width .6s ease',width:`${stats.pct}%`,
                           background:stats.pct===100?'#15803D':'#1D6FE8'}}/>
            </div>
            {/* Stats row */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,textAlign:'center'}}>
              {[
                {v:stats.total, l:'Total',    c:'#94A3B8'},
                {v:stats.insp,  l:'Revisados',c:'#60A5FA'},
                {v:stats.ok,    l:'OK',        c:'#4ADE80'},
                {v:stats.nov,   l:'Novedad',   c:'#F87171'},
              ].map(s=>(
                <div key={s.l}>
                  <p style={{fontFamily:'JetBrains Mono,monospace',fontSize:22,fontWeight:700,
                             color:s.c,margin:0,lineHeight:1}}>{s.v}</p>
                  <p style={{fontSize:10,color:'#475569',margin:'4px 0 0',textTransform:'uppercase',letterSpacing:'0.06em'}}>{s.l}</p>
                </div>
              ))}
            </div>
            {stats.ultima && (
              <div style={{borderTop:'1px solid rgba(255,255,255,0.04)',marginTop:14,paddingTop:10,
                           display:'flex',justifyContent:'space-between'}}>
                <p style={{fontSize:11,color:'#475569',margin:0}}>Última: {stats.ultima}</p>
                <p style={{fontSize:11,color:'#475569',margin:0}}>{stats.inspector}</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{padding:'4px 16px 0'}}>
        <p style={{fontSize:11,fontWeight:500,color:'#334155',textTransform:'uppercase',
                   letterSpacing:'0.08em',marginBottom:8}}>Acciones</p>

        {/* Primary action — full width */}
        {actions.filter(a=>a.primary).map(a=>(
          <button key={a.path} onClick={()=>navigate(a.path)}
            style={{width:'100%',minHeight:60,borderRadius:12,border:'none',
                    background:'#15803D',color:'white',cursor:'pointer',marginBottom:8,
                    display:'flex',alignItems:'center',gap:16,padding:'0 20px',textAlign:'left',
                    transition:'opacity .15s'}}
            onMouseDown={e=>e.currentTarget.style.opacity='0.85'}
            onMouseUp={e=>e.currentTarget.style.opacity='1'}>
            <span style={{opacity:0.9}}><IconSVG name={a.icon} size={22}/></span>
            <div>
              <p style={{fontSize:15,fontWeight:600,margin:0}}>{a.label}</p>
              <p style={{fontSize:12,margin:'2px 0 0',opacity:0.7}}>{a.sub}</p>
            </div>
            <svg style={{marginLeft:'auto',opacity:0.5}} width="16" height="16" fill="none"
                 stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        ))}

        {/* Secondary actions */}
        <div style={{display:'flex',flexDirection:'column',gap:2}}>
          {actions.filter(a=>!a.primary).map(a=>(
            <button key={a.path} onClick={()=>navigate(a.path)}
              style={{width:'100%',minHeight:52,borderRadius:10,
                      border:'1px solid rgba(255,255,255,0.06)',
                      background:'#111827',color:'white',cursor:'pointer',
                      display:'flex',alignItems:'center',gap:14,padding:'0 16px',textAlign:'left'}}>
              <span style={{color:'#475569'}}><IconSVG name={a.icon} size={18}/></span>
              <div style={{flex:1}}>
                <p style={{fontSize:14,fontWeight:500,margin:0,color:'#E2E8F0'}}>{a.label}</p>
                <p style={{fontSize:11,margin:0,color:'#475569'}}>{a.sub}</p>
              </div>
              <svg style={{opacity:0.2}} width="14" height="14" fill="none"
                   stroke="white" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          ))}
        </div>
      </div>

      <AppFooter/>
    </div>
  )
}
