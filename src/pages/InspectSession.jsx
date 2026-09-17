import { useState, useEffect, useRef } from 'react'
import { doc, getDoc, setDoc, deleteDoc, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore'
import { db, storage } from '../firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { TopBar, AppFooter } from '../components/AppShell'
import { decodeQRPayload } from '../utils/qrHelpers'
import { generateInspectionPDF } from '../utils/generatePDF'

const CHECKS = [
  { key:'pressure', label:'Manómetro en zona verde',        icon:'⏱' },
  { key:'pasador',  label:'Pasador de seguridad intacto',   icon:'📌' },
  { key:'seal',     label:'Sello/seguro sin violación',     icon:'🔒' },
  { key:'paint',    label:'Pintura sin corrosión ni daños', icon:'🎨' },
  { key:'handle',   label:'Manija de transporte OK',        icon:'✊' },
  { key:'hose',     label:'Manguera sin daños u obstr.',    icon:'🔧' },
  { key:'nozzle',   label:'Corneta/boquilla sin obstr.',    icon:'📯' },
  { key:'cylinder', label:'Estado físico del cilindro OK',  icon:'🧯' },
  { key:'signage',  label:'Señalización visible y legible', icon:'🚨' },
]
const defaultChecks = () => ({ pressure:null,pasador:null,seal:null,paint:null,handle:null,hose:null,nozzle:null,cylinder:null,signage:null })
const BG='#0F172A', CARD='#1E293B', BLUE='#2563EB', GREEN='#16A34A', RED='#DC2626', AMBER='#D97706'

export default function InspectSession() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const scannerRef = useRef(null)
  const qrInstanceRef = useRef(null)
  const lockRef = useRef(false)

  const [phase, setPhase] = useState('start')
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0])
  const [startTime] = useState(new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'}))
  const [allExt, setAllExt] = useState([])
  const [currentExt, setCurrentExt] = useState(null)
  const [checks, setChecks] = useState(defaultChecks())
  const [novedad, setNovedad] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [inspected, setInspected] = useState([])
  const [scanError, setScanError] = useState('')
  const [camError, setCamError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showWarning, setShowWarning] = useState(false)
  const [editandoLast, setEditandoLast] = useState(false)
  const [draftExists, setDraftExists] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [showDraftModal, setShowDraftModal] = useState(false)

  useEffect(() => {
    const init = async () => {
      const [extSnap, draftSnap] = await Promise.all([
        getDocs(collection(db,'airports',profile.airportCode,'extinguishers')),
        getDoc(doc(db,'airports',profile.airportCode,'drafts','current'))
      ])
      setAllExt(extSnap.docs.map(d=>({id:d.id,...d.data()})))
      if (draftSnap.exists()) setDraftExists(true)
    }
    init()
  }, [])

  const pending  = allExt.filter(e => !inspected.find(i => i.extinguisherId === e.id))
  const progress = allExt.length > 0 ? Math.round((inspected.length/allExt.length)*100) : 0
  const allChecked = Object.values(checks).every(v => v !== null)
  const hasNovedad = Object.values(checks).some(v => v === false)
  const doneCount  = Object.values(checks).filter(v => v !== null).length

  useEffect(() => {
    if (phase !== 'scanning') return
    if (!scannerRef.current) return
    lockRef.current = false
    setScanError(''); setCamError('')

    const qr = new Html5Qrcode('qr-viewport')
    qrInstanceRef.current = qr

    qr.start(
      { facingMode: 'environment' },
      { fps: 12, qrbox: { width: 230, height: 230 }, aspectRatio: 1.0 },
      async (text) => {
        if (lockRef.current) return
        lockRef.current = true
        const payload = decodeQRPayload(text)
        if (!payload || payload.airportCode !== profile.airportCode) {
          setScanError('QR inválido o de otro aeropuerto')
          setTimeout(() => { lockRef.current = false; setScanError('') }, 2500)
          return
        }
        if (inspected.find(i => i.extinguisherId === payload.extinguisherId)) {
          setScanError('Este extintor ya fue inspeccionado')
          setTimeout(() => { lockRef.current = false; setScanError('') }, 2500)
          return
        }
        try {
          await qr.stop()
          const snap = await getDoc(doc(db,'airports',profile.airportCode,'extinguishers',payload.extinguisherId))
          if (!snap.exists()) { setScanError('Extintor no encontrado'); lockRef.current = false; return }
          setCurrentExt({ id:snap.id, ...snap.data() })
          setChecks(defaultChecks()); setNovedad(''); setPhoto(null); setPhotoPreview(null)
          setPhase('checklist')
        } catch { setScanError('Error al cargar extintor'); lockRef.current = false }
      },
      () => {}
    ).catch(e => { setCamError('Sin acceso a cámara trasera. Verifica permisos.'); console.error(e) })

    return () => { try { qr.stop().catch(()=>{}) } catch {} }
  }, [phase])

  const handleSaveCheck = () => {
    if (!allChecked) { alert('Completa los 9 ítems del checklist'); return }
    if (hasNovedad && !novedad.trim()) { alert('Describe la novedad encontrada'); return }
    setInspected(prev => [...prev, {
      extinguisherId:currentExt.id, serial:currentExt.serial, placa:currentExt.placa||'',
      zone:currentExt.zone, exactLocation:currentExt.exactLocation, type:currentExt.type,
      capacity:`${currentExt.capacity} ${currentExt.capacityUnit}`,
      lastHydroTest:currentExt.lastHydroTest||'', homolograma:currentExt.homolograma||'',
      checks, novedad: novedad.trim(), photo, result:hasNovedad?'novedad':'ok',
    }])
    setEditandoLast(false)
    setPhase('scanning')
  }

  const handleEditLast = () => {
    if (inspected.length === 0) return
    const last = inspected[inspected.length - 1]
    // Restore ext data
    setCurrentExt({
      id: last.extinguisherId,
      serial: last.serial,
      placa: last.placa,
      zone: last.zone,
      exactLocation: last.exactLocation,
      type: last.type?.split(' ')[0] || last.type,
      capacity: last.capacity?.split(' ')[0] || last.capacity,
      capacityUnit: last.capacity?.split(' ')[1] || '',
      lastHydroTest: last.lastHydroTest,
      homolograma: last.homolograma,
    })
    setChecks({ ...last.checks })
    setNovedad(last.novedad || '')
    setPhoto(null)
    setPhotoPreview(null)
    // Remove last from inspected
    setInspected(prev => prev.slice(0, -1))
    setEditandoLast(true)
    setPhase('checklist')
  }

  const handleSaveDraft = async () => {
    if (inspected.length === 0) return
    setSavingDraft(true)
    try {
      await setDoc(doc(db,'airports',profile.airportCode,'drafts','current'), {
        sessionDate,
        startTime,
        inspectorName: profile.name,
        inspectorUid: profile.uid || '',
        inspected: inspected.map(({photo:_,...rest})=>rest), // exclude File objects
        savedAt: serverTimestamp(),
      })
      setDraftExists(true)
      alert(`Sesión guardada. Llevas ${inspected.length} extintor${inspected.length!==1?'es':''} inspeccionado${inspected.length!==1?'s':''}. Puedes retomar mañana.`)
      navigate('/')
    } catch(err) { alert('Error al guardar: '+err.message) }
    finally { setSavingDraft(false) }
  }

  const handleResumeDraft = async () => {
    try {
      const snap = await getDoc(doc(db,'airports',profile.airportCode,'drafts','current'))
      if (!snap.exists()) return
      const draft = snap.data()
      setSessionDate(draft.sessionDate || sessionDate)
      setInspected(draft.inspected || [])
      setDraftExists(false)
      setShowDraftModal(false)
    } catch(err) { alert('Error al retomar: '+err.message) }
  }

  const handleDiscardDraft = async () => {
    await deleteDoc(doc(db,'airports',profile.airportCode,'drafts','current'))
    setDraftExists(false)
    setShowDraftModal(false)
  }

  const handleFinish = async () => {
    if (!inspected.length) return
    setSaving(true)
    try {
      const enriched = await Promise.all(inspected.map(async item => {
        let photoUrl = null
        if (item.photo) {
          try {
            const r = ref(storage,`inspections/${profile.airportCode}/${Date.now()}_${item.serial}`)
            await uploadBytes(r, item.photo); photoUrl = await getDownloadURL(r)
          } catch {}
        }
        const { photo:_, ...rest } = item; return { ...rest, photoUrl }
      }))
      const endTime = new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})
      const omitidos = pending.map(e=>({serial:e.serial,zone:e.zone,exactLocation:e.exactLocation}))
      const data = {
        airportCode:profile.airportCode, airportName:profile.airportName||profile.airportCode,
        date:sessionDate, startTime, endTime, inspectorName:profile.name, inspectorUid:profile.uid||'',
        items:enriched, omitidos, totalRegistered:allExt.length, totalInspected:enriched.length,
        totalOk:enriched.filter(e=>e.result==='ok').length,
        totalNovedad:enriched.filter(e=>e.result==='novedad').length,
        totalOmitidos:omitidos.length, createdAt:serverTimestamp(),
      }
      await addDoc(collection(db,'airports',profile.airportCode,'reports'), data)
      generateInspectionPDF(data,enriched,profile.airportName||profile.airportCode,omitidos)
        .save(`Inspeccion_${profile.airportCode}_${sessionDate}.pdf`)
      // Delete draft if existed
      try { await deleteDoc(doc(db,'airports',profile.airportCode,'drafts','current')) } catch {}
      navigate('/reports')
    } catch(err) { alert('Error: '+err.message) } finally { setSaving(false) }
  }

  // START
  if (phase==='start') return (
    <div className="min-h-screen pb-16" style={{background:BG}}>
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Nueva Inspección" back/>
      <div className="px-4 py-5 space-y-3">
        <div className="card-highlight rounded-2xl border border-white/8 p-5" style={{background:CARD}}>
          <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-1">Inspector</p>
          <p className="text-white font-bold text-lg">{profile?.name}</p>
          <p className="font-mono text-xs text-slate-500 mt-1">{profile?.airportName||profile?.airportCode}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="card-highlight rounded-2xl border border-white/8 p-4 text-center" style={{background:CARD}}>
            <p className="font-mono text-3xl font-bold text-white">{allExt.length}</p>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mt-1">A inspeccionar</p>
          </div>
          <div className="card-highlight rounded-2xl border border-white/8 p-4 text-center" style={{background:CARD}}>
            <p className="font-mono text-3xl font-bold" style={{color:BLUE}}>9</p>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mt-1">Ítems por extintor</p>
          </div>
        </div>
        <div>
          <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-2">Fecha</label>
          <input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)}
            className="w-full bg-[#0F172A] border border-white/10 text-white rounded-xl px-4 font-mono text-sm focus:outline-none focus:border-[#2563EB]"
            style={{minHeight:48}}/>
        </div>
        <div className="card-highlight rounded-2xl border border-white/8 p-4" style={{background:CARD}}>
          <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3">Ítems de revisión</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CHECKS.map(c => (
              <div key={c.key} className="rounded-lg px-2 py-1.5 text-center" style={{background:BG}}>
                <span className="text-lg">{c.icon}</span>
                <p className="font-mono text-[9px] text-slate-500 mt-0.5 leading-tight">{c.label.split(' ').slice(0,2).join(' ')}</p>
              </div>
            ))}
          </div>
        </div>
        {draftExists && (
          <button onClick={()=>setShowDraftModal(true)}
            style={{minHeight:52,width:'100%',background:'#1C1A07',borderRadius:16,border:'2px solid #D97706',
                    color:'#D97706',fontWeight:700,fontSize:14,cursor:'pointer'}}>
            📋 Retomar sesión guardada
          </button>
        )}

        <button onClick={()=>setPhase('scanning')} className="w-full text-white font-bold rounded-2xl text-base"
          style={{minHeight:60,background:GREEN}}>🔍 Iniciar nueva inspección</button>

      {showDraftModal && (
        <div className="fixed inset-0 flex items-end justify-center z-50 px-4 pb-6" style={{background:'rgba(0,0,0,0.85)'}}>
          <div className="card-highlight w-full max-w-md rounded-2xl border p-5" style={{background:'#1C1A07',borderColor:'#D9780644'}}>
            <p className="font-bold text-base mb-1" style={{color:'#D97706'}}>📋 Sesión guardada encontrada</p>
            <p className="text-slate-300 text-sm mb-4">Tienes una inspección en progreso. ¿Deseas retomar donde la dejaste?</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleDiscardDraft}
                className="font-semibold rounded-xl text-sm border border-white/10 text-slate-400"
                style={{minHeight:48}}>
                Descartar y empezar de nuevo
              </button>
              <button onClick={handleResumeDraft}
                className="font-bold rounded-xl text-sm"
                style={{minHeight:48, background:'#D97706', color:'#1C1A07'}}>
                Retomar sesión
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
      <AppFooter/>
    </div>
  )

  // SCANNING
  if (phase==='scanning') return (
    <div className="min-h-screen flex flex-col" style={{background:BG}}>
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <div className="sticky top-0 z-10 px-4 pt-3 pb-3 border-b border-white/5" style={{background:BG}}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-white font-semibold text-sm">Escanear extintor</p>
          <span className="font-mono text-white font-bold">{inspected.length}<span className="text-slate-500">/{allExt.length}</span></span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{height:6,background:'#1E293B'}}>
          <div className="h-full rounded-full transition-all duration-500"
               style={{width:`${progress}%`,background:`linear-gradient(90deg,${BLUE},${GREEN})`}}/>
        </div>
        <div className="flex justify-between mt-1">
          <p className="font-mono text-[10px] text-slate-600">{progress}% completado</p>
          <p className="font-mono text-[10px] text-slate-600">{pending.length} pendientes</p>
        </div>
      </div>

      <div className="flex-1 px-4 pt-4 pb-4 flex flex-col gap-3">
        {camError && <div className="rounded-xl px-4 py-3 border" style={{background:'#450A0A',borderColor:RED+'44'}}><p className="font-mono text-xs text-red-400">⚠ {camError}</p></div>}
        {scanError && <div className="rounded-xl px-4 py-3 border" style={{background:'#1C1A07',borderColor:AMBER+'44'}}><p className="font-mono text-xs text-amber-400">⚠ {scanError}</p></div>}

        {/* Camera */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 flex-shrink-0" style={{background:'#000',aspectRatio:'1/1'}}>
          <div id="qr-viewport" ref={scannerRef} className="w-full h-full"/>
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative" style={{width:200,height:200}}>
              {[['top-0 left-0','border-t-2 border-l-2'],['top-0 right-0','border-t-2 border-r-2'],
                ['bottom-0 left-0','border-b-2 border-l-2'],['bottom-0 right-0','border-b-2 border-r-2']].map(([p,b],i) => (
                <div key={i} className={`absolute ${p} ${b} border-white/70`} style={{width:24,height:24}}/>
              ))}
              <div className="absolute left-0 right-0 h-0.5 opacity-70"
                   style={{background:`linear-gradient(90deg,transparent,${GREEN},transparent)`,
                           animation:'scanline 2s linear infinite',top:'50%'}}/>
            </div>
          </div>
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <span className="font-mono text-[10px] text-white/30 uppercase tracking-widest">Cámara trasera · ARFF</span>
          </div>
        </div>
        <p className="font-mono text-[10px] text-slate-600 text-center uppercase tracking-widest">Apunta al QR pegado en el extintor</p>

        <div className="grid grid-cols-2 gap-2 flex-1">
          <div className="card-highlight rounded-xl border p-3" style={{background:CARD,borderColor:AMBER+'22'}}>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{color:AMBER}}>⏳ Pendientes ({pending.length})</p>
            <div className="space-y-1.5 overflow-y-auto" style={{maxHeight:120}}>
              {pending.map((e,i)=><div key={i} className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full flex-shrink-0" style={{background:AMBER}}/><span className="font-mono text-[10px] text-slate-400 truncate">{e.serial}</span></div>)}
            </div>
          </div>
          <div className="card-highlight rounded-xl border p-3" style={{background:CARD,borderColor:GREEN+'22'}}>
            <p className="font-mono text-[10px] uppercase tracking-widest mb-2" style={{color:GREEN}}>✓ Revisados ({inspected.length})</p>
            <div className="space-y-1.5 overflow-y-auto" style={{maxHeight:120}}>
              {inspected.map((item,i)=><div key={i} className="flex items-center justify-between"><span className="font-mono text-[10px] text-slate-400 truncate">{item.serial}</span><span className="font-mono text-[10px] font-bold ml-1" style={{color:item.result==='ok'?GREEN:RED}}>{item.result==='ok'?'✓':'⚠'}</span></div>)}
            </div>
          </div>
        </div>

        {inspected.length > 0 && (
          <button onClick={handleSaveDraft} disabled={savingDraft}
            style={{minHeight:44,width:'100%',background:'transparent',
                    border:'1.5px solid #2563EB',borderRadius:12,
                    color:'#2563EB',fontWeight:600,fontSize:13,cursor:'pointer'}}>
            {savingDraft ? 'Guardando...' : `💾 Pausar y guardar (${inspected.length} listos)`}
          </button>
        )}

        {inspected.length > 0 && (
          <button onClick={handleEditLast}
            style={{minHeight:44,width:'100%',background:'transparent',
                    border:`1.5px solid ${AMBER}`,borderRadius:12,
                    color:AMBER,fontWeight:600,fontSize:13,cursor:'pointer'}}>
            ✏️ Corregir último ({inspected[inspected.length-1]?.serial})
          </button>
        )}

        <button onClick={() => pending.length>0?setShowWarning(true):setPhase('summary')}
          style={{minHeight:56,width:'100%',background:pending.length===0?GREEN:'transparent',
                  border:pending.length===0?'none':`2px solid ${GREEN}`,borderRadius:16,
                  color:pending.length===0?'#ffffff':GREEN,fontWeight:700,fontSize:15,cursor:'pointer'}}>
          {pending.length===0 ? 'Finalizar inspeccion' : `Finalizar (faltan ${pending.length})`}
        </button>
      </div>

      {showWarning && (
        <div className="fixed inset-0 flex items-end justify-center z-50 px-4 pb-6" style={{background:'rgba(0,0,0,0.75)'}}>
          <div className="card-highlight w-full max-w-md rounded-2xl border p-5" style={{background:'#1C1A07',borderColor:AMBER+'44'}}>
            <p className="font-bold text-base mb-1" style={{color:AMBER}}>⚠ Extintores sin revisar</p>
            <p className="text-slate-400 text-sm mb-4"><span className="text-white font-bold">{pending.length}</span> quedarán como omitidos en el informe.</p>
            <div className="space-y-1.5 mb-4 overflow-y-auto" style={{maxHeight:140}}>
              {pending.map((e,i)=><div key={i} className="flex items-center gap-2"><div className="w-1 h-1 rounded-full" style={{background:AMBER}}/><span className="font-mono text-xs text-slate-300">{e.serial} · {e.zone}</span></div>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={()=>setShowWarning(false)} className="font-semibold rounded-xl text-sm border border-white/10 text-slate-400" style={{minHeight:48}}>Seguir escaneando</button>
              <button onClick={()=>{setShowWarning(false);setPhase('summary')}} className="font-bold rounded-xl text-sm" style={{minHeight:48,background:AMBER,color:'#1C1A07'}}>Finalizar igual</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes scanline{0%{transform:translateY(-80px);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(80px);opacity:0}}`}</style>
    </div>
  )

  // CHECKLIST
  if (phase==='checklist') return (
    <div className="min-h-screen flex flex-col pb-24" style={{background:BG}}>
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <div className="sticky top-0 z-10 border-b border-white/5 px-4 py-3" style={{background:BG}}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-xl font-bold text-white">{currentExt?.serial}</p>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{currentExt?.zone}</p>
            <p className="text-slate-600 text-xs">{currentExt?.exactLocation}</p>
          </div>
          <div className="text-right">
            {editandoLast ? (
              <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg"
                    style={{background:AMBER+'22',color:AMBER}}>✏️ CORRIGIENDO</span>
            ) : (
              <>
                <p className="font-mono text-2xl font-bold" style={{color:BLUE}}>{inspected.length+1}</p>
                <p className="font-mono text-[10px] text-slate-600">de {allExt.length}</p>
              </>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-1">
          {CHECKS.map(c => <div key={c.key} className="flex-1 rounded-full h-1.5" style={{background:checks[c.key]===true?GREEN:checks[c.key]===false?RED:'#334155'}}/>)}
        </div>
        <p className="font-mono text-[10px] text-slate-600 mt-1">{doneCount}/9 ítems completados</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto">
        {(currentExt?.photoContext||currentExt?.photoClose) && (
          <div className="card-highlight rounded-xl border border-white/8 overflow-hidden" style={{background:CARD}}>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest px-3 pt-3 pb-2">Guía de ubicación</p>
            <div className={`grid gap-1 px-3 pb-3 ${currentExt.photoContext&&currentExt.photoClose?'grid-cols-2':'grid-cols-1'}`}>
              {currentExt.photoContext&&<div><img src={currentExt.photoContext} alt="" className="w-full rounded-lg object-cover" style={{height:96}}/><p className="font-mono text-[9px] text-slate-600 text-center mt-1">ENTORNO</p></div>}
              {currentExt.photoClose&&<div><img src={currentExt.photoClose} alt="" className="w-full rounded-lg object-cover" style={{height:96}}/><p className="font-mono text-[9px] text-slate-600 text-center mt-1">EXTINTOR</p></div>}
            </div>
          </div>
        )}

        <div className="card-highlight rounded-xl border border-white/8 px-4 py-3 grid grid-cols-3 gap-2 text-center" style={{background:CARD}}>
          <div><p className="font-mono text-[10px] text-slate-500">Tipo</p><p className="font-mono text-xs text-white font-semibold">{currentExt?.type?.split(' ')[0]}</p></div>
          <div><p className="font-mono text-[10px] text-slate-500">Capacidad</p><p className="font-mono text-xs text-white font-semibold">{currentExt?.capacity} {currentExt?.capacityUnit}</p></div>
          <div><p className="font-mono text-[10px] text-slate-500">Vence</p><p className="font-mono text-xs font-semibold" style={{color:currentExt?.expiryDate&&(new Date(currentExt.expiryDate)-new Date())<0?RED:'white'}}>{currentExt?.expiryDate||'--'}</p></div>
        </div>

        {/* Todo OK button */}
        <button
          onClick={() => {
            const allOk = {}
            CHECKS.forEach(c => { allOk[c.key] = true })
            setChecks(allOk)
          }}
          style={{
            width:'100%', minHeight:52, borderRadius:16, border:'none',
            background:'linear-gradient(135deg,#16A34A,#15803D)',
            color:'white', fontWeight:700, fontSize:15, cursor:'pointer',
            letterSpacing:'0.02em'
          }}>
          ✓ Todo OK — Marcar todos como aprobados
        </button>

        {CHECKS.map(item => {
          const val = checks[item.key]
          return (
            <div key={item.key} className="card-highlight rounded-2xl border border-white/8 p-4" style={{background:CARD,borderLeftWidth:3,borderLeftColor:val===true?GREEN:val===false?RED:'transparent'}}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xl">{item.icon}</span>
                <p className="text-white text-sm font-semibold flex-1">{item.label}</p>
                {val!==null&&<span className="font-mono text-xs font-bold" style={{color:val?GREEN:RED}}>{val?'✓ OK':'✗ FALLA'}</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={()=>setChecks(p=>({...p,[item.key]:true}))} className="font-bold rounded-xl text-sm"
                  style={{minHeight:48,background:val===true?GREEN:'transparent',color:val===true?'white':GREEN,border:val===true?'none':`1.5px solid ${GREEN}44`}}>✓ OK</button>
                <button onClick={()=>setChecks(p=>({...p,[item.key]:false}))} className="font-bold rounded-xl text-sm"
                  style={{minHeight:48,background:val===false?RED:'transparent',color:val===false?'white':RED,border:val===false?'none':`1.5px solid ${RED}44`}}>✗ Falla</button>
              </div>
            </div>
          )
        })}

        <div className="card-highlight rounded-2xl border border-white/8 p-4" style={{background:CARD}}>
          <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-2">
            Observaciones {hasNovedad?<span style={{color:RED}}>· requerida</span>:'· opcional'}
          </label>
          <textarea value={novedad} onChange={e=>setNovedad(e.target.value)} rows={3}
            placeholder="Describe la novedad encontrada..."
            className="w-full text-white rounded-xl px-3 py-3 text-sm focus:outline-none resize-none font-mono"
            style={{background:BG,border:`1.5px solid ${hasNovedad&&!novedad?RED+'66':'rgba(255,255,255,0.08)'}`,minHeight:80}}/>
        </div>

        <div className="card-highlight rounded-2xl border border-white/8 p-4" style={{background:CARD}}>
          <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-3">Foto de evidencia (opcional)</p>
          {photoPreview?(
            <div className="relative">
              <img src={photoPreview} alt="" className="w-full rounded-xl object-cover" style={{maxHeight:160}}/>
              <button onClick={()=>{setPhoto(null);setPhotoPreview(null)}} className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white" style={{background:'rgba(0,0,0,0.6)'}}>×</button>
            </div>
          ):(
            <label className="flex flex-col items-center justify-center w-full rounded-xl cursor-pointer border-2 border-dashed border-white/10 hover:border-blue-500/50" style={{minHeight:80}}>
              <span className="text-2xl mb-1">📷</span>
              <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Tomar foto</span>
              <input type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files[0];if(f){setPhoto(f);setPhotoPreview(URL.createObjectURL(f))}}} className="hidden"/>
            </label>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t border-white/5" style={{background:BG}}>
        {!allChecked&&<p className="font-mono text-[10px] text-center mb-2" style={{color:AMBER}}>Faltan {9-doneCount} ítem{9-doneCount!==1?'s':''} por marcar</p>}
        <button onClick={handleSaveCheck} disabled={!allChecked} className="w-full font-bold rounded-2xl text-sm"
          style={{minHeight:56,background:allChecked?BLUE:'#1E293B',color:allChecked?'white':'#475569',opacity:allChecked?1:0.7}}>
          Guardar y escanear siguiente →
        </button>
      </div>
    </div>
  )

  // SUMMARY
  if (phase==='summary' && inspected.length === 0) {
    setPhase('scanning')
    return null
  }
  if (phase==='summary') return (
    <div className="min-h-screen pb-24" style={{background:BG}}>
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Resumen de inspección" back/>
      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-4 gap-2">
          {[{l:'Total',v:allExt.length,c:'text-white'},{l:'Revisados',v:inspected.length,c:'text-blue-400'},{l:'OK',v:inspected.filter(e=>e.result==='ok').length,c:'text-emerald-400'},{l:'Novedad',v:inspected.filter(e=>e.result==='novedad').length,c:'text-red-400'}].map(s=>(
            <div key={s.l} className="card-highlight rounded-xl p-3 text-center border border-white/8" style={{background:CARD}}>
              <p className={`font-mono text-xl font-bold ${s.c}`}>{s.v}</p>
              <p className="font-mono text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>
        <div className="card-highlight rounded-xl border border-white/8 p-4" style={{background:CARD}}>
          <div className="flex justify-between mb-1"><p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Cobertura</p><p className="font-mono text-[10px] text-white font-bold">{progress}%</p></div>
          <div className="w-full rounded-full overflow-hidden" style={{height:8,background:BG}}><div className="h-full rounded-full" style={{width:`${progress}%`,background:progress===100?GREEN:BLUE}}/></div>
        </div>
        {pending.length>0&&(
          <div className="rounded-xl border p-4" style={{background:'#1C1A07',borderColor:AMBER+'33'}}>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:AMBER}}>⚠ No inspeccionados ({pending.length})</p>
            {pending.map((e,i)=><p key={i} className="font-mono text-xs text-slate-400">{e.serial} · {e.zone}</p>)}
          </div>
        )}
        <div className="space-y-2">
          {inspected.map((item,i)=>(
            <div key={i} className="card-highlight rounded-xl border border-white/8 px-4 py-3 flex items-center justify-between" style={{background:CARD,borderLeftWidth:3,borderLeftColor:item.result==='ok'?GREEN:RED}}>
              <div>
                <p className="font-mono text-sm font-bold text-white">{item.serial}</p>
                <p className="font-mono text-[10px] text-slate-500">{item.zone}</p>
                {item.novedad&&<p className="text-xs mt-0.5" style={{color:AMBER}}>{item.novedad}</p>}
              </div>
              <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg" style={{background:item.result==='ok'?GREEN+'22':RED+'22',color:item.result==='ok'?GREEN:RED}}>{item.result==='ok'?'✓ OK':'⚠ NOV'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 px-4 py-3 border-t border-white/5" style={{background:BG}}>
        <button onClick={handleFinish} disabled={saving}
          style={{minHeight:56,width:'100%',background:GREEN,borderRadius:16,border:'none',
                  color:'#ffffff',fontWeight:700,fontSize:15,opacity:saving?0.6:1,cursor:'pointer'}}>
          {saving ? 'Guardando...' : 'Finalizar y generar PDF'}
        </button>
      </div>
    </div>
  )
}
