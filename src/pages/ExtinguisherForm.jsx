import { useState, useRef } from 'react'
import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { encodeQRPayload } from '../utils/qrHelpers'
import { TopBar, AppFooter } from '../components/AppShell'
import jsPDF from 'jspdf'

const TYPES = ['PQS (Polvo Químico Seco)','CO2','Agua','Espuma AFFF','Halotron','Clase D','Otro']
const ZONES = ['Terminal Nacional','Terminal Internacional','Sala de Pasajeros','Pasillos',
  'Servicios Médicos','Torre de Control','Área de Rampa','Hangares','Bomberos/BAE','Otro']

const inp = {
  width:'100%', background:'#111827', border:'1px solid rgba(255,255,255,0.12)',
  color:'#F1F5F9', borderRadius:10, padding:'0 16px', fontSize:14,
  minHeight:48, outline:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box'
}
const lbl = { fontSize:11, fontWeight:500, color:'#64748B', display:'block',
               marginBottom:8, textTransform:'uppercase', letterSpacing:'0.08em' }
const divider = { height:1, background:'rgba(255,255,255,0.04)', margin:'4px 0' }

const Field = ({label, children}) => (
  <div><label style={lbl}>{label}</label>{children}</div>
)

export default function ExtinguisherForm() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qrRef = useRef()
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [customType, setCustomType] = useState('')
  const [customZone, setCustomZone] = useState('')
  const [form, setForm] = useState({
    serial:'', placa:'', zone:'', exactLocation:'', type:'',
    capacity:'', capacityUnit:'kg', expiryDate:'', lastRecharge:'',
    lastHydroTest:'', homolograma:''
  })
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  const handleSave = async () => {
    const finalType = form.type==='Otro' ? (customType.trim()||'Otro') : form.type
    const finalZone = form.zone==='Otro' ? (customZone.trim()||'Otro') : form.zone
    if (!form.serial||!finalZone||!finalType||!form.capacity) { alert('Completa los campos obligatorios'); return }
    setSaving(true)
    try {
      // Check for duplicate serial
      const dupSnap = await getDocs(query(
        collection(db,'airports',profile.airportCode,'extinguishers'),
        where('serial','==',form.serial.trim())
      ))
      if (!dupSnap.empty) {
        alert(`Ya existe un extintor con serial "${form.serial}" en el inventario.`)
        setSaving(false); return
      }
      const ref = await addDoc(collection(db,'airports',profile.airportCode,'extinguishers'), {
        ...form,
        type: finalType,
        zone: finalZone,
        serial: form.serial.trim(),
        airportCode:profile.airportCode, airportName:profile.airportName||profile.airportCode,
        createdAt:serverTimestamp(), createdBy:profile.name||'admin', active:true,
      })
      setSavedId(ref.id)
    } catch(err) { alert('Error: '+err.message) } finally { setSaving(false) }
  }

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const pdf = new jsPDF({format:[80,80],unit:'mm'})
    pdf.setFillColor(255,255,255); pdf.rect(0,0,80,80,'F')
    pdf.addImage(canvas.toDataURL('image/png'),'PNG',10,6,60,60)
    pdf.setFontSize(7); pdf.setFont('helvetica','bold')
    pdf.text(form.serial,40,70,{align:'center'})
    pdf.text(form.zone,40,74,{align:'center'})
    pdf.text(profile.airportCode,40,78,{align:'center'})
    pdf.save(`QR_${form.serial}_${profile.airportCode}.pdf`)
  }

  const qrValue = savedId ? encodeQRPayload(profile.airportCode, savedId) : ''

  if (savedId) return (
    <div style={{minHeight:'100vh', background:'#111827', paddingBottom:80}}>
      <TopBar title="Extintor registrado" back/>
      <div style={{padding:'20px 16px', display:'flex', flexDirection:'column', gap:16, alignItems:'center'}}>
        <div style={{background:'#1E293B', border:'1px solid rgba(21,128,61,0.3)',
                     borderRadius:16, padding:24, width:'100%', textAlign:'center'}}>
          <div style={{display:'inline-flex', alignItems:'center', justifyContent:'center',
                       width:40, height:40, borderRadius:10, background:'rgba(21,128,61,0.15)',
                       marginBottom:12}}>
            <svg width="20" height="20" fill="none" stroke="#4ADE80" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p style={{fontSize:13, fontWeight:500, color:'#4ADE80', margin:'0 0 4px',
                     textTransform:'uppercase', letterSpacing:'0.06em'}}>Registrado correctamente</p>
          <p style={{fontFamily:'JetBrains Mono,monospace', fontSize:24, fontWeight:700,
                     color:'#F1F5F9', margin:'8px 0 4px'}}>{form.serial}</p>
          <p style={{fontSize:12, color:'#475569', margin:0}}>{profile.airportCode} · {form.zone}</p>
        </div>

        {/* QR */}
        <div style={{background:'white', padding:16, borderRadius:16}}>
          <div ref={qrRef}><QRCode value={qrValue} size={200} level="H"/></div>
        </div>
        <p style={{fontSize:11, color:'#334155', fontFamily:'JetBrains Mono,monospace',
                   textAlign:'center', margin:0}}>
          Imprime y pega este QR en el extintor físico
        </p>

        <div style={{width:'100%', display:'flex', flexDirection:'column', gap:8}}>
          <button onClick={downloadQR}
            style={{minHeight:52, borderRadius:10, border:'none', background:'#1D6FE8',
                    color:'white', fontWeight:600, fontSize:14, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            Descargar QR (PDF)
          </button>
          <button onClick={()=>{ setSavedId(null); setForm({serial:'',placa:'',zone:'',exactLocation:'',type:'',capacity:'',capacityUnit:'kg',expiryDate:'',lastRecharge:'',lastHydroTest:'',homolograma:''}) }}
            style={{minHeight:48, borderRadius:10, border:'1px solid rgba(255,255,255,0.12)',
                    background:'transparent', color:'#94A3B8', fontSize:14, cursor:'pointer', fontFamily:'Inter,sans-serif'}}>
            + Registrar otro extintor
          </button>
        </div>
      </div>
      <AppFooter/>
    </div>
  )

  return (
    <div style={{minHeight:'100vh', background:'#111827', paddingBottom:80}}>
      <TopBar title="Registrar Extintor" back/>
      <div style={{padding:'20px 16px', display:'flex', flexDirection:'column', gap:16}}>

        {/* Section: Identificación */}
        <div style={{background:'#1E293B', border:'1px solid rgba(255,255,255,0.10)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14}}>
          <p style={{fontSize:11, fontWeight:600, color:'#334155', textTransform:'uppercase',
                     letterSpacing:'0.1em', margin:0}}>Identificación</p>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <Field label="Serial *">
              <input value={form.serial} onChange={e=>set('serial',e.target.value)}
                placeholder="EXT-001" style={inp}/>
            </Field>
            <Field label="# Placa inventario">
              <input value={form.placa} onChange={e=>set('placa',e.target.value)}
                placeholder="AERO-001" style={inp}/>
            </Field>
          </div>
          <Field label="Tipo *">
            <select value={form.type} onChange={e=>set('type',e.target.value)} style={{...inp,cursor:'pointer'}}>
              <option value="">Selecciona tipo</option>
              {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          {form.type==='Otro' && (
            <Field label="Especifica el tipo">
              <input value={customType} onChange={e=>setCustomType(e.target.value)}
                placeholder="Ej: Halón 1301, Agua nebulizada..." style={inp}/>
            </Field>
          )}
          <div style={{display:'grid', gridTemplateColumns:'1fr 100px', gap:12}}>
            <Field label="Capacidad *">
              <input type="number" value={form.capacity} onChange={e=>set('capacity',e.target.value)}
                placeholder="5" style={inp}/>
            </Field>
            <Field label="Unidad">
              <select value={form.capacityUnit} onChange={e=>set('capacityUnit',e.target.value)} style={{...inp,cursor:'pointer'}}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
                <option value="L">L</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Section: Ubicación */}
        <div style={{background:'#1E293B', border:'1px solid rgba(255,255,255,0.10)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14}}>
          <p style={{fontSize:11, fontWeight:600, color:'#334155', textTransform:'uppercase',
                     letterSpacing:'0.1em', margin:0}}>Ubicación</p>
          <Field label="Zona *">
            <select value={form.zone} onChange={e=>set('zone',e.target.value)} style={{...inp,cursor:'pointer'}}>
              <option value="">Selecciona zona</option>
              {ZONES.map(z=><option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          {form.zone==='Otro' && (
            <Field label="Especifica la zona">
              <input value={customZone} onChange={e=>setCustomZone(e.target.value)}
                placeholder="Ej: Bodega norte, Sala técnica..." style={inp}/>
            </Field>
          )}
          <Field label="Ubicación exacta *">
            <input value={form.exactLocation} onChange={e=>set('exactLocation',e.target.value)}
              placeholder="Frente a puerta 3, columna izquierda" style={inp}/>
          </Field>
        </div>

        {/* Section: Fechas */}
        <div style={{background:'#1E293B', border:'1px solid rgba(255,255,255,0.10)', borderRadius:12, padding:16, display:'flex', flexDirection:'column', gap:14}}>
          <p style={{fontSize:11, fontWeight:600, color:'#334155', textTransform:'uppercase',
                     letterSpacing:'0.1em', margin:0}}>Fechas y certificaciones</p>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
            <Field label="Vencimiento agente">
              <input type="date" value={form.expiryDate} onChange={e=>set('expiryDate',e.target.value)} style={inp}/>
            </Field>
            <Field label="Última recarga">
              <input type="date" value={form.lastRecharge} onChange={e=>set('lastRecharge',e.target.value)} style={inp}/>
            </Field>
            <Field label="Último test hidrostático">
              <input type="date" value={form.lastHydroTest} onChange={e=>set('lastHydroTest',e.target.value)} style={inp}/>
            </Field>
            <Field label="Homolograma">
              <select value={form.homolograma} onChange={e=>set('homolograma',e.target.value)} style={{...inp,cursor:'pointer'}}>
                <option value="">Selecciona</option>
                <option value="vigente">Vigente</option>
                <option value="vencido">Vencido</option>
                <option value="sin_homolograma">Sin homolograma</option>
              </select>
            </Field>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{minHeight:52, borderRadius:10, border:'none', background:'#15803D',
                  color:'white', fontWeight:600, fontSize:15, cursor:'pointer',
                  opacity:saving?0.7:1, fontFamily:'Inter,sans-serif'}}>
          {saving ? 'Guardando...' : 'Guardar y generar QR'}
        </button>
      </div>
      <AppFooter/>
    </div>
  )
}
