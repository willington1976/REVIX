import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { AEROCIVIL_LOGO } from './logoBase64'

function chk(val) {
  if (val===true  || val===1 || val==='true')  return 'OK'
  if (val===false || val===0 || val==='false') return 'F'
  return '--'
}

function tipoBucket(type) {
  if (!type) return {pos:'',sol:'',co2:'',agua:'',otro:''}
  const t = type.toUpperCase()
  if (t.includes('CO2'))                                         return {pos:'',sol:'',co2:'X',agua:'',otro:''}
  if (t.includes('AGUA'))                                        return {pos:'',sol:'',co2:'',agua:'X',otro:''}
  if (t.includes('PQS')||t.includes('POLVO'))                   return {pos:'X',sol:'',co2:'',agua:'',otro:''}
  if (t.includes('HALOTRON')||t.includes('SOLKAFLAM')||
      t.includes('ESPUMA')||t.includes('AFFF'))                 return {pos:'',sol:'X',co2:'',agua:'',otro:''}
  return                                                                {pos:'',sol:'',co2:'',agua:'',otro:'X'}
}

// Columns that need vertical text in header row 2
// index = column index in the table (0-based)
const VERTICAL_COLS = {
  2:  'POS',
  7:  'CAPACIDAD',
  3:  ['SOLKA','FLAM'],
  4:  'CO2',
  5:  'AGUA',
  6:  'OTRO',
  7:  'CAPACIDAD',
  8:  'PINTURA',
  9:  ['MANIJA DE','TRANSPORTE'],
  10: 'MANGUERA',
  11: 'PRESION',
  12: 'MANOMETRO',
  13: 'BOQUILLA',
  14: 'CORNETA',
  15: 'PASADOR',
  16: 'SEÑALIZACION',
}

export function generateInspectionPDF(inspection, extinguishers, airportName, omitidos=[]) {
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()

  const BK=[0,0,0], WH=[255,255,255], LG=[210,210,210], MG=[180,180,180], DG=[80,80,80]

  // ── OUTER BORDER ─────────────────────────────────────
  doc.setDrawColor(...MG); doc.setLineWidth(0.4)
  doc.rect(5, 5, W-10, H-10)

  // ── HEADER BOX ───────────────────────────────────────
  doc.setLineWidth(0.3)
  doc.rect(5, 5, W-10, 32)
  doc.line(40, 5, 40, 37)
  doc.line(W-45, 5, W-45, 15)

  // FORMATO box
  doc.setFillColor(...LG)
  doc.rect(W-45, 5, 40, 10, 'F')
  doc.rect(W-45, 5, 40, 10)
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...BK)
  doc.text('FORMATO', W-25, 11.5, {align:'center'})

  // Logo centered in cell (x:5 to 40 = 35mm wide)
  const logoW=22, logoH=22, logoX=5+(35-logoW)/2, logoY=7
  try {
    doc.addImage(AEROCIVIL_LOGO,'PNG',logoX,logoY,logoW,logoH)
  } catch(e) {}

  // Title
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...BK)
  const cx = 40+(W-10-40)/2
  doc.text('REVISION TECNICA DE EXTINTORES', cx, 19, {align:'center'})
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...DG)
  doc.text(`Aeropuerto: ${airportName}`, cx, 26, {align:'center'})
  doc.text(`Inspector: ${inspection.inspectorName}   |   Fecha: ${inspection.date}   |   Hora inicio: ${inspection.startTime||'--'}   Hora fin: ${inspection.endTime||'--'}`, cx, 31, {align:'center'})

  // ── METADATA STRIP ───────────────────────────────────
  const mY=37
  doc.setDrawColor(...MG); doc.rect(5,mY,W-10,8)
  const mw=(W-10)/3
  doc.line(5+mw,mY,5+mw,mY+8); doc.line(5+mw*2,mY,5+mw*2,mY+8)
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...BK)
  doc.text('Clave: MSER 5.0-12-006',         5+mw/2,     mY+5, {align:'center'})
  doc.text('Version: 04',                     5+mw+mw/2,  mY+5, {align:'center'})
  doc.text('Fecha de aprobacion: 29/11/2022', 5+mw*2+mw/2,mY+5, {align:'center'})

  // ── TABLE ────────────────────────────────────────────
  const tY = mY+9

  const rows = extinguishers.map((e,i) => {
    const tb  = tipoBucket(e.type)
    return [
      i+1,
      `${e.zone||''}\n${e.exactLocation||''}`,
      tb.pos, tb.sol, tb.co2, tb.agua, tb.otro,
      e.capacity||'',
      chk(e.checks?.paint),
      chk(e.checks?.handle),
      chk(e.checks?.hose),
      chk(e.checks?.pressure),
      chk(e.checks?.pressure),   // manometro
      chk(e.checks?.nozzle),     // boquilla
      chk(e.checks?.nozzle),     // corneta
      chk(e.checks?.pasador),
      chk(e.checks?.signage),
      e.placa||'',
      e.lastHydroTest||'',
      e.homolograma&&e.homolograma!=='sin_homolograma'?e.homolograma.replace(/_/g,' ').toUpperCase():'',
      e.novedad||'',
      inspection.inspectorName,
    ]
  })

  const HEAD_H = 28 // height reserved for vertical text headers

  autoTable(doc, {
    startY: tY,
    margin: {left:5, right:5},
    head: [
      // ROW 1 — group labels (horizontal)
      [
        {content:'N°',       rowSpan:2, styles:{valign:'middle',halign:'center',fontStyle:'bold'}},
        {content:'UBICACION',rowSpan:2, styles:{valign:'middle',halign:'center',fontStyle:'bold'}},
        {content:'TIPO',     colSpan:5, styles:{halign:'center',fontStyle:'bold'}},
        // col 7 = CAPACIDAD — rowSpan:2, text drawn vertically in didDrawCell
        {content:'',         rowSpan:2, styles:{valign:'middle',halign:'center'}},
        {content:'REVISION ESTADO GENERAL', colSpan:9, styles:{halign:'center',fontStyle:'bold'}},
        {content:'# PLACA\nINVENT.',  rowSpan:2, styles:{valign:'middle',halign:'center',fontStyle:'bold',fontSize:5.5}},
        {content:'FECHA\nULT TEST',   rowSpan:2, styles:{valign:'middle',halign:'center',fontStyle:'bold',fontSize:5.5}},
        {content:'HOMOLOG.',           rowSpan:2, styles:{valign:'middle',halign:'center',fontStyle:'bold',fontSize:5.5}},
        {content:'OBSERVACIONES',      rowSpan:2, styles:{valign:'middle',halign:'center',fontStyle:'bold',fontSize:5.5}},
        {content:'FIRMA BOMBERO\nQUE EFECTUO\nLA REVISION', rowSpan:2, styles:{valign:'middle',halign:'center',fontStyle:'bold',fontSize:5}},
      ],
      // ROW 2 — vertical column names (content empty — drawn in didDrawCell)
      [
        {content:'', styles:{minCellHeight:HEAD_H}}, // POS
        {content:'', styles:{minCellHeight:HEAD_H}}, // SOLKAFLAM
        {content:'', styles:{minCellHeight:HEAD_H}}, // CO2
        {content:'', styles:{minCellHeight:HEAD_H}}, // AGUA
        {content:'', styles:{minCellHeight:HEAD_H}}, // OTRO
        // col 7 CAPACIDAD handled by rowSpan above
        {content:'', styles:{minCellHeight:HEAD_H}}, // PINTURA
        {content:'', styles:{minCellHeight:HEAD_H}}, // MANIJA DE TRANSPORTE
        {content:'', styles:{minCellHeight:HEAD_H}}, // MANGUERA
        {content:'', styles:{minCellHeight:HEAD_H}}, // PRESION
        {content:'', styles:{minCellHeight:HEAD_H}}, // MANOMETRO
        {content:'', styles:{minCellHeight:HEAD_H}}, // BOQUILLA
        {content:'', styles:{minCellHeight:HEAD_H}}, // CORNETA
        {content:'', styles:{minCellHeight:HEAD_H}}, // PASADOR
        {content:'', styles:{minCellHeight:HEAD_H}}, // SEÑALIZACION
      ],
    ],
    body: rows,
    styles: {
      fontSize:6, cellPadding:{top:1.2,bottom:1.2,left:0.8,right:0.8},
      lineColor:MG, lineWidth:0.2, textColor:BK, font:'helvetica',
      halign:'center', valign:'middle',
    },
    headStyles: {
      fillColor:WH, textColor:BK, fontStyle:'bold', fontSize:6,
      lineColor:MG, lineWidth:0.2, halign:'center', valign:'middle',
    },
    columnStyles: {
      0:  {cellWidth:6},
      1:  {cellWidth:34, halign:'left'},
      2:  {cellWidth:7},   // POS
      3:  {cellWidth:7},   // SOLKAFLAM
      4:  {cellWidth:7},   // CO2
      5:  {cellWidth:7},   // AGUA
      6:  {cellWidth:7},   // OTRO
      7:  {cellWidth:8},   // CAPACIDAD
      8:  {cellWidth:7},   // PINTURA
      9:  {cellWidth:8},   // MANIJA DE TRANSPORTE
      10: {cellWidth:8},   // MANGUERA
      11: {cellWidth:7},   // PRESION
      12: {cellWidth:9},   // MANOMETRO
      13: {cellWidth:8},   // BOQUILLA
      14: {cellWidth:8},   // CORNETA
      15: {cellWidth:8},   // PASADOR
      16: {cellWidth:10},  // SEÑALIZACION
      17: {cellWidth:11},  // # PLACA
      18: {cellWidth:11},  // FECHA ULT TEST
      19: {cellWidth:10},  // HOMOLOG
      20: {cellWidth:'auto'}, // OBSERV
      21: {cellWidth:16},  // FIRMA
    },

    didDrawCell(data) {
      // Only act on header row 2 (rowIndex 1) for vertical columns
      if (data.section !== 'head') return

      const ci = data.column.index

      // CAPACIDAD is rowSpan:2 starting at row 0 — handle separately
      if (data.row.index === 0 && ci === 7) {
        const { x, y, width, height } = data.cell
        doc.setFillColor(255,255,255)
        doc.rect(x+0.1, y+0.1, width-0.2, height-0.2, 'F')
        doc.setFont('helvetica','bold')
        doc.setFontSize(5.5)
        doc.setTextColor(0,0,0)
        doc.text('CAPACIDAD', x+width/2, y+height-2, {angle:90, align:'left'})
        return
      }

      if (data.row.index !== 1) return

      const label = VERTICAL_COLS[ci]
      if (!label) return

      const { x, y, width, height } = data.cell

      // Paint white to erase any autotable text
      doc.setFillColor(...WH)
      doc.rect(x+0.1, y+0.1, width-0.2, height-0.2, 'F')

      // Draw vertical text — rotated 90° (bottom to top, reading upward)
      doc.setFont('helvetica','bold')
      doc.setFontSize(5.5)
      doc.setTextColor(...BK)

      const textX = x + width/2     // center horizontally
      const textY = y + height - 2  // start near bottom

      if (Array.isArray(label)) {
        // Multi-line vertical text reading bottom to top
        // angle:90 draws text going upward from textY
        // Line 0 = first word (bottom), Line 1 = second word (above it)
        const lineGap = 13
        doc.text(label[0], textX, textY,           {angle:90, align:'left'})
        doc.text(label[1], textX, textY - lineGap, {angle:90, align:'left'})
      } else {
        doc.text(label, textX, textY, {angle:90, align:'left'})
      }
    },

    didParseCell(data) {
      if (data.section!=='body') return
      if (data.column.index>=2&&data.column.index<=6&&data.cell.raw==='X') {
        data.cell.styles.fontStyle='bold'
      }
    },

    alternateRowStyles: {fillColor:[248,248,248]},
    rowPageBreak:'avoid',
  })

  const finalY = doc.lastAutoTable.finalY

  // ── SIGNATURES ───────────────────────────────────────
  const sigY = Math.min(finalY+8, H-32)
  doc.setFont('helvetica','normal'); doc.setFontSize(9)
  doc.setTextColor(...BK); doc.setDrawColor(...BK); doc.setLineWidth(0.3)

  ;[
    {label:'Fecha',              value: inspection.date},
    {label:'Bombero Inspector',  value: inspection.inspectorName},
    {label:'Oficial de Servicio',value: ''},
    {label:'Lider de Estacion',  value: ''},
  ].forEach((s,i) => {
    const y = sigY + i*9
    doc.setFont('helvetica','bold')
    doc.text(s.label, 8, y)
    const lw = doc.getStringUnitWidth(s.label)*9*0.352+3
    doc.setFont('helvetica','normal')
    doc.line(8+lw, y+1, 130, y+1)
    if (s.value) { doc.setFontSize(8); doc.text(s.value, 8+lw+1, y-0.2); doc.setFontSize(9) }
  })

  // Footer
  doc.setFontSize(5); doc.setTextColor(180,180,180); doc.setFont('helvetica','normal')
  doc.text(`REVIX · Sistema de Inspeccion de Extintores · UAEAC · ${new Date().toLocaleString('es-CO')}`, W/2, H-6, {align:'center'})

  return doc
}
