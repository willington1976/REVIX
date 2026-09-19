import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { AEROCIVIL_LOGO } from './logoBase64'

function chk(val) {
  if (val===true  || val===1 || val==='true'  || val==='ok' || val==='OK')  return 'OK'
  if (val===false || val===0 || val==='false' || val==='f'  || val==='F')   return 'F'
  return '--'
}

function tipoBucket(type) {
  if (!type) return {pos:'',sol:'',co2:'',agua:'',otro:''}
  const t = type.toUpperCase()
  if (t.includes('CO2'))                                                          return {pos:'',sol:'',co2:'X',agua:'',otro:''}
  if (t.includes('AGUA'))                                                         return {pos:'',sol:'',co2:'',agua:'X',otro:''}
  if (t.includes('PQS')||t.includes('POLVO'))                                    return {pos:'X',sol:'',co2:'',agua:'',otro:''}
  if (t.includes('HALOTRON')||t.includes('SOLKAFLAM')||t.includes('ESPUMA')||t.includes('AFFF')) return {pos:'',sol:'X',co2:'',agua:'',otro:''}
  return {pos:'',sol:'',co2:'',agua:'',otro:'X'}
}

export function generateInspectionPDF(inspection, extinguishers, airportName, omitidos=[]) {
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  const W   = doc.internal.pageSize.getWidth()   // 297mm
  const H   = doc.internal.pageSize.getHeight()  // 210mm

  const BLACK = [0,0,0]
  const WHITE = [255,255,255]
  const LGRAY = [210,210,210]
  const MGRAY = [180,180,180]
  const DGRAY = [80,80,80]
  const GREEN = [22,163,74]
  const RED   = [220,38,38]
  const BLUE  = [0,61,124]

  // ── PAGE BORDER ──────────────────────────────────────
  doc.setDrawColor(...MGRAY)
  doc.setLineWidth(0.4)
  doc.rect(5, 5, W-10, H-10)

  // ── HEADER ───────────────────────────────────────────
  // Outer header box
  doc.setLineWidth(0.3)
  doc.rect(5, 5, W-10, 32)

  // Vertical divider after logo area
  doc.line(40, 5, 40, 37)

  // "FORMATO" box — top right
  doc.setFillColor(...LGRAY)
  doc.rect(W-45, 5, 40, 10, 'F')
  doc.setDrawColor(...MGRAY)
  doc.rect(W-45, 5, 40, 10)
  doc.setFont('helvetica','bold')
  doc.setFontSize(8)
  doc.setTextColor(...BLACK)
  doc.text('FORMATO', W-25, 11.5, {align:'center'})

  // Logo — centered in cell (cell is 5 to 40, so center = 22.5)
  // Logo image 20x20, centered horizontally in 35mm cell
  const logoX = 5 + (35-20)/2   // = 12.5
  const logoY = 6
  try {
    doc.addImage(AEROCIVIL_LOGO, 'PNG', logoX, logoY, 20, 20)
  } catch(e) {
    doc.setFillColor(...BLUE)
    doc.circle(22.5, 16, 9, 'F')
    doc.setTextColor(...WHITE)
    doc.setFontSize(12)
    doc.setFont('helvetica','bold')
    doc.text('A', 22.5, 20, {align:'center'})
    doc.setTextColor(...BLACK)
  }
  // Text below logo — centered in cell
  doc.setTextColor(...BLACK)
  doc.setFont('helvetica','bold')
  doc.setFontSize(5)
  doc.text('AERONAUTICA CIVIL', 22.5, 28.5, {align:'center'})
  doc.setFont('helvetica','normal')
  doc.setFontSize(4)
  doc.text('UNIDAD ADMINISTRATIVA ESPECIAL', 22.5, 32, {align:'center'})

  // Title — black, no color
  doc.setFont('helvetica','bold')
  doc.setFontSize(14)
  doc.setTextColor(...BLACK)
  const titleX = 40 + (W-10-40)/2
  doc.text('REVISION TECNICA DE EXTINTORES', titleX, 22, {align:'center'})

  // Sub info
  doc.setFont('helvetica','normal')
  doc.setFontSize(7)
  doc.setTextColor(...DGRAY)
  doc.text(`Aeropuerto: ${airportName}`, titleX, 29, {align:'center'})
  doc.text(`Inspector: ${inspection.inspectorName}   |   Fecha: ${inspection.date}   |   Hora inicio: ${inspection.startTime||'--'}   Hora fin: ${inspection.endTime||'--'}`, titleX, 34, {align:'center'})

  // ── METADATA STRIP ───────────────────────────────────
  const metaY = 37
  doc.setDrawColor(...MGRAY)
  doc.rect(5, metaY, W-10, 8)
  const mw = (W-10)/3
  doc.line(5+mw,   metaY, 5+mw,   metaY+8)
  doc.line(5+mw*2, metaY, 5+mw*2, metaY+8)
  doc.setFont('helvetica','bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...BLACK)
  doc.text('Clave: MSER 5.0-12-006',        5+mw/2,    metaY+5, {align:'center'})
  doc.text('Version: 04',                    5+mw+mw/2, metaY+5, {align:'center'})
  doc.text('Fecha de aprobacion: 29/11/2022',5+mw*2+mw/2, metaY+5, {align:'center'})

  // ── TABLE ────────────────────────────────────────────
  const tableY = metaY + 9

  const rows = extinguishers.map((e, i) => {
    const tb  = tipoBucket(e.type)
    const cap = e.capacity ? `${e.capacity}${e.capacityUnit?' '+e.capacityUnit:''}` : ''
    return [
      i+1,
      `${e.zone||''}\n${e.exactLocation||''}`,
      tb.pos, tb.sol, tb.co2, tb.agua, tb.otro,
      cap,
      // 9 check items — plain text, no color
      chk(e.checks?.paint),
      chk(e.checks?.handle),
      chk(e.checks?.hose),
      chk(e.checks?.pressure),
      chk(e.checks?.pressure),  // manometro (same check)
      chk(e.checks?.nozzle),    // boquilla
      chk(e.checks?.nozzle),    // corneta
      chk(e.checks?.pasador),
      chk(e.checks?.signage),
      // Extra columns
      e.placa||'',
      e.lastHydroTest||'',
      e.homolograma?e.homolograma.replace(/_/g,' ').toUpperCase():'',
      e.novedad||'',
      // Last col: inspector name (firma)
      inspection.inspectorName,
    ]
  })

  autoTable(doc, {
    startY: tableY,
    margin: {left:5, right:5},
    head: [
      // Row 1
      [
        {content:'N°',         rowSpan:3, styles:{valign:'bottom', halign:'center'}},
        {content:'UBICACION',  rowSpan:3, styles:{valign:'bottom', halign:'center'}},
        {content:'TIPO',       colSpan:5, styles:{halign:'center'}},
        {content:'CAP.',  rowSpan:3, styles:{valign:'bottom', halign:'center'}},
        {content:'REVISION ESTADO GENERAL', colSpan:9, styles:{halign:'center'}},
        {content:'# PLACA\nINVENTARIO',   rowSpan:3, styles:{valign:'bottom', halign:'center'}},
        {content:'FECHA ULT\nTEST',       rowSpan:3, styles:{valign:'bottom', halign:'center'}},
        {content:'HOMOLOGRAMA',            rowSpan:3, styles:{valign:'bottom', halign:'center'}},
        {content:'OBSERVACIONES',          rowSpan:3, styles:{valign:'bottom', halign:'center'}},
        {content:'FIRMA BOMBERO QUE\nEFECTUO LA\nREVISION', rowSpan:3, styles:{valign:'bottom', halign:'center'}},
      ],
      // Row 2 — tipo sub-headers
      [
        'POS','SOLKAFLAM','CO2','AGUA','OTRO',
        'PINTURA',
        {content:'MANIJA DE\nTRANSPORTE', styles:{fontSize:4.5}},
        'MANGUERA','PRESION','MANOMETRO','BOQUILLA','CORNETA','PASADOR',
        {content:'SEÑALI-\nZACION', styles:{fontSize:4.5}},
      ],
    ],
    body: rows,
    styles: {
      fontSize: 6,
      cellPadding: {top:1, bottom:1, left:0.8, right:0.8},
      lineColor: MGRAY,
      lineWidth: 0.2,
      textColor: BLACK,
      font: 'helvetica',
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: WHITE,       // ← white background, no color
      textColor: BLACK,
      fontStyle: 'bold',
      fontSize: 5.5,
      lineColor: MGRAY,
      lineWidth: 0.2,
      halign: 'center',
      valign: 'bottom',
    },
    columnStyles: {
      0:  {cellWidth:6,   halign:'center'},
      1:  {cellWidth:34,  halign:'left'},
      2:  {cellWidth:6,   halign:'center'},
      3:  {cellWidth:9,   halign:'center'},
      4:  {cellWidth:6,   halign:'center'},
      5:  {cellWidth:7,   halign:'center'},
      6:  {cellWidth:7,   halign:'center'},
      7:  {cellWidth:10,  halign:'center'},
      8:  {cellWidth:7,   halign:'center'},
      9:  {cellWidth:8,   halign:'center'},
      10: {cellWidth:8,   halign:'center'},
      11: {cellWidth:8,   halign:'center'},
      12: {cellWidth:9,   halign:'center'},
      13: {cellWidth:8,   halign:'center'},
      14: {cellWidth:8,   halign:'center'},
      15: {cellWidth:8,   halign:'center'},
      16: {cellWidth:8,   halign:'center'},
      17: {cellWidth:13,  halign:'center'},
      18: {cellWidth:11,  halign:'center'},
      19: {cellWidth:13,  halign:'center'},
      20: {cellWidth:'auto'},
      21: {cellWidth:18,  halign:'center'},
    },
    didParseCell(data) {
      if (data.section!=='body') return
      // No colors in table body — match original format exactly
      // Only mark X in tipo columns bold
      if (data.column.index>=2 && data.column.index<=6 && data.cell.raw==='X') {
        data.cell.styles.fontStyle = 'bold'
      }
    },
    alternateRowStyles: {fillColor:[248,248,248]},
    rowPageBreak: 'avoid',
  })

  const finalY = doc.lastAutoTable.finalY

  // ── SIGNATURES — exact match to official format ───────
  const sigBaseY = finalY + 8
  const sigY = Math.min(sigBaseY, H-30)

  doc.setFont('helvetica','normal')
  doc.setFontSize(8)
  doc.setTextColor(...BLACK)
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.3)

  const sigLines = [
    {label:'Fecha',             value: inspection.date},
    {label:'Bombero Inspector', value: inspection.inspectorName},
    {label:'Oficial de Servicio', value:''},
    {label:'Lider de Estacion', value:''},
  ]

  sigLines.forEach((s,i) => {
    const y = sigY + i*8
    doc.setFont('helvetica','bold')
    doc.text(s.label, 8, y)
    doc.setFont('helvetica','normal')
    const lw = doc.getStringUnitWidth(s.label) * 8 * 0.352 + 3
    doc.line(8+lw, y+0.8, 130, y+0.8)
    if (s.value) {
      doc.setFontSize(7)
      doc.text(s.value, 8+lw+1, y-0.3)
      doc.setFontSize(8)
    }
  })

  // ── FOOTER ───────────────────────────────────────────
  doc.setFontSize(5)
  doc.setFont('helvetica','normal')
  doc.setTextColor(180,180,180)
  doc.text(
    `REVIX - Sistema de Inspeccion de Extintores · UAEAC · Generado: ${new Date().toLocaleString('es-CO')}`,
    W/2, H-6, {align:'center'}
  )

  return doc
}
