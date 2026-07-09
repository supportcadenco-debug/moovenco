'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '@/lib/useAuth'
const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'
const CATEGORIES = [
  { value: 'tous',  label: 'Toutes',        icon: '📍' },
  { value: 'depot', label: 'Dépôt / Garage', icon: '🏢' },
  { value: 'ecole', label: 'École',          icon: '🏫' },
  { value: 'arret', label: 'Arrêt de bus',   icon: '🚏' },
  { value: 'client',label: 'Client',         icon: '👥' },
  { value: 'site',  label: 'Site',            icon: '🏭' },
  { value: 'hotel', label: 'Hôtel',          icon: '🏨' },
  { value: 'autre', label: 'Autre',          icon: '📌' },
]
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}
const EMPTY_FORM = {
  name: '', address: '', city: '', zip_code: '',
  lat: '', lng: '', category: 'autre', is_stop: false, notes: ''
}
async function nominatimSearch(query) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=fr&addressdetails=1`)
    const data = await res.json()
    return data.map((d) => ({
      label: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      city: d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || '',
      zip: d.address?.postcode || '',
      road: d.address?.road || '',
      house_number: d.address?.house_number || '',
    }))
  } catch { return [] }
}
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`)
    const d = await res.json()
    return {
      label: d.display_name,
      city: d.address?.city || d.address?.town || d.address?.village || d.address?.municipality || '',
      zip: d.address?.postcode || '',
      road: d.address?.road || '',
      house_number: d.address?.house_number || '',
    }
  } catch { return null }
}
function LeafletMap({ lat, lng, onMapClick }) {
  const mapRef = useRef(null)
  const leafletMapRef = useRef(null)
  const markerRef = useRef(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (leafletMapRef.current) return
    const L = require('leaflet')
    delete L.Icon.Default.prototype._getIconUrl
    L.Icon.Default.mergeOptions({
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    })
    const map = L.map(mapRef.current, { zoomControl: true }).setView([lat || 47.9, lng || -1.5], lat ? 16 : 10)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)
    if (lat && lng) {
      markerRef.current = L.marker([lat, lng]).addTo(map)
    }
    map.on('click', (e) => {
      const { lat: clat, lng: clng } = e.latlng
      if (markerRef.current) {
        markerRef.current.setLatLng([clat, clng])
      } else {
        markerRef.current = L.marker([clat, clng]).addTo(map)
      }
      onMapClick(clat, clng)
    })
    leafletMapRef.current = map
    return () => { map.remove(); leafletMapRef.current = null; markerRef.current = null }
  }, [])
  useEffect(() => {
    if (!leafletMapRef.current) return
    const L = require('leaflet')
    if (lat && lng) {
      leafletMapRef.current.setView([lat, lng], 16)
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(leafletMapRef.current)
      }
    }
  }, [lat, lng])
  return (
    <>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js" />
      <div ref={mapRef} style={{ width: '100%', height: '200px', borderRadius: '8px', border: '1px solid #D0D4DA', zIndex: 0 }} />
      <div style={{ fontSize: '10px', color: '#8A95A3', textAlign: 'center', marginTop: '4px' }}>
        🖱 Cliquez sur la carte pour placer le marqueur précisément
      </div>
    </>
  )
}
export default function Adresses() {
  const { ready } = useAuth('adresses')
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [filterCat, setFilterCat] = useState('tous')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [mapKey, setMapKey] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  useEffect(() => { loadAddresses() }, [])
  async function loadAddresses() {
    const { data, error } = await supabase.from('addresses').select('*').eq('company_id', COMPANY_ID).order('city').order('name')
    if (!error) setAddresses(data || [])
    setLoading(false)
  }
  async function handleSearch() {
    if (!searchQuery) return
    setSearching(true)
    setSearchResults([])
    const results = await nominatimSearch(searchQuery)
    setSearchResults(results)
    setSearching(false)
  }
  function applyResult(result) {
    const road = result.road || result.house_number ? `${result.house_number} ${result.road}`.trim() : ''
    setForm((f) => ({
      ...f,
      address: road || result.label.split(',').slice(0, 2).join(',').trim(),
      city: result.city,
      zip_code: result.zip,
      lat: result.lat.toString(),
      lng: result.lng.toString(),
    }))
    setSearchResults([])
    setSearchQuery('')
    setShowMap(true)
    setMapKey(k => k + 1)
    setMessage('✅ Position trouvée — ajustez sur la carte si nécessaire')
  }
  async function handleMapClick(lat, lng) {
    setForm((f) => ({ ...f, lat: lat.toFixed(7), lng: lng.toFixed(7) }))
    const result = await reverseGeocode(lat, lng)
    if (result) {
      const road = result.road || result.house_number ? `${result.house_number} ${result.road}`.trim() : ''
      setForm((f) => ({
        ...f,
        lat: lat.toFixed(7),
        lng: lng.toFixed(7),
        address: road || f.address,
        city: result.city || f.city,
        zip_code: result.zip || f.zip_code,
      }))
    }
  }
  async function handleSave() {
    if (!form.name || !form.city) { setMessage('Nom et ville obligatoires'); return }
    setSaving(true)
    setMessage('')
    const payload = {
      name: form.name, address: form.address, city: form.city, zip_code: form.zip_code,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      category: form.category, is_stop: form.is_stop, notes: form.notes,
    }
    let error
    if (editingId) {
      ({ error } = await supabase.from('addresses').update(payload).eq('id', editingId))
    } else {
      ({ error } = await supabase.from('addresses').insert({ id: generateId(), company_id: COMPANY_ID, ...payload }))
    }
    if (error) setMessage('Erreur : ' + error.message)
    else {
      setMessage(editingId ? '✅ Adresse modifiée' : '✅ Adresse enregistrée')
      setForm(EMPTY_FORM); setShowForm(false); setShowMap(false); setEditingId(null); setSelected(null)
      loadAddresses()
    }
    setSaving(false)
  }

  function startEdit(addr) {
    setForm({
      name: addr.name || '', address: addr.address || '', city: addr.city || '', zip_code: addr.zip_code || '',
      lat: addr.lat != null ? String(addr.lat) : '', lng: addr.lng != null ? String(addr.lng) : '',
      category: addr.category || 'autre', is_stop: !!addr.is_stop, notes: addr.notes || '',
    })
    setEditingId(addr.id)
    setSelected(null)
    setShowForm(true)
    setShowMap(false)
    setSearchResults([])
    setMessage('')
  }

  // Vérifie si cette adresse est utilisée comme arrêt dans un ou plusieurs
  // circuits scolaires, AVANT de tenter la suppression.
  async function trouverCircuitsUtilisant(addressId) {
    const { data } = await supabase
      .from('circuit_stops')
      .select('circuit_id, circuits(name, code)')
      .eq('address_id', addressId)
    if (!data || data.length === 0) return []
    const noms = data.map((row) => {
      // Supabase type la jointure comme un tableau, même en relation 1-1
      const c = Array.isArray(row.circuits) ? row.circuits[0] : row.circuits
      return c?.code || c?.name || 'Circuit inconnu'
    })
    return [...new Set(noms)]
  }

  async function handleDelete(id) {
    if (!confirm('Supprimer cette adresse ?')) return
    setDeleting(true)
    setMessage('')

    const circuitsUtilisant = await trouverCircuitsUtilisant(id)
    if (circuitsUtilisant.length > 0) {
      setDeleting(false)
      alert(
        `Impossible de supprimer cette adresse : elle est utilisée comme arrêt dans ${circuitsUtilisant.length} circuit(s) scolaire(s) :\n\n` +
        circuitsUtilisant.map(c => `• ${c}`).join('\n') +
        `\n\nRetirez d'abord cet arrêt de ces circuits (module Scolaire) avant de le supprimer ici.`
      )
      return
    }

    const { error } = await supabase.from('addresses').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
      console.error('Erreur suppression addresses:', error)
      return
    }
    setSelected(null)
    loadAddresses()
  }

  async function toggleStop(addr) {
    await supabase.from('addresses').update({ is_stop: !addr.is_stop }).eq('id', addr.id)
    loadAddresses()
    if (selected?.id === addr.id) setSelected((s) => ({ ...s, is_stop: !s.is_stop }))
  }
  const filtered = addresses.filter(a => {
    const matchCat = filterCat === 'tous' || a.category === filterCat
    const matchSearch = !search || a.name?.toLowerCase().includes(search.toLowerCase()) || a.city?.toLowerCase().includes(search.toLowerCase()) || a.address?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })
  const grouped = filtered.reduce((acc, a) => {
    const key = a.city || 'Sans commune'
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {} as Record<string, any[]>)
  const sf = (key) => ({ target: { value } }) => setForm((f) => ({ ...f, [key]: value }))
  if (!ready) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '13px', color: '#8A95A3' }}>Chargement…</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => { setShowForm(true); setSelected(null); setForm(EMPTY_FORM); setEditingId(null); setMessage(''); setShowMap(false); setSearchResults([]) }}
          style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
          + Ajouter une adresse
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '200px', minWidth: '200px', background: 'white', borderRight: '1px solid #D0D4DA', overflow: 'auto' }}>
          <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', borderBottom: '1px solid #F0F2F5' }}>Catégories</div>
          {CATEGORIES.map(cat => {
            const count = cat.value === 'tous' ? addresses.length : addresses.filter(a => a.category === cat.value).length
            return (
              <div key={cat.value} onClick={() => setFilterCat(cat.value)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', borderLeft: `3px solid ${filterCat === cat.value ? '#0E5AA7' : 'transparent'}`, background: filterCat === cat.value ? '#E8F0FB' : 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: filterCat === cat.value ? '600' : '400', color: filterCat === cat.value ? '#0E5AA7' : '#4A5568' }}>{cat.icon} {cat.label}</span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: filterCat === cat.value ? '#0E5AA7' : '#8A95A3' }}>{count}</span>
              </div>
            )
          })}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #F0F2F5', marginTop: '4px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', marginBottom: '8px' }}>Arrêts scolaires</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4A5568' }}>
              <span>🚏 Arrêts</span>
              <span style={{ fontWeight: '700', color: '#1A2130' }}>{addresses.filter(a => a.is_stop).length}</span>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
          <div style={{ background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', padding: '7px 12px', display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <span style={{ color: '#8A95A3' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, commune, adresse…"
              style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '12px', width: '100%' }} />
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '40px' }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '60px', background: 'white', borderRadius: '10px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📍</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Aucune adresse</div>
            </div>
          ) : (
            (Object.entries(grouped) as [string, any[]][]).sort(([a], [b]) => a.localeCompare(b)).map(([city, addrs]) => (
              <div key={city} style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{city}</span>
                  <span style={{ background: '#E2E6EA', color: '#4A5568', padding: '1px 6px', borderRadius: '8px', fontSize: '9px' }}>{addrs.length}</span>
                </div>
                <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
                  {addrs.map((addr, i) => {
                    const cat = CATEGORIES.find(c => c.value === addr.category)
                    return (
                      <div key={addr.id} onClick={() => { setSelected(addr); setShowForm(false) }}
                        style={{ padding: '10px 14px', borderBottom: i < addrs.length - 1 ? '1px solid #F0F2F5' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', background: selected?.id === addr.id ? '#E8F0FB' : 'white' }}
                        onMouseEnter={e => { if (selected?.id !== addr.id) e.currentTarget.style.background = '#F5F7FA' }}
                        onMouseLeave={e => { e.currentTarget.style.background = selected?.id === addr.id ? '#E8F0FB' : 'white' }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>{cat?.icon || '📍'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A2130', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {addr.name}
                            {addr.is_stop && <span style={{ background: '#E3F2FD', color: '#1565C0', fontSize: '9px', fontWeight: '700', padding: '1px 5px', borderRadius: '4px' }}>🚏 Arrêt</span>}
                          </div>
                          <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {addr.address || '—'}
                          </div>
                        </div>
                        {addr.lat && addr.lng ? (
                          <a href={`https://www.google.com/maps?q=${addr.lat},${addr.lng}`} target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ background: '#E8F0FB', color: '#0E5AA7', fontSize: '9px', fontWeight: '700', padding: '3px 7px', borderRadius: '4px', textDecoration: 'none', flexShrink: 0 }}>
                            📍 GPS
                          </a>
                        ) : (
                          <span style={{ fontSize: '9px', color: '#D0D4DA' }}>Pas de GPS</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        {(showForm || selected) && (
          <div style={{ width: '380px', minWidth: '380px', background: 'white', borderLeft: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #D0D4DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', flexShrink: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1A2130' }}>
                {showForm ? (editingId ? '✏️ Modifier l\'adresse' : '+ Nouvelle adresse') : selected?.name}
              </div>
              <button onClick={() => { setShowForm(false); setSelected(null); setShowMap(false); setEditingId(null); setForm(EMPTY_FORM) }}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8A95A3' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
              {showForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: '#F0F7FF', borderRadius: '8px', padding: '10px 12px', border: '1px solid #BBDEFB' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', color: '#0E5AA7', marginBottom: '6px' }}>🔍 Recherche automatique</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Ex: 16 place de l'église Domagne"
                        style={{ flex: 1, padding: '6px 10px', border: '1px solid #90CAF9', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', outline: 'none' }} />
                      <button onClick={handleSearch} disabled={searching}
                        style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {searching ? '⏳' : 'GPS'}
                      </button>
                    </div>
                    {searchResults.length > 0 && (
                      <div style={{ marginTop: '6px', border: '1px solid #D0D4DA', borderRadius: '5px', overflow: 'hidden', maxHeight: '150px', overflowY: 'auto' }}>
                        {searchResults.map((r, i) => (
                          <div key={i} onClick={() => applyResult(r)}
                            style={{ padding: '7px 10px', cursor: 'pointer', borderBottom: i < searchResults.length - 1 ? '1px solid #F0F2F5' : 'none', fontSize: '10px', color: '#1A2130' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#E8F0FB'}
                            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                            {r.label.split(',').slice(0, 3).join(',')}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: '#4A5568' }}>🗺 Carte interactive</div>
                      <button onClick={() => setShowMap(m => !m)}
                        style={{ background: showMap ? '#FFEBEE' : '#E8F0FB', border: 'none', color: showMap ? '#C62828' : '#0E5AA7', fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                        {showMap ? 'Masquer' : 'Afficher la carte'}
                      </button>
                    </div>
                    {showMap && (
                      <LeafletMap
                        key={mapKey}
                        lat={parseFloat(form.lat) || 47.9}
                        lng={parseFloat(form.lng) || -1.5}
                        onMapClick={handleMapClick}
                      />
                    )}
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Nom *</label>
                    <input value={form.name} onChange={sf('name')} placeholder="École St Vincent de Paul"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Adresse</label>
                    <input value={form.address} onChange={sf('address')} placeholder="16 Place de l'Église"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Commune *</label>
                      <input value={form.city} onChange={sf('city')} placeholder="Domagne"
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Code postal</label>
                      <input value={form.zip_code} onChange={sf('zip_code')} placeholder="35113"
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Latitude</label>
                      <input value={form.lat} onChange={sf('lat')} placeholder="48.1234567"
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Longitude</label>
                      <input value={form.lng} onChange={sf('lng')} placeholder="-1.1234567"
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  {form.lat && form.lng && (
                    <a href={`https://www.google.com/maps?q=${form.lat},${form.lng}`} target="_blank" rel="noreferrer"
                      style={{ background: '#E8F0FB', color: '#0E5AA7', fontSize: '10px', fontWeight: '600', padding: '6px 10px', borderRadius: '5px', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                      🗺 Vérifier sur Google Maps
                    </a>
                  )}
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Catégorie</label>
                    <select value={form.category} onChange={sf('category')}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      {CATEGORIES.filter(c => c.value !== 'tous').map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                    </select>
                  </div>
                  <div onClick={() => setForm((f) => ({ ...f, is_stop: !f.is_stop }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: form.is_stop ? '#E3F2FD' : '#F8F9FB', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${form.is_stop ? '#90CAF9' : '#D0D4DA'}` }}>
                    <input type="checkbox" checked={form.is_stop} onChange={e => setForm((f) => ({ ...f, is_stop: e.target.checked }))}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: form.is_stop ? '#1565C0' : '#4A5568' }}>🚏 Ajouter à la liste des arrêts scolaires</span>
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Notes</label>
                    <textarea value={form.notes} onChange={sf('notes')} rows={2} placeholder="Informations complémentaires…"
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                  {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 10px', borderRadius: '5px' }}>{message}</div>}
                  <button onClick={handleSave} disabled={saving}
                    style={{ background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Enregistrement…' : (editingId ? '💾 Enregistrer les modifications' : '💾 Enregistrer')}
                  </button>
                </div>
              )}
              {selected && !showForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '28px', textAlign: 'center', padding: '8px 0' }}>
                    {CATEGORIES.find(c => c.value === selected.category)?.icon || '📍'}
                  </div>
                  <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '12px', fontSize: '11px', color: '#4A5568', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><strong style={{ color: '#1A2130' }}>Adresse :</strong> {selected.address || '—'}</div>
                    <div><strong style={{ color: '#1A2130' }}>Commune :</strong> {selected.city} {selected.zip_code ? `(${selected.zip_code})` : ''}</div>
                    <div><strong style={{ color: '#1A2130' }}>Catégorie :</strong> {CATEGORIES.find(c => c.value === selected.category)?.label || selected.category}</div>
                    {selected.lat && selected.lng && (
                      <div><strong style={{ color: '#1A2130' }}>GPS :</strong> {selected.lat}, {selected.lng}</div>
                    )}
                    {selected.notes && <div><strong style={{ color: '#1A2130' }}>Notes :</strong> {selected.notes}</div>}
                  </div>
                  {selected.lat && selected.lng && (
                    <>
                      <LeafletMap
                        key={`view-${selected.id}`}
                        lat={parseFloat(selected.lat)}
                        lng={parseFloat(selected.lng)}
                        onMapClick={() => {}}
                      />
                      <a href={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer"
                        style={{ background: '#E8F0FB', color: '#0E5AA7', fontSize: '11px', fontWeight: '600', padding: '8px 12px', borderRadius: '5px', textDecoration: 'none', display: 'block', textAlign: 'center' }}>
                        🗺 Ouvrir dans Google Maps
                      </a>
                    </>
                  )}
                  <div onClick={() => toggleStop(selected)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', background: selected.is_stop ? '#E3F2FD' : '#F8F9FB', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${selected.is_stop ? '#90CAF9' : '#D0D4DA'}` }}>
                    <input type="checkbox" checked={selected.is_stop} readOnly style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <span style={{ fontSize: '11px', fontWeight: '600', color: selected.is_stop ? '#1565C0' : '#4A5568' }}>
                      {selected.is_stop ? '🚏 Arrêt scolaire actif' : '🚏 Ajouter aux arrêts scolaires'}
                    </span>
                  </div>
                  <button onClick={() => startEdit(selected)}
                    style={{ background: '#E8F0FB', border: 'none', color: '#0E5AA7', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>
                    ✏️ Modifier cette adresse
                  </button>
                  <button onClick={() => handleDelete(selected.id)} disabled={deleting}
                    style={{ background: deleting ? '#F0F2F5' : '#FFEBEE', border: 'none', color: deleting ? '#8A95A3' : '#C62828', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px', borderRadius: '5px', cursor: deleting ? 'not-allowed' : 'pointer', width: '100%' }}>
                    {deleting ? '⏳ Vérification…' : '🗑 Supprimer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        {[
          [addresses.length, 'Adresses'],
          [addresses.filter(a => a.is_stop).length, 'Arrêts scolaires'],
          [addresses.filter(a => a.lat && a.lng).length, 'Géolocalisées'],
          [[...new Set(addresses.map(a => a.city))].length, 'Communes'],
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
