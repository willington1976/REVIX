import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

function drawLogo(doc, x, y, size) {
  doc.setFillColor(0, 71, 135)
  doc.circle(x + size/2, y + size/2, size/2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(size * 2.2)
  doc.setFont('helvetica', 'bold')
  doc.text('A', x + size/2, y + size/2 + size*0.35, { align: 'center' })
}

// Determine tipo bucket — exactly one column gets X
function tipoBucket(type) {
  if (!type) return { otros:'', co2:'', agua:'', otro:'' }
  const t = type.toUpperCase()
  if (t.includes('CO2'))   return { otros:'', co2:'X', agua:'', otro:'' }
  if (t.includes('AGUA'))  return { otros:'', co2:'', agua:'X', otro:'' }
  if (t.includes('PQS') || t.includes('POLVO') || t.includes('HALOTRON') || t.includes('AFFF') || t.includes('ESPUMA'))
    return { otros:'X', co2:'', agua:'', otro:'' }
  return { otros:'', co2:'', agua:'', otro:'X' }
}

// Check value -> text — handles all Firestore serialization variants
function chk(val) {
  if (val === true  || val === 1 || val === 'true'  || val === 'ok' || val === 'OK')  return 'OK'
  if (val === false || val === 0 || val === 'false' || val === 'f'  || val === 'F')   return 'F'
  if (val === null || val === undefined || val === '') return '--'
  return '--'
}

export function generateInspectionPDF(inspection, extinguishers, airportName, omitidos = []) {
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()

  const BLUE  = [0, 71, 135]
  const LGRAY = [189, 189, 189]
  const DGRAY = [80, 80, 80]
  const WHITE = [255, 255, 255]
  const GREEN = [22, 163, 74]
  const RED   = [220, 38, 38]
  const GRAY2 = [150, 150, 150]

  // ── HEADER ──────────────────────────────────────────────
  doc.setDrawColor(...LGRAY)
  doc.setLineWidth(0.3)
  doc.rect(8, 8, pageW - 16, pageH - 16)

  // Logo
  doc.setFillColor(...LGRAY)
  doc.rect(8, 8, 38, 28, 'F')
  drawLogo(doc, 12, 10, 12)
  doc.setTextColor(0,0,0)
  doc.setFontSize(6); doc.setFont('helvetica','bold')
  doc.text('AERONAUTICA CIVIL', 27, 23, { align:'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(5)
  doc.text('UNIDAD ADMINISTRATIVA ESPECIAL', 27, 27, { align:'center' })

  // FORMATO box
  doc.setFillColor(...LGRAY)
  doc.rect(pageW-50, 8, 42, 10, 'F')
  doc.setTextColor(0,0,0); doc.setFont('helvetica','bold'); doc.setFontSize(8)
  doc.text('FORMATO', pageW-29, 14.5, { align:'center' })

  // Title
  doc.setTextColor(...BLUE); doc.setFont('helvetica','bold'); doc.setFontSize(13)
  doc.text('REVISION TECNICA DE EXTINTORES', pageW/2+10, 20, { align:'center' })
  doc.setFontSize(8); doc.setTextColor(...DGRAY); doc.setFont('helvetica','normal')
  doc.text(`Aeropuerto: ${airportName}   Inspector: ${inspection.inspectorName}`, pageW/2+10, 27, { align:'center' })
  doc.text(`Fecha: ${inspection.date}   Hora inicio: ${inspection.startTime||'--'}   Hora fin: ${inspection.endTime||'--'}`, pageW/2+10, 32, { align:'center' })

  // Metadata strip
  const metaY = 36
  doc.setDrawColor(...LGRAY)
  doc.line(8, metaY, pageW-8, metaY)
  doc.setFillColor(245,245,245)
  doc.rect(8, metaY, pageW-16, 8, 'F')
  doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(0,0,0)
  doc.text('Clave: MSER 5.0-12-006', 20, metaY+5)
  doc.text('Version: 04', pageW/2, metaY+5, { align:'center' })
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pageW-20, metaY+5, { align:'right' })

  // Summary strip
  const sumY = metaY + 8
  const total    = extinguishers.length
  const okCount  = extinguishers.filter(e => e.result === 'ok').length
  const novCount = extinguishers.filter(e => e.result === 'novedad').length
  const coverage = inspection.totalRegistered > 0
    ? Math.round((total / inspection.totalRegistered) * 100) : 100

  doc.setFillColor(235,245,255)
  doc.rect(8, sumY, pageW-16, 10, 'F')
  doc.setFontSize(7); doc.setFont('helvetica','bold')
  doc.setTextColor(...BLUE);  doc.text(`Total registrados: ${inspection.totalRegistered||total}`, 16, sumY+6.5)
  doc.setTextColor(...DGRAY); doc.text(`Inspeccionados: ${total}`, 75, sumY+6.5)
  doc.setTextColor(...GREEN); doc.text(`Sin novedad: ${okCount}`, 140, sumY+6.5)
  doc.setTextColor(...RED);   doc.text(`Con novedad: ${novCount}`, 195, sumY+6.5)
  doc.setTextColor(...DGRAY); doc.text(`Cobertura: ${coverage}%`, 250, sumY+6.5)
  if (omitidos.length > 0) {
    doc.setTextColor(180,100,0)
    doc.text(`Omitidos: ${omitidos.length}`, 278, sumY+6.5)
  }

  // ── TABLE ───────────────────────────────────────────────
  const tableY = sumY + 11

  const rows = extinguishers.map((e, i) => {
    const tb = tipoBucket(e.type)
    // capacity — stored as "5 lb" string or separate fields
    // capacity may be "5 lb" (with unit) or just "5" (number)
    const capVal = e.capacity || ''
    const capUnit = e.capacityUnit || ''
    const cap = capVal
      ? (capVal.toString().includes(' ') ? capVal : capVal + (capUnit ? ' '+capUnit : ''))
      : '--'
    return [
      i + 1,
      e.serial       || '--',
      e.placa        || '--',
      `${e.zone||''}\n${e.exactLocation||''}`,
      cap,
      // TIPO — exactly one X
      tb.otros, tb.co2, tb.agua, tb.otro,
      // REVISION ESTADO GENERAL (9 items)
      chk(e.checks?.paint),
      chk(e.checks?.handle),
      chk(e.checks?.hose),
      chk(e.checks?.pressure),
      chk(e.checks?.nozzle),
      chk(e.checks?.pasador),
      chk(e.checks?.seal),
      chk(e.checks?.cylinder),
      chk(e.checks?.signage),
      // Extra
      e.lastHydroTest || '--',
      e.homolograma ? e.homolograma.replace(/_/g,' ').toUpperCase() : '--',
      e.novedad      || '',
      e.result === 'ok' ? 'OK' : 'NOV.',
    ]
  })

  // Column index map (0-based):
  // 0=N, 1=Serial, 2=Placa, 3=Ubicacion, 4=Cap,
  // 5=Otros, 6=CO2, 7=Agua, 8=Otro,
  // 9=Pintura, 10=Manija, 11=Manguera, 12=Manom, 13=Corneta, 14=Pasador, 15=Senaliz
  // 16=UltTest, 17=Homolog, 18=Observaciones, 19=Estado

  autoTable(doc, {
    startY: tableY,
    margin: { left: 8, right: 8 },
    head: [
      [
        { content:'N°',          rowSpan:2, styles:{valign:'middle',halign:'center'} },
        { content:'Serial',      rowSpan:2, styles:{valign:'middle',halign:'center'} },
        { content:'Placa',       rowSpan:2, styles:{valign:'middle',halign:'center'} },
        { content:'Ubicacion',   rowSpan:2, styles:{valign:'middle',halign:'center'} },
        { content:'Cap.',        rowSpan:2, styles:{valign:'middle',halign:'center'} },
        { content:'TIPO',        colSpan:4, styles:{halign:'center'} },
        { content:'REVISION ESTADO GENERAL', colSpan:9, styles:{halign:'center'} },
        { content:'Ult. Test',   rowSpan:2, styles:{valign:'middle',halign:'center'} },
        { content:'Homolog.',    rowSpan:2, styles:{valign:'middle',halign:'center'} },
        { content:'Observaciones',rowSpan:2,styles:{valign:'middle',halign:'center'} },
        { content:'Estado',      rowSpan:2, styles:{valign:'middle',halign:'center'} },
      ],
      [ 'Otros','CO2','Agua','Otro', 'Pintura','Manija','Manguera','Manom.','Corneta','Pasador','Sello','Cilindro','Senaliz.' ],
    ],
    body: rows,
    styles: {
      fontSize: 6,
      cellPadding: { top:1.5, bottom:1.5, left:1, right:1 },
      lineColor: LGRAY, lineWidth: 0.2,
      textColor: [30,30,30],
    },
    headStyles: {
      fillColor: BLUE, textColor: WHITE,
      fontStyle: 'bold', fontSize: 6,
      cellPadding: { top:1.5, bottom:1.5, left:1, right:1 },
    },
    columnStyles: {
      0:  { cellWidth:7,   halign:'center' },
      1:  { cellWidth:18,  halign:'center', fontStyle:'bold' },
      2:  { cellWidth:15,  halign:'center' },
      3:  { cellWidth:36 },
      4:  { cellWidth:10,  halign:'center' },
      5:  { cellWidth:8,   halign:'center' },
      6:  { cellWidth:8,   halign:'center' },
      7:  { cellWidth:8,   halign:'center' },
      8:  { cellWidth:8,   halign:'center' },
      9:  { cellWidth:9,   halign:'center' },
      10: { cellWidth:9,   halign:'center' },
      11: { cellWidth:10,  halign:'center' },
      12: { cellWidth:10,  halign:'center' },
      13: { cellWidth:10,  halign:'center' },
      14: { cellWidth:10,  halign:'center' },
      15: { cellWidth:10,  halign:'center' },
      16: { cellWidth:10,  halign:'center' },
      17: { cellWidth:10,  halign:'center' },
      18: { cellWidth:13,  halign:'center' },
      19: { cellWidth:13,  halign:'center' },
      20: { cellWidth:'auto' },
      21: { cellWidth:12,  halign:'center' },
    },
    didParseCell(data) {
      if (data.section !== 'body') return
      const ci = data.column.index
      const raw = data.cell.raw
      // TIPO cols 5-8
      if (ci >= 5 && ci <= 8 && raw === 'X') {
        data.cell.styles.textColor = BLUE
        data.cell.styles.fontStyle = 'bold'
      }
      // CHECK cols 9-17 (now 9 check items)
      if (ci >= 9 && ci <= 17) {
        if (raw === 'OK') data.cell.styles.textColor = GREEN
        if (raw === 'F')  { data.cell.styles.textColor = RED; data.cell.styles.fontStyle = 'bold' }
        if (raw === '--') data.cell.styles.textColor = GRAY2
      }
      // Estado col 21
      if (ci === 21) {
        if (raw === 'OK')   data.cell.styles.textColor = GREEN
        if (raw === 'NOV.') { data.cell.styles.textColor = RED; data.cell.styles.fontStyle = 'bold' }
      }
    },
    alternateRowStyles: { fillColor: [248,250,252] },
    rowPageBreak: 'avoid',
  })

  const finalY = doc.lastAutoTable.finalY

  // ── OMITIDOS ────────────────────────────────────────────
  if (omitidos && omitidos.length > 0) {
    const omY = finalY + 4
    doc.setFillColor(255,243,230)
    doc.roundedRect(8, omY, pageW-16, 6 + omitidos.length*4.5, 1,1,'F')
    doc.setFontSize(6.5); doc.setFont('helvetica','bold'); doc.setTextColor(...RED)
    doc.text(`Extintores NO inspeccionados (${omitidos.length}):`, 13, omY+4.5)
    doc.setFont('helvetica','normal'); doc.setTextColor(...DGRAY)
    omitidos.forEach((o,i) => {
      doc.text(`${i+1}. ${o.serial}  -  ${o.zone} > ${o.exactLocation}`, 18, omY+9+i*4.5)
    })
  }

  // ── SIGNATURES ──────────────────────────────────────────
  const sigBaseY = finalY + (omitidos.length>0 ? 10+omitidos.length*4.5 : 6)
  const sigY     = Math.min(sigBaseY, pageH-22)
  const sigW     = (pageW-32)/3

  ;[
    { label:'Firma Bombero Inspector', name:inspection.inspectorName },
    { label:'Firma Jefe de Estacion',  name:'' },
    { label:'Vo.Bo. Jefe de Operaciones', name:'' },
  ].forEach((b,i) => {
    const bx = 8 + i*(sigW+4)
    doc.setDrawColor(...LGRAY)
    doc.rect(bx, sigY, sigW, 14)
    doc.line(bx, sigY+9, bx+sigW, sigY+9)
    doc.setFont('helvetica','bold'); doc.setFontSize(6); doc.setTextColor(...DGRAY)
    doc.text(b.label, bx+sigW/2, sigY+12.5, { align:'center' })
    if (b.name) {
      doc.setFont('helvetica','normal')
      doc.text(b.name, bx+sigW/2, sigY+6, { align:'center' })
    }
  })

  // Footer
  doc.setFontSize(5.5); doc.setTextColor(180,180,180); doc.setFont('helvetica','normal')
  doc.text(
    `ExtintorCheck ARFF · Sistema de Inspeccion de Extintores · UAEAC · ${new Date().toLocaleString('es-CO')}`,
    pageW/2, pageH-5, { align:'center' }
  )

  return doc
}
