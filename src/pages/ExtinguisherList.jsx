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
  d.setFullYear(d.getFullYear()+5)
  return d.toISOString().split('T')[0]
}
function statusBadge(ext) {
  const agentDiff = calcDiff(ext.expiryDate)
  const hydroDate = hydroExpiry(ext.lastHydroTest)
  const hydroDiff = calcDiff(hydroDate)
  const diffs = []
  if (agentDiff!==null) diffs.push({diff:agentDiff, label:'Agente'})
  if (hydroDiff!==null) diffs.push({diff:hydroDiff, label:'Hidrost.'})
  if (diffs.length===0) return {label:'SIN FECHA', color:'#475569', bg:'#1E293B', detail:''}
  diffs.sort((a,b)=>a.diff-b.diff)
  const w = diffs[0]
  if (w.diff<0)  return {label:'VENCIDO',   color:'#FCA5A5', bg:'#450A0A', detail:w.label}
  if (w.diff<30) return {label:'< 30 DÍAS', color:'#FCD34D', bg:'#3B2000', detail:w.label}
  if (w.diff<60) return {label:'< 60 DÍAS', color:'#FCD34D', bg:'#1C1A07', detail:w.label}
  return                {label:'AL DÍA',    color:'#6EE7B7', bg:'#022C22', detail:''}
}

const FILTER_TABS = [
  {v:'all',      l:'Todos'},
  {v:'ok',       l:'Al día'},
  {v:'warning',  l:'Por vencer'},
  {v:'expired',  l:'Vencidos'},
]

export default function ExtinguisherList() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const isInspector = profile?.role === 'inspector'
  const [extinguishers, setExtinguishers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    getDocs(query(collection(db,'airports',profile.airportCode,'extinguishers'),orderBy('createdAt','desc')))
      .then(snap=>{setExtinguishers(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false)})
  }, [])

  const filtered = extinguishers.filter(e => {
    const q = search.toLowerCase()
    const match = e.serial?.toLowerCase().includes(q)||e.zone?.toLowerCase().includes(q)||e.type?.toLowerCase().includes(q)
    if (!match) return false
    if (filter==='all') return true
    const b = statusBadge(e)
    if (filter==='expired') return b.label==='VENCIDO'
    if (filter==='warning') return b.label==='< 30 DÍAS'||b.label==='< 60 DÍAS'
    if (filter==='ok')      return b.label==='AL DÍA'||b.label==='SIN FECHA'
    return true
  })

  const expired = extinguishers.filter(e=>statusBadge(e).label==='VENCIDO').length
  const warning = extinguishers.filter(e=>['< 30 DÍAS','< 60 DÍAS'].includes(statusBadge(e).label)).length

  return (
    <div style={{minHeight:'100vh', background:'#111827', paddingBottom:80}}>
      <TopBar title="Inventario de Extintores" back
        right={!isInspector && (
          <button onClick={()=>navigate('/extinguishers/new')}
            style={{width:36,height:36,borderRadius:8,border:'none',background:'#15803D',
                    color:'white',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            +
          </button>
        )}
      />

      {/* Summary strip */}
      <div style={{padding:'12px 16px', display:'flex', gap:8}}>
        <div style={{flex:1, background:'#1E293B', border:'1px solid rgba(255,255,255,0.10)',
                     borderRadius:10, padding:'10px 14px'}}>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:22, fontWeight:700,
                     color:'#F1F5F9', margin:0}}>{extinguishers.length}</p>
          <p style={{fontSize:11, color:'#475569', margin:'2px 0 0', textTransform:'uppercase', letterSpacing:'0.06em'}}>Registrados</p>
        </div>
        {expired>0 && (
          <div style={{flex:1, background:'#450A0A', border:'1px solid rgba(220,38,38,0.2)',
                       borderRadius:10, padding:'10px 14px'}}>
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:22, fontWeight:700,
                       color:'#FCA5A5', margin:0}}>{expired}</p>
            <p style={{fontSize:11, color:'#7F1D1D', margin:'2px 0 0', textTransform:'uppercase', letterSpacing:'0.06em'}}>Vencidos</p>
          </div>
        )}
        {warning>0 && (
          <div style={{flex:1, background:'#3B2000', border:'1px solid rgba(180,83,9,0.2)',
                       borderRadius:10, padding:'10px 14px'}}>
            <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:22, fontWeight:700,
                       color:'#FCD34D', margin:0}}>{warning}</p>
            <p style={{fontSize:11, color:'#78350F', margin:'2px 0 0', textTransform:'uppercase', letterSpacing:'0.06em'}}>Por vencer</p>
          </div>
        )}
        {isInspector && (
          <div style={{display:'flex', alignItems:'center', padding:'0 12px',
                       background:'#0F172A', border:'1px solid rgba(255,255,255,0.10)',
                       borderRadius:10}}>
            <span style={{fontSize:11, color:'#334155', fontFamily:'JetBrains Mono,monospace',
                           textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap'}}>
              Lectura
            </span>
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{padding:'0 16px 8px'}}>
        <div style={{position:'relative'}}>
          <svg style={{position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:'#334155'}}
               width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Buscar serial, zona, tipo..."
            style={{width:'100%', background:'#1E293B', border:'1px solid rgba(255,255,255,0.10)',
                    color:'#F1F5F9', borderRadius:10, padding:'0 16px 0 40px', fontSize:14,
                    minHeight:44, outline:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box'}}/>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{padding:'0 16px 12px', display:'flex', gap:6, overflowX:'auto'}}>
        {FILTER_TABS.map(t=>(
          <button key={t.v} onClick={()=>setFilter(t.v)}
            style={{flexShrink:0, padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500,
                    cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all .15s',
                    background: filter===t.v?'#1D6FE8':'rgba(255,255,255,0.04)',
                    border: `1px solid ${filter===t.v?'#1D6FE8':'rgba(255,255,255,0.10)'}`,
                    color: filter===t.v?'white':'#64748B'}}>
            {t.l}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{padding:'0 16px', display:'flex', flexDirection:'column', gap:6}}>
          {[1,2,3,4].map(i=><div key={i} className="skeleton" style={{height:80,borderRadius:12}}/>)}
        </div>
      ) : (
        <div style={{padding:'0 16px', display:'flex', flexDirection:'column', gap:4}}>
          {filtered.map(ext => {
            const badge = statusBadge(ext)
            const accentColor = badge.label==='AL DÍA'?'#15803D':badge.label==='VENCIDO'?'#DC2626':'#B45309'
            return (
              <div key={ext.id}
                onClick={()=>!isInspector&&navigate(`/extinguishers/${ext.id}`)}
                style={{background:'#1E293B', border:'1px solid rgba(255,255,255,0.10)',
                        borderRadius:12, borderLeft:`3px solid ${accentColor}`,
                        padding:'14px 16px', cursor:isInspector?'default':'pointer',
                        display:'flex', alignItems:'flex-start', gap:12}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:3}}>
                    <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:18, fontWeight:700,
                                  color:'#F1F5F9', letterSpacing:'-0.01em'}}>{ext.serial}</span>
                    {ext.placa && <span style={{fontSize:11, color:'#334155',
                                                fontFamily:'JetBrains Mono,monospace'}}>#{ext.placa}</span>}
                  </div>
                  <p style={{fontSize:11, color:'#64748B', margin:'0 0 2px',
                             textTransform:'uppercase', letterSpacing:'0.06em'}}>{ext.zone}</p>
                  <p style={{fontSize:12, color:'#475569', margin:0,
                             overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{ext.exactLocation}</p>
                  <p style={{fontSize:11, color:'#334155', margin:'4px 0 0',
                             fontFamily:'JetBrains Mono,monospace'}}>{ext.type?.split(' ')[0]} · {ext.capacity} {ext.capacityUnit}</p>
                </div>
                <div style={{textAlign:'right', flexShrink:0}}>
                  <span style={{fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:5,
                                background:badge.bg, color:badge.color, display:'block',
                                fontFamily:'JetBrains Mono,monospace'}}>
                    {badge.label}
                  </span>
                  {badge.detail && <p style={{fontSize:10, color:badge.color, margin:'3px 0 0',
                                              fontFamily:'JetBrains Mono,monospace'}}>{badge.detail}</p>}
                  {ext.expiryDate && <p style={{fontSize:10, color:'#334155', margin:'3px 0 0',
                                                fontFamily:'JetBrains Mono,monospace'}}>{ext.expiryDate}</p>}
                </div>
              </div>
            )
          })}
          {filtered.length===0 && (
            <div style={{textAlign:'center', padding:'48px 0'}}>
              <p style={{fontSize:14, color:'#334155', margin:0}}>Sin resultados</p>
              <p style={{fontSize:12, color:'#1E293B', margin:'6px 0 0'}}>Intenta con otro término</p>
            </div>
          )}
        </div>
      )}
      <AppFooter/>
    </div>
  )
}
