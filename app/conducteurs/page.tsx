'use client'

import { useState, useEffect } from 'react'
import Navbar from '../../src/components/Navbar'
import { supabase } from '../../src/lib/supabase'

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: '#C62828' },
  { value: 'directeur', label: 'Directeur / Gérant', color: '#1A2130' },
  { value: 'exploitant', label: 'Exploitant', color: '#0E5AA7' },
  { value: 'commercial', label: 'Commercial', color: '#7B1FA2' },
  { value: 'conducteur', label: 'Conducteur', color: '#1A9E50' },
  { value: 'mecanicien', label: 'Mécanicien', color: '#D4720A' },
  { value: 'secretaire', label: 'Secrétaire / Comptable', color: '#1565C0' },
]

const COLORS = ['#0E5AA7','#1A9E50','#D4720A','#C0157A','#7B1FA2','#C62828','#1565C0','#1A2130']

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

export default function Personnel() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({
    name: '', initials: '', color: '#0E5AA7', role: 'conducteur', contract: '', email: '', phone: ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadStaff()
  }, [])

  async function loadStaff() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', COMPANY_ID)
      .order('name')
    if (!error) setStaff(data)
    setLoading(false)
  }

  function getRoleInfo(value) {
    return ROLES.find(r => r.value === value) || { label: value, color: '#8A95A3' }
  }

  function autoInitials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  function handleNameChange(e) {
    const name = e.target.value
    setForm(f => ({ ...f, name, initials: autoInitials(name) }))
  }

  async function handleSave() {
    if (!form.name || !form.role) { setMessage('Nom et rôle obligatoires'); return }
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('profiles').insert({
      id: crypto.randomUUID(),
      company_id: COMPANY_ID,
      name: form.name,
      initials: form.initials,
      color: form.color,
      role: form.role,
      contract: form.contract,
      active: true,
    })

    if (error) {
      setMessage('Erreur : ' + error.message)
    } else {
      setMessage('✅ Membre ajouté avec succès')
      setForm({ name: '', initials: '', color: '#0E5AA7', role: 'conducteur', contract: '', email: '', phone: '' })
      setShowForm(false)
      loadStaff()
    }
    setSaving(false)
  }

  async function toggleActive(person) {
    await supabase.from('profiles').update({ active: !person.active }).eq('id', person.id)
    loadStaff()
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="conducteurs" />


      <div style={{ background: '#253044', padding: '0 16px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={() => { setShowForm(true); setSelected(null) }}
          style={{ background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '5px', cursor: 'pointer' }}>
          + Ajouter un membre
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LISTE */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>

          {/* Stats */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {ROLES.map(r => {
              const count = staff.filter(s => s.role === r.value).length
              if (count === 0) return null
              return (
                <div key={r.value} style={{ background: 'white', borderRadius: '8px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 1px 3px rgba(0,0,0,.05)' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: r.color }} />
                  <span style={{ fontSize: '11px', color: '#4A5568' }}>{r.label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130' }}>{count}</span>
                </div>
              )
            })}
          </div>

          {/* Tableau */}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '40px' }}>Chargement…</div>
          ) : (
            <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                    {['Membre', 'Rôle', 'Contrat', 'Statut', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((person, i) => {
                    const role = getRoleInfo(person.role)
                    return (
                      <tr key={person.id} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F5F7FA'}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'white' : '#FAFBFC'}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: person.color, color: 'white', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {person.initials}
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: '#1A2130' }}>{person.name}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: role.color + '20', color: role.color, fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '10px' }}>
                            {role.label}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '11px', color: '#4A5568' }}>{person.contract || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{ background: person.active ? '#E8F5E9' : '#FFEBEE', color: person.active ? '#1B5E20' : '#B71C1C', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '10px' }}>
                            {person.active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <button onClick={() => { setSelected(person); setShowForm(false) }} style={{ background: '#E8F0FB', border: 'none', color: '#0E5AA7', fontSize: '10px', fontWeight: '600', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                              Voir
                            </button>
                            <button onClick={() => toggleActive(person)} style={{ background: person.active ? '#FFEBEE' : '#E8F5E9', border: 'none', color: person.active ? '#C62828' : '#1B5E20', fontSize: '10px', fontWeight: '600', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
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
          <div style={{ width: '320px', minWidth: '320px', background: 'white', borderLeft: '1px solid #D0D4DA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #D0D4DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB' }}>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{showForm ? '+ Nouveau membre' : selected?.name}</div>
              <button onClick={() => { setShowForm(false); setSelected(null) }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#8A95A3' }}>✕</button>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px' }}>
              {showForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '4px' }}>Nom complet *</label>
                    <input value={form.name} onChange={handleNameChange} placeholder="Dupont Jean" style={{ width: '100%', padding: '8px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '4px' }}>Initiales</label>
                    <input value={form.initials} onChange={e => setForm(f => ({ ...f, initials: e.target.value.toUpperCase().slice(0, 2) }))} maxLength={2} style={{ width: '80px', padding: '8px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }} />
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '6px' }}>Couleur</label>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {COLORS.map(c => (
                        <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                          style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid #1A2130' : '2px solid transparent', transition: 'border .1s' }} />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '4px' }}>Rôle *</label>
                    <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '10px', fontWeight: '600', color: '#4A5568', display: 'block', marginBottom: '4px' }}>Type de contrat</label>
                    <select value={form.contract} onChange={e => setForm(f => ({ ...f, contract: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit' }}>
                      <option value="">— Sélectionner —</option>
                      <option>CDI temps plein</option>
                      <option>CDI temps partiel</option>
                      <option>CDI 28h</option>
                      <option>CDI 30h</option>
                      <option>CDI 35h</option>
                      <option>CDD</option>
                      <option>Intérim</option>
                      <option>Alternance</option>
                      <option>Gérant</option>
                    </select>
                  </div>

                  {message && (
                    <div style={{ background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1B5E20' : '#C62828', fontSize: '11px', padding: '8px 10px', borderRadius: '5px' }}>
                      {message}
                    </div>
                  )}

                  <button onClick={handleSave} disabled={saving} style={{ background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                    {saving ? 'Enregistrement…' : 'Ajouter le membre'}
                  </button>
                </div>
              ) : selected ? (
                <div style={{ fontSize: '11px', color: '#4A5568', lineHeight: '2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: selected.color, color: 'white', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {selected.initials}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130' }}>{selected.name}</div>
                      <span style={{ background: getRoleInfo(selected.role).color + '20', color: getRoleInfo(selected.role).color, fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '8px' }}>
                        {getRoleInfo(selected.role).label}
                      </span>
                    </div>
                  </div>
                  <p>📋 <strong>Contrat :</strong> {selected.contract || '—'}</p>
                  <p>✅ <strong>Statut :</strong> {selected.active ? 'Actif' : 'Inactif'}</p>
                  <p>🆔 <strong>Rôle :</strong> {selected.role}</p>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* STATS BAS */}
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{staff.filter(s => s.active).length}</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Actifs</div>
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{staff.length}</div>
          <div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Total</div>
        </div>
      </div>
    </div>
  )
}
