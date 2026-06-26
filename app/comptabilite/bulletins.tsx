'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const RGO = {
  nom: 'SAS RGO Mobilités Janzé',
  adresse: '57 rue de Bain',
  cp: '35150',
  ville: 'JANZÉ',
  siret: '699 200 788 00072',
  naf: '4939A',
  convention: 'CCN DES TRANSPORTS ROUTIERS ET ACTIVITES AUXILIAIRES DU TRANSPORT',
}

const TAUX_HORAIRE = 13.484
const BASE_ANCIENNETE = 1536.09
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

const COTISATIONS = [
  { label: 'Sécurité sociale Santé', base: 'brut', taux_sal: 7.000, taux_pat: 0 },
  { label: 'Sécurité sociale Santé (2)', base: 'brut', taux_sal: 0, taux_pat: 6.000 },
  { label: 'Complémentaire incap. inv. décès (Tr1)', base: 'brut', taux_sal: 0.552, taux_pat: 0.648 },
  { label: 'Complémentaire santé', base: 'fixed_4005', taux_sal: 0.602, taux_pat: 0.902 },
  { label: 'Accidents du travail', base: 'brut', taux_sal: 0, taux_pat: 5.930 },
  { label: 'Retraite SS (Tot.)', base: 'brut', taux_sal: 0.400, taux_pat: 2.110 },
  { label: 'Retraite SS (Tr1)', base: 'brut', taux_sal: 6.900, taux_pat: 8.550 },
  { label: 'Retraite complémentaire (Tr1)', base: 'brut', taux_sal: 4.010, taux_pat: 6.010 },
  { label: 'Famille', base: 'brut', taux_sal: 0, taux_pat: 5.250 },
  { label: 'Assurance chômage', base: 'brut', taux_sal: 0, taux_pat: 3.610 },
  { label: 'Autres contributions employeur', base: 'brut', taux_sal: 0, taux_pat: 3.860 },
  { label: 'Cotisations convention collective', base: 'brut', taux_sal: 0.165, taux_pat: 1.105 },
  { label: 'CSG déductible', base: 'csg', taux_sal: 6.800, taux_pat: 0 },
  { label: 'CSG/CRDS non déductible', base: 'csg', taux_sal: 2.900, taux_pat: 0 },
]

const EXONERATION = 346.58

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

export default function Bulletins() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [conducteurs, setConducteurs] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [saisie, setSaisie] = useState<any>({})
  const [loading, setLoading] = useState(true)

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

  function calcBrut() {
    const days = getDaysInMonth(year, month)
    let hCoupure = 0, hNuit = 0, hAmplitude = 0, ica = 0, nuits = 0
    let repasUnique = 0, repasFrance = 0, repasParis = 0
    let nbCoupures = 0

    for (let d = 1; d <= days; d++) {
      const j = saisie[d]
      if (!j || j.absence) continue
      hCoupure += parseFloat(j.heures_coupure) || 0
      hNuit += parseFloat(j.heures_nuit) || 0
      hAmplitude += parseFloat(j.heures_amplitude) || 0
      ica += parseFloat(j.ica) || 0
      nuits += parseInt(j.nuits) || 0
      repasUnique += parseInt(j.repas_unique) || 0
      repasFrance += parseInt(j.repas_france) || 0
      repasParis += parseInt(j.repas_paris) || 0
      if (parseFloat(j.heures_coupure) > 0) nbCoupures++
    }

    const salBase = 100 * TAUX_HORAIRE
    const primeAnc = BASE_ANCIENNETE * 0.02
    const primeDecouch = nuits * 21.43
    const primeCoupure = nbCoupures * 47.58
    const primeICA = ica * TAUX_HORAIRE
    const heuresNuit = hNuit * TAUX_HORAIRE
    const heuresAmp = hAmplitude * TAUX_HORAIRE
    const heuresCoupure = hCoupure * TAUX_HORAIRE

    const brut = salBase + primeAnc + primeDecouch + primeCoupure + primeICA + heuresNuit + heuresAmp + heuresCoupure

    const indRepasTotal = repasUnique * 10.77 + repasFrance * 17.45 + repasParis * 20.94

    const lignes = [
      { code: '10200', label: 'Salaire de base', base: 100, taux: TAUX_HORAIRE, montant: salBase },
      { code: '10350', label: 'Prime ancienneté', base: BASE_ANCIENNETE, taux: 2.000, montant: primeAnc },
      { code: '622', label: 'Prime de découcher', base: nuits, taux: 21.43, montant: primeDecouch },
      { code: '623', label: 'Prime coupure', base: nbCoupures, taux: 47.58, montant: primeCoupure },
      { code: '678', label: 'Prime ICA', base: ica, taux: TAUX_HORAIRE, montant: primeICA },
      { code: '682', label: 'Heures de nuit majorées', base: hNuit, taux: TAUX_HORAIRE, montant: heuresNuit },
      { code: '683', label: 'Heures Amplitude majorées à 65%', base: hAmplitude, taux: TAUX_HORAIRE, montant: heuresAmp },
      { code: '685', label: 'Heures de coupure', base: hCoupure, taux: TAUX_HORAIRE, montant: heuresCoupure },
    ]

    const indemnites = [
      { code: '8060', label: 'Repas unique', base: repasUnique, taux: 10.77, montant: repasUnique * 10.77 },
      { code: '8061', label: 'Repas France', base: repasFrance, taux: 17.45, montant: repasFrance * 17.45 },
      { code: '8062', label: 'Repas Paris / Etranger', base: repasParis, taux: 20.94, montant: repasParis * 20.94 },
    ]

    // Calcul cotisations
    const baseCsg = brut * 0.9825
    let totalSal = 0, totalPat = 0

    const cotisationsCalc = COTISATIONS.map(c => {
      const base = c.base === 'csg' ? baseCsg : c.base === 'fixed_4005' ? 4005 : brut
      const sal = base * c.taux_sal / 100
      const pat = base * c.taux_pat / 100
      totalSal += sal
      totalPat += pat
      return { ...c, base, montant_sal: sal, montant_pat: pat }
    })

    const patApresExo = totalPat - EXONERATION
    const netImposable = brut - totalSal
    const netAvantImpot = netImposable + indRepasTotal
    const netPaye = netAvantImpot // taux PAS = 0% pour Cédric

    return {
      lignes, indemnites, brut, cotisationsCalc, totalSal, totalPat: patApresExo,
      baseCsg, netImposable, netAvantImpot, netPaye, indRepasTotal,
      hCoupure, hNuit, hAmplitude, ica, nuits, repasUnique, repasFrance, repasParis,
    }
  }

  const calc = Object.keys(saisie).length > 0 ? calcBrut() : null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>

      {/* BARRE PERIODE */}
      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', fontSize: '16px', padding: '0 8px', cursor: 'pointer', borderRadius: '4px' }}>‹</button>
        <span style={{ fontSize: '12px', fontWeight: '700', color: 'white', minWidth: '120px', textAlign: 'center' }}>{MOIS[month]} {year}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'white', fontSize: '16px', padding: '0 8px', cursor: 'pointer', borderRadius: '4px' }}>›</button>
        {calc && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)' }}>Brut : {calc.brut.toFixed(2)} €</span>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#2EC971' }}>Net : {calc.netPaye.toFixed(2)} €</span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <div style={{ width: '200px', minWidth: '200px', background: 'white', borderRight: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', borderBottom: '1px solid #F0F2F5' }}>
            Conducteurs
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {conducteurs.map(c => (
              <div key={c.id} onClick={() => { setSelected(c); setSaisie({}) }}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', borderLeft: `3px solid ${selected?.id === c.id ? '#0E5AA7' : 'transparent'}`, background: selected?.id === c.id ? '#E8F0FB' : 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: c.color, color: 'white', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {c.initials}
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{c.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* BULLETIN */}
        <div style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
          {!selected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '10px', color: '#8A95A3' }}>
              <div style={{ fontSize: '32px' }}>💼</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Sélectionnez un conducteur</div>
              <div style={{ fontSize: '11px', color: '#8A95A3' }}>Les données sont calculées depuis la Prépaie</div>
            </div>
          ) : !calc ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '10px', color: '#8A95A3' }}>
              <div style={{ fontSize: '32px' }}>📋</div>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Aucune prépaie saisie pour {MOIS[month]} {year}</div>
              <div style={{ fontSize: '11px' }}>Remplissez d'abord la prépaie dans l'onglet Prépaie</div>
            </div>
          ) : (
            <div id="bulletin-print" style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', maxWidth: '900px', margin: '0 auto' }}>

              {/* EN-TÊTE */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '2px solid #1A2130' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#1A2130' }}>{RGO.nom}</div>
                  <div style={{ fontSize: '11px', color: '#4A5568', marginTop: '4px' }}>{RGO.adresse}</div>
                  <div style={{ fontSize: '11px', color: '#4A5568' }}>{RGO.cp} {RGO.ville}</div>
                  <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '4px' }}>SIRET {RGO.siret} — NAF {RGO.naf}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '800', color: '#0E5AA7' }}>BULLETIN DE SALAIRE</div>
                  <div style={{ fontSize: '12px', color: '#4A5568', marginTop: '4px' }}>
                    01/{String(month + 1).padStart(2,'0')}/{year} — {new Date(year, month + 1, 0).getDate()}/{String(month + 1).padStart(2,'0')}/{year}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '4px' }}>{RGO.convention}</div>
                </div>
              </div>

              {/* SALARIÉ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '16px', padding: '12px', background: '#F8F9FB', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#4A5568' }}>
                  <div style={{ fontWeight: '700', color: '#1A2130', fontSize: '13px', marginBottom: '4px' }}>M. {selected.name}</div>
                  <div>Groupe 9 — Coefficient 140V</div>
                  <div>Qualification : Conducteur 140V</div>
                </div>
                <div style={{ fontSize: '11px', color: '#4A5568', textAlign: 'right' }}>
                  <div>Matricule : {selected.matricule || '00630'}</div>
                  <div>Plafond SS : 2 640,60 €</div>
                  <div>Base SS : {calc.brut.toFixed(2)} €</div>
                </div>
              </div>

              {/* ÉLÉMENTS DE REVENU BRUT */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ background: '#1A2130', color: 'white', padding: '6px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '5px 5px 0 0' }}>
                  ÉLÉMENTS DE REVENU BRUT
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#F0F2F5', borderBottom: '1px solid #E2E6EA' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#8A95A3', fontWeight: '700', fontSize: '10px' }}>Code</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#8A95A3', fontWeight: '700', fontSize: '10px' }}>Libellé</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#8A95A3', fontWeight: '700', fontSize: '10px' }}>Base</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#8A95A3', fontWeight: '700', fontSize: '10px' }}>Taux</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right', color: '#8A95A3', fontWeight: '700', fontSize: '10px' }}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.lignes.filter(l => l.montant > 0).map((l, i) => (
                      <tr key={l.code} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                        <td style={{ padding: '5px 10px', color: '#8A95A3' }}>{l.code}</td>
                        <td style={{ padding: '5px 10px', color: '#1A2130', fontWeight: '500' }}>{l.label}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#4A5568' }}>{parseFloat(l.base.toString()).toFixed(2)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#4A5568' }}>{l.taux.toFixed(3)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: '700', color: '#1A2130' }}>{l.montant.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#E8F0FB', fontWeight: '800' }}>
                      <td colSpan={4} style={{ padding: '8px 10px', color: '#1A2130', fontSize: '12px' }}>SALAIRE BRUT</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: '#0E5AA7', fontSize: '13px' }}>{calc.brut.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* COTISATIONS */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ background: '#253044', color: 'white', padding: '6px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '5px 5px 0 0' }}>
                  COTISATIONS SOCIALES
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr style={{ background: '#F0F2F5', borderBottom: '1px solid #E2E6EA' }}>
                      <th style={{ padding: '5px 10px', textAlign: 'left', color: '#8A95A3', fontWeight: '700' }}>Libellé</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', color: '#8A95A3', fontWeight: '700' }}>Base</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', color: '#8A95A3', fontWeight: '700' }}>Taux sal.</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', color: '#8A95A3', fontWeight: '700' }}>Part sal.</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', color: '#8A95A3', fontWeight: '700' }}>Taux pat.</th>
                      <th style={{ padding: '5px 10px', textAlign: 'right', color: '#8A95A3', fontWeight: '700' }}>Part pat.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.cotisationsCalc.filter(c => c.montant_sal > 0 || c.montant_pat > 0).map((c, i) => (
                      <tr key={c.label} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                        <td style={{ padding: '4px 10px', color: '#1A2130' }}>{c.label}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', color: '#4A5568' }}>{c.base.toFixed(2)}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', color: '#4A5568' }}>{c.taux_sal > 0 ? c.taux_sal.toFixed(3) : '—'}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', color: '#C62828', fontWeight: '600' }}>{c.montant_sal > 0 ? c.montant_sal.toFixed(2) + '-' : '—'}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', color: '#4A5568' }}>{c.taux_pat > 0 ? c.taux_pat.toFixed(3) : '—'}</td>
                        <td style={{ padding: '4px 10px', textAlign: 'right', color: '#8A95A3' }}>{c.montant_pat > 0 ? c.montant_pat.toFixed(2) + '-' : '—'}</td>
                      </tr>
                    ))}
                    <tr style={{ background: '#F0F2F5' }}>
                      <td colSpan={2} style={{ padding: '6px 10px', fontSize: '10px', color: '#4A5568' }}>Exonérations employeur</td>
                      <td colSpan={2}></td>
                      <td colSpan={2} style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', color: '#1A9E50' }}>+{EXONERATION.toFixed(2)}</td>
                    </tr>
                    <tr style={{ background: '#FFEBEE', fontWeight: '800' }}>
                      <td colSpan={2} style={{ padding: '7px 10px', color: '#1A2130', fontSize: '11px' }}>TOTAL COTISATIONS</td>
                      <td colSpan={2} style={{ padding: '7px 10px', textAlign: 'right', color: '#C62828', fontSize: '11px' }}>{calc.totalSal.toFixed(2)}-</td>
                      <td colSpan={2} style={{ padding: '7px 10px', textAlign: 'right', color: '#C62828', fontSize: '11px' }}>{calc.totalPat.toFixed(2)}-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* AUTRES ÉLÉMENTS NON SOUMIS */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ background: '#1A9E50', color: 'white', padding: '6px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '5px 5px 0 0' }}>
                  AUTRES ÉLÉMENTS NON SOUMIS
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <tbody>
                    {calc.indemnites.filter(l => l.montant > 0).map((l, i) => (
                      <tr key={l.code} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                        <td style={{ padding: '5px 10px', color: '#8A95A3', width: '60px' }}>{l.code}</td>
                        <td style={{ padding: '5px 10px', color: '#1A2130' }}>{l.label}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#4A5568' }}>{l.base}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', color: '#4A5568' }}>{l.taux.toFixed(3)}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: '700', color: '#1A9E50' }}>{l.montant.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* NET */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '12px 14px', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#4A5568' }}>Net social</span>
                    <span style={{ fontWeight: '700', color: '#1A2130' }}>{(calc.netImposable + calc.indRepasTotal).toFixed(2)} €</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#4A5568' }}>Net imposable</span>
                    <span style={{ fontWeight: '700', color: '#1A2130' }}>{calc.netImposable.toFixed(2)} €</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#4A5568' }}>Impôt à la source (PAS)</span>
                    <span style={{ fontWeight: '700', color: '#1A2130' }}>0,00 € (taux 0%)</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px solid #1A2130', marginTop: '6px' }}>
                    <span style={{ fontWeight: '800', color: '#1A2130', fontSize: '13px' }}>NET À PAYER</span>
                    <span style={{ fontWeight: '800', color: '#0E5AA7', fontSize: '16px' }}>{calc.netPaye.toFixed(2)} €</span>
                  </div>
                </div>
                <div style={{ background: '#1A2130', borderRadius: '8px', padding: '12px 14px', fontSize: '11px' }}>
                  <div style={{ fontWeight: '700', color: 'rgba(255,255,255,.6)', marginBottom: '8px', textTransform: 'uppercase', fontSize: '10px', letterSpacing: '.4px' }}>Total versé par l'employeur</div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: 'white' }}>{(calc.brut + calc.totalPat).toFixed(2)} €</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', marginTop: '4px' }}>Brut {calc.brut.toFixed(2)} € + Charges {calc.totalPat.toFixed(2)} €</div>
                </div>
              </div>

              {/* RECAP BAS */}
              <div style={{ background: '#F0F2F5', borderRadius: '8px', padding: '10px 14px', fontSize: '10px', color: '#4A5568', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  {[
                    ['Brut', calc.brut.toFixed(2) + ' €'],
                    ['Plafond SS', '2 640,60 €'],
                    ['Net imposable', calc.netImposable.toFixed(2) + ' €'],
                    ['Hrs travaillées', '100,00'],
                    ['Chg salariales', calc.totalSal.toFixed(2) + '-'],
                    ['Chg patronales', calc.totalPat.toFixed(2) + '-'],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ color: '#8A95A3', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
                      <div style={{ fontWeight: '700', color: '#1A2130', fontSize: '11px' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ fontSize: '9px', color: '#8A95A3', textAlign: 'center', marginBottom: '16px' }}>
                Dans votre intérêt et pour vous aider à faire valoir vos droits, conservez ce bulletin sans limitation de durée.
              </div>

              <button onClick={() => window.print()}
                style={{ background: '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px 24px', borderRadius: '6px', cursor: 'pointer' }}>
                🖨 Imprimer / Exporter PDF
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}