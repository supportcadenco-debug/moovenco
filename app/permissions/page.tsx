'use client'

import { useState, useEffect } from 'react'
import Sidebar from '../../src/components/Sidebar'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '@/lib/useAuth'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const ROLES = [
  { value: 'super_admin', label: 'Super Admin', color: '#C62828' },
  { value: 'directeur', label: 'Directeur / Gérant', color: '#1A2130' },
  { value: 'exploitant', label: 'Exploitant', color: '#0E5AA7' },
  { value: 'commercial', label: 'Commercial', color: '#7B1FA2' },
  { value: 'mecanicien', label: 'Mécanicien', color: '#D4720A' },
  { value: 'secretaire', label: 'Secrétaire / Comptable', color: '#1565C0' },
]

const MODULES = [
  { value: 'planning',    label: '📅 Planning' },
  { value: 'personnel',  label: '👥 Personnel' },
  { value: 'commercial', label: '💼 Commercial' },
  { value: 'clients',    label: '👥 Clients' },
  { value: 'comptabilite', label: '💰 Comptabilité' },
  { value: 'atelier',    label: '🔧 Atelier' },
  { value: 'anomalies',  label: '⚠️ Anomalies' },
  { value: 'scolaire',   label: '🏫 Scolaire' },
  { value: 'adresses',   label: '📍 Adresses' },
  { value: 'permissions',label: '🔐 Permissions' },
]

const ACCESS_LEVELS = [
  { value: 'none',  label: '❌ Aucun',   color: '#E0E0E0', text: '#9E9E9E' },
  { value: 'read',  label: '👁 Lecture', color: '#E3F2FD', text: '#1565C0' },
  { value: 'write', label: '✅ Complet', color: '#E8F5E9', text: '#1A9E50' },
]

export default function Permissions() {
  const { ready } = useAuth('permissions')

  const [permissions, setPermissions] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedRole, setSelectedRole] = useState('exploitant')

  useEffect(() => { loadPermissions() }, [])
  useEffect(() => { document.title = 'Moovenco · Permissions' }, [])

  async function loadPermissions() {
    const { data, error } = await supabase.from('permissions').select('*').eq('company_id', COMPANY_ID)
    if (!error && data) {
      const map: any = {}
      data.forEach((p: any) => {
        if (!map[p.role]) map[p.role] = {}
        map[p.role][p.module] = p.access
      })
      setPermissions(map)
    }
    setLoading(false)
  }

  function getAccess(role: string, module: string) {
    return permissions[role]?.[module] || 'none'
  }

  async function setAccess(role: string, module: string, access: string) {
    setPermissions((prev: any) => ({ ...prev, [role]: { ...(prev[role] || {}), [module]: access } }))
    const { error } = await supabase.from('permissions').upsert({
      company_id: COMPANY_ID, role, module, access
    }, { onConflict: 'company_id,role,module' })
    if (error) setMessage('❌ Erreur : ' + error.message)
    else { setMessage('✅ Permission mise à jour'); setTimeout(() => setMessage(''), 2000) }
  }

  const currentRole = ROLES.find(r => r.value === selectedRole)

  if (!ready) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ECEEF1', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '13px', color: '#8A95A3' }}>Chargement…</div>
    </div>
  )
  return (
    <div style={{ height: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>
      <Sidebar currentPage="permissions" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '220px', minWidth: '220px', background: 'white', borderRight: '1px solid #D0D4DA', overflow: 'auto' }}>
          <div style={{ padding: '12px 14px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', borderBottom: '1px solid #F0F2F5' }}>Rôles</div>
          {ROLES.map(role => (
            <div key={role.value} onClick={() => setSelectedRole(role.value)}
              style={{ padding: '12px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2F5', borderLeft: `3px solid ${selectedRole === role.value ? role.color : 'transparent'}`, background: selectedRole === role.value ? '#F5F7FA' : 'white', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: role.color, color: 'white', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {role.label[0]}
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{role.label}</div>
                <div style={{ fontSize: '9px', color: '#8A95A3', marginTop: '1px' }}>
                  {Object.keys(permissions[role.value] || {}).filter((m: string) => permissions[role.value][m] !== 'none').length} accès
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#8A95A3', padding: '40px' }}>Chargement…</div>
          ) : (
            <>
              <div style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: currentRole?.color, color: 'white', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {currentRole?.label[0]}
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#1A2130' }}>{currentRole?.label}</div>
                  <div style={{ fontSize: '11px', color: '#8A95A3', marginTop: '2px' }}>Changements sauvegardés automatiquement</div>
                </div>
                {message && (
                  <div style={{ marginLeft: 'auto', background: message.includes('✅') ? '#E8F5E9' : '#FFEBEE', color: message.includes('✅') ? '#1A9E50' : '#C62828', fontSize: '11px', fontWeight: '600', padding: '6px 12px', borderRadius: '6px' }}>
                    {message}
                  </div>
                )}
              </div>

              <div style={{ background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                      <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', textAlign: 'left', width: '180px' }}>Module</th>
                      <th style={{ padding: '12px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', textAlign: 'left' }}>Niveau d'accès</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MODULES.map((mod, i) => {
                      const current = getAccess(selectedRole, mod.value)
                      return (
                        <tr key={mod.value} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                          <td style={{ padding: '14px 16px', fontSize: '12px', fontWeight: '600', color: '#1A2130' }}>{mod.label}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {ACCESS_LEVELS.map(level => (
                                <button key={level.value} onClick={() => setAccess(selectedRole, mod.value, level.value)}
                                  style={{ background: current === level.value ? level.color : '#F8F9FB', color: current === level.value ? level.text : '#8A95A3', border: `1px solid ${current === level.value ? level.text + '40' : '#E2E6EA'}`, fontFamily: 'inherit', fontSize: '10px', fontWeight: current === level.value ? '700' : '500', padding: '4px 12px', borderRadius: '12px', cursor: 'pointer' }}>
                                  {level.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '20px', background: 'white', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#1A2130', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB' }}>Vue d'ensemble — tous les rôles</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                    <thead>
                      <tr style={{ background: '#F8F9FB', borderBottom: '1px solid #E2E6EA' }}>
                        <th style={{ padding: '8px 12px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '.5px', color: '#8A95A3', textAlign: 'left', width: '140px' }}>Module</th>
                        {ROLES.map(r => (
                          <th key={r.value} style={{ padding: '8px 10px', fontSize: '10px', fontWeight: '700', color: r.color, textAlign: 'center', whiteSpace: 'nowrap' }}>{r.label.split(' ')[0]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((mod, i) => (
                        <tr key={mod.value} style={{ borderBottom: '1px solid #F0F2F5', background: i % 2 === 0 ? 'white' : '#FAFBFC' }}>
                          <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '600', color: '#1A2130' }}>{mod.label}</td>
                          {ROLES.map(role => {
                            const access = getAccess(role.value, mod.value)
                            const level = ACCESS_LEVELS.find(a => a.value === access)
                            return (
                              <td key={role.value} style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <span style={{ background: level?.color, color: level?.text, fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '8px' }}>
                                  {access === 'none' ? '—' : access === 'read' ? '👁' : '✅'}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div style={{ background: '#253044', padding: '6px 16px', display: 'flex', gap: '20px', flexShrink: 0 }}>
        <div><div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{ROLES.length}</div><div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Rôles</div></div>
        <div><div style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>{MODULES.length}</div><div style={{ fontSize: '8px', color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.4px' }}>Modules</div></div>
      </div>
      </div>
    </div>
  )
}
