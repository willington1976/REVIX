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
  if (t.includes('CO2'))                                            return {pos:'',sol:'',co2:'X',agua:'',otro:''}
  if (t.includes('AGUA'))                                           return {pos:'',sol:'',co2:'',agua:'X',otro:''}
  if (t.includes('PQS') || t.includes('POLVO'))                    return {pos:'X',sol:'',co2:'',agua:'',otro:''}
  if (t.includes('HALOTRON')||t.includes('SOLKAFLAM')||
      t.includes('ESPUMA')||t.includes('AFFF'))                    return {pos:'',sol:'X',co2:'',agua:'',otro:''}
  return                                                                   {pos:'',sol:'',co2:'',agua:'',otro:'X'}
}

export function generateInspectionPDF(inspection, extinguishers, airportName, omitidos=[]) {
  const doc = new jsPDF({ orientation:'landscape', unit:'mm', format:'a4' })
  const W = doc.internal.pageSize.getWidth()   // 297
  const H = doc.internal.pageSize.getHeight()  // 210

  const BK=[0,0,0], WH=[255,255,255], LG=[210,210,210], MG=[180,180,180], DG=[80,80,80]
  const GN=[22,163,74], RD=[220,38,38], BL=[0,61,124]

  // ── OUTER BORDER ─────────────────────────────────────
  doc.setDrawColor(...MG); doc.setLineWidth(0.4)
  doc.rect(5, 5, W-10, H-10)

  // ── HEADER BOX ───────────────────────────────────────
  doc.setLineWidth(0.3)
  doc.rect(5, 5, W-10, 32)       // full header
  doc.line(40, 5, 40, 37)        // vertical after logo cell
  doc.line(W-45, 5, W-45, 15)   // left edge of FORMATO box

  // FORMATO box
  doc.setFillColor(...LG)
  doc.rect(W-45, 5, 40, 10, 'F')
  doc.rect(W-45, 5, 40, 10)
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(...BK)
  doc.text('FORMATO', W-25, 11.5, {align:'center'})

  // Logo — centered in 35mm wide cell (x:5 to 40)
  const logoW = 22, logoH = 22
  const logoX = 5 + (35-logoW)/2   // = 11.5
  const logoY = 7
  try {
    doc.addImage(AEROCIVIL_LOGO, 'PNG', logoX, logoY, logoW, logoH)
  } catch(e) {
    doc.setFillColor(...BL); doc.circle(22.5, 18, 10, 'F')
    doc.setTextColor(...WH); doc.setFontSize(14); doc.setFont('helvetica','bold')
    doc.text('A', 22.5, 23, {align:'center'}); doc.setTextColor(...BK)
  }

  // Title
  doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(...BK)
  const cx = 40 + (W-10-40)/2
  doc.text('REVISION TECNICA DE EXTINTORES', cx, 19, {align:'center'})

  // Sub info
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(...DG)
  doc.text(`Aeropuerto: ${airportName}`, cx, 26, {align:'center'})
  doc.text(`Inspector: ${inspection.inspectorName}   |   Fecha: ${inspection.date}   |   Hora inicio: ${inspection.startTime||'--'}   Hora fin: ${inspection.endTime||'--'}`, cx, 31, {align:'center'})

  // ── METADATA STRIP ───────────────────────────────────
  const mY = 37
  doc.setDrawColor(...MG); doc.rect(5, mY, W-10, 8)
  const mw = (W-10)/3
  doc.line(5+mw, mY, 5+mw, mY+8)
  doc.line(5+mw*2, mY, 5+mw*2, mY+8)
  doc.setFont('helvetica','bold'); doc.setFontSize(6.5); doc.setTextColor(...BK)
  doc.text('Clave: MSER 5.0-12-006',          5+mw/2,    mY+5, {align:'center'})
  doc.text('Version: 04',                      5+mw+mw/2, mY+5, {align:'center'})
  doc.text('Fecha de aprobacion: 29/11/2022',  5+mw*2+mw/2, mY+5, {align:'center'})

  // ── TABLE ────────────────────────────────────────────
  const tY = mY + 9

  const rows = extinguishers.map((e, i) => {
    const tb  = tipoBucket(e.type)
    const cap = e.capacity || ''
    return [
      i+1,
      `${e.zone||''}\n${e.exactLocation||''}`,
      tb.pos, tb.sol, tb.co2, tb.agua, tb.otro,
      cap,
      chk(e.checks?.paint),
      chk(e.checks?.handle),
      chk(e.checks?.hose),
      chk(e.checks?.pressure),
      chk(e.checks?.pressure),
      chk(e.checks?.nozzle),
      chk(e.checks?.nozzle),
      chk(e.checks?.pasador),
      chk(e.checks?.signage),
      e.placa||'',
      e.lastHydroTest||'',
      e.homolograma ? (e.homolograma==='sin_homolograma'?'S/HOMO':e.homolograma.replace(/_/g,' ').toUpperCase()) : '',
      e.novedad||'',
      inspection.inspectorName,
    ]
  })

  autoTable(doc, {
    startY: tY,
    margin: {left:5, right:5},
    head: [
      // ROW 1 — group headers
      [
        {content:'N°',      rowSpan:2, styles:{valign:'middle',halign:'center'}},
        {content:'UBICACION',rowSpan:2,styles:{valign:'middle',halign:'center'}},
        {content:'TIPO',    colSpan:5, styles:{halign:'center'}},
        {content:'CAP.',    rowSpan:2, styles:{valign:'middle',halign:'center'}},
        {content:'REVISION ESTADO GENERAL', colSpan:9, styles:{halign:'center'}},
        {content:'# PLACA\nINVENT.',  rowSpan:2, styles:{valign:'middle',halign:'center'}},
        {content:'FECHA\nULT TEST',   rowSpan:2, styles:{valign:'middle',halign:'center'}},
        {content:'HOMOLOG.',           rowSpan:2, styles:{valign:'middle',halign:'center'}},
        {content:'OBSERV.',            rowSpan:2, styles:{valign:'middle',halign:'center'}},
        {content:'FIRMA BOMBERO\nQUE EFECTUO\nLA REVISION', rowSpan:2, styles:{valign:'middle',halign:'center'}},
      ],
      // ROW 2 — sub-headers
      [
        'POS','SOLKA\nFLAM','CO2','AGUA','OTRO',
        'PINTURA','MANIJA\nTRANSP.','MANGUERA','PRESION','MANOMETRO','BOQUILLA','CORNETA','PASADOR','SEÑALIZ.',
      ],
    ],
    body: rows,
    styles: {
      fontSize: 6,
      cellPadding: {top:1.2, bottom:1.2, left:0.8, right:0.8},
      lineColor: MG, lineWidth: 0.2,
      textColor: BK, font:'helvetica',
      halign:'center', valign:'middle',
    },
    headStyles: {
      fillColor: WH, textColor: BK,
      fontStyle:'bold', fontSize:5.5,
      lineColor: MG, lineWidth:0.2,
      halign:'center', valign:'middle',
    },
    columnStyles: {
      0:  {cellWidth:6},
      1:  {cellWidth:34, halign:'left'},
      2:  {cellWidth:6},
      3:  {cellWidth:10},
      4:  {cellWidth:6},
      5:  {cellWidth:7},
      6:  {cellWidth:7},
      7:  {cellWidth:10},
      8:  {cellWidth:8},
      9:  {cellWidth:9},
      10: {cellWidth:8},
      11: {cellWidth:8},
      12: {cellWidth:9},
      13: {cellWidth:8},
      14: {cellWidth:8},
      15: {cellWidth:8},
      16: {cellWidth:8},
      17: {cellWidth:11},
      18: {cellWidth:12},
      19: {cellWidth:10},
      20: {cellWidth:'auto'},
      21: {cellWidth:16},
    },
    didParseCell(data) {
      if (data.section!=='body') return
      const ci = data.column.index
      if (ci>=2&&ci<=6&&data.cell.raw==='X') data.cell.styles.fontStyle='bold'
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
