'use client'

import { useAuth } from '@/lib/useAuth'
import Navbar from '../../src/components/Navbar'
import PersonnelPanel from '../../src/components/PersonnelPanel'

// Page standalone — seul point d'entrée qui a besoin de sa propre protection
// RBAC (elle n'est pas encapsulée dans app/comptabilite/page.tsx), d'où le
// useAuth('personnel') ici. La logique métier vit dans PersonnelPanel.
export default function PersonnelPage() {
  const { profile, ready } = useAuth('personnel')

  if (!ready) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ECEEF1', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '13px', color: '#8A95A3' }}>Chargement…</div>
    </div>
  )

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', fontFamily:'Inter, sans-serif', background:'#ECEEF1' }}>
      <Navbar currentPage="personnel" />
      <PersonnelPanel currentUserProfile={profile} />
    </div>
  )
}
