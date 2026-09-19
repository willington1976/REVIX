import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { TopBar, AppFooter } from '../components/AppShell'

function calcDiff(date) {
  if (!date) return null
  return (new Date(date) - new Date()) / (1000*60*60*24)
}

function hydroExpiry(lastHydroTest) {
  if (!lastHydroTest) return null
  const d = new Date(lastHydroTest)
  d.setFullYear(d.getFullYear() + 5)
  return d.toISOString().split('T')[0]
}

function statusBadge(ext) {
  const agentDiff = calcDiff(ext.expiryDate)
  const hydroDate = hydroExpiry(ext.lastHydroTest)
  const hydroDiff = calcDiff(hydroDate)

  // Collect both diffs — pick worst state
  const diffs = []
  if (agentDiff !== null) diffs.push({ diff: agentDiff, label: 'Agente' })
  if (hydroDiff !== null) diffs.push({ diff: hydroDiff, label: 'Hidrost.' })

  if (diffs.length === 0) return { label:'SIN FECHA', color:'#475569', bg:'#1E293B', detail:'' }

  // Sort by worst (lowest diff first)
  diffs.sort((a,b) => a.diff - b.diff)
  const worst = diffs[0]

  if (worst.diff < 0)  return { label:'VENCIDO',   color:'#EF4444', bg:'#450A0A', detail: worst.label }
  if (worst.diff < 30) return { label:'< 30 DÍAS', color:'#F59E0B', bg:'#431407', detail: worst.label }
  if (worst.diff < 60) return { label:'< 60 DÍAS', color:'#FBBF24', bg:'#1C1A07', detail: worst.label }
  return                      { label:'AL DÍA',    color:'#22C55E', bg:'#052E16', detail: '' }
}

export default function ExtinguisherList() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isInspector = profile?.role === 'inspector'
  const [extinguishers, setExtinguishers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // all | ok | warning | expired

  useEffect(() => {
    getDocs(query(collection(db,'airports',profile.airportCode,'extinguishers'),orderBy('createdAt','desc')))
      .then(snap => { setExtinguishers(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false) })
  }, [])

  const filtered = extinguishers.filter(e => {
    const matchSearch = e.serial?.toLowerCase().includes(search.toLowerCase()) ||
      e.zone?.toLowerCase().includes(search.toLowerCase()) ||
      e.type?.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (filter === 'all') return true
    const badge = statusBadge(e)
    if (filter === 'expired') return badge.label === 'VENCIDO'
    if (filter === 'warning') return badge.label === '< 30 DÍAS' || badge.label === '< 60 DÍAS'
    if (filter === 'ok') return badge.label === 'AL DÍA' || badge.label === 'SIN FECHA'
    return true
  })

  const expired = extinguishers.filter(e => statusBadge(e).label === 'VENCIDO').length

  return (
    <div className="min-h-screen bg-[#0F172A] pb-16">
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Inventario de Extintores" back/>

      {/* Summary strip */}
      <div className="px-4 py-3 flex items-center gap-3">
        {isInspector && (
          <span className="font-mono text-[10px] px-3 py-1.5 rounded-lg border flex-shrink-0"
                style={{color:'#64748B', borderColor:'rgba(255,255,255,0.1)', background:'#0F172A'}}>
            SOLO LECTURA
          </span>
        )}
        <div className="card-highlight flex-1 rounded-xl border border-white/8 px-4 py-3 flex items-center justify-between"
             style={{background:'#1E293B'}}>
          <div>
            <p className="font-mono text-2xl font-bold text-white">{extinguishers.length}</p>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Registrados</p>
          </div>
          {expired > 0 && (
            <div className="text-right">
              <p className="font-mono text-2xl font-bold text-red-500">{expired}</p>
              <p className="font-mono text-[10px] text-red-700 uppercase tracking-wider">Vencidos</p>
            </div>
          )}
        </div>
        <button onClick={() => navigate('/extinguishers/new')}
          className="tap-target flex items-center justify-center w-14 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-2xl transition-colors flex-shrink-0"
          style={{height:64}}>
          +
        </button>
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar serial, zona, tipo..."
          className="w-full bg-[#1E293B] border border-white/10 text-white rounded-xl px-4 text-sm focus:outline-none focus:border-[#2563EB] font-mono placeholder-slate-600"
          style={{minHeight:48}}/>
      </div>

      {/* Filter tabs */}
      <div className="px-4 flex gap-2 mb-4 overflow-x-auto pb-1">
        {[['all','Todos'],['ok','Al día'],['warning','Por vencer'],['expired','Vencidos']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className="flex-shrink-0 font-mono text-xs px-3 rounded-full border transition-colors"
            style={{
              minHeight:32,
              background: filter===v ? '#2563EB' : '#1E293B',
              borderColor: filter===v ? '#2563EB' : 'rgba(255,255,255,0.1)',
              color: filter===v ? 'white' : '#64748B'
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="px-4 space-y-3">
          {[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl"/>)}
        </div>
      ) : (
        <div className="px-4 space-y-2 pb-4">
          {filtered.map(ext => {
            const badge = statusBadge(ext)
            return (
              <div key={ext.id} onClick={() => !isInspector && navigate(`/extinguishers/${ext.id}`)} className="card-highlight rounded-xl border border-white/8 p-4 cursor-pointer active:scale-[0.98] transition-transform"
                   style={{background:'#1E293B', borderLeftColor:badge.color, borderLeftWidth:3}}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xl font-bold text-white tracking-tight leading-none">{ext.serial}</p>
                    <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">{ext.zone}</p>
                    <p className="text-slate-500 text-xs mt-0.5 truncate">{ext.exactLocation}</p>
                    <p className="font-mono text-xs text-slate-600 mt-1">{ext.type} · {ext.capacity} {ext.capacityUnit}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-mono text-[10px] font-bold px-2 py-1 rounded"
                          style={{background:badge.bg, color:badge.color}}>
                      {badge.label}
                    </span>
                    {ext.expiryDate && (
                      <p className="font-mono text-[10px] text-slate-600 mt-1">{ext.expiryDate}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="font-mono text-slate-600 text-sm">0 RESULTADOS</p>
            </div>
          )}
        </div>
      )}
      <AppFooter/>
    </div>
  )
}
