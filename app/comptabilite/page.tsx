'use client'

import { useState, useEffect } from 'react'
import Sidebar from '../../src/components/Sidebar'
import Prepaie from './prepaie'
import Factures from './factures'
import Bulletins from './bulletins'
import Tarifs from './tarifs'
import Personnel from './personnel'
import Clients from './clients'
import { useAuth } from '@/lib/useAuth'

export default function Comptabilite() {
  const { ready } = useAuth('comptabilite')

  const [activeTab, setActiveTab] = useState('prepaie')
  useEffect(() => { document.title = 'Moovenco · Comptabilité' }, [])

  if (!ready) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ECEEF1', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '13px', color: '#8A95A3' }}>Chargement…</div>
    </div>
  )
  return (
    <div style={{ height: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>
      <Sidebar currentPage="comptabilite" />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ background: 'white', borderBottom: '1px solid #D0D4DA', display: 'flex', padding: '0 16px', flexShrink: 0, overflowX: 'auto' }}>
          {[
            ['prepaie',    '📋 Prépaie'],
            ['factures',   '🧾 Factures'],
            ['bulletins',  '💼 Bulletins'],
            ['tarifs',     '💶 Tarifs'],
            ['personnel',  '👥 Personnel'],
            ['clients',    '🤝 Clients'],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: '11px', fontWeight: activeTab === key ? '700' : '400', color: activeTab === key ? '#0E5AA7' : '#8A95A3', padding: '10px 16px', cursor: 'pointer', borderBottom: `2px solid ${activeTab === key ? '#0E5AA7' : 'transparent'}`, whiteSpace: 'nowrap' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'prepaie'   && <Prepaie />}
          {activeTab === 'factures'  && <Factures />}
          {activeTab === 'bulletins' && <Bulletins />}
          {activeTab === 'tarifs'    && <Tarifs />}
          {activeTab === 'personnel' && <Personnel />}
          {activeTab === 'clients'   && <Clients />}
        </div>
      </div>
    </div>
  )
}
