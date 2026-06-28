'use client'

import { useState, useEffect, useRef } from 'react'
import Navbar from '../../src/components/Navbar'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '@/lib/useAuth'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'
const FUEL_TYPES = ['Diesel', 'Essence', 'Électrique', 'Hybride', 'GNV']
const VEHICLE_TYPES = ['Autocar', 'Autobus', 'Minibus', 'Véhicule léger', 'Utilitaire']
const INTERVENTION_TYPES = ['Vidange', 'Révision', 'Contrôle technique', 'Réparation', 'Pneus', 'Freins', 'Tachygraphe', 'Carrosserie', 'Autre']
const STATUS = {
  planifie: { label: 'Planifié', color: '#1565C0', bg: '#E3F2FD' },
  en_cours: { label: 'En cours', color: '#D4720A', bg: '#FFF3E0' },
  termine:  { label: 'Terminé',  color: '#1A9E50', bg: '#E8F5E9' },
  annule:   { label: 'Annulé',   color: '#C62828', bg: '#FFEBEE' },
}

function daysUntil(date) {
  if (!date) return null
  return Math.round((new Date(date) - new Date()) / 86400000)
}

function ExpiryTag({ date }) {
  if (!date) return <span style={{ fontSize: '9px', color: '#8A95A3' }}>—</span>
  const j = daysUntil(date)
  const color = j < 0 ? '#C62828' : j < 30 ? '#D4720A' : j < 90 ? '#1565C0' : '#1A9E50'
  const bg = j < 0 ? '#FFEBEE' : j < 30 ? '#FFF3E0' : j < 90 ? '#E3F2FD' : '#E8F5E9'
  const label = j < 0 ? 'Expiré' : j < 30 ? `${j}j` : new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  return <span style={{ background: bg, color, fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '8px' }}>{label}</span>
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const EMPTY_VEH = { plate: '', name: '', type: 'Autocar', brand: '', model: '', year: '', seats: '', fuel: 'Diesel', km: '', ct_expiry: '', assurance_expiry: '', tachygraphe_expiry: '', depot: '', notes: '', climatise: false }
const EMPTY_INT = { type: 'Vidange', description: '', date_intervention: '', km_intervention: '', km_next: '', cost: '', garage: '', status: 'planifie', notes: '' }

export default function Atelier() {
  const { profile: authProfile, ready } = useAuth('atelier')
  if (!ready) return null
  const [vehicles, setVehicles] = useState([])
  const [interventions, setInterventions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('vehicules')
  const [selected, setSelected] = useState(null)
  const [showVehForm, setShowVehForm] = useState(false)
  const [showIntForm, setShowIntForm] = useState(false)
  const [vehDocs, setVehDocs] = useState([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [vehForm, setVehForm] = useState(EMPTY_VEH)
  const [intForm, setIntForm] = useState(EMPTY_INT)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [reading, setReading] = useState(false)
  const fileRef = useRef(null)
  const [drivers, setDrivers] = useState([])
  const [assigningDriver, setAssigningDriver] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: v }, { data: i }] = await Promise.all([
      supabase.from('vehicles').select('*').eq('company_id', COMPANY_ID).order('plate'),
      supabase.from('interventions').select('*').eq('company_id', COMPANY_ID).order('date_intervention', { ascending: false })
    ])
    setVehicles(v || [])
    setInterventions(i || [])
    setLoading(false)
  }

  async function readCarteGrise(file) {
    setReading(true)
    setMessage('🔍 Lecture de la carte grise en cours…')
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result.split(',')[1])
        r.onerror = () => rej(new Error('Lecture échouée'))
        r.readAsDataURL(file)
      })
      const response = await fetch('/api/read-carte-grise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: base64 })
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      const parsed = result.data
      setVehForm(f => ({
        ...f,
        plate: parsed.plate || f.plate,
        brand: parsed.brand || f.brand,
        model: parsed.model || f.model,
        year: parsed.year || f.year,
        seats: parsed.seats || f.seats,
        fuel: parsed.fuel || f.fuel,
        type: parsed.type || f.type,
      }))
      setMessage('✅ Carte grise lue — vérifiez et complétez les champs')
    } catch (e) {
      setMessage('❌ Erreur lecture : ' + e.message)
    }
    setReading(false)
  }

  async function saveVehicle() {
    if (!vehForm.plate) { setMessage('Plaque obligatoire'); return }
    setSaving(true)
    const { error } = await supabase.from('vehicles').insert({
      id: generateId(), company_id: COMPANY_ID,
      plate: vehForm.plate.toUpperCase(), name: vehForm.name,
      type: vehForm.type, brand: vehForm.brand, model: vehForm.model,
      year: parseInt(vehForm.year) || null, seats: parseInt(vehForm.seats) || null,
      fuel: vehForm.fuel, km: parseInt(vehForm.km) || 0,
      ct_expiry: vehForm.ct_expiry || null,
      assurance_expiry: vehForm.assurance_expiry || null,
      tachygraphe_expiry: vehForm.tachygraphe_expiry || null,
      depot: vehForm.depot, notes: vehForm.notes,
      climatise: vehForm.climatise || false,
    })
    if (error) setMessage('Erreur : ' + error.message)
    else { setMessage('✅ Véhicule ajouté'); setVehForm(EMPTY_VEH); setShowVehForm(false); loadAll() }
    setSaving(false)
  }

  async function saveIntervention() {
    if (!selected || !intForm.date_intervention) { setMessage('Date obligatoire'); return }
    setSaving(true)
    const { error } = await supabase.from('interventions').insert({
      id: generateId(), company_id: COMPANY_ID, vehicle_id: selected.id,
      type: intForm.type, description: intForm.description,
      date_intervention: intForm.date_intervention,
      km_intervention: parseInt(intForm.km_intervention) || null,
      km_next: parseInt(intForm.km_next) || null,
      cost: parseFloat(intForm.cost) || null,
      garage: intForm.garage, status: intForm.status, notes: intForm.notes,
    })
    if (error) setMessage('Erreur : ' + error.message)
    else { setMessage('✅ Intervention enregistrée'); setIntForm(EMPTY_INT); setShowIntForm(false); loadAll() }
    setSaving(false)
  }

  function countAlerts(v) {
    let n = 0
    if (v.ct_expiry && daysUntil(v.ct_expiry) < 30) n++
    if (v.assurance_expiry && daysUntil(v.assurance_expiry) < 30) n++
    if (v.tachygraphe_expiry && daysUntil(v.tachygraphe_expiry) < 30) n++
    return n
  }

  const vehInterventions = selected ? interventions.filter(i => i.vehicle_id === selected.id) : []
  const sv = (key) => ({ target: { value } }) => setVehForm(f => ({ ...f, [key]: value }))
  const si = (key) => ({ target: { value } }) => setIntForm(f => ({ ...f, [key]: value }))
  const filtered = vehicles.filter(v => !search || v.plate.toLowerCase().includes(search.toLowerCase()) || v.name?.toLowerCase().includes(search.toLowerCase()))

  const DOC_CATS_VEHICULE = [
    { key: 'carte_grise',  label: '📋 Carte grise' },
    { key: 'assurance',    label: '🛡️ Assurance' },
    { key: 'ct',           label: '🔍 Contrôle technique' },
    { key: 'tachygraphe',  label: '⏱️ Tachygraphe' },
    { key: 'autre',        label: '📎 Autre' },
  ]

  async function loadVehDocs(vehicleId) {
    const { data } = await supabase.from('module_documents').select('*')
      .eq('entity_id', vehicleId).order('created_at', { ascending: false })
    setVehDocs(data || [])
  }

  async function uploadVehDoc(file, categorie) {
    if (!file || !selected) return
    setUploadingDoc(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `atelier/${selected.id}/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from('driver-documents').upload(path, file, { upsert: false })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(path)
        await supabase.from('module_documents').insert({
          company_id: COMPANY_ID, module: 'atelier', entity_id: selected.id,
          nom: file.name, categorie, url: urlData.publicUrl, taille: file.size,
        })
        await loadVehDocs(selected.id)
      }
    } catch(e) { console.error(e) }
    setUploadingDoc(false)
  }

  async function deleteVehDoc(doc) {
    if (!confirm('Supprimer ?')) return
    await supabase.from('module_documents').delete().eq('id', doc.id)
    setVehDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  async function assignDriver(driverId) {
    if (!selected) return
    setAssigningDriver(true)
    await supabase.from('vehicles').update({ assigned_driver: driverId || null }).eq('id', selected.id)
    setSelected(s => ({ ...s, assigned_driver: driverId }))
    await loadAll()
    setAssigningDriver(false)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="atelier" />

      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => { setShowVehForm(true); setSelected(null); setMessage('') }}
          style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
          + Ajouter un véhicule
        </button>
      </div>

      
      {/* SOUS-ONGLETS */}
      <div style={{ background: 'white', borderBottom: '1px solid #D0D4DA', display: 'flex', padding: '0 16px', flexShrink: 0 }}>
        {[['vehicules','🚌 Véhicules'],['interventions','🔧 Interventions']].map(([v, l]) => (
          <button key={v} onClick={() => setActiveView(v)}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: '11px', fontWeight: activeView === v ? '600' : '400', color: activeView === v ? '#0E5AA7' : '#8A95A3', padding: '10px 14px', cursor: 'pointer', borderBottom: `2px solid ${activeView === v ? '#0E5AA7' : 'transparent'}` }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LISTE VEHICULES */}
        <div style={{ width: '260px', minWidth: '260px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0F2F5', flexShrink: 0 }}>
            <div style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', borderRadius: '5px', padding: '6px 10px', display: 'flex', gap: '6px' }}>
              <span style={{ color: '#8A95A3' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Plaque ou nom…"
                style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '11px', width: '100%', background: 'none' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filtered.map(v => {
              const alerts = countAlerts(v)
              return (
                <div key={v.id} onClick={() => { setSelected(v); setShowVehForm(false); setShowIntForm(false) }}
                  style={{ padding: '10px 12px', borderBottom: '1px solid #F0F2F5', cursor: 'pointer', borderLeft: `3px solid ${selected?.id === v.id ? '#0E5AA7' : 'transparent'}`, background: selected?.id === v.id ? '#E8F0FB' : 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {v.plate}
                        {v.climatise && <span style={{ fontSize: '10px' }}>❄️</span>}
                      </div>
                      <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '1px' }}>{v.brand} {v.model} • {v.type} {v.seats ? `${v.seats}p` : ''}</div>
                      <div style={{ fontSize: '10px', color: '#4A5568', marginTop: '1px' }}>{v.km ? v.km.toLocaleString('fr-FR') + ' km' : '—'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                      <span style={{ background: v.active ? '#E8F5E9' : '#FFEBEE', color: v.active ? '#1A9E50' : '#C62828', fontSize: '8px', fontWeight: '700', padding: '2px 5px', borderRadius: '6px' }}>{v.active ? 'Actif' : 'Inactif'}</span>
                      {alerts > 0 && <span style={{ background: '#FFEBEE', color: '#C62828', fontSize: '8px', fontWeight: '700', padding: '2px 5px', borderRadius: '6px' }}>⚠ {alerts}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && !loading && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>Aucun véhicule</div>
            )}
          </div>
        </div>

        {/* CONTENU */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>

          {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : message.includes('🔍') ? '#E3F2FD' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : message.includes('🔍') ? '#1565C0' : '#C62828', fontSize: '11px', padding: '8px 12px', borderRadius: '6px', marginBottom: '12px' }}>{message}</div>}

          {/* FORM NOUVEAU VEHICULE */}
          {showVehForm && (
            <div style={{ background: 'white', borderRadius: '10px', padding: '16px', marginBottom: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A2130' }}>🚌 Nouveau véhicule</div>
                <div>
                  <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) readCarteGrise(e.target.files[0]) }} />
                  <button onClick={() => fileRef.current?.click()} disabled={reading}
                    style={{ background: reading ? '#8A95A3' : '#7B1FA2', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '5px', cursor: reading ? 'not-allowed' : 'pointer' }}>
                    {reading ? '⏳ Lecture…' : '📄 Lire carte grise (PDF)'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                {[['Plaque *', 'plate', 'text'], ['Nom / Surnom', 'name', 'text'], ['Marque', 'brand', 'text'], ['Modèle', 'model', 'text'], ['Année', 'year', 'number'], ['Nombre de places', 'seats', 'number'], ['Kilométrage', 'km', 'number'], ['Dépôt', 'depot', 'text']].map(([label, key, type]) => (
                  <div key={key}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                    <input type={type} value={vehForm[key]} onChange={sv(key)}
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box', background: vehForm[key] ? '#FFFDE7' : 'white' }} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Type</label>
                  <select value={vehForm.type} onChange={sv('type')} style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                    {VEHICLE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Carburant</label>
                  <select value={vehForm.fuel} onChange={sv('fuel')} style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                    {FUEL_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                {[['CT — expiration', 'ct_expiry'], ['Assurance — expiration', 'assurance_expiry'], ['Tachygraphe — expiration', 'tachygraphe_expiry']].map(([label, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                    <input type="date" value={vehForm[key]} onChange={sv(key)}
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>

              {/* CLIMATISE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: vehForm.climatise ? '#E3F2FD' : '#F8F9FB', borderRadius: '6px', marginBottom: '12px', cursor: 'pointer', border: `1px solid ${vehForm.climatise ? '#90CAF9' : '#D0D4DA'}` }}
                onClick={() => setVehForm(f => ({ ...f, climatise: !f.climatise }))}>
                <input type="checkbox" checked={vehForm.climatise || false}
                  onChange={e => setVehForm(f => ({ ...f, climatise: e.target.checked }))}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: vehForm.climatise ? '#1565C0' : '#4A5568' }}>
                  ❄️ Véhicule climatisé
                </span>
                {vehForm.climatise && <span style={{ fontSize: '10px', color: '#1565C0', marginLeft: 'auto' }}>Sera proposé en priorité pour les demandes climatisées</span>}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={saveVehicle} disabled={saving}
                  style={{ background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '9px 20px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                  {saving ? 'Enregistrement…' : '💾 Enregistrer'}
                </button>
                <button onClick={() => { setShowVehForm(false); setMessage('') }}
                  style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '9px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* DETAIL VEHICULE */}
          {selected && !showVehForm && (
            <>
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '32px' }}>🚌</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#1A2130', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selected.plate}
                    {selected.climatise && <span style={{ background: '#E3F2FD', color: '#1565C0', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>❄️ Climatisé</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#8A95A3' }}>{selected.brand} {selected.model} {selected.year ? `(${selected.year})` : ''} • {selected.type} {selected.seats ? `${selected.seats}p` : ''} • {selected.fuel}</div>
                  <div style={{ fontSize: '11px', color: '#4A5568', marginTop: '2px' }}>📍 {selected.depot || 'Dépôt non renseigné'} • {selected.km ? selected.km.toLocaleString('fr-FR') + ' km' : '—'}</div>
                </div>
                <button onClick={() => setShowIntForm(true)}
                  style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer' }}>
                  + Intervention
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                {[['🔍 Contrôle Technique', selected.ct_expiry], ['🛡 Assurance', selected.assurance_expiry], ['⏱ Tachygraphe', selected.tachygraphe_expiry]].map(([label, date]) => (
                  <div key={label} style={{ background: 'white', borderRadius: '8px', padding: '12px 14px', boxShadow: '0 1px 2px rgba(0,0,0,.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#4A5568' }}>{label}</span>
                    <ExpiryTag date={date} />
                  </div>
                ))}
              </div>

              {showIntForm && (
                <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130', marginBottom: '12px' }}>🔧 Nouvelle intervention — {selected.plate}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Type *</label>
                      <select value={intForm.type} onChange={si('type')} style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                        {INTERVENTION_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Date *</label>
                      <input type="date" value={intForm.date_intervention} onChange={si('date_intervention')}
                        style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Statut</label>
                      <select value={intForm.status} onChange={si('status')} style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                        {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                    {[['Description', 'description', 'text'], ['Garage', 'garage', 'text'], ['Km intervention', 'km_intervention', 'number'], ['Prochain entretien km', 'km_next', 'number'], ['Coût (€)', 'cost', 'number']].map(([label, key, type]) => (
                      <div key={key}>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                        <input type={type} value={intForm[key]} onChange={si(key)}
                          style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={saveIntervention} disabled={saving}
                      style={{ background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '9px 20px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                      {saving ? 'Enregistrement…' : '💾 Enregistrer'}
                    </button>
                    <button onClick={() => setShowIntForm(false)}
                      style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '9px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#1A2130', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB' }}>
                  🔧 Historique interventions ({vehInterventions.length})
                </div>
                {vehInterventions.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>Aucune intervention enregistrée</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                        {['Date', 'Type', 'Description', 'Km', 'Coût', 'Garage', 'Statut'].map(h => (
                          <th key={h} style={{ padding: '8px 12px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.4px', color: '#8A95A3', textAlign: 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vehInterventions.map((int, i) => {
                        const st = STATUS[int.status] || STATUS.planifie
                        return (
                          <tr key={int.id} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                            <td style={{ padding: '8px 12px', fontSize: '11px', color: '#4A5568' }}>{new Date(int.date_intervention).toLocaleDateString('fr-FR')}</td>
                            <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{int.type}</td>
                            <td style={{ padding: '8px 12px', fontSize: '11px', color: '#4A5568' }}>{int.description || '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '11px', color: '#4A5568' }}>{int.km_intervention ? int.km_intervention.toLocaleString('fr-FR') : '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{int.cost ? int.cost.toFixed(2) + ' €' : '—'}</td>
                            <td style={{ padding: '8px 12px', fontSize: '11px', color: '#4A5568' }}>{int.garage || '—'}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ background: st.bg, color: st.color, fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '8px' }}>{st.label}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              {/* CONDUCTEUR ASSIGNÉ */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>👤 Conducteur assigné</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={selected.assigned_driver || ''} onChange={e => assignDriver(e.target.value)}
                    style={{ flex: 1, padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                    <option value="">— Non assigné —</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {assigningDriver && <span style={{ fontSize: '11px', color: '#8A95A3' }}>⏳</span>}
                </div>
              </div>

              {/* DOCUMENTS DU VÉHICULE */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>📎 Documents véhicule</div>
                {DOC_CATS_VEHICULE.map(cat => {
                  const catDocs = vehDocs.filter(d => d.categorie === cat.key)
                  return (
                    <div key={cat.key} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: '#8A95A3' }}>{cat.label}</div>
                        <label style={{ background: uploadingDoc ? '#8A95A3' : '#E8F0FB', color: '#0E5AA7', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '4px', cursor: uploadingDoc ? 'not-allowed' : 'pointer' }}>
                          {uploadingDoc ? '⏳' : '+ Ajouter'}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} disabled={uploadingDoc}
                            onChange={e => { if (e.target.files?.[0]) uploadVehDoc(e.target.files[0], cat.key) }} />
                        </label>
                      </div>
                      {catDocs.length === 0 ? (
                        <div style={{ fontSize: '10px', color: '#8A95A3', padding: '5px 8px', background: '#F8F9FB', borderRadius: '4px' }}>Aucun document</div>
                      ) : catDocs.map(doc => (
                        <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', background: 'white', border: '1px solid #E2E6EA', borderRadius: '4px', marginBottom: '3px' }}>
                          <span>{doc.nom?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                          <a href={doc.url} target="_blank" rel="noreferrer"
                            style={{ flex: 1, fontSize: '11px', fontWeight: '600', color: '#0E5AA7', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.nom}
                          </a>
                          <span style={{ fontSize: '10px', color: '#8A95A3' }}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                          <button onClick={() => deleteVehDoc(doc)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '13px' }}>🗑</button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {activeView === 'interventions' && !selected && (
            <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#1A2130', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB' }}>
                🔧 Toutes les interventions ({interventions.length})
              </div>
              {interventions.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>Aucune intervention</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                      {['Véhicule', 'Date', 'Type', 'Description', 'Coût', 'Statut'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.4px', color: '#8A95A3', textAlign: 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {interventions.map((int, i) => {
                      const veh = vehicles.find(v => v.id === int.vehicle_id)
                      const st = STATUS[int.status] || STATUS.planifie
                      return (
                        <tr key={int.id} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                          <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>{veh?.plate || '—'}</td>
                          <td style={{ padding: '8px 12px', fontSize: '11px', color: '#4A5568' }}>{new Date(int.date_intervention).toLocaleDateString('fr-FR')}</td>
                          <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{int.type}</td>
                          <td style={{ padding: '8px 12px', fontSize: '11px', color: '#4A5568' }}>{int.description || '—'}</td>
                          <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{int.cost ? int.cost.toFixed(2) + ' €' : '—'}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ background: st.bg, color: st.color, fontSize: '9px', fontWeight: '700', padding: '2px 7px', borderRadius: '8px' }}>{st.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {!selected && !showVehForm && activeView === 'vehicules' && (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '60px', background: 'white', borderRadius: '10px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚌</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Sélectionnez un véhicule ou ajoutez-en un</div>
              <div style={{ fontSize: '11px', marginTop: '4px' }}>Vous pouvez importer la carte grise PDF pour pré-remplir automatiquement</div>
            </div>
          )}
        </div>
      </div>

      {/* STATS */}
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        {[
          [vehicles.filter(v => v.active).length, 'Véhicules actifs'],
          [vehicles.filter(v => v.climatise).length, 'Climatisés ❄️'],
          [interventions.filter(i => i.status === 'planifie').length, 'Interventions planifiées'],
          [vehicles.filter(v => countAlerts(v) > 0).length, 'Avec alertes'],
        ].map(([v, l]) => (
          <div key={l}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{v}</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
