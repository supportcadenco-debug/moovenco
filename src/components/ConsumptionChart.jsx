'use client'

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'
const PERIODS = [
  { value: 90,  label: '3 mois' },
  { value: 180, label: '6 mois' },
  { value: 365, label: '1 an' },
  { value: 0,   label: 'Tout' },
]

function formatDateShort(d) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function ConsumptionChart({ vehicles }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedVehicleId, setSelectedVehicleId] = useState('all')
  const [periodDays, setPeriodDays] = useState(180)

  useEffect(() => { loadLogs() }, [])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('fuel_logs')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .order('date_plein')
    setLogs(data || [])
    setLoading(false)
  }

  // Calcule la consommation (L/100km) entre chaque plein consécutif, par véhicule
  const consoParVehicule = useMemo(() => {
    const byVehicle = {}
    for (const l of logs) {
      const key = l.vehicle_id || l.vehicle_plaque
      if (!byVehicle[key]) byVehicle[key] = []
      byVehicle[key].push(l)
    }
    const result = {}
    for (const key in byVehicle) {
      const sorted = byVehicle[key].sort((a, b) =>
        (a.date_plein + (a.heure_plein || '')).localeCompare(b.date_plein + (b.heure_plein || ''))
      )
      const points = []
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        const distanceKm = curr.km_compteur - prev.km_compteur
        if (distanceKm <= 0) continue // km incohérent, on ignore le point
        const conso = (curr.litres / distanceKm) * 100
        points.push({
          date: curr.date_plein,
          dateLabel: formatDateShort(curr.date_plein),
          conso: Math.round(conso * 10) / 10,
          distanceKm,
          litres: curr.litres,
          plaque: curr.vehicle_plaque,
          type: curr.type_plein,
        })
      }
      result[key] = { plaque: sorted[0]?.vehicle_plaque || '—', points }
    }
    return result
  }, [logs])

  // Filtrage par période
  const cutoffDate = periodDays > 0
    ? new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10)
    : null

  // Données pour le graphique : soit un véhicule précis, soit la moyenne flotte par date
  const chartData = useMemo(() => {
    if (selectedVehicleId !== 'all') {
      const v = consoParVehicule[selectedVehicleId]
      if (!v) return []
      return v.points.filter(p => !cutoffDate || p.date >= cutoffDate)
    }
    // Vue globale : une ligne par véhicule, fusionnées sur l'axe date
    const dateMap = {}
    Object.entries(consoParVehicule).forEach(([key, v]) => {
      v.points.filter(p => !cutoffDate || p.date >= cutoffDate).forEach(p => {
        if (!dateMap[p.date]) dateMap[p.date] = { date: p.date, dateLabel: p.dateLabel }
        dateMap[p.date][v.plaque] = p.conso
      })
    })
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))
  }, [consoParVehicule, selectedVehicleId, cutoffDate])

  const vehicleKeys = Object.keys(consoParVehicule)
  const palette = ['#0E5AA7', '#D4720A', '#1A9E50', '#C0157A', '#7B3FB5', '#C62828', '#1565C0', '#8A95A3']

  // Moyenne de consommation affichée (véhicule sélectionné ou flotte)
  const consoMoyenne = useMemo(() => {
    if (selectedVehicleId !== 'all') {
      const pts = consoParVehicule[selectedVehicleId]?.points.filter(p => !cutoffDate || p.date >= cutoffDate) || []
      if (pts.length === 0) return null
      return Math.round((pts.reduce((s, p) => s + p.conso, 0) / pts.length) * 10) / 10
    }
    const allPts = Object.values(consoParVehicule).flatMap(v => v.points.filter(p => !cutoffDate || p.date >= cutoffDate))
    if (allPts.length === 0) return null
    return Math.round((allPts.reduce((s, p) => s + p.conso, 0) / allPts.length) * 10) / 10
  }, [consoParVehicule, selectedVehicleId, cutoffDate])

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#8A95A3', fontSize: '13px' }}>Chargement…</div>
  }

  if (logs.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#8A95A3' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>⛽</div>
        <div style={{ fontSize: '13px' }}>Aucun plein enregistré pour le moment.</div>
        <div style={{ fontSize: '11px', marginTop: '4px' }}>Les pleins saisis depuis l'appli conducteur apparaîtront ici.</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* Barre de filtres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={selectedVehicleId} onChange={e => setSelectedVehicleId(e.target.value)}
          style={{ padding: '6px 10px', border: '1px solid #D0D4DA', borderRadius: '6px', fontSize: '11px', fontFamily: 'inherit' }}>
          <option value="all">Tous les véhicules</option>
          {vehicleKeys.map(key => (
            <option key={key} value={key}>{consoParVehicule[key].plaque}</option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: '3px' }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriodDays(p.value)}
              style={{
                padding: '6px 11px', border: '1px solid #D0D4DA', borderRadius: '6px', fontSize: '11px', fontFamily: 'inherit', cursor: 'pointer',
                background: periodDays === p.value ? '#0E5AA7' : 'white', color: periodDays === p.value ? 'white' : '#4A5568',
              }}>{p.label}</button>
          ))}
        </div>
        {consoMoyenne != null && (
          <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#4A5568', background: '#F0F2F5', padding: '6px 12px', borderRadius: '6px' }}>
            Moyenne : <strong style={{ color: '#1A2130' }}>{consoMoyenne} L/100km</strong>
          </div>
        )}
      </div>

      {/* Graphique */}
      {chartData.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#8A95A3', fontSize: '12px' }}>
          Pas assez de pleins sur cette période pour calculer une consommation (il en faut au moins 2 consécutifs).
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '16px' }}>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#8A95A3' }} />
              <YAxis tick={{ fontSize: 10, fill: '#8A95A3' }} label={{ value: 'L/100km', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#8A95A3' }} />
              <Tooltip
                contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #D0D4DA' }}
                formatter={(value, name) => [`${value} L/100km`, name]}
              />
              {selectedVehicleId === 'all' && <Legend wrapperStyle={{ fontSize: '11px' }} />}

              {selectedVehicleId !== 'all' ? (
                <Line type="monotone" dataKey="conso" name={consoParVehicule[selectedVehicleId]?.plaque} stroke="#0E5AA7" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              ) : (
                vehicleKeys.map((key, i) => (
                  <Line key={key} type="monotone" dataKey={consoParVehicule[key].plaque} stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                ))
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableau détaillé si véhicule unique sélectionné */}
      {selectedVehicleId !== 'all' && chartData.length > 0 && (
        <div style={{ marginTop: '16px', background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: '#8A95A3', fontWeight: '600' }}>Date</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#8A95A3', fontWeight: '600' }}>Distance</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#8A95A3', fontWeight: '600' }}>Litres</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: '#8A95A3', fontWeight: '600' }}>Conso.</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', color: '#8A95A3', fontWeight: '600' }}>Type</th>
              </tr>
            </thead>
            <tbody>
              {[...chartData].reverse().map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F0F2F5' }}>
                  <td style={{ padding: '7px 12px' }}>{formatDateShort(p.date)}</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{p.distanceKm} km</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right' }}>{p.litres} L</td>
                  <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: '700', color: p.conso > (consoMoyenne || 0) * 1.15 ? '#C62828' : '#1A2130' }}>{p.conso} L/100km</td>
                  <td style={{ padding: '7px 12px', textAlign: 'center' }}>{p.type === 'station' ? '⛽' : '🏭'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
