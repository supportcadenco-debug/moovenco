'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { COMPANY_ID, DELETE_PASSWORD, RGO, TVA_TAUX, TYPE_VEHICULE, TYPE_CLIENT, TARIF_MODE, STATUTS_DOC, EMPTY_FORM_DEVIS } from '@/lib/constants'
import { generateId, getNextNumero, calcMontantHT, calcTotaux, buildLignesAuto, ensureClient, getTarifAuto, formatMontant } from '@/lib/utils'
import { telechargerPDF, getPDFBase64 } from '@/lib/pdf'

const EMPTY_FORM = EMPTY_FORM_DEVIS

export default function Factures() {
  const [docs, setDocs] = useState<any[]>([])
  const [tarifs, setTarifs] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterType, setFilterType] = useState<'tous' | 'devis' | 'facture'>('tous')

  // Autocomplete client
  const [clientSearch, setClientSearch] = useState('')
  const [clientSuggestions, setClientSuggestions] = useState<any[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const clientRef = useRef<HTMLDivElement>(null)

  // Suppression protégée
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [envoyant, setEnvoyant] = useState(false)

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadAll() {
    const [{ data: f }, { data: t }, { data: o }, { data: c }] = await Promise.all([
      supabase.from('factures').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
      supabase.from('tarifs').select('*').eq('company_id', COMPANY_ID).eq('actif', true),
      supabase.from('orders').select('*').eq('company_id', COMPANY_ID).in('status', ['confirme', 'affecte', 'termine']),
      supabase.from('clients').select('*').eq('company_id', COMPANY_ID).eq('active', true).order('name'),
    ])
    setDocs(f || [])
    setTarifs(t || [])
    setOrders(o || [])
    setClients(c || [])
    setLoading(false)
  }

  // --- Autocomplete client ---
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
      client_id: c.id,
      client_nom: c.name,
      client_adresse: c.adresse || c.address || '',
      client_cp: c.cp || '',
      client_ville: c.ville || '',
      client_email: c.contact_mail || c.email || '',
      client_siret: c.siret || '',
      client_contact_nom: `${c.contact_prenom || ''} ${c.contact_nom || ''}`.trim(),
      client_contact_tel: c.contact_tel || c.phone || '',
    }))
    setShowSuggestions(false)
  }

  // --- Tarif auto ---
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

  function calcTotauxForm() { return calcTotaux(form) }

  // ensureClient importé depuis @/lib/utils

  async function handleSave() {
    if (!form.client_nom) { setMessage('Nom client obligatoire'); return }
    setSaving(true)
    setMessage('')
    const { ht, tva, ttc } = calcTotauxForm()
    const lignes = buildLignesAuto(form)
    const clientId = await ensureClient(form)
    const isDevis = form.type_document === 'devis'

    if (editId) {
      // MODIFICATION
      const { error } = await supabase.from('factures').update({
        client_id: clientId,
        client_nom: form.client_nom,
        client_adresse: form.client_adresse,
        client_cp: form.client_cp,
        client_ville: form.client_ville,
        client_email: form.client_email,
        client_siret: form.client_siret,
        client_type: form.client_type,
        date_facture: form.date_facture,
        date_service: form.date_service || null,
        date_echeance: form.date_echeance || null,
        tva_taux: form.tva_taux,
        tarif_mode: form.tarif_mode,
        tarif_km: form.tarif_km || null,
        tarif_journee: form.tarif_journee || null,
        nb_jours: form.nb_jours,
        distance_km: form.distance_km || null,
        frais_attente: form.frais_attente || 0,
        vehicle_type: form.vehicle_type,
        bc_reference: form.bc_reference || null,
        montant_ht: ht, montant_tva: tva, montant_ttc: ttc,
        lignes, notes: form.notes,
        retour_km_reel: form.retour_km_reel || null,
        retour_vehicule_reel: form.retour_vehicule_reel || null,
        retour_heure_dep_reel: form.retour_heure_dep_reel || null,
        retour_heure_ret_reel: form.retour_heure_ret_reel || null,
        inclure_retour_pdf: form.inclure_retour_pdf || false,
        updated_at: new Date().toISOString(),
      }).eq('id', editId)
      if (error) setMessage('Erreur : ' + error.message)
      else { setMessage('✅ Devis modifié'); setShowForm(false); setEditId(null); setForm(EMPTY_FORM); loadAll() }
    } else {
      // CRÉATION
      const prefix = isDevis ? 'DEV' : 'F'
      const numero = getNextNumero(docs, prefix)
      const { error } = await supabase.from('factures').insert({
        id: generateId(), company_id: COMPANY_ID,
        numero, type_document: form.type_document,
        statut: isDevis ? 'devis' : 'emise',
        client_id: clientId,
        client_nom: form.client_nom, client_adresse: form.client_adresse,
        client_cp: form.client_cp, client_ville: form.client_ville,
        client_email: form.client_email, client_siret: form.client_siret,
        client_type: form.client_type,
        date_facture: form.date_facture,
        date_service: form.date_service || null,
        date_echeance: form.date_echeance || null,
        tva_taux: form.tva_taux, tarif_mode: form.tarif_mode,
        tarif_km: form.tarif_km || null, tarif_journee: form.tarif_journee || null,
        nb_jours: form.nb_jours, distance_km: form.distance_km || null,
        frais_attente: form.frais_attente || 0,
        vehicle_type: form.vehicle_type,
        bc_reference: form.bc_reference || null,
        montant_ht: ht, montant_tva: tva, montant_ttc: ttc,
        lignes, notes: form.notes,
        retour_km_reel: form.retour_km_reel || null,
        retour_vehicule_reel: form.retour_vehicule_reel || null,
        retour_heure_dep_reel: form.retour_heure_dep_reel || null,
        retour_heure_ret_reel: form.retour_heure_ret_reel || null,
        inclure_retour_pdf: form.inclure_retour_pdf || false,
      })
      if (error) setMessage('Erreur : ' + error.message)
      else {
        setMessage(isDevis ? '✅ Devis créé' + (clientId ? ' — fiche client enregistrée' : '') : '✅ Facture créée')
        setShowForm(false); setForm(EMPTY_FORM); setClientSearch(''); loadAll()
      }
    }
    setSaving(false)
  }

  function openEdit(doc: any) {
    setForm({
      type_document: doc.type_document || 'devis',
      client_id: doc.client_id || '',
      client_nom: doc.client_nom || '',
      client_adresse: doc.client_adresse || '',
      client_cp: doc.client_cp || '',
      client_ville: doc.client_ville || '',
      client_email: doc.client_email || '',
      client_siret: doc.client_siret || '',
      client_type: doc.client_type || 'mairie',
      client_contact_nom: '',
      client_contact_tel: '',
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
      retour_km_reel: doc.retour_km_reel || null,
      retour_vehicule_reel: doc.retour_vehicule_reel || '',
      retour_heure_dep_reel: doc.retour_heure_dep_reel || '',
      retour_heure_ret_reel: doc.retour_heure_ret_reel || '',
      inclure_retour_pdf: doc.inclure_retour_pdf || false,
    })
    setClientSearch(doc.client_nom || '')
    setEditId(doc.id)
    setShowForm(true)
    setSelected(null)
  }

  function openDeleteModal(doc: any) {
    setDeleteTarget(doc)
    setDeletePassword('')
    setDeleteError('')
    setShowDeleteModal(true)
  }

  async function confirmDelete() {
    if (deletePassword !== DELETE_PASSWORD) { setDeleteError('Mot de passe incorrect'); return }
    await supabase.from('factures').delete().eq('id', deleteTarget.id)
    setShowDeleteModal(false)
    setDeleteTarget(null)
    setSelected(null)
    loadAll()
  }


  // genererPDF remplacé par telechargerPDF/getPDFBase64 depuis @/lib/pdf

  async function updateStatut(id: string, statut: string) {

    await supabase.from('factures').update({ statut }).eq('id', id)
    loadAll()
    if (selected?.id === id) setSelected((s: any) => ({ ...s, statut }))
  }

  async function transformerEnFacture(doc: any) {
    if (!confirm('Transformer ce devis en facture ?')) return
    const numero = getNextNumero(docs, 'F')
    await supabase.from('factures').update({ type_document: 'facture', statut: 'emise', numero }).eq('id', doc.id)
    loadAll(); setSelected(null)
  }

  async function marquerSigne(doc: any) {
    await supabase.from('factures').update({ statut: 'signe', devis_signe: true, devis_date_signature: new Date().toISOString().split('T')[0] }).eq('id', doc.id)
    loadAll(); setSelected((s: any) => ({ ...s, statut: 'signe' }))
  }


  async function envoyerParMail(doc: any) {
    if (!doc.client_email) {
      alert('Aucun email client renseigné pour ce document.')
      return
    }
    setEnvoyant(true)
    try {
      const isDevis = doc.type_document === 'devis'
      const Fmt = formatMontant
      // Générer le PDF en base64
      const { base64: pdfBase64, filename: pdfName } = await getPDFBase64(doc)
      // PDF généré via @/lib/pdf

      // Corps de l'email
      const subject = isDevis
        ? `Devis ${doc.numero} — RGO Mobilités Janzé`
        : `Facture ${doc.numero} — RGO Mobilités Janzé`

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1A2130; padding: 20px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">RGO<span style="color: #2EC971;">Mobilités</span></h1>
            <p style="color: #8A95A3; margin: 4px 0 0; font-size: 12px;">SAS RGO Mobilités Janzé — 57 rue de Bain, 35150 Janzé</p>
          </div>
          <div style="background: #F8F9FB; padding: 24px; border: 1px solid #E2E6EA; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="color: #1A2130; font-size: 14px;">Bonjour,</p>
            <p style="color: #4A5568; font-size: 13px; line-height: 1.6;">
              Veuillez trouver ci-joint ${isDevis ? 'votre devis' : 'votre facture'} <strong>${doc.numero}</strong>
              ${doc.date_service ? ` pour la prestation du <strong>${new Date(doc.date_service).toLocaleDateString('fr-FR')}</strong>` : ''}.
            </p>
            <div style="background: white; border: 1px solid #E2E6EA; border-radius: 6px; padding: 16px; margin: 16px 0;">
              <table style="width: 100%; font-size: 13px; color: #4A5568;">
                <tr><td style="padding: 4px 0; color: #8A95A3;">Numéro</td><td style="font-weight: bold; color: #1A2130;">${doc.numero}</td></tr>
                <tr><td style="padding: 4px 0; color: #8A95A3;">Date</td><td>${new Date(doc.date_facture).toLocaleDateString('fr-FR')}</td></tr>
                ${doc.date_echeance ? `<tr><td style="padding: 4px 0; color: #8A95A3;">Échéance</td><td>${new Date(doc.date_echeance).toLocaleDateString('fr-FR')}</td></tr>` : ''}
                <tr><td style="padding: 4px 0; color: #8A95A3;">Montant HT</td><td>${Fmt(doc.montant_ht)} €</td></tr>
                <tr><td style="padding: 4px 0; color: #8A95A3;">TVA ${doc.tva_taux}%</td><td>${Fmt(doc.montant_tva)} €</td></tr>
                <tr><td style="padding: 4px 0; color: #1A2130; font-weight: bold;">Total TTC</td><td style="font-weight: bold; color: #0E5AA7; font-size: 16px;">${Fmt(doc.montant_ttc)} €</td></tr>
              </table>
            </div>
            ${isDevis ? '<p style="color: #4A5568; font-size: 12px; font-style: italic;">Ce devis est valable 30 jours. Pour l&apos;accepter, veuillez nous retourner le document signé avec la mention "Bon pour accord".</p>' : ''}
            <p style="color: #4A5568; font-size: 13px;">Pour tout renseignement, contactez-nous :<br>
              📞 ${RGO.tel}<br>
              📧 ${RGO.email}
            </p>
            <p style="color: #4A5568; font-size: 13px;">Cordialement,<br><strong>RGO Mobilités Janzé</strong></p>
          </div>
          <p style="color: #8A95A3; font-size: 10px; text-align: center; margin-top: 12px;">
            ${RGO.nom} — SIRET ${RGO.siret} — TVA ${RGO.tva_num}<br>
            Règlement par virement : IBAN ${RGO.rib}
          </p>
        </div>
      `

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: doc.client_email, subject, html, pdfBase64, pdfName })
      })
      const result = await res.json()
      if (result.success) {
        await marquerEnvoye(doc)
        setMessage('✅ Email envoyé à ' + doc.client_email)
      } else {
        setMessage('❌ Erreur envoi : ' + (result.error?.message || 'Erreur inconnue'))
      }
    } catch (e: any) {
      setMessage('❌ Erreur : ' + e.message)
    }
    setEnvoyant(false)
  }

  async function marquerEnvoye(doc: any) {
    await supabase.from('factures').update({ statut: 'envoyee', envoi_mail_statut: 'envoye', envoi_mail_date: new Date().toISOString() }).eq('id', doc.id)
    loadAll(); setSelected((s: any) => ({ ...s, statut: 'envoyee' }))
  }

  const { ht, tva, ttc } = calcTotauxForm()
  const filteredDocs = docs.filter(d => filterType === 'tous' ? true : filterType === 'devis' ? d.type_document === 'devis' : d.type_document === 'facture')
  const F = formatMontant

  const inp = (val: any, onChange: any, opts: any = {}) => (
    <input {...opts} value={val} onChange={onChange}
      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* MODAL SUPPRESSION */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '340px', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#C62828', marginBottom: '8px' }}>🗑 Supprimer le document</div>
            <div style={{ fontSize: '12px', color: '#4A5568', marginBottom: '16px' }}>
              Vous allez supprimer <strong>{deleteTarget?.numero}</strong> — {deleteTarget?.client_nom}.<br />
              Cette action est irréversible. Saisissez le mot de passe pour confirmer.
            </div>
            <input
              type='password'
              placeholder='Mot de passe'
              value={deletePassword}
              onChange={e => { setDeletePassword(e.target.value); setDeleteError('') }}
              onKeyDown={e => e.key === 'Enter' && confirmDelete()}
              style={{ width: '100%', padding: '8px 10px', border: `1px solid ${deleteError ? '#C62828' : '#D0D4DA'}`, borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '6px' }}
              autoFocus
            />
            {deleteError && <div style={{ fontSize: '11px', color: '#C62828', marginBottom: '10px' }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button onClick={confirmDelete}
                style={{ flex: 1, background: '#C62828', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                Supprimer
              </button>
              <button onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARRE ACTION */}
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['tous', 'devis', 'facture'] as const).map(k => (
            <button key={k} onClick={() => setFilterType(k)}
              style={{ background: filterType === k ? 'white' : 'transparent', color: filterType === k ? '#1A2130' : '#8A95A3', border: '1px solid', borderColor: filterType === k ? 'white' : '#4A5568', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '3px 12px', borderRadius: '10px', cursor: 'pointer' }}>
              {k === 'tous' ? 'Tous' : k === 'devis' ? 'Devis' : 'Factures'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setForm({ ...EMPTY_FORM, type_document: 'devis' }); setClientSearch(''); setEditId(null); setShowForm(true); setSelected(null) }}
            style={{ background: '#7B3FB5', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
            + Nouveau devis
          </button>
          <button onClick={() => { setForm({ ...EMPTY_FORM, type_document: 'facture' }); setClientSearch(''); setEditId(null); setShowForm(true); setSelected(null) }}
            style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
            + Nouvelle facture
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LISTE */}
        <div style={{ width: '280px', minWidth: '280px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#8A95A3', borderBottom: '1px solid #F0F2F5' }}>
            {filteredDocs.length} document{filteredDocs.length > 1 ? 's' : ''}
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>Chargement…</div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🧾</div>Aucun document
              </div>
            ) : filteredDocs.map(d => {
              const st = STATUTS_DOC[d.statut] || STATUTS_DOC.emise
              return (
                <div key={d.id} onClick={() => { setSelected(d); setShowForm(false); setEditId(null) }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', borderLeft: `3px solid ${selected?.id === d.id ? '#0E5AA7' : 'transparent'}`, background: selected?.id === d.id ? '#E8F0FB' : 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>{d.numero}</div>
                    <span style={{ background: st.bg, color: st.color, fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '8px' }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#4A5568' }}>{d.client_nom}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                    <span style={{ fontSize: '10px', color: '#8A95A3' }}>{new Date(d.date_facture).toLocaleDateString('fr-FR')}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E5AA7' }}>{F(d.montant_ttc)} €</span>
                  </div>
                  {d.envoi_mail_statut === 'envoye' && <div style={{ fontSize: '9px', color: '#1A9E50', marginTop: '2px' }}>✉ Envoyé par mail</div>}
                </div>
              )
            })}
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E6EA', background: '#F8F9FB' }}>
            {[
              ['Devis en cours', docs.filter(d => d.type_document === 'devis').length + ' doc.', '#7B3FB5'],
              ['Factures émises', docs.filter(d => d.type_document === 'facture' && d.statut === 'emise').reduce((a, d) => a + parseFloat(d.montant_ttc || 0), 0).toFixed(2) + ' €', '#1565C0'],
              ['Encaissé', docs.filter(d => d.statut === 'payee').reduce((a, d) => a + parseFloat(d.montant_ttc || 0), 0).toFixed(2) + ' €', '#1A9E50'],
            ].map(([label, val, color]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                <span style={{ color: '#8A95A3' }}>{label}</span>
                <span style={{ fontWeight: '700', color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ZONE PRINCIPALE */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>

          {/* FORMULAIRE */}
          {showForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Type + pré-remplir */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>{editId ? '✏️ Modification' : 'Type :'}</span>
                {!editId && [['devis', '📋 Devis', '#7B3FB5'], ['facture', '🧾 Facture', '#0E5AA7']].map(([k, l, c]) => (
                  <button key={k} onClick={() => setForm((f: any) => ({ ...f, type_document: k }))}
                    style={{ background: form.type_document === k ? c : '#F8F9FB', color: form.type_document === k ? 'white' : '#4A5568', border: `1px solid ${form.type_document === k ? c : '#D0D4DA'}`, fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '5px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
                {orders.length > 0 && !editId && (
                  <select onChange={e => {
                      const o = orders.find((x: any) => x.id === e.target.value)
                      if (!o) return
                      const t = getTarifAuto(o.vehicle_type || 'autocar', 'mairie')
                      // Si un retour BC a été validé, on utilise le VRAI kilométrage
                      // (retour_km_ret_garage - retour_km_dep_garage) plutôt que l'estimation du devis.
                      const hasRetour = !!o.retour_recu_at
                      const kmReel = (o.retour_km_ret_garage != null && o.retour_km_dep_garage != null)
                        ? (o.retour_km_ret_garage - o.retour_km_dep_garage)
                        : null
                      const distanceFinale = kmReel != null ? kmReel : (o.distance_km || '')
                      setForm((f: any) => ({
                        ...f,
                        client_nom: o.client_responsable || '', client_adresse: o.client_adresse || '', client_email: o.client_mail || '',
                        vehicle_type: o.vehicle_type || 'autocar', date_service: o.date_service || '', bc_reference: o.bon_commande_ref || '',
                        distance_km: distanceFinale,
                        tarif_km: t?.tarif_km || '', tarif_journee: t?.tarif_journee || '',
                        notes: `Réf. : ${o.reference}` + (kmReel != null ? ` — km réel retour BC (${o.retour_km_dep_garage} → ${o.retour_km_ret_garage})` : ''),
                        // Infos retour BC reportées sur la facture (si disponibles)
                        retour_km_reel: kmReel,
                        retour_vehicule_reel: o.retour_vehicule_reel || '',
                        retour_heure_dep_reel: o.retour_heure_dep_client || '',
                        retour_heure_ret_reel: o.retour_heure_ret_client || '',
                        inclure_retour_pdf: hasRetour, // coché par défaut si un retour existe, modifiable
                      }))
                      setClientSearch(o.client_responsable || '')
                    }}
                    style={{ marginLeft: 'auto', padding: '5px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', color: '#4A5568' }}>
                    <option value=''>⚡ Pré-remplir depuis une commande…</option>
                    {orders.map((o: any) => <option key={o.id} value={o.id}>{o.reference} — {o.destination || '?'}</option>)}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                {/* CLIENT */}
                <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>👤 Client</div>

                  {/* Autocomplete */}
                  <div style={{ marginBottom: '7px', position: 'relative' }} ref={clientRef}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Nom / Raison sociale *</label>
                    <input value={clientSearch} onChange={e => handleClientSearch(e.target.value)}
                      onFocus={() => clientSearch.length >= 2 && setShowSuggestions(true)}
                      placeholder='Tapez pour rechercher ou saisir un nouveau client…'
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    {showSuggestions && clientSuggestions.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,.12)', zIndex: 100, maxHeight: '180px', overflow: 'auto' }}>
                        {clientSuggestions.map(c => (
                          <div key={c.id} onClick={() => selectClient(c)}
                            style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', fontSize: '11px' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#E8F0FB')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                            <div style={{ fontWeight: '600', color: '#1A2130' }}>{c.name}</div>
                            <div style={{ color: '#8A95A3', fontSize: '10px' }}>{c.cp} {c.ville} {c.contact_mail ? '— ' + c.contact_mail : ''}</div>
                          </div>
                        ))}
                        <div style={{ padding: '8px 12px', fontSize: '10px', color: '#8A95A3', fontStyle: 'italic' }}>
                          Client introuvable ? Continuez la saisie — la fiche sera créée automatiquement.
                        </div>
                      </div>
                    )}
                  </div>

                  {[
                    ['Adresse', 'client_adresse', 'text'],
                    ['Code postal', 'client_cp', 'text'],
                    ['Ville', 'client_ville', 'text'],
                    ['Email', 'client_email', 'email'],
                    ['SIRET', 'client_siret', 'text'],
                    ['Contact (nom)', 'client_contact_nom', 'text'],
                    ['Contact (tél)', 'client_contact_tel', 'text'],
                  ].map(([label, key, type]) => (
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

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Bon de commande client</label>
                    {inp(form.bc_reference, (e: any) => setForm((f: any) => ({ ...f, bc_reference: e.target.value })), { placeholder: 'ex: JA269845-2026' })}
                  </div>

                  {!form.client_id && clientSearch.length > 1 && (
                    <div style={{ marginTop: '8px', background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: '6px', padding: '7px 10px', fontSize: '10px', color: '#D4720A' }}>
                      ℹ️ Nouveau client — une fiche sera créée automatiquement à l'enregistrement.
                    </div>
                  )}
                  {form.client_id && (
                    <div style={{ marginTop: '8px', background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '7px 10px', fontSize: '10px', color: '#1A9E50' }}>
                      ✅ Client existant sélectionné dans le carnet.
                    </div>
                  )}
                </div>

                {/* PRESTATION */}
                <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>🚌 Prestation</div>

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
                          style={{ flex: 1, background: form.tarif_mode === m.key ? '#0E5AA7' : '#F8F9FB', color: form.tarif_mode === m.key ? 'white' : '#4A5568', border: '1px solid #D0D4DA', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '5px 4px', borderRadius: '5px', cursor: 'pointer' }}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {form.tarif_mode === 'km' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>
                          Distance (km){form.retour_km_reel != null && <span style={{ color: '#1A9E50', fontWeight: '700' }}> — km réel ✓</span>}
                        </label>
                        {inp(form.distance_km, (e: any) => setForm((f: any) => ({ ...f, distance_km: e.target.value })), { type: 'number' })}
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Tarif / km (€)</label>
                        {inp(form.tarif_km, (e: any) => setForm((f: any) => ({ ...f, tarif_km: e.target.value })), { type: 'number', step: '0.0001' })}
                      </div>
                    </div>
                  )}

                  {(form.retour_km_reel != null || form.retour_vehicule_reel || form.retour_heure_dep_reel) && (
                    <div style={{ background: '#F0F7FF', border: '1px solid #B8D9F5', borderRadius: '6px', padding: '10px', marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#0E5AA7', marginBottom: '6px' }}>↩ Infos retour BC détectées</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                        <div>
                          <label style={{ fontSize: '9px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '2px' }}>Véhicule réel</label>
                          {inp(form.retour_vehicule_reel, (e: any) => setForm((f: any) => ({ ...f, retour_vehicule_reel: e.target.value })))}
                        </div>
                        <div>
                          <label style={{ fontSize: '9px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '2px' }}>Départ réel</label>
                          {inp(form.retour_heure_dep_reel, (e: any) => setForm((f: any) => ({ ...f, retour_heure_dep_reel: e.target.value })))}
                        </div>
                        <div>
                          <label style={{ fontSize: '9px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '2px' }}>Retour réel</label>
                          {inp(form.retour_heure_ret_reel, (e: any) => setForm((f: any) => ({ ...f, retour_heure_ret_reel: e.target.value })))}
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#4A5568', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!form.inclure_retour_pdf} onChange={e => setForm((f: any) => ({ ...f, inclure_retour_pdf: e.target.checked }))} />
                        Afficher ces informations sur le PDF envoyé au client
                      </label>
                    </div>
                  )}

                  {(form.tarif_mode === 'journee' || form.tarif_mode === 'multi_jours') && (
                    <div style={{ display: 'grid', gridTemplateColumns: form.tarif_mode === 'multi_jours' ? '1fr 1fr' : '1fr', gap: '7px', marginBottom: '7px' }}>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Tarif journée (€)</label>
                        {inp(form.tarif_journee, (e: any) => setForm((f: any) => ({ ...f, tarif_journee: e.target.value })), { type: 'number', step: '0.01' })}
                      </div>
                      {form.tarif_mode === 'multi_jours' && (
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Nb de jours</label>
                          {inp(form.nb_jours, (e: any) => setForm((f: any) => ({ ...f, nb_jours: e.target.value })), { type: 'number', min: '1' })}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginBottom: '7px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Frais d'attente conducteur (€)</label>
                    {inp(form.frais_attente, (e: any) => setForm((f: any) => ({ ...f, frais_attente: e.target.value })), { type: 'number', step: '0.01' })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Date du service</label>
                      {inp(form.date_service, (e: any) => setForm((f: any) => ({ ...f, date_service: e.target.value })), { type: 'date' })}
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Date d'échéance</label>
                      {inp(form.date_echeance, (e: any) => setForm((f: any) => ({ ...f, date_echeance: e.target.value })), { type: 'date' })}
                    </div>
                  </div>

                  <div style={{ marginBottom: '7px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>TVA</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {TVA_TAUX.map(t => (
                        <button key={t} onClick={() => setForm((f: any) => ({ ...f, tva_taux: t }))}
                          style={{ flex: 1, background: form.tva_taux === t ? '#0E5AA7' : '#F8F9FB', color: form.tva_taux === t ? 'white' : '#4A5568', border: '1px solid #D0D4DA', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '5px', borderRadius: '5px', cursor: 'pointer' }}>
                          {t}%
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={3}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                </div>
              </div>

              {/* RECAP */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>💰 Récapitulatif</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '260px' }}>
                    {[['Total HT', ht.toFixed(2) + ' €', false], [`TVA ${form.tva_taux}%`, tva.toFixed(2) + ' €', false], ['Total TTC', ttc.toFixed(2) + ' €', true]].map(([l, v, b]) => (
                      <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0F2F5', fontSize: b ? '14px' : '11px', fontWeight: b ? '800' : '400' }}>
                        <span style={{ color: b ? '#1A2130' : '#4A5568' }}>{l as string}</span>
                        <span style={{ color: b ? '#0E5AA7' : '#1A2130' }}>{v as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 12px', borderRadius: '6px' }}>{message}</div>}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ background: saving ? '#8A95A3' : (form.type_document === 'devis' ? '#7B3FB5' : '#0E5AA7'), border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px 24px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Enregistrement…' : editId ? '💾 Enregistrer les modifications' : (form.type_document === 'devis' ? '💾 Créer le devis' : '💾 Créer la facture')}
                </button>
                <button onClick={() => { setShowForm(false); setEditId(null); setMessage('') }}
                  style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* APERCU */}
          {selected && !showForm && (
            <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#1A2130' }}>
                    {selected.type_document === 'devis' ? '📋' : '🧾'} {selected.numero}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8A95A3', marginTop: '4px' }}>
                    {new Date(selected.date_facture).toLocaleDateString('fr-FR')}
                    {selected.date_service && ` — Service : ${new Date(selected.date_service).toLocaleDateString('fr-FR')}`}
                    {selected.bc_reference && ` — BC : ${selected.bc_reference}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {/* Boutons cycle de vie */}
                  {selected.type_document === 'devis' && selected.statut === 'devis' && (
                    <button onClick={() => marquerSigne(selected)}
                      style={{ background: '#FFF3E0', color: '#D4720A', border: '1px solid #FFB74D', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      ✍ Marquer signé
                    </button>
                  )}
                  {selected.type_document === 'devis' && selected.statut === 'signe' && (
                    <button onClick={() => transformerEnFacture(selected)}
                      style={{ background: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      🧾 Transformer en facture
                    </button>
                  )}
                  {(selected.type_document === 'facture' || selected.type_document === 'devis') && ['devis','signe','emise'].includes(selected.statut) && (
                    <button onClick={() => envoyerParMail(selected)} disabled={envoyant}
                      style={{ background: envoyant ? '#8A95A3' : '#1A9E50', color: 'white', border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: envoyant ? 'not-allowed' : 'pointer' }}>
                      {envoyant ? '⏳ Envoi…' : '✉ Envoyer par mail'}
                    </button>
                  )}
                  {selected.type_document === 'facture' && selected.statut === 'envoyee' && (
                    <button onClick={() => updateStatut(selected.id, 'payee')}
                      style={{ background: '#E8F5E9', color: '#1A9E50', border: '1px solid #A5D6A7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      💶 Marquer payée
                    </button>
                  )}
                  {/* Modifier — uniquement devis */}
                  {selected.type_document === 'devis' && (
                    <button onClick={() => openEdit(selected)}
                      style={{ background: '#F3E8FF', color: '#7B3FB5', border: '1px solid #CE93D8', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      ✏️ Modifier
                    </button>
                  )}
                  {/* Supprimer */}
                  <button onClick={() => openDeleteModal(selected)}
                    style={{ background: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                    🗑 Supprimer
                  </button>
                  <span style={{ background: (STATUTS_DOC[selected.statut] || STATUTS_DOC.emise).bg, color: (STATUTS_DOC[selected.statut] || STATUTS_DOC.emise).color, fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                    {(STATUTS_DOC[selected.statut] || STATUTS_DOC.emise).label}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {[
                  ['Émetteur', [RGO.nom, RGO.adresse, `${RGO.cp} ${RGO.ville}`, `SIRET : ${RGO.siret}`, `TVA : ${RGO.tva_num}`]],
                  ['Client', [selected.client_nom, selected.client_adresse, `${selected.client_cp || ''} ${selected.client_ville || ''}`.trim(), selected.client_email, selected.client_siret ? `SIRET : ${selected.client_siret}` : ''].filter(Boolean)],
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
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#0E5AA7' }}>{F(l.quantite * l.prix_unitaire)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ width: '260px', background: '#F8F9FB', borderRadius: '8px', padding: '12px 14px' }}>
                  {[['Total HT', F(selected.montant_ht) + ' €', false], [`TVA ${selected.tva_taux}%`, F(selected.montant_tva) + ' €', false], ['Total TTC', F(selected.montant_ttc) + ' €', true]].map(([l, v, b]) => (
                    <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: b ? '14px' : '11px', fontWeight: b ? '800' : '400', borderBottom: b ? 'none' : '1px solid #E2E6EA' }}>
                      <span style={{ color: b ? '#1A2130' : '#4A5568' }}>{l as string}</span>
                      <span style={{ color: b ? '#0E5AA7' : '#1A2130' }}>{v as string}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selected.notes && (
                <div style={{ background: '#FFF8E1', borderRadius: '8px', padding: '10px 14px', fontSize: '11px', color: '#4A5568', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '600', color: '#1A2130', marginBottom: '4px' }}>Notes</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
                </div>
              )}

              {selected.envoi_mail_date && (
                <div style={{ background: '#E8F5E9', borderRadius: '8px', padding: '8px 14px', fontSize: '10px', color: '#1A9E50', marginBottom: '16px' }}>
                  ✉ Envoyée par mail le {new Date(selected.envoi_mail_date).toLocaleDateString('fr-FR')} à {new Date(selected.envoi_mail_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}

              <div style={{ background: '#F0F4FF', borderRadius: '8px', padding: '10px 14px', fontSize: '10px', color: '#4A5568', marginBottom: '16px' }}>
                <strong>Règlement :</strong> Virement bancaire — RIB : {RGO.rib}
              </div>

              <button onClick={() => telechargerPDF(selected)}
                style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>
                📄 Télécharger PDF
              </button>
            </div>
          )}

          {/* ETAT VIDE */}
          {!selected && !showForm && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '10px', color: '#8A95A3' }}>
              <div style={{ fontSize: '48px', opacity: .2 }}>🧾</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Sélectionnez un document ou créez-en un</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button onClick={() => { setForm({ ...EMPTY_FORM, type_document: 'devis' }); setClientSearch(''); setEditId(null); setShowForm(true) }}
                  style={{ background: '#7B3FB5', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}>
                  + Nouveau devis
                </button>
                <button onClick={() => { setForm({ ...EMPTY_FORM, type_document: 'facture' }); setClientSearch(''); setEditId(null); setShowForm(true) }}
                  style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}>
                  + Nouvelle facture
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}