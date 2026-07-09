'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import AddressPicker from '../../src/components/AddressPicker'
import { COMPANY_ID, TYPE_VEHICULE, TYPE_CLIENT, TARIF_MODE } from '@/lib/constants'
import { generateId, ensureClient, getTarifAuto, formatMontant } from '@/lib/utils'

const STATUT_INFO = {
  devis:      { bg: '#F0F2F5', text: '#4A5568', label: '📝 Devis' },
  confirmee:  { bg: '#E3F2FD', text: '#1565C0', label: '📋 Bon de commande' },
  affectee:   { bg: '#FFF3E0', text: '#D4720A', label: '🚌 Affectée' },
  realisee:   { bg: '#F0F7FF', text: '#0E5AA7', label: '↩ Réalisée' },
  facturee:   { bg: '#E8F5E9', text: '#1A9E50', label: '🧾 Facturée' },
  payee:      { bg: '#E8F5E9', text: '#1A9E50', label: '✅ Payée' },
  annulee:    { bg: '#FFEBEE', text: '#C62828', label: '✕ Annulée' },
  expiree:    { bg: '#F0F2F5', text: '#8A95A3', label: '⏱ Expirée' },
}

const EMPTY_FORM = {
  client_nom: '', client_adresse: '', client_email: '', client_siret: '', client_type: 'mairie',
  destination: '', date_service: '', vehicle_type: 'autocar',
  tarif_mode: 'km', distance_km: '', tarif_km: '', tarif_journee: '', nb_jours: 1, frais_attente: 0,
  tva_taux: 10,
  notes: '',
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Commandes({ onUnreadCountChange }) {
  const [commandes, setCommandes] = useState([])
  const [drivers, setDrivers] = useState([])
  const [clients, setClients] = useState([])
  const [addresses, setAddresses] = useState([])
  const [tarifs, setTarifs] = useState<any[]>([])
  const [factureLink, setFactureLink] = useState(null) // facture liée à la commande sélectionnée
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('actives') // 'actives' | 'devis' | 'nonVus' | 'tous'
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [clientSearch, setClientSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    await cleanupDevisExpires()
    await loadAll()
  }

  // Suppression définitive des devis non confirmés depuis plus de 14 jours.
  async function cleanupDevisExpires() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    await supabase.from('commandes').delete()
      .eq('company_id', COMPANY_ID).eq('status', 'devis').lt('created_at', cutoff.toISOString())
  }

  async function loadAll() {
    const [{ data: c }, { data: d }, { data: cl }, { data: a }, { data: t }] = await Promise.all([
      supabase.from('commandes').select('*').eq('company_id', COMPANY_ID).order('date_service', { ascending: false }),
      supabase.from('profiles').select('id, name').eq('company_id', COMPANY_ID).eq('role', 'conducteur'),
      supabase.from('clients').select('*').eq('company_id', COMPANY_ID).eq('active', true).order('name'),
      supabase.from('addresses').select('id, name, address, lat, lng').eq('company_id', COMPANY_ID).order('name'),
      supabase.from('tarifs').select('*').eq('company_id', COMPANY_ID).eq('actif', true),
    ])
    setCommandes(c || [])
    setDrivers(d || [])
    setClients(cl || [])
    setAddresses(a || [])
    setTarifs(t || [])
    setLoading(false)
    if (onUnreadCountChange) {
      onUnreadCountChange((c || []).filter(x => x.retour_recu_at && !x.retour_vu).length)
    }
  }

  function driverName(uid) {
    return drivers.find(d => d.id === uid)?.name || uid || '—'
  }

  async function markAsSeen(cmd) {
    await supabase.from('commandes').update({ retour_vu: true }).eq('id', cmd.id)
    const updated = commandes.map(c => c.id === cmd.id ? { ...c, retour_vu: true } : c)
    setCommandes(updated)
    setSelected(s => s ? { ...s, retour_vu: true } : s)
    if (onUnreadCountChange) onUnreadCountChange(updated.filter(x => x.retour_recu_at && !x.retour_vu).length)
  }

  // ─── Création d'un nouveau devis ─────────────────────────────────────────
  function applyTarifAuto(vehicleType, clientType, mode) {
    // Signature réelle : getTarifAuto(tarifs, vehicle, client)
    const t = getTarifAuto(tarifs, vehicleType, clientType)
    if (!t) return
    const tKm = num(t.tarif_km, NaN)
    const tJour = num(t.tarif_journee, NaN)
    setForm(f => ({
      ...f,
      tarif_km: mode === 'km' && Number.isFinite(tKm) ? String(tKm) : f.tarif_km,
      tarif_journee: mode !== 'km' && Number.isFinite(tJour) ? String(tJour) : f.tarif_journee,
      tva_taux: num(t.tva, num(f.tva_taux, 10)),
    }))
  }

  // Convertit n'importe quelle valeur (chaîne, tableau de paliers…) en nombre sûr
  function num(v, fallback = 0) {
    if (Array.isArray(v)) v = v[0]
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  }

  function computeMontants() {
    // Calcul local aligné sur la sémantique de utils.ts :
    // km = distance × tarif/km · journee = forfait 1 jour · multi_jours = tarif/jour × nb jours
    const fraisAttente = num(form.frais_attente)
    let ht
    if (form.tarif_mode === 'km') ht = num(form.distance_km) * num(form.tarif_km) + fraisAttente
    else if (form.tarif_mode === 'journee') ht = num(form.tarif_journee) + fraisAttente
    else ht = num(form.tarif_journee) * num(form.nb_jours, 1) + fraisAttente
    const tva = ht * (num(form.tva_taux, 10) / 100)
    return { ht, tva, ttc: ht + tva }
  }

  async function saveDevis() {
    if (!form.client_nom) { setMessage('❌ Nom client obligatoire'); return }
    setSaving(true)
    const { ht, tva, ttc } = computeMontants()
    const clientId = await ensureClient(form)

    const { error } = await supabase.from('commandes').insert({
      id: generateId(), company_id: COMPANY_ID, status: 'devis',
      client_id: clientId, client_responsable: form.client_nom, client_adresse: form.client_adresse,
      client_mail: form.client_email, client_siret: form.client_siret, client_type: form.client_type,
      destination: form.destination, date_service: form.date_service || null,
      vehicle_type: form.vehicle_type, tarif_mode: form.tarif_mode,
      distance_km: form.distance_km ? num(form.distance_km) : null,
      tarif_km: form.tarif_km ? num(form.tarif_km) : null,
      tarif_journee: form.tarif_journee ? num(form.tarif_journee) : null,
      nb_jours: num(form.nb_jours, 1), frais_attente: num(form.frais_attente),
      montant_ht: ht, montant_tva: tva, montant_ttc: ttc,
      tva_taux: num(form.tva_taux, 10), notes: form.notes,
    })

    if (error) { setMessage('❌ Erreur : ' + error.message) }
    else {
      setMessage('✅ Devis créé')
      setShowForm(false); setForm(EMPTY_FORM); setClientSearch('')
      loadAll()
    }
    setSaving(false)
  }

  async function transformerEnBC(cmd) {
    // Garde : un devis ne peut être transformé qu'une seule fois.
    // On revérifie le statut en base pour éviter tout doublon (double clic, onglet ouvert ailleurs…)
    const { data: fresh } = await supabase.from('commandes').select('status').eq('id', cmd.id).single()
    if (fresh && fresh.status !== 'devis') {
      setMessage('❌ Ce devis a déjà été transformé en bon de commande')
      loadAll()
      return
    }
    if (!window.confirm(`Transformer le devis N°${cmd.numero_sequence} en bon de commande ?`)) return
    await supabase.from('commandes').update({
      status: 'confirmee', devis_signe: true, devis_date_signature: new Date().toISOString().slice(0, 10),
    }).eq('id', cmd.id)
    setMessage('✅ Bon de commande créé — prêt à être affecté dans le Planning')
    loadAll()
  }

  async function annulerDevis(cmd) {
    if (!window.confirm(`Annuler la commande de ${cmd.client_responsable} ?`)) return
    await supabase.from('commandes').update({ status: 'annulee' }).eq('id', cmd.id)
    setMessage('Commande annulée')
    loadAll()
  }

  // ─── Sélection d'une commande : charge la facture liée si elle existe ────
  async function selectCommande(cmd) {
    setSelected(cmd)
    setFactureLink(null)
    if (['facturee', 'payee'].includes(cmd.status)) {
      const { data } = await supabase.from('factures').select('id, numero, montant_ttc, statut').eq('commande_id', cmd.id).maybeSingle()
      setFactureLink(data || null)
    }
  }

  const hasRetour = (c) => !!c.retour_recu_at
  const filteredCommandes = commandes.filter(c => {
    if (filter === 'actives') return !['annulee', 'expiree', 'payee'].includes(c.status)
    if (filter === 'devis') return c.status === 'devis'
    if (filter === 'nonVus') return hasRetour(c) && !c.retour_vu
    return true
  })

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A95A3', fontSize: '13px' }}>Chargement…</div>
  }

  const inputSt = { width: '100%', padding: '6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }
  const labelSt = { fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* LISTE */}
      <div style={{ width: '340px', minWidth: '340px', borderRight: '1px solid #E2E6EA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB' }}>
          <button onClick={() => { setShowForm(true); setSelected(null); setForm(EMPTY_FORM); setClientSearch('') }}
            style={{ width: '100%', background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px' }}>
            + Nouveau devis
          </button>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[['actives', 'Actives'], ['devis', 'Devis'], ['nonVus', 'Non vus'], ['tous', 'Toutes']].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)}
                style={{ flex: 1, padding: '5px 6px', borderRadius: '6px', border: '1px solid #D0D4DA', background: filter === v ? '#0E5AA7' : 'white', color: filter === v ? 'white' : '#4A5568', fontSize: '9px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredCommandes.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#8A95A3', fontSize: '12px' }}>Aucune commande ici.</div>
          ) : filteredCommandes.map(c => {
            const statut = STATUT_INFO[c.status] || { bg: '#F0F2F5', text: '#8A95A3', label: c.status }
            const unread = hasRetour(c) && !c.retour_vu
            return (
              <div key={c.id} onClick={() => selectCommande(c)}
                style={{ padding: '12px 14px', borderBottom: '1px solid #F0F2F5', cursor: 'pointer', background: selected?.id === c.id ? '#F0F7FF' : unread ? '#FFF8E1' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>
                    {unread && <span style={{ color: '#D4720A' }}>🔔 </span>}
                    N°{c.numero_sequence}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: statut.bg, color: statut.text }}>{statut.label}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#8A95A3' }}>{c.client_responsable || '—'} · {c.destination || '—'}</div>
                <div style={{ fontSize: '10px', color: '#8A95A3' }}>{c.date_service || '—'} {c.montant_ttc ? `· ${formatMontant(c.montant_ttc)} €` : ''}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* DÉTAIL / FORMULAIRE */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {message && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: message.includes('❌') ? '#FFEBEE' : '#E8F5E9', color: message.includes('❌') ? '#C62828' : '#1A9E50' }}>
            {message}
          </div>
        )}

        {showForm ? (
          <div style={{ maxWidth: '560px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1A2130', marginBottom: '16px' }}>📝 Nouveau devis</div>

            <div style={{ marginBottom: '8px' }}>
              <label style={labelSt}>Client</label>
              <input style={inputSt} list="clients-list" value={clientSearch}
                onChange={e => {
                  setClientSearch(e.target.value)
                  const found = clients.find(c => c.name === e.target.value)
                  setForm(f => ({ ...f, client_nom: e.target.value, client_adresse: found?.address || f.client_adresse, client_email: found?.email || f.client_email, client_siret: found?.siret || f.client_siret }))
                }} placeholder="Nom du client (mairie, école, association…)" />
              <datalist id="clients-list">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div>
                <label style={labelSt}>Type de client</label>
                <select style={inputSt} value={form.client_type} onChange={e => { setForm(f => ({ ...f, client_type: e.target.value })); applyTarifAuto(form.vehicle_type, e.target.value, form.tarif_mode) }}>
                  {TYPE_CLIENT.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Type de véhicule</label>
                <select style={inputSt} value={form.vehicle_type} onChange={e => { setForm(f => ({ ...f, vehicle_type: e.target.value })); applyTarifAuto(e.target.value, form.client_type, form.tarif_mode) }}>
                  {TYPE_VEHICULE.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={labelSt}>Destination</label>
              <AddressPicker addresses={addresses} value={form.destination} onChange={({ label }) => setForm(f => ({ ...f, destination: label }))} placeholder="Rechercher une adresse…" />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={labelSt}>Date de service</label>
              <input type="date" style={inputSt} value={form.date_service} onChange={e => setForm(f => ({ ...f, date_service: e.target.value }))} />
            </div>

            <div style={{ marginBottom: '8px' }}>
              <label style={labelSt}>Mode de tarification</label>
              <div style={{ display: 'flex', gap: '5px' }}>
                {TARIF_MODE.map(m => (
                  <button key={m.key} onClick={() => { setForm(f => ({ ...f, tarif_mode: m.key })); applyTarifAuto(form.vehicle_type, form.client_type, m.key) }}
                    style={{ flex: 1, background: form.tarif_mode === m.key ? '#0E5AA7' : '#F8F9FB', color: form.tarif_mode === m.key ? 'white' : '#4A5568', border: '1px solid #D0D4DA', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '5px 4px', borderRadius: '5px', cursor: 'pointer' }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {form.tarif_mode === 'km' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><label style={labelSt}>Distance (km)</label><input type="number" style={inputSt} value={form.distance_km} onChange={e => setForm(f => ({ ...f, distance_km: e.target.value }))} /></div>
                <div><label style={labelSt}>Tarif / km (€)</label><input type="number" step="0.0001" style={inputSt} value={form.tarif_km} onChange={e => setForm(f => ({ ...f, tarif_km: e.target.value }))} /></div>
              </div>
            ) : form.tarif_mode === 'journee' ? (
              <div style={{ marginBottom: '8px' }}>
                <label style={labelSt}>Tarif / jour (€)</label><input type="number" step="0.01" style={inputSt} value={form.tarif_journee} onChange={e => setForm(f => ({ ...f, tarif_journee: e.target.value }))} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div><label style={labelSt}>Nb jours</label><input type="number" style={inputSt} value={form.nb_jours} onChange={e => setForm(f => ({ ...f, nb_jours: e.target.value }))} /></div>
                <div><label style={labelSt}>Tarif / jour (€)</label><input type="number" step="0.01" style={inputSt} value={form.tarif_journee} onChange={e => setForm(f => ({ ...f, tarif_journee: e.target.value }))} /></div>
              </div>
            )}

            <div style={{ marginBottom: '8px' }}>
              <label style={labelSt}>Notes</label>
              <textarea style={{ ...inputSt, resize: 'vertical' }} rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>

            <div style={{ background: '#F0F7FF', border: '1px solid #B8D9F5', borderRadius: '6px', padding: '10px', marginBottom: '14px', fontSize: '12px', color: '#0E5AA7', fontWeight: '700' }}>
              Total estimé TTC : {formatMontant(computeMontants().ttc)} €
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowForm(false)} style={{ background: '#F0F2F5', border: 'none', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Annuler</button>
              <button onClick={saveDevis} disabled={saving} style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                {saving ? 'Création…' : '✓ Créer le devis'}
              </button>
            </div>
          </div>
        ) : !selected ? (
          <div style={{ textAlign: 'center', color: '#8A95A3', padding: '60px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
            <div style={{ fontSize: '13px' }}>Sélectionnez une commande, ou créez un nouveau devis</div>
          </div>
        ) : (
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#1A2130' }}>Commande N°{selected.numero_sequence}</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '10px', background: (STATUT_INFO[selected.status] || {}).bg, color: (STATUT_INFO[selected.status] || {}).text }}>
                    {(STATUT_INFO[selected.status] || {}).label || selected.status}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#8A95A3', marginTop: '2px' }}>{selected.client_responsable} — {selected.destination} — {selected.date_service}</div>
                {selected.montant_ttc && <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A2130', marginTop: '4px' }}>{formatMontant(selected.montant_ttc)} € TTC</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selected.status === 'devis' && (
                  <>
                    <button onClick={() => transformerEnBC(selected)} style={{ background: '#1A9E50', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer' }}>📋 Transformer en bon de commande</button>
                    <button onClick={() => annulerDevis(selected)} style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer' }}>✕ Annuler</button>
                  </>
                )}
                {hasRetour(selected) && !selected.retour_vu && (
                  <button onClick={() => markAsSeen(selected)} style={{ background: '#1A9E50', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer' }}>✓ Marquer retour comme vu</button>
                )}
              </div>
            </div>

            {/* Statuts informatifs sans retour BC */}
            {selected.status === 'confirmee' && (
              <div style={{ background: '#F0F7FF', borderRadius: '8px', padding: '14px 16px', fontSize: '12px', color: '#0E5AA7', marginBottom: '14px' }}>
                📋 Bon de commande créé le {selected.devis_date_signature || '—'}. En attente d'affectation conducteur/véhicule dans le Planning.
              </div>
            )}
            {selected.status === 'affectee' && (
              <div style={{ background: '#FFF3E0', borderRadius: '8px', padding: '14px 16px', fontSize: '12px', color: '#D4720A', marginBottom: '14px' }}>
                🚌 Affectée à <strong>{driverName(selected.assigned_driver)}</strong> — véhicule {selected.assigned_vehicle || selected.vehicule_plaque || '—'}. En attente du retour BC du conducteur.
              </div>
            )}
            {factureLink && (
              <div style={{ background: '#E8F5E9', borderRadius: '8px', padding: '14px 16px', fontSize: '12px', color: '#1A9E50', marginBottom: '14px' }}>
                🧾 Facture <strong>{factureLink.numero}</strong> générée — {formatMontant(factureLink.montant_ttc)} € ({factureLink.statut})
              </div>
            )}

            {!hasRetour(selected) ? (
              selected.status === 'realisee' ? null : (
                <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '16px', fontSize: '12px', color: '#8A95A3' }}>
                  Aucun retour BC n'a encore été envoyé par le conducteur pour cette commande.
                </div>
              )
            ) : (
              <>
                <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>↩ Retour BC</div>
                  <div style={{ fontSize: '11px', color: '#4A5568', marginBottom: '4px' }}>Reçu le <strong>{fmtDateTime(selected.retour_recu_at)}</strong></div>
                  <div style={{ fontSize: '11px', color: '#4A5568' }}>Conducteur : <strong>{driverName(selected.retour_conducteur_uid)}</strong></div>
                </div>

                {(selected.retour_km_dep_garage != null || selected.retour_km_ret_garage != null) && (
                  <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>🚌 Véhicule & kilométrage</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#4A5568' }}>
                      {selected.retour_vehicule_reel && <div>Véhicule réel : <strong>{selected.retour_vehicule_reel}</strong></div>}
                      {selected.retour_pax_reel != null && <div>Passagers réels : <strong>{selected.retour_pax_reel}</strong></div>}
                      {selected.retour_km_dep_garage != null && <div>Km départ garage : <strong>{selected.retour_km_dep_garage}</strong></div>}
                      {selected.retour_km_dep_client != null && <div>Km départ client : <strong>{selected.retour_km_dep_client}</strong></div>}
                      {selected.retour_km_ret_client != null && <div>Km retour client : <strong>{selected.retour_km_ret_client}</strong></div>}
                      {selected.retour_km_ret_garage != null && <div>Km retour garage : <strong>{selected.retour_km_ret_garage}</strong></div>}
                      {selected.retour_km_vide != null && <div>Km à vide : <strong>{selected.retour_km_vide}</strong></div>}
                      {selected.retour_km_nat != null && <div>Km national : <strong>{selected.retour_km_nat}</strong></div>}
                      {selected.retour_km_hue != null && <div>Km HUE : <strong>{selected.retour_km_hue}</strong></div>}
                    </div>
                  </div>
                )}

                {(selected.retour_heure_dep_client || selected.retour_heure_ret_garage) && (
                  <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>🕐 Horaires réels</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#4A5568' }}>
                      {selected.retour_heure_dep_client && <div>Départ client : <strong>{selected.retour_heure_dep_client}{selected.retour_heure_dep_client_j1 ? ' (J+1)' : ''}</strong></div>}
                      {selected.retour_heure_ret_client && <div>Retour client : <strong>{selected.retour_heure_ret_client}{selected.retour_heure_ret_client_j1 ? ' (J+1)' : ''}</strong></div>}
                      {selected.retour_heure_ret_garage && <div>Retour garage : <strong>{selected.retour_heure_ret_garage}{selected.retour_heure_ret_garage_j1 ? ' (J+1)' : ''}</strong></div>}
                    </div>
                  </div>
                )}

                {selected.retour_validation_statut && (
                  <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>✅ Validation de la course</div>
                    <div style={{ fontSize: '11px', color: '#4A5568', marginBottom: '6px' }}>Statut : <strong>{selected.retour_validation_statut}</strong></div>
                    {selected.retour_validation_obs && (
                      <div style={{ fontSize: '11px', color: '#4A5568', background: '#F8F9FB', padding: '8px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>{selected.retour_validation_obs}</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
