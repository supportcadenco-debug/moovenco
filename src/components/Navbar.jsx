'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCurrentProfile, getPermissions, MODULES, filterModules } from '../lib/auth'

export default function Navbar({ currentPage }) {
  const [profile, setProfile] = useState(null)
  const [visibleModules, setVisibleModules] = useState(MODULES)

  useEffect(() => {
    async function load() {
      const prof = await getCurrentProfile()
      if (!prof) return
      setProfile(prof)
      const perms = await getPermissions(prof.company_id, prof.role)
      setVisibleModules(filterModules(MODULES, perms, prof.role))
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/auth'
  }

  return (
    <div style={{ background: '#1A2130', color: 'white', display: 'flex', alignItems: 'center', padding: '0 16px', height: '46px', gap: '10px', flexShrink: 0 }}>
      <a href="/planning" style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '-.5px', color: 'white', textDecoration: 'none' }}>
        Moov<span style={{ color: '#2EC971' }}>enco</span>
      </a>
      <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,.15)' }} />
      <div style={{ display: 'flex', gap: '4px', flex: 1, overflow: 'hidden' }}>
        {visibleModules.map(m => (
          <a key={m.key} href={m.href}
            style={{ background: currentPage === m.key ? '#0E5AA7' : 'rgba(255,255,255,.08)', color: currentPage === m.key ? 'white' : 'rgba(255,255,255,.7)', fontSize: '11px', padding: '4px 10px', borderRadius: '5px', textDecoration: 'none', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {m.icon} {m.label}
          </a>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: profile.color || '#0E5AA7', color: 'white', fontSize: '9px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile.initials}
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)' }}>{profile.name}</span>
          </div>
        )}
        <button onClick={handleLogout}
          style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: 'rgba(255,255,255,.7)', fontFamily: 'inherit', fontSize: '11px', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer' }}>
          Déconnexion
        </button>
      </div>
    </div>
  )
}