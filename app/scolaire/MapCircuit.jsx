'use client'

import { useEffect, useRef, useState } from 'react'

export default function MapCircuit({ stops, onAddStop, onEditStop, onDeleteStop, readonly = false }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef([])
  const routeRef = useRef(null)
  const [clickedPos, setClickedPos] = useState(null)
  const [newStopName, setNewStopName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingStop, setEditingStop] = useState(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  useEffect(() => {
    if (mapInstance.current) return

    import('leaflet').then(L => {
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current, { center: [48.1, -1.7], zoom: 11 })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(map)

      mapInstance.current = { map, L }

      if (!readonly) {
        map.on('click', (e) => {
          setClickedPos({ lat: e.latlng.lat, lng: e.latlng.lng })
          setNewStopName('')
          setEditingStop(null)
        })
      }

      renderMarkers({ map, L })
    })

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    if (!mapInstance.current) return
    renderMarkers(mapInstance.current)
  }, [stops])

  async function fetchOSRMRoute(coords) {
    if (coords.length < 2) return null
    try {
      const coordStr = coords.map(c => `${c[1]},${c[0]}`).join(';')
      const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`
      const res = await fetch(url)
      const data = await res.json()
      if (data.code === 'Ok' && data.routes?.length > 0) {
        return data.routes[0].geometry.coordinates.map(c => [c[1], c[0]])
      }
    } catch (e) { console.error('OSRM error:', e) }
    return null
  }

  async function renderMarkers({ map, L }) {
    // Supprimer anciens marqueurs et route
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (routeRef.current) { routeRef.current.remove(); routeRef.current = null }

    const validStops = stops.filter(s => {
      const addr = s.addresses || s
      return addr?.lat && addr?.lng
    })
    if (validStops.length === 0) return

    const bounds = []

    validStops.forEach((stop, idx) => {
      const addr = stop.addresses || stop
      const lat = parseFloat(addr.lat)
      const lng = parseFloat(addr.lng)
      const name = addr.name || stop.name || '—'
      const time = stop.arrival_time || ''

      const icon = L.divIcon({
        html: `<div style="
          background: #0E5AA7;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 800;
          font-family: Inter, sans-serif;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,.3);
          cursor: pointer;
        ">${idx + 1}</div>`,
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      })

      const marker = L.marker([lat, lng], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; min-width: 180px;">
            <div style="font-weight: 700; font-size: 12px; color: #1A2130; margin-bottom: 6px;">
              ${idx + 1}. ${name}
            </div>
            ${time ? `<div style="font-size: 10px; font-weight: 600; color: #1565C0; margin-bottom: 6px;">🕐 ${time}</div>` : ''}
            <div style="font-size: 10px; color: #8A95A3; margin-bottom: 8px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
            ${!readonly ? `
              <button onclick="window.__editStop('${stop.id || stop.addresses?.id}')" style="
                background: #0E5AA7; color: white; border: none; border-radius: 4px;
                font-size: 10px; font-weight: 600; padding: 4px 10px; cursor: pointer; margin-right: 5px;
              ">✏️ Modifier</button>
              <button onclick="window.__deleteStop('${stop.id || stop.addresses?.id}')" style="
                background: #FFEBEE; color: #C62828; border: none; border-radius: 4px;
                font-size: 10px; font-weight: 600; padding: 4px 10px; cursor: pointer;
              ">🗑 Supprimer</button>
            ` : ''}
            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank"
              style="font-size: 10px; color: #1A9E50; text-decoration: none; display: block; margin-top: 8px;">
              📡 Ouvrir dans Maps
            </a>
          </div>
        `)

      markersRef.current.push(marker)
      bounds.push([lat, lng])
    })

    // Exposer les callbacks pour les boutons dans les popups
    window.__editStop = (id) => {
      const stop = stops.find(s => (s.id === id) || (s.addresses?.id === id))
      if (stop) {
        setEditingStop(stop)
        setClickedPos(null)
      }
    }
    window.__deleteStop = (id) => {
      const stop = stops.find(s => (s.id === id) || (s.addresses?.id === id))
      if (stop && onDeleteStop) onDeleteStop(stop.id || id)
    }

    // Centrer la carte
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15)
    }

    // Tracer l'itinéraire OSRM sur les vraies routes
    if (bounds.length > 1) {
      setLoadingRoute(true)
      const route = await fetchOSRMRoute(bounds)
      if (route && mapInstance.current) {
        routeRef.current = L.polyline(route, {
          color: '#0E5AA7',
          weight: 4,
          opacity: 0.75,
        }).addTo(map)
      } else {
        // Fallback : ligne droite
        routeRef.current = L.polyline(bounds, {
          color: '#0E5AA7',
          weight: 3,
          opacity: 0.5,
          dashArray: '8 4',
        }).addTo(map)
      }
      setLoadingRoute(false)
    }
  }

  async function handleSaveNewStop() {
    if (!clickedPos || !newStopName.trim()) return
    setSaving(true)
    await onAddStop({ name: newStopName.trim(), lat: clickedPos.lat, lng: clickedPos.lng })
    setClickedPos(null)
    setNewStopName('')
    setSaving(false)
  }

  async function handleSaveEdit() {
    if (!editingStop || !onEditStop) return
    setSaving(true)
    await onEditStop(editingStop)
    setEditingStop(null)
    setSaving(false)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Carte */}
      <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: '8px' }} />

      {/* Indicateur chargement route */}
      {loadingRoute && (
        <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', background: '#1A2130', color: 'white', borderRadius: '20px', padding: '6px 14px', fontSize: '11px', fontWeight: '600', zIndex: 1000, fontFamily: 'Inter, sans-serif', boxShadow: '0 2px 8px rgba(0,0,0,.2)' }}>
          🗺 Calcul de l'itinéraire…
        </div>
      )}

      {/* Popup NOUVEAU arrêt */}
      {clickedPos && !readonly && !editingStop && (
        <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 4px 20px rgba(0,0,0,.2)', zIndex: 1000, minWidth: '300px', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '8px' }}>
            📍 Nouvel arrêt — {clickedPos.lat.toFixed(5)}, {clickedPos.lng.toFixed(5)}
          </div>
          <input value={newStopName} onChange={e => setNewStopName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveNewStop()}
            placeholder="Nom de l'arrêt…" autoFocus
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '8px', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleSaveNewStop} disabled={saving || !newStopName.trim()}
              style={{ flex: 1, background: saving || !newStopName.trim() ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '8px', borderRadius: '5px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Enregistrement…' : '💾 Ajouter'}
            </button>
            <button onClick={() => setClickedPos(null)}
              style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', padding: '8px 12px', borderRadius: '5px', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* Popup MODIFIER arrêt */}
      {editingStop && !readonly && (
        <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 4px 20px rgba(0,0,0,.2)', zIndex: 1000, minWidth: '300px', fontFamily: 'Inter, sans-serif' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '8px' }}>
            ✏️ Modifier l'arrêt #{stops.findIndex(s => s.id === editingStop.id) + 1}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            <div>
              <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Nom</label>
              <input
                value={editingStop.addresses?.name || editingStop.name || ''}
                onChange={e => setEditingStop(s => ({
                  ...s,
                  name: e.target.value,
                  addresses: { ...(s.addresses || {}), name: e.target.value }
                }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div>
              <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Heure de passage</label>
              <input type="time" value={editingStop.arrival_time || ''}
                onChange={e => setEditingStop(s => ({ ...s, arrival_time: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>
                <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Latitude</label>
                <input type="number" step="0.00001"
                  value={editingStop.addresses?.lat || editingStop.lat || ''}
                  onChange={e => setEditingStop(s => ({
                    ...s, lat: parseFloat(e.target.value),
                    addresses: { ...(s.addresses || {}), lat: parseFloat(e.target.value) }
                  }))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div>
                <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Longitude</label>
                <input type="number" step="0.00001"
                  value={editingStop.addresses?.lng || editingStop.lng || ''}
                  onChange={e => setEditingStop(s => ({
                    ...s, lng: parseFloat(e.target.value),
                    addresses: { ...(s.addresses || {}), lng: parseFloat(e.target.value) }
                  }))}
                  style={{ width: '100%', padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <button onClick={handleSaveEdit} disabled={saving}
              style={{ flex: 1, background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '8px', borderRadius: '5px', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Enregistrement…' : '💾 Enregistrer'}
            </button>
            <button onClick={() => setEditingStop(null)}
              style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', padding: '8px 12px', borderRadius: '5px', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      )}

      {/* Légende */}
      {!readonly && !loadingRoute && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'white', borderRadius: '7px', padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.12)', zIndex: 1000, fontSize: '10px', color: '#4A5568', fontFamily: 'Inter, sans-serif' }}>
          🖱 Cliquez sur la carte pour ajouter un arrêt<br />
          <span style={{ color: '#8A95A3' }}>Cliquez sur un marqueur pour modifier</span>
        </div>
      )}
    </div>
  )
}