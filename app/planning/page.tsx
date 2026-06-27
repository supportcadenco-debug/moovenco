'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'
import DayGantt from './DayGantt'
import Navbar from '../../src/components/Navbar'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'
const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']

const SLOT_TYPES = [
  { value: 'scolaire',    label: 'Scolaire',     color: '#1A2130' },
  { value: 'occasionnel', label: 'Occasionnel',  color: '#D4720A' },
  { value: 'mixte',       label: 'Mixte',        color: '#C0157A' },
  { value: 'regulier',    label: 'Régulier',     color: '#1A9E50' },
  { value: 'repos',       label: 'Repos',        color: '#1565C0' },
  { value: 'neutre',      label: 'Neutre',       color: '#9AA3B2' },
]

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function getWeekDates(offset) {
  const today = new Date()
  const dow = today.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(today)
  monday.setDate(today.getDate() + diff + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isToday(d) {
  const t = new Date()
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
}

function dateKey(d) {
  return d.toISOString().split('T')[0]
}

const EMPTY_FORM = {
  label: '', type: 'scolaire', start_time: '07:00', end_time: '08:30',
  from_label: '', to_label: '', vehicle: '', notes: ''
}

export default function Planning() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [drivers, setDrivers] = useState([])
  const [plannings, setPlannings] = useState({})
  const [slots, setSlots] = useState({})
  const [orders, setOrders] = useState([])
  const [allVehicles, setAllVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [panel, setPanel] = useState(null)
  const [gantt, setGantt] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [newTab, setNewTab] = useState('manuel')
  const [orderSearch, setOrderSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [circuits, setCircuits] = useState([])
  const [circuitSearch, setCircuitSearch] = useState('')
  const [sendingPlanning, setSendingPlanning] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth'; return }
      loadDrivers()
      loadOrders()
      loadVehicles()
      loadCircuits()
    }
    init()
  }, [])

  useEffect(() => {
    if (drivers.length > 0) loadSlots()
  }, [drivers, weekOffset])

  async function loadDrivers() {
    const { data } = await supabase.from('profiles').select('*')
      .eq('company_id', COMPANY_ID).eq('role', 'conducteur').order('name')
    setDrivers(data || [])
    setLoading(false)
  }

  async function loadOrders() {
    const { data } = await supabase.from('orders').select('*')
      .eq('company_id', COMPANY_ID)
      .in('status', ['confirme', 'affecte'])
      .order('date_service')
    setOrders(data || [])
  }

  async function loadVehicles() {
    const { data } = await supabase.from('vehicles').select('*')
      .eq('company_id', COMPANY_ID).eq('active', true).order('plate')
    setAllVehicles(data || [])
  }

  async function loadCircuits() {
    const { data } = await supabase.from('circuits').select('*')
      .eq('company_id', COMPANY_ID).order('nom')
    setCircuits(data || [])
  }

  async function loadSlots() {
    const dates = getWeekDates(weekOffset)
    const from = dateKey(dates[0])
    const to = dateKey(dates[6])
    const { data: planData } = await supabase.from('planning').select('*')
      .eq('company_id', COMPANY_ID).gte('date', from).lte('date', to)
    const planMap = {}
    ;(planData || []).forEach(p => { planMap[`${p.driver_id}_${p.date}`] = p })
    setPlannings(planMap)
    if (planData && planData.length > 0) {
      const planIds = planData.map(p => p.id)
      const { data: slotData } = await supabase.from('slots').select('*').in('planning_id', planIds)
      const slotMap = {}
      ;(slotData || []).forEach(s => {
        if (!slotMap[s.planning_id]) slotMap[s.planning_id] = []
        slotMap[s.planning_id].push(s)
      })
      setSlots(slotMap)
    } else { setSlots({}) }
  }

  async function handleCreateSlotFromGantt(slotData, driverId, date) {
    const planKey = `${driverId}_${dateKey(date)}`
    let planning = plannings[planKey]
    if (!planning) {
      const typeInfo = SLOT_TYPES.find(t => t.value === slotData.type)
      const { data: newPlan, error } = await supabase.from('planning').insert({
        id: generateId(), company_id: COMPANY_ID, driver_id: driverId,
        date: dateKey(date),
        day_type: typeInfo?.label || 'Scolaire',
        day_color: typeInfo?.color || '#1A2130',
      }).select().single()
      if (error) { console.error(error); return }
      planning = newPlan
      setPlannings(prev => ({ ...prev, [planKey]: planning }))
    }
    const typeInfo = SLOT_TYPES.find(t => t.value === slotData.type)
    await supabase.from('slots').insert({
      id: generateId(), company_id: COMPANY_ID, planning_id: planning.id,
      label: slotData.label, type: slotData.type,
      color: typeInfo?.color || slotData.color || '#9AA3B2',
      start_time: slotData.start_time, end_time: slotData.end_time,
      from_label: slotData.from_label || '',
      to_label: slotData.to_label || '',
      vehicle: slotData.vehicle || '',
      notes: slotData.notes || '',
    })
  }

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

  async function fillFromOrder(order) {
    setSelectedOrder(order)
    // Utiliser les horaires réels de la commande
    const depGarage  = order.heure_depart_garage  || '07:00'
    const prise      = order.heure_prise_charge   || '08:00'
    const dep        = order.heure_depart         || '08:30'
    const retour     = order.heure_retour         || '17:00'
    const retGarage  = order.heure_retour_garage  || '18:00'

    const depGarMin  = timeToMin(depGarage)
    const priseMin   = timeToMin(prise)
    const retGarMin  = timeToMin(retGarage)
    const retMin     = timeToMin(retour)

    // Squelette automatique
    const skeleton = [
      { label: 'PDS',                  type: 'neutre',     color: '#9AA3B2', start_time: minToTime(depGarMin - 10), end_time: depGarage,   from_label: 'Garage Janzé',           to_label: 'Garage Janzé',          vehicle: order.vehicule_plaque || '', notes: '' },
      { label: 'HLP',                  type: 'neutre',     color: '#9AA3B2', start_time: depGarage,                  end_time: minToTime(priseMin - 5),   from_label: 'Garage Janzé',           to_label: order.lieu_prise_charge || order.origin || '', vehicle: order.vehicule_plaque || '', notes: '' },
      { label: 'MEP',                  type: 'neutre',     color: '#9AA3B2', start_time: minToTime(priseMin - 5),    end_time: prise,                     from_label: order.lieu_prise_charge || order.origin || '', to_label: order.lieu_prise_charge || order.origin || '', vehicle: order.vehicule_plaque || '', notes: '' },
      { label: order.reference,        type: 'occasionnel',color: '#D4720A', start_time: dep,                        end_time: retour,                    from_label: order.lieu_prise_charge || order.origin || '', to_label: order.lieu_depose || order.destination || '', vehicle: order.vehicule_plaque || '', notes: order.notes || '' },
      { label: 'HLP retour',           type: 'neutre',     color: '#9AA3B2', start_time: retour,                     end_time: minToTime(retGarMin - 10), from_label: order.lieu_depose || order.destination || '', to_label: 'Garage Janzé',          vehicle: order.vehicule_plaque || '', notes: '' },
      { label: 'FDS',                  type: 'neutre',     color: '#9AA3B2', start_time: minToTime(retGarMin - 10),  end_time: retGarage,                 from_label: 'Garage Janzé',           to_label: 'Garage Janzé',          vehicle: order.vehicule_plaque || '', notes: '' },
    ]

    setSaving(true)
    const { driverId, date } = panel
    const planKey = `${driverId}_${dateKey(date)}`
    let planning = plannings[planKey]
    if (!planning) {
      const { data: newPlan, error } = await supabase.from('planning').insert({
        id: generateId(), company_id: COMPANY_ID, driver_id: driverId,
        date: dateKey(date), day_type: 'Occasionnel', day_color: '#D4720A',
      }).select().single()
      if (error) { setMessage('Erreur planning : ' + error.message); setSaving(false); return }
      planning = newPlan
      setPlannings(prev => ({ ...prev, [planKey]: planning }))
    }

    for (const slot of skeleton) {
      await supabase.from('slots').insert({
        id: generateId(), company_id: COMPANY_ID, planning_id: planning.id,
        label: slot.label, type: slot.type, color: slot.color,
        start_time: slot.start_time, end_time: slot.end_time,
        from_label: slot.from_label, to_label: slot.to_label,
        vehicle: slot.vehicle, notes: slot.notes,
      })
    }

    await supabase.from('orders').update({
      status: 'affecte', assigned_driver: driverId, assigned_vehicle: order.vehicule_plaque || '',
    }).eq('id', order.id)

    setSaving(false)
    setMessage('✅ Squelette de journée créé !')
    setTimeout(() => { setMessage(''); setPanel(null); loadSlots(); loadOrders() }, 1500)
  }

  async function fillFromCircuit(circuit) {
    setSaving(true)
    const { driverId, date } = panel
    const planKey = `${driverId}_${dateKey(date)}`
    let planning = plannings[planKey]
    if (!planning) {
      const { data: newPlan, error } = await supabase.from('planning').insert({
        id: generateId(), company_id: COMPANY_ID, driver_id: driverId,
        date: dateKey(date), day_type: 'Scolaire', day_color: '#1A2130',
      }).select().single()
      if (error) { setMessage('Erreur : ' + error.message); setSaving(false); return }
      planning = newPlan
      setPlannings(prev => ({ ...prev, [planKey]: planning }))
    }

    const debut = circuit.heure_debut || '07:00'
    const fin   = circuit.heure_fin   || '08:30'
    const debMin = timeToMin(debut)
    const finMin = timeToMin(fin)

    const skeleton = [
      { label: 'PDS',         type: 'neutre',   color: '#9AA3B2', start_time: minToTime(debMin - 20), end_time: minToTime(debMin - 10), from_label: 'Garage Janzé', to_label: 'Garage Janzé', vehicle: '', notes: '' },
      { label: 'HLP',         type: 'neutre',   color: '#9AA3B2', start_time: minToTime(debMin - 10), end_time: debut,                  from_label: 'Garage Janzé', to_label: circuit.nom || '', vehicle: '', notes: '' },
      { label: circuit.nom || circuit.id, type: 'scolaire', color: '#1A2130', start_time: debut, end_time: fin, from_label: circuit.nom || '', to_label: circuit.nom || '', vehicle: '', notes: '' },
      { label: 'FDS',         type: 'neutre',   color: '#9AA3B2', start_time: fin,                   end_time: minToTime(finMin + 10),  from_label: circuit.nom || '', to_label: 'Garage Janzé', vehicle: '', notes: '' },
    ]

    for (const slot of skeleton) {
      await supabase.from('slots').insert({
        id: generateId(), company_id: COMPANY_ID, planning_id: planning.id,
        label: slot.label, type: slot.type, color: slot.color,
        start_time: slot.start_time, end_time: slot.end_time,
        from_label: slot.from_label, to_label: slot.to_label,
        vehicle: slot.vehicle, notes: slot.notes,
      })
    }

    setSaving(false)
    setMessage('✅ Circuit scolaire ajouté !')
    setTimeout(() => { setMessage(''); setPanel(null); loadSlots() }, 1500)
  }

  async function handleSendPlanning() {
    setSendingPlanning(true)
    const dates = getWeekDates(weekOffset + 1) // semaine suivante
    const from = dateKey(dates[0])
    const to   = dateKey(dates[6])
    const { error } = await supabase.from('planning')
      .update({ valide: true, valide_at: new Date().toISOString() })
      .eq('company_id', COMPANY_ID)
      .gte('date', from).lte('date', to)
    setSendingPlanning(false)
    if (error) alert('Erreur : ' + error.message)
    else alert(`✅ Planning du ${dates[0].toLocaleDateString('fr-FR')} au ${dates[6].toLocaleDateString('fr-FR')} envoyé aux conducteurs !`)
  }

  async function generateCircuitsRecurrents() {
    setSendingPlanning(true)
    const dates = getWeekDates(weekOffset + 1)
    const { data: driverCircuits } = await supabase
      .from('driver_circuits')
      .select('*, circuits(id, nom, heure_debut, heure_fin)')
      .eq('company_id', COMPANY_ID).eq('actif', true)
    if (!driverCircuits || driverCircuits.length === 0) {
      alert('Aucun circuit habituel configuré dans le module Personnel.')
      setSendingPlanning(false); return
    }
    const { data: periodes } = await supabase.from('calendrier_scolaire').select('*')
      .eq('company_id', COMPANY_ID).eq('type', 'cours')
    const JOURS_MAP = { 1: 'lundi', 2: 'mardi', 3: 'mercredi', 4: 'jeudi', 5: 'vendredi', 6: 'samedi', 0: 'dimanche' }
    let created = 0
    for (const date of dates) {
      const dateStr = dateKey(date)
      const jourNom = JOURS_MAP[date.getDay()]
      const isScolaire = (periodes || []).length === 0 || (periodes || []).some(p => dateStr >= p.date_debut && dateStr <= p.date_fin)
      if (!isScolaire) continue
      for (const dc of driverCircuits) {
        if (!dc.jours?.includes(jourNom)) continue
        const circuit = dc.circuits
        if (!circuit) continue
        const driverId = dc.driver_id
        const planKey = `${driverId}_${dateStr}`
        let planning = plannings[planKey]
        if (!planning) {
          const { data: newPlan, error } = await supabase.from('planning').insert({
            id: generateId(), company_id: COMPANY_ID, driver_id: driverId,
            date: dateStr, day_type: 'Scolaire', day_color: '#1A2130',
          }).select().single()
          if (error) continue
          planning = newPlan
        }
        const debut = circuit.heure_debut || '07:00'
        const fin   = circuit.heure_fin   || '08:30'
        const debMin = parseInt(debut.split(':')[0])*60 + parseInt(debut.split(':')[1])
        const finMin  = parseInt(fin.split(':')[0])*60   + parseInt(fin.split(':')[1])
        const toTime = (m) => `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
        const skeleton = [
          { label: 'PDS',       type: 'neutre',   color: '#9AA3B2', start_time: toTime(debMin-20), end_time: toTime(debMin-10), from_label: 'Garage Janzé', to_label: 'Garage Janzé' },
          { label: 'HLP',       type: 'neutre',   color: '#9AA3B2', start_time: toTime(debMin-10), end_time: debut,             from_label: 'Garage Janzé', to_label: circuit.nom },
          { label: circuit.nom, type: 'scolaire', color: '#1A2130', start_time: debut,             end_time: fin,               from_label: circuit.nom,    to_label: circuit.nom },
          { label: 'FDS',       type: 'neutre',   color: '#9AA3B2', start_time: fin,               end_time: toTime(finMin+10), from_label: circuit.nom,    to_label: 'Garage Janzé' },
        ]
        for (const slot of skeleton) {
          await supabase.from('slots').insert({ id: generateId(), company_id: COMPANY_ID, planning_id: planning.id, label: slot.label, type: slot.type, color: slot.color, start_time: slot.start_time, end_time: slot.end_time, from_label: slot.from_label, to_label: slot.to_label, vehicle: '', notes: '' })
          created++
        }
      }
    }
    setSendingPlanning(false)
    await loadSlots()
    alert(`✅ ${Math.floor(created/4)} circuit(s) générés pour la semaine du ${dates[0].toLocaleDateString('fr-FR')}`)
  }

  async function handleCreateSlot() {
    if (!form.label) { setMessage('Libellé obligatoire'); return }
    setSaving(true)
    setMessage('')
    const { driverId, date } = panel
    const planKey = `${driverId}_${dateKey(date)}`
    let planning = plannings[planKey]

    if (!planning) {
      const typeInfo = SLOT_TYPES.find(t => t.value === form.type)
      const { data: newPlan, error: planErr } = await supabase.from('planning').insert({
        id: generateId(), company_id: COMPANY_ID, driver_id: driverId,
        date: dateKey(date), day_type: typeInfo?.label || 'Scolaire', day_color: typeInfo?.color || '#1A2130',
      }).select().single()
      if (planErr) { setMessage('Erreur : ' + planErr.message); setSaving(false); return }
      planning = newPlan
    }

    const typeInfo = SLOT_TYPES.find(t => t.value === form.type)
    const { error: slotErr } = await supabase.from('slots').insert({
      id: generateId(), company_id: COMPANY_ID, planning_id: planning.id,
      label: form.label, type: form.type, color: typeInfo?.color || '#9AA3B2',
      start_time: form.start_time, end_time: form.end_time,
      from_label: form.from_label, to_label: form.to_label,
      vehicle: form.vehicle, notes: form.notes,
    })

    if (slotErr) { setMessage('Erreur : ' + slotErr.message) }
    else {
      if (selectedOrder) {
        await supabase.from('orders').update({
          status: 'affecte', assigned_driver: driverId, assigned_vehicle: form.vehicle,
        }).eq('id', selectedOrder.id)
      }
      setMessage('✅ Créneau ajouté')
      setForm(EMPTY_FORM)
      setSelectedOrder(null)
      setPanel(null)
      loadSlots()
      loadOrders()
    }
    setSaving(false)
  }

  async function handleDeleteSlot(slotId) {
    if (!confirm('Supprimer ce créneau ?')) return
    await supabase.from('slots').delete().eq('id', slotId)
    setPanel(null)
    loadSlots()
  }

  const dates = getWeekDates(weekOffset)
  const d0 = dates[0], d6 = dates[6]
  const weekLabel = `${d0.getDate()} ${MONTHS[d0.getMonth()]} — ${d6.getDate()} ${MONTHS[d6.getMonth()]} ${d6.getFullYear()}`
  const s = (key) => ({ target: { value } }) => setForm(f => ({ ...f, [key]: value }))
  const filteredOrders = orders.filter(o =>
    !orderSearch || o.reference?.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.destination?.toLowerCase().includes(orderSearch.toLowerCase())
  )

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      {/* NAVBAR */}
      <Navbar currentPage="planning" />

      {/* BARRE SEMAINE */}
      <div style={{ background: '#253044', color: 'white', display: 'flex', alignItems: 'center', padding: '0 16px', height: '38px', gap: '10px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,.08)', borderRadius: '6px', padding: '4px 10px' }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: '16px' }}>‹</button>
          <span style={{ fontSize: '12px', fontWeight: '600', minWidth: '160px', textAlign: 'center' }}>{weekLabel}</span>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: '16px' }}>›</button>
        </div>
        <button onClick={() => setWeekOffset(0)} style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '5px', cursor: 'pointer' }}>
          Aujourd'hui
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={handleSendPlanning} disabled={sendingPlanning}
            style={{ background: sendingPlanning ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
            {sendingPlanning ? '⏳ Envoi…' : '📤 Envoyer planning semaine suivante'}
          </button>
          <button onClick={generateCircuitsRecurrents} disabled={sendingPlanning}
            style={{ background: sendingPlanning ? '#8A95A3' : '#1A9E50', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer', marginLeft: '6px' }}>
            🏫 Générer circuits scolaires
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* GRILLE */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8A95A3', fontSize: '13px' }}>Chargement…</div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '700px' }}>
              <thead>
                <tr>
                  <th style={{ background: '#1A2130', color: 'rgba(255,255,255,.4)', fontSize: '10px', fontWeight: '600', textAlign: 'left', padding: '8px 12px', width: '160px', position: 'sticky', top: 0, left: 0, zIndex: 30, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    Conducteur
                  </th>
                  {dates.map((d, i) => (
                    <th key={i} style={{ background: isToday(d) ? '#0E3A6E' : '#253044', color: 'white', fontSize: '11px', fontWeight: '600', textAlign: 'center', padding: '6px 4px', position: 'sticky', top: 0, zIndex: 20, borderRight: '1px solid rgba(255,255,255,.06)', minWidth: '110px' }}>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.5)', textTransform: 'uppercase' }}>{DAYS[i]}</div>
                      <div style={{ fontSize: '16px', fontWeight: '700' }}>{d.getDate()}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)' }}>{MONTHS[d.getMonth()]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drivers.map((drv, di) => (
                  <tr key={drv.id} style={{ borderBottom: '1px solid #D0D4DA' }}>
                    <td onClick={() => setPanel({ type: 'driver', data: drv })}
                      style={{ background: panel?.data?.id === drv.id && panel?.type === 'driver' ? '#E8F0FB' : 'white', position: 'sticky', left: 0, zIndex: 10, padding: '8px 10px', borderRight: '2px solid #B0B7C0', cursor: 'pointer', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: drv.color, color: 'white', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {drv.initials}
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{drv.name}</div>
                      </div>
                    </td>
                    {dates.map((d, dayIdx) => {
                      const planKey = `${drv.id}_${dateKey(d)}`
                      const plan = plannings[planKey]
                      const daySlots = plan ? (slots[plan.id] || []) : []
                      return (
                        <td key={dayIdx}
                          style={{ background: isToday(d) ? '#F0F7FF' : di % 2 === 0 ? 'white' : '#FAFBFC', padding: '4px', borderRight: '1px solid #D0D4DA', verticalAlign: 'top' }}>
                          <div style={{ minHeight: '62px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {daySlots.sort((a, b) => a.start_time?.localeCompare(b.start_time)).map(slot => (
                              <div key={slot.id}
                                onClick={() => setPanel({ type: 'slot', data: slot, driverId: drv.id, date: d })}
                                style={{ background: slot.color || '#9AA3B2', color: 'white', borderRadius: '3px', padding: '2px 5px', fontSize: '9px', fontWeight: '700', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                onMouseEnter={e => e.currentTarget.style.filter = 'brightness(.85)'}
                                onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.label}</span>
                                {slot.start_time && <span style={{ opacity: .8, fontSize: '8px', flexShrink: 0, marginLeft: '3px' }}>{slot.start_time}</span>}
                              </div>
                            ))}
                            <div
                              onClick={() => {
                                const planKey = `${drv.id}_${dateKey(d)}`
                                const plan = plannings[planKey]
                                const daySlots = plan ? (slots[plan.id] || []) : []
                                setGantt({ driver: drv, date: d, slots: daySlots, planId: plan?.id })
                              }}
                              style={{ flex: 1, minHeight: daySlots.length === 0 ? '56px' : '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D0D4DA', fontSize: '10px', border: '1px dashed #D0D4DA', borderRadius: '4px', cursor: 'pointer' }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#0E5AA7'; e.currentTarget.style.color = '#0E5AA7'; e.currentTarget.style.background = '#E8F0FB' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#D0D4DA'; e.currentTarget.style.color = '#D0D4DA'; e.currentTarget.style.background = 'transparent' }}>
                              +
                            </div>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PANEL DROITE */}
        {panel && (
          <div style={{ width: '320px', minWidth: '320px', background: 'white', borderLeft: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #D0D4DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700' }}>
                  {panel.type === 'new' ? '+ Nouveau créneau' : panel.type === 'slot' ? panel.data.label : panel.data?.name}
                </div>
                <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '2px' }}>
                  {panel.date ? panel.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                  {panel.type === 'new' && panel.driverId && (() => { const d = drivers.find(x => x.id === panel.driverId); return d ? ` • ${d.name}` : '' })()}
                </div>
              </div>
              <button onClick={() => setPanel(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8A95A3' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
              {panel.type === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', background: '#F0F2F5', borderRadius: '7px', padding: '3px', gap: '2px' }}>
                    {[['manuel','✏️ Manuel'], ['commande', `📋 Commande (${orders.length})`], ['circuit', `🏫 Scolaire (${circuits.length})`]].map(([tab, label]) => (
                      <button key={tab} onClick={() => setNewTab(tab)}
                        style={{ flex: 1, background: newTab === tab ? 'white' : 'transparent', border: 'none', fontFamily: 'inherit', fontSize: '10px', fontWeight: newTab === tab ? '700' : '500', color: newTab === tab ? '#1A2130' : '#8A95A3', padding: '5px 6px', borderRadius: '5px', cursor: 'pointer', boxShadow: newTab === tab ? '0 1px 3px rgba(0,0,0,.1)' : 'none' }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {newTab === 'commande' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', borderRadius: '5px', padding: '6px 10px', display: 'flex', gap: '6px' }}>
                        <span style={{ color: '#8A95A3' }}>🔍</span>
                        <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)} placeholder="Référence ou destination…"
                          style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '11px', width: '100%', background: 'none' }} />
                      </div>
                      {saving && <div style={{ textAlign: 'center', color: '#0E5AA7', fontSize: '11px', padding: '10px' }}>⏳ Création du squelette…</div>}
                      {message && <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '5px', padding: '8px 10px', fontSize: '11px', color: '#1B5E20' }}>{message}</div>}
                      {filteredOrders.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#8A95A3', fontSize: '11px', padding: '20px' }}>Aucune commande confirmée disponible</div>
                      ) : (
                        filteredOrders.map(order => (
                          <div key={order.id} onClick={() => { if (!saving) fillFromOrder(order) }}
                            style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', borderRadius: '7px', padding: '10px 12px', cursor: 'pointer' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0E5AA7'; e.currentTarget.style.background = '#E8F0FB' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#D0D4DA'; e.currentTarget.style.background = '#F8F9FB' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>{order.reference}</div>
                              <span style={{ background: '#E8F5E9', color: '#1A9E50', fontSize: '8px', fontWeight: '700', padding: '2px 5px', borderRadius: '6px' }}>{order.status === 'confirme' ? 'Confirmé' : 'Affecté'}</span>
                            </div>
                            <div style={{ fontSize: '10px', color: '#4A5568' }}>📍 {order.destination}</div>
                            {order.date_service && <div style={{ fontSize: '10px', color: '#8A95A3' }}>📅 {new Date(order.date_service).toLocaleDateString('fr-FR')}</div>}
                            {order.passengers && <div style={{ fontSize: '10px', color: '#8A95A3' }}>👥 {order.passengers} passagers</div>}
                            <div style={{ fontSize: '10px', color: '#0E5AA7', fontWeight: '600', marginTop: '5px' }}>→ Cliquer pour pré-remplir</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {newTab === 'circuit' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', borderRadius: '5px', padding: '6px 10px', display: 'flex', gap: '6px' }}>
                        <span style={{ color: '#8A95A3' }}>🔍</span>
                        <input value={circuitSearch} onChange={e => setCircuitSearch(e.target.value)} placeholder="Nom du circuit…"
                          style={{ border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: '11px', width: '100%', background: 'none' }} />
                      </div>
                      {saving && <div style={{ textAlign: 'center', color: '#0E5AA7', fontSize: '11px', padding: '10px' }}>⏳ Création du squelette…</div>}
                      {message && <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '5px', padding: '8px 10px', fontSize: '11px', color: '#1B5E20' }}>{message}</div>}
                      {circuits.filter(c => !circuitSearch || c.nom?.toLowerCase().includes(circuitSearch.toLowerCase())).map(circuit => (
                        <div key={circuit.id} onClick={() => fillFromCircuit(circuit)}
                          style={{ background: '#F8F9FB', border: '1px solid #D0D4DA', borderRadius: '7px', padding: '10px 12px', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = '#1A2130'; e.currentTarget.style.background = '#E8EAF0' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D0D4DA'; e.currentTarget.style.background = '#F8F9FB' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130' }}>{circuit.nom}</div>
                          {circuit.heure_debut && <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '2px' }}>🕐 {circuit.heure_debut} → {circuit.heure_fin || '—'}</div>}
                          <div style={{ fontSize: '10px', color: '#1A2130', fontWeight: '600', marginTop: '5px' }}>→ Cliquer pour ajouter avec squelette PDS/HLP/FDS</div>
                        </div>
                      ))}
                      {circuits.length === 0 && <div style={{ textAlign: 'center', color: '#8A95A3', fontSize: '11px', padding: '20px' }}>Aucun circuit scolaire</div>}
                    </div>
                  )}

                  {newTab === 'manuel' && (
                    <>
                      {selectedOrder && (
                        <div style={{ background: '#E8F5E9', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '8px 10px', fontSize: '10px', color: '#1B5E20', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>📋 Pré-rempli depuis <strong>{selectedOrder.reference}</strong></span>
                          <button onClick={() => { setSelectedOrder(null); setForm(EMPTY_FORM) }} style={{ background: 'none', border: 'none', color: '#1B5E20', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                        </div>
                      )}
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Libellé *</label>
                        <input value={form.label} onChange={s('label')} placeholder="S09 M, O163028, HLP…"
                          style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '5px' }}>Type</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {SLOT_TYPES.map(t => (
                            <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
                              style={{ background: form.type === t.value ? t.color : '#F8F9FB', color: form.type === t.value ? 'white' : '#4A5568', border: `1px solid ${form.type === t.value ? t.color : '#D0D4DA'}`, fontFamily: 'inherit', fontSize: '10px', fontWeight: '600', padding: '3px 7px', borderRadius: '5px', cursor: 'pointer' }}>
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Début</label>
                          <input type="time" value={form.start_time} onChange={s('start_time')}
                            style={{ width: '100%', padding: '7px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Fin</label>
                          <input type="time" value={form.end_time} onChange={s('end_time')}
                            style={{ width: '100%', padding: '7px 8px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                      </div>
                      {[['Départ', 'from_label', 'Janzé - Dépôt RGO'], ['Arrivée', 'to_label', 'Destination'], ['Véhicule', 'vehicle', 'GZ-795-QG']].map(([label, key, ph]) => (
                        <div key={key}>
                          <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>{label}</label>
                          <input value={form[key]} onChange={s(key)} placeholder={ph}
                            style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                      <div>
                        <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '3px' }}>Notes / Itinéraire</label>
                        <textarea value={form.notes} onChange={s('notes')} rows={3}
                          style={{ width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
                      </div>
                      {message && <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', padding: '8px 10px', borderRadius: '5px' }}>{message}</div>}
                      <button onClick={handleCreateSlot} disabled={saving}
                        style={{ background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                        {saving ? 'Enregistrement…' : '💾 Ajouter le créneau'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {panel.type === 'slot' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: panel.data.color || '#9AA3B2', borderRadius: '8px' }}>
                    <div>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: 'white' }}>{panel.data.label}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.8)', marginTop: '2px' }}>{panel.data.start_time} → {panel.data.end_time}</div>
                    </div>
                  </div>
                  <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '10px 12px', fontSize: '11px', color: '#4A5568', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div><strong style={{ color: '#1A2130' }}>Type :</strong> {SLOT_TYPES.find(t => t.value === panel.data.type)?.label || panel.data.type}</div>
                    <div><strong style={{ color: '#1A2130' }}>Départ :</strong> {panel.data.from_label || '—'}</div>
                    <div><strong style={{ color: '#1A2130' }}>Arrivée :</strong> {panel.data.to_label || '—'}</div>
                    <div><strong style={{ color: '#1A2130' }}>Véhicule :</strong> {panel.data.vehicle || '—'}</div>
                    {panel.data.notes && (
                      <div style={{ marginTop: '4px' }}>
                        <strong style={{ color: '#1A2130' }}>Notes :</strong>
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: '3px', color: '#4A5568', lineHeight: '1.5' }}>{panel.data.notes}</div>
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDeleteSlot(panel.data.id)}
                    style={{ background: '#FFEBEE', border: 'none', color: '#C62828', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '8px', borderRadius: '5px', cursor: 'pointer', width: '100%' }}>
                    🗑 Supprimer ce créneau
                  </button>
                </div>
              )}

              {panel.type === 'driver' && (
                <div style={{ fontSize: '11px', color: '#4A5568', lineHeight: '1.9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: panel.data.color, color: 'white', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {panel.data.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130' }}>{panel.data.name}</div>
                      <div style={{ fontSize: '10px', color: '#8A95A3' }}>{panel.data.contract || '—'}</div>
                    </div>
                  </div>
                  <p>🏷 <strong>Rôle :</strong> {panel.data.role}</p>
                  <p>✅ <strong>Statut :</strong> {panel.data.active ? 'Actif' : 'Inactif'}</p>
                  <div style={{ marginTop: '12px' }}>
                    <a href="/conducteurs" style={{ background: '#E8F0FB', color: '#0E5AA7', fontSize: '11px', fontWeight: '600', padding: '7px 12px', borderRadius: '5px', textDecoration: 'none', display: 'inline-block' }}>
                      👤 Voir la fiche complète
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* STATS */}
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        <div><div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{drivers.length}</div><div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Conducteurs</div></div>
        <div><div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{Object.values(slots).flat().length}</div><div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Créneaux semaine</div></div>
        <div><div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{orders.length}</div><div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Commandes à affecter</div></div>
      </div>

      {/* GANTT JOURNEE */}
      {gantt && (
        <DayGantt
          driver={gantt.driver}
          date={gantt.date}
          slots={gantt.slots}
          vehicles={allVehicles}
          onAddSlot={async (slot) => {
            await handleCreateSlotFromGantt(slot, gantt.driver.id, gantt.date)
            const planKey = `${gantt.driver.id}_${dateKey(gantt.date)}`
            await loadSlots()
            const plan = plannings[planKey]
            if (plan) {
              const { data: newSlots } = await supabase.from('slots').select('*').eq('planning_id', plan.id)
              setGantt(g => ({ ...g, slots: newSlots || [] }))
            }
          }}
          onDeleteSlot={async (slotId) => {
            await supabase.from('slots').delete().eq('id', slotId)
            setGantt(g => ({ ...g, slots: g.slots.filter(s => s.id !== slotId) }))
            loadSlots()
          }}
          onClose={() => { setGantt(null); loadSlots() }}
        />
      )}
    </div>
  )
}