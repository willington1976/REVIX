import { useState, useEffect } from 'react'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'

export default function AlertsBanner() {
  const { profile } = useAuth()
  const [alerts, setAlerts] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!profile?.airportCode || dismissed) return
    loadAlerts()
  }, [profile])

  const loadAlerts = async () => {
    try {
      const now = new Date()
      const in60 = new Date(now); in60.setDate(in60.getDate() + 60)

      // Load extinguishers for this airport
      const extSnap = await getDocs(
        collection(db, 'airports', profile.airportCode, 'extinguishers')
      )

      const found = []
      extSnap.docs.forEach(d => {
        const ext = d.data()

        // Check agent expiry
        if (ext.expiryDate) {
          const diff = Math.ceil((new Date(ext.expiryDate) - now) / (1000*60*60*24))
          if (diff <= 60) {
            found.push({
              serial: ext.serial,
              zone: ext.zone,
              type: 'Agente extintor',
              date: ext.expiryDate,
              daysLeft: diff,
              level: diff < 0 ? 'vencido' : diff <= 30 ? 'critico' : 'advertencia'
            })
          }
        }

        // Check hydrostatic test (5 years)
        if (ext.lastHydroTest) {
          const hydroExp = new Date(ext.lastHydroTest)
          hydroExp.setFullYear(hydroExp.getFullYear() + 5)
          const diff = Math.ceil((hydroExp - now) / (1000*60*60*24))
          if (diff <= 60) {
            found.push({
              serial: ext.serial,
              zone: ext.zone,
              type: 'Prueba hidrostática',
              date: hydroExp.toISOString().split('T')[0],
              daysLeft: diff,
              level: diff < 0 ? 'vencido' : diff <= 30 ? 'critico' : 'advertencia'
            })
          }
        }
      })

      // Sort: vencidos first, then criticos, then advertencias
      found.sort((a,b) => a.daysLeft - b.daysLeft)
      setAlerts(found)

      // Show browser notification if permission granted
      if (found.length > 0 && Notification.permission === 'granted') {
        const vencidos = found.filter(a => a.level === 'vencido').length
        const criticos = found.filter(a => a.level === 'critico').length
        if (vencidos > 0 || criticos > 0) {
          new Notification('REVIX — Alerta de vencimiento', {
            body: vencidos > 0
              ? `${vencidos} extintor(es) VENCIDO(S) en ${profile.airportCode}`
              : `${criticos} extintor(es) por vencer en ${profile.airportCode}`,
            icon: '/pwa-192x192.png',
            tag: 'revix-expiry'
          })
        }
      }
    } catch(err) {
      console.error('Error loading alerts:', err)
    }
  }

  if (alerts.length === 0 || dismissed) return null

  const vencidos     = alerts.filter(a => a.level === 'vencido').length
  const criticos     = alerts.filter(a => a.level === 'critico').length
  const advertencias = alerts.filter(a => a.level === 'advertencia').length

  const bannerColor = vencidos > 0 ? '#DC2626' : criticos > 0 ? '#D97706' : '#2563EB'
  const bannerBg    = vencidos > 0 ? '#450A0A' : criticos > 0 ? '#1C1A07' : '#0F1E3D'

  const levelLabel = (level) => {
    if (level === 'vencido')     return { text:'VENCIDO', color:'#DC2626' }
    if (level === 'critico')     return { text:'< 30 DÍAS', color:'#D97706' }
    return                              { text:'< 60 DÍAS', color:'#2563EB' }
  }

  return (
    <div className="mx-4 mb-3 rounded-xl overflow-hidden border"
         style={{background:bannerBg, borderColor:bannerColor+'44'}}>

      {/* Header */}
      <button onClick={() => setExpanded(p=>!p)}
        className="w-full px-4 py-3 flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {vencidos > 0 ? '🔴' : criticos > 0 ? '🟠' : '🟡'}
          </span>
          <div>
            <p className="font-mono text-xs font-bold" style={{color:bannerColor}}>
              {vencidos > 0
                ? `${vencidos} EXTINTOR${vencidos>1?'ES':''} VENCIDO${vencidos>1?'S':''}`
                : criticos > 0
                ? `${criticos} EXTINTOR${criticos>1?'ES':''} POR VENCER (< 30 días)`
                : `${advertencias} EXTINTOR${advertencias>1?'ES':''} PRÓXIMOS A VENCER`
              }
            </p>
            <p className="font-mono text-[10px] text-slate-500 mt-0.5">
              {profile.airportCode} · Toca para ver detalles
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold" style={{color:bannerColor}}>
            {alerts.length}
          </span>
          <svg width="16" height="16" fill="none" stroke={bannerColor} strokeWidth="2" viewBox="0 0 24 24"
               style={{transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition:'0.2s'}}>
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </button>

      {/* Detail list */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-white/5">
          {alerts.map((a, i) => {
            const lbl = levelLabel(a.level)
            return (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="font-mono text-xs font-bold text-white">{a.serial}</p>
                  <p className="font-mono text-[10px] text-slate-500">{a.zone} · {a.type}</p>
                  <p className="font-mono text-[10px] text-slate-600">Vence: {a.date}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[10px] font-bold px-2 py-1 rounded"
                        style={{background:lbl.color+'22', color:lbl.color}}>
                    {lbl.text}
                  </span>
                  <p className="font-mono text-[10px] text-slate-600 mt-1">
                    {a.daysLeft < 0 ? `${Math.abs(a.daysLeft)} días vencido` : `${a.daysLeft} días`}
                  </p>
                </div>
              </div>
            )
          })}
          <button onClick={() => setDismissed(true)}
            className="w-full font-mono text-[10px] text-slate-600 hover:text-slate-400 pt-1">
            Descartar por hoy
          </button>
        </div>
      )}
    </div>
  )
}
