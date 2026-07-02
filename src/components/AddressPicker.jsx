'use client'

import { useState, useRef, useEffect } from 'react'

/**
 * AddressPicker — sélecteur d'adresse depuis le carnet, avec recherche /
 * autocomplétion et saisie libre.
 *
 * Props :
 *  - addresses : liste du carnet [{ id, name, address, lat, lng }]
 *  - value     : texte affiché actuellement (from_label / to_label)
 *  - addressId : id de l'adresse sélectionnée (from_address_id / to_address_id)
 *  - onChange  : ({ label, addressId }) => void
 *  - placeholder
 *
 * Comportement :
 *  - On tape → filtre le carnet. On clique une adresse → remplit label + id.
 *  - Saisie libre conservée si aucune adresse ne correspond (addressId = null).
 *  - Un 📍 indique les adresses géolocalisées (utilisables pour le calcul OSRM).
 */
export default function AddressPicker({ addresses = [], value = '', addressId = null, onChange, placeholder = 'Rechercher une adresse…' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const q = query.toLowerCase()
  const filtered = addresses.filter(a => {
    if (!q) return true
    return (a.name || '').toLowerCase().includes(q) ||
           (a.address || '').toLowerCase().includes(q)
  })

  const displayValue = open ? query : value

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={e => {
            // Saisie libre : on met à jour le label, on efface l'id lié
            setQuery(e.target.value); setOpen(true)
            onChange({ label: e.target.value, addressId: null })
          }}
          style={{ width: '100%', padding: '6px 26px 6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }}
        />
        <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: addressId ? '#1A9E50' : '#8A95A3', pointerEvents: 'none' }}>
          {addressId ? '📍' : '📖'} ▾
        </span>
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 50, maxHeight: '220px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '10px', color: '#8A95A3' }}>
              {query ? `Aucune adresse — "${query}" sera utilisée en texte libre` : 'Carnet vide'}
            </div>
          ) : filtered.map(a => (
            <div key={a.id}
              onClick={() => { onChange({ label: a.name || a.address, addressId: a.id }); setQuery(''); setOpen(false) }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', fontSize: '11px', cursor: 'pointer', background: a.id === addressId ? '#F0F7FF' : 'white' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
              onMouseLeave={e => e.currentTarget.style.background = a.id === addressId ? '#F0F7FF' : 'white'}>
              <span>{a.lat && a.lng ? '📍' : '📄'}</span>
              <div>
                <div style={{ fontWeight: '600', color: '#1A2130' }}>{a.name || a.address}</div>
                {a.name && a.address && <div style={{ fontSize: '9px', color: '#8A95A3' }}>{a.address}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
