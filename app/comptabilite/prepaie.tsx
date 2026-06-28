'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const TAUX_HORAIRE = 13.484
const TAUX_ANCIENNETE = 0.02
const BASE_ANCIENNETE = 1536.09

const ABSENCES = ['RH', 'RHL', 'RHD', 'FERIE', 'HOTEL', 'CP', 'MAL', 'SE']
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getDayLabel(year: number, month: number, day: number) {
  const d = new Date(year, month, day)
  return ['D','L','M','M','J','V','S'][d.getDay()]
}

const EMPTY_DAY = {
  absence: '', heures_conduite: '', heures_autres: '', heures_coupure: '',
  heures_nuit: '', heures_amplitude: '', ica: '',
  repas_unique: 0, repas_france: 0, repas_paris: 0, nuits: 0, notes: '',
}

export default function Prepaie() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [conducteurs, setConducteurs] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [saisie, setSaisie] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => { loadConducteurs() }, [])
  useEffect(() => { if (selected) loadSaisie() }, [selected, year, month])

  async function loadConducteurs() {
    const { data } = await supabase.from('profiles').select('*')
      .eq('company_id', COMPANY_ID).eq('role', 'conducteur').eq('active', true).order('name')
    setConducteurs(data || [])
    setLoading(false)
  }

  async function loadSaisie() {
    const { data } = await supabase.from('prepaie_jours').select('*')
      .eq('company_id', COMPANY_ID).eq('profile_id', selected.id)
      .eq('annee', year).eq('mois', month + 1)
    const map: any = {}
    ;(data || []).forEach((d: any) => { map[d.jour] = d })
    setSaisie(map)
  }

  async function saveDay(day: number, field: string, value: any) {
    const existing = saisie[day]
    const newData = { ...EMPTY_DAY, ...(existing || {}), [field]: value }
    if (existing) {
      await supabase.from('prepaie_jours').update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', existing.id)
      setSaisie((prev: any) => ({ ...prev, [day]: { ...existing, [field]: value } }))
    } else {
      const id = generateId()
      const row = { id, company_id: COMPANY_ID, profile_id: selected.id, annee: year, mois: month + 1, jour: day, ...newData, [field]: value }
      await supabase.from('prepaie_jours').insert(row)
      setSaisie((prev: any) => ({ ...prev, [day]: row }))
    }
  }

  function getDay(day: number) { return saisie[day] || EMPTY_DAY }

  function calcRecap() {
    const days = getDaysInMonth(year, month)
    let hTravail = 0, hCoupure = 0, hNuit = 0, hAmplitude = 0, ica = 0, nuits = 0
    let repasUnique = 0, repasFrance = 0, repasParis = 0

    for (let d = 1; d <= days; d++) {
      const j = getDay(d)
      if (j.absence) continue
      hTravail += (parseFloat(j.heures_conduite) || 0) + (parseFloat(j.heures_autres) || 0)
      hCoupure += parseFloat(j.heures_coupure) || 0
      hNuit += parseFloat(j.heures_nuit) || 0
      hAmplitude += parseFloat(j.heures_amplitude) || 0
      ica += parseFloat(j.ica) || 0
      nuits += parseInt(j.nuits) || 0
      repasUnique += parseInt(j.repas_unique) || 0
      repasFrance += parseInt(j.repas_france) || 0
      repasParis += parseInt(j.repas_paris) || 0
    }

    const salBase = 100 * TAUX_HORAIRE
    const primeAnc = BASE_ANCIENNETE * TAUX_ANCIENNETE
    const primeDecouch = nuits * 21.43
    const primeCoupure = Object.values(saisie).filter((j: any) => !j.absence && parseFloat(j.heures_coupure) > 0).length * 47.58
    const primeICA = ica * TAUX_HORAIRE
    const heuresNuitMaj = hNuit * TAUX_HORAIRE
    const heuresAmpMaj = hAmplitude * TAUX_HORAIRE
    const heuresCoupure = hCoupure * TAUX_HORAIRE
    const brut = salBase + primeAnc + primeDecouch + primeCoupure + primeICA + heuresNuitMaj + heuresAmpMaj + heuresCoupure
    const indRepas = repasUnique * 10.77 + repasFrance * 17.45 + repasParis * 20.94

    return { hTravail, hCoupure, hNuit, hAmplitude, ica, nuits, repasUnique, repasFrance, repasParis, salBase, primeAnc, primeDecouch, primeCoupure, primeICA, heuresNuitMaj, heuresAmpMaj, heuresCoupure, brut, indRepas }
  }


  function exportCSV() {
    if (!selected || !recap) return
    const days = getDaysInMonth(year, month)
    const rows = []

    // En-tête
    rows.push([
      'Jour', 'Semaine', 'Absence',
      'H.Conduite', 'H.Autres', 'H.Coupure', 'H.Nuit', 'H.Amplitude', 'ICA',
      'Repas Unique', 'Repas France', 'Repas Paris', 'Nuits'
    ].join(';'))

    // Lignes journalières
    for (let d = 1; d <= days; d++) {
      const j = getDay(d)
      const dayLabel = getDayLabel(year, month, d)
      rows.push([
        d, dayLabel, j.absence || '',
        j.heures_conduite || 0, j.heures_autres || 0, j.heures_coupure || 0,
        j.heures_nuit || 0, j.heures_amplitude || 0, j.ica || 0,
        j.repas_unique || 0, j.repas_france || 0, j.repas_paris || 0, j.nuits || 0
      ].join(';'))
    }

    // Ligne vide
    rows.push('')

    // Totaux
    rows.push(['TOTAUX', '', '',
      recap.hTravail.toFixed(2), '', recap.hCoupure.toFixed(2),
      recap.hNuit.toFixed(2), recap.hAmplitude.toFixed(2), recap.ica.toFixed(2),
      recap.repasUnique, recap.repasFrance, recap.repasParis, recap.nuits
    ].join(';'))

    // Ligne vide
    rows.push('')

    // Récapitulatif financier
    rows.push(['ELEMENTS DE BRUT', '', ''].join(';'))
    rows.push(['10200 Salaire de base', `100h x ${TAUX_HORAIRE}€`, recap.salBase.toFixed(2) + ' €'].join(';'))
    rows.push(['10350 Prime ancienneté', `2% x ${BASE_ANCIENNETE}€`, recap.primeAnc.toFixed(2) + ' €'].join(';'))
    rows.push(['622 Prime découcher', `${recap.nuits} nuit(s) x 21.43€`, recap.primeDecouch.toFixed(2) + ' €'].join(';'))
    rows.push(['623 Prime coupure', '', recap.primeCoupure.toFixed(2) + ' €'].join(';'))
    rows.push(['678 Prime ICA', `${recap.ica.toFixed(2)}h x ${TAUX_HORAIRE}€`, recap.primeICA.toFixed(2) + ' €'].join(';'))
    rows.push(['682 H. nuit majorées', `${recap.hNuit.toFixed(2)}h x ${TAUX_HORAIRE}€`, recap.heuresNuitMaj.toFixed(2) + ' €'].join(';'))
    rows.push(['683 H. amplitude 65%', `${recap.hAmplitude.toFixed(2)}h x ${TAUX_HORAIRE}€`, recap.heuresAmpMaj.toFixed(2) + ' €'].join(';'))
    rows.push(['685 H. coupure', `${recap.hCoupure.toFixed(2)}h x ${TAUX_HORAIRE}€`, recap.heuresCoupure.toFixed(2) + ' €'].join(';'))
    rows.push(['SALAIRE BRUT ESTIMÉ', '', recap.brut.toFixed(2) + ' €'].join(';'))
    rows.push('')
    rows.push(['INDEMNITES', '', ''].join(';'))
    rows.push(['8060 Repas unique', `${recap.repasUnique} x 10.77€`, (recap.repasUnique * 10.77).toFixed(2) + ' €'].join(';'))
    rows.push(['8061 Repas France', `${recap.repasFrance} x 17.45€`, (recap.repasFrance * 17.45).toFixed(2) + ' €'].join(';'))
    rows.push(['8062 Repas Paris/Etr.', `${recap.repasParis} x 20.94€`, (recap.repasParis * 20.94).toFixed(2) + ' €'].join(';'))
    rows.push(['Total indemnités', '', recap.indRepas.toFixed(2) + ' €'].join(';'))

    // Générer le fichier
    const csvContent = '\uFEFF' + rows.join('\n') // BOM pour Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Prepaie_${selected.name.replace(/\s+/g, '_')}_${MOIS[month]}_${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const recap = selected ? calcRecap() : null
  const days = getDaysInMonth(year, month)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* BARRE PERIODE */}
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', fontSize: '16px', padding: '0 8px', cursor: 'pointer', borderRadius: '4px' }}>‹</button>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'white', minWidth: '120px', textAlign: 'center' }}>{MOIS[month]} {year}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', fontSize: '16px', padding: '0 8px', cursor: 'pointer', borderRadius: '4px' }}>›</button>
        {recap && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)' }}>
              {recap.hTravail.toFixed(1)}h travaillées
            </span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#2EC971' }}>
              Brut estimé : {recap.brut.toFixed(2)} €
            </span>
            <button onClick={exportCSV}
              style={{ background: '#2EC971', border: 'none', color: '#1A2130', fontFamily: 'inherit', fontSize: '10px', fontWeight: '700', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
              📥 Export CSV
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR CONDUCTEURS */}
        <div style={{ width: '200px', minWidth: '200px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', borderBottom: '1px solid #F0F2F5' }}>
            Conducteurs
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {conducteurs.map(c => (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', borderLeft: `3px solid ${selected?.id === c.id ? '#0E5AA7' : 'transparent'}`, background: selected?.id === c.id ? '#E8F0FB' : 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: c.color, color: 'white', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {c.initials}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ZONE PRINCIPALE */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '10px', color: '#8A95A3' }}>
              <div style={{ fontSize: '32px' }}>📋</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Sélectionnez un conducteur</div>
            </div>
          ) : (
            <div style={{ padding: '14px' }}>

              {/* EN-TÊTE */}
              <div style={{ background: 'white', borderRadius: '10px', padding: '12px 16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: selected.color, color: 'white', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {selected.initials}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130' }}>{selected.name}</div>
                  <div style={{ fontSize: '10px', color: '#8A95A3' }}>Prépaie {MOIS[month]} {year} — Groupe 9 — Coeff 140V</div>
                </div>
                {message && <div style={{ marginLeft: 'auto', background: '#E8F5E9', color: '#1A9E50', fontSize: '11px', fontWeight: '600', padding: '5px 10px', borderRadius: '5px' }}>{message}</div>}
              </div>

              {/* GRILLE SAISIE */}
              <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)', marginBottom: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ background: '#1A2130', color: 'white' }}>
                      <th style={{ padding: '8px 6px', textAlign: 'center', width: '30px' }}>J</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center', width: '24px' }}></th>
                      <th style={{ padding: '8px 6px', textAlign: 'center', width: '80px' }}>Absence</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>H. Conduite</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>H. Autres</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>H. Coupure</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>H. Nuit</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>H. Ampli.</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>ICA</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Rep. U</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Rep. F</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Rep. P</th>
                      <th style={{ padding: '8px 6px', textAlign: 'center' }}>Nuits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: days }, (_, i) => i + 1).map(day => {
                      const dayLabel = getDayLabel(year, month, day)
                      const isWeekend = dayLabel === 'S' || dayLabel === 'D'
                      const j = getDay(day)
                      const isAbsent = !!j.absence
                      const bg = isAbsent ? '#F0F4FF' : isWeekend ? '#FAFBFC' : 'white'
                      return (
                        <tr key={day} style={{ borderBottom: '1px solid #F0F2F5', background: bg }}>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: '700', color: '#1A2130', fontSize: '11px' }}>{day}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: '600', color: isWeekend ? '#C62828' : '#8A95A3', fontSize: '10px' }}>{dayLabel}</td>
                          <td style={{ padding: '2px 4px' }}>
                            <select value={j.absence || ''} onChange={e => saveDay(day, 'absence', e.target.value)}
                              style={{ width: '100%', padding: '3px 4px', border: '1px solid #E2E6EA', borderRadius: '3px', fontSize: '10px', fontFamily: 'inherit', background: j.absence ? '#E8F0FB' : 'white', color: j.absence ? '#0E5AA7' : '#1A2130', fontWeight: j.absence ? '700' : '400' }}>
                              <option value="">—</option>
                              {ABSENCES.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                          </td>
                          {['heures_conduite','heures_autres','heures_coupure','heures_nuit','heures_amplitude','ica'].map(field => (
                            <td key={field} style={{ padding: '2px 3px' }}>
                              <input type="number" step="0.01" min="0" value={j[field] || ''} disabled={isAbsent}
                                onChange={e => saveDay(day, field, e.target.value)}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #E2E6EA', borderRadius: '3px', fontSize: '10px', fontFamily: 'inherit', textAlign: 'center', background: isAbsent ? '#F0F2F5' : 'white', color: parseFloat(j[field]) > 0 ? '#0E5AA7' : '#1A2130', fontWeight: parseFloat(j[field]) > 0 ? '700' : '400' }} />
                            </td>
                          ))}
                          {['repas_unique','repas_france','repas_paris','nuits'].map(field => (
                            <td key={field} style={{ padding: '2px 3px' }}>
                              <input type="number" min="0" value={j[field] || ''} disabled={isAbsent}
                                onChange={e => saveDay(day, field, parseInt(e.target.value) || 0)}
                                style={{ width: '100%', padding: '3px 4px', border: '1px solid #E2E6EA', borderRadius: '3px', fontSize: '10px', fontFamily: 'inherit', textAlign: 'center', background: isAbsent ? '#F0F2F5' : 'white', color: parseInt(j[field]) > 0 ? '#1A9E50' : '#1A2130', fontWeight: parseInt(j[field]) > 0 ? '700' : '400' }} />
                            </td>
                          ))}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#253044', color: 'white', fontWeight: '700' }}>
                      <td colSpan={3} style={{ padding: '8px 10px', fontSize: '10px' }}>TOTAUX</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.hTravail.toFixed(2)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>—</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.hCoupure.toFixed(2)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.hNuit.toFixed(2)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.hAmplitude.toFixed(2)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.ica.toFixed(2)}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.repasUnique}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.repasFrance}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.repasParis}</td>
                      <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '10px' }}>{recap?.nuits}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* RECAP CALCULE */}
              {recap && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Éléments de brut estimés</div>
                    {[
                      ['10200 Salaire de base', `100h × ${TAUX_HORAIRE}€`, recap.salBase],
                      ['10350 Prime ancienneté', `2% × ${BASE_ANCIENNETE}€`, recap.primeAnc],
                      ['622 Prime découcher', `${recap.nuits} nuit(s) × 21,43€`, recap.primeDecouch],
                      ['623 Prime coupure', `× 47,58€`, recap.primeCoupure],
                      ['678 Prime ICA', `${recap.ica.toFixed(2)}h × ${TAUX_HORAIRE}€`, recap.primeICA],
                      ['682 H. nuit majorées', `${recap.hNuit.toFixed(2)}h × ${TAUX_HORAIRE}€`, recap.heuresNuitMaj],
                      ['683 H. amplitude 65%', `${recap.hAmplitude.toFixed(2)}h × ${TAUX_HORAIRE}€`, recap.heuresAmpMaj],
                      ['685 H. coupure', `${recap.hCoupure.toFixed(2)}h × ${TAUX_HORAIRE}€`, recap.heuresCoupure],
                    ].map(([label, detail, val]) => (
                      <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F0F2F5', fontSize: '11px' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#1A2130' }}>{label as string}</div>
                          <div style={{ fontSize: '9px', color: '#8A95A3' }}>{detail as string}</div>
                        </div>
                        <div style={{ fontWeight: '700', color: '#0E5AA7' }}>{(val as number).toFixed(2)} €</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: '4px', fontSize: '13px', fontWeight: '800', color: '#1A2130' }}>
                      <span>SALAIRE BRUT ESTIMÉ</span>
                      <span style={{ color: '#0E5AA7' }}>{recap.brut.toFixed(2)} €</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Indemnités non soumises</div>
                      {[
                        ['8060 Repas unique', recap.repasUnique + ' × 10,77€', recap.repasUnique * 10.77],
                        ['8061 Repas France', recap.repasFrance + ' × 17,45€', recap.repasFrance * 17.45],
                        ['8062 Repas Paris/Etr.', recap.repasParis + ' × 20,94€', recap.repasParis * 20.94],
                      ].map(([label, detail, val]) => (
                        <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F0F2F5', fontSize: '11px' }}>
                          <div>
                            <div style={{ fontWeight: '600', color: '#1A2130' }}>{label as string}</div>
                            <div style={{ fontSize: '9px', color: '#8A95A3' }}>{detail as string}</div>
                          </div>
                          <div style={{ fontWeight: '700', color: '#1A9E50' }}>{(val as number).toFixed(2)} €</div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: '4px', fontSize: '12px', fontWeight: '700', color: '#1A9E50' }}>
                        <span>Total indemnités</span>
                        <span>{recap.indRepas.toFixed(2)} €</span>
                      </div>
                    </div>

                    <div style={{ background: '#1A2130', borderRadius: '10px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,.6)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.4px' }}>Récap mensuel</div>
                      {[
                        ['Heures travaillées', recap.hTravail.toFixed(2) + 'h'],
                        ['Heures coupure', recap.hCoupure.toFixed(2) + 'h'],
                        ['Heures nuit', recap.hNuit.toFixed(2) + 'h'],
                        ['Heures amplitude', recap.hAmplitude.toFixed(2) + 'h'],
                        ['ICA', recap.ica.toFixed(2) + 'h'],
                        ['Nuits découcher', recap.nuits + ''],
                        ['Repas total', (recap.repasUnique + recap.repasFrance + recap.repasParis) + ''],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '11px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                          <span style={{ color: 'rgba(255,255,255,.6)' }}>{label}</span>
                          <span style={{ fontWeight: '700', color: 'white' }}>{val}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: '12px', padding: '10px', background: '#0E5AA7', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'white' }}>Brut estimé</span>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>{recap.brut.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}