'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import Navbar from '../../src/components/Navbar'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '@/lib/useAuth'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// Champs cibles selon le type d'import
const TARGET_FIELDS = {
  ca: [
    { key: 'date_facture', label: 'Date', required: true },
    { key: 'montant_ht', label: 'Montant HT', required: true },
    { key: 'montant_ttc', label: 'Montant TTC', required: false },
    { key: 'client_nom', label: 'Client', required: false },
    { key: 'categorie', label: 'Catégorie (scolaire/occasionnel/régulier/autre)', required: false },
    { key: 'numero_origine', label: 'N° facture (ancien système)', required: false },
  ],
  couts: [
    { key: 'date_cout', label: 'Date', required: true },
    { key: 'montant', label: 'Montant', required: true },
    { key: 'categorie', label: 'Catégorie (carburant/salaire/charge_sociale/assurance/entretien/loyer/autre)', required: true },
    { key: 'libelle', label: 'Libellé', required: false },
  ],
}

// Parse une date dans plusieurs formats courants (FR jj/mm/aaaa, ISO, Excel serial)
function parseDate(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number') {
    // Date sérielle Excel
    const d = new Date(Math.round((val - 25569) * 86400 * 1000))
    return d.toISOString().slice(0, 10)
  }
  const s = String(val).trim()
  // jj/mm/aaaa ou jj-mm-aaaa
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`
  // aaaa-mm-jj (déjà ISO)
  const m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`
  return null
}

function parseNumber(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/\s/g, '').replace(',', '.').replace(/[€$]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

export default function ImportPage() {
  const { loading: authLoading } = useAuth()
  const [importType, setImportType] = useState('ca') // 'ca' | 'couts'
  const [rawRows, setRawRows] = useState([])
  const [columns, setColumns] = useState([])
  const [mapping, setMapping] = useState({})
  const [step, setStep] = useState('upload') // 'upload' | 'mapping' | 'preview' | 'done'
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [fileName, setFileName] = useState('')

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)

    const ext = file.name.split('.').pop().toLowerCase()

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          setRawRows(res.data)
          setColumns(res.meta.fields || [])
          setStep('mapping')
        },
      })
    } else {
      const reader = new FileReader()
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: false })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        setRawRows(json)
        setColumns(json.length > 0 ? Object.keys(json[0]) : [])
        setStep('mapping')
      }
      reader.readAsBinaryString(file)
    }
  }

  function autoDetectMapping(fields) {
    const guess = {}
    fields.forEach(f => {
      const match = columns.find(c => {
        const cl = c.toLowerCase()
        if (f.key.includes('date')) return cl.includes('date')
        if (f.key.includes('montant_ht') || f.key === 'montant') return cl.includes('ht') || cl.includes('montant') || cl.includes('prix')
        if (f.key.includes('ttc')) return cl.includes('ttc')
        if (f.key.includes('client')) return cl.includes('client') || cl.includes('nom')
        if (f.key.includes('categorie')) return cl.includes('categ') || cl.includes('type')
        if (f.key.includes('libelle')) return cl.includes('libell') || cl.includes('desc')
        if (f.key.includes('numero')) return cl.includes('numero') || cl.includes('n°') || cl.includes('ref')
        return false
      })
      if (match) guess[f.key] = match
    })
    return guess
  }

  function goToMapping() {
    const fields = TARGET_FIELDS[importType]
    setMapping(autoDetectMapping(fields))
  }

  function goToPreview() {
    setStep('preview')
  }

  const previewData = rawRows.slice(0, 10).map(row => {
    const mapped = {}
    TARGET_FIELDS[importType].forEach(f => {
      const col = mapping[f.key]
      let val = col ? row[col] : null
      if (f.key.includes('date')) val = parseDate(val)
      if (f.key.includes('montant')) val = parseNumber(val)
      mapped[f.key] = val
    })
    return mapped
  })

  const missingRequired = TARGET_FIELDS[importType].filter(f => f.required && !mapping[f.key])

  async function handleImport() {
    setImporting(true)
    const table = importType === 'ca' ? 'historique_ca' : 'couts'
    const fields = TARGET_FIELDS[importType]

    const rowsToInsert = rawRows.map(row => {
      const mapped = { id: generateId(), company_id: COMPANY_ID, source: 'import' }
      fields.forEach(f => {
        const col = mapping[f.key]
        let val = col ? row[col] : null
        if (f.key.includes('date')) val = parseDate(val)
        if (f.key.includes('montant')) val = parseNumber(val)
        mapped[f.key] = val
      })
      return mapped
    }).filter(r => {
      // On ignore les lignes où un champ requis manque après parsing
      return fields.every(f => !f.required || (r[f.key] != null && r[f.key] !== ''))
    })

    let inserted = 0
    let errors = 0
    // Insertion par lots de 100
    for (let i = 0; i < rowsToInsert.length; i += 100) {
      const batch = rowsToInsert.slice(i, i + 100)
      const { error } = await supabase.from(table).insert(batch)
      if (error) errors += batch.length
      else inserted += batch.length
    }

    setResult({ total: rawRows.length, inserted, errors, skipped: rawRows.length - rowsToInsert.length })
    setStep('done')
    setImporting(false)
  }

  function reset() {
    setRawRows([]); setColumns([]); setMapping({}); setStep('upload'); setResult(null); setFileName('')
  }

  if (authLoading) return null

  return (
    <div style={{ minHeight: '100vh', background: '#F4F5F7', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <Navbar />
      <div style={{ maxWidth: '820px', margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#1A2130', marginBottom: '4px' }}>📥 Import de données historiques</h1>
        <p style={{ fontSize: '12px', color: '#8A95A3', marginBottom: '20px' }}>
          Importez votre chiffre d'affaires ou vos coûts antérieurs à l'installation de Moovenco, depuis un fichier Excel ou CSV.
        </p>

        {/* Sélecteur type d'import */}
        {step === 'upload' && (
          <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>Que voulez-vous importer ?</div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {[['ca', '💰 Chiffre d\'affaires (factures passées)'], ['couts', '📉 Coûts (salaires, charges, assurances…)']].map(([v, l]) => (
                <button key={v} onClick={() => setImportType(v)}
                  style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${importType === v ? '#0E5AA7' : '#E2E6EA'}`, background: importType === v ? '#F0F7FF' : 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', color: importType === v ? '#0E5AA7' : '#4A5568', cursor: 'pointer' }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '8px' }}>Champs attendus</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
              {TARGET_FIELDS[importType].map(f => (
                <span key={f.key} style={{ fontSize: '10px', padding: '4px 9px', borderRadius: '12px', background: f.required ? '#FFEBEE' : '#F0F2F5', color: f.required ? '#C62828' : '#4A5568' }}>
                  {f.label}{f.required ? ' *' : ''}
                </span>
              ))}
            </div>

            <label style={{ display: 'block', border: '2px dashed #D0D4DA', borderRadius: '8px', padding: '30px', textAlign: 'center', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#0E5AA7'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#D0D4DA'}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A2130' }}>Choisir un fichier Excel (.xlsx) ou CSV</div>
              <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '4px' }}>La 1ère ligne doit contenir les en-têtes de colonnes</div>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={e => { handleFile(e); goToMapping() }} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {/* Mapping des colonnes */}
        {step === 'mapping' && (
          <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: '11px', color: '#8A95A3', marginBottom: '14px' }}>
              Fichier : <strong>{fileName}</strong> — {rawRows.length} ligne(s) détectée(s)
            </div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>Faites correspondre vos colonnes</div>
            {TARGET_FIELDS[importType].map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div style={{ width: '260px', fontSize: '11px', color: '#4A5568' }}>{f.label}{f.required && <span style={{ color: '#C62828' }}> *</span>}</div>
                <select value={mapping[f.key] || ''} onChange={e => setMapping(m => ({ ...m, [f.key]: e.target.value }))}
                  style={{ flex: 1, padding: '6px 9px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '11px', fontFamily: 'inherit' }}>
                  <option value="">— Ignorer —</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={reset} style={{ background: '#F0F2F5', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#4A5568', cursor: 'pointer', fontFamily: 'inherit' }}>← Annuler</button>
              <button onClick={goToPreview} disabled={missingRequired.length > 0}
                style={{ background: missingRequired.length > 0 ? '#C5CBD3' : '#0E5AA7', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: 'white', cursor: missingRequired.length > 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                Aperçu →
              </button>
            </div>
            {missingRequired.length > 0 && (
              <div style={{ marginTop: '10px', fontSize: '10px', color: '#C62828' }}>
                Champs obligatoires manquants : {missingRequired.map(f => f.label).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Aperçu avant import */}
        {step === 'preview' && (
          <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>
              Aperçu (10 premières lignes sur {rawRows.length})
            </div>
            <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ background: '#F8F9FB' }}>
                    {TARGET_FIELDS[importType].map(f => (
                      <th key={f.key} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #E2E6EA', color: '#8A95A3', fontWeight: '600' }}>{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F0F2F5' }}>
                      {TARGET_FIELDS[importType].map(f => (
                        <td key={f.key} style={{ padding: '6px 8px', color: row[f.key] == null ? '#C62828' : '#1A2130' }}>
                          {row[f.key] == null ? '—' : String(row[f.key])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setStep('mapping')} style={{ background: '#F0F2F5', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', color: '#4A5568', cursor: 'pointer', fontFamily: 'inherit' }}>← Retour</button>
              <button onClick={handleImport} disabled={importing}
                style={{ background: '#1A9E50', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
                {importing ? '⏳ Import en cours…' : `✓ Importer ${rawRows.length} ligne(s)`}
              </button>
            </div>
          </div>
        )}

        {/* Résultat */}
        {step === 'done' && result && (
          <div style={{ background: 'white', borderRadius: '10px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,.06)', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>{result.errors === 0 ? '✅' : '⚠️'}</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130', marginBottom: '6px' }}>Import terminé</div>
            <div style={{ fontSize: '12px', color: '#4A5568', marginBottom: '16px' }}>
              {result.inserted} ligne(s) importée(s) sur {result.total}
              {result.skipped > 0 && ` — ${result.skipped} ignorée(s) (champs requis manquants)`}
              {result.errors > 0 && ` — ${result.errors} erreur(s)`}
            </div>
            <button onClick={reset} style={{ background: '#0E5AA7', border: 'none', padding: '8px 18px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>
              Importer un autre fichier
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
