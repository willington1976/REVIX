import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { generateInspectionPDF } from '../utils/generatePDF'
import { TopBar, AppFooter } from '../components/AppShell'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Reports() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsedYears, setCollapsedYears] = useState({})

  useEffect(() => {
    getDocs(query(collection(db,'airports',profile.airportCode,'reports'),orderBy('createdAt','desc')))
      .then(snap => {
        const data = snap.docs.map(d=>({id:d.id,...d.data()}))
          .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
        setReports(data)
        const currentYear = new Date().getFullYear().toString()
        const years = [...new Set(data.map(r=>r.date?.slice(0,4)).filter(Boolean))]
        const init = {}
        years.forEach(y=>{ if(y!==currentYear) init[y]=true })
        setCollapsedYears(init)
        setLoading(false)
      })
  }, [])

  const handleOpen = async (r) => {
    try {
      const items = (r.items||[]).map(item=>({
        ...item,
        checks: item.checks ? {
          pressure:item.checks.pressure===true, pasador:item.checks.pasador===true,
          seal:item.checks.seal===true, paint:item.checks.paint===true,
          handle:item.checks.handle===true, hose:item.checks.hose===true,
          nozzle:item.checks.nozzle===true, cylinder:item.checks.cylinder===true,
          signage:item.checks.signage===true,
        } : {}
      }))
      const pdf = generateInspectionPDF(r, items, r.airportName||r.airportCode, r.omitidos||[])
      const fileName = `REVIX_Inspeccion_${r.airportCode}_${r.date}.pdf`
      const blob = pdf.output('blob')
      const file = new File([blob], fileName, {type:'application/pdf'})
      if (navigator.canShare && navigator.canShare({files:[file]})) {
        await navigator.share({files:[file], title:`Inspección REVIX ${r.airportCode} ${r.date}`})
      } else { pdf.save(fileName) }
    } catch(err) { alert('Error: '+err.message) }
  }

  const toggleYear = (y) => setCollapsedYears(p=>({...p,[y]:!p[y]}))
  const monthLabel = (key) => { const [,m]=key.split('-'); return MONTHS[parseInt(m,10)-1]||key }

  const byYear = reports.reduce((acc,r)=>{
    const year=r.date?.slice(0,4)||'Sin fecha'
    const month=r.date?.slice(0,7)||'Sin fecha'
    if(!acc[year]) acc[year]={}
    if(!acc[year][month]) acc[year][month]=[]
    acc[year][month].push(r)
    return acc
  },{})

  const years = Object.keys(byYear).sort((a,b)=>b.localeCompare(a))

  const yearStats = (months) => {
    const all = Object.values(months).flat()
    return {
      n: all.length,
      ok: all.reduce((s,r)=>s+(r.totalOk||0),0),
      nov: all.reduce((s,r)=>s+(r.totalNovedad||0),0),
    }
  }

  const S = { // shared styles
    card: { background:'#111827', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12 },
    label: { fontSize:11, fontWeight:500, color:'#475569', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'JetBrains Mono,monospace' },
  }

  return (
    <div style={{minHeight:'100vh', background:'#0A0F1E', paddingBottom:80}}>
      <TopBar title="Informes de Inspección" back/>

      {loading ? (
        <div style={{padding:'16px'}}>
          {[1,2,3].map(i=><div key={i} className="skeleton" style={{height:88,borderRadius:12,marginBottom:8}}/>)}
        </div>
      ) : reports.length===0 ? (
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                     padding:'80px 32px',textAlign:'center'}}>
          <div style={{fontSize:40,marginBottom:16}}>📋</div>
          <p style={{fontSize:15,fontWeight:600,color:'#334155',margin:0}}>Sin informes aún</p>
          <p style={{fontSize:13,color:'#1E293B',margin:'8px 0 0'}}>Los informes aparecen aquí al finalizar una inspección</p>
        </div>
      ) : (
        <div style={{padding:'12px 16px', display:'flex', flexDirection:'column', gap:8}}>
          {years.map(year => {
            const months = byYear[year]
            const collapsed = collapsedYears[year]
            const st = yearStats(months)
            const monthKeys = Object.keys(months).sort((a,b)=>b.localeCompare(a))
            const isCurrent = year===new Date().getFullYear().toString()

            return (
              <div key={year}>
                {/* Year header */}
                <button onClick={()=>toggleYear(year)}
                  style={{...S.card, width:'100%', padding:'14px 16px', cursor:'pointer',
                          display:'flex', alignItems:'center', justifyContent:'space-between',
                          marginBottom:collapsed?4:0, border:`1px solid ${isCurrent?'rgba(29,111,232,0.2)':'rgba(255,255,255,0.06)'}`,
                          background:isCurrent?'rgba(29,111,232,0.05)':'#111827'}}>
                  <div style={{display:'flex', alignItems:'center', gap:12}}>
                    <div style={{display:'flex', alignItems:'center', gap:8}}>
                      <svg style={{transform:collapsed?'rotate(-90deg)':'rotate(0deg)', transition:'0.2s',
                                   color:isCurrent?'#60A5FA':'#475569'}}
                           width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                      <span style={{fontFamily:'JetBrains Mono,monospace', fontSize:26, fontWeight:700,
                                    color:isCurrent?'#F1F5F9':'#475569', letterSpacing:'-0.02em'}}>
                        {year}
                      </span>
                      {isCurrent && (
                        <span style={{fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:5,
                                      background:'rgba(29,111,232,0.15)', color:'#60A5FA',
                                      textTransform:'uppercase', letterSpacing:'0.06em'}}>
                          Actual
                        </span>
                      )}
                    </div>
                    <span style={{...S.label, fontSize:10}}>{st.n} insp. · {monthKeys.length} {monthKeys.length===1?'mes':'meses'}</span>
                  </div>
                  <div style={{display:'flex', gap:12, alignItems:'center'}}>
                    <span style={{fontSize:12, fontWeight:600, color:'#4ADE80'}}>✓ {st.ok}</span>
                    {st.nov>0&&<span style={{fontSize:12, fontWeight:600, color:'#F87171'}}>⚠ {st.nov}</span>}
                  </div>
                </button>

                {/* Months */}
                {!collapsed && (
                  <div style={{paddingLeft:12, borderLeft:'2px solid rgba(255,255,255,0.04)',
                               marginLeft:12, marginBottom:4, display:'flex', flexDirection:'column', gap:12}}>
                    {monthKeys.map(mk => (
                      <div key={mk}>
                        <p style={{...S.label, margin:'12px 0 6px 4px'}}>{monthLabel(mk)} {year}</p>
                        <div style={{display:'flex', flexDirection:'column', gap:4}}>
                          {[...months[mk]].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).map(r => {
                            const cov = r.totalRegistered>0 ? Math.round(((r.totalInspected||0)/r.totalRegistered)*100) : 100
                            const hasNov = (r.totalNovedad||0)>0
                            const hasOmit = (r.totalOmitidos||0)>0
                            return (
                              <div key={r.id} style={{...S.card, padding:'14px 16px',
                                                      borderLeft:`3px solid ${hasNov?'#DC2626':cov===100?'#15803D':'#1D6FE8'}`}}>
                                <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
                                  <div style={{flex:1, minWidth:0}}>
                                    {/* Date + time */}
                                    <div style={{display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap'}}>
                                      <span style={{fontSize:14, fontWeight:600, color:'#F1F5F9',
                                                    fontFamily:'JetBrains Mono,monospace'}}>
                                        {r.date}
                                      </span>
                                      <span style={{fontSize:12, color:'#1D6FE8', fontFamily:'JetBrains Mono,monospace'}}>
                                        {r.startTime||'--'} → {r.endTime||'--'}
                                      </span>
                                    </div>
                                    <p style={{fontSize:12, color:'#64748B', margin:'3px 0 8px',
                                               overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                                      {r.inspectorName}
                                    </p>
                                    {/* Coverage bar */}
                                    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                                      <div style={{flex:1, height:3, background:'rgba(255,255,255,0.06)', borderRadius:2, overflow:'hidden'}}>
                                        <div style={{height:'100%', borderRadius:2, transition:'width .4s',
                                                     width:`${cov}%`,
                                                     background:cov===100?'#15803D':cov>=80?'#1D6FE8':'#B45309'}}/>
                                      </div>
                                      <span style={{fontSize:10, color:'#475569',
                                                    fontFamily:'JetBrains Mono,monospace'}}>{cov}%</span>
                                    </div>
                                    {/* Stats */}
                                    <div style={{display:'flex', gap:12}}>
                                      <span style={{fontSize:12, color:'#475569'}}>{r.totalInspected} rev.</span>
                                      <span style={{fontSize:12, color:'#4ADE80', fontWeight:500}}>✓ {r.totalOk}</span>
                                      {hasNov&&<span style={{fontSize:12, color:'#F87171', fontWeight:500}}>⚠ {r.totalNovedad}</span>}
                                      {hasOmit&&<span style={{fontSize:12, color:'#FCD34D'}}>— {r.totalOmitidos} omit.</span>}
                                    </div>
                                  </div>
                                  {/* PDF button */}
                                  <button onClick={()=>handleOpen(r)}
                                    style={{flexShrink:0, minHeight:52, minWidth:52, borderRadius:10,
                                            border:'1px solid rgba(29,111,232,0.3)',
                                            background:'rgba(29,111,232,0.08)', color:'#60A5FA',
                                            cursor:'pointer', display:'flex', flexDirection:'column',
                                            alignItems:'center', justifyContent:'center', gap:3}}>
                                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                      <polyline points="14 2 14 8 20 8"/>
                                      <line x1="12" y1="18" x2="12" y2="12"/>
                                      <line x1="9" y1="15" x2="15" y2="15"/>
                                    </svg>
                                    <span style={{fontSize:9, fontFamily:'JetBrains Mono,monospace',
                                                  fontWeight:600, letterSpacing:'0.06em'}}>PDF</span>
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <AppFooter/>
    </div>
  )
}
