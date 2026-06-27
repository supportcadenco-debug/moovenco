'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const RGO = {
  nom: 'SAS RGO Mobilités Janzé',
  adresse: '57 rue de Bain',
  cp: '35150',
  ville: 'JANZÉ',
  siret: '699 200 788 00072',
  naf: '4939A',
  tva_num: 'FR76699200788',
  rib: 'FR76 1659 8000 0102 6454 9000 136',
  email: 'contact@rgomobilites.fr',
  tel: '02 99 47 XX XX',
}

const TVA_TAUX = [0, 10, 20]

const TYPE_VEHICULE = ['autocar', 'minibus']
const TYPE_CLIENT = ['mairie', 'ecole', 'entreprise', 'particulier']
const TARIF_MODE = [
  { key: 'km',          label: 'Au kilomètre' },
  { key: 'journee',     label: 'À la journée' },
  { key: 'multi_jours', label: 'Multi-jours' },
]

const STATUTS_DOC: any = {
  devis:    { label: 'Devis',    color: '#7B3FB5', bg: '#F3E8FF' },
  signe:    { label: 'Signé',    color: '#D4720A', bg: '#FFF3E0' },
  bc:       { label: 'BC émis',  color: '#1565C0', bg: '#E3F2FD' },
  emise:    { label: 'Émise',    color: '#1565C0', bg: '#E3F2FD' },
  envoyee:  { label: 'Envoyée',  color: '#D4720A', bg: '#FFF3E0' },
  payee:    { label: 'Payée',    color: '#1A9E50', bg: '#E8F5E9' },
  annulee:  { label: 'Annulée',  color: '#C62828', bg: '#FFEBEE' },
}

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
  client_nom: '', client_adresse: '', client_cp: '', client_ville: '',
  client_email: '', client_siret: '', client_type: 'mairie',
  date_facture: new Date().toISOString().split('T')[0],
  date_service: '',
  date_echeance: '',
  tva_taux: 10,
  tarif_mode: 'km',
  vehicle_type: 'autocar',
  distance_km: '',
  tarif_km: '',
  tarif_journee: '',
  nb_jours: 1,
  frais_attente: 0,
  bc_reference: '',
  notes: '',
  lignes: [{ description: '', quantite: 1, prix_unitaire: 0 }],
}

export default function Factures() {
  const [docs, setDocs] = useState<any[]>([])
  const [tarifs, setTarifs] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterType, setFilterType] = useState<'tous' | 'devis' | 'facture'>('tous')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: f }, { data: t }, { data: o }] = await Promise.all([
      supabase.from('factures').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
      supabase.from('tarifs').select('*').eq('company_id', COMPANY_ID).eq('actif', true),
      supabase.from('orders').select('*').eq('company_id', COMPANY_ID).in('status', ['confirme', 'affecte', 'termine']),
    ])
    setDocs(f || [])
    setTarifs(t || [])
    setOrders(o || [])
    setLoading(false)
  }

  // Calcul auto du tarif depuis la grille
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
    const { tarif_mode, tarif_km, distance_km, tarif_journee, nb_jours, frais_attente, lignes } = form
    if (tarif_mode === 'km') {
      const base = (parseFloat(tarif_km) || 0) * (parseInt(distance_km) || 0)
      return base + (parseFloat(frais_attente) || 0)
    }
    if (tarif_mode === 'journee') {
      return (parseFloat(tarif_journee) || 0) + (parseFloat(frais_attente) || 0)
    }
    if (tarif_mode === 'multi_jours') {
      return (parseFloat(tarif_journee) || 0) * (parseInt(nb_jours) || 1) + (parseFloat(frais_attente) || 0)
    }
    // fallback lignes manuelles
    return lignes.reduce((acc: number, l: any) => acc + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0)
  }

  function calcTotaux() {
    const ht = calcMontantHT()
    const tva = ht * (form.tva_taux / 100)
    const ttc = ht + tva
    return { ht, tva, ttc }
  }

  function buildLignesAuto() {
    const { tarif_mode, tarif_km, distance_km, tarif_journee, nb_jours, frais_attente, vehicle_type, date_service } = form
    const dateStr = date_service ? new Date(date_service).toLocaleDateString('fr-FR') : ''
    const lignes = []
    if (tarif_mode === 'km') {
      lignes.push({ description: `Transport ${vehicle_type} — ${distance_km || '?'} km${dateStr ? ' le ' + dateStr : ''}`, quantite: parseInt(distance_km) || 1, prix_unitaire: parseFloat(tarif_km) || 0 })
    } else if (tarif_mode === 'journee') {
      lignes.push({ description: `Forfait journée ${vehicle_type}${dateStr ? ' le ' + dateStr : ''}`, quantite: 1, prix_unitaire: parseFloat(tarif_journee) || 0 })
    } else {
      lignes.push({ description: `Forfait ${nb_jours} jour(s) ${vehicle_type}`, quantite: parseInt(nb_jours) || 1, prix_unitaire: parseFloat(tarif_journee) || 0 })
    }
    if (parseFloat(frais_attente) > 0) {
      lignes.push({ description: 'Frais d\'attente conducteur', quantite: 1, prix_unitaire: parseFloat(frais_attente) })
    }
    return lignes
  }

  function fillFromOrder(order: any) {
    const tarifAuto = getTarifAuto(order.vehicle_type || 'autocar', 'mairie')
    setForm((f: any) => ({
      ...f,
      client_nom: order.client_responsable || order.client_nom || '',
      client_adresse: order.client_adresse || '',
      client_cp: order.client_cp_ville?.split(' ')[0] || '',
      client_ville: order.client_cp_ville?.split(' ').slice(1).join(' ') || '',
      client_email: order.client_mail || '',
      vehicle_type: order.vehicle_type || 'autocar',
      date_service: order.date_service || '',
      bc_reference: order.bon_commande_ref || '',
      distance_km: order.distance_km || '',
      tarif_km: tarifAuto?.tarif_km || '',
      tarif_journee: tarifAuto?.tarif_journee || '',
      notes: `Réf. commande : ${order.reference}${order.destination ? '\nDestination : ' + order.destination : ''}`,
    }))
  }

  async function handleSave() {
    if (!form.client_nom) { setMessage('Nom client obligatoire'); return }
    setSaving(true)
    const { ht, tva, ttc } = calcTotaux()
    const isDevis = form.type_document === 'devis'
    const prefix = isDevis ? 'DEV' : 'F'
    const numero = getNextNumero(docs, prefix)
    const lignes = buildLignesAuto()

    const { error } = await supabase.from('factures').insert({
      id: generateId(),
      company_id: COMPANY_ID,
      numero,
      type_document: form.type_document,
      statut: isDevis ? 'devis' : 'emise',
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
      montant_ht: ht,
      montant_tva: tva,
      montant_ttc: ttc,
      lignes,
      notes: form.notes,
    })

    if (error) setMessage('Erreur : ' + error.message)
    else {
      setMessage(isDevis ? '✅ Devis créé' : '✅ Facture créée')
      setShowForm(false)
      setForm(EMPTY_FORM)
      loadAll()
    }
    setSaving(false)
  }

  async function updateStatut(id: string, statut: string) {
    await supabase.from('factures').update({ statut }).eq('id', id)
    loadAll()
    if (selected?.id === id) setSelected((s: any) => ({ ...s, statut }))
  }

  async function transformerEnFacture(doc: any) {
    if (!confirm('Transformer ce devis en facture ?')) return
    const numero = getNextNumero(docs, 'F')
    await supabase.from('factures').update({
      type_document: 'facture',
      statut: 'emise',
      numero,
      facture_reference: numero,
    }).eq('id', doc.id)
    loadAll()
    setSelected(null)
  }

  async function marquerSigne(doc: any) {
    await supabase.from('factures').update({
      statut: 'signe',
      devis_signe: true,
      devis_date_signature: new Date().toISOString().split('T')[0],
    }).eq('id', doc.id)
    loadAll()
    setSelected((s: any) => ({ ...s, statut: 'signe', devis_signe: true }))
  }

  async function marquerEnvoye(doc: any) {
    await supabase.from('factures').update({
      statut: 'envoyee',
      envoi_mail_statut: 'envoye',
      envoi_mail_date: new Date().toISOString(),
    }).eq('id', doc.id)
    loadAll()
    setSelected((s: any) => ({ ...s, statut: 'envoyee', envoi_mail_statut: 'envoye' }))
  }

  const { ht, tva, ttc } = calcTotaux()

  const filteredDocs = docs.filter(d => {
    if (filterType === 'devis') return d.type_document === 'devis'
    if (filterType === 'facture') return d.type_document === 'facture'
    return true
  })

  const statsEmises = docs.filter(d => d.type_document === 'facture' && d.statut === 'emise').reduce((a, d) => a + parseFloat(d.montant_ttc || 0), 0)
  const statsPayees = docs.filter(d => d.statut === 'payee').reduce((a, d) => a + parseFloat(d.montant_ttc || 0), 0)
  const statsDevis  = docs.filter(d => d.type_document === 'devis').length

  const F = (v: any) => parseFloat(v || 0).toFixed(2)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* BARRE ACTION */}
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {([['tous', 'Tous'], ['devis', 'Devis'], ['facture', 'Factures']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilterType(k)}
              style={{ background: filterType === k ? 'white' : 'transparent', color: filterType === k ? '#1A2130' : '#8A95A3', border: '1px solid', borderColor: filterType === k ? 'white' : '#4A5568', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '3px 12px', borderRadius: '10px', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => { setForm({ ...EMPTY_FORM, type_document: 'devis' }); setShowForm(true); setSelected(null) }}
            style={{ background: '#7B3FB5', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
            + Nouveau devis
          </button>
          <button onClick={() => { setForm({ ...EMPTY_FORM, type_document: 'facture' }); setShowForm(true); setSelected(null) }}
            style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
            + Nouvelle facture
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LISTE */}
        <div style={{ width: '280px', minWidth: '280px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', borderBottom: '1px solid #F0F2F5' }}>
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
                <div key={d.id} onClick={() => { setSelected(d); setShowForm(false) }}
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
                  {d.envoi_mail_statut === 'envoye' && (
                    <div style={{ fontSize: '9px', color: '#1A9E50', marginTop: '2px' }}>✉ Envoyé par mail</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* STATS */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E6EA', background: '#F8F9FB' }}>
            {[
              ['Devis en cours', statsDevis + ' doc.', '#7B3FB5'],
              ['Factures émises', statsEmises.toFixed(2) + ' €', '#1565C0'],
              ['Encaissé', statsPayees.toFixed(2) + ' €', '#1A9E50'],
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

              {/* Type document */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>Type :</span>
                {[['devis', '📋 Devis', '#7B3FB5'], ['facture', '🧾 Facture', '#0E5AA7']].map(([k, l, c]) => (
                  <button key={k} onClick={() => setForm((f: any) => ({ ...f, type_document: k }))}
                    style={{ background: form.type_document === k ? c : '#F8F9FB', color: form.type_document === k ? 'white' : '#4A5568', border: `1px solid ${form.type_document === k ? c : '#D0D4DA'}`, fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '5px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}

                {/* Pré-remplir depuis commande */}
                {orders.length > 0 && (
                  <select onChange={e => { const o = orders.find(x => x.id === e.target.value); if (o) fillFromOrder(o) }}
                    style={{ marginLeft: 'auto', padding: '5px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', color: '#4A5568' }}>
                    <option value=''>⚡ Pré-remplir depuis une commande…</option>
                    {orders.map(o => <option key={o.id} value={o.id}>{o.reference} — {o.destination || '?'}</option>)}
                  </select>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                {/* CLIENT */}
                <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>👤 Client</div>
                  {([
                    ['Nom / Raison sociale *', 'client_nom', 'text'],
                    ['Adresse', 'client_adresse', 'text'],
                    ['Code postal', 'client_cp', 'text'],
                    ['Ville', 'client_ville', 'text'],
                    ['Email', 'client_email', 'email'],
                    ['SIRET', 'client_siret', 'text'],
                  ] as const).map(([label, key, type]) => (
                    <div key={key} style={{ marginBottom: '7px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      <input type={type} value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
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
                    <input value={form.bc_reference} onChange={e => setForm((f: any) => ({ ...f, bc_reference: e.target.value }))}
                      placeholder='ex: JA269845-2026'
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
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
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Distance (km)</label>
                        <input type='number' value={form.distance_km} onChange={e => setForm((f: any) => ({ ...f, distance_km: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Tarif / km (€)</label>
                        <input type='number' step='0.0001' value={form.tarif_km} onChange={e => setForm((f: any) => ({ ...f, tarif_km: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}

                  {(form.tarif_mode === 'journee' || form.tarif_mode === 'multi_jours') && (
                    <div style={{ display: 'grid', gridTemplateColumns: form.tarif_mode === 'multi_jours' ? '1fr 1fr' : '1fr', gap: '7px', marginBottom: '7px' }}>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Tarif journée (€)</label>
                        <input type='number' step='0.01' value={form.tarif_journee} onChange={e => setForm((f: any) => ({ ...f, tarif_journee: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                      {form.tarif_mode === 'multi_jours' && (
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Nb de jours</label>
                          <input type='number' min='1' value={form.nb_jours} onChange={e => setForm((f: any) => ({ ...f, nb_jours: e.target.value }))}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginBottom: '7px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Frais d'attente conducteur (€)</label>
                    <input type='number' step='0.01' value={form.frais_attente} onChange={e => setForm((f: any) => ({ ...f, frais_attente: e.target.value }))}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Date du service</label>
                      <input type='date' value={form.date_service} onChange={e => setForm((f: any) => ({ ...f, date_service: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Date d'échéance</label>
                      <input type='date' value={form.date_echeance} onChange={e => setForm((f: any) => ({ ...f, date_echeance: e.target.value }))}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
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

              {/* RECAP MONTANTS */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>💰 Récapitulatif</div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '260px' }}>
                    {[
                      ['Total HT', ht.toFixed(2) + ' €', false],
                      [`TVA ${form.tva_taux}%`, tva.toFixed(2) + ' €', false],
                      ['Total TTC', ttc.toFixed(2) + ' €', true],
                    ].map(([label, val, bold]) => (
                      <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0F2F5', fontSize: bold ? '14px' : '11px', fontWeight: bold ? '800' : '400' }}>
                        <span style={{ color: bold ? '#1A2130' : '#4A5568' }}>{label as string}</span>
                        <span style={{ color: bold ? '#0E5AA7' : '#1A2130' }}>{val as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 12px', borderRadius: '6px' }}>{message}</div>}

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleSave} disabled={saving}
                  style={{ background: saving ? '#8A95A3' : (form.type_document === 'devis' ? '#7B3FB5' : '#0E5AA7'), border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px 24px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Enregistrement…' : (form.type_document === 'devis' ? '💾 Créer le devis' : '💾 Créer la facture')}
                </button>
                <button onClick={() => { setShowForm(false); setMessage('') }}
                  style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* APERCU DOCUMENT */}
          {selected && !showForm && (
            <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>

              {/* EN-TETE */}
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
                  {selected.type_document === 'facture' && selected.statut === 'emise' && (
                    <button onClick={() => marquerEnvoye(selected)}
                      style={{ background: '#E8F5E9', color: '#1A9E50', border: '1px solid #A5D6A7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      ✉ Marquer envoyée par mail
                    </button>
                  )}
                  {selected.type_document === 'facture' && selected.statut === 'envoyee' && (
                    <button onClick={() => updateStatut(selected.id, 'payee')}
                      style={{ background: '#E8F5E9', color: '#1A9E50', border: '1px solid #A5D6A7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                      💶 Marquer payée
                    </button>
                  )}
                  <span style={{ background: (STATUTS_DOC[selected.statut] || STATUTS_DOC.emise).bg, color: (STATUTS_DOC[selected.statut] || STATUTS_DOC.emise).color, fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                    {(STATUTS_DOC[selected.statut] || STATUTS_DOC.emise).label}
                  </span>
                </div>
              </div>

              {/* EMETTEUR / CLIENT */}
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

              {/* LIGNES */}
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

              {/* TOTAUX */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ width: '260px', background: '#F8F9FB', borderRadius: '8px', padding: '12px 14px' }}>
                  {[
                    ['Total HT', F(selected.montant_ht) + ' €', false],
                    [`TVA ${selected.tva_taux}%`, F(selected.montant_tva) + ' €', false],
                    ['Total TTC', F(selected.montant_ttc) + ' €', true],
                  ].map(([label, val, bold]) => (
                    <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: bold ? '14px' : '11px', fontWeight: bold ? '800' : '400', borderBottom: bold ? 'none' : '1px solid #E2E6EA' }}>
                      <span style={{ color: bold ? '#1A2130' : '#4A5568' }}>{label as string}</span>
                      <span style={{ color: bold ? '#0E5AA7' : '#1A2130' }}>{val as string}</span>
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

              <button onClick={() => window.print()}
                style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>
                🖨 Imprimer / Exporter PDF
              </button>
            </div>
          )}

          {/* ETAT VIDE */}
          {!selected && !showForm && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '10px', color: '#8A95A3' }}>
              <div style={{ fontSize: '48px', opacity: .2 }}>🧾</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Sélectionnez un document ou créez-en un</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <button onClick={() => { setForm({ ...EMPTY_FORM, type_document: 'devis' }); setShowForm(true) }}
                  style={{ background: '#7B3FB5', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer' }}>
                  + Nouveau devis
                </button>
                <button onClick={() => { setForm({ ...EMPTY_FORM, type_document: 'facture' }); setShowForm(true) }}
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