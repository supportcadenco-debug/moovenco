'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentProfile, getPermissions, MODULES, SETTINGS_MODULES, filterModules } from '../lib/auth'

export default function Sidebar({ currentPage }) {
  const [profile, setProfile] = useState(null)
  const [visibleModules, setVisibleModules] = useState(MODULES)
  const [visibleSettings, setVisibleSettings] = useState(SETTINGS_MODULES)
  const [collapsed, setCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const prof = await getCurrentProfile()
      if (!prof) return
      setProfile(prof)
      const perms = await getPermissions(prof.company_id, prof.role)
      setVisibleModules(filterModules(MODULES, perms, prof.role))
      setVisibleSettings(filterModules(SETTINGS_MODULES, perms, prof.role))
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  // Chaque module ouvre TOUJOURS la même fenêtre nommée (pas "_blank") :
  // si l'onglet Planning est déjà ouvert et qu'on reclique sur "Planning"
  // dans la sidebar, le navigateur réutilise cet onglet au lieu d'en créer
  // un nouveau. On garde quand même plusieurs modules différents ouverts
  // simultanément, puisque chacun a un nom distinct.

  return (
    <div style={{
      width: collapsed ? '56px' : '190px', background: '#1A2130', color: 'white',
      display: 'flex', flexDirection: 'column', height: '100vh', flexShrink: 0,
      position: 'sticky', top: 0, transition: 'width .15s', overflow: 'hidden',
    }}>
      {/* Logo + collapse */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: '14px 12px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        {!collapsed && (
          <a href="/dashboard" target="moovenco_dashboard" style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '-.5px', color: 'white', textDecoration: 'none' }}>
            Moov<span style={{ color: '#2EC971' }}>enco</span>
          </a>
        )}
        <button onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Déplier' : 'Replier'}
          style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.7)', width: '26px', height: '26px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', flexShrink: 0 }}>
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {/* Modules principaux */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {visibleModules.map(m => (
          <a key={m.key} href={m.href} target={`moovenco_${m.key}`} title={collapsed ? m.label : ''}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: currentPage === m.key ? '#0E5AA7' : 'transparent',
              color: currentPage === m.key ? 'white' : 'rgba(255,255,255,.65)',
              fontSize: '12px', fontWeight: currentPage === m.key ? '600' : '400',
              padding: '9px 10px', borderRadius: '7px', textDecoration: 'none',
              whiteSpace: 'nowrap', justifyContent: collapsed ? 'center' : 'flex-start',
            }}
            onMouseEnter={e => { if (currentPage !== m.key) e.currentTarget.style.background = 'rgba(255,255,255,.06)' }}
            onMouseLeave={e => { if (currentPage !== m.key) e.currentTarget.style.background = 'transparent' }}>
            <span style={{ fontSize: '15px', flexShrink: 0 }}>{m.icon}</span>
            {!collapsed && <span>{m.label}</span>}
          </a>
        ))}
      </div>

      {/* Réglages (engrenage) + profil + déconnexion */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '8px', position: 'relative' }}>
        {visibleSettings.length > 0 && (
          <>
            {settingsOpen && !collapsed && (
              <div style={{ marginBottom: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {visibleSettings.map(m => (
                  <a key={m.key} href={m.href} target={`moovenco_${m.key}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', background: currentPage === m.key ? '#0E5AA7' : 'rgba(255,255,255,.05)', color: currentPage === m.key ? 'white' : 'rgba(255,255,255,.65)', fontSize: '12px', padding: '8px 10px', borderRadius: '6px', textDecoration: 'none' }}>
                    <span style={{ fontSize: '13px' }}>{m.icon}</span><span>{m.label}</span>
                  </a>
                ))}
              </div>
            )}
            <button onClick={() => setSettingsOpen(o => !o)} title="Réglages"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: settingsOpen ? 'rgba(255,255,255,.08)' : 'transparent', border: 'none', color: 'rgba(255,255,255,.65)', fontSize: '12px', padding: '9px 10px', borderRadius: '7px', cursor: 'pointer', fontFamily: 'inherit', justifyContent: collapsed ? 'center' : 'flex-start' }}>
              <span style={{ fontSize: '15px' }}>⚙️</span>{!collapsed && <span>Réglages</span>}
            </button>
          </>
        )}

        {profile && !collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 6px 4px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: profile.color || '#0E5AA7', color: 'white', fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {profile.initials}
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.name}</span>
          </div>
        )}
        <button onClick={handleLogout} title="Déconnexion"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', background: 'rgba(255,255,255,.06)', border: 'none', color: 'rgba(255,255,255,.6)', fontFamily: 'inherit', fontSize: '11px', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', marginTop: '4px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <span>⏻</span>{!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </div>
  )
}
