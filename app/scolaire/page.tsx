'use client'

import { useState, useEffect } from 'react'
import Navbar from '../../src/components/Navbar'
import { supabase } from '../../src/lib/supabase'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/useAuth'

const MapCircuit = dynamic(() => import('./MapCircuit'), { ssr: false })

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export default function Scolaire() {
  const { ready } = useAuth('scolaire')
  const [circuits, setCircuits] = useState([])
  const [stops, setStops] = useState({})
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newCircuit, setNewCircuit] = useState({ name: '', code: '', direction: 'aller', heure_debut: '', heure_fin: '', vehicule_defaut: '', notes: '' })
  const [vehicles, setVehicles] = useState([])
  const [editingHeures, setEditingHeures] = useState(false)
  const [pendingStops, setPendingStops] = useState([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [addingStop, setAddingStop] = useState(false)
  const [stopSearch, setStopSearch] = useState('')
  const [stopTime, setStopTime] = useState('')
  const [importText, setImportText] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: c }, { data: cs }, { data: a }, { data: v }] = await Promise.all([
      supabase.from('circuits').select('*').eq('company_id', COMPANY_ID).order('code').order('name'),
      supabase.from('circuit_stops').select('*, addresses(*)').eq('company_id', COMPANY_ID).order('order_index'),
      supabase.from('addresses').select('*').eq('company_id', COMPANY_ID).order('city').order('name'),
      supabase.from('vehicles').select('id, plate, type, seats').eq('company_id', COMPANY_ID).eq('active', true).order('plate'),
    ])
    setVehicles(v || [])
    setCircuits(c || [])
    setAddresses(a || [])
    const stopMap = {}
    ;(cs || []).forEach(s => {
      if (!stopMap[s.circuit_id]) stopMap[s.circuit_id] = []
      stopMap[s.circuit_id].push(s)
    })
    setStops(stopMap)
    setLoading(false)
  }

  function handleAddPendingStop({ name, lat, lng }) {
    const id = generateId()
    setPendingStops(prev => [...prev, {
      id, name, lat, lng,
      order_index: prev.length,
      arrival_time: '',
      addresses: { id, name, lat, lng, city: '', address: '' }
    }])
  }

  function handleRemovePendingStop(id) {
    setPendingStops(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order_index: i })))
  }

  function handleMovePendingStop(id, direction) {
    setPendingStops(prev => {
      const arr = [...prev]
      const idx = arr.findIndex(s => s.id === id)
      const newIdx = direction === 'up' ? idx - 1 : idx + 1
      if (newIdx < 0 || newIdx >= arr.length) return prev
      const tmp = arr[idx]; arr[idx] = arr[newIdx]; arr[newIdx] = tmp
      return arr.map((s, i) => ({ ...s, order_index: i }))
    })
  }

  async function handleSaveCircuit() {
    if (!newCircuit.name) { setMessage('Nom obligatoire'); return }
    setSaving(true)
    setMessage('')

    const circuitId = generateId()
    const { error: circErr } = await supabase.from('circuits').insert({
      id: circuitId, company_id: COMPANY_ID,
      name: newCircuit.name, code: newCircuit.code,
      direction: newCircuit.direction, notes: newCircuit.notes, active: true,
      heure_debut: newCircuit.heure_debut || null, heure_fin: newCircuit.heure_fin || null,
      vehicule_defaut: newCircuit.vehicule_defaut || null,
    })
    if (circErr) { setMessage('Erreur : ' + circErr.message); setSaving(false); return }

    for (let i = 0; i < pendingStops.length; i++) {
      const stop = pendingStops[i]
      const addrId = generateId()
      await supabase.from('addresses').insert({
        id: addrId, company_id: COMPANY_ID,
        name: stop.name, lat: stop.lat, lng: stop.lng,
        city: '', address: '', is_stop: true, category: 'arret',
      })
      await supabase.from('circuit_stops').insert({
        id: generateId(), company_id: COMPANY_ID,
        circuit_id: circuitId, address_id: addrId,
        order_index: i, arrival_time: stop.arrival_time || null,
      })
    }

    setMessage('✅ Circuit créé avec ' + pendingStops.length + ' arrêts')
    setCreating(false)
    setPendingStops([])
    setNewCircuit({ name: '', code: '', direction: 'aller', notes: '' })
    await loadAll()
    const { data } = await supabase.from('circuits').select('*').eq('id', circuitId).single()
    if (data) setSelected(data)
    setSaving(false)
  }

  async function handleAddStopToExisting({ name, lat, lng }) {
    if (!selected) return
    const addrId = generateId()
    await supabase.from('addresses').insert({
      id: addrId, company_id: COMPANY_ID,
      name, lat, lng, city: '', address: '', is_stop: true, category: 'arret',
    })
    const circuitStops = stops[selected.id] || []
    await supabase.from('circuit_stops').insert({
      id: generateId(), company_id: COMPANY_ID,
      circuit_id: selected.id, address_id: addrId,
      order_index: circuitStops.length,
    })
    loadAll()
  }

  async function handleAddStopFromList(address) {
    if (!selected) return
    const circuitStops = stops[selected.id] || []
    await supabase.from('circuit_stops').insert({
      id: generateId(), company_id: COMPANY_ID,
      circuit_id: selected.id, address_id: address.id,
      order_index: circuitStops.length,
      arrival_time: stopTime || null,
    })
    setStopSearch(''); setStopTime('')
    loadAll()
  }

  async function handleRemoveStop(stopId) {
    await supabase.from('circuit_stops').delete().eq('id', stopId)
    loadAll()
  }

  async function handleMoveStop(stop, direction) {
    const circuitStops = [...(stops[selected.id] || [])].sort((a, b) => a.order_index - b.order_index)
    const idx = circuitStops.findIndex(s => s.id === stop.id)
    const newIdx = direction === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= circuitStops.length) return
    const other = circuitStops[newIdx]
    await Promise.all([
      supabase.from('circuit_stops').update({ order_index: newIdx }).eq('id', stop.id),
      supabase.from('circuit_stops').update({ order_index: idx }).eq('id', other.id),
    ])
    loadAll()
  }

  async function handleToggleActive(circuit) {
    await supabase.from('circuits').update({ active: !circuit.active }).eq('id', circuit.id)
    loadAll()
  }

  async function handleImport() {
    if (!importText.trim() || !selected) return
    setImporting(true)
    const lines = importText.trim().split('\n').filter(l => l.trim())
    let created = 0, matched = 0
    for (const line of lines) {
      const parts = line.split(/[;,\t]/).map(p => p.trim()).filter(Boolean)
      if (!parts.length) continue
      const addressName = parts[0]
      const time = parts[1] || ''
      const found = addresses.find(a => a.name?.toLowerCase().includes(addressName.toLowerCase()))
      const circuitStops = stops[selected.id] || []
      if (found) {
        await supabase.from('circuit_stops').insert({ id: generateId(), company_id: COMPANY_ID, circuit_id: selected.id, address_id: found.id, order_index: circuitStops.length + matched, arrival_time: time || null })
        matched++
      } else {
        const { data: na } = await supabase.from('addresses').insert({ id: generateId(), company_id: COMPANY_ID, name: addressName, city: parts[2] || '', address: parts[0], is_stop: true, category: 'arret' }).select().single()
        if (na) { await supabase.from('circuit_stops').insert({ id: generateId(), company_id: COMPANY_ID, circuit_id: selected.id, address_id: na.id, order_index: circuitStops.length + created + matched, arrival_time: time || null }); created++ }
      }
    }
    setMessage(`✅ ${matched} correspondances, ${created} nouveaux arrêts`)
    setImportText(''); setShowImport(false)
    loadAll(); setImporting(false)
  }

  const filteredCircuits = circuits.filter(c => !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.code?.toLowerCase().includes(search.toLowerCase()))
  const circuitStops = selected ? [...(stops[selected.id] || [])].sort((a, b) => a.order_index - b.order_index) : []
  const filteredAddresses = addresses.filter(a => !stopSearch || a.name?.toLowerCase().includes(stopSearch.toLowerCase()) || a.city?.toLowerCase().includes(stopSearch.toLowerCase()))
  const nc = (key) => ({ target: { value } }) => setNewCircuit(f => ({ ...f, [key]: value }))

  if (!ready) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ECEEF1', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '13px', color: '#8A95A3' }}>Chargement…</div>
    </div>
  )
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="scolaire" />

      {/* BARRE ACTION */}
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0, gap: '6px' }}>
        {selected && !creating && (
          <button onClick={() => setShowImport(!showImport)}
            style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', padding: '4px 12px', borderRadius: '5px', cursor: 'pointer' }}>
            📥 Import liste
          </button>
        )}
        {!creating && (
          <button onClick={() => { setCreating(true); setSelected(null); setPendingStops([]); setMessage('') }}
            style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
            + Nouveau circuit
          </button>
        )}
        {creating && (
          <button onClick={() => { setCreating(false); setPendingStops([]); setMessage('') }}
            style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '4px 12px', borderRadius: '5px', cursor: 'pointer' }}>
            ✕ Annuler
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <div style={{ width: '240px', minWidth: '240px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #F0F2F5', flexShrink: 0 }}>
            <div style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', borderRadius: '5px', padding: '6px 10px', display: 'flex', gap: '6px' }}>
              <span style={{ color: '#8A95A3' }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher un circuit…"
                style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '11px', width: '100%', background: 'none' }} />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {filteredCircuits.map(circuit => {
              const stopsCount = (stops[circuit.id] || []).length
              return (
                <div key={circuit.id}
                  onClick={() => { setSelected(circuit); setCreating(false); setPendingStops([]) }}
                  style={{ padding: '10px 12px', borderBottom: '1px solid #F0F2F5', cursor: 'pointer', borderLeft: `3px solid ${selected?.id === circuit.id && !creating ? '#0E5AA7' : 'transparent'}`, background: selected?.id === circuit.id && !creating ? '#E8F0FB' : 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {circuit.code && <span style={{ background: '#1A2130', color: 'white', fontSize: '9px', fontWeight: '800', padding: '2px 5px', borderRadius: '3px' }}>{circuit.code}</span>}
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{circuit.name}</span>
                      </div>
                      <div style={{ fontSize: '9px', color: '#8A95A3', marginTop: '2px' }}>{stopsCount} arrêt{stopsCount > 1 ? 's' : ''}</div>
                    </div>
                    <span style={{ background: circuit.active ? '#E8F5E9' : '#FFEBEE', color: circuit.active ? '#1A9E50' : '#C62828', fontSize: '8px', fontWeight: '700', padding: '2px 5px', borderRadius: '5px' }}>
                      {circuit.active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              )
            })}
            {filteredCircuits.length === 0 && !loading && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>🏫</div>
                Aucun circuit
              </div>
            )}
          </div>
        </div>

        {/* ZONE PRINCIPALE */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* CREATION CIRCUIT */}
          {creating && (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: '300px', minWidth: '300px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB', flexShrink: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>🏫 Nouveau circuit</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px' }}>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '2px' }}>Code</label>
                        <input value={newCircuit.code} onChange={nc('code')} placeholder="S09"
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '2px' }}>Nom *</label>
                        <input value={newCircuit.name} onChange={nc('name')} placeholder="Circuit Martigné Matin"
                          style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '2px' }}>Direction</label>
                      <select value={newCircuit.direction} onChange={nc('direction')} style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                        <option value="aller">→ Aller</option>
                        <option value="retour">← Retour</option>
                        <option value="aller-retour">↔ Aller-Retour</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '2px' }}>Notes</label>
                      <input value={newCircuit.notes} onChange={nc('notes')} placeholder="Informations…"
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '8px' }}>
                    Arrêts placés ({pendingStops.length})
                  </div>
                  {pendingStops.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#8A95A3', fontSize: '11px', padding: '20px 0' }}>
                      <div style={{ fontSize: '20px', marginBottom: '6px' }}>🗺</div>
                      Cliquez sur la carte pour placer des arrêts
                    </div>
                  ) : (
                    pendingStops.map((stop, idx) => (
                      <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', background: '#F8F9FB', borderRadius: '5px', marginBottom: '4px', border: '1px solid #E2E6EA' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0E5AA7', color: 'white', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stop.name}</div>
                          <div style={{ fontSize: '9px', color: '#8A95A3' }}>{parseFloat(stop.lat).toFixed(4)}, {parseFloat(stop.lng).toFixed(4)}</div>
                        </div>
                        <input type="time" value={stop.arrival_time || ''} onChange={e => setPendingStops(prev => prev.map(s => s.id === stop.id ? { ...s, arrival_time: e.target.value } : s))}
                          style={{ width: '70px', padding: '3px 5px', border: '1px solid #D0D4DA', borderRadius: '4px', fontSize: '10px', fontFamily: 'inherit' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                          <button onClick={() => handleMovePendingStop(stop.id, 'up')} disabled={idx === 0} style={{ background: 'none', border: '1px solid #E2E6EA', color: '#8A95A3', fontSize: '7px', padding: '1px 4px', borderRadius: '2px', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? .4 : 1 }}>▲</button>
                          <button onClick={() => handleMovePendingStop(stop.id, 'down')} disabled={idx === pendingStops.length - 1} style={{ background: 'none', border: '1px solid #E2E6EA', color: '#8A95A3', fontSize: '7px', padding: '1px 4px', borderRadius: '2px', cursor: idx === pendingStops.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === pendingStops.length - 1 ? .4 : 1 }}>▼</button>
                        </div>
                        <button onClick={() => handleRemovePendingStop(stop.id)} style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontSize: '9px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
                      </div>
                    ))
                  )}
                </div>

                <div style={{ padding: '12px 14px', borderTop: '1px solid #E2E6EA', flexShrink: 0 }}>
                  {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '7px 10px', borderRadius: '5px', marginBottom: '8px' }}>{message}</div>}
                  <button onClick={handleSaveCircuit} disabled={saving || !newCircuit.name}
                    style={{ width: '100%', background: saving || !newCircuit.name ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: saving || !newCircuit.name ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Enregistrement…' : `💾 Créer le circuit (${pendingStops.length} arrêt${pendingStops.length > 1 ? 's' : ''})`}
                  </button>
                </div>
              </div>

              {/* Carte création */}
              <div style={{ flex: 1, padding: '12px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
                  <MapCircuit
                    stops={pendingStops}
                    onAddStop={handleAddPendingStop}
                    onEditStop={(stop) => {
                      setPendingStops(prev => prev.map(s => s.id === stop.id ? { ...s, ...stop, addresses: { ...(s.addresses || {}), ...stop.addresses } } : s))
                    }}
                    onDeleteStop={(id) => handleRemovePendingStop(id)}
                    readonly={false}
                  />
                </div>
              </div>
            </div>
          )}

          {/* VUE CIRCUIT EXISTANT */}
          {selected && !creating && (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

              {/* Panel gauche */}
              <div style={{ width: '300px', minWidth: '300px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ background: '#1A2130', color: 'white', fontSize: '12px', fontWeight: '800', padding: '4px 10px', borderRadius: '5px' }}>{selected.code || '?'}</div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A2130' }}>{selected.name}</div>
                      <div style={{ fontSize: '10px', color: '#8A95A3' }}>
                        {circuitStops.length} arrêt{circuitStops.length > 1 ? 's' : ''} • {circuitStops.filter(s => s.addresses?.lat).length} géolocalisés
                      </div>
                    </div>
                  </div>
                  {/* Heures du circuit */}
                  <div style={{ background: '#F8F9FB', borderRadius: '6px', padding: '8px 10px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#1A2130' }}>⏰ Horaires du circuit</span>
                      <button onClick={() => setEditingHeures(!editingHeures)}
                        style={{ background: 'none', border: 'none', color: '#0E5AA7', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>
                        {editingHeures ? '✕' : '✏️ Modifier'}
                      </button>
                    </div>
                    {editingHeures ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '9px', color: '#8A95A3', display: 'block', marginBottom: '2px' }}>Début</label>
                          <input type="time" defaultValue={selected.heure_debut || ''} id="edit-heure-debut"
                            style={{ width: '100%', padding: '5px 7px', border: '1px solid #D0D4DA', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '9px', color: '#8A95A3', display: 'block', marginBottom: '2px' }}>Fin</label>
                          <input type="time" defaultValue={selected.heure_fin || ''} id="edit-heure-fin"
                            style={{ width: '100%', padding: '5px 7px', border: '1px solid #D0D4DA', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit' }} />
                        </div>
                        <button onClick={async () => {
                          const debut = (document.getElementById('edit-heure-debut') as HTMLInputElement)?.value
                          const fin   = (document.getElementById('edit-heure-fin') as HTMLInputElement)?.value
                          await supabase.from('circuits').update({ heure_debut: debut, heure_fin: fin }).eq('id', selected.id)
                          setEditingHeures(false)
                          loadAll()
                          setSelected(s => ({ ...s, heure_debut: debut, heure_fin: fin }))
                        }} style={{ background: '#1A9E50', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '5px 8px', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-end' }}>
                          💾
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#4A5568' }}>
                        {selected.heure_debut ? `${selected.heure_debut} → ${selected.heure_fin || '—'}` : <span style={{ color: '#8A95A3' }}>Non renseigné</span>}
                      </div>
                    )}
                  </div>

                  {/* Véhicule par défaut */}
                  <div style={{ background: '#F8F9FB', borderRadius: '6px', padding: '8px 10px', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', color: '#1A2130' }}>🚌 Véhicule par défaut</span>
                    </div>
                    <select defaultValue={selected.vehicule_defaut || ''} onChange={async e => {
                      const val = e.target.value
                      await supabase.from('circuits').update({ vehicule_defaut: val || null }).eq('id', selected.id)
                      setSelected(s => ({ ...s, vehicule_defaut: val }))
                      loadAll()
                    }} style={{ width: '100%', padding: '5px 7px', border: '1px solid #D0D4DA', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit' }}>
                      <option value="">— Aucun —</option>
                      {vehicles.map(v => <option key={v.id} value={v.plate}>{v.plate} — {v.type} {v.seats ? v.seats+'p' : ''}</option>)}
                    </select>
                  </div>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => handleToggleActive(selected)}
                      style={{ flex: 1, background: selected.active ? '#FFEBEE' : '#E8F5E9', border: 'none', color: selected.active ? '#C62828' : '#1A9E50', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '5px', borderRadius: '5px', cursor: 'pointer' }}>
                      {selected.active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button onClick={() => setAddingStop(!addingStop)}
                      style={{ flex: 1, background: addingStop ? '#0E5AA7' : '#E8F0FB', border: 'none', color: addingStop ? 'white' : '#0E5AA7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '5px', borderRadius: '5px', cursor: 'pointer' }}>
                      {addingStop ? '✕' : '+ Carnet'}
                    </button>
                  </div>

                  {/* Import */}
                  {showImport && (
                    <div style={{ marginTop: '8px' }}>
                      <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={4}
                        placeholder="Nom arrêt ; Heure ; Commune"
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #FFD54F', borderRadius: '5px', fontSize: '10px', fontFamily: 'monospace', boxSizing: 'border-box', resize: 'vertical', background: '#FFFDE7' }} />
                      <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                        <button onClick={handleImport} disabled={importing}
                          style={{ flex: 1, background: '#D4720A', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '6px', borderRadius: '4px', cursor: 'pointer' }}>
                          {importing ? '…' : '📥 Importer'}
                        </button>
                        <button onClick={() => setShowImport(false)} style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '10px', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
                      </div>
                    </div>
                  )}

                  {/* Ajout depuis carnet */}
                  {addingStop && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                        <input value={stopSearch} onChange={e => setStopSearch(e.target.value)} placeholder="Chercher dans le carnet…"
                          style={{ flex: 1, padding: '5px 8px', border: '1px solid #D0D4DA', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit' }} />
                        <input type="time" value={stopTime} onChange={e => setStopTime(e.target.value)}
                          style={{ width: '75px', padding: '5px 6px', border: '1px solid #D0D4DA', borderRadius: '4px', fontSize: '11px', fontFamily: 'inherit' }} />
                      </div>
                      {stopSearch && (
                        <div style={{ maxHeight: '120px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {filteredAddresses.slice(0, 6).map(addr => (
                            <div key={addr.id} onClick={() => handleAddStopFromList(addr)}
                              style={{ padding: '5px 8px', background: '#F8F9FB', border: '1px solid #E2E6EA', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}
                              onMouseEnter={e => e.currentTarget.style.background = '#E8F0FB'}
                              onMouseLeave={e => e.currentTarget.style.background = '#F8F9FB'}>
                              <span style={{ fontWeight: '600' }}>{addr.name}</span>
                              <span style={{ color: '#8A95A3', marginLeft: '4px' }}>{addr.city}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Liste arrêts */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {message && <div style={{ padding: '8px 12px', background: '#E8F5E9', color: '#1A9E50', fontSize: '11px', borderBottom: '1px solid #E2E6EA' }}>{message}</div>}
                  {circuitStops.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#8A95A3', fontSize: '11px' }}>
                      <div style={{ fontSize: '20px', marginBottom: '6px' }}>🚏</div>
                      Cliquez sur la carte pour ajouter des arrêts
                    </div>
                  ) : (
                    circuitStops.map((stop, idx) => {
                      const addr = stop.addresses
                      return (
                        <div key={stop.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #F0F2F5', background: idx % 2 === 0 ? 'white' : '#FAFBFC' }}>
                          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#0E5AA7', color: 'white', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr?.name || '—'}</div>
                            <div style={{ fontSize: '9px', color: '#8A95A3' }}>
                              {stop.arrival_time && <span style={{ color: '#1565C0', fontWeight: '600' }}>{stop.arrival_time} • </span>}
                              {addr?.city || ''}{addr?.lat ? ' 📡' : ''}
                            </div>
                          </div>
                          {addr?.lat && addr?.lng && (
                            <a href={`https://www.google.com/maps?q=${addr.lat},${addr.lng}`} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()} style={{ fontSize: '12px', textDecoration: 'none', flexShrink: 0 }}>📡</a>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <button onClick={() => handleMoveStop(stop, 'up')} disabled={idx === 0} style={{ background: 'none', border: '1px solid #E2E6EA', color: '#8A95A3', fontSize: '7px', padding: '1px 4px', borderRadius: '2px', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? .4 : 1 }}>▲</button>
                            <button onClick={() => handleMoveStop(stop, 'down')} disabled={idx === circuitStops.length - 1} style={{ background: 'none', border: '1px solid #E2E6EA', color: '#8A95A3', fontSize: '7px', padding: '1px 4px', borderRadius: '2px', cursor: idx === circuitStops.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === circuitStops.length - 1 ? .4 : 1 }}>▼</button>
                          </div>
                          <button onClick={() => handleRemoveStop(stop.id)} style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontSize: '9px', padding: '2px 5px', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* Carte circuit existant */}
              <div style={{ flex: 1, padding: '12px', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.1)' }}>
                  <MapCircuit
                    stops={circuitStops}
                    onAddStop={handleAddStopToExisting}
                    onEditStop={async (stop) => {
                      await supabase.from('circuit_stops').update({ arrival_time: stop.arrival_time }).eq('id', stop.id)
                      await supabase.from('addresses').update({
                        name: stop.addresses?.name,
                        lat: stop.addresses?.lat,
                        lng: stop.addresses?.lng,
                      }).eq('id', stop.addresses?.id)
                      loadAll()
                    }}
                    onDeleteStop={(id) => handleRemoveStop(id)}
                    readonly={false}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ETAT VIDE */}
          {!selected && !creating && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: '#8A95A3' }}>
              <div style={{ fontSize: '48px', opacity: .2 }}>🏫</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Sélectionnez un circuit ou créez-en un</div>
              <button onClick={() => { setCreating(true); setPendingStops([]) }}
                style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', padding: '8px 20px', borderRadius: '6px', cursor: 'pointer', marginTop: '6px' }}>
                + Créer mon premier circuit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* STATS */}
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        {[
          [circuits.length, 'Circuits'],
          [circuits.filter(c => c.active).length, 'Actifs'],
          [Object.values(stops).flat().length, 'Arrêts total'],
          [[...new Set(Object.values(stops).flat().map(s => s.address_id))].length, 'Points uniques'],
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
