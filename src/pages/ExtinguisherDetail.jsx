import { useState, useRef, useEffect } from 'react'
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeCanvas as QRCode } from 'qrcode.react'
import { encodeQRPayload } from '../utils/qrHelpers'
import { TopBar, AppFooter } from '../components/AppShell'
import jsPDF from 'jspdf'

const TYPES = ['PQS (Polvo Químico Seco)','CO2','Agua','Espuma AFFF','Halotron','Clase D']
const ZONES = ['Terminal Nacional','Terminal Internacional','Sala de Pasajeros','Pasillos',
  'Servicios Médicos','Torre de Control','Área de Rampa','Hangares','Bomberos/BAE','Otro']

const inputCls = "w-full bg-[#0F172A] border border-white/10 text-white rounded-xl px-4 text-sm focus:outline-none focus:border-[#2563EB] transition-colors font-mono"

function Field({ label, children }) {
  return (
    <div>
      <label className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-2">{label}</label>
      {children}
    </div>
  )
}

function statusBadge(expiryDate) {
  if (!expiryDate) return { label:'SIN FECHA', color:'#475569' }
  const diff = (new Date(expiryDate) - new Date()) / (1000*60*60*24)
  if (diff < 0)  return { label:'VENCIDO',   color:'#EF4444' }
  if (diff < 30) return { label:'< 30 DÍAS', color:'#F59E0B' }
  if (diff < 60) return { label:'< 60 DÍAS', color:'#FBBF24' }
  return           { label:'AL DÍA',    color:'#22C55E' }
}

export default function ExtinguisherDetail() {
  const { id } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qrRef = useRef()

  const [ext, setExt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [tab, setTab] = useState('info')
  const [uploadingPhoto, setUploadingPhoto] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const loadHistory = async () => {
    if (historyLoaded) return
    try {
      const snap = await getDocs(
        query(
          collection(db, 'airports', profile.airportCode, 'reports'),
          orderBy('createdAt', 'desc'),
          limit(20)
        )
      )
      const relevant = []
      snap.docs.forEach(d => {
        const r = d.data()
        const item = (r.items || []).find(i => i.extinguisherId === id)
        if (item) relevant.push({ reportId: d.id, date: r.date, startTime: r.startTime, inspectorName: r.inspectorName, item })
      })
      setHistory(relevant)
      setHistoryLoaded(true)
    } catch(e) { console.error(e) }
  }

  useEffect(() => {
    getDoc(doc(db, 'airports', profile.airportCode, 'extinguishers', id))
      .then(snap => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() }
          setExt(data)
          setForm(data)
        }
        setLoading(false)
      })
  }, [id])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'airports', profile.airportCode, 'extinguishers', id), {
        serial: form.serial,
        placa: form.placa || '',
        zone: form.zone,
        exactLocation: form.exactLocation,
        type: form.type,
        capacity: form.capacity,
        capacityUnit: form.capacityUnit,
        expiryDate: form.expiryDate,
        lastRecharge: form.lastRecharge,
        lastHydroTest: form.lastHydroTest || '',
        homolograma: form.homolograma || '',
        updatedAt: serverTimestamp(),
      })
      setExt(f => ({ ...f, ...form }))
      setEditing(false)
    } catch (err) {
      alert('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const pdf = new jsPDF({ format: [80, 80], unit: 'mm' })
    pdf.setFillColor(255, 255, 255)
    pdf.rect(0, 0, 80, 80, 'F')
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 6, 60, 60)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.text(ext.serial, 40, 70, { align: 'center' })
    pdf.text(ext.zone, 40, 74, { align: 'center' })
    pdf.text(profile.airportCode, 40, 78, { align: 'center' })
    pdf.save(`QR_${ext.serial}_${profile.airportCode}.pdf`)
  }

  const handleDelete = async () => {
    if (deleteConfirm !== ext.serial) { alert('El serial no coincide'); return }
    setDeleting(true)
    try {
      await deleteDoc(doc(db, 'airports', profile.airportCode, 'extinguishers', id))
      navigate('/extinguishers')
    } catch(err) {
      alert('Error al eliminar: ' + err.message)
    } finally {
      setDeleting(false)
    }
  }

  const handlePhotoUpload = async (e, type) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(type)
    try {
      const storageRef = ref(storage, `extinguishers/${profile.airportCode}/${id}_${type}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      const field = type === 'context' ? 'photoContext' : 'photoClose'
      await updateDoc(doc(db, 'airports', profile.airportCode, 'extinguishers', id), { [field]: url })
      setExt(p => ({ ...p, [field]: url }))
    } catch (err) {
      alert('Error al subir foto: ' + err.message)
    } finally {
      setUploadingPhoto(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  if (!ext) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <p className="font-mono text-slate-500">Extintor no encontrado</p>
    </div>
  )

  const qrValue = encodeQRPayload(profile.airportCode, id)
  const badge = statusBadge(ext.expiryDate)

  return (
    <div className="min-h-screen bg-[#0F172A] pb-16">
      <div className="h-0.5 w-full" style={{background:'linear-gradient(90deg,#2563EB,#16A34A)'}}/>
      <TopBar title="Detalle de Extintor" back/>

      {/* Identity strip */}
      <div className="px-4 pt-4 pb-3">
        <div className="card-highlight rounded-2xl border border-white/8 p-4"
             style={{background:'#1E293B', borderLeftColor: badge.color, borderLeftWidth: 4}}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-3xl font-bold text-white tracking-tight">{ext.serial}</p>
              <p className="text-slate-400 text-xs uppercase tracking-widest mt-1">{ext.zone}</p>
              <p className="text-slate-500 text-xs mt-0.5">{ext.exactLocation}</p>
              <p className="font-mono text-xs text-slate-600 mt-1">{ext.type} · {ext.capacity} {ext.capacityUnit}</p>
            </div>
            <span className="font-mono text-[10px] font-bold px-2 py-1 rounded mt-1"
                  style={{color: badge.color, background: badge.color+'22'}}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-4">
        {[['info','📋 Datos'],['qr','QR'],['photos','📷 Fotos'],['history','📅 Historial']].map(([v,l]) => (
          <button key={v} onClick={() => { setTab(v); if(v==='history') loadHistory() }}
            className="flex-1 font-mono text-xs rounded-xl border transition-colors"
            style={{
              minHeight: 40,
              background: tab===v ? '#2563EB' : '#1E293B',
              borderColor: tab===v ? '#2563EB' : 'rgba(255,255,255,0.08)',
              color: tab===v ? 'white' : '#64748B'
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── TAB: INFO ── */}
      {tab === 'info' && (
        <div className="px-4 space-y-4">
          {editing ? (
            <>
              <Field label="Serial / Código">
                <input value={form.serial} onChange={e=>set('serial',e.target.value)}
                  className={inputCls} style={{minHeight:48}}/>
              </Field>
              <Field label="Zona">
                <select value={form.zone} onChange={e=>set('zone',e.target.value)}
                  className={inputCls} style={{minHeight:48}}>
                  {ZONES.map(z=><option key={z} value={z}>{z}</option>)}
                </select>
              </Field>
              <Field label="Ubicación exacta">
                <input value={form.exactLocation} onChange={e=>set('exactLocation',e.target.value)}
                  className={inputCls} style={{minHeight:48}}/>
              </Field>
              <Field label="Tipo">
                <select value={form.type} onChange={e=>set('type',e.target.value)}
                  className={inputCls} style={{minHeight:48}}>
                  {TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <div className="flex gap-3">
                <Field label="Capacidad">
                  <input type="number" value={form.capacity} onChange={e=>set('capacity',e.target.value)}
                    className={inputCls} style={{minHeight:48}}/>
                </Field>
                <div className="w-28">
                  <Field label="Unidad">
                    <select value={form.capacityUnit} onChange={e=>set('capacityUnit',e.target.value)}
                      className={inputCls} style={{minHeight:48}}>
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

              <div className="w-full h-px bg-white/5"/>
              <p className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">Datos institucionales</p>

              <Field label="# Placa de inventario">
                <input value={form.placa||''} onChange={e=>set('placa',e.target.value)}
                  placeholder="AERO-2024-001" className={inputCls} style={{minHeight:48}}/>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Último test hidrostático">
                  <input type="date" value={form.lastHydroTest||''} onChange={e=>set('lastHydroTest',e.target.value)}
                    className={inputCls} style={{minHeight:48}}/>
                </Field>
                <Field label="Homolograma">
                  <select value={form.homolograma||''} onChange={e=>set('homolograma',e.target.value)}
                    className={inputCls} style={{minHeight:48}}>
                    <option value="">Selecciona</option>
                    <option value="vigente">Vigente</option>
                    <option value="vencido">Vencido</option>
                    <option value="sin_homolograma">Sin homolograma</option>
                  </select>
                </Field>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditing(false)}
                  className="flex-1 border border-white/10 text-slate-500 font-mono rounded-xl text-sm"
                  style={{minHeight:48}}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 text-white font-semibold rounded-xl text-sm"
                  style={{minHeight:48}}>
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </>
          ) : (
            <>
              {[
                { l:'Serial', v: ext.serial },
                { l:'Zona', v: ext.zone },
                { l:'Ubicación exacta', v: ext.exactLocation },
                { l:'Tipo', v: ext.type },
                { l:'Capacidad', v: `${ext.capacity} ${ext.capacityUnit}` },
                { l:'Fecha vencimiento', v: ext.expiryDate || '—' },
                { l:'Última recarga', v: ext.lastRecharge || '—' },
                { l:'# Placa inventario', v: ext.placa || '—' },
                { l:'Último test hidrostático', v: ext.lastHydroTest || '—' },
                { l:'Homolograma', v: ext.homolograma ? ext.homolograma.replace('_',' ').toUpperCase() : '—' },
                { l:'Registrado por', v: ext.createdBy || '—' },
              ].map(row => (
                <div key={row.l} className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">{row.l}</span>
                  <span className="font-mono text-sm text-white font-medium">{row.v}</span>
                </div>
              ))}
              <button onClick={() => setEditing(true)}
                className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl text-sm mt-4"
                style={{minHeight:48}}>
                ✏️ Editar datos
              </button>
              <button onClick={() => { setShowDeleteModal(true); setDeleteConfirm('') }}
                className="w-full font-semibold rounded-xl text-sm mt-2 border"
                style={{minHeight:48, color:'#EF4444', borderColor:'#EF444433', background:'#450A0A22'}}>
                Dar de baja / Eliminar extintor
              </button>
            </>
          )}
        </div>
      )}

      {/* ── TAB: QR ── */}
      {tab === 'qr' && (
        <div className="px-4 text-center space-y-4">
          <div className="card-highlight rounded-2xl border border-white/8 p-6" style={{background:'#1E293B'}}>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-4">
              QR original · permanente
            </p>
            <div ref={qrRef} className="inline-block bg-white p-3 rounded-xl">
              <QRCode value={qrValue} size={200} level="H"/>
            </div>
            <p className="font-mono text-xs text-slate-500 mt-3">{ext.serial} · {profile.airportCode}</p>
            <p className="font-mono text-[10px] text-slate-700 mt-1">ID: {id.slice(0,12)}...</p>
          </div>
          <div className="bg-[#0F172A] border border-white/5 rounded-xl px-4 py-3">
            <p className="font-mono text-[10px] text-slate-600 text-left">
              Este QR es idéntico al original. El ID del extintor nunca cambia, por lo que puedes reimprimir este QR cuantas veces necesites sin perder el historial de inspecciones.
            </p>
          </div>
          <button onClick={downloadQR}
            className="w-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold rounded-xl text-sm"
            style={{minHeight:52}}>
            Descargar QR (PDF) — Reimprimir
          </button>
        </div>
      )}

      {/* ── TAB: FOTOS ── */}
      {tab === 'photos' && (
        <div className="px-4 space-y-4">
          {/* Photo 1 — Context */}
          <div>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">
              Foto 1 — Entorno / Contexto
            </p>
            <p className="text-slate-600 text-xs mb-3">
              Vista amplia del área. Muestra el pasillo, sala o zona donde está el extintor.
            </p>
            {ext.photoContext ? (
              <div className="relative">
                <img src={ext.photoContext} alt="contexto"
                  className="w-full rounded-xl object-cover" style={{maxHeight:220}}/>
                <label className="absolute bottom-3 right-3 bg-[#2563EB] text-white font-mono text-xs px-3 py-2 rounded-lg cursor-pointer">
                  Actualizar
                  <input type="file" accept="image/*" capture="environment"
                    onChange={e => handlePhotoUpload(e,'context')} className="hidden"/>
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-white/10 hover:border-[#2563EB] rounded-xl cursor-pointer transition-colors"
                     style={{minHeight:140}}>
                {uploadingPhoto === 'context' ? (
                  <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"/>
                ) : (
                  <>
                    <span className="text-3xl mb-2">📸</span>
                    <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Foto de entorno</span>
                    <span className="font-mono text-[10px] text-slate-700 mt-1">Vista desde 3-4 metros</span>
                  </>
                )}
                <input type="file" accept="image/*" capture="environment"
                  onChange={e => handlePhotoUpload(e,'context')} className="hidden"/>
              </label>
            )}
          </div>

          {/* Photo 2 — Close up */}
          <div>
            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">
              Foto 2 — Identificación directa
            </p>
            <p className="text-slate-600 text-xs mb-3">
              Primer plano del extintor con el QR visible. Confirma que es el equipo correcto.
            </p>
            {ext.photoClose ? (
              <div className="relative">
                <img src={ext.photoClose} alt="primer plano"
                  className="w-full rounded-xl object-cover" style={{maxHeight:220}}/>
                <label className="absolute bottom-3 right-3 bg-[#2563EB] text-white font-mono text-xs px-3 py-2 rounded-lg cursor-pointer">
                  Actualizar
                  <input type="file" accept="image/*" capture="environment"
                    onChange={e => handlePhotoUpload(e,'close')} className="hidden"/>
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-white/10 hover:border-[#2563EB] rounded-xl cursor-pointer transition-colors"
                     style={{minHeight:140}}>
                {uploadingPhoto === 'close' ? (
                  <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"/>
                ) : (
                  <>
                    <span className="text-3xl mb-2">🔍</span>
                    <span className="font-mono text-xs text-slate-500 uppercase tracking-widest">Foto de extintor</span>
                    <span className="font-mono text-[10px] text-slate-700 mt-1">Primer plano con QR visible</span>
                  </>
                )}
                <input type="file" accept="image/*" capture="environment"
                  onChange={e => handlePhotoUpload(e,'close')} className="hidden"/>
              </label>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="px-4 space-y-3 pb-4">
          {!historyLoaded ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-mono text-slate-600 text-sm uppercase tracking-widest">Sin historial</p>
              <p className="font-mono text-slate-700 text-xs mt-1">Este extintor aún no ha sido inspeccionado</p>
            </div>
          ) : (
            history.map((h, i) => {
              const allOk = Object.values(h.item.checks||{}).every(v=>v===true)
              const GREEN = '#16A34A', RED = '#DC2626', AMBER = '#D97706'
              return (
                <div key={i} className="card-highlight rounded-xl border border-white/8 p-4"
                     style={{background:'#1E293B', borderLeftWidth:3, borderLeftColor: h.item.result==='ok' ? GREEN : RED}}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-mono text-sm font-bold text-white">{h.date}</p>
                      <p className="font-mono text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest">{h.inspectorName}</p>
                    </div>
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg"
                          style={{background: h.item.result==='ok' ? GREEN+'22':RED+'22',
                                  color: h.item.result==='ok' ? GREEN : RED}}>
                      {h.item.result==='ok' ? '✓ OK' : '⚠ NOV'}
                    </span>
                  </div>
                  {/* Mini checklist summary */}
                  <div className="flex gap-1 flex-wrap mb-2">
                    {Object.entries(h.item.checks||{}).map(([k,v]) => (
                      <span key={k} className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                            style={{background: v ? GREEN+'22':RED+'22', color: v ? GREEN:RED}}>
                        {k.charAt(0).toUpperCase()+k.slice(1,4)}
                      </span>
                    ))}
                  </div>
                  {h.item.novedad && (
                    <p className="font-mono text-xs mt-1" style={{color:AMBER}}>
                      ⚠ {h.item.novedad}
                    </p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-end justify-center z-50 px-4 pb-6" style={{background:'rgba(0,0,0,0.85)'}}>
          <div className="w-full max-w-md rounded-2xl border p-5 card-highlight" style={{background:'#1C0A0A', borderColor:'#EF444444'}}>
            <p className="font-bold text-base mb-1" style={{color:'#EF4444'}}>⚠ Eliminar extintor</p>
            <p className="text-slate-300 text-sm mb-1">Esta acción es <span className="font-bold text-white">permanente e irreversible.</span></p>
            <p className="text-slate-400 text-xs mb-4">Se eliminará el extintor <span className="font-mono font-bold text-white">{ext?.serial}</span> y todo su registro. El historial de inspecciones pasadas que lo incluyen no se verá afectado.</p>

            <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest mb-2">
              Escribe el serial para confirmar
            </p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={ext?.serial}
              className="w-full bg-[#0F172A] border text-white rounded-xl px-4 font-mono text-sm focus:outline-none mb-4"
              style={{minHeight:48, borderColor: deleteConfirm === ext?.serial ? '#EF4444' : 'rgba(255,255,255,0.1)'}}
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirm('') }}
                className="font-semibold rounded-xl text-sm border border-white/10 text-slate-400"
                style={{minHeight:48}}>
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== ext?.serial || deleting}
                className="font-bold rounded-xl text-sm"
                style={{
                  minHeight:48,
                  background: deleteConfirm === ext?.serial ? '#EF4444' : '#333',
                  color: deleteConfirm === ext?.serial ? 'white' : '#666',
                  opacity: deleting ? 0.6 : 1
                }}>
                {deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AppFooter/>
    </div>
  )
}
