'use client'

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Sidebar from '../../src/components/Sidebar'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '@/lib/useAuth'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'
const PALETTE = ['#0E5AA7', '#D4720A', '#1A9E50', '#C0157A', '#7B3FB5', '#C62828']

function moisLabel(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}
function moisKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function fmtEuro(n) {
  return (n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}

export default function DashboardPage() {
  const { loading: authLoading } = useAuth()
  const [factures, setFactures] = useState([])
  const [historique, setHistorique] = useState([])
  const [couts, setCouts] = useState([])
  const [fuelLogs, setFuelLogs] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [drivers, setDrivers] = useState([])
  const [interventions, setInterventions] = useState([])
  const [loading, setLoading] = useState(true)
  const [periodMonths, setPeriodMonths] = useState(12)

  useEffect(() => { loadAll() }, [])
  useEffect(() => { document.title = 'Moovenco · Dashboard' }, [])

  async function loadAll() {
    const [{ data: f }, { data: h }, { data: c }, { data: fl }, { data: v }, { data: d }, { data: i }] = await Promise.all([
      supabase.from('factures').select('*').eq('company_id', COMPANY_ID),
      supabase.from('historique_ca').select('*').eq('company_id', COMPANY_ID),
      supabase.from('couts').select('*').eq('company_id', COMPANY_ID),
      supabase.from('fuel_logs').select('*').eq('company_id', COMPANY_ID),
      supabase.from('vehicles').select('*').eq('company_id', COMPANY_ID),
      supabase.from('profiles').select('*').eq('company_id', COMPANY_ID).eq('role', 'conducteur'),
      supabase.from('interventions').select('*').eq('company_id', COMPANY_ID),
    ])
    setFactures(f || [])
    setHistorique(h || [])
    setCouts(c || [])
    setFuelLogs(fl || [])
    setVehicles(v || [])
    setDrivers(d || [])
    setInterventions(i || [])
    setLoading(false)
  }

  const cutoff = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - periodMonths)
    return d.toISOString().slice(0, 10)
  }, [periodMonths])

  // ─── CA consolidé (factures live + historique importé) ────────────────────
  const caParMois = useMemo(() => {
    const map = {}
    // Factures réellement encaissées ou émises (on exclut devis non signés)
    factures.filter(f => ['emise', 'envoyee', 'payee', 'signe'].includes(f.statut) && f.date_facture >= cutoff)
      .forEach(f => {
        const k = moisKey(f.date_facture)
        if (!map[k]) map[k] = { key: k, label: moisLabel(f.date_facture), ca: 0 }
        map[k].ca += parseFloat(f.montant_ht || 0)
      })
    historique.filter(h => h.date_facture >= cutoff)
      .forEach(h => {
        const k = moisKey(h.date_facture)
        if (!map[k]) map[k] = { key: k, label: moisLabel(h.date_facture), ca: 0 }
        map[k].ca += parseFloat(h.montant_ht || 0)
      })
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key))
  }, [factures, historique, cutoff])

  // ─── Coûts par mois (couts manuels + carburant) ────────────────────────────
  const coutsParMois = useMemo(() => {
    const map = {}
    couts.filter(c => c.date_cout >= cutoff).forEach(c => {
      const k = moisKey(c.date_cout)
      if (!map[k]) map[k] = { key: k, label: moisLabel(c.date_cout), cout: 0 }
      map[k].cout += parseFloat(c.montant || 0)
    })
    fuelLogs.filter(f => f.type_plein === 'station' && f.cout && f.date_plein >= cutoff).forEach(f => {
      const k = moisKey(f.date_plein)
      if (!map[k]) map[k] = { key: k, label: moisLabel(f.date_plein), cout: 0 }
      map[k].cout += parseFloat(f.cout || 0)
    })
    return map
  }, [couts, fuelLogs, cutoff])

  const hasCoutsData = Object.keys(coutsParMois).length > 0

  // Fusion CA + coûts pour le graphique marge
  const evolutionData = useMemo(() => {
    const allKeys = new Set([...caParMois.map(c => c.key), ...Object.keys(coutsParMois)])
    return [...allKeys].sort().map(k => {
      const ca = caParMois.find(c => c.key === k)?.ca || 0
      const cout = coutsParMois[k]?.cout || 0
      return { key: k, label: caParMois.find(c => c.key === k)?.label || coutsParMois[k]?.label, ca: Math.round(ca), cout: Math.round(cout), marge: Math.round(ca - cout) }
    })
  }, [caParMois, coutsParMois])

  // ─── Totaux période ─────────────────────────────────────────────────────────
  const totalCA = evolutionData.reduce((s, d) => s + d.ca, 0)
  const totalCout = evolutionData.reduce((s, d) => s + d.cout, 0)
  const totalMarge = totalCA - totalCout
  const margePct = totalCA > 0 ? Math.round((totalMarge / totalCA) * 100) : null

  // Comparaison au mois précédent (dernier mois complet vs avant)
  const caMoisDernier = evolutionData[evolutionData.length - 1]?.ca || 0
  const caMoisPrecedent = evolutionData[evolutionData.length - 2]?.ca || 0
  const evolutionCA = caMoisPrecedent > 0 ? Math.round(((caMoisDernier - caMoisPrecedent) / caMoisPrecedent) * 100) : null

  // ─── Répartition CA par catégorie ───────────────────────────────────────────
  const repartitionActivite = useMemo(() => {
    const map = {}
    factures.filter(f => ['emise', 'envoyee', 'payee', 'signe'].includes(f.statut) && f.date_facture >= cutoff)
      .forEach(f => {
        const cat = f.vehicle_type || 'Autre'
        map[cat] = (map[cat] || 0) + parseFloat(f.montant_ht || 0)
      })
    historique.filter(h => h.date_facture >= cutoff).forEach(h => {
      const cat = h.categorie || 'Autre'
      map[cat] = (map[cat] || 0) + parseFloat(h.montant_ht || 0)
    })
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  }, [factures, historique, cutoff])

  // ─── Indicateurs opérationnels ──────────────────────────────────────────────
  const vehiculesActifs = vehicles.filter(v => v.active).length
  const conducteursActifs = drivers.filter(d => d.active).length
  const interventionsEnCours = interventions.filter(i => i.status === 'planifie' || i.status === 'en_cours').length

  // Alertes contrôle technique / assurance / tachygraphe à venir (90j et 7j)
  const alertesVehicules = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const in90 = new Date(); in90.setDate(in90.getDate() + 90)
    const in90Str = in90.toISOString().slice(0, 10)
    const in7 = new Date(); in7.setDate(in7.getDate() + 7)
    const in7Str = in7.toISOString().slice(0, 10)
    let count90 = 0, urgent7 = 0
    vehicles.forEach(v => {
      ;['ct_expiry', 'assurance_expiry', 'tachygraphe_expiry'].forEach(field => {
        if (v[field] && v[field] >= today && v[field] <= in90Str) count90++
        if (v[field] && v[field] >= today && v[field] <= in7Str) urgent7++
      })
    })
    return { count90, urgent7 }
  }, [vehicles])

  // Consommation moyenne flotte (dernier mois de données dispo)
  const consoMoyenneFlotte = useMemo(() => {
    const byVehicle = {}
    fuelLogs.forEach(l => {
      const key = l.vehicle_id || l.vehicle_plaque
      if (!byVehicle[key]) byVehicle[key] = []
      byVehicle[key].push(l)
    })
    const consos = []
    Object.values(byVehicle).forEach(logs => {
      const sorted = [...logs].sort((a, b) => (a.date_plein + (a.heure_plein||'')).localeCompare(b.date_plein + (b.heure_plein||'')))
      for (let i = 1; i < sorted.length; i++) {
        const dist = sorted[i].km_compteur - sorted[i-1].km_compteur
        if (dist > 0) consos.push((sorted[i].litres / dist) * 100)
      }
    })
    if (consos.length === 0) return null
    return Math.round((consos.reduce((a,b) => a+b, 0) / consos.length) * 10) / 10
  }, [fuelLogs])

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', background: '#F4F5F7' }}>
        <Sidebar currentPage="dashboard" />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A95A3', fontSize: '13px' }}>Chargement…</div>
      </div>
    )
  }

  const kpiCardStyle = { background: 'white', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#F4F5F7', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <Sidebar currentPage="dashboard" />
      <div style={{ flex: 1, maxWidth: '1200px', margin: '0 auto', padding: '20px 16px 60px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#1A2130' }}>📊 Tableau de bord</h1>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[6, 12, 24].map(m => (
              <button key={m} onClick={() => setPeriodMonths(m)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #D0D4DA', background: periodMonths === m ? '#0E5AA7' : 'white', color: periodMonths === m ? 'white' : '#4A5568', fontSize: '11px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer' }}>
                {m} mois
              </button>
            ))}
          </div>
        </div>

        {!hasCoutsData && (
          <div style={{ background: '#FFF3E0', border: '1px solid #FFE0B2', borderRadius: '8px', padding: '10px 14px', fontSize: '11px', color: '#D4720A', marginBottom: '16px' }}>
            💡 Aucun coût saisi pour l'instant — la marge ne peut pas être calculée. Renseignez vos coûts (salaires, charges, assurances…) via <a href="/import" style={{ color: '#D4720A', fontWeight: '700' }}>l'import</a> pour débloquer cet indicateur.
          </div>
        )}

        {/* KPI principaux */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          <div style={kpiCardStyle}>
            <div style={{ fontSize: '10px', color: '#8A95A3', fontWeight: '600', textTransform: 'uppercase' }}>Chiffre d'affaires HT</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#1A2130', marginTop: '4px' }}>{fmtEuro(totalCA)}</div>
            {evolutionCA != null && (
              <div style={{ fontSize: '10px', color: evolutionCA >= 0 ? '#1A9E50' : '#C62828', marginTop: '2px' }}>
                {evolutionCA >= 0 ? '↗' : '↘'} {Math.abs(evolutionCA)}% vs mois précédent
              </div>
            )}
          </div>
          <div style={kpiCardStyle}>
            <div style={{ fontSize: '10px', color: '#8A95A3', fontWeight: '600', textTransform: 'uppercase' }}>Marge estimée</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: hasCoutsData ? '#1A2130' : '#CDD3DA', marginTop: '4px' }}>
              {hasCoutsData ? fmtEuro(totalMarge) : '—'}
            </div>
            {hasCoutsData && margePct != null && <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '2px' }}>{margePct}% du CA</div>}
          </div>
          <div style={kpiCardStyle}>
            <div style={{ fontSize: '10px', color: '#8A95A3', fontWeight: '600', textTransform: 'uppercase' }}>Véhicules actifs</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: '#1A2130', marginTop: '4px' }}>{vehiculesActifs}</div>
            <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '2px' }}>{conducteursActifs} conducteur(s) actif(s)</div>
          </div>
          <div style={kpiCardStyle}>
            <div style={{ fontSize: '10px', color: '#8A95A3', fontWeight: '600', textTransform: 'uppercase' }}>Alertes échéances (90j)</div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: alertesVehicules.urgent7 > 0 ? '#C62828' : alertesVehicules.count90 > 0 ? '#D4720A' : '#1A9E50', marginTop: '4px' }}>{alertesVehicules.count90}</div>
            <div style={{ fontSize: '10px', color: alertesVehicules.urgent7 > 0 ? '#C62828' : '#8A95A3', marginTop: '2px' }}>
              {alertesVehicules.urgent7 > 0 ? `${alertesVehicules.urgent7} urgente(s) ≤ 7j` : `${interventionsEnCours} intervention(s) en cours`}
            </div>
          </div>
          {consoMoyenneFlotte != null && (
            <div style={kpiCardStyle}>
              <div style={{ fontSize: '10px', color: '#8A95A3', fontWeight: '600', textTransform: 'uppercase' }}>Conso. moyenne flotte</div>
              <div style={{ fontSize: '22px', fontWeight: '700', color: '#1A2130', marginTop: '4px' }}>{consoMoyenneFlotte} L/100km</div>
            </div>
          )}
        </div>

        {/* Graphique CA / Marge */}
        <div style={{ ...kpiCardStyle, marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130', marginBottom: '12px' }}>Évolution du chiffre d'affaires{hasCoutsData ? ' et de la marge' : ''}</div>
          {evolutionData.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#8A95A3', fontSize: '12px' }}>Aucune donnée sur cette période.</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolutionData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8A95A3' }} />
                <YAxis tick={{ fontSize: 10, fill: '#8A95A3' }} tickFormatter={v => `${v/1000}k€`} />
                <Tooltip formatter={(v) => fmtEuro(v)} contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #D0D4DA' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="ca" name="CA HT" stroke="#0E5AA7" strokeWidth={2} dot={{ r: 3 }} />
                {hasCoutsData && <Line type="monotone" dataKey="cout" name="Coûts" stroke="#C62828" strokeWidth={2} dot={{ r: 3 }} />}
                {hasCoutsData && <Line type="monotone" dataKey="marge" name="Marge" stroke="#1A9E50" strokeWidth={2} dot={{ r: 3 }} />}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Répartition par activité */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={kpiCardStyle}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130', marginBottom: '12px' }}>Répartition du CA par type</div>
            {repartitionActivite.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#8A95A3', fontSize: '12px' }}>Aucune donnée.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={repartitionActivite} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                    {repartitionActivite.map((entry, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtEuro(v)} contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #D0D4DA' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={kpiCardStyle}>
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130', marginBottom: '12px' }}>CA par mois</div>
            {evolutionData.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#8A95A3', fontSize: '12px' }}>Aucune donnée.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={evolutionData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F2F5" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8A95A3' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#8A95A3' }} tickFormatter={v => `${v/1000}k€`} />
                  <Tooltip formatter={(v) => fmtEuro(v)} contentStyle={{ fontSize: '11px', borderRadius: '6px', border: '1px solid #D0D4DA' }} />
                  <Bar dataKey="ca" name="CA HT" fill="#0E5AA7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
