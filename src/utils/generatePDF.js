import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { AEROCIVIL_LOGO } from './logoBase64'

// Check value -> ASCII text
function chk(val) {
  if (val===true  || val===1 || val==='true'  || val==='ok' || val==='OK')  return 'OK'
  if (val===false || val===0 || val==='false' || val==='f'  || val==='F')   return 'F'
  return '--'
}

// Tipo bucket — exactly one column gets X
function tipoBucket(type) {
  if (!type) return {pos:'',lka:'',co2:'',agua:'',otro:''}
  const t = type.toUpperCase()
  if (t.includes('CO2'))                                              return {pos:'',lka:'',co2:'X',agua:'',otro:''}
  if (t.includes('AGUA'))                                             return {pos:'',lka:'',co2:'',agua:'X',otro:''}
  if (t.includes('PQS')||t.includes('POLVO')||t.includes('AFFF')||t.includes('ESPUMA')) return {pos:'X',lka:'',co2:'',agua:'',otro:''}
  if (t.includes('HALOTRON')||t.includes('80LK'))                    return {pos:'',lka:'X',co2:'',agua:'',otro:''}
  return {pos:'',lka:'',co2:'',agua:'',otro:'X'}
}

export function generateInspectionPDF(inspection, extinguishers, airportName, omitidos=[]) {
  const doc  = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  const W    = doc.internal.pageSize.getWidth()   // 297
  const H    = doc.internal.pageSize.getHeight()  // 210

  const C = {
    blue:  [0, 61, 124],
    gray:  [180, 180, 180],
    lgray: [220, 220, 220],
    dgray: [80, 80, 80],
    white: [255, 255, 255],
    green: [22, 163, 74],
    red:   [220, 38, 38],
    muted: [150, 150, 150],
    black: [0, 0, 0],
  }

  // ── OUTER BORDER ─────────────────────────────────────
  doc.setDrawColor(...C.gray)
  doc.setLineWidth(0.5)
  doc.rect(6, 6, W-12, H-12)

  // ── HEADER BLOCK ─────────────────────────────────────
  // Logo cell — left
  doc.setFillColor(...C.lgray)
  doc.rect(6, 6, 36, 30, 'F')
  doc.setDrawColor(...C.gray)
  doc.rect(6, 6, 36, 30)
  // Embed real logo
  try {
    doc.addImage(AEROCIVIL_LOGO, 'PNG', 8, 7, 17, 17)
  } catch(e) {}
  doc.setTextColor(...C.black)
  doc.setFontSize(5.5)
  doc.setFont('helvetica','bold')
  doc.text('AERONAUTICA CIVIL', 25, 13, {align:'center'})
  doc.setFont('helvetica','normal')
  doc.setFontSize(4.5)
  doc.text('UNIDAD ADMINISTRATIVA', 25, 17, {align:'center'})
  doc.text('ESPECIAL', 25, 20, {align:'center'})

  // FORMATO cell — top right
  doc.setFillColor(...C.lgray)
  doc.rect(W-42, 6, 36, 10, 'F')
  doc.setDrawColor(...C.gray)
  doc.rect(W-42, 6, 36, 10)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.black)
  doc.text('FORMATO', W-24, 12.5, {align:'center'})

  // Title cell — center
  doc.setTextColor(...C.blue)
  doc.setFont('helvetica','bold')
  doc.setFontSize(12)
  doc.text('REVISION TECNICA DE EXTINTORES', (W/2)+10, 16, {align:'center'})

  // Airport + inspector line
  doc.setFontSize(7)
  doc.setFont('helvetica','normal')
  doc.setTextColor(...C.dgray)
  doc.text(`Aeropuerto: ${airportName}`, (W/2)+10, 22, {align:'center'})
  doc.text(`Inspector: ${inspection.inspectorName}   Fecha: ${inspection.date}   Hora: ${inspection.startTime||'--'} - ${inspection.endTime||'--'}`, (W/2)+10, 27, {align:'center'})

  // Metadata strip
  const metaY = 36
  doc.setDrawColor(...C.gray)
  doc.line(6, metaY, W-6, metaY)
  doc.setFillColor(245,245,245)
  doc.rect(6, metaY, W-12, 7, 'F')
  doc.setDrawColor(...C.gray)
  doc.rect(6, metaY, W-12, 7)

  // Three metadata cells
  const mw = (W-12)/3
  doc.line(6+mw, metaY, 6+mw, metaY+7)
  doc.line(6+mw*2, metaY, 6+mw*2, metaY+7)
  doc.setFontSize(6)
  doc.setFont('helvetica','bold')
  doc.setTextColor(...C.black)
  doc.text('Clave: MSER 5.0-12-006', 6+mw/2, metaY+4.5, {align:'center'})
  doc.text('Version: 04', 6+mw+mw/2, metaY+4.5, {align:'center'})
  doc.text('Fecha de aprobacion: 29/11/2022', 6+mw*2+mw/2, metaY+4.5, {align:'center'})

  // Summary strip
  const sumY = metaY+7
  const total = extinguishers.length
  const okCnt = extinguishers.filter(e=>e.result==='ok').length
  const novCnt= extinguishers.filter(e=>e.result==='novedad').length
  const cov   = inspection.totalRegistered>0 ? Math.round((total/inspection.totalRegistered)*100) : 100

  doc.setFillColor(235,245,255)
  doc.rect(6, sumY, W-12, 8, 'F')
  doc.setDrawColor(...C.gray)
  doc.rect(6, sumY, W-12, 8)
  doc.setFontSize(6.5); doc.setFont('helvetica','bold')
  doc.setTextColor(...C.blue)
  doc.text(`Total registrados: ${inspection.totalRegistered||total}`, 14, sumY+5)
  doc.setTextColor(...C.dgray)
  doc.text(`Inspeccionados: ${total}`, 70, sumY+5)
  doc.setTextColor(...C.green)
  doc.text(`Sin novedad: ${okCnt}`, 130, sumY+5)
  doc.setTextColor(...C.red)
  doc.text(`Con novedad: ${novCnt}`, 185, sumY+5)
  doc.setTextColor(...C.dgray)
  doc.text(`Cobertura: ${cov}%`, 245, sumY+5)
  if (omitidos.length>0) { doc.setTextColor(180,100,0); doc.text(`Omitidos: ${omitidos.length}`, 272, sumY+5) }

  // ── MAIN TABLE ───────────────────────────────────────
  const tableY = sumY+9

  const rows = extinguishers.map((e,i) => {
    const tb = tipoBucket(e.type)
    const cap = e.capacity ? `${e.capacity}${e.capacityUnit?' '+e.capacityUnit:''}` : '--'
    return [
      i+1,
      `${e.zone||''}\n${e.exactLocation||''}`,
      tb.pos, tb.lka, tb.co2, tb.agua, tb.otro,
      cap,
      chk(e.checks?.paint),
      chk(e.checks?.handle),
      chk(e.checks?.hose),
      chk(e.checks?.pressure),
      chk(e.checks?.nozzle),  // manometro
      chk(e.checks?.nozzle),  // boquilla (misma columna de checklist)
      chk(e.checks?.nozzle),  // corneta
      chk(e.checks?.pasador),
      chk(e.checks?.signage),
      e.placa||'--',
      e.lastHydroTest||'--',
      e.homolograma?e.homolograma.replace(/_/g,' ').toUpperCase():'--',
      e.novedad||'',
      e.result==='ok'?'OK':'NOV.',
    ]
  })

  autoTable(doc, {
    startY: tableY,
    margin: {left:6, right:6},
    head: [
      [
        {content:'N°',          rowSpan:3, styles:{valign:'middle',halign:'center'}},
        {content:'UBICACION',   rowSpan:3, styles:{valign:'middle',halign:'center'}},
        {content:'TIPO',        colSpan:5, styles:{halign:'center'}},
        {content:'CAPACIDAD',   rowSpan:3, styles:{valign:'middle',halign:'center'}},
        {content:'REVISION ESTADO GENERAL', colSpan:9, styles:{halign:'center'}},
        {content:'# PLACA\nINVENTARIO', rowSpan:3, styles:{valign:'middle',halign:'center'}},
        {content:'FECHA ULT\nTEST',     rowSpan:3, styles:{valign:'middle',halign:'center'}},
        {content:'HOMOLOGRAMA',          rowSpan:3, styles:{valign:'middle',halign:'center'}},
        {content:'OBSERVACIONES',        rowSpan:3, styles:{valign:'middle',halign:'center'}},
        {content:'ESTADO',               rowSpan:3, styles:{valign:'middle',halign:'center'}},
      ],
      [
        'POS','80LKAFLAM','CO2','AGUA','OTRO',
        'PINTURA','MANIJA DE\nTRANSPORTE','MANGUERA','PRESION','MANOMETRO','BOQUILLA','CORNETA','PASADOR','SEÑALIZ.',
      ],
    ],
    body: rows,
    styles: {
      fontSize: 5.5,
      cellPadding: {top:1, bottom:1, left:0.8, right:0.8},
      lineColor: C.gray, lineWidth: 0.2,
      textColor: C.black,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: C.blue,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 5.5,
      cellPadding: {top:1, bottom:1, left:0.5, right:0.5},
      halign: 'center',
      valign: 'middle',
    },
    columnStyles: {
      0:  {cellWidth:6,   halign:'center'},
      1:  {cellWidth:36},
      2:  {cellWidth:6,   halign:'center'},
      3:  {cellWidth:8,   halign:'center'},
      4:  {cellWidth:6,   halign:'center'},
      5:  {cellWidth:7,   halign:'center'},
      6:  {cellWidth:7,   halign:'center'},
      7:  {cellWidth:10,  halign:'center'},
      8:  {cellWidth:8,   halign:'center'},
      9:  {cellWidth:8,   halign:'center'},
      10: {cellWidth:9,   halign:'center'},
      11: {cellWidth:8,   halign:'center'},
      12: {cellWidth:9,   halign:'center'},
      13: {cellWidth:9,   halign:'center'},
      14: {cellWidth:9,   halign:'center'},
      15: {cellWidth:9,   halign:'center'},
      16: {cellWidth:9,   halign:'center'},
      17: {cellWidth:13,  halign:'center'},
      18: {cellWidth:12,  halign:'center'},
      19: {cellWidth:14,  halign:'center'},
      20: {cellWidth:'auto'},
      21: {cellWidth:10,  halign:'center'},
    },
    didParseCell(data) {
      if (data.section!=='body') return
      const ci = data.column.index
      const raw= data.cell.raw
      // TIPO cols 2-6
      if (ci>=2&&ci<=6&&raw==='X') { data.cell.styles.textColor=C.blue; data.cell.styles.fontStyle='bold' }
      // CHECK cols 8-16
      if (ci>=8&&ci<=16) {
        if (raw==='OK') data.cell.styles.textColor=C.green
        if (raw==='F')  { data.cell.styles.textColor=C.red; data.cell.styles.fontStyle='bold' }
        if (raw==='--') data.cell.styles.textColor=C.muted
      }
      // Estado col 21
      if (ci===21) {
        if (raw==='OK')   data.cell.styles.textColor=C.green
        if (raw==='NOV.') { data.cell.styles.textColor=C.red; data.cell.styles.fontStyle='bold' }
      }
    },
    alternateRowStyles: {fillColor:[248,250,252]},
    rowPageBreak: 'avoid',
  })

  const finalY = doc.lastAutoTable.finalY

  // ── OMITIDOS ─────────────────────────────────────────
  if (omitidos&&omitidos.length>0) {
    const omY = finalY+4
    doc.setFillColor(255,243,230)
    doc.roundedRect(6, omY, W-12, 5+omitidos.length*4, 1,1,'F')
    doc.setFontSize(6); doc.setFont('helvetica','bold'); doc.setTextColor(...C.red)
    doc.text(`Extintores NO inspeccionados (${omitidos.length}):`, 12, omY+4)
    doc.setFont('helvetica','normal'); doc.setTextColor(...C.dgray)
    omitidos.forEach((o,i)=>{ doc.text(`${i+1}. ${o.serial} - ${o.zone} > ${o.exactLocation}`, 16, omY+8+i*4) })
  }

  // ── SIGNATURES — match official format ───────────────
  const sigBaseY = finalY + (omitidos.length>0 ? 8+omitidos.length*4 : 4)
  const sigY = Math.min(sigBaseY, H-32)

  doc.setDrawColor(...C.gray)
  doc.setFontSize(7)
  doc.setFont('helvetica','normal')
  doc.setTextColor(...C.black)

  // Four signature lines matching official format
  const lines = [
    { label:'Fecha', value: inspection.date },
    { label:'Bombero Inspector', value: inspection.inspectorName },
    { label:'Oficial de Servicio', value: '' },
    { label:'Lider de Estacion', value: '' },
  ]

  lines.forEach((l,i) => {
    const y = sigY + i*7
    doc.setFont('helvetica','bold')
    doc.text(l.label, 10, y)
    doc.setFont('helvetica','normal')
    // underline
    const labelW = doc.getStringUnitWidth(l.label)*7*0.352
    const lineStart = 10+labelW+3
    doc.line(lineStart, y+0.5, 140, y+0.5)
    if (l.value) doc.text(l.value, lineStart+2, y-0.5)
  })

  // Footer
  doc.setFontSize(5)
  doc.setTextColor(180,180,180)
  doc.text(`REVIX - Sistema de Inspeccion de Extintores · UAEAC · Generado: ${new Date().toLocaleString('es-CO')}`, W/2, H-8, {align:'center'})

  return doc
}
