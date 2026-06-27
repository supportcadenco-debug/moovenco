'use client'

import { useState, useEffect } from 'react'
import Navbar from '../../src/components/Navbar'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const STATUS = {
  devis:      { label: 'Devis',      color: '#1565C0', bg: '#E3F2FD' },
  confirme:   { label: 'Confirmé',   color: '#1A9E50', bg: '#E8F5E9' },
  affecte:    { label: 'Affecté',    color: '#D4720A', bg: '#FFF3E0' },
  en_cours:   { label: 'En cours',   color: '#7B1FA2', bg: '#F3E5F5' },
  termine:    { label: 'Terminé',    color: '#37474F', bg: '#ECEFF1' },
  annule:     { label: 'Annulé',     color: '#C62828', bg: '#FFEBEE' },
}

const EMPTY_FORM = {
  reference: '', status: 'devis', client_name: '', client_email: '', client_phone: '',
  date_service: '', date_retour: '', origin: '', destination: '',
  passengers: '', vehicle_type: '', distance_km: '', price_ht: '',
  tva: '10', notes: '',
  conducteur_nom: '', conducteur_prenom: '', assigned_driver: '', vehicule_plaque: '',
  vehicule_places: '', places_prevues: '',
  heure_depart_garage: '', heure_prise_charge: '', heure_depart: '',
  heure_retour: '', heure_retour_garage: '',
  lieu_prise_charge: '', lieu_depose: '',
  client_id: '', client_adresse: '', client_cp_ville: '', client_responsable: '',
  client_tel: '', client_mail: '',
}

export default function Commercial() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('tous')
  const [search, setSearch] = useState('')
  const [generatingBC, setGeneratingBC] = useState(false)
  const [drivers, setDrivers] = useState<any[]>([])
  const [orderDocs, setOrderDocs] = useState<any[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [clients, setClients] = useState<any[]>([])

  useEffect(() => { loadOrders(); loadDrivers(); loadClients() }, [])

  async function loadOrders() {
    const { data, error } = await supabase
      .from('orders').select('*').eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
    if (!error) setOrders(data || [])
    setLoading(false)
  }

  async function loadDrivers() {
    const { data } = await supabase
      .from('profiles').select('id, name')
      .eq('company_id', COMPANY_ID)
      .eq('role', 'conducteur')
      .eq('active', true)
      .order('name')
    setDrivers(data || [])
  }

  async function loadClients() {
    const { data } = await supabase
      .from('clients').select('id, name, contact_nom, contact_prenom, contact_tel, contact_mail, adresse, cp, ville, contact_fonction')
      .eq('company_id', COMPANY_ID).order('name')
    setClients(data || [])
  }

  function calcTTC() {
    const ht = parseFloat(form.price_ht) || 0
    const tva = parseFloat(form.tva) || 0
    return (ht * (1 + tva / 100)).toFixed(2)
  }

  function autoRef() {
    const now = new Date()
    return `D${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*1000).toString().padStart(3,'0')}`
  }

  async function handleSave() {
    if (!form.destination || !form.date_service) { setMessage('Destination et date obligatoires'); return }
    setSaving(true)
    setMessage('')
    const ref = form.reference || autoRef()
    const { error } = await supabase.from('orders').insert({
      company_id: COMPANY_ID, reference: ref, status: form.status,
      origin: form.origin, destination: form.destination,
      date_service: form.date_service, date_retour: form.date_retour || null,
      passengers: parseInt(form.passengers) || null, vehicle_type: form.vehicle_type,
      distance_km: parseInt(form.distance_km) || null,
      price_ht: parseFloat(form.price_ht) || null,
      tva: parseFloat(form.tva) || 10,
      price_ttc: parseFloat(calcTTC()) || null, notes: form.notes,
      conducteur_nom: form.conducteur_nom, conducteur_prenom: form.conducteur_prenom,
      assigned_driver: form.assigned_driver || null,
      vehicule_plaque: form.vehicule_plaque, vehicule_places: parseInt(form.vehicule_places) || null,
      places_prevues: parseInt(form.places_prevues) || null,
      heure_depart_garage: form.heure_depart_garage, heure_prise_charge: form.heure_prise_charge,
      heure_depart: form.heure_depart, heure_retour: form.heure_retour,
      heure_retour_garage: form.heure_retour_garage,
      lieu_prise_charge: form.lieu_prise_charge, lieu_depose: form.lieu_depose,
      client_id: form.client_id || null,
      client_adresse: form.client_adresse, client_cp_ville: form.client_cp_ville,
      client_responsable: form.client_responsable, client_tel: form.client_tel,
      client_mail: form.client_mail,
    })
    if (error) { setMessage('Erreur : ' + error.message) }
    else { setMessage('✅ Commande enregistrée'); setForm(EMPTY_FORM); setShowForm(false); loadOrders() }
    setSaving(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('orders').update({ status }).eq('id', id)
    loadOrders()
    if (selected?.id === id) setSelected((s: any) => ({ ...s, status }))
  }

  async function genererBC(order: any) {
    setGeneratingBC(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

      const W = 210, H = 297
      const m = 10 // marge

      function genPage(doc: any, order: any, pageNum: number) {
        // CADRE GENERAL
        doc.setDrawColor(0)
        doc.setLineWidth(0.3)
        doc.rect(m, m, W - m * 2, H - m * 2)

        // EN-TÊTE gauche
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('RGO MOBILITÉS JANZÉ', m + 3, m + 8)
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.text('57 Rue de Bain - 35150 Janzé', m + 3, m + 13)
        doc.text('Tél 02 99 47 42 42', m + 3, m + 17)
        doc.text('Email : exploitation.janze@rgom.fr', m + 3, m + 21)
        doc.text('SIRET 69920078800072', m + 3, m + 25)
        doc.text('www.rgo-mobilites.com', m + 3, m + 29)

        // Ligne verticale séparation entête
        doc.line(W / 2, m, W / 2, m + 35)

        // EN-TÊTE droite — BILLET COLLECTIF
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text('BILLET COLLECTIF', W / 2 + 10, m + 12)

        // Ligne horizontale sous entête
        doc.line(m, m + 35, W - m, m + 35)

        if (pageNum === 1) {
          // SOUS-TITRE
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.text('SERVICE OCCASIONNEL COLLECTIF DE TRANSPORT ROUTIER DE VOYAGEURS', W / 2, m + 40, { align: 'center' })
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.text("Billet collectif : Arrêté ministériel du 28/12/2011 // Ordre de mission : Arrêté ministériel du 28/12/2011", W / 2, m + 45, { align: 'center' })

          // COMMANDE + VEHICULE
          let y = m + 52
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text(`COMMANDE : ${order.reference || ''}`, m + 3, y)

          doc.setFontSize(9)
          doc.text('VEHICULE :', W / 2 + 3, y)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text(order.vehicule_plaque || order.vehicle_type || '—', W / 2 + 25, y)

          y += 6
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.text('Conducteur :', m + 3, y)
          doc.setFont('helvetica', 'normal')
          doc.text((order.conducteur_nom || '').toUpperCase(), m + 28, y)

          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.text(`Nb place dans le car :`, W / 2 + 3, y)
          doc.setFont('helvetica', 'bold')
          doc.text(`${order.vehicule_places || ''}`, W / 2 + 43, y)

          y += 5
          doc.setFont('helvetica', 'normal')
          doc.text((order.conducteur_prenom || '').toUpperCase(), m + 28, y)
          doc.text(`Nb place prévus :`, W / 2 + 3, y)
          doc.setFont('helvetica', 'bold')
          doc.text(`${order.places_prevues || order.passengers || ''}`, W / 2 + 38, y)

          y += 5
          doc.setFont('helvetica', 'normal')
          doc.text(`Réel :`, W / 2 + 3, y)
          doc.line(W / 2 + 14, y, W / 2 + 40, y)

          y += 5
          doc.setFont('helvetica', 'normal')
          doc.text(`Motif de déplacement :`, W / 2 + 3, y)
          doc.setFont('helvetica', 'bold')
          doc.text(`Occasionnel`, W / 2 + 43, y)

          y += 5
          doc.setFont('helvetica', 'italic')
          doc.text(`Prix selon facture - ${order.reference || ''}`, W / 2 + 3, y)

          // CADRE CLIENT
          y += 8
          doc.setDrawColor(0, 100, 180)
          doc.setFillColor(200, 230, 255)
          doc.rect(m, y, W - m * 2, 6, 'F')
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(0, 80, 160)
          doc.text(`Client : ${(order.client_name || '').toUpperCase()}`, m + 3, y + 4)
          doc.setTextColor(0)
          doc.setDrawColor(0)

          y += 6
          doc.rect(m, y, (W - m * 2) / 2, 22)
          doc.rect(m + (W - m * 2) / 2, y, (W - m * 2) / 2, 22)

          doc.setFontSize(8)
          doc.setFont('helvetica', 'normal')
          doc.text(order.client_adresse || '', m + 3, y + 6)
          doc.text(order.client_cp_ville || '', m + 3, y + 11)

          doc.text('Responsable :', m + (W - m * 2) / 2 + 3, y + 6)
          doc.text(order.client_responsable || '', m + (W - m * 2) / 2 + 28, y + 6)
          doc.text('Tel :', m + (W - m * 2) / 2 + 3, y + 11)
          doc.text(order.client_tel || '', m + (W - m * 2) / 2 + 14, y + 11)
          doc.text('Mail :', m + (W - m * 2) / 2 + 3, y + 16)
          doc.text(order.client_mail || '', m + (W - m * 2) / 2 + 14, y + 16)

          // DESTINATION ET ITINERAIRE
          y += 26
          doc.setFontSize(9)
          doc.setFont('helvetica', 'bold')
          doc.text('Destination et itinéraire : ', m + 3, y)
          doc.setTextColor(0, 100, 180)
          doc.text((order.destination || '').toUpperCase(), m + 45, y)
          doc.setTextColor(0)

          y += 6
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          const notes = order.notes || ''
          const lines = doc.splitTextToSize(notes, W - m * 2 - 6)
          doc.text(lines, m + 3, y)
          y += lines.length * 4 + 4

          // TABLEAU DEPART / RETOUR
          const dateStr = order.date_service ? new Date(order.date_service).toLocaleDateString('fr-FR') : '—'
          const colW = (W - m * 2) / 2

          // Headers
          doc.setFillColor(100, 200, 220)
          doc.rect(m, y, colW, 7, 'F')
          doc.rect(m + colW, y, colW, 7, 'F')
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.text('Départ', m + colW / 2, y + 5, { align: 'center' })
          doc.text('Départ', m + colW + colW / 2, y + 5, { align: 'center' })
          y += 7

          doc.setFillColor(100, 200, 220)
          doc.rect(m, y, colW, 6, 'F')
          doc.rect(m + colW, y, colW, 6, 'F')
          doc.setFontSize(9)
          doc.text(dateStr, m + colW / 2, y + 4, { align: 'center' })
          doc.text(dateStr, m + colW + colW / 2, y + 4, { align: 'center' })
          y += 6

          // Sous-headers
          doc.setFillColor(240, 240, 240)
          doc.rect(m, y, colW, 5, 'F')
          doc.rect(m + colW, y, colW, 5, 'F')
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.text('Heure prévue', m + colW * 0.5, y + 3.5, { align: 'center' })
          doc.text('Heure réelle', m + colW * 0.85, y + 3.5, { align: 'center' })
          doc.text('Heure prévue', m + colW + colW * 0.5, y + 3.5, { align: 'center' })
          doc.text('Heure réelle', m + colW + colW * 0.85, y + 3.5, { align: 'center' })
          y += 5

          // Lignes horaires
          const horairesGauche = [
            ['H de départ garage :', order.heure_depart_garage || ''],
            ['H de prise en charge :', order.heure_prise_charge || ''],
            ['H de départ :', order.heure_depart || ''],
          ]
          const horairesDroite = [
            ['H de prise en charge :', ''],
            ['H de retour :', order.heure_retour || ''],
            ['H de retour garage :', order.heure_retour_garage || ''],
          ]

          horairesGauche.forEach(([label, val], idx) => {
            doc.setDrawColor(200)
            doc.rect(m, y, colW, 5)
            doc.rect(m + colW, y, colW, 5)
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.setDrawColor(0)
            doc.text(label, m + 2, y + 3.5)
            doc.setFont('helvetica', 'bold')
            doc.text(val, m + colW * 0.5, y + 3.5, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(horairesDroite[idx][0], m + colW + 2, y + 3.5)
            doc.setFont('helvetica', 'bold')
            doc.text(horairesDroite[idx][1], m + colW + colW * 0.5, y + 3.5, { align: 'center' })
            y += 5
          })

          // Lieux
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.rect(m, y, colW, 14)
          doc.rect(m + colW, y, colW, 14)
          doc.text('Lieu de prise en charge :', m + 2, y + 4)
          doc.setFont('helvetica', 'bold')
          doc.text(order.lieu_prise_charge || order.origin || '', m + 2, y + 8)
          doc.setFont('helvetica', 'normal')
          doc.text('Lieu de dépose terminale :', m + colW + 2, y + 4)
          doc.setFont('helvetica', 'bold')
          doc.text(order.lieu_depose || order.destination || '', m + colW + 2, y + 8)
          y += 14

          // FRAIS DE ROUTE
          y += 2
          doc.setFontSize(8)
          doc.setFont('helvetica', 'bold')
          doc.setFillColor(100, 200, 220)
          doc.rect(m, y, 50, 5, 'F')
          doc.rect(m + 50, y, (W - m * 2 - 50) / 2, 5, 'F')
          doc.rect(m + 50 + (W - m * 2 - 50) / 2, y, (W - m * 2 - 50) / 2, 5, 'F')
          doc.text('Frais de route', m + 25, y + 3.5, { align: 'center' })
          doc.text('GARAGE', m + 50 + (W - m * 2 - 50) / 4, y + 3.5, { align: 'center' })
          doc.text('CLIENT', m + 50 + (W - m * 2 - 50) * 3 / 4, y + 3.5, { align: 'center' })
          y += 5

          const fraisKm = [
            ['Autoroute', 'Km retour'],
            ['Repas', 'Km départ'],
            ['Hotels', 'Total'],
            ['Frais divers', 'Km sortie FRONTIERE'],
            ['', 'Km entrée FRONTIERE'],
            ['', 'Total'],
          ]
          const colFrais = 50
          const colKm = (W - m * 2 - colFrais) / 2

          fraisKm.forEach(([frais, km]) => {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7)
            doc.rect(m, y, colFrais, 5)
            doc.rect(m + colFrais, y, colKm, 5)
            doc.rect(m + colFrais + colKm, y, colKm / 2, 5)
            doc.rect(m + colFrais + colKm + colKm / 2, y, colKm / 2, 5)
            doc.text(frais, m + 2, y + 3.5)
            doc.text(km, m + colFrais + 2, y + 3.5)
            if (km === 'Total' || km === 'Total') doc.setFont('helvetica', 'bold')
            y += 5
          })

          // OBSERVATIONS
          y += 3
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(8)
          doc.text('Observations de l\'exploitation :', m + 3, y)
          y += 5
          doc.rect(m, y, W - m * 2, 15)

        } else {
          // PAGE 2 — CONDUCTEUR
          let y = m + 40
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          doc.text('Observations du CONDUCTEUR :', m + 3, y)
          doc.rect(m, y + 3, W - m * 2, H - m - y - 3)
        }

        // PIED DE PAGE
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.text(`Page ${pageNum} sur 2 - Devis n° ${order.reference || ''}`, W / 2, H - m - 3, { align: 'center' })
      }

      // PAGE 1
      genPage(doc, order, 1)

      // PAGE 2
      doc.addPage()
      genPage(doc, order, 2)

      doc.save(`BC_${order.reference || 'billet'}_${new Date().toISOString().split('T')[0]}.pdf`)

    } catch (e) {
      console.error(e)
      alert('Erreur génération PDF')
    }
    setGeneratingBC(false)
  }

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'tous' || o.status === filterStatus
    const matchSearch = !search || o.reference?.toLowerCase().includes(search.toLowerCase()) || o.destination?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const s = (key: string) => ({ target: { value } }: any) => setForm((f: any) => ({ ...f, [key]: value }))

  const DOC_CATS_COMMERCIAL = [
    { key: 'devis_signe',  label: '✍️ Devis signé' },
    { key: 'bc',           label: '📋 Bon de commande' },
    { key: 'facture',      label: '🧾 Facture' },
    { key: 'autre',        label: '📎 Autre' },
  ]

  async function loadOrderDocs(orderId) {
    const { data } = await supabase.from('module_documents').select('*')
      .eq('entity_id', orderId).order('created_at', { ascending: false })
    setOrderDocs(data || [])
  }

  async function uploadOrderDoc(file: File, categorie: string) {
    if (!file || !selected) return
    setUploadingDoc(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `commercial/${selected.id}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from('driver-documents').upload(path, file, { upsert: false })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(path)
        await supabase.from('module_documents').insert({
          company_id: COMPANY_ID, module: 'commercial', entity_id: selected.id,
          nom: file.name, categorie, url: urlData.publicUrl, taille: file.size,
        })
        await loadOrderDocs(selected.id)
      }
    } catch(e) { console.error(e) }
    setUploadingDoc(false)
  }

  async function deleteOrderDoc(doc: any) {
    if (!confirm('Supprimer ?')) return
    await supabase.from('module_documents').delete().eq('id', doc.id)
    setOrderDocs(prev => prev.filter((d: any) => d.id !== doc.id))
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="commercial" />

      {/* BARRE ACTION */}
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => { setShowForm(true); setSelected(null); setForm(EMPTY_FORM) }}
          style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
          + Nouveau devis
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LISTE */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {Object.entries(STATUS).map(([key, val]) => {
              const count = orders.filter(o => o.status === key).length
              if (count === 0) return null
              return (
                <div key={key} onClick={() => setFilterStatus(filterStatus === key ? 'tous' : key)}
                  style={{ background: filterStatus === key ? val.color : 'white', color: filterStatus === key ? 'white' : val.color, border: `1px solid ${val.color}40`, borderRadius: '20px', padding: '4px 12px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span>{val.label}</span><span style={{ fontWeight: '800' }}>{count}</span>
                </div>
              )
            })}
            {filterStatus !== 'tous' && <div onClick={() => setFilterStatus('tous')} style={{ color: '#8A95A3', fontSize: '11px', cursor: 'pointer', padding: '4px 8px', alignSelf: 'center' }}>✕ Tout voir</div>}
          </div>

          <div style={{ background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', padding: '7px 12px', display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <span style={{ color: '#8A95A3' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par référence ou destination…"
              style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '12px', width: '100%' }} />
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '40px' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '60px', background: 'white', borderRadius: '10px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>💼</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Aucune commande</div>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                    {['Référence', 'Destination', 'Date', 'Passagers', 'Prix HT', 'Statut', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order, i) => {
                    const st = STATUS[order.status] || STATUS.devis
                    return (
                      <tr key={order.id} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC', cursor: 'pointer' }}
                        onClick={() => { setSelected(order); setShowForm(false); loadOrderDocs(order.id) }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F5F7FA'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC'}>
                        <td style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>{order.reference}</td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: '#1A2130' }}>{order.destination}</td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: '#4A5568' }}>{order.date_service ? new Date(order.date_service).toLocaleDateString('fr-FR') : '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: '#4A5568' }}>{order.passengers || '—'}</td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{order.price_ht ? parseFloat(order.price_ht).toFixed(2) + ' €' : '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: st.bg, color: st.color, fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '10px' }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '4px' }} onClick={e => e.stopPropagation()}>
                            {order.status === 'devis' && <button onClick={() => updateStatus(order.id, 'confirme')} style={{ background: '#E8F5E9', border: 'none', color: '#1A9E50', fontSize: '10px', fontWeight: '600', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer' }}>✓ Confirmer</button>}
                            {order.status === 'confirme' && <button onClick={() => updateStatus(order.id, 'affecte')} style={{ background: '#FFF3E0', border: 'none', color: '#D4720A', fontSize: '10px', fontWeight: '600', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer' }}>Affecter</button>}
                            {order.status !== 'annule' && order.status !== 'termine' && <button onClick={() => updateStatus(order.id, 'annule')} style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontSize: '10px', fontWeight: '600', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer' }}>Annuler</button>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PANEL DROITE */}
        {(showForm || selected) && (
          <div style={{ width: '360px', minWidth: '360px', background: 'white', borderLeft: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #D0D4DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{showForm ? '+ Nouveau devis' : selected?.reference}</div>
              <button onClick={() => { setShowForm(false); setSelected(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8A95A3' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
              {showForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', paddingBottom: '4px', borderBottom: '1px solid #E2E6EA' }}>Trajet</div>
                  {[
                    ['Référence (auto si vide)', 'reference', 'text', 'D2026...'],
                    ['Destination *', 'destination', 'text', 'Paimpont - Office de tourisme'],
                    ['Lieu de départ', 'origin', 'text', 'Janzé - Dépôt RGO'],
                    ['Date de service *', 'date_service', 'date', ''],
                    ['Date de retour', 'date_retour', 'date', ''],
                    ['Nombre de passagers', 'passengers', 'number', '54'],
                    ['Type de véhicule', 'vehicle_type', 'text', 'Autocar 55p'],
                    ['Prix HT (€)', 'price_ht', 'number', ''],
                    ['TVA (%)', 'tva', 'number', '10'],
                  ].map(([label, key, type, ph]) => (
                    <div key={key}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      <input type={type as string} value={form[key]} onChange={s(key)} placeholder={ph as string}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  ))}

                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', paddingBottom: '4px', borderBottom: '1px solid #E2E6EA', marginTop: '6px' }}>Client</div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Sélectionner depuis le carnet</label>
                    <select onChange={e => {
                      const client = clients.find(c => c.id === e.target.value)
                      if (client) {
                        const responsable = [client.contact_nom, client.contact_prenom].filter(Boolean).join(' ')
                        setForm((f: any) => ({
                          ...f,
                          client_id: client.id,
                          client_name: client.name,
                          client_adresse: client.adresse || '',
                          client_cp_ville: [client.cp, client.ville].filter(Boolean).join(' '),
                          client_responsable: responsable,
                          client_tel: client.contact_tel || '',
                          client_mail: client.contact_mail || '',
                        }))
                      }
                    }} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      <option value="">— Sélectionner un client —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {[
                    ['Nom client', 'client_name', 'text', 'Ecole St Vincent'],
                    ['Adresse', 'client_adresse', 'text', '16 Place de l\'Eglise'],
                    ['CP et Ville', 'client_cp_ville', 'text', '35133 DOMAGNE'],
                    ['Responsable', 'client_responsable', 'text', ''],
                    ['Téléphone', 'client_tel', 'text', ''],
                    ['Email', 'client_mail', 'email', ''],
                  ].map(([label, key, type, ph]) => (
                    <div key={key}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      <input type={type as string} value={form[key]} onChange={s(key)} placeholder={ph as string}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  ))}

                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', paddingBottom: '4px', borderBottom: '1px solid #E2E6EA', marginTop: '6px' }}>Conducteur & Véhicule</div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Conducteur</label>
                    <select value={form.assigned_driver} onChange={e => {
                      const driver = drivers.find(d => d.id === e.target.value)
                      if (driver) {
                        const parts = driver.name.trim().split(' ')
                        const nom = parts[0] || ''
                        const prenom = parts.slice(1).join(' ') || ''
                        setForm((f: any) => ({ ...f, assigned_driver: driver.id, conducteur_nom: nom, conducteur_prenom: prenom }))
                      } else {
                        setForm((f: any) => ({ ...f, assigned_driver: '', conducteur_nom: '', conducteur_prenom: '' }))
                      }
                    }} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      <option value="">— Sélectionner un conducteur —</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      ['Plaque véhicule', 'vehicule_plaque'],
                      ['Nb places car', 'vehicule_places'],
                      ['Places prévues', 'places_prevues'],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                        <input value={form[key]} onChange={s(key)}
                          style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', paddingBottom: '4px', borderBottom: '1px solid #E2E6EA', marginTop: '6px' }}>Horaires</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {[
                      ['Départ garage', 'heure_depart_garage'],
                      ['Prise en charge', 'heure_prise_charge'],
                      ['Départ', 'heure_depart'],
                      ['Retour', 'heure_retour'],
                      ['Retour garage', 'heure_retour_garage'],
                    ].map(([label, key]) => (
                      <div key={key}>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                        <input type="time" value={form[key]} onChange={s(key)}
                          style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>

                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', paddingBottom: '4px', borderBottom: '1px solid #E2E6EA', marginTop: '6px' }}>Lieux</div>
                  {[
                    ['Lieu de prise en charge', 'lieu_prise_charge', 'DOMAGNE - ECOLE ST VINCENT DE PAUL'],
                    ['Lieu de dépose terminale', 'lieu_depose', ''],
                  ].map(([label, key, ph]) => (
                    <div key={key}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      <input value={form[key]} onChange={s(key)} placeholder={ph as string}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  ))}

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Notes / Itinéraire</label>
                    <textarea value={form.notes} onChange={s('notes')} rows={5}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Statut initial</label>
                    <select value={form.status} onChange={s('status')} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>

                  {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1B5E20' : '#C62828', fontSize: '11px', padding: '8px 10px', borderRadius: '5px' }}>{message}</div>}
                  <button onClick={handleSave} disabled={saving}
                    style={{ background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Enregistrement…' : 'Enregistrer le devis'}
                  </button>
                </div>
              ) : selected ? (
                <div>
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    {Object.entries(STATUS).map(([k, v]) => (
                      <button key={k} onClick={() => updateStatus(selected.id, k)}
                        style={{ background: selected.status === k ? v.color : v.bg, color: selected.status === k ? 'white' : v.color, border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '12px', cursor: 'pointer' }}>
                        {v.label}
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#4A5568', background: '#F8F9FB', borderRadius: '8px', padding: '12px', marginBottom: '10px' }}>
                    <div><strong style={{ color: '#1A2130' }}>Destination :</strong> {selected.destination}</div>
                    <div><strong style={{ color: '#1A2130' }}>Départ :</strong> {selected.origin || '—'}</div>
                    <div><strong style={{ color: '#1A2130' }}>Date :</strong> {selected.date_service ? new Date(selected.date_service).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</div>
                    {selected.date_retour && <div><strong style={{ color: '#1A2130' }}>Retour :</strong> {new Date(selected.date_retour).toLocaleDateString('fr-FR')}</div>}
                    <div><strong style={{ color: '#1A2130' }}>Passagers :</strong> {selected.passengers || '—'}</div>
                    <div><strong style={{ color: '#1A2130' }}>Véhicule :</strong> {selected.vehicule_plaque || selected.vehicle_type || '—'}</div>
                    <div><strong style={{ color: '#1A2130' }}>Conducteur :</strong> {selected.conducteur_nom ? `${selected.conducteur_nom} ${selected.conducteur_prenom || ''}` : '—'}</div>
                    <div><strong style={{ color: '#1A2130' }}>Prix HT :</strong> {selected.price_ht ? parseFloat(selected.price_ht).toFixed(2) + ' €' : '—'}</div>
                    <div><strong style={{ color: '#1A2130' }}>Prix TTC :</strong> {selected.price_ttc ? parseFloat(selected.price_ttc).toFixed(2) + ' €' : '—'}</div>
                  </div>

                  {selected.notes && (
                    <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '6px' }}>Notes / Itinéraire</div>
                      <div style={{ fontSize: '11px', color: '#4A5568', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
                    </div>
                  )}

                  {/* DOCUMENTS DE LA COMMANDE */}
                  <div style={{ marginTop: '14px', borderTop: '1px solid #E2E6EA', paddingTop: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>📎 Documents</div>
                    {DOC_CATS_COMMERCIAL.map(cat => {
                      const catDocs = orderDocs.filter((d: any) => d.categorie === cat.key)
                      return (
                        <div key={cat.key} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ fontSize: '10px', fontWeight: '600', color: '#8A95A3' }}>{cat.label}</div>
                            <label style={{ background: uploadingDoc ? '#8A95A3' : '#E8F0FB', color: '#0E5AA7', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', cursor: uploadingDoc ? 'not-allowed' : 'pointer' }}>
                              {uploadingDoc ? '⏳' : '+ Ajouter'}
                              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} disabled={uploadingDoc}
                                onChange={e => { if (e.target.files?.[0]) uploadOrderDoc(e.target.files[0], cat.key) }} />
                            </label>
                          </div>
                          {catDocs.length === 0 ? (
                            <div style={{ fontSize: '10px', color: '#8A95A3', padding: '5px 8px', background: '#F8F9FB', borderRadius: '4px' }}>Aucun document</div>
                          ) : catDocs.map((doc: any) => (
                            <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', background: 'white', border: '1px solid #E2E6EA', borderRadius: '4px', marginBottom: '3px' }}>
                              <span>{doc.nom?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                              <a href={doc.url} target="_blank" rel="noreferrer"
                                style={{ flex: 1, fontSize: '11px', fontWeight: '600', color: '#0E5AA7', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {doc.nom}
                              </a>
                              <button onClick={() => deleteOrderDoc(doc)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => genererBC(selected)}
                      disabled={generatingBC}
                      style={{ flex: 1, background: generatingBC ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '10px', borderRadius: '5px', cursor: generatingBC ? 'not-allowed' : 'pointer' }}>
                      {generatingBC ? '⏳ Génération…' : '📄 Générer BC PDF'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* STATS BAS */}
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        {[
          [orders.length, 'Total'],
          [orders.filter(o => o.status === 'devis').length, 'Devis'],
          [orders.filter(o => o.status === 'confirme').length, 'Confirmés'],
          [orders.filter((o: any) => ['confirme','affecte','en_cours'].includes(o.status) && o.price_ttc).reduce((sum: number, o: any) => sum + parseFloat(o.price_ttc), 0).toFixed(0) + ' €', 'CA en cours'],
        ].map(([v, l]) => (
          <div key={l as string}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{v}</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}