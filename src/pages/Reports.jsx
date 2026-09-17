import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { generateInspectionPDF } from '../utils/generatePDF'
import { TopBar, AppFooter } from '../components/AppShell'

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Reports() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsedYears, setCollapsedYears] = useState({})

  useEffect(() => {
    getDocs(query(collection(db,'airports',profile.airportCode,'reports'),orderBy('createdAt','desc')))
      .then(snap => {
        // Sort by createdAt seconds descending — most recent first always
        const data = snap.docs
          .map(d=>({id:d.id,...d.data()}))
          .sort((a,b) => {
            const ta = a.createdAt?.seconds || 0
            const tb = b.createdAt?.seconds || 0
            return tb - ta
          })
        setReports(data)

        // Auto-collapse all years except current
        const currentYear = new Date().getFullYear().toString()
        const years = [...new Set(data.map(r => r.date?.slice(0,4)).filter(Boolean))]
        const initial = {}
        years.forEach(y => { if (y !== currentYear) initial[y] = true })
        setCollapsedYears(initial)

        setLoading(false)
      })
  }, [])

  const handleOpen = async (r) => {
    try {
      const items = (r.items || []).map(item => ({
        ...item,
        checks: item.checks ? {
          pressure: item.checks.pressure === true,
          pasador:  item.checks.pasador  === true,
          seal:     item.checks.seal     === true,
          paint:    item.checks.paint    === true,
          handle:   item.checks.handle   === true,
          hose:     item.checks.hose     === true,
          nozzle:   item.checks.nozzle   === true,
          cylinder: item.checks.cylinder === true,
          signage:  item.checks.signage  === true,
        } : {}
      }))
      const pdf = generateInspectionPDF(r, items, r.airportName||r.airportCode, r.omitidos||[])
      const fileName = `REVIX_Inspeccion_${r.airportCode}_${r.date}.pdf`
      const blob = pdf.output('blob')
      const file = new File([blob], fileName, { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Inspección REVIX ${r.airportCode} ${r.date}` })
      } else {
        pdf.save(fileName)
      }
    } catch(err) {
      alert('Error: ' + err.message)
    }
  }

  const toggleYear = (year) => {
    setCollapsedYears(p => ({ ...p, [year]: !p[year] }))
  }

  // Group: year → month → reports
  const byYear = reports.reduce((acc, r) => {
    const year  = r.date?.slice(0,4) || 'Sin fecha'
    const month = r.date?.slice(0,7) || 'Sin fecha'
    if (!acc[year]) acc[year] = {}
    if (!acc[year][month]) acc[year][month] = []
    acc[year][month].push(r)
    return acc
  }, {})

  const years = Object.keys(byYear).sort((a,b) => b.localeCompare(a))

  // Year-level stats
  const yearStats = (monthsObj) => {
    const all = Object.values(monthsObj).flat()
    return {
      inspecciones: all.length,
      ok: all.reduce((s,r) => s + (r.totalOk||0), 0),
      novedades: all.reduce((s,r) => s + (r.totalNovedad||0), 0),
    }
  }

  const monthLabel = (key) => {
    const [, m] = key.split('-')
    return MONTH_NAMES[parseInt(m,10)-1] || key
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-16">
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Informes de Inspección" back/>

      {loading ? (
        <div className="px-4 pt-4 space-y-3">
          {[1,2,3].map(i=>(
            <div key={i} className="skeleton h-24 rounded-xl"/>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
          <p className="font-mono text-slate-600 text-sm uppercase tracking-widest">0 INFORMES</p>
          <p className="text-slate-700 text-xs font-mono mt-2">Aún no se han generado inspecciones</p>
        </div>
      ) : (
        <div className="px-4 pt-4 pb-4 space-y-3">
          {years.map(year => {
            const months = byYear[year]
            const collapsed = collapsedYears[year]
            const stats = yearStats(months)
            const monthKeys = Object.keys(months).sort((a,b) => b.localeCompare(a))
            const isCurrentYear = year === new Date().getFullYear().toString()

            return (
              <div key={year}>
                {/* Year header — collapsible */}
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full card-highlight rounded-2xl border border-white/8 p-4 text-left transition-all active:scale-[0.99]"
                  style={{background: isCurrentYear ? '#162032' : '#1E293B'}}>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Chevron */}
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                           style={{background: isCurrentYear ? '#2563EB22' : '#ffffff08', border:'1px solid rgba(255,255,255,0.08)'}}>
                        <svg width="14" height="14" fill="none" stroke={isCurrentYear ? '#2563EB' : '#475569'}
                             strokeWidth="2.5" viewBox="0 0 24 24"
                             style={{transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition:'transform 0.2s'}}>
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-2xl font-bold"
                             style={{color: isCurrentYear ? '#FFFFFF' : '#64748B'}}>
                            {year}
                          </p>
                          {isCurrentYear && (
                            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                                  style={{background:'#2563EB22', color:'#2563EB', border:'1px solid #2563EB44'}}>
                              AÑO ACTUAL
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] text-slate-600 mt-0.5">
                          {stats.inspecciones} inspección{stats.inspecciones !== 1 ? 'es' : ''} · {monthKeys.length} {monthKeys.length === 1 ? 'mes' : 'meses'}
                        </p>
                      </div>
                    </div>

                    {/* Year summary pills */}
                    <div className="flex flex-col gap-1 text-right">
                      <span className="font-mono text-[10px] text-emerald-500">✓ {stats.ok} ok</span>
                      {stats.novedades > 0 && (
                        <span className="font-mono text-[10px] text-red-500">⚠ {stats.novedades} nov.</span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Months — shown when expanded */}
                {!collapsed && (
                  <div className="mt-2 space-y-4 pl-2 border-l-2 border-white/5 ml-4">
                    {monthKeys.map(monthKey => (
                      <div key={monthKey}>
                        {/* Month label */}
                        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-600 mb-2 pl-3">
                          {monthLabel(monthKey)} {year}
                        </p>

                        {/* Report cards */}
                        <div className="space-y-2">
                          {[...months[monthKey]].sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).map(r => {
                            const coverage = r.totalRegistered > 0
                              ? Math.round(((r.totalInspected||0) / r.totalRegistered) * 100)
                              : 100
                            const hasNovedad = (r.totalNovedad||0) > 0
                            const hasOmitidos = (r.totalOmitidos||0) > 0

                            return (
                              <div key={r.id}
                                   className="card-highlight rounded-xl border border-white/8 p-4"
                                   style={{background:'#1E293B'}}>
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    {/* Date + inspector */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-mono text-sm font-bold text-white">{r.date}</p>
                                      {r.startTime && (
                                        <span className="font-mono text-[10px] text-slate-600">{r.startTime}{r.endTime ? ` → ${r.endTime}` : ''}</span>
                                      )}
                                    </div>
                                    <p className="text-slate-500 text-xs uppercase tracking-widest font-mono mt-0.5">{r.inspectorName}</p>

                                    {/* Coverage bar */}
                                    <div className="flex items-center gap-2 mt-2">
                                      <div className="flex-1 bg-slate-800 rounded-full h-1 overflow-hidden">
                                        <div className="h-1 rounded-full transition-all"
                                             style={{
                                               width:`${coverage}%`,
                                               background: coverage===100 ? '#22C55E' : coverage >= 80 ? '#2563EB' : '#F59E0B'
                                             }}/>
                                      </div>
                                      <span className="font-mono text-[10px] text-slate-500 flex-shrink-0">{coverage}%</span>
                                    </div>

                                    {/* Stats row */}
                                    <div className="flex gap-3 mt-2 flex-wrap">
                                      <span className="font-mono text-xs text-slate-500">{r.totalInspected} rev.</span>
                                      <span className="font-mono text-xs text-emerald-500">✓ {r.totalOk}</span>
                                      {hasNovedad && (
                                        <span className="font-mono text-xs text-red-500">⚠ {r.totalNovedad}</span>
                                      )}
                                      {hasOmitidos && (
                                        <span className="font-mono text-xs text-amber-500">— {r.totalOmitidos} omit.</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action button */}
                                  <button onClick={() => handleOpen(r)}
                                    className="flex-shrink-0 font-mono text-xs font-semibold px-3 rounded-xl transition-colors flex flex-col items-center gap-1"
                                    style={{minHeight:52, minWidth:64, background:'#2563EB22', color:'#2563EB', border:'1px solid #2563EB44'}}>
                                    <span className="text-lg">📄</span>
                                    <span className="text-[10px]">Ver</span>
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
