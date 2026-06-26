'use client'

import { useState } from 'react'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']

const drivers = [
  { id: 0, name: 'Planchon Cédric', init: 'PC', color: '#0E5AA7' },
  { id: 1, name: 'Chretienneau Céline', init: 'CC', color: '#7B1FA2' },
  { id: 2, name: 'Martin Frédéric', init: 'MF', color: '#C0157A' },
  { id: 3, name: 'Dupont Ahmed', init: 'DA', color: '#1A9E50' },
]

const planning = {
  0: {
    0: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'S09 S',c:'#1A2130',t:'16:45-17:55'}],
    1: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'O164390',c:'#D4720A',t:'09:00-17:30'}],
    2: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'S09 S',c:'#1A2130',t:'16:45-17:55'}],
    3: [{l:'S09 ME',c:'#1A2130',t:'12:30-13:45'}],
    4: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'S09 S',c:'#1A2130',t:'16:45-17:55'}],
    5: [{l:'Repos',c:'#1565C0',t:''}],
    6: [{l:'Repos',c:'#1565C0',t:''}],
  },
  1: {
    0: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'O163028',c:'#D4720A',t:'08:50-16:30'},{l:'S09 S',c:'#1A2130',t:'16:45-17:55'}],
    1: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'O165536',c:'#C0157A',t:'08:45-16:30'},{l:'S09 S',c:'#1A2130',t:'16:45-17:55'}],
    2: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'S09 S',c:'#1A2130',t:'16:45-17:55'}],
    3: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'S09 ME',c:'#1A2130',t:'12:30-13:45'}],
    4: [{l:'S09 M',c:'#1A2130',t:'07:12-08:20'},{l:'S09 S',c:'#1A2130',t:'16:45-17:55'}],
    5: [{l:'Repos',c:'#1565C0',t:''}],
    6: [{l:'Repos',c:'#1565C0',t:''}],
  },
  2: {
    0: [{l:'Repos',c:'#1565C0',t:''}],
    1: [{l:'Repos',c:'#1565C0',t:''}],
    2: [{l:'S11 M',c:'#1A2130',t:'07:30-08:45'},{l:'S11 S',c:'#1A2130',t:'16:45-18:00'}],
    3: [{l:'S11 ME',c:'#1A2130',t:'12:00-13:30'}],
    4: [{l:'S11 M',c:'#1A2130',t:'07:30-08:45'},{l:'S11 S',c:'#1A2130',t:'16:45-18:00'}],
    5: [{l:'Repos',c:'#1565C0',t:''}],
    6: [{l:'Repos',c:'#1565C0',t:''}],
  },
  3: {
    0: [{l:'S11 M',c:'#1A2130',t:'07:30-08:45'},{l:'O165536',c:'#C0157A',t:'14:30-16:45'},{l:'S11 S',c:'#1A2130',t:'16:45-18:00'}],
    1: [{l:'Zoo La Flèche',c:'#D4720A',t:'06:00-20:00'}],
    2: [{l:'S11 M',c:'#1A2130',t:'07:30-08:45'},{l:'S11 S',c:'#1A2130',t:'16:45-18:00'}],
    3: [{l:'S11 ME',c:'#1A2130',t:'12:00-13:30'}],
    4: [{l:'S11 M',c:'#1A2130',t:'07:30-08:45'},{l:'S11 S',c:'#1A2130',t:'16:45-18:00'}],
    5: [{l:'Repos',c:'#1565C0',t:''}],
    6: [{l:'Repos',c:'#1565C0',t:''}],
  },
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

export default function Planning() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [selected, setSelected] = useState(null)

  const dates = getWeekDates(weekOffset)
  const d0 = dates[0], d6 = dates[6]
  const weekLabel = `${d0.getDate()} ${MONTHS[d0.getMonth()]} — ${d6.getDate()} ${MONTHS[d6.getMonth()]} ${d6.getFullYear()}`

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      {/* TOPBAR */}
      <div style={{ background: '#1A2130', color: 'white', display: 'flex', alignItems: 'center', padding: '0 16px', height: '46px', gap: '12px', flexShrink: 0 }}>
        <div style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '-.5px' }}>
          Moov<span style={{ color: '#2EC971' }}>enco</span>
        </div>
        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,.15)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,.08)', borderRadius: '6px', padding: '4px 10px' }}>
          <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: '16px' }}>‹</button>
          <span style={{ fontSize: '12px', fontWeight: '600', minWidth: '160px', textAlign: 'center' }}>{weekLabel}</span>
          <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', fontSize: '16px' }}>›</button>
        </div>
        <button onClick={() => setWeekOffset(0)} style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '5px', cursor: 'pointer' }}>
          Aujourd'hui
        </button>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,.5)' }}>📅 Planning</div>
      </div>

      {/* GRILLE */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '700px' }}>
          <thead>
            <tr>
              <th style={{ background: '#1A2130', color: 'rgba(255,255,255,.4)', fontSize: '10px', fontWeight: '600', textAlign: 'left', padding: '8px 12px', width: '150px', position: 'sticky', top: 0, left: 0, zIndex: 30, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Conducteur
              </th>
              {dates.map((d, i) => (
                <th key={i} style={{ background: isToday(d) ? '#0E3A6E' : '#253044', color: 'white', fontSize: '11px', fontWeight: '600', textAlign: 'center', padding: '6px 4px', position: 'sticky', top: 0, zIndex: 20, borderRight: '1px solid rgba(255,255,255,.06)', cursor: 'pointer' }}>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.5)', textTransform: 'uppercase' }}>{DAYS[i]}</div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{d.getDate()}</div>
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.4)' }}>{MONTHS[d.getMonth()]}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drivers.map((drv, di) => (
              <tr key={di} style={{ borderBottom: '1px solid #D0D4DA' }}>
                <td
                  onClick={() => setSelected({ type: 'driver', data: drv })}
                  style={{ background: selected?.data?.id === drv.id ? '#E8F0FB' : 'white', position: 'sticky', left: 0, zIndex: 10, padding: '8px 10px', borderRight: '2px solid #B0B7C0', cursor: 'pointer', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: drv.color, color: 'white', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {drv.init}
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{drv.name}</div>
                  </div>
                </td>
                {dates.map((d, dayIdx) => {
                  const slots = planning[di]?.[dayIdx] || null
                  return (
                    <td key={dayIdx}
                      style={{ background: isToday(d) ? '#F0F7FF' : di % 2 === 0 ? 'white' : '#FAFBFC', padding: '4px', borderRight: '1px solid #D0D4DA', verticalAlign: 'top', minWidth: '100px' }}
                    >
                      {slots ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minHeight: '60px' }}>
                          {slots.map((s, si) => (
                            <div key={si}
                              onClick={() => setSelected({ type: 'slot', data: s, driver: drv, date: d })}
                              style={{ background: s.c, color: 'white', borderRadius: '3px', padding: '2px 5px', fontSize: '9px', fontWeight: '700', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{s.l}</span>
                              {s.t && <span style={{ opacity: .75, fontSize: '8px' }}>{s.t}</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ minHeight: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D0D4DA', fontSize: '10px', border: '1px dashed #D0D4DA', borderRadius: '4px', cursor: 'pointer' }}>
                          +
                        </div>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PANEL */}
      {selected && (
        <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '280px', background: 'white', borderLeft: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', zIndex: 100, boxShadow: '-4px 0 20px rgba(0,0,0,.1)' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #D0D4DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>
                {selected.type === 'driver' ? selected.data.name : selected.data.l}
              </div>
              <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '2px' }}>
                {selected.type === 'slot' ? `${selected.driver.name} • ${selected.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}` : 'Fiche conducteur'}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8A95A3' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
            {selected.type === 'driver' ? (
              <div style={{ fontSize: '11px', color: '#4A5568', lineHeight: '1.8' }}>
                <p>📋 <strong>Contrat :</strong> CDI temps plein</p>
                <p>🪪 <strong>Permis :</strong> D, C1</p>
                <p>🏥 <strong>Visite médicale :</strong> 20/11/2026</p>
                <p>📊 <strong>Heures ce mois :</strong> 98h45</p>
                <p>🚌 <strong>Véhicule habituel :</strong> GZ-795-QG</p>
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#4A5568', lineHeight: '1.8' }}>
                <p>🕐 <strong>Horaire :</strong> {selected.data.t || '—'}</p>
                <p>🚌 <strong>Véhicule :</strong> GZ-795-QG</p>
                <p>📍 <strong>Départ :</strong> Janzé - Dépôt RGO</p>
                <p>🏁 <strong>Arrivée :</strong> Janzé - Collège St Joseph</p>
                <div style={{ marginTop: '12px', padding: '8px', background: '#F8F9FB', borderRadius: '6px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', color: '#8A95A3', marginBottom: '6px' }}>Documents</div>
                  <div style={{ fontSize: '10px', color: '#0E5AA7', cursor: 'pointer' }}>📄 Feuille de travail</div>
                  <div style={{ fontSize: '10px', color: '#0E5AA7', cursor: 'pointer', marginTop: '3px' }}>📄 Liste élèves</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STATS */}
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        {[['4', 'Conducteurs'], ['24', 'Services'], ['168h', 'Planifiées'], ['5', 'Véhicules']].map(([v, l]) => (
          <div key={l}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{v}</div>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}