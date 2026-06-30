'use client'

import { useState } from 'react'
import { calculAmplitude, formatDuration, RSE_LIMITS } from '@/lib/rse'

// Mêmes codes de journée que la vue générale
const TAMPON_PREFIXES = ['PDS', 'HLP', 'MEP', 'FDS', 'MAD']
function estTampon(label) {
  if (!label) return false
  const l = String(label).trim().toUpperCase()
  return TAMPON_PREFIXES.some(p => l.startsWith(p))
}

function getDayCode(daySlots) {
  const services = (daySlots || []).filter(s => !estTampon(s.label))
  const repos = services.find(s => s.type === 'repos')
  if (repos) return { code: repos.label || 'REPOS', color: repos.color || '#1565C0', type: 'repos' }
  if (services.length === 0) return null
  const scolaires = services.filter(s => s.type === 'scolaire')
  const occ = services.filter(s => ['occasionnel', 'mixte', 'regulier'].includes(s.type))
  if (scolaires.length > 0 && occ.length > 0) return { code: 'MIXTE', color: '#C0157A', type: 'mixte' }
  if (scolaires.length === 0 && occ.length > 0) return { code: 'OCC', color: '#D4720A', type: 'occasionnel' }
  if (scolaires.length > 0) {
    const codes = [...new Set(scolaires.map(s => s.label))]
    if (codes.length === 1) return { code: codes[0], color: '#1A2130', type: 'scolaire' }
    return { code: 'REG', color: '#1A9E50', type: 'regulier' }
  }
  return null
}

function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

// Mini-frise horaire (24 segments) pour l'en-tête de colonne jour
function MiniStrip({ daySlots }) {
  const segs = []
  for (let h = 0; h < 24; h++) {
    let found = null
    for (const s of (daySlots || [])) {
      if (estTampon(s.label) || s.type === 'repos') continue
      const start = timeToMin(s.start_time)
      const end = timeToMin(s.end_time)
      if (h >= Math.floor(start / 60) && h < Math.ceil(end / 60)) { found = s; break }
    }
    segs.push(
      <div key={h} style={{ flex: 1, height: '100%', background: found ? (found.color || '#9AA3B2') : 'transparent' }} />
    )
  }
  return (
    <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', marginTop: '5px', background: '#ECEEF1' }}>
      {segs}
    </div>
  )
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']

export default function CrossView({ drivers, dates, plannings, slots, dateKey, isToday, onCellClick, nbDays, setNbDays, totalAlerts, onDayHeaderClick }) {
  // On limite l'affichage au nombre de jours choisi
  const shownDates = dates.slice(0, nbDays)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
      {/* Barre d'options vue croisée */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', background: '#F8F9FB', borderBottom: '1px solid #E2E6EA', position: 'sticky', top: 0, zIndex: 5 }}>
        <span style={{ fontSize: '11px', color: '#8A95A3' }}>Jours affichés :</span>
        <div style={{ display: 'flex', gap: '3px' }}>
          {[2, 3, 4, 5, 6, 7].map(n => (
            <button key={n} onClick={() => setNbDays(n)}
              style={{
                width: '28px', height: '26px', border: '1px solid #D0D4DA', borderRadius: '5px',
                background: nbDays === n ? '#0E5AA7' : 'white', color: nbDays === n ? 'white' : '#4A5568',
                fontWeight: '700', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit',
              }}>{n}</button>
          ))}
        </div>
        {totalAlerts > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: '#FFEBEE', color: '#C62828', padding: '4px 12px', borderRadius: '14px', fontSize: '11px', fontWeight: '700' }}>
            ⚠️ {totalAlerts} alerte{totalAlerts > 1 ? 's' : ''} RSE
          </div>
        )}
      </div>

      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${160 + shownDates.length * 130}px` }}>
        <thead>
          <tr>
            <th style={{ background: '#1A2130', color: 'rgba(255,255,255,.4)', fontSize: '10px', fontWeight: '600', textAlign: 'left', padding: '8px 12px', width: '160px', position: 'sticky', top: '0', left: 0, zIndex: 30, textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Conducteur
            </th>
            {shownDates.map((d, i) => (
              <th key={i} onClick={() => onDayHeaderClick && onDayHeaderClick(d)}
                title="Cliquer pour comparer les conducteurs ce jour"
                style={{ background: isToday(d) ? '#0E3A6E' : '#253044', color: 'white', fontSize: '11px', fontWeight: '600', textAlign: 'center', padding: '8px 6px', position: 'sticky', top: 0, zIndex: 20, borderRight: '1px solid rgba(255,255,255,.06)', minWidth: '130px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0E5AA7'}
                onMouseLeave={e => e.currentTarget.style.background = isToday(d) ? '#0E3A6E' : '#253044'}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,.5)', textTransform: 'uppercase' }}>{DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
                <div style={{ fontSize: '15px', fontWeight: '700' }}>{d.getDate()} <span style={{ fontSize: '9px', fontWeight: '400', color: 'rgba(255,255,255,.5)' }}>{MONTHS[d.getMonth()]}</span></div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', marginTop: '2px' }}>⊞ comparer</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {drivers.map((drv, di) => {
            // Amplitude moyenne sur les jours affichés (pour l'indicateur conducteur)
            let totalAmpli = 0, daysWithWork = 0
            shownDates.forEach(d => {
              const plan = plannings[`${drv.id}_${dateKey(d)}`]
              const ds = plan ? (slots[plan.id] || []) : []
              const a = calculAmplitude(ds)
              if (a > 0) { totalAmpli += a; daysWithWork++ }
            })
            const ampliMoy = daysWithWork > 0 ? Math.round(totalAmpli / daysWithWork) : 0

            return (
              <tr key={drv.id} style={{ borderBottom: '1px solid #D0D4DA' }}>
                <td style={{ background: 'white', position: 'sticky', left: 0, zIndex: 10, padding: '8px 10px', borderRight: '2px solid #B0B7C0', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: drv.color, color: 'white', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {drv.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{drv.name}</div>
                      {ampliMoy > 0 && (
                        <div style={{ fontSize: '9px', color: '#8A95A3' }}>Amp. moy. {formatDuration(ampliMoy)}</div>
                      )}
                    </div>
                  </div>
                </td>
                {shownDates.map((d, dayIdx) => {
                  const plan = plannings[`${drv.id}_${dateKey(d)}`]
                  const daySlots = plan ? (slots[plan.id] || []) : []
                  const dayCode = getDayCode(daySlots)
                  const amplitude = calculAmplitude(daySlots)
                  const ampliDanger = amplitude > RSE_LIMITS.AMPLITUDE_MAX_NORMAL
                  const ampliWarn = !ampliDanger && amplitude > RSE_LIMITS.AMPLITUDE_MAX_NORMAL - 60

                  return (
                    <td key={dayIdx} onClick={() => onCellClick(drv, d, daySlots, plan)}
                      style={{ background: isToday(d) ? '#F0F7FF' : di % 2 === 0 ? 'white' : '#FAFBFC', padding: '6px', borderRight: '1px solid #D0D4DA', verticalAlign: 'top', cursor: 'pointer' }}>
                      {dayCode ? (
                        <div>
                          <div style={{
                            background: (dayCode.color || '#9AA3B2') + '22', color: dayCode.color || '#1A2130',
                            borderRadius: '6px', padding: '6px', fontSize: '11px', fontWeight: '700', textAlign: 'center',
                          }}>
                            {dayCode.code}
                          </div>
                          {amplitude > 0 && dayCode.type !== 'repos' && (
                            <>
                              <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '2px', fontWeight: ampliDanger ? '700' : '500', color: ampliDanger ? '#C62828' : ampliWarn ? '#D4720A' : '#8A95A3' }}>
                                {ampliDanger && '⚠️ '}{formatDuration(amplitude)}
                              </div>
                              <MiniStrip daySlots={daySlots} />
                            </>
                          )}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#CDD3DA', fontSize: '16px', padding: '8px 0' }}>+</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
