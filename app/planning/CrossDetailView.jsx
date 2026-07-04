'use client'

import { useState } from 'react'
import { calculAmplitude, formatDuration, RSE_LIMITS } from '@/lib/rse'

const TAMPON_PREFIXES = ['PDS', 'HLP', 'MEP', 'FDS', 'MAD']
function estTampon(label) {
  if (!label) return false
  const l = String(label).trim().toUpperCase()
  return TAMPON_PREFIXES.some(p => l.startsWith(p))
}

function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

const SLOT_COLORS = {
  scolaire: '#1A2130', occasionnel: '#D4720A', mixte: '#C0157A',
  regulier: '#1A9E50', repos: '#1565C0', neutre: '#9AA3B2',
}

const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

// Colonne d'un conducteur : frise + tableau heure par heure
function DriverColumn({ driver, daySlots, allDrivers, onChangeDriver, onRemove, canRemove, onDeleteSlot, onReassignSlot, draggingSlot, onDragStartSlot, onDragEndSlot }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const sorted = [...(daySlots || [])].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))
  const amplitude = calculAmplitude(sorted)
  const ampliDanger = amplitude > RSE_LIMITS.AMPLITUDE_MAX_NORMAL
  const ampliWarn = !ampliDanger && amplitude > RSE_LIMITS.AMPLITUDE_MAX_NORMAL - 60

  // Frise 24 segments
  const stripSegs = []
  for (let h = 0; h < 24; h++) {
    let found = null
    for (const s of sorted) {
      if (s.type === 'repos') continue
      if (h >= Math.floor(timeToMin(s.start_time) / 60) && h < Math.ceil(timeToMin(s.end_time) / 60)) { found = s; break }
    }
    stripSegs.push(<div key={h} style={{ flex: 1, height: '100%', background: found ? (found.color || '#9AA3B2') : 'transparent' }} />)
  }

  // Tableau heure par heure
  const hourRows = []
  for (let h = 0; h < 24; h++) {
    let found = null, isStart = false
    for (const s of sorted) {
      const start = timeToMin(s.start_time), end = timeToMin(s.end_time)
      if (h >= Math.floor(start / 60) && h < Math.ceil(end / 60)) { found = s; isStart = h === Math.floor(start / 60); break }
    }
    const label = `${String(h).padStart(2, '0')}h`
    const tampon = found && estTampon(found.label)
    const canDrag = found && isStart && !tampon && onReassignSlot
    hourRows.push(
      <div key={h}
        draggable={canDrag}
        onDragStart={e => { if (canDrag) { e.dataTransfer.effectAllowed = 'move'; onDragStartSlot && onDragStartSlot(found, driver.id) } }}
        style={{ display: 'flex', borderBottom: '0.5px solid #F0F2F5', minHeight: '26px', cursor: canDrag ? 'grab' : 'default' }}>
        <div style={{ width: '34px', flexShrink: 0, fontSize: '9px', color: '#8A95A3', padding: '4px 5px', borderRight: '0.5px solid #F0F2F5' }}>{label}</div>
        <div style={{ flex: 1, padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', background: found ? '#F8F9FB' : 'transparent', borderLeft: found ? `2px solid ${found.color || '#9AA3B2'}` : 'none' }}>
          {found ? (
            isStart ? (
              <>
                {canDrag && <span style={{ color: '#CDD3DA', fontSize: '10px' }}>⠿</span>}
                <span style={{ fontWeight: '600', color: '#1A2130' }}>{found.label}</span>
                {found.vehicle && <span style={{ fontSize: '8px', color: '#4A5568', background: '#ECEEF1', padding: '1px 5px', borderRadius: '6px' }}>🚌 {found.vehicle}</span>}
                {onDeleteSlot && (
                  <button onClick={() => {
                      const msg = `Supprimer le créneau "${found.label}" (${found.start_time} → ${found.end_time}) ?` +
                        (tampon ? '' : '\n\nLes créneaux tampons seront recalculés automatiquement.')
                      if (window.confirm(msg)) onDeleteSlot(found.id, driver.id)
                    }}
                    style={{ marginLeft: 'auto', background: '#FFEBEE', border: 'none', color: '#C62828', fontSize: '9px', padding: '1px 6px', borderRadius: '3px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                )}
              </>
            ) : <span style={{ color: '#CDD3DA', fontSize: '9px' }}>···</span>
          ) : <span style={{ color: '#CDD3DA' }}>Libre</span>}
        </div>
      </div>
    )
  }

  const isDropTarget = draggingSlot && draggingSlot.fromDriverId !== driver?.id

  return (
    <div
      onDragOver={e => { if (isDropTarget) e.preventDefault() }}
      onDrop={async e => {
        e.preventDefault()
        if (isDropTarget && onReassignSlot) {
          await onReassignSlot(draggingSlot.slot, draggingSlot.fromDriverId, driver.id)
        }
        onDragEndSlot && onDragEndSlot()
      }}
      style={{ flex: 1, minWidth: '280px', border: isDropTarget ? '2px dashed #0E5AA7' : '1px solid #E2E6EA', background: isDropTarget ? '#F0F7FF' : 'white', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'border-color .15s' }}>
      {/* En-tête conducteur avec sélecteur */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: driver?.color || '#0E5AA7', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>
          {driver?.initials}
        </div>
        <div style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowDropdown(o => !o)}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A2130' }}>{driver?.name}</div>
            {amplitude > 0 && (
              <div style={{ fontSize: '10px', fontWeight: ampliDanger ? '700' : '500', color: ampliDanger ? '#C62828' : ampliWarn ? '#D4720A' : '#8A95A3' }}>
                {ampliDanger && '⚠️ '}Amplitude {formatDuration(amplitude)}
              </div>
            )}
          </div>
          <span style={{ marginLeft: 'auto', color: '#8A95A3', fontSize: '12px' }}>▾</span>
        </div>
        {canRemove && (
          <button onClick={onRemove} style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontSize: '11px', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
        )}
        {showDropdown && (
          <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: '12px', right: '12px', background: 'white', border: '1px solid #D0D4DA', borderRadius: '6px', boxShadow: '0 4px 16px rgba(0,0,0,.15)', zIndex: 20, maxHeight: '200px', overflowY: 'auto' }}>
            {allDrivers.map(d => (
              <div key={d.id} onClick={() => { onChangeDriver(d); setShowDropdown(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', fontSize: '11px', cursor: 'pointer', background: d.id === driver?.id ? '#F0F2F5' : 'white' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F0F7FF'}
                onMouseLeave={e => e.currentTarget.style.background = d.id === driver?.id ? '#F0F2F5' : 'white'}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: d.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '700' }}>{d.initials}</div>
                {d.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Frise */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #F0F2F5' }}>
        <div style={{ display: 'flex', height: '20px', borderRadius: '5px', overflow: 'hidden', border: '0.5px solid #E2E6EA', background: '#ECEEF1' }}>
          {stripSegs}
        </div>
      </div>

      {/* Tableau heure par heure */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px' }}>
        {hourRows}
      </div>
    </div>
  )
}

export default function CrossDetailView({ date, drivers, plannings, slots, dateKey, onClose, onPrevDay, onNextDay, initialDrivers = null, onDeleteSlot, onReassignSlot }) {
  // Les conducteurs affichés (2 par défaut)
  const [shownDriverIds, setShownDriverIds] = useState(
    initialDrivers && initialDrivers.length > 0
      ? initialDrivers.slice(0, 2).map(d => d.id)
      : drivers.slice(0, 2).map(d => d.id)
  )
  const [draggingSlot, setDraggingSlot] = useState(null) // { slot, fromDriverId }

  const dateStr = date ? `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}` : ''

  function getDriverSlots(driverId) {
    const plan = plannings[`${driverId}_${dateKey(date)}`]
    return plan ? (slots[plan.id] || []) : []
  }

  function addDriver() {
    const notShown = drivers.find(d => !shownDriverIds.includes(d.id))
    if (notShown) setShownDriverIds([...shownDriverIds, notShown.id])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '12px', width: '95vw', maxWidth: '1200px', height: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

        {/* Header avec navigation date */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E6EA', display: 'flex', alignItems: 'center', gap: '12px', background: '#F8F9FB', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={onPrevDay} style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #D0D4DA', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#4A5568' }}>‹</button>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130', minWidth: '180px', textAlign: 'center' }}>{dateStr}</div>
            <button onClick={onNextDay} style={{ width: '30px', height: '30px', borderRadius: '6px', border: '1px solid #D0D4DA', background: 'white', cursor: 'pointer', fontSize: '14px', color: '#4A5568' }}>›</button>
          </div>
          <div style={{ fontSize: '11px', color: '#8A95A3' }}>{shownDriverIds.length} conducteur{shownDriverIds.length > 1 ? 's' : ''}</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            {shownDriverIds.length < drivers.length && (
              <button onClick={addDriver} style={{ background: 'white', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                + Ajouter un conducteur
              </button>
            )}
            <button onClick={onClose} style={{ background: '#F0F2F5', border: 'none', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>✕ Fermer</button>
          </div>
        </div>

        {/* Légende */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '8px 20px', borderBottom: '1px solid #F0F2F5' }}>
          {[['Scolaire', '#1A2130'], ['Occasionnel', '#D4720A'], ['Mixte', '#C0157A'], ['Régulier', '#1A9E50'], ['Repos', '#1565C0'], ['Neutre', '#9AA3B2']].map(([lbl, col]) => (
            <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: '#4A5568' }}>
              <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: col }} />{lbl}
            </div>
          ))}
        </div>

        {/* Colonnes conducteurs */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', gap: '16px' }}>
          {shownDriverIds.map((driverId, idx) => {
            const driver = drivers.find(d => d.id === driverId)
            return (
              <DriverColumn
                key={driverId + '_' + idx}
                driver={driver}
                daySlots={getDriverSlots(driverId)}
                allDrivers={drivers}
                canRemove={shownDriverIds.length > 1}
                onChangeDriver={(newDrv) => {
                  const copy = [...shownDriverIds]
                  copy[idx] = newDrv.id
                  setShownDriverIds(copy)
                }}
                onRemove={() => setShownDriverIds(shownDriverIds.filter((_, i) => i !== idx))}
                onDeleteSlot={onDeleteSlot ? async (slotId, driverId) => { await onDeleteSlot(slotId, driverId) } : null}
                onReassignSlot={onReassignSlot}
                draggingSlot={draggingSlot}
                onDragStartSlot={(slot, fromDriverId) => setDraggingSlot({ slot, fromDriverId })}
                onDragEndSlot={() => setDraggingSlot(null)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
