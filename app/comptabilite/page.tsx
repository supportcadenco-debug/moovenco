'use client'

import { useState } from 'react'
import Navbar from '../../src/components/Navbar'
import Prepaie from './prepaie'
import Factures from './factures'
import Bulletins from './bulletins'

export default function Comptabilite() {
  const [activeTab, setActiveTab] = useState('prepaie')

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="comptabilite" />

      {/* SOUS-ONGLETS */}
      <div style={{ background: 'white', borderBottom: '1px solid #D0D4DA', display: 'flex', padding: '0 16px', flexShrink: 0 }}>
        {[
          ['prepaie', '📋 Prépaie'],
          ['factures', '🧾 Factures'],
          ['bulletins', '💼 Bulletins de salaire'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: '11px', fontWeight: activeTab === key ? '700' : '400', color: activeTab === key ? '#0E5AA7' : '#8A95A3', padding: '10px 16px', cursor: 'pointer', borderBottom: `2px solid ${activeTab === key ? '#0E5AA7' : 'transparent'}`, whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* CONTENU */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'prepaie' && <Prepaie />}
        {activeTab === 'factures' && <Factures />}
        {activeTab === 'bulletins' && <Bulletins />}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '10px', color: '#8A95A3' }}>
            <div style={{ fontSize: '32px' }}>💼</div>
            <div style={{ fontSize: '13px', fontWeight: '500' }}>Module Bulletins de salaire — en cours de développement</div>
          </div>

      </div>
      </div>
  )
}