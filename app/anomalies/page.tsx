'use client'

import { useState, useEffect } from 'react'
import Navbar from '../../src/components/Navbar'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '@/lib/useAuth'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const SEVERITY = {
  faible:  { label: 'Faible',  color: '#1565C0', bg: '#E3F2FD' },
  moyen:   { label: 'Moyen',   color: '#D4720A', bg: '#FFF3E0' },
  grave:   { label: 'Grave',   color: '#C62828', bg: '#FFEBEE' },
  critique:{ label: 'Critique',color: '#7B1FA2', bg: '#F3E5F5' },
}

const STATUS = {
  ouvert:     { label: 'Ouvert',      color: '#C62828', bg: '#FFEBEE' },
  en_cours:   { label: 'En cours',    color: '#D4720A', bg: '#FFF3E0' },
  resolu:     { label: 'Résolu',      color: '#1A9E50', bg: '#E8F5E9' },
  clos:       { label: 'Clôturé',     color: '#37474F', bg: '#ECEFF1' },
}

const TYPES = [
  'Incident conducteur',
  'Incident passager',
  'Panne véhicule',
  'Accident',
  'Retard',
  'Réclamation client',
  'Problème matériel',
  'Infraction',
  'Autre',
]

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const EMPTY_FORM = {
  type: 'Incident conducteur', title: '', description: '',
  severity: 'moyen', related_to: '', notes: '', date_reported: new Date().toISOString().split('T')[0]
}

export default function Anomalies() {
  const { ready } = useAuth('anomalies')
  if (!ready) return null
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('tous')
  const [filterSeverity, setFilterSeverity] = useState('tous')
  const [search, setSearch] = useState('')

  useEffect(() => { loadAnomalies() }, [])

  async function loadAnomalies() {
    const { data, error } = await supabase
      .from('anomalies')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
    if (!error) setAnomalies(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.title) { setMessage('Titre obligatoire'); return }
    setSaving(true)
    const { error } = await supabase.from('anomalies').insert({
      id: generateId(),
      company_id: COMPANY_ID,
      type: form.type,
      title: form.title,
      description: form.description,
      severity: form.severity,
      status: 'ouvert',
      related_to: form.related_to || null,
      date_reported: form.date_reported,
      notes: form.notes,
    })
    if (error) setMessage('Erreur : ' + error.message)
    else {
      setMessage('✅ Anomalie signalée')
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadAnomalies()
    }
    setSaving(false)
  }

  async function updateStatus(id, status) {
    const update = { status }
    if (status === 'resolu' || status === 'clos') update.date_closed = new Date().toISOString().split('T')[0]
    await supabase.from('anomalies').update(update).eq('id', id)
    loadAnomalies()
    if (selected?.id === id) setSelected(s => ({ ...s, ...update }))
  }

  const filtered = anomalies.filter(a => {
    const matchStatus = filterStatus === 'tous' || a.status === filterStatus
    const matchSev = filterSeverity === 'tous' || a.severity === filterSeverity
    const matchSearch = !search || a.title?.toLowerCase().includes(search.toLowerCase()) || a.type?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSev && matchSearch
  })

  const open = anomalies.filter(a => a.status === 'ouvert').length
  const critical = anomalies.filter(a => a.severity === 'critique' && a.status !== 'clos').length

  const s = (key) => ({ target: { value } }) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="anomalies" />

      {/* BARRE ACTION */}
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => { setShowForm(true); setSelected(null) }}
          style={{ background: '#C62828', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
          ⚠️ Signaler une anomalie
        </button>
      </div>

      {/* ALERTES */}
      {(open > 0 || critical > 0) && (
        <div style={{ background: '#FFF8E1', borderBottom: '2px solid #FFD54F', padding: '6px 16px', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#7B6B00', textTransform: 'uppercase', letterSpacing: '.4px' }}>⚡ Alertes</span>
          {open > 0 && <span style={{ background: '#FFEBEE', color: '#C62828', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FFCDD2' }}>🚨 {open} anomalie{open > 1 ? 's' : ''} ouverte{open > 1 ? 's' : ''}</span>}
          {critical > 0 && <span style={{ background: '#F3E5F5', color: '#7B1FA2', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', border: '1px solid #E1BEE7' }}>🔴 {critical} critique{critical > 1 ? 's' : ''}</span>}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LISTE */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>

          {/* Filtres */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', padding: '6px 10px', display: 'flex', gap: '6px', flex: 1, minWidth: '200px' }}>
              <span style={{ color: '#8A95A3' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '12px', width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {Object.entries(STATUS).map(([k, v]) => (
                <button key={k} onClick={() => setFilterStatus(filterStatus === k ? 'tous' : k)}
                  style={{ background: filterStatus === k ? v.color : v.bg, color: filterStatus === k ? 'white' : v.color, border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '10px', cursor: 'pointer' }}>
                  {v.label} {anomalies.filter(a => a.status === k).length}
                </button>
              ))}
              {filterStatus !== 'tous' && <button onClick={() => setFilterStatus('tous')} style={{ background: 'none', border: 'none', color: '#8A95A3', fontSize: '11px', cursor: 'pointer' }}>✕</button>}
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              {Object.entries(SEVERITY).map(([k, v]) => (
                <button key={k} onClick={() => setFilterSeverity(filterSeverity === k ? 'tous' : k)}
                  style={{ background: filterSeverity === k ? v.color : v.bg, color: filterSeverity === k ? 'white' : v.color, border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '4px 10px', borderRadius: '10px', cursor: 'pointer' }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tableau */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '40px' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '60px', background: 'white', borderRadius: '10px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Aucune anomalie</div>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                    {['Date', 'Type', 'Titre', 'Gravité', 'Lié à', 'Statut', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((ano, i) => {
                    const sev = SEVERITY[ano.severity] || SEVERITY.moyen
                    const st = STATUS[ano.status] || STATUS.ouvert
                    return (
                      <tr key={ano.id} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC', cursor: 'pointer' }}
                        onClick={() => { setSelected(ano); setShowForm(false) }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F5F7FA'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC'}>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: '#4A5568', whiteSpace: 'nowrap' }}>{new Date(ano.date_reported).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: '#4A5568' }}>{ano.type}</td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{ano.title}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: sev.bg, color: sev.color, fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '8px' }}>{sev.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '11px', color: '#4A5568' }}>{ano.related_to || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ background: st.bg, color: st.color, fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '8px' }}>{st.label}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {ano.status === 'ouvert' && <button onClick={() => updateStatus(ano.id, 'en_cours')} style={{ background: '#FFF3E0', border: 'none', color: '#D4720A', fontSize: '9px', fontWeight: '600', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer' }}>Prendre en charge</button>}
                            {ano.status === 'en_cours' && <button onClick={() => updateStatus(ano.id, 'resolu')} style={{ background: '#E8F5E9', border: 'none', color: '#1A9E50', fontSize: '9px', fontWeight: '600', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer' }}>Résoudre</button>}
                            {ano.status === 'resolu' && <button onClick={() => updateStatus(ano.id, 'clos')} style={{ background: '#ECEFF1', border: 'none', color: '#37474F', fontSize: '9px', fontWeight: '600', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer' }}>Clôturer</button>}
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
          <div style={{ width: '320px', minWidth: '320px', background: 'white', borderLeft: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #D0D4DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{showForm ? '⚠️ Signaler' : selected?.title}</div>
              <button onClick={() => { setShowForm(false); setSelected(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8A95A3' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
              {showForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Titre *</label>
                    <input value={form.title} onChange={s('title')} placeholder="Résumé de l'anomalie"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Type</label>
                    <select value={form.type} onChange={s('type')} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Gravité</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {Object.entries(SEVERITY).map(([k, v]) => (
                        <button key={k} onClick={() => setForm(f => ({ ...f, severity: k }))}
                          style={{ flex: 1, background: form.severity === k ? v.color : v.bg, color: form.severity === k ? 'white' : v.color, border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '5px', borderRadius: '5px', cursor: 'pointer' }}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Date</label>
                    <input type="date" value={form.date_reported} onChange={s('date_reported')}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Lié à (conducteur, véhicule…)</label>
                    <input value={form.related_to} onChange={s('related_to')} placeholder="Ex: Dupont Ahmed, GZ-795-QG"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Description</label>
                    <textarea value={form.description} onChange={s('description')} rows={3} placeholder="Détails de l'anomalie…"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Notes internes</label>
                    <textarea value={form.notes} onChange={s('notes')} rows={2}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                  {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 10px', borderRadius: '5px' }}>{message}</div>}
                  <button onClick={handleSave} disabled={saving}
                    style={{ background: saving ? '#8A95A3' : '#C62828', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Enregistrement…' : '⚠️ Signaler l\'anomalie'}
                  </button>
                </div>
              ) : selected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {Object.entries(STATUS).map(([k, v]) => (
                      <button key={k} onClick={() => updateStatus(selected.id, k)}
                        style={{ background: selected.status === k ? v.color : v.bg, color: selected.status === k ? 'white' : v.color, border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '10px', cursor: 'pointer' }}>
                        {v.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '12px', fontSize: '11px', color: '#4A5568', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div><strong style={{ color: '#1A2130' }}>Type :</strong> {selected.type}</div>
                    <div><strong style={{ color: '#1A2130' }}>Date :</strong> {new Date(selected.date_reported).toLocaleDateString('fr-FR')}</div>
                    <div><strong style={{ color: '#1A2130' }}>Gravité :</strong> <span style={{ background: SEVERITY[selected.severity]?.bg, color: SEVERITY[selected.severity]?.color, fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '6px' }}>{SEVERITY[selected.severity]?.label}</span></div>
                    {selected.related_to && <div><strong style={{ color: '#1A2130' }}>Lié à :</strong> {selected.related_to}</div>}
                    {selected.date_closed && <div><strong style={{ color: '#1A2130' }}>Clôturé le :</strong> {new Date(selected.date_closed).toLocaleDateString('fr-FR')}</div>}
                  </div>
                  {selected.description && (
                    <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '5px' }}>Description</div>
                      <div style={{ fontSize: '11px', color: '#4A5568', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selected.description}</div>
                    </div>
                  )}
                  {selected.notes && (
                    <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '5px' }}>Notes internes</div>
                      <div style={{ fontSize: '11px', color: '#4A5568', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selected.notes}</div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* STATS */}
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        {[
          [anomalies.length, 'Total'],
          [open, 'Ouvertes'],
          [anomalies.filter(a => a.status === 'en_cours').length, 'En cours'],
          [critical, 'Critiques'],
          [anomalies.filter(a => a.status === 'clos').length, 'Clôturées'],
        ].map(([v, l]) => (
          <div key={l}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: v > 0 && (l === 'Ouvertes' || l === 'Critiques') ? '#EF9A9A' : 'white' }}>{v}</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
