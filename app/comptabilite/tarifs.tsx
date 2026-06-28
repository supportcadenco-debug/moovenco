'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import { COMPANY_ID } from '@/lib/constants'

const TYPE_VEHICULE = ['autocar', 'minibus']
const TYPE_CLIENT   = ['mairie', 'entreprise', 'ecole', 'particulier']

export default function Tarifs() {
  const [tarifs, setTarifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editRow, setEditRow] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState({
    vehicle_type: 'autocar', client_type: 'mairie',
    tarif_km: '', tarif_journee: '', tarif_demi_journee: '', tva: '10', notes: ''
  })

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('tarifs').select('*')
      .eq('company_id', COMPANY_ID).order('vehicle_type').order('client_type')
    setTarifs(data || [])
    setLoading(false)
  }

  function startEdit(t: any) {
    setEditId(t.id)
    setEditRow({ ...t })
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('tarifs').update({
      tarif_km: parseFloat(editRow.tarif_km) || null,
      tarif_journee: parseFloat(editRow.tarif_journee) || null,
      tarif_demi_journee: parseFloat(editRow.tarif_demi_journee) || null,
      tva: parseFloat(editRow.tva) || 10,
      notes: editRow.notes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editId)
    if (error) setMessage('❌ Erreur : ' + error.message)
    else { setMessage('✅ Tarif mis à jour'); setEditId(null); load() }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  async function toggleActif(t: any) {
    await supabase.from('tarifs').update({ actif: !t.actif }).eq('id', t.id)
    load()
  }

  async function saveNew() {
    setSaving(true)
    const exists = tarifs.find(t => t.vehicle_type === newRow.vehicle_type && t.client_type === newRow.client_type)
    if (exists) { setMessage('❌ Ce couple véhicule/client existe déjà'); setSaving(false); return }
    const { error } = await supabase.from('tarifs').insert({
      id: crypto.randomUUID(), company_id: COMPANY_ID,
      vehicle_type: newRow.vehicle_type, client_type: newRow.client_type,
      tarif_km: parseFloat(newRow.tarif_km) || null,
      tarif_journee: parseFloat(newRow.tarif_journee) || null,
      tarif_demi_journee: parseFloat(newRow.tarif_demi_journee) || null,
      tva: parseFloat(newRow.tva) || 10,
      notes: newRow.notes || null,
      actif: true,
    })
    if (error) setMessage('❌ Erreur : ' + error.message)
    else {
      setMessage('✅ Tarif ajouté')
      setShowAdd(false)
      setNewRow({ vehicle_type: 'autocar', client_type: 'mairie', tarif_km: '', tarif_journee: '', tarif_demi_journee: '', tva: '10', notes: '' })
      load()
    }
    setSaving(false)
    setTimeout(() => setMessage(''), 3000)
  }

  const inp = (val: any, onChange: any, opts: any = {}) => (
    <input {...opts} value={val ?? ''} onChange={onChange}
      style={{ width: '100%', padding: '4px 6px', border: '1px solid #90CAF9', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
  )

  if (loading) return <div style={{ padding: '20px', fontSize: '13px', color: '#8A95A3' }}>Chargement…</div>

  // Grouper par véhicule
  const grouped = TYPE_VEHICULE.map(v => ({
    vehicle: v,
    rows: tarifs.filter(t => t.vehicle_type === v)
  }))

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '20px', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ maxWidth: '860px' }}>

        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130' }}>💶 Grille tarifaire</div>
          <button onClick={() => { setShowAdd(!showAdd); setMessage('') }}
            style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}>
            + Ajouter un tarif
          </button>
        </div>

        {message && (
          <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>
            {message}
          </div>
        )}

        {/* FORMULAIRE AJOUT */}
        {showAdd && (
          <div style={{ background: 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.08)', marginBottom: '16px', border: '1px solid #90CAF9' }}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130', marginBottom: '12px' }}>➕ Nouveau tarif</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', alignItems: 'end' }}>
              {[['Véhicule', 'vehicle_type'], ['Client', 'client_type']].map(([label, key]) => (
                <div key={key}>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: '#8A95A3', marginBottom: '3px' }}>{label}</div>
                  <select value={(newRow as any)[key]} onChange={e => setNewRow((r: any) => ({ ...r, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '4px 6px', border: '1px solid #90CAF9', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit' }}>
                    {(key === 'vehicle_type' ? TYPE_VEHICULE : TYPE_CLIENT).map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              ))}
              {[['€/km', 'tarif_km'], ['Journée €', 'tarif_journee'], ['½ journée €', 'tarif_demi_journee'], ['TVA %', 'tva']].map(([label, key]) => (
                <div key={key}>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: '#8A95A3', marginBottom: '3px' }}>{label}</div>
                  {inp((newRow as any)[key], (e: any) => setNewRow((r: any) => ({ ...r, [key]: e.target.value })), { type: 'number', step: '0.0001' })}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={saveNew} disabled={saving}
                  style={{ flex: 1, background: '#1A9E50', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '5px', borderRadius: '5px', cursor: 'pointer' }}>
                  ✓
                </button>
                <button onClick={() => setShowAdd(false)}
                  style={{ flex: 1, background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', padding: '5px', borderRadius: '5px', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '9px', fontWeight: '600', color: '#8A95A3', marginBottom: '3px' }}>Notes</div>
              {inp(newRow.notes, (e: any) => setNewRow((r: any) => ({ ...r, notes: e.target.value })))}
            </div>
          </div>
        )}

        {/* TABLEAUX PAR VEHICULE */}
        {grouped.map(({ vehicle, rows }) => (
          <div key={vehicle} style={{ background: 'white', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ background: '#1A2130', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{vehicle === 'autocar' ? '🚌' : '🚐'}</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: 'white', textTransform: 'capitalize' }}>{vehicle}</span>
              <span style={{ fontSize: '10px', color: '#8A95A3', marginLeft: 'auto' }}>{rows.filter(r => r.actif).length} tarif(s) actif(s)</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                  {['Type client', '€/km', 'Journée €', '½ journée €', 'TVA %', 'Notes', 'Actif', 'Actions'].map((h, i) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: i === 0 ? 'left' : 'center', fontWeight: '600', color: '#4A5568', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '16px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>Aucun tarif</td></tr>
                )}
                {rows.map((t, idx) => {
                  const isEdit = editId === t.id
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #F0F2F5', background: !t.actif ? '#FAFAFA' : idx % 2 === 0 ? 'white' : '#FAFCFF', opacity: t.actif ? 1 : 0.6 }}>
                      <td style={{ padding: '8px 12px', fontWeight: '600', color: '#1A2130', textTransform: 'capitalize' }}>{t.client_type}</td>
                      {isEdit ? (
                        <>
                          {['tarif_km', 'tarif_journee', 'tarif_demi_journee', 'tva'].map(key => (
                            <td key={key} style={{ padding: '4px 8px' }}>
                              {inp(editRow[key], (e: any) => setEditRow((r: any) => ({ ...r, [key]: e.target.value })), { type: 'number', step: '0.0001' })}
                            </td>
                          ))}
                          <td style={{ padding: '4px 8px' }}>
                            {inp(editRow.notes, (e: any) => setEditRow((r: any) => ({ ...r, notes: e.target.value })))}
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#0E5AA7', fontWeight: '700' }}>{t.tarif_km ? Number(t.tarif_km).toFixed(4) : '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#1A9E50', fontWeight: '700' }}>{t.tarif_journee ? Number(t.tarif_journee).toFixed(2) + ' €' : '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#1A9E50' }}>{t.tarif_demi_journee ? Number(t.tarif_demi_journee).toFixed(2) + ' €' : '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: '#4A5568' }}>{t.tva}%</td>
                          <td style={{ padding: '8px 12px', color: '#8A95A3', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.notes || '—'}</td>
                        </>
                      )}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button onClick={() => toggleActif(t)}
                          style={{ background: t.actif ? '#E8F5E9' : '#F0F2F5', color: t.actif ? '#1A9E50' : '#8A95A3', border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '8px', cursor: 'pointer' }}>
                          {t.actif ? '✓ Actif' : '✕ Inactif'}
                        </button>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {isEdit ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button onClick={saveEdit} disabled={saving}
                              style={{ background: '#1A9E50', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                              ✓ OK
                            </button>
                            <button onClick={() => setEditId(null)}
                              style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(t)}
                            style={{ background: '#E8F0FB', color: '#0E5AA7', border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer' }}>
                            ✏️ Modifier
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

        <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '8px' }}>
          Les tarifs actifs sont utilisés pour la tarification automatique dans les devis et factures.
        </div>
      </div>
    </div>
  )
}
