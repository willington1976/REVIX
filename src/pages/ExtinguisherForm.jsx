import { useState, useRef } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { encodeQRPayload } from '../utils/qrHelpers'
import { TopBar, AppFooter } from '../components/AppShell'
import jsPDF from 'jspdf'

const TYPES = ['PQS (Polvo Químico Seco)','CO2','Agua','Espuma AFFF','Halotron','Clase D']
const ZONES = ['Terminal Nacional','Terminal Internacional','Sala de Pasajeros','Pasillos',
  'Servicios Médicos','Torre de Control','Área de Rampa','Hangares','Bomberos/BAE','Otro']

function Field({ label, children }) {
  return (
    <div>
      <label className="text-slate-500 text-[10px] font-mono uppercase tracking-widest block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full bg-[#0F172A] border border-white/10 text-white rounded-xl px-4 text-sm focus:outline-none focus:border-[#2563EB] transition-colors font-mono"
const selectCls = inputCls

export default function ExtinguisherForm() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qrRef = useRef()
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [form, setForm] = useState({ serial:'', placa:'', zone:'', exactLocation:'', type:'', capacity:'', capacityUnit:'kg', expiryDate:'', lastRecharge:'', lastHydroTest:'', homolograma:'' })
  const set = (k,v) => setForm(p=>({...p,[k]:v}))

  const handleSave = async () => {
    if (!form.serial || !form.zone || !form.type || !form.capacity) { alert('Completa los campos obligatorios'); return }
    setSaving(true)
    try {
      const ref = await addDoc(collection(db,'airports',profile.airportCode,'extinguishers'), {
        ...form, airportCode:profile.airportCode, airportName:profile.airportName||profile.airportCode,
        createdAt:serverTimestamp(), createdBy:profile.name||'admin', active:true,
      })
      setSavedId(ref.id)
    } catch(err) { alert('Error: '+err.message) } finally { setSaving(false) }
  }

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const doc = new jsPDF({ format:[80,80], unit:'mm' })
    doc.setFillColor(255,255,255); doc.rect(0,0,80,80,'F')
    doc.addImage(canvas.toDataURL('image/png'),'PNG',10,6,60,60)
    doc.setFontSize(7); doc.setFont('helvetica','bold')
    doc.text(form.serial,40,70,{align:'center'})
    doc.text(form.zone,40,74,{align:'center'})
    doc.text(profile.airportCode,40,78,{align:'center'})
    doc.save(`QR_${form.serial}_${profile.airportCode}.pdf`)
  }

  const qrValue = savedId ? encodeQRPayload(profile.airportCode, savedId) : ''

  return (
    <div className="min-h-screen bg-[#0F172A] pb-16">
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Registrar Extintor" back/>

      <div className="px-4 py-5 space-y-4">
        {savedId ? (
          <div className="card-highlight rounded-2xl border border-emerald-500/30 p-6 text-center"
               style={{background:'#052E16'}}>
            <p className="text-emerald-400 font-mono text-xs uppercase tracking-widest mb-1">✓ Registrado correctamente</p>
            <p className="font-mono text-2xl font-bold text-white mt-2 mb-4">{form.serial}</p>
            <div ref={qrRef} className="inline-block bg-white p-3 rounded-xl mb-4">
              <QRCode value={qrValue} size={180} level="H"/>
            </div>
            <p className="font-mono text-xs text-slate-500 mb-5">{profile.airportCode} · {form.zone}</p>
            <button onClick={downloadQR}
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl text-sm transition-colors mb-2"
              style={{minHeight:48}}>
              Descargar QR (PDF)
            </button>
            <button
              onClick={() => { setSavedId(null); setForm({serial:'',zone:'',exactLocation:'',type:'',capacity:'',capacityUnit:'kg',expiryDate:'',lastRecharge:''}) }}
              className="w-full border border-white/10 text-slate-400 hover:text-white font-mono rounded-xl text-xs transition-colors"
              style={{minHeight:48}}>
              + REGISTRAR OTRO
            </button>
          </div>
        ) : (
          <>
            <Field label="Serial / Código *">
              <input value={form.serial} onChange={e=>set('serial',e.target.value)}
                placeholder="EXT-001" className={inputCls} style={{minHeight:48}}/>
            </Field>

            <Field label="Zona *">
              <select value={form.zone} onChange={e=>set('zone',e.target.value)}
                className={selectCls} style={{minHeight:48}}>
                <option value="">Selecciona zona</option>
                {ZONES.map(z=><option key={z} value={z}>{z}</option>)}
              </select>
            </Field>

            <Field label="Ubicación exacta *">
              <input value={form.exactLocation} onChange={e=>set('exactLocation',e.target.value)}
                placeholder="Frente a puerta 3, columna izquierda"
                className={inputCls} style={{minHeight:48}}/>
            </Field>

            <Field label="Tipo *">
              <select value={form.type} onChange={e=>set('type',e.target.value)}
                className={selectCls} style={{minHeight:48}}>
                <option value="">Selecciona tipo</option>
                {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </Field>

            <div className="flex gap-3">
              <Field label="Capacidad *">
                <input type="number" value={form.capacity} onChange={e=>set('capacity',e.target.value)}
                  placeholder="5" className={inputCls} style={{minHeight:48}}/>
              </Field>
              <div className="w-28">
                <Field label="Unidad">
                  <select value={form.capacityUnit} onChange={e=>set('capacityUnit',e.target.value)}
                    className={selectCls} style={{minHeight:48}}>
                    <option value="kg">kg</option>
                    <option value="lb">lb</option>
                    <option value="L">L</option>
                  </select>
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Vencimiento">
                <input type="date" value={form.expiryDate} onChange={e=>set('expiryDate',e.target.value)}
                  className={inputCls} style={{minHeight:48}}/>
              </Field>
              <Field label="Última recarga">
                <input type="date" value={form.lastRecharge} onChange={e=>set('lastRecharge',e.target.value)}
                  className={inputCls} style={{minHeight:48}}/>
              </Field>
            </div>

            <div className="w-full h-px bg-white/5 my-2"/>
            <p className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">Datos institucionales</p>

            <Field label="# Placa de inventario">
              <input value={form.placa} onChange={e=>set('placa',e.target.value)}
                placeholder="AERO-2024-001"
                className={inputCls} style={{minHeight:48}}/>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Último test hidrostático">
                <input type="date" value={form.lastHydroTest} onChange={e=>set('lastHydroTest',e.target.value)}
                  className={inputCls} style={{minHeight:48}}/>
              </Field>
              <Field label="Homolograma vigente">
                <select value={form.homolograma} onChange={e=>set('homolograma',e.target.value)}
                  className={inputCls} style={{minHeight:48}}>
                  <option value="">Selecciona</option>
                  <option value="vigente">Vigente</option>
                  <option value="vencido">Vencido</option>
                  <option value="sin_homolograma">Sin homolograma</option>
                </select>
              </Field>
            </div>

            <button onClick={handleSave} disabled={saving}
              className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors mt-2"
              style={{minHeight:52}}>
              {saving ? 'Guardando...' : 'Guardar y generar QR'}
            </button>
          </>
        )}
      </div>
      <AppFooter/>
    </div>
  )
}
