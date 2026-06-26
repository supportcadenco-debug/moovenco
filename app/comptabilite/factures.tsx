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
  tva: 'FR76699200788',
  rib: 'FR76 1659 8000 0102 6454 9000 136',
  email: 'contact@rgomobilites.fr',
  tel: '02 99 47 XX XX',
}

const TVA_TAUX = [0, 10, 20]

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function getNextNumero(factures: any[]) {
  const year = new Date().getFullYear()
  const existing = factures.filter(f => f.numero?.startsWith(`F${year}-`))
  const max = existing.reduce((acc, f) => {
    const n = parseInt(f.numero?.split('-')[1] || '0')
    return n > acc ? n : acc
  }, 0)
  return `F${year}-${String(max + 1).padStart(3, '0')}`
}

const EMPTY_FORM = {
  client_nom: '', client_adresse: '', client_cp: '', client_ville: '',
  client_email: '', client_siret: '',
  date_facture: new Date().toISOString().split('T')[0],
  date_echeance: '',
  tva_taux: 10,
  notes: '',
  lignes: [{ description: '', quantite: 1, prix_unitaire: 0 }],
}

export default function Factures() {
  const [factures, setFactures] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: f }, { data: o }] = await Promise.all([
      supabase.from('factures').select('*').eq('company_id', COMPANY_ID).order('created_at', { ascending: false }),
      supabase.from('orders').select('*').eq('company_id', COMPANY_ID).in('status', ['confirme', 'affecte', 'termine']),
    ])
    setFactures(f || [])
    setOrders(o || [])
    setLoading(false)
  }

  function calcLigne(l: any) {
    return (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0)
  }

  function calcTotaux() {
    const ht = form.lignes.reduce((acc: number, l: any) => acc + calcLigne(l), 0)
    const tva = ht * (form.tva_taux / 100)
    const ttc = ht + tva
    return { ht, tva, ttc }
  }

  function addLigne() {
    setForm((f: any) => ({ ...f, lignes: [...f.lignes, { description: '', quantite: 1, prix_unitaire: 0 }] }))
  }

  function removeLigne(idx: number) {
    setForm((f: any) => ({ ...f, lignes: f.lignes.filter((_: any, i: number) => i !== idx) }))
  }

  function updateLigne(idx: number, field: string, value: any) {
    setForm((f: any) => ({
      ...f,
      lignes: f.lignes.map((l: any, i: number) => i === idx ? { ...l, [field]: value } : l)
    }))
  }

  function fillFromOrder(order: any) {
    setForm((f: any) => ({
      ...f,
      client_nom: order.client_name || '',
      client_email: order.client_email || '',
      notes: `Réf. commande : ${order.reference}\n${order.destination || ''}${order.date_service ? '\nDate de service : ' + new Date(order.date_service).toLocaleDateString('fr-FR') : ''}`,
      lignes: [{
        description: `Transport — ${order.destination || ''}${order.date_service ? ' le ' + new Date(order.date_service).toLocaleDateString('fr-FR') : ''}`,
        quantite: 1,
        prix_unitaire: order.price_ht || 0,
      }],
      tva_taux: order.tva || 10,
    }))
  }

  async function handleSave() {
    if (!form.client_nom) { setMessage('Nom client obligatoire'); return }
    setSaving(true)
    const { ht, tva, ttc } = calcTotaux()
    const numero = getNextNumero(factures)
    const { error } = await supabase.from('factures').insert({
      id: generateId(), company_id: COMPANY_ID,
      numero, statut: 'emise',
      client_nom: form.client_nom, client_adresse: form.client_adresse,
      client_cp: form.client_cp, client_ville: form.client_ville,
      client_email: form.client_email, client_siret: form.client_siret,
      date_facture: form.date_facture, date_echeance: form.date_echeance || null,
      tva_taux: form.tva_taux, montant_ht: ht, montant_tva: tva, montant_ttc: ttc,
      lignes: form.lignes, notes: form.notes,
    })
    if (error) setMessage('Erreur : ' + error.message)
    else {
      setMessage('✅ Facture créée')
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

  async function printFacture(facture: any) {
    setSelected(facture)
    setPreview(true)
  }

  const { ht, tva, ttc } = calcTotaux()

  const STATUTS: any = {
    emise:   { label: 'Émise',   color: '#1565C0', bg: '#E3F2FD' },
    envoyee: { label: 'Envoyée', color: '#D4720A', bg: '#FFF3E0' },
    payee:   { label: 'Payée',   color: '#1A9E50', bg: '#E8F5E9' },
    annulee: { label: 'Annulée', color: '#C62828', bg: '#FFEBEE' },
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* BARRE ACTION */}
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0, gap: '8px' }}>
        <button onClick={() => { setShowForm(true); setSelected(null); setForm(EMPTY_FORM); setPreview(false) }}
          style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
          + Nouvelle facture
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LISTE FACTURES */}
        <div style={{ width: '280px', minWidth: '280px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', borderBottom: '1px solid #F0F2F5' }}>
            Factures ({factures.length})
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>Chargement…</div>
            ) : factures.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🧾</div>
                Aucune facture
              </div>
            ) : (
              factures.map(f => {
                const st = STATUTS[f.statut] || STATUTS.emise
                return (
                  <div key={f.id} onClick={() => { setSelected(f); setShowForm(false); setPreview(false) }}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', borderLeft: `3px solid ${selected?.id === f.id ? '#0E5AA7' : 'transparent'}`, background: selected?.id === f.id ? '#E8F0FB' : 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>{f.numero}</div>
                      <span style={{ background: st.bg, color: st.color, fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '8px' }}>{st.label}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#4A5568' }}>{f.client_nom}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                      <span style={{ fontSize: '10px', color: '#8A95A3' }}>{new Date(f.date_facture).toLocaleDateString('fr-FR')}</span>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#0E5AA7' }}>{parseFloat(f.montant_ttc).toFixed(2)} €</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* STATS FACTURES */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #E2E6EA', background: '#F8F9FB' }}>
            {[
              ['Émises', factures.filter(f => f.statut === 'emise').reduce((a, f) => a + parseFloat(f.montant_ttc || 0), 0)],
              ['Payées', factures.filter(f => f.statut === 'payee').reduce((a, f) => a + parseFloat(f.montant_ttc || 0), 0)],
            ].map(([label, val]) => (
              <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '3px' }}>
                <span style={{ color: '#8A95A3' }}>{label as string}</span>
                <span style={{ fontWeight: '700', color: '#1A2130' }}>{(val as number).toFixed(2)} €</span>
              </div>
            ))}
          </div>
        </div>

        {/* ZONE PRINCIPALE */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>

          {/* FORMULAIRE CRÉATION */}
          {showForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Pré-remplir depuis commande */}
              {orders.length > 0 && (
                <div style={{ background: '#E8F0FB', borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#0E5AA7', marginBottom: '8px' }}>📋 Pré-remplir depuis une commande</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {orders.slice(0, 8).map(o => (
                      <button key={o.id} onClick={() => fillFromOrder(o)}
                        style={{ background: 'white', border: '1px solid #90CAF9', color: '#0E5AA7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                        {o.reference}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                {/* CLIENT */}
                <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>👤 Client</div>
                  {[
                    ['Nom / Raison sociale *', 'client_nom', 'text'],
                    ['Adresse', 'client_adresse', 'text'],
                    ['Code postal', 'client_cp', 'text'],
                    ['Ville', 'client_ville', 'text'],
                    ['Email', 'client_email', 'email'],
                    ['SIRET', 'client_siret', 'text'],
                  ].map(([label, key, type]) => (
                    <div key={key} style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      <input type={type} value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>

                {/* DATES + TVA */}
                <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>📅 Paramètres</div>
                  {[
                    ['Date de facture *', 'date_facture', 'date'],
                    ['Date d\'échéance', 'date_echeance', 'date'],
                  ].map(([label, key, type]) => (
                    <div key={key} style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      <input type={type} value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Taux TVA</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {TVA_TAUX.map(t => (
                        <button key={t} onClick={() => setForm((f: any) => ({ ...f, tva_taux: t }))}
                          style={{ flex: 1, background: form.tva_taux === t ? '#0E5AA7' : '#F8F9FB', color: form.tva_taux === t ? 'white' : '#4A5568', border: '1px solid #D0D4DA', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '6px', borderRadius: '5px', cursor: 'pointer' }}>
                          {t}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} rows={4}
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                </div>
              </div>

              {/* LIGNES */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>📋 Lignes de facturation</div>
                  <button onClick={addLigne}
                    style={{ background: '#E8F0FB', border: 'none', color: '#0E5AA7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
                    + Ajouter une ligne
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: '#8A95A3', fontSize: '10px', fontWeight: '700' }}>Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: '#8A95A3', fontSize: '10px', fontWeight: '700', width: '80px' }}>Qté</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: '#8A95A3', fontSize: '10px', fontWeight: '700', width: '110px' }}>P.U. HT (€)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#8A95A3', fontSize: '10px', fontWeight: '700', width: '100px' }}>Total HT</th>
                      <th style={{ width: '30px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.lignes.map((l: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F0F2F5' }}>
                        <td style={{ padding: '5px 6px' }}>
                          <input value={l.description} onChange={e => updateLigne(idx, 'description', e.target.value)}
                            placeholder="Description de la prestation"
                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #E2E6EA', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </td>
                        <td style={{ padding: '5px 6px' }}>
                          <input type="number" min="1" value={l.quantite} onChange={e => updateLigne(idx, 'quantite', e.target.value)}
                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #E2E6EA', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit', textAlign: 'center', boxSizing: 'border-box' }} />
                        </td>
                        <td style={{ padding: '5px 6px' }}>
                          <input type="number" step="0.01" value={l.prix_unitaire} onChange={e => updateLigne(idx, 'prix_unitaire', e.target.value)}
                            style={{ width: '100%', padding: '5px 8px', border: '1px solid #E2E6EA', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit', textAlign: 'center', boxSizing: 'border-box' }} />
                        </td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: '700', color: '#0E5AA7' }}>
                          {calcLigne(l).toFixed(2)} €
                        </td>
                        <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                          {form.lignes.length > 1 && (
                            <button onClick={() => removeLigne(idx)}
                              style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* TOTAUX */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <div style={{ width: '240px' }}>
                    {[
                      ['Total HT', ht.toFixed(2) + ' €', false],
                      [`TVA ${form.tva_taux}%`, tva.toFixed(2) + ' €', false],
                      ['Total TTC', ttc.toFixed(2) + ' €', true],
                    ].map(([label, val, bold]) => (
                      <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F0F2F5', fontSize: bold ? '13px' : '11px', fontWeight: bold ? '800' : '400' }}>
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
                  style={{ background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px 24px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Enregistrement…' : '💾 Créer la facture'}
                </button>
                <button onClick={() => { setShowForm(false); setMessage('') }}
                  style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* APERÇU FACTURE */}
          {selected && !showForm && !preview && (
            <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#1A2130' }}>Facture {selected.numero}</div>
                  <div style={{ fontSize: '11px', color: '#8A95A3', marginTop: '4px' }}>
                    Émise le {new Date(selected.date_facture).toLocaleDateString('fr-FR')}
                    {selected.date_echeance && ` — Échéance : ${new Date(selected.date_echeance).toLocaleDateString('fr-FR')}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {Object.entries(STATUTS).map(([k, v]: any) => (
                    <button key={k} onClick={() => updateStatut(selected.id, k)}
                      style={{ background: selected.statut === k ? v.color : v.bg, color: selected.statut === k ? 'white' : v.color, border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '10px', cursor: 'pointer' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '12px 14px', fontSize: '11px' }}>
                  <div style={{ fontWeight: '700', color: '#1A2130', marginBottom: '6px' }}>Émetteur</div>
                  <div style={{ color: '#4A5568', lineHeight: '1.8' }}>
                    <div style={{ fontWeight: '600' }}>{RGO.nom}</div>
                    <div>{RGO.adresse}</div>
                    <div>{RGO.cp} {RGO.ville}</div>
                    <div>SIRET : {RGO.siret}</div>
                    <div>TVA : {RGO.tva}</div>
                  </div>
                </div>
                <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '12px 14px', fontSize: '11px' }}>
                  <div style={{ fontWeight: '700', color: '#1A2130', marginBottom: '6px' }}>Client</div>
                  <div style={{ color: '#4A5568', lineHeight: '1.8' }}>
                    <div style={{ fontWeight: '600' }}>{selected.client_nom}</div>
                    {selected.client_adresse && <div>{selected.client_adresse}</div>}
                    {(selected.client_cp || selected.client_ville) && <div>{selected.client_cp} {selected.client_ville}</div>}
                    {selected.client_email && <div>{selected.client_email}</div>}
                    {selected.client_siret && <div>SIRET : {selected.client_siret}</div>}
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: '#1A2130', color: 'white' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left' }}>Description</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '80px' }}>Qté</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: '110px' }}>P.U. HT</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: '110px' }}>Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.lignes || []).map((l: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F0F2F5', background: idx % 2 === 0 ? 'white' : '#FAFBFC' }}>
                      <td style={{ padding: '10px 14px', color: '#1A2130' }}>{l.description}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#4A5568' }}>{l.quantite}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', color: '#4A5568' }}>{parseFloat(l.prix_unitaire).toFixed(2)} €</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#0E5AA7' }}>{(l.quantite * l.prix_unitaire).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <div style={{ width: '260px', background: '#F8F9FB', borderRadius: '8px', padding: '12px 14px' }}>
                  {[
                    ['Total HT', parseFloat(selected.montant_ht).toFixed(2) + ' €', false],
                    [`TVA ${selected.tva_taux}%`, parseFloat(selected.montant_tva).toFixed(2) + ' €', false],
                    ['Total TTC', parseFloat(selected.montant_ttc).toFixed(2) + ' €', true],
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
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Sélectionnez une facture ou créez-en une</div>
              <button onClick={() => setShowForm(true)}
                style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', marginTop: '6px' }}>
                + Nouvelle facture
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}