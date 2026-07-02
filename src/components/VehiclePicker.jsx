'use client'

import { useState, useRef, useEffect } from 'react'

/**
 * VehiclePicker — sélecteur de véhicule avec recherche/autocomplétion.
 *
 * Props :
 *  - vehicles : liste des véhicules [{ id, plate, type, seats, climatise }]
 *  - value    : plaque actuellement sélectionnée (string)
 *  - onChange : (plate) => void
 *  - allowFilter : afficher le filtre "climatisé" (défaut false)
 *  - placeholder
 *
 * Comportement : on tape pour filtrer, on clique pour choisir. La saisie libre
 * est possible (si la plaque tapée ne correspond à aucun véhicule, elle est
 * quand même conservée).
 */
export default function VehiclePicker({ vehicles = [], value = '', onChange, allowFilter = false, placeholder = 'Rechercher un véhicule…' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [climatiseOnly, setClimatiseOnly] = useState(false)
  const ref = useRef(null)

  // Fermer au clic extérieur
  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const q = query.toLowerCase()
  const filtered = vehicles.filter(v => {
    if (climatiseOnly && !v.climatise) return false
    if (!q) return true
    return (v.plate || '').toLowerCase().includes(q) ||
           (v.type || '').toLowerCase().includes(q)
  })

  // Ce qui s'affiche dans le champ : la query si on est en train de chercher,
  // sinon la valeur sélectionnée.
  const displayValue = open ? query : value

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {allowFilter && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#4A5568', cursor: 'pointer', marginBottom: '3px', justifyContent: 'flex-end' }}>
          <input type="checkbox" checked={climatiseOnly} onChange={e => setClimatiseOnly(e.target.checked)} style={{ width: '12px', height: '12px' }} />
          ❄️ Climatisé uniquement
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={e => { setQuery(e.target.value); setOpen(true); onChange(e.target.value) }}
          style={{ width: '100%', padding: '6px 26px 6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#8A95A3', pointerEvents: 'none' }}>🚌 ▾</span>
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '10px', color: '#8A95A3' }}>
              {query ? `Aucun véhicule — "${query}" sera utilisé tel quel` : 'Aucun véhicule'}
            </div>
          ) : filtered.map(v => (
            <div key={v.id}
              onClick={() => { onChange(v.plate); setQuery(''); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', fontSize: '11px', cursor: 'pointer', background: v.plate === value ? '#F0F7FF' : 'white' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
              onMouseLeave={e => e.currentTarget.style.background = v.plate === value ? '#F0F7FF' : 'white'}>
              <strong style={{ color: '#1A2130' }}>{v.plate}</strong>
              <span style={{ color: '#8A95A3', fontSize: '10px' }}>{v.type} {v.seats ? `· ${v.seats}p` : ''} {v.climatise ? '❄️' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
