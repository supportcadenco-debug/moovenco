'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import { COMPANY_ID } from '@/lib/constants'
import { generateId, formatMontant, getNextNumero } from '@/lib/utils'

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

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR')
}

export default function Commandes({ onUnreadCountChange }) {
  const [commandes, setCommandes] = useState<any[]>([])
  const [drivers, setDrivers] = useState<any[]>([])
  const [devisDisponibles, setDevisDisponibles] = useState<any[]>([])
  const [factureLink, setFactureLink] = useState(null) // facture liée à la commande sélectionnée
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('actives') // 'actives' | 'devis' | 'nonVus' | 'tous'
  const [showPicker, setShowPicker] = useState(false)
  const [transforming, setTransforming] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { init() }, [])

  async function init() {
    await cleanupDevisExpires()
    await loadAll()
  }

  // Convertit n'importe quelle valeur en nombre sûr
  function num(v, fallback = 0) {
    if (Array.isArray(v)) v = v[0]
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fallback
  }

  // Suppression définitive des devis non confirmés depuis plus de 14 jours (lignes legacy de la table commandes).
  async function cleanupDevisExpires() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    await supabase.from('commandes').delete()
      .eq('company_id', COMPANY_ID).eq('status', 'devis').lt('created_at', cutoff.toISOString())
  }

  async function loadAll() {
    const [{ data: c }, { data: d }, { data: dv }] = await Promise.all([
      supabase.from('commandes').select('*').eq('company_id', COMPANY_ID).order('date_service', { ascending: false }),
      supabase.from('profiles').select('id, name').eq('company_id', COMPANY_ID).eq('role', 'conducteur'),
      supabase.from('factures').select('*').eq('company_id', COMPANY_ID)
        .eq('type_document', 'devis').in('statut', ['devis', 'signe'])
        .order('created_at', { ascending: false }),
    ])
    const cmds = c || []
    setCommandes(cmds)
    setDrivers(d || [])
    // Un devis déjà transformé (devis_numero présent dans commandes) n'est plus proposé
    const dejaTransformes = new Set(cmds.map(x => x.devis_numero).filter(Boolean))
    setDevisDisponibles((dv || []).filter(x => !dejaTransformes.has(x.numero)))
    setLoading(false)
    if (onUnreadCountChange) {
      onUnreadCountChange(cmds.filter(x => x.retour_recu_at && !x.retour_vu).length)
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

  // ─── Transformation d'un devis (table factures) en bon de commande ────────
  async function transformerDepuisDevis(devis) {
    if (!window.confirm(`Transformer le devis ${devis.numero} (${devis.client_nom}) en bon de commande ?`)) return
    setTransforming(true)
    setMessage('')

    // Garde d'unicité : on revérifie en base qu'aucun BC n'existe déjà pour ce devis
    const { data: existing } = await supabase.from('commandes')
      .select('id').eq('company_id', COMPANY_ID).eq('devis_numero', devis.numero).limit(1)
    if (existing && existing.length > 0) {
      setMessage(`❌ Un bon de commande existe déjà pour le devis ${devis.numero}`)
      setTransforming(false)
      loadAll()
      return
    }

    const reference = getNextNumero(commandes, 'BC')
    const { error } = await supabase.from('commandes').insert({
      id: generateId(), company_id: COMPANY_ID,
      reference,
      status: 'confirmee',
      devis_numero: devis.numero,
      devis_signe: true,
      devis_date_signature: devis.devis_date_signature || new Date().toISOString().slice(0, 10),
      client_id: devis.client_id || null,
      client_responsable: devis.client_nom,
      client_adresse: devis.client_adresse,
      client_mail: devis.client_email,
      client_siret: devis.client_siret,
      client_type: devis.client_type,
      destination: devis.destination || '',
      date_service: devis.date_service || null,
      vehicle_type: devis.vehicle_type,
      tarif_mode: devis.tarif_mode,
      distance_km: devis.distance_km != null ? num(devis.distance_km) : null,
      tarif_km: devis.tarif_km != null ? num(devis.tarif_km) : null,
      tarif_journee: devis.tarif_journee != null ? num(devis.tarif_journee) : null,
      nb_jours: num(devis.nb_jours, 1),
      frais_attente: num(devis.frais_attente),
      montant_ht: num(devis.montant_ht),
      montant_tva: num(devis.montant_tva),
      montant_ttc: num(devis.montant_ttc),
      tva_taux: num(devis.tva_taux, 10),
      notes: devis.notes || '',
    })

    if (error) {
      setMessage('❌ Erreur : ' + error.message)
      setTransforming(false)
      return
    }

    // Le devis passe au statut "BC émis" dans Devis & Factures
    await supabase.from('factures').update({ statut: 'bc' }).eq('id', devis.id)

    setMessage(`✅ Bon de commande créé à partir du devis ${devis.numero} — prêt à être affecté dans le Planning`)
    setShowPicker(false)
    setTransforming(false)
    loadAll()
  }

  // ─── Transformation d'une ligne legacy (status devis dans commandes) ──────
  async function transformerEnBC(cmd) {
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
    setShowPicker(false)
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

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* LISTE */}
      <div style={{ width: '340px', minWidth: '340px', borderRight: '1px solid #E2E6EA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB' }}>
          <button onClick={() => { setShowPicker(true); setSelected(null); setMessage('') }}
            style={{ width: '100%', background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '8px', borderRadius: '6px', cursor: 'pointer', marginBottom: '8px' }}>
            📋 À partir d'un devis {devisDisponibles.length > 0 ? `(${devisDisponibles.length})` : ''}
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
                    {c.devis_numero && <span style={{ fontSize: '9px', fontWeight: '600', color: '#7B3FB5', marginLeft: '6px' }}>({c.devis_numero})</span>}
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

      {/* DÉTAIL / SÉLECTEUR DE DEVIS */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {message && (
          <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: message.includes('❌') ? '#FFEBEE' : '#E8F5E9', color: message.includes('❌') ? '#C62828' : '#1A9E50' }}>
            {message}
          </div>
        )}

        {showPicker ? (
          <div style={{ maxWidth: '640px' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1A2130', marginBottom: '4px' }}>📋 Créer un bon de commande à partir d'un devis</div>
            <div style={{ fontSize: '11px', color: '#8A95A3', marginBottom: '16px' }}>
              Les devis se créent dans l'onglet <strong>Devis &amp; Factures</strong>. Seuls les devis non encore transformés apparaissent ici.
            </div>
            {devisDisponibles.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#8A95A3', padding: '40px', background: 'white', borderRadius: '10px', border: '1px solid #E2E6EA' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
                <div style={{ fontSize: '12px', fontWeight: '500' }}>Aucun devis disponible</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>Créez d'abord un devis dans l'onglet Devis &amp; Factures.</div>
              </div>
            ) : devisDisponibles.map(dv => (
              <div key={dv.id} style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>{dv.numero}</span>
                    <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: dv.statut === 'signe' ? '#FFF3E0' : '#F3E8FF', color: dv.statut === 'signe' ? '#D4720A' : '#7B3FB5' }}>
                      {dv.statut === 'signe' ? 'Signé' : 'Devis'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#4A5568', fontWeight: '600' }}>{dv.client_nom || '—'}</div>
                  <div style={{ fontSize: '10px', color: '#8A95A3' }}>
                    {dv.destination || '—'} · {fmtDate(dv.date_service)} · {dv.montant_ttc ? `${formatMontant(dv.montant_ttc)} € TTC` : 'montant —'}
                  </div>
                </div>
                <button onClick={() => transformerDepuisDevis(dv)} disabled={transforming}
                  style={{ background: transforming ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '8px 12px', borderRadius: '6px', cursor: transforming ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {transforming ? '⏳' : '→ Transformer en BC'}
                </button>
              </div>
            ))}
            <button onClick={() => setShowPicker(false)}
              style={{ background: '#F0F2F5', border: 'none', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginTop: '4px' }}>
              Fermer
            </button>
          </div>
        ) : !selected ? (
          <div style={{ textAlign: 'center', color: '#8A95A3', padding: '60px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
            <div style={{ fontSize: '13px' }}>Sélectionnez une commande, ou créez un bon de commande à partir d'un devis</div>
          </div>
        ) : (
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '16px', fontWeight: '700', color: '#1A2130' }}>Commande N°{selected.numero_sequence}</span>
                  {selected.devis_numero && (
                    <span style={{ fontSize: '10px', fontWeight: '600', color: '#7B3FB5', background: '#F3E8FF', padding: '2px 8px', borderRadius: '8px' }}>Devis {selected.devis_numero}</span>
                  )}
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
