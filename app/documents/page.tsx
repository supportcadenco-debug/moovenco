'use client'

import { useState, useEffect } from 'react'
import Navbar from '../../src/components/Navbar'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const CATEGORIES = [
  { value: 'tous', label: 'Tous', icon: '📁' },
  { value: 'rh', label: 'RH & Contrats', icon: '👤' },
  { value: 'habilitation', label: 'Habilitations', icon: '📋' },
  { value: 'vehicule', label: 'Véhicules', icon: '🚌' },
  { value: 'commercial', label: 'Commercial / BC', icon: '💼' },
  { value: 'atelier', label: 'Atelier', icon: '🔧' },
  { value: 'autre', label: 'Autre', icon: '📄' },
]

const DOC_TYPES = [
  'Permis de conduire',
  'Attestation FIMO/FCO',
  'Certificat visite médicale',
  'Carte conducteur',
  'Contrat de travail',
  'RIB bancaire',
  'Carte vitale',
  'Justificatif de domicile',
  'Carte grise',
  'Contrôle technique',
  'Assurance véhicule',
  'Billet collectif',
  'Feuille de travail',
  'Ordre de mission',
  'Facture',
  'Devis',
  'Autre',
]

const EMPTY_FORM = {
  name: '', type: 'Autre', category: 'autre',
  related_to: '', expires_at: '', notes: ''
}

function daysUntil(date: string): number {
  return Math.round((new Date(date).getTime() - new Date().getTime()) / 86400000)
}

function statusTag(expires_at) {
  if (!expires_at) return null
  const j = daysUntil(expires_at)
  if (j < 0) return { label: 'Expiré', color: '#C62828', bg: '#FFEBEE' }
  if (j < 30) return { label: `${j}j`, color: '#D4720A', bg: '#FFF3E0' }
  if (j < 90) return { label: `${j}j`, color: '#1565C0', bg: '#E3F2FD' }
  return { label: 'Valide', color: '#1A9E50', bg: '#E8F5E9' }
}

export default function Documents() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterCat, setFilterCat] = useState('tous')
  const [search, setSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .order('created_at', { ascending: false })
    if (!error) setDocs(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name || !form.type) { setMessage('Nom et type obligatoires'); return }
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('documents').insert({
      company_id: COMPANY_ID,
      name: form.name,
      type: form.type,
      category: form.category,
      related_to: form.related_to || null,
      expires_at: form.expires_at || null,
      file_url: null,
      mime_type: 'application/pdf',
    })
    if (error) { setMessage('Erreur : ' + error.message) }
    else {
      setMessage('✅ Document enregistré')
      setForm(EMPTY_FORM)
      setShowForm(false)
      loadDocs()
    }
    setSaving(false)
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer ce document ?')) return
    await supabase.from('documents').delete().eq('id', id)
    setSelected(null)
    loadDocs()
  }

  const filtered = docs.filter(d => {
    const matchCat = filterCat === 'tous' || d.category === filterCat
    const matchSearch = !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.type?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const expired = docs.filter(d => d.expires_at && daysUntil(d.expires_at) < 0).length
  const expiring = docs.filter(d => d.expires_at && daysUntil(d.expires_at) >= 0 && daysUntil(d.expires_at) < 30).length

  const s = (key) => ({ target: { value } }) => setForm(f => ({ ...f, [key]: value }))

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="documents" />

      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => { setShowForm(true); setSelected(null); setForm(EMPTY_FORM) }}
          style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
          + Ajouter un document
        </button>
      </div>

      {/* ALERTES */}
      {(expired > 0 || expiring > 0) && (
        <div style={{ background: '#FFF8E1', borderBottom: '2px solid #FFD54F', padding: '6px 16px', display: 'flex', gap: '10px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#7B6B00', textTransform: 'uppercase', letterSpacing: '.4px' }}>⚡ Alertes</span>
          {expired > 0 && <span style={{ background: '#FFEBEE', color: '#C62828', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FFCDD2' }}>🚨 {expired} document{expired > 1 ? 's' : ''} expiré{expired > 1 ? 's' : ''}</span>}
          {expiring > 0 && <span style={{ background: '#FFF3E0', color: '#D4720A', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', border: '1px solid #FFE0B2' }}>⚠️ {expiring} expire{expiring > 1 ? 'nt' : ''} dans moins de 30 jours</span>}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR CATEGORIES */}
        <div style={{ width: '200px', minWidth: '200px', background: 'white', borderRight: '1px solid #D0D4DA', overflow: 'auto' }}>
          <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', borderBottom: '1px solid #F0F2F5' }}>Catégories</div>
          {CATEGORIES.map(cat => {
            const count = cat.value === 'tous' ? docs.length : docs.filter(d => d.category === cat.value).length
            return (
              <div key={cat.value} onClick={() => setFilterCat(cat.value)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', borderLeft: `3px solid ${filterCat === cat.value ? '#0E5AA7' : 'transparent'}`, background: filterCat === cat.value ? '#E8F0FB' : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all .12s' }}>
                <span style={{ fontSize: '11px', fontWeight: filterCat === cat.value ? '600' : '400', color: filterCat === cat.value ? '#0E5AA7' : '#4A5568' }}>{cat.icon} {cat.label}</span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: filterCat === cat.value ? '#0E5AA7' : '#8A95A3' }}>{count}</span>
              </div>
            )
          })}
        </div>

        {/* LISTE */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>

          {/* Recherche */}
          <div style={{ background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', padding: '7px 12px', display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <span style={{ color: '#8A95A3' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un document…"
              style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '12px', width: '100%' }} />
          </div>

          {/* Zone glisser-déposer */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); setMessage('📎 Fichier reçu — fonctionnalité de stockage à connecter (Firebase Storage / Supabase Storage)'); setTimeout(() => setMessage(''), 4000) }}
            style={{ border: `2px dashed ${dragOver ? '#0E5AA7' : '#D0D4DA'}`, borderRadius: '8px', padding: '16px', textAlign: 'center', background: dragOver ? '#E8F0FB' : 'white', color: dragOver ? '#0E5AA7' : '#8A95A3', fontSize: '11px', marginBottom: '12px', cursor: 'pointer', transition: 'all .2s' }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>📂</div>
            <strong>Glissez-déposez un fichier ici</strong> ou cliquez sur "+ Ajouter"<br />
            <span style={{ fontSize: '10px' }}>PDF, JPG, PNG — max 10 Mo</span>
          </div>

          {message && (
            <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#E3F2FD', color: message.includes('✅') ? '#1A9E50' : '#0E5AA7', fontSize: '11px', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px', fontWeight: '500' }}>
              {message}
            </div>
          )}

          {/* Grille documents */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '40px' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '60px', background: 'white', borderRadius: '10px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Aucun document</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Ajoutez des documents ou glissez-déposez des fichiers</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
              {filtered.map(doc => {
                const tag = statusTag(doc.expires_at)
                const isExpired = doc.expires_at && daysUntil(doc.expires_at) < 0
                const isExpiring = doc.expires_at && daysUntil(doc.expires_at) >= 0 && daysUntil(doc.expires_at) < 30
                return (
                  <div key={doc.id} onClick={() => { setSelected(doc); setShowForm(false) }}
                    style={{ background: 'white', borderRadius: '8px', padding: '14px', cursor: 'pointer', border: `1px solid ${isExpired ? '#FFCDD2' : isExpiring ? '#FFE0B2' : '#E2E6EA'}`, boxShadow: '0 1px 3px rgba(0,0,0,.05)', transition: 'all .12s', position: 'relative', overflow: 'hidden' }}>
                    {/* Barre status */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: isExpired ? '#C62828' : isExpiring ? '#D4720A' : '#1A9E50' }} />
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    <div style={{ fontSize: '10px', color: '#8A95A3', marginBottom: '6px' }}>{doc.type}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', color: '#8A95A3' }}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                      {tag && <span style={{ background: tag.bg, color: tag.color, fontSize: '8px', fontWeight: '700', padding: '2px 5px', borderRadius: '8px' }}>{tag.label}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PANEL DROITE */}
        {(showForm || selected) && (
          <div style={{ width: '300px', minWidth: '300px', background: 'white', borderLeft: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #D0D4DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{showForm ? '+ Nouveau document' : selected?.name}</div>
              <button onClick={() => { setShowForm(false); setSelected(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8A95A3' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
              {showForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    ['Nom du document *', 'name', 'text', 'Ex: Permis de conduire — Dupont A.'],
                    ['Lié à (conducteur, véhicule…)', 'related_to', 'text', 'Ex: Dupont Ahmed'],
                    ['Date d\'expiration', 'expires_at', 'date', ''],
                  ].map(([label, key, type, ph]) => (
                    <div key={key}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      <input type={type} value={form[key]} onChange={s(key)} placeholder={ph}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  ))}

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Type de document</label>
                    <select value={form.type} onChange={s('type')} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Catégorie</label>
                    <select value={form.category} onChange={s('category')} style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      {CATEGORIES.filter(c => c.value !== 'tous').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>

                  {message && (
                    <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 10px', borderRadius: '5px' }}>{message}</div>
                  )}

                  <button onClick={handleSave} disabled={saving}
                    style={{ background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              ) : selected ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '36px', textAlign: 'center', padding: '10px 0' }}>📄</div>

                  <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '12px', fontSize: '11px', color: '#4A5568', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div><strong style={{ color: '#1A2130' }}>Type :</strong> {selected.type}</div>
                    <div><strong style={{ color: '#1A2130' }}>Catégorie :</strong> {CATEGORIES.find(c => c.value === selected.category)?.label || selected.category}</div>
                    {selected.related_to && <div><strong style={{ color: '#1A2130' }}>Lié à :</strong> {selected.related_to}</div>}
                    <div><strong style={{ color: '#1A2130' }}>Ajouté le :</strong> {new Date(selected.created_at).toLocaleDateString('fr-FR')}</div>
                    {selected.expires_at && (
                      <div>
                        <strong style={{ color: '#1A2130' }}>Expire le :</strong> {new Date(selected.expires_at).toLocaleDateString('fr-FR')}
                        {(() => { const tag = statusTag(selected.expires_at); return tag ? <span style={{ background: tag.bg, color: tag.color, fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '6px', marginLeft: '6px' }}>{tag.label}</span> : null })()}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button style={{ flex: 1, background: '#E8F0FB', border: 'none', color: '#0E5AA7', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px', borderRadius: '5px', cursor: 'pointer' }}>
                      👁 Voir
                    </button>
                    <button style={{ flex: 1, background: '#E8F0FB', border: 'none', color: '#0E5AA7', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px', borderRadius: '5px', cursor: 'pointer' }}>
                      ⬇ Télécharger
                    </button>
                  </div>

                  <button onClick={() => handleDelete(selected.id)}
                    style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>
                    🗑 Supprimer
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* STATS */}
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        {[
          [docs.length, 'Documents'],
          [expired, 'Expirés'],
          [expiring, 'Expirent bientôt'],
          [docs.filter(d => !d.file_url).length, 'Sans fichier'],
        ].map(([v, l]) => (
          <div key={l}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: (v as number) > 0 && l !== 'Documents' ? '#EF9A9A' : 'white' }}>{v}</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
