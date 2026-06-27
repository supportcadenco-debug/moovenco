'use client'

import { useState, useEffect, useRef } from 'react'
import Navbar from '../../src/components/Navbar'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'
const DELETE_PASSWORD = '1968A'

const STATUTS_DOC: any = {
  devis:   { label: 'Devis',   color: '#7B3FB5', bg: '#F3E8FF' },
  signe:   { label: 'Signé',   color: '#D4720A', bg: '#FFF3E0' },
  emise:   { label: 'Émise',   color: '#1565C0', bg: '#E3F2FD' },
  envoyee: { label: 'Envoyée', color: '#D4720A', bg: '#FFF3E0' },
  payee:   { label: 'Payée',   color: '#1A9E50', bg: '#E8F5E9' },
  annulee: { label: 'Annulée', color: '#C62828', bg: '#FFEBEE' },
}

const TVA_TAUX = [0, 10, 20]
const TYPE_VEHICULE = ['autocar', 'minibus']
const TYPE_CLIENT = ['mairie', 'ecole', 'entreprise', 'particulier']
const TARIF_MODE = [
  { key: 'km',          label: 'Au km' },
  { key: 'journee',     label: 'Journée' },
  { key: 'multi_jours', label: 'Multi-jours' },
]

const DOC_CATS = [
  { key: 'devis_signe', label: '✍️ Devis signé' },
  { key: 'bc',          label: '📋 Bon de commande' },
  { key: 'facture',     label: '🧾 Facture' },
  { key: 'autre',       label: '📎 Autre' },
]

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function getNextNumero(docs: any[], prefix: string) {
  const year = new Date().getFullYear()
  const existing = docs.filter(d => d.numero?.startsWith(`${prefix}${year}-`))
  const max = existing.reduce((acc, d) => {
    const n = parseInt(d.numero?.split('-')[1] || '0')
    return n > acc ? n : acc
  }, 0)
  return `${prefix}${year}-${String(max + 1).padStart(3, '0')}`
}

const EMPTY_FORM = {
  type_document: 'devis',
  client_id: '', client_nom: '', client_adresse: '', client_cp: '', client_ville: '',
  client_email: '', client_siret: '', client_type: 'mairie',
  client_contact_nom: '', client_contact_tel: '',
  date_facture: new Date().toISOString().split('T')[0],
  date_service: '', date_echeance: '',
  tva_taux: 10, tarif_mode: 'km', vehicle_type: 'autocar',
  distance_km: '', tarif_km: '', tarif_journee: '',
  nb_jours: 1, frais_attente: 0,
  bc_reference: '', notes: '',
  destination: '', origin: '', date_retour: '',
  passengers: '', vehicule_plaque: '', vehicule_places: '', places_prevues: '',
  heure_depart_garage: '', heure_prise_charge: '', heure_depart: '',
  heure_retour: '', heure_retour_garage: '',
  lieu_prise_charge: '', lieu_depose: '',
  assigned_driver: '', conducteur_nom: '', conducteur_prenom: '',
}

export default function Commercial() {
  const [factures, setFactures] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [tarifs, setTarifs] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [orderDocs, setOrderDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('tous')
  const [search, setSearch] = useState('')
  const [generatingBC, setGeneratingBC] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const clientRef = useRef<HTMLDivElement>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) setShowSuggestions(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadAll() {
    const [{ data: f }, { data: o }, { data: t }, { data: d }, { data: c }] = await Promise.all([
      supabase.from('factures').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
      supabase.from('orders').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
      supabase.from('tarifs').select('*').eq('company_id', COMPANY_ID).eq('actif', true),
      supabase.from('profiles').select('id, name').eq('company_id', COMPANY_ID).eq('role', 'conducteur').eq('active', true).order('name'),
      supabase.from('clients').select('*').eq('company_id', COMPANY_ID).eq('active', true).order('name'),
    ])
    setFactures(f || [])
    setOrders(o || [])
    setTarifs(t || [])
    setDrivers(d || [])
    setClients(c || [])
    setLoading(false)
  }

  function handleClientSearch(val: string) {
    setClientSearch(val)
    setForm((f: any) => ({ ...f, client_nom: val, client_id: '' }))
    if (val.length < 2) { setClientSuggestions([]); setShowSuggestions(false); return }
    const filtered = clients.filter(c =>
      c.name?.toLowerCase().includes(val.toLowerCase()) ||
      c.contact_nom?.toLowerCase().includes(val.toLowerCase())
    )
    setClientSuggestions(filtered)
    setShowSuggestions(true)
  }

  function selectClient(c: any) {
    setClientSearch(c.name)
    setForm((f: any) => ({
      ...f,
      client_id: c.id, client_nom: c.name,
      client_adresse: c.adresse || c.address || '',
      client_cp: c.cp || '', client_ville: c.ville || '',
      client_email: c.contact_mail || c.email || '',
      client_siret: c.siret || '',
      client_contact_nom: `${c.contact_prenom || ''} ${c.contact_nom || ''}`.trim(),
      client_contact_tel: c.contact_tel || c.phone || '',
    }))
    setShowSuggestions(false)
  }

  function getTarifAuto(vehicle: string, client: string) {
    return tarifs.find(t => t.vehicle_type === vehicle && t.client_type === client) || null
  }

  function applyTarifAuto(vehicle: string, client: string, mode: string) {
    const t = getTarifAuto(vehicle, client)
    if (!t) return
    setForm((f: any) => ({
      ...f,
      tarif_km: mode === 'km' ? t.tarif_km : f.tarif_km,
      tarif_journee: mode !== 'km' ? t.tarif_journee : f.tarif_journee,
    }))
  }

  function calcMontantHT() {
    const { tarif_mode, tarif_km, distance_km, tarif_journee, nb_jours, frais_attente } = form
    if (tarif_mode === 'km') return (parseFloat(tarif_km) || 0) * (parseInt(distance_km) || 0) + (parseFloat(frais_attente) || 0)
    if (tarif_mode === 'journee') return (parseFloat(tarif_journee) || 0) + (parseFloat(frais_attente) || 0)
    if (tarif_mode === 'multi_jours') return (parseFloat(tarif_journee) || 0) * (parseInt(nb_jours) || 1) + (parseFloat(frais_attente) || 0)
    return 0
  }

  function calcTotaux() {
    const ht = calcMontantHT()
    const tva = ht * (form.tva_taux / 100)
    return { ht, tva, ttc: ht + tva }
  }

  function buildLignesAuto() {
    const { tarif_mode, tarif_km, distance_km, tarif_journee, nb_jours, frais_attente, vehicle_type, date_service } = form
    const dateStr = date_service ? new Date(date_service).toLocaleDateString('fr-FR') : ''
    const lignes = []
    if (tarif_mode === 'km') lignes.push({ description: `Transport ${vehicle_type} — ${distance_km || '?'} km${dateStr ? ' le ' + dateStr : ''}`, quantite: parseInt(distance_km) || 1, prix_unitaire: parseFloat(tarif_km) || 0 })
    else if (tarif_mode === 'journee') lignes.push({ description: `Forfait journée ${vehicle_type}${dateStr ? ' le ' + dateStr : ''}`, quantite: 1, prix_unitaire: parseFloat(tarif_journee) || 0 })
    else lignes.push({ description: `Forfait ${nb_jours} jour(s) ${vehicle_type}`, quantite: parseInt(nb_jours) || 1, prix_unitaire: parseFloat(tarif_journee) || 0 })
    if (parseFloat(frais_attente) > 0) lignes.push({ description: "Frais d'attente conducteur", quantite: 1, prix_unitaire: parseFloat(frais_attente) })
    return lignes
  }

  async function ensureClient(): Promise<string | null> {
    if (form.client_id) return form.client_id
    if (!form.client_nom) return null
    const { data: existing } = await supabase.from('clients').select('id').eq('company_id', COMPANY_ID).ilike('name', form.client_nom).maybeSingle()
    if (existing) return existing.id
    const newId = generateId()
    await supabase.from('clients').insert({
      id: newId, company_id: COMPANY_ID,
      name: form.client_nom, type: form.client_type,
      adresse: form.client_adresse, cp: form.client_cp, ville: form.client_ville,
      email: form.client_email, contact_mail: form.client_email,
      siret: form.client_siret,
      contact_nom: form.client_contact_nom?.split(' ').slice(1).join(' ') || '',
      contact_prenom: form.client_contact_nom?.split(' ')[0] || '',
      contact_tel: form.client_contact_tel, active: true,
    })
    return newId
  }

  const extraFields = () => ({
    destination: form.destination || null,
    origin: form.origin || null,
    passengers: parseInt(form.passengers) || null,
    vehicule_plaque: form.vehicule_plaque || null,
    vehicule_places: parseInt(form.vehicule_places) || null,
    heure_depart_garage: form.heure_depart_garage || null,
    heure_prise_charge: form.heure_prise_charge || null,
    heure_depart: form.heure_depart || null,
    heure_retour: form.heure_retour || null,
    heure_retour_garage: form.heure_retour_garage || null,
    lieu_prise_charge: form.lieu_prise_charge || null,
    lieu_depose: form.lieu_depose || null,
    conducteur_nom: form.conducteur_nom || null,
    conducteur_prenom: form.conducteur_prenom || null,
    assigned_driver: form.assigned_driver || null,
  })

  async function handleSave() {
    if (!form.client_nom) { setMessage('Nom client obligatoire'); return }
    setSaving(true); setMessage('')
    const { ht, tva, ttc } = calcTotaux()
    const lignes = buildLignesAuto()
    const clientId = await ensureClient()

    if (editId) {
      const { error } = await supabase.from('factures').update({
        client_id: clientId, client_nom: form.client_nom,
        client_adresse: form.client_adresse, client_cp: form.client_cp,
        client_ville: form.client_ville, client_email: form.client_email,
        client_siret: form.client_siret, client_type: form.client_type,
        date_facture: form.date_facture, date_service: form.date_service || null,
        date_echeance: form.date_echeance || null, tva_taux: form.tva_taux,
        tarif_mode: form.tarif_mode, tarif_km: form.tarif_km || null,
        tarif_journee: form.tarif_journee || null, nb_jours: form.nb_jours,
        distance_km: form.distance_km || null, frais_attente: form.frais_attente || 0,
        vehicle_type: form.vehicle_type, bc_reference: form.bc_reference || null,
        montant_ht: ht, montant_tva: tva, montant_ttc: ttc, lignes, notes: form.notes,
        ...extraFields(),
      }).eq('id', editId)
      // Mettre à jour aussi dans orders
      const facture = factures.find(f => f.id === editId)
      if (facture?.numero) {
        await supabase.from('orders').update({
          client_responsable: form.client_nom,
          destination: form.destination || null,
          origin: form.origin || null,
          date_service: form.date_service || null,
          passengers: parseInt(form.passengers) || null,
          vehicule_plaque: form.vehicule_plaque || null,
          heure_depart_garage: form.heure_depart_garage || null,
          heure_prise_charge: form.heure_prise_charge || null,
          heure_depart: form.heure_depart || null,
          heure_retour: form.heure_retour || null,
          heure_retour_garage: form.heure_retour_garage || null,
          lieu_prise_charge: form.lieu_prise_charge || null,
          lieu_depose: form.lieu_depose || null,
          conducteur_nom: form.conducteur_nom || null,
          conducteur_prenom: form.conducteur_prenom || null,
          assigned_driver: form.assigned_driver || null,
        }).eq('reference', facture.numero).eq('company_id', COMPANY_ID)
      }
      if (error) setMessage('Erreur : ' + error.message)
      else { setMessage('✅ Devis modifié'); setShowForm(false); setEditId(null); setForm(EMPTY_FORM); setClientSearch(''); loadAll() }
    } else {
      const numero = getNextNumero(factures, 'DEV')
      const { error } = await supabase.from('factures').insert({
        id: generateId(), company_id: COMPANY_ID,
        numero, type_document: 'devis', statut: 'devis',
        client_id: clientId, client_nom: form.client_nom,
        client_adresse: form.client_adresse, client_cp: form.client_cp,
        client_ville: form.client_ville, client_email: form.client_email,
        client_siret: form.client_siret, client_type: form.client_type,
        date_facture: form.date_facture, date_service: form.date_service || null,
        date_echeance: form.date_echeance || null, tva_taux: form.tva_taux,
        tarif_mode: form.tarif_mode, tarif_km: form.tarif_km || null,
        tarif_journee: form.tarif_journee || null, nb_jours: form.nb_jours,
        distance_km: form.distance_km || null, frais_attente: form.frais_attente || 0,
        vehicle_type: form.vehicle_type, bc_reference: form.bc_reference || null,
        montant_ht: ht, montant_tva: tva, montant_ttc: ttc, lignes, notes: form.notes,
        ...extraFields(),
      })
      if (error) setMessage('Erreur : ' + error.message)
      else {
        await supabase.from('orders').insert({
          company_id: COMPANY_ID,
          reference: numero,
          status: 'confirme',
          client_id: clientId,
          client_responsable: form.client_nom,
          client_adresse: form.client_adresse,
          client_cp_ville: `${form.client_cp} ${form.client_ville}`.trim(),
          client_tel: form.client_contact_tel,
          client_mail: form.client_email,
          destination: form.destination || '',
          origin: form.origin || '',
          date_service: form.date_service || null,
          date_retour: form.date_retour || null,
          passengers: parseInt(form.passengers) || null,
          vehicle_type: form.vehicle_type,
          distance_km: parseInt(form.distance_km) || null,
          price_ht: ht, tva: form.tva_taux, price_ttc: ttc,
          notes: form.notes,
          assigned_driver: form.assigned_driver || null,
          conducteur_nom: form.conducteur_nom,
          conducteur_prenom: form.conducteur_prenom,
          vehicule_plaque: form.vehicule_plaque,
          vehicule_places: parseInt(form.vehicule_places) || null,
          places_prevues: parseInt(form.places_prevues) || null,
          heure_depart_garage: form.heure_depart_garage,
          heure_prise_charge: form.heure_prise_charge,
          heure_depart: form.heure_depart,
          heure_retour: form.heure_retour,
          heure_retour_garage: form.heure_retour_garage,
          lieu_prise_charge: form.lieu_prise_charge,
          lieu_depose: form.lieu_depose,
        })
        setMessage('✅ Devis créé' + (clientId ? ' — fiche client enregistrée' : ''))
        setShowForm(false); setForm(EMPTY_FORM); setClientSearch(''); loadAll()
      }
    }
    setSaving(false)
  }

  function openEdit(doc: any) {
    setForm({
      type_document: 'devis',
      client_id: doc.client_id || '',
      client_nom: doc.client_nom || '',
      client_adresse: doc.client_adresse || '',
      client_cp: doc.client_cp || '',
      client_ville: doc.client_ville || '',
      client_email: doc.client_email || '',
      client_siret: doc.client_siret || '',
      client_type: doc.client_type || 'mairie',
      client_contact_nom: '', client_contact_tel: '',
      date_facture: doc.date_facture || '',
      date_service: doc.date_service || '',
      date_echeance: doc.date_echeance || '',
      tva_taux: doc.tva_taux || 10,
      tarif_mode: doc.tarif_mode || 'km',
      vehicle_type: doc.vehicle_type || 'autocar',
      distance_km: doc.distance_km || '',
      tarif_km: doc.tarif_km || '',
      tarif_journee: doc.tarif_journee || '',
      nb_jours: doc.nb_jours || 1,
      frais_attente: doc.frais_attente || 0,
      bc_reference: doc.bc_reference || '',
      notes: doc.notes || '',
      destination: doc.destination || '',
      origin: doc.origin || '',
      date_retour: '',
      passengers: doc.passengers || '',
      vehicule_plaque: doc.vehicule_plaque || '',
      vehicule_places: doc.vehicule_places || '',
      places_prevues: doc.places_prevues || '',
      heure_depart_garage: doc.heure_depart_garage || '',
      heure_prise_charge: doc.heure_prise_charge || '',
      heure_depart: doc.heure_depart || '',
      heure_retour: doc.heure_retour || '',
      heure_retour_garage: doc.heure_retour_garage || '',
      lieu_prise_charge: doc.lieu_prise_charge || '',
      lieu_depose: doc.lieu_depose || '',
      assigned_driver: doc.assigned_driver || '',
      conducteur_nom: doc.conducteur_nom || '',
      conducteur_prenom: doc.conducteur_prenom || '',
    })
    setClientSearch(doc.client_nom || '')
    setEditId(doc.id); setShowForm(true); setSelected(null)
  }

  function openDeleteModal(doc: any) {
    setDeleteTarget(doc); setDeletePassword(''); setDeleteError(''); setShowDeleteModal(true)
  }

  async function confirmDelete() {
    if (deletePassword !== DELETE_PASSWORD) { setDeleteError('Mot de passe incorrect'); return }
    await supabase.from('factures').delete().eq('id', deleteTarget.id)
    if (deleteTarget.numero) await supabase.from('orders').delete().eq('reference', deleteTarget.numero).eq('company_id', COMPANY_ID)
    setShowDeleteModal(false); setDeleteTarget(null); setSelected(null); loadAll()
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('factures').update({ statut }).eq('id', id)
    loadAll()
    if (selected?.id === id) setSelected((s: any) => ({ ...s, statut }))
  }

  async function marquerSigne(doc: any) {
    await supabase.from('factures').update({ statut: 'signe', devis_signe: true, devis_date_signature: new Date().toISOString().split('T')[0] }).eq('id', doc.id)
    await supabase.from('orders').update({ status: 'confirme' }).eq('reference', doc.numero).eq('company_id', COMPANY_ID)
    loadAll(); setSelected((s: any) => ({ ...s, statut: 'signe' }))
  }

  async function transformerEnFacture(doc: any) {
    if (!confirm('Transformer ce devis en facture ?')) return
    const numero = getNextNumero(factures, 'F')
    await supabase.from('factures').update({ type_document: 'facture', statut: 'emise', numero }).eq('id', doc.id)
    await supabase.from('orders').update({ status: 'confirme' }).eq('reference', doc.numero).eq('company_id', COMPANY_ID)
    loadAll(); setSelected(null)
  }

  async function marquerEnvoye(doc: any) {
    await supabase.from('factures').update({ statut: 'envoyee', envoi_mail_statut: 'envoye', envoi_mail_date: new Date().toISOString() }).eq('id', doc.id)
    loadAll(); setSelected((s: any) => ({ ...s, statut: 'envoyee' }))
  }

  async function affecterConducteur(factureId: string, ordreRef: string, driverId: string) {
    const driver = drivers.find(d => d.id === driverId)
    if (!driver) return
    const parts = driver.name.trim().split(' ')
    const nom = parts[0] || ''
    const prenom = parts.slice(1).join(' ') || ''
    await supabase.from('orders').update({ assigned_driver: driverId, conducteur_nom: nom, conducteur_prenom: prenom, status: 'affecte' }).eq('reference', ordreRef).eq('company_id', COMPANY_ID)
    loadAll()
  }

  async function loadOrderDocs(orderId: string) {
    const { data } = await supabase.from('module_documents').select('*').eq('entity_id', orderId).order('created_at', { ascending: false })
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
        await supabase.from('module_documents').insert({ company_id: COMPANY_ID, module: 'commercial', entity_id: selected.id, nom: file.name, categorie, url: urlData.publicUrl, taille: file.size })
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

  async function genererBC(order: any) {
    setGeneratingBC(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const W = 210, H = 297, m = 10

      function genPage(doc: any, order: any, pageNum: number) {
        doc.setDrawColor(0); doc.setLineWidth(0.3)
        doc.rect(m, m, W - m * 2, H - m * 2)
        doc.setFontSize(14); doc.setFont('helvetica', 'bold')
        doc.text('RGO MOBILITÉS JANZÉ', m + 3, m + 8)
        doc.setFontSize(8); doc.setFont('helvetica', 'normal')
        doc.text('57 Rue de Bain - 35150 Janzé', m + 3, m + 13)
        doc.text('Tél 02 99 47 42 42', m + 3, m + 17)
        doc.text('Email : exploitation.janze@rgom.fr', m + 3, m + 21)
        doc.text('SIRET 69920078800072', m + 3, m + 25)
        doc.text('www.rgo-mobilites.com', m + 3, m + 29)
        doc.line(W / 2, m, W / 2, m + 35)
        doc.setFontSize(14); doc.setFont('helvetica', 'bold')
        doc.text('BILLET COLLECTIF', W / 2 + 10, m + 12)
        doc.line(m, m + 35, W - m, m + 35)

        if (pageNum === 1) {
          doc.setFontSize(9); doc.setFont('helvetica', 'bold')
          doc.text('SERVICE OCCASIONNEL COLLECTIF DE TRANSPORT ROUTIER DE VOYAGEURS', W / 2, m + 40, { align: 'center' })
          doc.setFontSize(7); doc.setFont('helvetica', 'normal')
          doc.text("Billet collectif : Arrêté ministériel du 28/12/2011 // Ordre de mission : Arrêté ministériel du 28/12/2011", W / 2, m + 45, { align: 'center' })

          let y = m + 52
          doc.setFontSize(10); doc.setFont('helvetica', 'bold')
          doc.text(`COMMANDE : ${order.reference || order.numero || ''}`, m + 3, y)
          doc.setFontSize(9); doc.text('VEHICULE :', W / 2 + 3, y)
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
          doc.text(order.vehicule_plaque || order.vehicle_type || '—', W / 2 + 25, y)

          y += 6; doc.setFontSize(9); doc.setFont('helvetica', 'bold')
          doc.text('Conducteur :', m + 3, y); doc.setFont('helvetica', 'normal')
          doc.text((order.conducteur_nom || '').toUpperCase(), m + 28, y)
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
          doc.text(`Nb place dans le car :`, W / 2 + 3, y); doc.setFont('helvetica', 'bold')
          doc.text(`${order.vehicule_places || ''}`, W / 2 + 43, y)

          y += 5; doc.setFont('helvetica', 'normal')
          doc.text((order.conducteur_prenom || '').toUpperCase(), m + 28, y)
          doc.text(`Nb place prévus :`, W / 2 + 3, y); doc.setFont('helvetica', 'bold')
          doc.text(`${order.places_prevues || order.passengers || ''}`, W / 2 + 38, y)

          y += 5; doc.setFont('helvetica', 'normal')
          doc.text(`Réel :`, W / 2 + 3, y)
          doc.line(W / 2 + 14, y, W / 2 + 40, y)

          y += 5; doc.text(`Motif de déplacement :`, W / 2 + 3, y)
          doc.setFont('helvetica', 'bold'); doc.text(`Occasionnel`, W / 2 + 43, y)

          y += 5; doc.setFont('helvetica', 'italic')
          doc.text(`Prix selon facture - ${order.reference || order.numero || ''}`, W / 2 + 3, y)

          y += 8
          doc.setDrawColor(0, 100, 180); doc.setFillColor(200, 230, 255)
          doc.rect(m, y, W - m * 2, 6, 'F')
          doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 80, 160)
          doc.text(`Client : ${(order.client_nom || order.client_responsable || '').toUpperCase()}`, m + 3, y + 4)
          doc.setTextColor(0); doc.setDrawColor(0)

          y += 6
          doc.rect(m, y, (W - m * 2) / 2, 22)
          doc.rect(m + (W - m * 2) / 2, y, (W - m * 2) / 2, 22)
          doc.setFontSize(8); doc.setFont('helvetica', 'normal')
          doc.text(order.client_adresse || '', m + 3, y + 6)
          doc.text(order.client_cp_ville || `${order.client_cp || ''} ${order.client_ville || ''}`.trim(), m + 3, y + 11)
          doc.text('Responsable :', m + (W - m * 2) / 2 + 3, y + 6)
          doc.text(order.client_responsable || order.client_nom || '', m + (W - m * 2) / 2 + 28, y + 6)
          doc.text('Tel :', m + (W - m * 2) / 2 + 3, y + 11)
          doc.text(order.client_tel || order.client_contact_tel || '', m + (W - m * 2) / 2 + 14, y + 11)
          doc.text('Mail :', m + (W - m * 2) / 2 + 3, y + 16)
          doc.text(order.client_mail || order.client_email || '', m + (W - m * 2) / 2 + 14, y + 16)

          y += 26; doc.setFontSize(9); doc.setFont('helvetica', 'bold')
          doc.text('Destination et itinéraire : ', m + 3, y)
          doc.setTextColor(0, 100, 180)
          doc.text((order.destination || '').toUpperCase(), m + 45, y)
          doc.setTextColor(0)

          y += 6; doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
          const notes = order.notes || ''
          const lines = doc.splitTextToSize(notes, W - m * 2 - 6)
          doc.text(lines, m + 3, y)
          y += lines.length * 4 + 4

          const dateStr = order.date_service ? new Date(order.date_service).toLocaleDateString('fr-FR') : '—'
          const colW = (W - m * 2) / 2
          doc.setFillColor(100, 200, 220)
          doc.rect(m, y, colW, 7, 'F'); doc.rect(m + colW, y, colW, 7, 'F')
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
          doc.text('Départ', m + colW / 2, y + 5, { align: 'center' })
          doc.text('Départ', m + colW + colW / 2, y + 5, { align: 'center' })
          y += 7
          doc.setFillColor(100, 200, 220)
          doc.rect(m, y, colW, 6, 'F'); doc.rect(m + colW, y, colW, 6, 'F')
          doc.setFontSize(9)
          doc.text(dateStr, m + colW / 2, y + 4, { align: 'center' })
          doc.text(dateStr, m + colW + colW / 2, y + 4, { align: 'center' })
          y += 6
          doc.setFillColor(240, 240, 240)
          doc.rect(m, y, colW, 5, 'F'); doc.rect(m + colW, y, colW, 5, 'F')
          doc.setFontSize(7); doc.setFont('helvetica', 'normal')
          doc.text('Heure prévue', m + colW * 0.5, y + 3.5, { align: 'center' })
          doc.text('Heure réelle', m + colW * 0.85, y + 3.5, { align: 'center' })
          doc.text('Heure prévue', m + colW + colW * 0.5, y + 3.5, { align: 'center' })
          doc.text('Heure réelle', m + colW + colW * 0.85, y + 3.5, { align: 'center' })
          y += 5

          const horairesGauche = [['H de départ garage :', order.heure_depart_garage || ''], ['H de prise en charge :', order.heure_prise_charge || ''], ['H de départ :', order.heure_depart || '']]
          const horairesDroite = [['H de prise en charge :', ''], ['H de retour :', order.heure_retour || ''], ['H de retour garage :', order.heure_retour_garage || '']]
          horairesGauche.forEach(([label, val], idx) => {
            doc.setDrawColor(200); doc.rect(m, y, colW, 5); doc.rect(m + colW, y, colW, 5)
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setDrawColor(0)
            doc.text(label, m + 2, y + 3.5); doc.setFont('helvetica', 'bold')
            doc.text(val, m + colW * 0.5, y + 3.5, { align: 'center' })
            doc.setFont('helvetica', 'normal')
            doc.text(horairesDroite[idx][0], m + colW + 2, y + 3.5); doc.setFont('helvetica', 'bold')
            doc.text(horairesDroite[idx][1], m + colW + colW * 0.5, y + 3.5, { align: 'center' })
            y += 5
          })

          doc.setFontSize(7); doc.setFont('helvetica', 'normal')
          doc.rect(m, y, colW, 14); doc.rect(m + colW, y, colW, 14)
          doc.text('Lieu de prise en charge :', m + 2, y + 4); doc.setFont('helvetica', 'bold')
          doc.text(order.lieu_prise_charge || order.origin || '', m + 2, y + 8)
          doc.setFont('helvetica', 'normal')
          doc.text('Lieu de dépose terminale :', m + colW + 2, y + 4); doc.setFont('helvetica', 'bold')
          doc.text(order.lieu_depose || order.destination || '', m + colW + 2, y + 8)
          y += 14; y += 2

          doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setFillColor(100, 200, 220)
          doc.rect(m, y, 50, 5, 'F')
          doc.rect(m + 50, y, (W - m * 2 - 50) / 2, 5, 'F')
          doc.rect(m + 50 + (W - m * 2 - 50) / 2, y, (W - m * 2 - 50) / 2, 5, 'F')
          doc.text('Frais de route', m + 25, y + 3.5, { align: 'center' })
          doc.text('GARAGE', m + 50 + (W - m * 2 - 50) / 4, y + 3.5, { align: 'center' })
          doc.text('CLIENT', m + 50 + (W - m * 2 - 50) * 3 / 4, y + 3.5, { align: 'center' })
          y += 5

          const fraisKm = [['Autoroute','Km retour'],['Repas','Km départ'],['Hotels','Total'],['Frais divers','Km sortie FRONTIERE'],['','Km entrée FRONTIERE'],['','Total']]
          const colFrais = 50, colKm = (W - m * 2 - colFrais) / 2
          fraisKm.forEach(([frais, km]) => {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
            doc.rect(m, y, colFrais, 5); doc.rect(m + colFrais, y, colKm, 5)
            doc.rect(m + colFrais + colKm, y, colKm / 2, 5); doc.rect(m + colFrais + colKm + colKm / 2, y, colKm / 2, 5)
            doc.text(frais, m + 2, y + 3.5); doc.text(km, m + colFrais + 2, y + 3.5)
            y += 5
          })

          y += 3; doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
          doc.text("Observations de l'exploitation :", m + 3, y)
          y += 5; doc.rect(m, y, W - m * 2, 15)
        } else {
          let y = m + 40
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
          doc.text('Observations du CONDUCTEUR :', m + 3, y)
          doc.rect(m, y + 3, W - m * 2, H - m - y - 3)
        }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
        doc.text(`Page ${pageNum} sur 2 - Devis n° ${order.reference || order.numero || ''}`, W / 2, H - m - 3, { align: 'center' })
      }

      const orderData = orders.find(o => o.reference === selected?.numero) || {}
      const mergedData = { ...orderData, ...selected }
      genPage(doc, mergedData, 1)
      doc.addPage()
      genPage(doc, mergedData, 2)
      doc.save(`BC_${selected?.numero || 'billet'}_${new Date().toISOString().split('T')[0]}.pdf`)
    } catch(e) { console.error(e); alert('Erreur génération PDF') }
    setGeneratingBC(false)
  }

  const F = (v: any) => parseFloat(v || 0).toFixed(2)
  const { ht, tva, ttc } = calcTotaux()

  const filteredDocs = factures.filter(d => {
    const matchStatus = filterStatus === 'tous' || d.statut === filterStatus
    const matchSearch = !search || d.numero?.toLowerCase().includes(search.toLowerCase()) || d.client_nom?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const inp = (val: any, onChange: any, opts: any = {}) => (
    <input {...opts} value={val} onChange={onChange}
      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="commercial" />

      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '340px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#C62828', marginBottom: '8px' }}>🗑 Supprimer le document</div>
            <div style={{ fontSize: '12px', color: '#4A5568', marginBottom: '16px' }}>
              Vous allez supprimer <strong>{deleteTarget?.numero}</strong> — {deleteTarget?.client_nom}.<br />Cette action est irréversible.
            </div>
            <input type='password' placeholder='Mot de passe' value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeleteError('') }}
              onKeyDown={e => e.key === 'Enter' && confirmDelete()}
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${deleteError ? '#C62828' : '#D0D4DA'}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '6px' }}
              autoFocus />
            {deleteError && <div style={{ fontSize: '11px', color: '#C62828', marginBottom: '10px' }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={confirmDelete} style={{ flex: 1, background: '#C62828', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>Supprimer</button>
              <button onClick={() => setShowDeleteModal(false)} style={{ flex: 1, background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['tous', 'devis', 'signe', 'emise', 'envoyee', 'payee'] as const).map(k => {
            const count = k === 'tous' ? factures.length : factures.filter(d => d.statut === k).length
            if (k !== 'tous' && count === 0) return null
            const st = k === 'tous' ? { label: 'Tous', color: 'white', bg: 'transparent' } : (STATUTS_DOC[k] || STATUTS_DOC.devis)
            return (
              <button key={k} onClick={() => setFilterStatus(k)}
                style={{ background: filterStatus === k ? 'white' : 'transparent', color: filterStatus === k ? '#1A2130' : '#8A95A3', border: '1px solid', borderColor: filterStatus === k ? 'white' : '#4A5568', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '3px 12px', borderRadius: '10px', cursor: 'pointer' }}>
                {k === 'tous' ? `Tous (${count})` : `${st.label} (${count})`}
              </button>
            )
          })}
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setClientSearch(''); setEditId(null); setShowForm(true); setSelected(null) }}
          style={{ background: '#7B3FB5', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
          + Nouveau devis
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        <div style={{ width: '320px', minWidth: '320px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', borderBottom: '1px solid #F0F2F5' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher…"
              style={{ width: '100%', padding: '6px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>Chargement…</div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>💼</div>Aucun document
              </div>
            ) : filteredDocs.map(d => {
              const st = STATUTS_DOC[d.statut] || STATUTS_DOC.devis
              return (
                <div key={d.id} onClick={() => { setSelected(d); setShowForm(false); setEditId(null); loadOrderDocs(d.id) }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', borderLeft: `3px solid ${selected?.id === d.id ? '#7B3FB5' : 'transparent'}`, background: selected?.id === d.id ? '#F3E8FF' : 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>{d.numero}</div>
                    <span style={{ background: st.bg, color: st.color, fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '8px' }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#4A5568' }}>{d.client_nom}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                    <span style={{ fontSize: '10px', color: '#8A95A3' }}>{d.date_service ? new Date(d.date_service).toLocaleDateString('fr-FR') : new Date(d.date_facture).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E5AA7' }}>{F(d.montant_ttc)} €</span>
                  </div>
                  {d.bc_reference && <div style={{ fontSize: '9px', color: '#8A95A3', marginTop: '2px' }}>BC : {d.bc_reference}</div>}
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E6EA', background: '#F8F9FB' }}>
            {[
              ['Devis', factures.filter(d => d.type_document === 'devis').length + ' doc.', '#7B3FB5'],
              ['CA en cours', factures.filter(d => ['emise','envoyee'].includes(d.statut)).reduce((a, d) => a + parseFloat(d.montant_ttc || 0), 0).toFixed(0) + ' €', '#1565C0'],
              ['Encaissé', factures.filter(d => d.statut === 'payee').reduce((a, d) => a + parseFloat(d.montant_ttc || 0), 0).toFixed(0) + ' €', '#1A9E50'],
            ].map(([l, v, c]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                <span style={{ color: '#8A95A3' }}>{l}</span>
                <span style={{ fontWeight: '700', color: c }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>

          {showForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'white', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#7B3FB5' }}>{editId ? '✏️ Modifier le devis' : '📋 Nouveau devis'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>👤 Client</div>
                  <div style={{ marginBottom: '7px', position: 'relative' }} ref={clientRef}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Nom / Raison sociale *</label>
                    <input value={clientSearch} onChange={e => handleClientSearch(e.target.value)}
                      onFocus={() => clientSearch.length >= 2 && setShowSuggestions(true)}
                      placeholder='Tapez pour rechercher ou créer…'
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    {showSuggestions && clientSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,.12)', zIndex: 100, maxHeight: '180px', overflow: 'auto' }}>
                        {clientSuggestions.map(c => (
                          <div key={c.id} onClick={() => selectClient(c)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', fontSize: '11px' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F3E8FF')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                            <div style={{ fontWeight: '600', color: '#1A2130' }}>{c.name}</div>
                            <div style={{ color: '#8A95A3', fontSize: '10px' }}>{c.cp} {c.ville}</div>
                          </div>
                        ))}
                        <div style={{ padding: '8px 12px', fontSize: '10px', color: '#8A95A3', fontStyle: 'italic' }}>Client introuvable ? La fiche sera créée automatiquement.</div>
                      </div>
                    )}
                  </div>
                  {[['Adresse', 'client_adresse', 'text'], ['Code postal', 'client_cp', 'text'], ['Ville', 'client_ville', 'text'], ['Email', 'client_email', 'email'], ['SIRET', 'client_siret', 'text'], ['Contact (nom)', 'client_contact_nom', 'text'], ['Contact (tél)', 'client_contact_tel', 'text']].map(([label, key, type]) => (
                    <div key={key} style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      {inp(form[key], (e: any) => setForm((f: any) => ({ ...f, [key]: e.target.value })), { type })}
                    </div>
                  ))}
                  <div style={{ marginBottom: '7px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Type de client</label>
                    <select value={form.client_type} onChange={e => { setForm((f: any) => ({ ...f, client_type: e.target.value })); applyTarifAuto(form.vehicle_type, e.target.value, form.tarif_mode) }}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                      {TYPE_CLIENT.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                  </div>
                  <div style={{ marginBottom: '7px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Bon de commande client</label>
                    {inp(form.bc_reference, (e: any) => setForm((f: any) => ({ ...f, bc_reference: e.target.value })), { placeholder: 'ex: JA269845-2026' })}
                  </div>
                  {!form.client_id && clientSearch.length > 1 && (
                    <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: '6px', padding: '7px 10px', fontSize: '10px', color: '#D4720A' }}>
                      ℹ️ Nouveau client — fiche créée automatiquement à l'enregistrement.
                    </div>
                  )}
                  {form.client_id && (
                    <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '7px 10px', fontSize: '10px', color: '#1A9E50' }}>
                      ✅ Client existant sélectionné.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>🚌 Prestation</div>
                    <div style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Destination</label>
                      {inp(form.destination, (e: any) => setForm((f: any) => ({ ...f, destination: e.target.value })), { placeholder: 'Mont-Saint-Michel' })}
                    </div>
                    <div style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Lieu de départ</label>
                      {inp(form.origin, (e: any) => setForm((f: any) => ({ ...f, origin: e.target.value })), { placeholder: 'Janzé - Parking...' })}
                    </div>
                    <div style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Véhicule</label>
                      <select value={form.vehicle_type} onChange={e => { setForm((f: any) => ({ ...f, vehicle_type: e.target.value })); applyTarifAuto(e.target.value, form.client_type, form.tarif_mode) }}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                        {TYPE_VEHICULE.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Mode de tarification</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {TARIF_MODE.map(m => (
                          <button key={m.key} onClick={() => { setForm((f: any) => ({ ...f, tarif_mode: m.key })); applyTarifAuto(form.vehicle_type, form.client_type, m.key) }}
                            style={{ flex: 1, background: form.tarif_mode === m.key ? '#7B3FB5' : '#F8F9FB', color: form.tarif_mode === m.key ? 'white' : '#4A5568', border: '1px solid #D0D4DA', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '5px 4px', borderRadius: '5px', cursor: 'pointer' }}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {form.tarif_mode === 'km' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
                        <div><label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Distance (km)</label>{inp(form.distance_km, (e: any) => setForm((f: any) => ({ ...f, distance_km: e.target.value })), { type: 'number' })}</div>
                        <div><label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Tarif / km (€)</label>{inp(form.tarif_km, (e: any) => setForm((f: any) => ({ ...f, tarif_km: e.target.value })), { type: 'number', step: '0.0001' })}</div>
                      </div>
                    )}
                    {(form.tarif_mode === 'journee' || form.tarif_mode === 'multi_jours') && (
                      <div style={{ display: 'grid', gridTemplateColumns: form.tarif_mode === 'multi_jours' ? '1fr 1fr' : '1fr', gap: '7px', marginBottom: '7px' }}>
                        <div><label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Tarif journée (€)</label>{inp(form.tarif_journee, (e: any) => setForm((f: any) => ({ ...f, tarif_journee: e.target.value })), { type: 'number', step: '0.01' })}</div>
                        {form.tarif_mode === 'multi_jours' && <div><label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Nb jours</label>{inp(form.nb_jours, (e: any) => setForm((f: any) => ({ ...f, nb_jours: e.target.value })), { type: 'number', min: '1' })}</div>}
                      </div>
                    )}
                    <div style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Frais d'attente (€)</label>
                      {inp(form.frais_attente, (e: any) => setForm((f: any) => ({ ...f, frais_attente: e.target.value })), { type: 'number', step: '0.01' })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
                      <div><label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Date du service</label>{inp(form.date_service, (e: any) => setForm((f: any) => ({ ...f, date_service: e.target.value })), { type: 'date' })}</div>
                      <div><label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Passagers</label>{inp(form.passengers, (e: any) => setForm((f: any) => ({ ...f, passengers: e.target.value })), { type: 'number' })}</div>
                    </div>
                    <div style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>TVA</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        {TVA_TAUX.map(t => (
                          <button key={t} onClick={() => setForm((f: any) => ({ ...f, tva_taux: t }))}
                            style={{ flex: 1, background: form.tva_taux === t ? '#7B3FB5' : '#F8F9FB', color: form.tva_taux === t ? 'white' : '#4A5568', border: '1px solid #D0D4DA', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '5px', borderRadius: '5px', cursor: 'pointer' }}>
                            {t}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Notes / Itinéraire</label>
                      <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                    </div>
                  </div>

                  <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>🧑‍✈️ Conducteur & Véhicule</div>
                    <div style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Conducteur</label>
                      <select value={form.assigned_driver} onChange={e => {
                        const driver = drivers.find(d => d.id === e.target.value)
                        if (driver) {
                          const parts = driver.name.trim().split(' ')
                          setForm((f: any) => ({ ...f, assigned_driver: driver.id, conducteur_nom: parts[0] || '', conducteur_prenom: parts.slice(1).join(' ') || '' }))
                        } else {
                          setForm((f: any) => ({ ...f, assigned_driver: '', conducteur_nom: '', conducteur_prenom: '' }))
                        }
                      }} style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                        <option value=''>— Sélectionner un conducteur —</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
                      <div><label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Plaque véhicule</label>{inp(form.vehicule_plaque, (e: any) => setForm((f: any) => ({ ...f, vehicule_plaque: e.target.value })))}</div>
                      <div><label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Places car</label>{inp(form.vehicule_places, (e: any) => setForm((f: any) => ({ ...f, vehicule_places: e.target.value })), { type: 'number' })}</div>
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', margin: '8px 0 6px' }}>Horaires</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
                      {[['Départ garage', 'heure_depart_garage'], ['Prise en charge', 'heure_prise_charge'], ['Départ', 'heure_depart'], ['Retour', 'heure_retour'], ['Retour garage', 'heure_retour_garage']].map(([label, key]) => (
                        <div key={key}>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                          <input type='time' value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', margin: '8px 0 6px' }}>Lieux</div>
                    {[['Lieu de prise en charge', 'lieu_prise_charge'], ['Lieu de dépose terminale', 'lieu_depose']].map(([label, key]) => (
                      <div key={key} style={{ marginBottom: '7px' }}>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                        {inp(form[key], (e: any) => setForm((f: any) => ({ ...f, [key]: e.target.value })))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>💰 Récapitulatif</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '260px' }}>
                    {[['Total HT', ht.toFixed(2) + ' €', false], [`TVA ${form.tva_taux}%`, tva.toFixed(2) + ' €', false], ['Total TTC', ttc.toFixed(2) + ' €', true]].map(([l, v, b]) => (
                      <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0F2F5', fontSize: b ? '14px' : '11px', fontWeight: b ? '800' : '400' }}>
                        <span style={{ color: b ? '#1A2130' : '#4A5568' }}>{l as string}</span>
                        <span style={{ color: b ? '#7B3FB5' : '#1A2130' }}>{v as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 12px', borderRadius: '6px' }}>{message}</div>}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ background: saving ? '#8A95A3' : '#7B3FB5', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px 24px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Enregistrement…' : editId ? '💾 Enregistrer les modifications' : '💾 Créer le devis'}
                </button>
                <button onClick={() => { setShowForm(false); setEditId(null); setMessage('') }}
                  style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {selected && !showForm && (
            <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#1A2130' }}>📋 {selected.numero}</div>
                  <div style={{ fontSize: '11px', color: '#8A95A3', marginTop: '4px' }}>
                    {selected.date_service && `Service : ${new Date(selected.date_service).toLocaleDateString('fr-FR')}`}
                    {selected.bc_reference && ` — BC : ${selected.bc_reference}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {selected.statut === 'devis' && (
                    <button onClick={() => marquerSigne(selected)}
                      style={{ background: '#FFF3E0', color: '#D4720A', border: '1px solid #FFB74D', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      ✍ Marquer signé
                    </button>
                  )}
                  {selected.statut === 'signe' && (
                    <button onClick={() => transformerEnFacture(selected)}
                      style={{ background: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      🧾 Transformer en facture
                    </button>
                  )}
                  {selected.statut === 'emise' && (
                    <button onClick={() => marquerEnvoye(selected)}
                      style={{ background: '#E8F5E9', color: '#1A9E50', border: '1px solid #A5D6A7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      ✉ Marquer envoyée
                    </button>
                  )}
                  {selected.statut === 'envoyee' && (
                    <button onClick={() => updateStatut(selected.id, 'payee')}
                      style={{ background: '#E8F5E9', color: '#1A9E50', border: '1px solid #A5D6A7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      💶 Marquer payée
                    </button>
                  )}
                  <button onClick={() => openEdit(selected)}
                    style={{ background: '#F3E8FF', color: '#7B3FB5', border: '1px solid #CE93D8', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                    ✏️ Modifier
                  </button>
                  <button onClick={() => openDeleteModal(selected)}
                    style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                    🗑 Supprimer
                  </button>
                  <span style={{ background: (STATUTS_DOC[selected.statut] || STATUTS_DOC.devis).bg, color: (STATUTS_DOC[selected.statut] || STATUTS_DOC.devis).color, fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                    {(STATUTS_DOC[selected.statut] || STATUTS_DOC.devis).label}
                  </span>
                </div>
              </div>

              {(() => {
                const order = orders.find(o => o.reference === selected.numero)
                return order ? (
                  <div style={{ background: '#F3E8FF', border: '1px solid #CE93D8', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#7B3FB5', marginBottom: '8px' }}>🧑‍✈️ Affectation conducteur</div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <select defaultValue={order.assigned_driver || ''} onChange={e => affecterConducteur(selected.id, selected.numero, e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', border: '1px solid #CE93D8', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                        <option value=''>— Sélectionner un conducteur —</option>
                        {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      {order.conducteur_nom && (
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#7B3FB5' }}>
                          ✓ {order.conducteur_nom} {order.conducteur_prenom}
                        </span>
                      )}
                    </div>
                  </div>
                ) : null
              })()}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {[
                  ['Client', [selected.client_nom, selected.client_adresse, `${selected.client_cp || ''} ${selected.client_ville || ''}`.trim(), selected.client_email].filter(Boolean)],
                  ['Prestation', [
                    `Véhicule : ${selected.vehicle_type || '—'}`,
                    selected.destination ? `Destination : ${selected.destination}` : null,
                    `Distance : ${selected.distance_km ? selected.distance_km + ' km' : '—'}`,
                    `Date : ${selected.date_service ? new Date(selected.date_service).toLocaleDateString('fr-FR') : '—'}`,
                    `Passagers : ${selected.passengers || '—'}`,
                    selected.heure_depart_garage ? `Départ garage : ${selected.heure_depart_garage}` : null,
                    selected.heure_prise_charge ? `Prise en charge : ${selected.heure_prise_charge}` : null,
                    selected.heure_retour ? `Retour : ${selected.heure_retour}` : null,
                  ].filter(Boolean)],
                ].map(([title, lines]: any) => (
                  <div key={title} style={{ background: '#F8F9FB', borderRadius: '8px', padding: '12px 14px', fontSize: '11px' }}>
                    <div style={{ fontWeight: '700', color: '#1A2130', marginBottom: '6px' }}>{title}</div>
                    {lines.map((l: string, i: number) => <div key={i} style={{ color: i === 0 ? '#1A2130' : '#4A5568', fontWeight: i === 0 ? '600' : '400', lineHeight: '1.8' }}>{l}</div>)}
                  </div>
                ))}
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: '#1A2130', color: 'white' }}>
                    {['Description', 'Qté', 'P.U. HT', 'Total HT'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(selected.lignes || []).map((l: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F0F2F5', background: idx % 2 === 0 ? 'white' : '#FAFBFC' }}>
                      <td style={{ padding: '10px 14px', color: '#1A2130' }}>{l.description}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#4A5568' }}>{l.quantite}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#4A5568' }}>{F(l.prix_unitaire)} €</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#7B3FB5' }}>{F(l.quantite * l.prix_unitaire)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ width: '260px', background: '#F8F9FB', borderRadius: '8px', padding: '12px 14px' }}>
                  {[['Total HT', F(selected.montant_ht) + ' €', false], [`TVA ${selected.tva_taux}%`, F(selected.montant_tva) + ' €', false], ['Total TTC', F(selected.montant_ttc) + ' €', true]].map(([l, v, b]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: b ? '14px' : '11px', fontWeight: b ? '800' : '400', borderBottom: b ? 'none' : '1px solid #E2E6EA' }}>
                      <span style={{ color: b ? '#1A2130' : '#4A5568' }}>{l as string}</span>
                      <span style={{ color: b ? '#7B3FB5' : '#1A2130' }}>{v as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selected.notes && (
                <div style={{ background: '#FFF8E1', borderRadius: '8px', padding: '10px 14px', fontSize: '11px', color: '#4A5568', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', color: '#1A2130', marginBottom: '4px' }}>Notes / Itinéraire</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
                </div>
              )}

              <div style={{ borderTop: '1px solid #E2E6EA', paddingTop: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>📎 Documents</div>
                {DOC_CATS.map(cat => {
                  const catDocs = orderDocs.filter((d: any) => d.categorie === cat.key)
                  return (
                    <div key={cat.key} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: '#8A95A3' }}>{cat.label}</div>
                        <label style={{ background: uploadingDoc ? '#8A95A3' : '#F3E8FF', color: '#7B3FB5', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', cursor: uploadingDoc ? 'not-allowed' : 'pointer' }}>
                          {uploadingDoc ? '⏳' : '+ Ajouter'}
                          <input type='file' accept='.pdf,.jpg,.jpeg,.png' style={{ display: 'none' }} disabled={uploadingDoc}
                            onChange={e => { if (e.target.files?.[0]) uploadOrderDoc(e.target.files[0], cat.key) }} />
                        </label>
                      </div>
                      {catDocs.length === 0 ? (
                        <div style={{ fontSize: '10px', color: '#8A95A3', padding: '5px 8px', background: '#F8F9FB', borderRadius: '4px' }}>Aucun document</div>
                      ) : catDocs.map((doc: any) => (
                        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', background: 'white', border: '1px solid #E2E6EA', borderRadius: '4px', marginBottom: '3px' }}>
                          <span>{doc.nom?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                          <a href={doc.url} target='_blank' rel='noreferrer'
                            style={{ flex: 1, fontSize: '11px', fontWeight: '600', color: '#7B3FB5', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.nom}
                          </a>
                          <button onClick={() => deleteOrderDoc(doc)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>

              <button onClick={() => genererBC(selected)} disabled={generatingBC}
                style={{ background: generatingBC ? '#8A95A3' : '#253044', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px 24px', borderRadius: '6px', cursor: generatingBC ? 'not-allowed' : 'pointer' }}>
                {generatingBC ? '⏳ Génération…' : '📄 Générer BC PDF'}
              </button>
            </div>
          )}

          {!selected && !showForm && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '10px', color: '#8A95A3' }}>
              <div style={{ fontSize: '48px', opacity: .2 }}>💼</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Sélectionnez un devis ou créez-en un</div>
              <button onClick={() => { setForm(EMPTY_FORM); setClientSearch(''); setEditId(null); setShowForm(true) }}
                style={{ background: '#7B3FB5', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', marginTop: '6px' }}>
                + Nouveau devis
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        {[
          [factures.length, 'Total'],
          [factures.filter(d => d.statut === 'devis').length, 'Devis'],
          [factures.filter(d => d.statut === 'signe').length, 'Signés'],
          [factures.filter(d => ['emise','envoyee'].includes(d.statut)).reduce((a, d) => a + parseFloat(d.montant_ttc || 0), 0).toFixed(0) + ' €', 'CA en cours'],
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
