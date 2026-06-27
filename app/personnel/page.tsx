'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../src/lib/supabase'
import Navbar from '../../src/components/Navbar'

const ROLES = [
  { value: 'super_admin', label: 'Super Admin',          color: '#C62828', icon: '👑' },
  { value: 'directeur',   label: 'Directeur / Gérant',   color: '#1A2130', icon: '🏢' },
  { value: 'exploitant',  label: 'Exploitant',           color: '#0E5AA7', icon: '📋' },
  { value: 'commercial',  label: 'Commercial',            color: '#7B1FA2', icon: '💼' },
  { value: 'conducteur',  label: 'Conducteur',            color: '#1A9E50', icon: '🚌' },
  { value: 'mecanicien',  label: 'Mécanicien',            color: '#D4720A', icon: '🔧' },
  { value: 'secretaire',  label: 'Secrétaire / Comptable',color: '#1565C0', icon: '📊' },
]

const COLORS = ['#0E5AA7','#1A9E50','#D4720A','#C0157A','#7B1FA2','#C62828','#1565C0','#1A2130']
const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'
const PERMIS = ['D', 'D1', 'C', 'C1', 'CE', 'B', 'BE']
const JOURS  = ['lundi','mardi','mercredi','jeudi','vendredi']

// Catégories documents — communes à tous
const DOCS_COMMUNS = [
  { key: 'cni',      label: "🪪 Carte d'identité / Passeport" },
  { key: 'contrat',  label: '📄 Contrat de travail' },
  { key: 'rib',      label: '🏦 RIB' },
  { key: 'cv',       label: '📋 CV' },
  { key: 'autre',    label: '📎 Autre' },
]

// Catégories documents — conducteurs uniquement
const DOCS_CONDUCTEUR = [
  { key: 'permis',         label: '🚗 Permis de conduire' },
  { key: 'fimo',           label: '🎓 FIMO' },
  { key: 'fco',            label: '🎓 FCO' },
  { key: 'visite',         label: '🏥 Visite médicale' },
  { key: 'carte_conducteur',label: '💳 Carte conducteur' },
  { key: 'sst',            label: '🛡️ SST' },
]

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function daysUntil(date) {
  if (!date) return null
  return Math.round((new Date(date).getTime() - Date.now()) / 86400000)
}

function ExpiryTag({ date, label }) {
  if (!date) return <span style={{ fontSize: '10px', color: '#8A95A3' }}>—</span>
  const j = daysUntil(date)
  const color = j < 0 ? '#C62828' : j < 30 ? '#D4720A' : j < 90 ? '#1565C0' : '#1A9E50'
  const bg    = j < 0 ? '#FFEBEE' : j < 30 ? '#FFF3E0' : j < 90 ? '#E3F2FD' : '#E8F5E9'
  const tag   = j < 0 ? 'Expiré' : j < 30 ? `${j}j` : new Date(date).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' })
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', background: bg+'60', borderRadius:'5px', marginBottom:'4px' }}>
      <span style={{ fontSize:'10px', color:'#4A5568' }}>{label}</span>
      <span style={{ fontSize:'10px', fontWeight:'700', color }}>{tag}</span>
    </div>
  )
}

function CircuitAssigner({ circuits, driverCircuits, onAdd, saving }) {
  const [sel, setSel] = useState('')
  const [jours, setJours] = useState([...JOURS])
  const toggle = j => setJours(p => p.includes(j) ? p.filter(x => x !== j) : [...p, j])
  // Filtrer circuits déjà assignés
  const available = circuits.filter(c => !driverCircuits.find(dc => dc.circuit_id === c.id))
  return (
    <div style={{ background:'#F8F9FB', borderRadius:'8px', padding:'10px 12px' }}>
      <div style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', marginBottom:'6px' }}>Ajouter un circuit</div>
      <select value={sel} onChange={e => setSel(e.target.value)}
        style={{ width:'100%', padding:'6px 8px', border:'1px solid #D0D4DA', borderRadius:'5px', fontSize:'11px', fontFamily:'inherit', marginBottom:'8px' }}>
        <option value="">— Sélectionner —</option>
        {available.map(c => <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ''}{c.name}</option>)}
      </select>
      {available.length === 0 && circuits.length > 0 && <div style={{ fontSize:'10px', color:'#8A95A3', marginBottom:'6px' }}>Tous les circuits sont déjà assignés</div>}
      <div style={{ display:'flex', gap:'4px', marginBottom:'8px', flexWrap:'wrap' }}>
        {JOURS.map(j => (
          <button key={j} onClick={() => toggle(j)}
            style={{ background: jours.includes(j) ? '#1A2130' : '#F8F9FB', color: jours.includes(j) ? 'white' : '#4A5568', border:'1px solid #D0D4DA', fontFamily:'inherit', fontSize:'9px', fontWeight:'700', padding:'3px 6px', borderRadius:'4px', cursor:'pointer' }}>
            {j.slice(0,3).toUpperCase()}
          </button>
        ))}
      </div>
      <button onClick={() => { if (sel && jours.length > 0) { onAdd(sel, jours); setSel('') } }}
        disabled={!sel || jours.length === 0 || saving || available.length === 0}
        style={{ width:'100%', background: (!sel || saving) ? '#8A95A3' : '#1A9E50', border:'none', color:'white', fontFamily:'inherit', fontSize:'11px', fontWeight:'700', padding:'7px', borderRadius:'5px', cursor:'pointer' }}>
        {saving ? 'Enregistrement…' : '+ Assigner ce circuit'}
      </button>
    </div>
  )
}

export default function Personnel() {
  const [staff, setStaff]               = useState([])
  const [driverDetails, setDriverDetails]= useState({})
  const [loading, setLoading]            = useState(true)
  const [showForm, setShowForm]          = useState(false)
  const [selected, setSelected]          = useState(null)
  const [filterRole, setFilterRole]      = useState('tous')
  const [search, setSearch]              = useState('')
  const [tab, setTab]                    = useState('fiche') // fiche | documents | circuits
  const [form, setForm]                  = useState({ name:'', initials:'', color:'#0E5AA7', role:'conducteur', contract:'', email:'', password:'', is_conducteur_secondaire: false })
  const [driverForm, setDriverForm]      = useState({ permis:[], fimo_expiry:'', fco_expiry:'', visite_medicale:'', carte_conducteur:'', vehicle_habituel:'', dispo_vacances:false, notes:'' })
  const [saving, setSaving]              = useState(false)
  const [message, setMessage]            = useState('')
  const [editingDriver, setEditingDriver]= useState(false)
  const [driverCircuits, setDriverCircuits] = useState([])
  const [circuits, setCircuits]          = useState([])
  const [savingCircuit, setSavingCircuit]= useState(false)
  const [editingCircuits, setEditingCircuits] = useState(false)
  const [staffDocs, setStaffDocs]        = useState([])
  const [uploadingDoc, setUploadingDoc]  = useState(false)
  const fileRef = useRef(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: s }, { data: d }] = await Promise.all([
      supabase.from('profiles').select('*').eq('company_id', COMPANY_ID).order('name'),
      supabase.from('driver_details').select('*').eq('company_id', COMPANY_ID),
    ])
    setStaff(s || [])
    const map = {}
    ;(d || []).forEach(dd => { map[dd.id] = dd })
    setDriverDetails(map)
    setLoading(false)
    const { data: circs } = await supabase.from('circuits').select('id, name, code, heure_debut, heure_fin').eq('company_id', COMPANY_ID).order('code')
    setCircuits(circs || [])
  }

  async function loadDriverCircuits(driverId) {
    const { data } = await supabase.from('driver_circuits')
      .select('*, circuits(id, name, code, heure_debut, heure_fin)')
      .eq('driver_id', driverId).eq('actif', true)
    setDriverCircuits(data || [])
  }

  async function loadStaffDocs(profileId) {
    const { data } = await supabase.from('client_documents').select('*')
      .eq('client_id', profileId).order('created_at', { ascending: false })
    setStaffDocs(data || [])
  }

  async function addDriverCircuit(circuitId, jours) {
    if (!selected) return
    setSavingCircuit(true)
    // Vérifier doublon
    const existing = driverCircuits.find(dc => dc.circuit_id === circuitId)
    if (!existing) {
      await supabase.from('driver_circuits').insert({
        company_id: COMPANY_ID, driver_id: selected.id, circuit_id: circuitId, jours, actif: true
      })
    }
    await loadDriverCircuits(selected.id)
    setSavingCircuit(false)
  }

  async function removeDriverCircuit(id) {
    await supabase.from('driver_circuits').delete().eq('id', id)
    setDriverCircuits(prev => prev.filter(dc => dc.id !== id))
  }

  async function uploadDoc(e, categorie) {
    const file = e.target.files[0]
    if (!file || !selected) return
    setUploadingDoc(true)
    const path = `${selected.id}/${Date.now()}_${file.name}`
    const { error: upErr } = await supabase.storage.from('driver-documents').upload(path, file)
    if (!upErr) {
      const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(path)
      await supabase.from('client_documents').insert({
        company_id: COMPANY_ID, client_id: selected.id,
        nom: file.name, categorie, url: urlData.publicUrl, taille: file.size,
      })
      await loadStaffDocs(selected.id)
    }
    setUploadingDoc(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDoc(doc) {
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return
    await supabase.from('client_documents').delete().eq('id', doc.id)
    setStaffDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  function getRoleInfo(value) {
    return ROLES.find(r => r.value === value) || { label: value, color: '#8A95A3', icon: '👤' }
  }

  function handleNameChange(e) {
    const name = e.target.value
    setForm(f => ({ ...f, name, initials: name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) }))
  }

  function isDriverRole(person) {
    return person?.role === 'conducteur' || person?.is_conducteur_secondaire
  }

  async function handleSave() {
    if (!form.name || !form.role) { setMessage('Nom et rôle obligatoires'); return }
    if (form.role === 'conducteur' && (!form.email || !form.password)) {
      setMessage('Email et mot de passe obligatoires pour un conducteur'); return
    }
    setSaving(true)
    let profileId = generateId()
    if (form.role === 'conducteur' && form.email) {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: form.email, password: form.password,
      })
      if (signUpErr) { setMessage('Erreur Auth : ' + signUpErr.message); setSaving(false); return }
      if (signUpData?.user?.id) profileId = signUpData.user.id
    }
    const { error } = await supabase.from('profiles').insert({
      id: profileId, company_id: COMPANY_ID,
      name: form.name, initials: form.initials, color: form.color,
      role: form.role, contract: form.contract, active: true,
    })
    if (error) setMessage('Erreur : ' + error.message)
    else {
      setMessage('✅ Membre ajouté' + (form.email ? ` — email : ${form.email}` : ''))
      setForm({ name:'', initials:'', color:'#0E5AA7', role:'conducteur', contract:'', email:'', password:'', is_conducteur_secondaire: false })
      setShowForm(false)
      loadAll()
    }
    setSaving(false)
  }

  async function handleSaveDriverDetails() {
    if (!selected) return
    setSaving(true)
    const existing = driverDetails[selected.id]
    const payload = {
      company_id: COMPANY_ID, id: selected.id,
      permis: driverForm.permis,
      fimo_expiry: driverForm.fimo_expiry || null,
      fco_expiry: driverForm.fco_expiry || null,
      visite_medicale: driverForm.visite_medicale || null,
      carte_conducteur: driverForm.carte_conducteur || null,
      vehicle_habituel: driverForm.vehicle_habituel || null,
      dispo_vacances: driverForm.dispo_vacances || false,
      notes: driverForm.notes || null,
    }
    if (existing) {
      await supabase.from('driver_details').update(payload).eq('id', selected.id)
    } else {
      await supabase.from('driver_details').insert(payload)
    }
    setMessage('✅ Fiche enregistrée')
    setEditingDriver(false)
    loadAll()
    setSaving(false)
  }

  async function toggleActive(person) {
    await supabase.from('profiles').update({ active: !person.active }).eq('id', person.id)
    loadAll()
  }

  function openSelected(person) {
    setSelected(person)
    setShowForm(false)
    setEditingDriver(false)
    setEditingCircuits(false)
    setTab('fiche')
    setMessage('')
    const dd = driverDetails[person.id]
    setDriverForm({
      permis:          dd?.permis || [],
      fimo_expiry:     dd?.fimo_expiry || '',
      fco_expiry:      dd?.fco_expiry || '',
      visite_medicale: dd?.visite_medicale || '',
      carte_conducteur:dd?.carte_conducteur || '',
      vehicle_habituel:dd?.vehicle_habituel || '',
      dispo_vacances:  dd?.dispo_vacances || false,
      notes:           dd?.notes || '',
    })
    if (isDriverRole(person)) loadDriverCircuits(person.id)
    loadStaffDocs(person.id)
  }

  function togglePermis(p) {
    setDriverForm(f => ({ ...f, permis: f.permis.includes(p) ? f.permis.filter(x => x !== p) : [...f.permis, p] }))
  }

  const filtered = staff.filter(p => {
    const matchRole = filterRole === 'tous' || p.role === filterRole
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  const dd = selected ? driverDetails[selected.id] : null

  const inputSt = { width:'100%', padding:'7px 9px', border:'1px solid #D0D4DA', borderRadius:'5px', fontSize:'11px', fontFamily:'inherit', boxSizing:'border-box' as any }

  // Docs groupés par catégorie
  const allCats = [...DOCS_COMMUNS, ...(selected && isDriverRole(selected) ? DOCS_CONDUCTEUR : [])]

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter, sans-serif', background:'#ECEEF1' }}>
      <Navbar currentPage="personnel" />

      {/* BARRE ACTION */}
      <div style={{ background:'#253044', padding:'0 16px', height:'38px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ display:'flex', gap:'6px' }}>
          <button onClick={() => setFilterRole('tous')}
            style={{ background: filterRole==='tous' ? 'white' : 'rgba(255,255,255,.1)', color: filterRole==='tous' ? '#1A2130' : 'rgba(255,255,255,.7)', border:'none', fontFamily:'inherit', fontSize:'11px', fontWeight:'600', padding:'4px 12px', borderRadius:'12px', cursor:'pointer' }}>
            Tous ({staff.length})
          </button>
          {ROLES.filter(r => staff.some(s => s.role === r.value)).map(r => (
            <button key={r.value} onClick={() => setFilterRole(r.value)}
              style={{ background: filterRole===r.value ? r.color : 'rgba(255,255,255,.1)', color:'white', border:'none', fontFamily:'inherit', fontSize:'11px', fontWeight:'600', padding:'4px 12px', borderRadius:'12px', cursor:'pointer' }}>
              {r.icon} {r.label} ({staff.filter(s => s.role === r.value).length})
            </button>
          ))}
        </div>
        <button onClick={() => { setShowForm(true); setSelected(null) }}
          style={{ background:'#2EC971', border:'none', color:'white', fontFamily:'inherit', fontSize:'11px', fontWeight:'700', padding:'4px 14px', borderRadius:'5px', cursor:'pointer' }}>
          + Ajouter un membre
        </button>
      </div>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>
        {/* LISTE */}
        <div style={{ flex:1, overflow:'auto', padding:'14px' }}>
          <div style={{ background:'white', border:'1px solid #D0D4DA', borderRadius:'6px', padding:'7px 12px', display:'flex', gap:'6px', marginBottom:'12px' }}>
            <span style={{ color:'#8A95A3' }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
              style={{ border:'none', outline:'none', fontFamily:'inherit', fontSize:'12px', width:'100%' }} />
          </div>

          {loading ? (
            <div style={{ textAlign:'center', color:'#8A95A3', padding:'40px' }}>Chargement…</div>
          ) : (
            <div style={{ background:'white', borderRadius:'10px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.06)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#F8F9FB', borderBottom:'1px solid #E2E6EA' }}>
                    {['Membre','Rôle','Contrat','Certifications','Statut','Actions'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.5px', color:'#8A95A3', textAlign:'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((person, i) => {
                    const role = getRoleInfo(person.role)
                    const pd = driverDetails[person.id]
                    const hasAlert = pd && ((pd.fimo_expiry && daysUntil(pd.fimo_expiry) < 30) || (pd.visite_medicale && daysUntil(pd.visite_medicale) < 30))
                    return (
                      <tr key={person.id} style={{ borderBottom:'1px solid #F0F2F5', background: i%2===0?'white':'#FAFBFC', cursor:'pointer' }}
                        onClick={() => openSelected(person)}
                        onMouseEnter={e => e.currentTarget.style.background = '#F5F7FA'}
                        onMouseLeave={e => e.currentTarget.style.background = i%2===0?'white':'#FAFBFC'}>
                        <td style={{ padding:'10px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                            <div style={{ position:'relative' }}>
                              <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:person.color, color:'white', fontSize:'11px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                {person.initials}
                              </div>
                              {hasAlert && <div style={{ position:'absolute', top:'-2px', right:'-2px', width:'10px', height:'10px', borderRadius:'50%', background:'#C62828', border:'2px solid white' }} />}
                            </div>
                            <div>
                              <div style={{ fontSize:'12px', fontWeight:'600', color:'#1A2130' }}>{person.name}</div>
                              {person.is_conducteur_secondaire && <div style={{ fontSize:'9px', color:'#1A9E50', fontWeight:'600' }}>🚌 Conducteur occasionnel</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ background: role.color+'20', color: role.color, fontSize:'10px', fontWeight:'700', padding:'3px 8px', borderRadius:'10px' }}>
                            {role.icon} {role.label}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', fontSize:'11px', color:'#4A5568' }}>{person.contract || '—'}</td>
                        <td style={{ padding:'10px 14px' }}>
                          {pd?.permis?.length > 0 ? (
                            <div style={{ display:'flex', gap:'3px', flexWrap:'wrap' }}>
                              {pd.permis.map(p => <span key={p} style={{ background:'#1A2130', color:'white', fontSize:'9px', fontWeight:'700', padding:'2px 5px', borderRadius:'4px' }}>{p}</span>)}
                            </div>
                          ) : <span style={{ fontSize:'10px', color:'#8A95A3' }}>—</span>}
                        </td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ background: person.active?'#E8F5E9':'#FFEBEE', color: person.active?'#1B5E20':'#B71C1C', fontSize:'10px', fontWeight:'700', padding:'3px 8px', borderRadius:'10px' }}>
                            {person.active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px' }} onClick={e => e.stopPropagation()}>
                          <div style={{ display:'flex', gap:'5px' }}>
                            <button onClick={() => openSelected(person)} style={{ background:'#E8F0FB', border:'none', color:'#0E5AA7', fontSize:'10px', fontWeight:'600', padding:'4px 8px', borderRadius:'4px', cursor:'pointer' }}>Voir</button>
                            <button onClick={() => toggleActive(person)} style={{ background: person.active?'#FFEBEE':'#E8F5E9', border:'none', color: person.active?'#C62828':'#1B5E20', fontSize:'10px', fontWeight:'600', padding:'4px 8px', borderRadius:'4px', cursor:'pointer' }}>
                              {person.active ? 'Désactiver' : 'Activer'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PANEL DROITE */}
        {(showForm || selected) && (
          <div style={{ width:'360px', minWidth:'360px', background:'white', borderLeft:'1px solid #D0D4DA', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #D0D4DA', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8F9FB', flexShrink:0 }}>
              <div style={{ fontSize:'13px', fontWeight:'700' }}>{showForm ? '+ Nouveau membre' : selected?.name}</div>
              <button onClick={() => { setShowForm(false); setSelected(null) }} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'#8A95A3' }}>✕</button>
            </div>

            {/* ONGLETS */}
            {selected && !showForm && (
              <div style={{ display:'flex', borderBottom:'1px solid #E2E6EA', background:'white', flexShrink:0 }}>
                {[['fiche','📋 Fiche'],['documents','📄 Documents'],['circuits','🏫 Circuits']].map(([k,l]) => (
                  <button key={k} onClick={() => setTab(k)}
                    style={{ flex:1, background:'none', border:'none', borderBottom: tab===k?'2px solid #0E5AA7':'2px solid transparent', color: tab===k?'#0E5AA7':'#8A95A3', fontFamily:'inherit', fontSize:'11px', fontWeight:'600', padding:'8px 4px', cursor:'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            )}

            <div style={{ flex:1, overflow:'auto', padding:'14px 16px' }}>

              {/* ── FORMULAIRE NOUVEAU MEMBRE ── */}
              {showForm && (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  <div>
                    <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'4px' }}>Nom complet *</label>
                    <input value={form.name} onChange={handleNameChange} placeholder="Dupont Jean"
                      style={{ ...inputSt }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'4px' }}>Initiales</label>
                    <input value={form.initials} onChange={e => setForm(f => ({ ...f, initials: e.target.value.toUpperCase().slice(0,2) }))} maxLength={2}
                      style={{ width:'80px', padding:'8px 10px', border:'1px solid #D0D4DA', borderRadius:'5px', fontSize:'12px', fontFamily:'inherit' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'6px' }}>Couleur</label>
                    <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                      {COLORS.map(c => (
                        <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                          style={{ width:'24px', height:'24px', borderRadius:'50%', background:c, cursor:'pointer', border: form.color===c?'3px solid #1A2130':'2px solid transparent' }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'4px' }}>Rôle *</label>
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                      style={{ ...inputSt }}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
                    </select>
                  </div>
                  {form.role !== 'conducteur' && (
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', background:'#F0F7FF', borderRadius:'6px' }}>
                      <input type="checkbox" id="cond-sec" checked={form.is_conducteur_secondaire}
                        onChange={e => setForm(f => ({ ...f, is_conducteur_secondaire: e.target.checked }))} />
                      <label htmlFor="cond-sec" style={{ fontSize:'11px', color:'#0E5AA7', cursor:'pointer' }}>🚌 Conducteur occasionnel</label>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'4px' }}>Type de contrat</label>
                    <select value={form.contract} onChange={e => setForm(f => ({ ...f, contract: e.target.value }))}
                      style={{ ...inputSt }}>
                      <option value="">— Sélectionner —</option>
                      {['CDI temps plein','CDI temps partiel','CDI 28h','CDI 30h','CDI 35h','CDD','Intérim','Alternance','Gérant'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  {(form.role === 'conducteur' || form.is_conducteur_secondaire) && (
                    <div style={{ background:'#F0F7FF', border:'1px solid #BBDEFB', borderRadius:'8px', padding:'10px 12px', display:'flex', flexDirection:'column', gap:'8px' }}>
                      <div style={{ fontSize:'10px', fontWeight:'700', color:'#0E5AA7' }}>🔐 Accès appli conducteur</div>
                      <div>
                        <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'4px' }}>Email *</label>
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jean.dupont@rgom.fr"
                          style={{ ...inputSt }} />
                      </div>
                      <div>
                        <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'4px' }}>Mot de passe provisoire *</label>
                        <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••"
                          style={{ ...inputSt }} />
                      </div>
                    </div>
                  )}
                  {message && <div style={{ background: message.includes('✅')?'#E8F5E9':'#FFEBEE', color: message.includes('✅')?'#1B5E20':'#C62828', fontSize:'11px', padding:'8px 10px', borderRadius:'5px' }}>{message}</div>}
                  <button onClick={handleSave} disabled={saving}
                    style={{ background: saving?'#8A95A3':'#0E5AA7', border:'none', color:'white', fontFamily:'inherit', fontSize:'12px', fontWeight:'700', padding:'10px', borderRadius:'6px', cursor:'pointer' }}>
                    {saving ? 'Enregistrement…' : 'Ajouter le membre'}
                  </button>
                </div>
              )}

              {/* ── ONGLET FICHE ── */}
              {selected && !showForm && tab === 'fiche' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                  {/* En-tête */}
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px', background:'#F8F9FB', borderRadius:'8px' }}>
                    <div style={{ width:'50px', height:'50px', borderRadius:'50%', background:selected.color, color:'white', fontSize:'16px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {selected.initials}
                    </div>
                    <div>
                      <div style={{ fontSize:'14px', fontWeight:'700', color:'#1A2130' }}>{selected.name}</div>
                      <span style={{ background: getRoleInfo(selected.role).color+'20', color: getRoleInfo(selected.role).color, fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'8px' }}>
                        {getRoleInfo(selected.role).icon} {getRoleInfo(selected.role).label}
                      </span>
                      {selected.is_conducteur_secondaire && <span style={{ marginLeft:'4px', background:'#E8F5E9', color:'#1A9E50', fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'8px' }}>🚌 Cond. occasionnel</span>}
                    </div>
                    <button onClick={() => toggleActive(selected)}
                      style={{ marginLeft:'auto', background: selected.active?'#FFEBEE':'#E8F5E9', border:'none', color: selected.active?'#C62828':'#1B5E20', fontFamily:'inherit', fontSize:'10px', fontWeight:'600', padding:'4px 8px', borderRadius:'5px', cursor:'pointer' }}>
                      {selected.active ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>

                  <div style={{ background:'#F8F9FB', borderRadius:'8px', padding:'10px 12px', fontSize:'11px', color:'#4A5568', display:'flex', flexDirection:'column', gap:'5px' }}>
                    <div><strong style={{ color:'#1A2130' }}>Contrat :</strong> {selected.contract || '—'}</div>
                    <div><strong style={{ color:'#1A2130' }}>Statut :</strong> {selected.active ? '✅ Actif' : '❌ Inactif'}</div>
                  </div>

                  {/* Fiche conducteur */}
                  {isDriverRole(selected) && (
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                        <div style={{ fontSize:'11px', fontWeight:'700', color:'#1A2130' }}>🚌 Fiche conducteur</div>
                        <button onClick={() => setEditingDriver(!editingDriver)}
                          style={{ background: editingDriver?'#FFEBEE':'#E8F0FB', border:'none', color: editingDriver?'#C62828':'#0E5AA7', fontFamily:'inherit', fontSize:'10px', fontWeight:'600', padding:'4px 8px', borderRadius:'4px', cursor:'pointer' }}>
                          {editingDriver ? '✕ Annuler' : '✏️ Modifier'}
                        </button>
                      </div>

                      {editingDriver ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                          <div>
                            <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'5px' }}>Permis</label>
                            <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                              {PERMIS.map(p => (
                                <button key={p} onClick={() => togglePermis(p)}
                                  style={{ background: driverForm.permis.includes(p)?'#1A2130':'#F8F9FB', color: driverForm.permis.includes(p)?'white':'#4A5568', border:'1px solid #D0D4DA', fontFamily:'inherit', fontSize:'11px', fontWeight:'700', padding:'4px 10px', borderRadius:'5px', cursor:'pointer' }}>
                                  {p}
                                </button>
                              ))}
                            </div>
                          </div>
                          {[['FIMO — expiration','fimo_expiry'],['FCO — expiration','fco_expiry'],['Visite médicale','visite_medicale'],['Carte conducteur','carte_conducteur']].map(([label, key]) => (
                            <div key={key}>
                              <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'3px' }}>{label}</label>
                              <input type="date" value={driverForm[key]} onChange={e => setDriverForm(f => ({ ...f, [key]: e.target.value }))} style={{ ...inputSt }} />
                            </div>
                          ))}
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', background:'#F8F9FB', borderRadius:'6px' }}>
                            <input type="checkbox" id="dispo-vac" checked={driverForm.dispo_vacances} onChange={e => setDriverForm(f => ({ ...f, dispo_vacances: e.target.checked }))} />
                            <label htmlFor="dispo-vac" style={{ fontSize:'11px', color:'#4A5568', cursor:'pointer' }}>🌴 Disponible pendant les vacances</label>
                          </div>
                          <div>
                            <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'3px' }}>Véhicule habituel</label>
                            <input value={driverForm.vehicle_habituel} onChange={e => setDriverForm(f => ({ ...f, vehicle_habituel: e.target.value }))} placeholder="GZ-795-QG" style={{ ...inputSt }} />
                          </div>
                          <div>
                            <label style={{ fontSize:'10px', fontWeight:'600', color:'#4A5568', display:'block', marginBottom:'3px' }}>Notes</label>
                            <textarea value={driverForm.notes} rows={2} onChange={e => setDriverForm(f => ({ ...f, notes: e.target.value }))} style={{ ...inputSt, resize:'vertical' as any }} />
                          </div>
                          {message && <div style={{ background: message.includes('✅')?'#E8F5E9':'#FFEBEE', color: message.includes('✅')?'#1B5E20':'#C62828', fontSize:'11px', padding:'8px 10px', borderRadius:'5px' }}>{message}</div>}
                          <button onClick={handleSaveDriverDetails} disabled={saving}
                            style={{ background: saving?'#8A95A3':'#1A9E50', border:'none', color:'white', fontFamily:'inherit', fontSize:'12px', fontWeight:'700', padding:'9px', borderRadius:'6px', cursor:'pointer' }}>
                            {saving ? 'Enregistrement…' : '💾 Enregistrer la fiche'}
                          </button>
                        </div>
                      ) : dd ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                          {dd.permis?.length > 0 && (
                            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap', marginBottom:'4px' }}>
                              {dd.permis.map(p => <span key={p} style={{ background:'#1A2130', color:'white', fontSize:'10px', fontWeight:'700', padding:'3px 8px', borderRadius:'5px' }}>{p}</span>)}
                            </div>
                          )}
                          <ExpiryTag date={dd.fimo_expiry}      label="FIMO" />
                          <ExpiryTag date={dd.fco_expiry}       label="FCO" />
                          <ExpiryTag date={dd.visite_medicale}  label="Visite médicale" />
                          <ExpiryTag date={dd.carte_conducteur} label="Carte conducteur" />
                          {dd.vehicle_habituel && <div style={{ fontSize:'11px', color:'#4A5568', marginTop:'4px' }}>🚌 <strong>Véhicule habituel :</strong> {dd.vehicle_habituel}</div>}
                          <div style={{ fontSize:'11px', color: dd.dispo_vacances?'#1A9E50':'#8A95A3', marginTop:'4px' }}>
                            {dd.dispo_vacances ? '✅ Disponible vacances' : '❌ Indisponible vacances'}
                          </div>
                          {dd.notes && <div style={{ fontSize:'11px', color:'#4A5568', background:'#F8F9FB', borderRadius:'6px', padding:'8px 10px', marginTop:'4px' }}>{dd.notes}</div>}
                        </div>
                      ) : (
                        <div style={{ textAlign:'center', color:'#8A95A3', fontSize:'11px', padding:'16px', background:'#F8F9FB', borderRadius:'8px' }}>
                          Aucune fiche — cliquez sur ✏️ Modifier pour en créer une
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── ONGLET DOCUMENTS ── */}
              {selected && !showForm && tab === 'documents' && (
                <div>
                  {allCats.map(cat => {
                    const catDocs = staffDocs.filter(d => d.categorie === cat.key)
                    return (
                      <div key={cat.key} style={{ marginBottom:'16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                          <div style={{ fontSize:'11px', fontWeight:'700', color:'#1A2130' }}>{cat.label}</div>
                          <label style={{ background: uploadingDoc?'#8A95A3':'#E8F0FB', color:'#0E5AA7', fontSize:'10px', fontWeight:'600', padding:'3px 8px', borderRadius:'4px', cursor:'pointer' }}>
                            {uploadingDoc ? '⏳' : '+ Ajouter'}
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }} ref={fileRef}
                              onChange={e => uploadDoc(e, cat.key)} />
                          </label>
                        </div>
                        {catDocs.length === 0 ? (
                          <div style={{ fontSize:'10px', color:'#8A95A3', padding:'8px 10px', background:'#F8F9FB', borderRadius:'6px' }}>Aucun document</div>
                        ) : (
                          catDocs.map(doc => (
                            <div key={doc.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:'white', border:'1px solid #E2E6EA', borderRadius:'6px', marginBottom:'4px' }}>
                              <span style={{ fontSize:'16px' }}>{doc.nom?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                              <a href={doc.url} target="_blank" rel="noreferrer"
                                style={{ flex:1, fontSize:'11px', fontWeight:'600', color:'#0E5AA7', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {doc.nom}
                              </a>
                              <span style={{ fontSize:'10px', color:'#8A95A3' }}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                              <button onClick={() => deleteDoc(doc)} style={{ background:'none', border:'none', color:'#C62828', cursor:'pointer', fontSize:'14px' }}>🗑</button>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── ONGLET CIRCUITS ── */}
              {selected && !showForm && tab === 'circuits' && (
                <div>
                  {!isDriverRole(selected) ? (
                    <div style={{ textAlign:'center', color:'#8A95A3', fontSize:'11px', padding:'24px', background:'#F8F9FB', borderRadius:'8px' }}>
                      Ce membre n'est pas conducteur.<br/>Cochez "Conducteur occasionnel" dans sa fiche pour activer les circuits.
                    </div>
                  ) : (
                    <>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                        <div style={{ fontSize:'11px', fontWeight:'700', color:'#1A2130' }}>🏫 Circuits habituels</div>
                        <button onClick={() => setEditingCircuits(!editingCircuits)}
                          style={{ background: editingCircuits?'#FFEBEE':'#E8F0FB', border:'none', color: editingCircuits?'#C62828':'#0E5AA7', fontFamily:'inherit', fontSize:'10px', fontWeight:'600', padding:'4px 8px', borderRadius:'4px', cursor:'pointer' }}>
                          {editingCircuits ? '✕ Fermer' : '✏️ Modifier'}
                        </button>
                      </div>

                      {driverCircuits.length === 0 ? (
                        <div style={{ textAlign:'center', color:'#8A95A3', fontSize:'11px', padding:'12px', background:'#F8F9FB', borderRadius:'8px', marginBottom:'8px' }}>
                          Aucun circuit habituel assigné
                        </div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'10px' }}>
                          {driverCircuits.map(dc => (
                            <div key={dc.id} style={{ background:'#E8EAF0', borderRadius:'6px', padding:'8px 10px', display:'flex', alignItems:'center', gap:'8px' }}>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:'11px', fontWeight:'700', color:'#1A2130' }}>
                                  {dc.circuits?.code && <span style={{ color:'#0E5AA7', marginRight:'5px' }}>{dc.circuits.code}</span>}
                                  {dc.circuits?.name || '—'}
                                </div>
                                <div style={{ fontSize:'10px', color:'#8A95A3', marginTop:'2px' }}>
                                  {dc.circuits?.heure_debut ? `🕐 ${dc.circuits.heure_debut} → ${dc.circuits.heure_fin||'—'}` : '⚠️ Heures non renseignées'}
                                </div>
                                <div style={{ display:'flex', gap:'3px', marginTop:'4px', flexWrap:'wrap' }}>
                                  {JOURS.map(j => (
                                    <span key={j} style={{ fontSize:'9px', fontWeight:'700', padding:'1px 5px', borderRadius:'4px', background: dc.jours?.includes(j)?'#1A2130':'#D0D4DA', color: dc.jours?.includes(j)?'white':'#8A95A3' }}>
                                      {j.slice(0,3).toUpperCase()}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {editingCircuits && (
                                <button onClick={() => removeDriverCircuit(dc.id)} style={{ background:'none', border:'none', color:'#C62828', cursor:'pointer', fontSize:'14px' }}>🗑</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {editingCircuits && (
                        circuits.length > 0 ? (
                          <CircuitAssigner circuits={circuits} driverCircuits={driverCircuits} onAdd={addDriverCircuit} saving={savingCircuit} />
                        ) : (
                          <div style={{ fontSize:'10px', color:'#8A95A3', textAlign:'center', padding:'8px', background:'#F8F9FB', borderRadius:'6px' }}>
                            Aucun circuit — créez des circuits dans le module Scolaire
                          </div>
                        )
                      )}
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* STATS */}
      <div style={{ background:'#253044', padding:'6px 16px', display:'flex', gap:'20px', flexShrink:0 }}>
        {[
          [staff.filter(s => s.active).length, 'Actifs'],
          [staff.length, 'Total'],
          [staff.filter(s => s.role === 'conducteur').length, 'Conducteurs'],
          [Object.values(driverDetails).filter((d: any) => d.visite_medicale && (daysUntil(d.visite_medicale) ?? 999) < 30).length, 'Alertes certifications'],
        ].map(([v, l]) => (
          <div key={l as string}>
            <div style={{ fontSize:'14px', fontWeight:'700', color: v > 0 && l === 'Alertes certifications' ? '#EF9A9A' : 'white' }}>{v}</div>
            <div style={{ fontSize:'8px', color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.4px' }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
