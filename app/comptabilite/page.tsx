'use client'

import { useState } from 'react'
import Navbar from '../../src/components/Navbar'
import Prepaie from './prepaie'
import Factures from './factures'
import Bulletins from './bulletins'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const DOC_CATS_RH = [
  { key: 'contrat',   label: '📄 Contrat de travail' },
  { key: 'avenant',   label: '📝 Avenant' },
  { key: 'bulletin',  label: '💼 Bulletin de salaire' },
  { key: 'autre',     label: '📎 Autre' },
]

export default function Comptabilite() {
  const [activeTab, setActiveTab] = useState('prepaie')
  const [rhDocs, setRhDocs] = useState<any[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)

  async function uploadRhDoc(file: File, categorie: string) {
    if (!file) return
    setUploadingDoc(true)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `comptabilite/rh/${Date.now()}_${safeName}`
      const { error: upErr } = await supabase.storage.from('driver-documents').upload(path, file, { upsert: false })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(path)
        const { data } = await supabase.from('module_documents').insert({
          company_id: COMPANY_ID, module: 'comptabilite',
          nom: file.name, categorie, url: urlData.publicUrl, taille: file.size,
        }).select()
        if (data) setRhDocs(prev => [data[0], ...prev])
      }
    } catch(e) { console.error(e) }
    setUploadingDoc(false)
  }

  async function loadRhDocs() {
    const { data } = await supabase.from('module_documents').select('*')
      .eq('module', 'comptabilite').order('created_at', { ascending: false })
    setRhDocs(data || [])
  }

  async function deleteRhDoc(doc: any) {
    if (!confirm('Supprimer ?')) return
    await supabase.from('module_documents').delete().eq('id', doc.id)
    setRhDocs(prev => prev.filter((d: any) => d.id !== doc.id))
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: '#ECEEF1' }}>

      <Navbar currentPage="comptabilite" />

      {/* SOUS-ONGLETS */}
      <div style={{ background: 'white', borderBottom: '1px solid #D0D4DA', display: 'flex', padding: '0 16px', flexShrink: 0 }}>
        {[
          ['prepaie',    '📋 Prépaie'],
          ['factures',   '🧾 Factures'],
          ['bulletins',  '💼 Bulletins'],
          ['documents',  '📎 Documents RH'],
        ].map(([key, label]) => (
          <button key={key} onClick={() => { setActiveTab(key); if (key === 'documents') loadRhDocs() }}
            style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: '11px', fontWeight: activeTab === key ? '700' : '400', color: activeTab === key ? '#0E5AA7' : '#8A95A3', padding: '10px 16px', cursor: 'pointer', borderBottom: `2px solid ${activeTab === key ? '#0E5AA7' : 'transparent'}`, whiteSpace: 'nowrap' }}>
            {label}
          </button>
        ))}
      </div>

      {/* CONTENU */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'prepaie'   && <Prepaie />}
        {activeTab === 'factures'  && <Factures />}
        {activeTab === 'bulletins' && <Bulletins />}
        {activeTab === 'documents' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
            <div style={{ maxWidth: '700px' }}>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130', marginBottom: '16px' }}>📎 Documents RH & Comptabilité</div>
              {DOC_CATS_RH.map(cat => {
                const catDocs = rhDocs.filter((d: any) => d.categorie === cat.key)
                return (
                  <div key={cat.key} style={{ background: 'white', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>{cat.label}</div>
                      <label style={{ background: uploadingDoc ? '#8A95A3' : '#E8F0FB', color: '#0E5AA7', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '5px', cursor: uploadingDoc ? 'not-allowed' : 'pointer' }}>
                        {uploadingDoc ? '⏳' : '+ Ajouter'}
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} disabled={uploadingDoc}
                          onChange={e => { if (e.target.files?.[0]) uploadRhDoc(e.target.files[0], cat.key) }} />
                      </label>
                    </div>
                    {catDocs.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#8A95A3', padding: '8px', background: '#F8F9FB', borderRadius: '5px' }}>Aucun document</div>
                    ) : catDocs.map((doc: any) => (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#F8F9FB', border: '1px solid #E2E6EA', borderRadius: '6px', marginBottom: '5px' }}>
                        <span style={{ fontSize: '18px' }}>{doc.nom?.endsWith('.pdf') ? '📄' : '🖼️'}</span>
                        <a href={doc.url} target="_blank" rel="noreferrer"
                          style={{ flex: 1, fontSize: '12px', fontWeight: '600', color: '#0E5AA7', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.nom}
                        </a>
                        <span style={{ fontSize: '10px', color: '#8A95A3', whiteSpace: 'nowrap' }}>{new Date(doc.created_at).toLocaleDateString('fr-FR')}</span>
                        <button onClick={() => deleteRhDoc(doc)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '14px' }}>🗑</button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
