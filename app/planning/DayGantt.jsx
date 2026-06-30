'use client'

import { useState } from 'react'

const SLOT_TYPES = [
  { value: 'scolaire',    label: 'Scolaire',     color: '#1A2130' },
  { value: 'occasionnel', label: 'Occasionnel',  color: '#D4720A' },
  { value: 'mixte',       label: 'Mixte',        color: '#C0157A' },
  { value: 'regulier',    label: 'Régulier',     color: '#1A9E50' },
  { value: 'repos',       label: 'Repos',        color: '#1565C0' },
  { value: 'neutre',      label: 'Neutre',       color: '#9AA3B2' },
]

function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minToTime(m) {
  const h = Math.floor(m / 60) % 24
  const min = m % 60
  return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
}

function duration(start, end) {
  const d = timeToMin(end) - timeToMin(start)
  if (d <= 0) return ''
  const h = Math.floor(d / 60)
  const m = d % 60
  return h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`
}

// Adresse cliquable vers Maps
function AdresseLink({ label, icon = '📍' }) {
  if (!label) return null
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(label)}`
  return (
    <a href={mapsUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
      style={{ color: '#0E5AA7', textDecoration: 'none', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      {icon} {label}
    </a>
  )
}

// Créneau déroulant dans la liste
function SlotRow({ slot, onDelete }) {
  const [open, setOpen] = useState(false)
  const typeInfo = SLOT_TYPES.find(t => t.value === slot.type)
  const dur = duration(slot.start_time, slot.end_time)

  return (
    <div style={{ border: '1px solid #E2E6EA', borderRadius: '6px', overflow: 'hidden', marginBottom: '4px' }}>
      {/* En-tête cliquable */}
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', background: open ? '#F0F2F5' : '#F8F9FB', cursor: 'pointer', userSelect: 'none' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: slot.color || typeInfo?.color || '#9AA3B2', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', minWidth: '90px' }}>{slot.label}</span>
        <span style={{ fontSize: '10px', color: '#8A95A3' }}>{slot.start_time} → {slot.end_time}</span>
        {dur && <span style={{ fontSize: '9px', color: '#8A95A3', background: '#E2E6EA', padding: '1px 5px', borderRadius: '8px' }}>{dur}</span>}
        {slot.vehicle && <span style={{ fontSize: '10px', color: '#4A5568' }}>🚌 {slot.vehicle}</span>}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#8A95A3' }}>{open ? '▲' : '▼'}</span>
        <button onClick={e => { e.stopPropagation(); onDelete(slot.id) }}
          style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
      </div>

      {/* Contenu déroulant */}
      {open && (
        <div style={{ padding: '8px 12px', background: 'white', borderTop: '1px solid #F0F2F5', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div><span style={{ color: '#8A95A3' }}>Début :</span> <strong>{slot.start_time}</strong></div>
            <div><span style={{ color: '#8A95A3' }}>Fin :</span> <strong>{slot.end_time}</strong></div>
            {dur && <div><span style={{ color: '#8A95A3' }}>Durée :</span> <strong>{dur}</strong></div>}
          </div>
          {slot.from_label && (
            <div style={{ color: '#4A5568' }}>
              <span style={{ color: '#8A95A3' }}>Départ : </span>
              <AdresseLink label={slot.from_label} icon="📍" />
            </div>
          )}
          {slot.to_label && (
            <div style={{ color: '#4A5568' }}>
              <span style={{ color: '#8A95A3' }}>Arrivée : </span>
              <AdresseLink label={slot.to_label} icon="🏁" />
            </div>
          )}
          {slot.vehicle && (
            <div style={{ color: '#4A5568' }}><span style={{ color: '#8A95A3' }}>Véhicule : </span><strong>{slot.vehicle}</strong></div>
          )}
          {slot.notes && (
            <div style={{ color: '#4A5568', background: '#FFF8E1', padding: '5px 8px', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>{slot.notes}</div>
          )}
        </div>
      )}
    </div>
  )
}

const TOTAL_MIN = 24 * 60
const HOUR_W = 60

export default function DayGantt({ driver, date, slots, vehicles, orders, circuits, addresses, onAddSlot, onDeleteSlot, onClose, onEnvoiJour, sendingPlanning, onFillFromOrder, onFillFromCircuit }) {
  const [form, setForm] = useState(null)
  const [filterClimatise, setFilterClimatise] = useState(false)
  const [autoNeutral, setAutoNeutral] = useState(true)
  const [formTab, setFormTab] = useState('manuel')
  const [orderSearch, setOrderSearch] = useState('')
  const [circuitSearch, setCircuitSearch] = useState('')

  const totalW = HOUR_W * 24

  function handleGanttClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const minutes = Math.round((x / totalW) * TOTAL_MIN / 15) * 15
    const time = minToTime(minutes)
    const endTime = minToTime(Math.min(minutes + 60, TOTAL_MIN - 1))
    setForm({ label: '', type: 'scolaire', start_time: time, end_time: endTime, from_label: '', to_label: '', from_address_id: null, to_address_id: null, vehicle: '', notes: '', climatise_required: false })
  }

  function handleSlotClick(slot, e) {
    e.stopPropagation()
    setForm({ id: slot.id, label: slot.label, type: slot.type, start_time: slot.start_time, end_time: slot.end_time, from_label: slot.from_label || '', to_label: slot.to_label || '', vehicle: slot.vehicle || '', notes: slot.notes || '', readonly: true })
  }

  function generateNeutralSlots(mainSlot) {
    const neutrals = []
    const startMin = timeToMin(mainSlot.start_time)
    const endMin = timeToMin(mainSlot.end_time)
    const hlpDuration = 30
    const pdsStart = startMin - hlpDuration - 10
    if (pdsStart >= 0) {
      neutrals.push({ label: 'PDS', type: 'neutre', color: '#9AA3B2', start_time: minToTime(pdsStart), end_time: minToTime(pdsStart + 10), from_label: mainSlot.from_label, to_label: mainSlot.from_label })
      neutrals.push({ label: 'HLP', type: 'neutre', color: '#9AA3B2', start_time: minToTime(pdsStart + 10), end_time: mainSlot.start_time, from_label: '', to_label: mainSlot.from_label })
      neutrals.push({ label: 'MEP', type: 'neutre', color: '#9AA3B2', start_time: mainSlot.start_time, end_time: minToTime(startMin + 2), from_label: mainSlot.from_label, to_label: mainSlot.from_label })
    }
    neutrals.push({ label: 'FDS', type: 'neutre', color: '#9AA3B2', start_time: mainSlot.end_time, end_time: minToTime(endMin + 10), from_label: mainSlot.to_label, to_label: mainSlot.to_label })
    return neutrals
  }

  async function handleSave() {
    if (!form || !form.label) return
    const mainSlot = { ...form }
    delete mainSlot.id; delete mainSlot.readonly; delete mainSlot.climatise_required
    await onAddSlot(mainSlot)
    if (autoNeutral && form.type !== 'neutre' && form.type !== 'repos') {
      for (const n of generateNeutralSlots(form)) await onAddSlot(n)
    }
    setForm(null)
  }

  const filteredVehicles = vehicles.filter(v => !filterClimatise || v.climatise)
  const s = (key) => ({ target: { value } }) => setForm(f => ({ ...f, [key]: value }))
  const dateStr = date ? new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const sortedSlots = [...(slots || [])].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))

  // Durée totale journée
  const firstSlot = sortedSlots[0]
  const lastSlot = sortedSlots[sortedSlots.length - 1]
  const totalDur = firstSlot && lastSlot ? duration(firstSlot.start_time, lastSlot.end_time) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '12px', width: '95vw', maxWidth: '1100px', height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>

        {/* HEADER */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E6EA', display: 'flex', alignItems: 'center', gap: '12px', background: '#F8F9FB', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: driver?.color || '#0E5AA7', color: 'white', fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {driver?.initials}
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130' }}>{driver?.name}</div>
            <div style={{ fontSize: '11px', color: '#8A95A3' }}>{dateStr}{totalDur && ` — Journée : ${firstSlot.start_time} → ${lastSlot.end_time} (${totalDur})`}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {onEnvoiJour && (
              <button onClick={onEnvoiJour} disabled={sendingPlanning}
                style={{ background: sendingPlanning ? '#8A95A3' : '#1A9E50', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer' }}>
                {sendingPlanning ? '⏳ Envoi…' : '📤 Envoyer ce jour'}
              </button>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#4A5568', cursor: 'pointer' }}>
              <input type="checkbox" checked={autoNeutral} onChange={e => setAutoNeutral(e.target.checked)} />
              Auto PDS/HLP/MEP/FDS
            </label>
            <button onClick={onClose} style={{ background: '#F0F2F5', border: 'none', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer' }}>✕ Fermer</button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* GANTT + LISTE */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: '#8A95A3', marginBottom: '8px' }}>Cliquez sur une plage horaire pour créer un créneau</div>

            {/* Grille */}
            <div style={{ position: 'relative', width: `${totalW}px`, userSelect: 'none' }}>
              <div style={{ display: 'flex', borderBottom: '1px solid #E2E6EA', marginBottom: '4px' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ width: `${HOUR_W}px`, minWidth: `${HOUR_W}px`, fontSize: '9px', textAlign: 'center', padding: '2px 0', borderRight: '1px solid #F0F2F5', fontWeight: h === new Date().getHours() ? '700' : '400', color: h === new Date().getHours() ? '#0E5AA7' : '#8A95A3' }}>
                    {String(h).padStart(2,'0')}h
                  </div>
                ))}
              </div>

              <div onClick={handleGanttClick} style={{ height: '80px', background: '#F8F9FB', border: '1px solid #E2E6EA', borderRadius: '6px', position: 'relative', cursor: 'crosshair', overflow: 'hidden' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ position: 'absolute', left: `${h * HOUR_W}px`, top: 0, bottom: 0, width: '1px', background: h % 6 === 0 ? '#D0D4DA' : '#ECEEF1' }} />
                ))}

                {(() => {
                  const now = new Date()
                  const offset = now.getTimezoneOffset()
                  const local = new Date(now.getTime() - offset * 60000)
                  const localToday = local.toISOString().split('T')[0]
                  const ganttDateStr = date instanceof Date
                    ? (() => { const off = date.getTimezoneOffset(); const d = new Date(date.getTime() - off * 60000); return d.toISOString().split('T')[0] })()
                    : date
                  if (ganttDateStr !== localToday) return null
                  const nowMin = now.getHours() * 60 + now.getMinutes()
                  const x = (nowMin / TOTAL_MIN) * totalW
                  return <div style={{ position: 'absolute', left: `${x}px`, top: 0, bottom: 0, width: '2px', background: '#E53935', zIndex: 3 }}>
                    <div style={{ position: 'absolute', top: 0, left: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: '#E53935' }} />
                  </div>
                })()}

                {slots.map(slot => {
                  const startMin = timeToMin(slot.start_time)
                  const endMin = timeToMin(slot.end_time)
                  const left = (startMin / TOTAL_MIN) * totalW
                  const width = Math.max(((endMin - startMin) / TOTAL_MIN) * totalW, 20)
                  return (
                    <div key={slot.id} onClick={e => handleSlotClick(slot, e)}
                      title={`${slot.label} ${slot.start_time}→${slot.end_time}${slot.from_label ? ' | ' + slot.from_label : ''}`}
                      style={{ position: 'absolute', left: `${left}px`, width: `${width}px`, top: '8px', bottom: '8px', background: slot.color || '#9AA3B2', borderRadius: '4px', display: 'flex', alignItems: 'center', padding: '0 5px', cursor: 'pointer', overflow: 'hidden', zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,.15)' }}>
                      <span style={{ color: 'white', fontSize: '9px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {width > 40 ? slot.label : ''}
                      </span>
                    </div>
                  )
                })}

                {form && !form.readonly && form.start_time && form.end_time && (() => {
                  const startMin = timeToMin(form.start_time)
                  const endMin = timeToMin(form.end_time)
                  const left = (startMin / TOTAL_MIN) * totalW
                  const width = Math.max(((endMin - startMin) / TOTAL_MIN) * totalW, 20)
                  const typeInfo = SLOT_TYPES.find(t => t.value === form.type)
                  return <div style={{ position: 'absolute', left: `${left}px`, width: `${width}px`, top: '6px', bottom: '6px', background: (typeInfo?.color || '#9AA3B2') + 'CC', borderRadius: '4px', border: '2px dashed white', zIndex: 5 }} />
                })()}
              </div>

              <div style={{ display: 'flex', marginTop: '2px' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ width: `${HOUR_W}px`, minWidth: `${HOUR_W}px`, fontSize: '8px', color: '#CDD3DA', textAlign: 'center' }}>{String(h).padStart(2,'0')}:30</div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {SLOT_TYPES.map(t => (
                  <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#4A5568' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.color }} />
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            {/* LISTE CRÉNEAUX DÉROULANTS */}
            {sortedSlots.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>
                    Créneaux de la journée ({sortedSlots.length})
                  </div>
                  {totalDur && (
                    <div style={{ fontSize: '10px', color: '#8A95A3' }}>
                      {firstSlot.start_time} → {lastSlot.end_time} · <strong style={{ color: '#1A2130' }}>{totalDur}</strong>
                    </div>
                  )}
                </div>
                {sortedSlots.map(slot => (
                  <SlotRow key={slot.id} slot={slot} onDelete={onDeleteSlot} />
                ))}
              </div>
            )}
          </div>

          {/* FORMULAIRE DROITE */}
          {form && (
            <div style={{ width: '280px', minWidth: '280px', borderLeft: '1px solid #E2E6EA', padding: '14px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130', marginBottom: '4px' }}>
                {form.readonly ? '📋 Détail créneau' : '✏️ Nouveau créneau'}
              </div>

              {!form.readonly && (
                <div style={{ display: 'flex', background: '#F0F2F5', borderRadius: '6px', padding: '2px', gap: '2px', marginBottom: '2px' }}>
                  {[['manuel','✏️ Manuel'],['commande','📋 Commande'],['scolaire','🏫 Scolaire']].map(([tab, label]) => (
                    <button key={tab} onClick={() => setFormTab(tab)}
                      style={{ flex: 1, background: formTab === tab ? 'white' : 'transparent', border: 'none', fontFamily: 'inherit', fontSize: '9px', fontWeight: formTab === tab ? '700' : '500', color: formTab === tab ? '#1A2130' : '#8A95A3', padding: '4px 2px', borderRadius: '4px', cursor: 'pointer' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {form.readonly ? (
                <>
                  <div style={{ background: form.color || '#F8F9FB', padding: '10px 12px', borderRadius: '7px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: form.color ? 'white' : '#1A2130' }}>{form.label}</div>
                    <div style={{ fontSize: '11px', color: form.color ? 'rgba(255,255,255,.8)' : '#8A95A3', marginTop: '2px' }}>
                      {form.start_time} → {form.end_time} · {duration(form.start_time, form.end_time)}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#4A5568', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {form.from_label && (
                      <div>📍 Départ : <AdresseLink label={form.from_label} /></div>
                    )}
                    {form.to_label && (
                      <div>🏁 Arrivée : <AdresseLink label={form.to_label} icon="🏁" /></div>
                    )}
                    {form.vehicle && <div>🚌 Véhicule : <strong>{form.vehicle}</strong></div>}
                    {form.notes && <div style={{ whiteSpace: 'pre-wrap', background: '#FFF8E1', padding: '5px 8px', borderRadius: '4px' }}>{form.notes}</div>}
                  </div>
                  <button onClick={() => { onDeleteSlot(form.id); setForm(null) }}
                    style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px', borderRadius: '5px', cursor: 'pointer' }}>
                    🗑 Supprimer
                  </button>
                  <button onClick={() => setForm(null)} style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', padding: '7px', borderRadius: '5px', cursor: 'pointer' }}>Fermer</button>
                </>
              ) : formTab === 'commande' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="🔍 Référence ou destination…"
                    style={{ padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }} />
                  {(orders || []).filter(o => !orderSearch || o.reference?.toLowerCase().includes(orderSearch.toLowerCase()) || o.destination?.toLowerCase().includes(orderSearch.toLowerCase())).length === 0 && (
                    <div style={{ textAlign: 'center', color: '#8A95A3', fontSize: '11px', padding: '16px' }}>Aucune commande confirmée</div>
                  )}
                  {(orders || []).filter(o => !orderSearch || o.reference?.toLowerCase().includes(orderSearch.toLowerCase()) || o.destination?.toLowerCase().includes(orderSearch.toLowerCase())).map(order => (
                    <div key={order.id} onClick={() => { if (onFillFromOrder) onFillFromOrder(order) }}
                      style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', borderRadius: '7px', padding: '10px 12px', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#0E5AA7'; e.currentTarget.style.background = '#E8F0FB' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#D0D4DA'; e.currentTarget.style.background = '#F8F9FB' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>{order.reference}</div>
                        <span style={{ background: '#E8F5E9', color: '#1A9E50', fontSize: '8px', fontWeight: '700', padding: '2px 5px', borderRadius: '6px' }}>Confirmé</span>
                      </div>
                      {order.client_responsable && <div style={{ fontSize: '10px', color: '#4A5568', marginBottom: '2px' }}>👤 {order.client_responsable}</div>}
                      {order.destination && <div style={{ fontSize: '10px', color: '#4A5568', marginBottom: '2px' }}>📍 {order.destination}</div>}
                      {order.date_service && <div style={{ fontSize: '10px', color: '#8A95A3', marginBottom: '2px' }}>📅 {new Date(order.date_service + 'T00:00:00').toLocaleDateString('fr-FR')}</div>}
                      {order.passengers && <div style={{ fontSize: '10px', color: '#8A95A3', marginBottom: '2px' }}>👥 {order.passengers} passagers</div>}
                      {(order.heure_depart_garage || order.heure_prise_charge || order.heure_retour) && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {order.heure_depart_garage && <span style={{ background: '#F0F2F5', color: '#4A5568', fontSize: '9px', padding: '1px 5px', borderRadius: '4px' }}>🚌 {order.heure_depart_garage}</span>}
                          {order.heure_prise_charge && <span style={{ background: '#F0F2F5', color: '#4A5568', fontSize: '9px', padding: '1px 5px', borderRadius: '4px' }}>⬆️ {order.heure_prise_charge}</span>}
                          {order.heure_retour && <span style={{ background: '#F0F2F5', color: '#4A5568', fontSize: '9px', padding: '1px 5px', borderRadius: '4px' }}>⬇️ {order.heure_retour}</span>}
                          {order.heure_retour_garage && <span style={{ background: '#F0F2F5', color: '#4A5568', fontSize: '9px', padding: '1px 5px', borderRadius: '4px' }}>🏠 {order.heure_retour_garage}</span>}
                        </div>
                      )}
                      {order.lieu_prise_charge && (
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(order.lieu_prise_charge)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          style={{ display: 'block', marginTop: '3px', fontSize: '9px', color: '#0E5AA7', textDecoration: 'none', fontWeight: '600' }}>
                          🗺 PDC : {order.lieu_prise_charge}
                        </a>
                      )}
                      {order.lieu_depose && (
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(order.lieu_depose)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                          style={{ display: 'block', marginTop: '2px', fontSize: '9px', color: '#0E5AA7', textDecoration: 'none', fontWeight: '600' }}>
                          🗺 Dépose : {order.lieu_depose}
                        </a>
                      )}
                      <div style={{ fontSize: '10px', color: '#0E5AA7', fontWeight: '600', marginTop: '6px', borderTop: '1px solid #E2E6EA', paddingTop: '5px' }}>→ Cliquer pour générer le squelette</div>
                    </div>
                  ))}
                </div>
              ) : formTab === 'scolaire' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={circuitSearch} onChange={e => setCircuitSearch(e.target.value)} placeholder="🔍 Nom du circuit…"
                    style={{ padding: '6px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }} />
                  {(circuits || []).filter(c => !circuitSearch || c.name?.toLowerCase().includes(circuitSearch.toLowerCase())).map(circuit => (
                    <div key={circuit.id} onClick={() => { if (onFillFromCircuit) { onFillFromCircuit(circuit); setForm(null); setFormTab('manuel') } }}
                      style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', borderRadius: '6px', padding: '8px 10px', cursor: 'pointer' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A2130'; e.currentTarget.style.background = '#E8EAF0' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = '#D0D4DA'; e.currentTarget.style.background = '#F8F9FB' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>{circuit.code ? `[${circuit.code}] ` : ''}{circuit.name}</div>
                      {circuit.heure_debut && <div style={{ fontSize: '10px', color: '#8A95A3' }}>🕐 {circuit.heure_debut} → {circuit.heure_fin || '—'}</div>}
                      <div style={{ fontSize: '10px', color: '#1A2130', fontWeight: '600', marginTop: '4px' }}>→ Ajouter avec PDS/HLP/FDS</div>
                    </div>
                  ))}
                  {(circuits || []).length === 0 && <div style={{ textAlign: 'center', color: '#8A95A3', fontSize: '11px', padding: '16px' }}>Aucun circuit disponible</div>}
                </div>
              ) : (
                <>
                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Libellé *</label>
                    <input value={form.label} onChange={s('label')} placeholder="S09 M, O163028…"
                      style={{ width: '100%', padding: '7px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '4px' }}>Type</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {SLOT_TYPES.map(t => (
                        <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                          style={{ background: form.type === t.value ? t.color : 'white', color: form.type === t.value ? 'white' : t.color, border: `2px solid ${t.color}`, fontFamily: 'inherit', fontSize: '9px', fontWeight: '700', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer' }}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Début</label>
                      <input type="time" value={form.start_time} onChange={s('start_time')}
                        style={{ width: '100%', padding: '6px 7px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Fin</label>
                      <input type="time" value={form.end_time} onChange={s('end_time')}
                        style={{ width: '100%', padding: '6px 7px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  </div>

                  {[['Départ', 'from_label', 'from_address_id', 'Janzé - Dépôt RGO'], ['Arrivée', 'to_label', 'to_address_id', 'Destination']].map(([label, key, idKey, ph]) => (
                    <div key={key}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      {/* Sélecteur depuis le carnet d'adresses */}
                      <select value={form[idKey] || ''} onChange={e => {
                          const addrId = e.target.value
                          const addr = (addresses || []).find(a => a.id === addrId)
                          setForm(f => ({ ...f, [idKey]: addrId || null, [key]: addr ? (addr.name || addr.address || '') : f[key] }))
                        }}
                        style={{ width: '100%', padding: '6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', marginBottom: '4px', boxSizing: 'border-box' }}>
                        <option value="">📖 Choisir dans le carnet…</option>
                        {(addresses || []).map(a => (
                          <option key={a.id} value={a.id}>{a.name || a.address}{a.lat && a.lng ? ' 📍' : ' (sans GPS)'}</option>
                        ))}
                      </select>
                      {/* Texte libre (modifiable, conservé pour l'affichage) */}
                      <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph}
                        style={{ width: '100%', padding: '6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      {form[key] && (
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(form[key])}`} target="_blank" rel="noreferrer"
                          style={{ fontSize: '9px', color: '#0E5AA7', textDecoration: 'none', fontWeight: '600' }}>🗺 Voir sur Maps</a>
                      )}
                    </div>
                  ))}

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568' }}>Véhicule</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: '#4A5568', cursor: 'pointer' }}>
                        <input type="checkbox" checked={filterClimatise} onChange={e => setFilterClimatise(e.target.checked)} style={{ width: '12px', height: '12px' }} />
                        ❄️ Climatisé uniquement
                      </label>
                    </div>
                    <select value={form.vehicle} onChange={s('vehicle')}
                      style={{ width: '100%', padding: '6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                      <option value="">— Choisir —</option>
                      {filteredVehicles.map(v => (
                        <option key={v.id} value={v.plate}>{v.plate} — {v.type} {v.seats ? v.seats+'p' : ''} {v.climatise ? '❄️' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Notes</label>
                    <textarea value={form.notes} onChange={s('notes')} rows={2}
                      style={{ width: '100%', padding: '6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>

                  {autoNeutral && form.type !== 'neutre' && form.type !== 'repos' && (
                    <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '5px', padding: '7px 9px', fontSize: '10px', color: '#1B5E20' }}>
                      ✅ PDS, HLP, MEP et FDS seront ajoutés automatiquement
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={handleSave}
                      style={{ flex: 1, background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '9px', borderRadius: '6px', cursor: 'pointer' }}>
                      💾 Ajouter
                    </button>
                    <button onClick={() => setForm(null)}
                      style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '12px', padding: '9px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
