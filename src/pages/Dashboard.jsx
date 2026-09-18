import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { AppFooter } from '../components/AppShell'
import AlertsBanner from '../components/AlertsBanner'
import { useNotifications } from '../hooks/useNotifications'

const roleLabel = { superadmin: 'Super Admin', admin: 'Administrador', inspector: 'Inspector' }

export default function Dashboard() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const role = profile?.role || 'inspector'
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  useNotifications(user?.uid)

  useEffect(() => {
    const loadStats = async () => {
      if (!profile?.airportCode) return
      try {
        const now = new Date()
        const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
        const lastDay  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()}`
        const extSnap = await getDocs(collection(db,'airports',profile.airportCode,'extinguishers'))
        const totalExtintores = extSnap.size
        const reportsSnap = await getDocs(query(
          collection(db,'airports',profile.airportCode,'reports'),
          where('date','>=',firstDay), where('date','<=',lastDay), orderBy('date','desc')
        ))
        if (reportsSnap.empty) {
          setStats({ totalExtintores, ok:0, novedades:0, inspeccionados:0, omitidos:0, sinInspeccion:true })
        } else {
          let ok=0, novedades=0, omitidos=0
          const ids = new Set()
          reportsSnap.docs.forEach(d => {
            const r = d.data()
            ok += r.totalOk||0; novedades += r.totalNovedad||0; omitidos += r.totalOmitidos||0
            ;(r.items||[]).forEach(i => ids.add(i.extinguisherId))
          })
          setStats({ totalExtintores, ok, novedades, omitidos, inspeccionados:ids.size,
            sinInspeccion:false, ultimaFecha:reportsSnap.docs[0].data().date,
            ultimoInspector:reportsSnap.docs[0].data().inspectorName })
        }
      } catch(e){ console.error(e) } finally { setLoadingStats(false) }
    }
    loadStats()
  }, [profile])

  const pct = stats && stats.totalExtintores > 0
    ? Math.round((stats.inspeccionados / stats.totalExtintores) * 100) : 0

  const adminActions = [
    { label:'Registrar Extintor', sub:'Nuevo equipo + QR', icon:'➕', path:'/extinguishers/new', color:'#2563EB' },
    { label:'Ver Inventario', sub:`${stats?.totalExtintores ?? '—'} equipos`, icon:'🧯', path:'/extinguishers', color:'#334155' },
    { label:'Informes', sub:'Historial PDF', icon:'📋', path:'/reports', color:'#334155' },
    ...(role==='superadmin' ? [{ label:'Usuarios', sub:'Gestión de acceso', icon:'👥', path:'/users', color:'#334155' }] : []),
  ]

  const inspectorActions = [
    { label:'Iniciar Inspección', sub:'Escanear extintores', icon:'🔍', path:'/inspect', color:'#16A34A' },
    { label:'Mis Informes', sub:'Historial y PDFs', icon:'📋', path:'/reports', color:'#334155' },
  ]

  const actions = role === 'inspector' ? inspectorActions : adminActions
  const mes = new Date().toLocaleString('es-CO',{month:'long',year:'numeric'})

  return (
    <div className="min-h-screen bg-[#0F172A] pb-16">
      {/* Top accent */}
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <button onClick={() => navigate('/account')} className="text-left flex-1">
          <p className="text-white font-semibold text-base leading-tight">{profile?.name}</p>
          <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mt-0.5">
            {roleLabel[role]} · {profile?.airportCode}
            <span className="ml-2 text-[#2563EB]">· Mi cuenta →</span>
          </p>
        </button>
        <button onClick={logout}
          className="tap-target flex items-center px-3 text-slate-500 hover:text-white text-xs font-mono border border-white/10 rounded-lg transition-colors"
          style={{minHeight:36}}>
          SALIR
        </button>
      </div>

      <AlertsBanner/>

      {/* Hero card — Estado del mes */}
      <div className="mx-4 mb-5 card-highlight rounded-2xl border border-white/8 p-5"
           style={{background:'linear-gradient(135deg,#1E293B 0%,#162032 100%)'}}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs uppercase tracking-widest font-mono">Estado del mes</p>
            <p className="text-white font-semibold capitalize mt-0.5">{mes}</p>
            <p className="font-mono text-xs text-slate-500 mt-0.5">{profile?.airportName}</p>
          </div>
          {!loadingStats && stats && !stats.sinInspeccion && (
            <div className="text-right">
              <p className="font-mono text-3xl font-bold text-white">{pct}<span className="text-lg text-slate-400">%</span></p>
              <p className="text-slate-500 text-xs font-mono">cobertura</p>
            </div>
          )}
        </div>

        {loadingStats ? (
          <div className="space-y-2">
            <div className="skeleton h-3 w-full rounded"/>
            <div className="skeleton h-3 w-2/3 rounded"/>
          </div>
        ) : stats?.sinInspeccion ? (
          <div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mb-3">
              <div className="bg-slate-600 h-1.5 rounded-full w-0"/>
            </div>
            <p className="text-amber-400 text-xs font-mono">⚠ SIN INSPECCIONES ESTE MES</p>
            <p className="text-slate-500 text-xs font-mono mt-0.5">{stats.totalExtintores} equipos registrados · 0 inspeccionados</p>
          </div>
        ) : (
          <>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mb-3 overflow-hidden">
              <div className="h-1.5 rounded-full transition-all duration-700"
                   style={{width:`${pct}%`, background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
            </div>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { v:stats.totalExtintores, l:'TOTAL', c:'text-slate-300' },
                { v:stats.inspeccionados,  l:'REVISADOS', c:'text-blue-400' },
                { v:stats.ok,              l:'OK', c:'text-emerald-400' },
                { v:stats.novedades,       l:'NOV.', c:'text-red-400' },
              ].map(s => (
                <div key={s.l}>
                  <p className={`font-mono text-xl font-bold ${s.c}`}>{s.v}</p>
                  <p className="text-slate-600 text-[10px] font-mono uppercase tracking-wider">{s.l}</p>
                </div>
              ))}
            </div>
            {stats.ultimaFecha && (
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <p className="font-mono text-[10px] text-slate-600">Última: {stats.ultimaFecha} · {stats.ultimoInspector}</p>
                {stats.omitidos > 0 && <p className="font-mono text-[10px] text-amber-500">{stats.omitidos} omitidos</p>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Action list — fluid, not grid */}
      <div className="px-4 space-y-2">
        <p className="text-slate-600 text-[10px] font-mono uppercase tracking-widest mb-3">Acciones</p>
        {actions.map(a => (
          <button key={a.path} onClick={() => navigate(a.path)}
            className="w-full card-highlight rounded-xl border border-white/8 px-4 flex items-center gap-4 transition-all active:scale-[0.98] text-left"
            style={{minHeight:64, background:'#1E293B'}}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                 style={{background:a.color+'22', border:`1px solid ${a.color}44`}}>
              {a.icon}
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">{a.label}</p>
              <p className="text-slate-500 text-xs font-mono">{a.sub}</p>
            </div>
            <svg width="16" height="16" fill="none" stroke="#475569" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        ))}
      </div>

      <AppFooter/>
    </div>
  )
}
