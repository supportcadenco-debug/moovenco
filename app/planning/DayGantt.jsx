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

const NEUTRAL_TYPES = [
  { value: 'pds',  label: 'Prise de service',  duration: 10, color: '#9AA3B2' },
  { value: 'mad',  label: 'Mise à disposition', duration: 2,  color: '#9AA3B2' },
  { value: 'hlp',  label: 'Haut le pied',       duration: 0,  color: '#9AA3B2' },
  { value: 'mep',  label: 'Mise en place',      duration: 5,  color: '#9AA3B2' },
  { value: 'fds',  label: 'Fin de service',     duration: 10, color: '#9AA3B2' },
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

const TOTAL_MIN = 24 * 60
const HOUR_W = 60 // px par heure

export default function DayGantt({ driver, date, slots, vehicles, onAddSlot, onDeleteSlot, onClose, onEnvoiJour, sendingPlanning }) {
  const [form, setForm] = useState(null)
  const [filterClimatise, setFilterClimatise] = useState(false)
  const [autoNeutral, setAutoNeutral] = useState(true)

  const totalW = HOUR_W * 24

  function handleGanttClick(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const minutes = Math.round((x / totalW) * TOTAL_MIN / 15) * 15
    const time = minToTime(minutes)
    const endTime = minToTime(Math.min(minutes + 60, TOTAL_MIN - 1))
    setForm({
      label: '', type: 'scolaire', start_time: time, end_time: endTime,
      from_label: '', to_label: '', vehicle: '', notes: '',
      climatise_required: false,
    })
  }

  function handleSlotClick(slot, e) {
    e.stopPropagation()
    setForm({
      id: slot.id,
      label: slot.label, type: slot.type,
      start_time: slot.start_time, end_time: slot.end_time,
      from_label: slot.from_label || '', to_label: slot.to_label || '',
      vehicle: slot.vehicle || '', notes: slot.notes || '',
      readonly: true,
    })
  }

  function generateNeutralSlots(mainSlot) {
    const slots = []
    const startMin = timeToMin(mainSlot.start_time)
    const endMin = timeToMin(mainSlot.end_time)
    const isMorning = startMin < 11 * 60
    const isNoon = startMin >= 11 * 60 && startMin < 14 * 60
    const isEvening = startMin >= 14 * 60

    if (isMorning || isNoon || isEvening) {
      // PDS 10 min avant HLP
      const hlpDuration = 30 // estimé
      const pdsStart = startMin - hlpDuration - 10
      if (pdsStart >= 0) {
        slots.push({ label: 'PDS', type: 'neutre', color: '#9AA3B2', start_time: minToTime(pdsStart), end_time: minToTime(pdsStart + 10), from_label: mainSlot.from_label, to_label: mainSlot.from_label })
        // HLP
        slots.push({ label: 'HLP', type: 'neutre', color: '#9AA3B2', start_time: minToTime(pdsStart + 10), end_time: mainSlot.start_time, from_label: '', to_label: mainSlot.from_label })
        // MEP 2 min
        slots.push({ label: 'MEP', type: 'neutre', color: '#9AA3B2', start_time: mainSlot.start_time, end_time: minToTime(startMin + 2), from_label: mainSlot.from_label, to_label: mainSlot.from_label })
      }
      // FDS après
      if (isEvening || (!isMorning && !isNoon)) {
        slots.push({ label: 'FDS', type: 'neutre', color: '#9AA3B2', start_time: mainSlot.end_time, end_time: minToTime(endMin + 10), from_label: mainSlot.to_label, to_label: mainSlot.to_label })
      }
    }
    return slots
  }

  async function handleSave() {
    if (!form || !form.label) return
    const mainSlot = { ...form }
    delete mainSlot.id
    delete mainSlot.readonly
    delete mainSlot.climatise_required
    await onAddSlot(mainSlot)

    if (autoNeutral && form.type !== 'neutre' && form.type !== 'repos') {
      const neutrals = generateNeutralSlots(form)
      for (const n of neutrals) {
        await onAddSlot(n)
      }
    }
    setForm(null)
  }

  const filteredVehicles = vehicles.filter(v => !filterClimatise || v.climatise)
  const s = (key) => ({ target: { value } }) => setForm(f => ({ ...f, [key]: value }))

  const dateStr = date ? new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''

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
            <div style={{ fontSize: '11px', color: '#8A95A3' }}>{dateStr}</div>
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
            <button onClick={onClose} style={{ background: '#F0F2F5', border: 'none', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '5px', cursor: 'pointer' }}>
              ✕ Fermer
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* GANTT */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
            <div style={{ fontSize: '11px', color: '#8A95A3', marginBottom: '8px' }}>
              Cliquez sur une plage horaire pour créer un créneau
            </div>

            {/* Grille heures */}
            <div style={{ position: 'relative', width: `${totalW}px`, userSelect: 'none' }}>

              {/* En-tête heures */}
              <div style={{ display: 'flex', borderBottom: '1px solid #E2E6EA', marginBottom: '4px' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ width: `${HOUR_W}px`, minWidth: `${HOUR_W}px`, fontSize: '9px', color: '#8A95A3', textAlign: 'center', padding: '2px 0', borderRight: '1px solid #F0F2F5', fontWeight: h === new Date().getHours() ? '700' : '400', color: h === new Date().getHours() ? '#0E5AA7' : '#8A95A3' }}>
                    {String(h).padStart(2,'0')}h
                  </div>
                ))}
              </div>

              {/* Zone cliquable */}
              <div
                onClick={handleGanttClick}
                style={{ height: '80px', background: '#F8F9FB', border: '1px solid #E2E6EA', borderRadius: '6px', position: 'relative', cursor: 'crosshair', overflow: 'hidden' }}>

                {/* Lignes heures */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ position: 'absolute', left: `${h * HOUR_W}px`, top: 0, bottom: 0, width: '1px', background: h % 6 === 0 ? '#D0D4DA' : '#ECEEF1' }} />
                ))}

                {/* Ligne heure actuelle */}
                {(() => {
                  const now = new Date()
                  const nowMin = now.getHours() * 60 + now.getMinutes()
                  const x = (nowMin / TOTAL_MIN) * totalW
                  return <div style={{ position: 'absolute', left: `${x}px`, top: 0, bottom: 0, width: '2px', background: '#E53935', zIndex: 3 }}>
                    <div style={{ position: 'absolute', top: 0, left: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: '#E53935' }} />
                  </div>
                })()}

                {/* Créneaux existants */}
                {slots.map(slot => {
                  const startMin = timeToMin(slot.start_time)
                  const endMin = timeToMin(slot.end_time)
                  const left = (startMin / TOTAL_MIN) * totalW
                  const width = Math.max(((endMin - startMin) / TOTAL_MIN) * totalW, 20)
                  return (
                    <div key={slot.id}
                      onClick={e => handleSlotClick(slot, e)}
                      style={{ position: 'absolute', left: `${left}px`, width: `${width}px`, top: '8px', bottom: '8px', background: slot.color || '#9AA3B2', borderRadius: '4px', display: 'flex', alignItems: 'center', padding: '0 5px', cursor: 'pointer', overflow: 'hidden', zIndex: 2, boxShadow: '0 1px 3px rgba(0,0,0,.15)' }}
                      title={`${slot.label} ${slot.start_time}→${slot.end_time}`}>
                      <span style={{ color: 'white', fontSize: '9px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {width > 40 ? slot.label : ''}
                      </span>
                    </div>
                  )
                })}

                {/* Créneau en cours de création */}
                {form && !form.readonly && form.start_time && form.end_time && (() => {
                  const startMin = timeToMin(form.start_time)
                  const endMin = timeToMin(form.end_time)
                  const left = (startMin / TOTAL_MIN) * totalW
                  const width = Math.max(((endMin - startMin) / TOTAL_MIN) * totalW, 20)
                  const typeInfo = SLOT_TYPES.find(t => t.value === form.type)
                  return (
                    <div style={{ position: 'absolute', left: `${left}px`, width: `${width}px`, top: '6px', bottom: '6px', background: (typeInfo?.color || '#9AA3B2') + 'CC', borderRadius: '4px', border: '2px dashed white', zIndex: 5 }} />
                  )
                })()}
              </div>

              {/* Labels heures demi */}
              <div style={{ display: 'flex', marginTop: '2px' }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} style={{ width: `${HOUR_W}px`, minWidth: `${HOUR_W}px`, fontSize: '8px', color: '#CDD3DA', textAlign: 'center' }}>
                    {String(h).padStart(2,'0')}:30
                  </div>
                ))}
              </div>

              {/* Légende types */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {SLOT_TYPES.map(t => (
                  <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#4A5568' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.color }} />
                    {t.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Liste créneaux */}
            {slots.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '8px' }}>Créneaux de la journée</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {[...slots].sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time)).map(slot => (
                    <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: '#F8F9FB', borderRadius: '5px', border: '1px solid #E2E6EA' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: slot.color || '#9AA3B2', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130', minWidth: '80px' }}>{slot.label}</span>
                      <span style={{ fontSize: '10px', color: '#8A95A3' }}>{slot.start_time} → {slot.end_time}</span>
                      {slot.vehicle && <span style={{ fontSize: '10px', color: '#4A5568' }}>🚌 {slot.vehicle}</span>}
                      {slot.from_label && <span style={{ fontSize: '10px', color: '#4A5568', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📍 {slot.from_label}</span>}
                      <button onClick={() => onDeleteSlot(slot.id)} style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontSize: '10px', padding: '2px 6px', borderRadius: '3px', cursor: 'pointer', flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FORMULAIRE */}
          {form && (
            <div style={{ width: '280px', minWidth: '280px', borderLeft: '1px solid #E2E6EA', padding: '14px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', flexShrink: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>
                {form.readonly ? '📋 Détail créneau' : '✏️ Nouveau créneau'}
              </div>

              {form.readonly ? (
                <>
                  <div style={{ background: form.color || '#F8F9FB', padding: '10px 12px', borderRadius: '7px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: form.color ? 'white' : '#1A2130' }}>{form.label}</div>
                    <div style={{ fontSize: '11px', color: form.color ? 'rgba(255,255,255,.8)' : '#8A95A3', marginTop: '2px' }}>{form.start_time} → {form.end_time}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#4A5568', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {form.from_label && <div>📍 Départ : {form.from_label}</div>}
                    {form.to_label && <div>🏁 Arrivée : {form.to_label}</div>}
                    {form.vehicle && <div>🚌 Véhicule : {form.vehicle}</div>}
                    {form.notes && <div style={{ whiteSpace: 'pre-wrap', marginTop: '4px' }}>{form.notes}</div>}
                  </div>
                  <button onClick={() => { onDeleteSlot(form.id); setForm(null) }}
                    style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px', borderRadius: '5px', cursor: 'pointer' }}>
                    🗑 Supprimer
                  </button>
                  <button onClick={() => setForm(null)} style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', color: '#4A5568', fontFamily: 'inherit', fontSize: '11px', padding: '7px', borderRadius: '5px', cursor: 'pointer' }}>
                    Fermer
                  </button>
                </>
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
                          style={{ background: form.type === t.value ? t.color : 'white', color: form.type === t.value ? 'white' : t.color, border: `2px solid ${t.color}`, fontFamily: 'inherit', fontSize: '9px', fontWeight: '700', padding: '3px 6px', borderRadius: '4px', cursor: 'pointer', opacity: 1 }}>
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

                  {[['Départ', 'from_label', 'Janzé - Dépôt RGO'], ['Arrivée', 'to_label', 'Destination']].map(([label, key, ph]) => (
                    <div key={key}>
                      <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                      <input value={form[key]} onChange={s(key)} placeholder={ph}
                        style={{ width: '100%', padding: '6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                    </div>
                  ))}

                  {/* VEHICULE avec filtre climatisé */}
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