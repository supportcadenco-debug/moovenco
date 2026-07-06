// ─── Génération PDF Moovenco ─────────────────────────────────────────────────
import { RGO } from './constants'
import { formatMontant } from './utils'

async function buildPDF(doc: any) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, m = 15, col = W - m * 2
  const isDevis = doc.type_document === 'devis'
  const Fmt = (v: any) => formatMontant(v)
  const bleu: [number,number,number] = [14, 90, 167]
  const dark: [number,number,number] = [26, 33, 48]
  const gris: [number,number,number] = [138, 149, 163]

  pdf.setFillColor(...dark); pdf.rect(0, 0, W, 38, 'F')
  pdf.setFontSize(20); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255,255,255)
  pdf.text('RGO', m, 16); pdf.setTextColor(46, 201, 113); pdf.text('Mobilités', m + 14, 16)
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200,210,220)
  pdf.text(`${RGO.adresse} — ${RGO.cp} ${RGO.ville}`, m, 22)
  pdf.text(`Tél : ${RGO.tel}  |  ${RGO.email}`, m, 27)
  pdf.text(`SIRET : ${RGO.siret}  |  TVA : ${RGO.tva_num}`, m, 32)
  pdf.setFontSize(22); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255,255,255)
  pdf.text(isDevis ? 'DEVIS' : 'FACTURE', W - m, 20, { align: 'right' })
  pdf.setFontSize(11); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200,210,220)
  pdf.text(doc.numero, W - m, 27, { align: 'right' })

  let y = 48
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...gris); pdf.text('ÉMETTEUR', m, y)
  pdf.setTextColor(...dark); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.text(RGO.nom, m, y + 6)
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal')
  pdf.text(RGO.adresse, m, y + 11); pdf.text(`${RGO.cp} ${RGO.ville}`, m, y + 16); pdf.text(`NAF : ${RGO.naf}`, m, y + 21)
  const cx = W / 2 + 5
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(...gris); pdf.text('CLIENT', cx, y)
  pdf.setTextColor(...dark); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.text(doc.client_nom || '—', cx, y + 6)
  pdf.setFontSize(8); pdf.setFont('helvetica', 'normal')
  if (doc.client_adresse) pdf.text(doc.client_adresse, cx, y + 11)
  if (doc.client_cp || doc.client_ville) pdf.text(`${doc.client_cp || ''} ${doc.client_ville || ''}`.trim(), cx, y + 16)
  if (doc.client_email) pdf.text(doc.client_email, cx, y + 21)
  if (doc.client_siret) pdf.text(`SIRET : ${doc.client_siret}`, cx, y + 26)
  pdf.setDrawColor(...gris); pdf.setLineWidth(0.3); pdf.line(W / 2, y - 2, W / 2, y + 30)
  y += 36

  pdf.setFillColor(245,247,250); pdf.rect(m, y, col, 16, 'F')
  pdf.setDrawColor(220,225,230); pdf.setLineWidth(0.2); pdf.rect(m, y, col, 16)
  const dateItems = [
    [`Date du ${isDevis ? 'devis' : 'facture'}`, new Date(doc.date_facture).toLocaleDateString('fr-FR')],
    ...(doc.date_service  ? [['Date de service',  new Date(doc.date_service).toLocaleDateString('fr-FR')]]  : []),
    ...(doc.date_echeance ? [["Date d'échéance",  new Date(doc.date_echeance).toLocaleDateString('fr-FR')]] : []),
    ...(doc.bc_reference  ? [['Bon de commande',  doc.bc_reference]] : []),
  ] as string[][]
  const itemW = col / Math.max(dateItems.length, 1)
  dateItems.forEach(([label, val], i) => {
    const x = m + i * itemW + 5
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...gris); pdf.text(label, x, y + 6)
    pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...dark); pdf.text(val, x, y + 12)
  })
  y += 22

  pdf.setFillColor(...dark); pdf.rect(m, y, col, 8, 'F')
  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255,255,255)
  pdf.text('DESCRIPTION', m + 4, y + 5.5); pdf.text('QTÉ', m + col * 0.62, y + 5.5, { align: 'center' })
  pdf.text('P.U. HT', m + col * 0.78, y + 5.5, { align: 'center' }); pdf.text('TOTAL HT', m + col - 4, y + 5.5, { align: 'right' })
  y += 8
  ;(doc.lignes || []).forEach((l: any, i: number) => {
    const rowH = 8
    if (i % 2 === 0) { pdf.setFillColor(250,251,252); pdf.rect(m, y, col, rowH, 'F') }
    pdf.setDrawColor(235,238,242); pdf.setLineWidth(0.1); pdf.rect(m, y, col, rowH)
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...dark)
    pdf.text((pdf.splitTextToSize(l.description || '', col * 0.56) as string[])[0] || '', m + 4, y + 5.5)
    pdf.text(String(l.quantite || 0), m + col * 0.62, y + 5.5, { align: 'center' })
    pdf.text(`${Fmt(l.prix_unitaire)} €`, m + col * 0.78, y + 5.5, { align: 'center' })
    pdf.setFont('helvetica', 'bold'); pdf.text(`${Fmt((l.quantite || 0) * (l.prix_unitaire || 0))} €`, m + col - 4, y + 5.5, { align: 'right' })
    y += rowH
  })
  y += 4

  const totW = 75, totX = W - m - totW
  ;[['Total HT', `${Fmt(doc.montant_ht)} €`], [`TVA ${doc.tva_taux}%`, `${Fmt(doc.montant_tva)} €`]].forEach(([label, val]) => {
    pdf.setFillColor(248,249,251); pdf.rect(totX, y, totW, 7, 'F')
    pdf.setDrawColor(220,225,230); pdf.rect(totX, y, totW, 7)
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...gris); pdf.text(label, totX + 4, y + 5)
    pdf.setTextColor(...dark); pdf.text(val, totX + totW - 4, y + 5, { align: 'right' }); y += 7
  })
  pdf.setFillColor(...bleu); pdf.rect(totX, y, totW, 10, 'F')
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(255,255,255)
  pdf.text('TOTAL TTC', totX + 4, y + 7); pdf.text(`${Fmt(doc.montant_ttc)} €`, totX + totW - 4, y + 7, { align: 'right' })
  y += 16

  if (doc.notes) {
    pdf.setFillColor(255,248,225)
    const notesLines = pdf.splitTextToSize(doc.notes, col - 8) as string[]
    const notesH = notesLines.length * 4.5 + 10
    pdf.rect(m, y, col, notesH, 'F'); pdf.setDrawColor(255,213,79); pdf.rect(m, y, col, notesH)
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...dark); pdf.text('Notes / Observations', m + 4, y + 6)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(74,85,104); pdf.text(notesLines, m + 4, y + 11)
    y += notesH + 6
  }

  // Infos retour BC (véhicule réel, horaires réels) — uniquement si l'exploitant
  // a coché "inclure sur le PDF" pour ce document.
  if (doc.inclure_retour_pdf && (doc.retour_vehicule_reel || doc.retour_heure_dep_reel || doc.retour_heure_ret_reel || doc.retour_km_reel != null)) {
    const retourItems: string[][] = [
      ...(doc.retour_vehicule_reel ? [['Véhicule', doc.retour_vehicule_reel]] : []),
      ...(doc.retour_km_reel != null ? [['Distance réelle', `${doc.retour_km_reel} km`]] : []),
      ...(doc.retour_heure_dep_reel ? [['Départ', doc.retour_heure_dep_reel]] : []),
      ...(doc.retour_heure_ret_reel ? [['Retour', doc.retour_heure_ret_reel]] : []),
    ]
    const retourH = 12
    pdf.setFillColor(240,247,255); pdf.rect(m, y, col, retourH, 'F')
    pdf.setDrawColor(184,217,245); pdf.setLineWidth(0.2); pdf.rect(m, y, col, retourH)
    pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...bleu)
    pdf.text('SERVICE RÉALISÉ', m + 4, y + 5)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(...dark)
    const retourText = retourItems.map(([label, val]) => `${label} : ${val}`).join('   —   ')
    pdf.text(retourText, m + 4, y + 9.5)
    y += retourH + 6
  }

  if (isDevis) {
    y += 4
    const sigW = (col - 10) / 2
    pdf.setFillColor(248,249,251); pdf.rect(m, y, sigW, 25, 'F'); pdf.rect(m + sigW + 10, y, sigW, 25, 'F')
    pdf.setDrawColor(220,225,230); pdf.rect(m, y, sigW, 25); pdf.rect(m + sigW + 10, y, sigW, 25)
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...gris)
    pdf.text('BON POUR ACCORD — Signature et cachet client', m + 4, y + 6)
    pdf.text('POUR RGO MOBILITÉS — Signature', m + sigW + 14, y + 6)
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal')
    pdf.text('Date :', m + 4, y + 21); pdf.text('Date :', m + sigW + 14, y + 21)
  }

  const footY = 282
  pdf.setFillColor(...dark); pdf.rect(0, footY, W, 15, 'F')
  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200,210,220)
  pdf.text(`Règlement : Virement bancaire — IBAN : ${RGO.rib}`, W / 2, footY + 5, { align: 'center' })
  pdf.setTextColor(...gris)
  pdf.text(`${RGO.nom}  |  SIRET ${RGO.siret}  |  NAF ${RGO.naf}  |  TVA ${RGO.tva_num}`, W / 2, footY + 10, { align: 'center' })
  if (isDevis) {
    pdf.setFontSize(7)
    pdf.text("Devis valable 30 jours à compter de la date d'émission.", W / 2, footY + 14, { align: 'center' })
  }

  return { pdf, filename: `${doc.numero}_${(doc.client_nom || 'client').replace(/[^a-zA-Z0-9]/g, '_')}.pdf` }
}

// Télécharger le PDF
export async function telechargerPDF(doc: any): Promise<void> {
  const { pdf, filename } = await buildPDF(doc)
  pdf.save(filename)
}

// Obtenir le PDF en base64 (pour envoi mail)
export async function getPDFBase64(doc: any): Promise<{ base64: string; filename: string }> {
  const { pdf, filename } = await buildPDF(doc)
  return { base64: pdf.output('datauristring').split(',')[1], filename }
}
