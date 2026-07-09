'use client'

import { useState, useEffect, useRef } from 'react'
import AddressPicker from '../../src/components/AddressPicker'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '@/lib/useAuth'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const TYPES_CLIENT = ['Entreprise', 'Collectivité', 'Association', 'Particulier', 'École', 'Autre']
const DELAIS = [15, 30, 45, 60, 90]
const CATEGORIES_DOC = [
  'Administratif', 'Commercial', 'Contrat', 'Facturation & paiement',
  'Scolaire', 'Assurance', 'Autorisation', 'Courrier', 'Autre'
]

const EMPTY_CLIENT = {
  name: '', type: 'Entreprise', siret: '', tva_intracommunautaire: '',
  adresse: '', cp: '', ville: '', pays: 'France',
  contact_nom: '', contact_prenom: '', contact_tel: '', contact_mail: '', contact_fonction: '',
  iban: '', bic: '', delai_paiement: 30, notes: ''
}

export default function Clients() {
  const { ready } = useAuth('clients')
  const [clients, setClients] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [tab, setTab] = useState('infos')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(EMPTY_CLIENT)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [docs, setDocs] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const fileRef = useRef<any>(null)
  const [addresses, setAddresses] = useState<any[]>([])

  useEffect(() => { loadClients(); loadAddresses() }, [])

  async function loadAddresses() {
    const { data } = await supabase.from('addresses').select('id, name, address, lat, lng').eq('company_id', COMPANY_ID).order('name')
    setAddresses(data || [])
  }

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*')
      .eq('company_id', COMPANY_ID).order('name')
    setClients(data || [])
  }

  async function loadDocs(clientId: string) {
    const { data } = await supabase.from('client_documents').select('*')
      .eq('client_id', clientId).order('created_at', { ascending: false })
    setDocs(data || [])
  }

  async function loadOrders(clientId: string) {
    const { data } = await supabase.from('orders').select('id, reference, date_service, status, price_ttc')
      .eq('client_id', clientId).order('date_service', { ascending: false }).limit(20)
    setOrders(data || [])
  }

  function selectClient(client: any) {
    setSelected(client)
    setTab('infos')
    loadDocs(client.id)
    loadOrders(client.id)
  }

  const s = (key: string) => (e: any) => setForm((f: any) => ({ ...f, [key]: e.target.value }))

  async function handleSave() {
    if (!form.name) return
    setSaving(true)
    if (selected && !showForm) {
      await supabase.from('clients').update(form).eq('id', selected.id)
    } else {
      await supabase.from('clients').insert({ ...form, company_id: COMPANY_ID })
    }
    setSaving(false)
    setShowForm(false)
    loadClients()
  }

  async function deleteClient(client: any) {
    if (!window.confirm(`Supprimer définitivement le client "${client.name}" ?\n\nCette action est irréversible. Les documents et l'historique liés à ce client resteront en base mais ne seront plus rattachés.`)) return
    const { error } = await supabase.from('clients').delete().eq('id', client.id)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
      return
    }
    setSelected(null)
    loadClients()
  }

  async function uploadDoc(e: any) {
    const file = e.target.files[0]
    if (!file || !selected) return
    setUploading(true)
    const path = `${selected.id}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('client-documents').upload(path, file)
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('client-documents').getPublicUrl(path)
      await supabase.from('client_documents').insert({
        company_id: COMPANY_ID, client_id: selected.id,
        nom: file.name, categorie: 'Autre',
        url: urlData.publicUrl, taille: file.size,
      })
      loadDocs(selected.id)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteDoc(doc: any) {
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return
    await supabase.from('client_documents').delete().eq('id', doc.id)
    loadDocs(selected.id)
  }

  async function updateDocCategorie(docId: string, cat: string) {
    await supabase.from('client_documents').update({ categorie: cat }).eq('id', docId)
    loadDocs(selected.id)
  }

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.ville?.toLowerCase().includes(search.toLowerCase())
  )

  const STATUS_COLORS: any = {
    devis: '#1565C0', confirme: '#1A9E50', affecte: '#D4720A',
    en_cours: '#7B1FA2', termine: '#37474F', annule: '#C62828'
  }

  const inputStyle = { width: '100%', padding: '7px 10px', border: '1px solid #D0D4DA', borderRadius: '5px', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' as any }
  const labelStyle = { fontSize: '10px', fontWeight: '600' as any, color: '#4A5568', display: 'block' as any, marginBottom: '3px' }
  const sectionStyle = { fontSize: '10px', fontWeight: '700' as any, color: '#8A95A3', textTransform: 'uppercase' as any, letterSpacing: '.4px', paddingBottom: '4px', borderBottom: '1px solid #E2E6EA', marginTop: '10px', marginBottom: '8px' }

  if (!ready) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ fontSize: '13px', color: '#8A95A3' }}>Chargement…</div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LISTE CLIENTS */}
        <div style={{ width: '260px', background: '#1A2130', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '10px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Rechercher..."
              style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map(c => (
              <div key={c.id} onClick={() => selectClient(c)}
                style={{ padding: '10px 12px', cursor: 'pointer', borderLeft: selected?.id === c.id ? '3px solid #2EC971' : '3px solid transparent', background: selected?.id === c.id ? 'rgba(255,255,255,.08)' : 'transparent' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'white' }}>{c.name}</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', marginTop: '2px' }}>
                  {c.type || 'Entreprise'} {c.ville ? `• ${c.ville}` : ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px', borderTop: '1px solid rgba(255,255,255,.1)' }}>
            <button onClick={() => { setForm(EMPTY_CLIENT); setShowForm(true); setSelected(null) }}
              style={{ width: '100%', background: '#2EC971', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
              + Nouveau client
            </button>
          </div>
        </div>

        {/* CONTENU PRINCIPAL */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {showForm ? (
            /* FORMULAIRE NOUVEAU CLIENT */
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              <div style={{ maxWidth: '600px', background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>Nouveau client</h2>
                  <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#8A95A3' }}>✕</button>
                </div>

                <div style={sectionStyle}>Identité</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><label style={labelStyle}>Nom *</label><input value={form.name} onChange={s('name')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Type</label>
                    <select value={form.type} onChange={s('type')} style={inputStyle}>
                      {TYPES_CLIENT.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><label style={labelStyle}>SIRET</label><input value={form.siret} onChange={s('siret')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>TVA intracommunautaire</label><input value={form.tva_intracommunautaire} onChange={s('tva_intracommunautaire')} style={inputStyle} /></div>
                </div>

                <div style={sectionStyle}>Adresse</div>
                <div style={{ marginBottom: '8px' }}><label style={labelStyle}>Adresse</label><AddressPicker addresses={addresses} value={form.adresse} onChange={({ label }: any) => setForm((f: any) => ({ ...f, adresse: label }))} placeholder="Rechercher une adresse…" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><label style={labelStyle}>Code postal</label><input value={form.cp} onChange={s('cp')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Ville</label><input value={form.ville} onChange={s('ville')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Pays</label><input value={form.pays} onChange={s('pays')} style={inputStyle} /></div>
                </div>

                <div style={sectionStyle}>Contact principal</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><label style={labelStyle}>Nom</label><input value={form.contact_nom} onChange={s('contact_nom')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Prénom</label><input value={form.contact_prenom} onChange={s('contact_prenom')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Fonction</label><input value={form.contact_fonction} onChange={s('contact_fonction')} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><label style={labelStyle}>Téléphone</label><input value={form.contact_tel} onChange={s('contact_tel')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Email</label><input value={form.contact_mail} onChange={s('contact_mail')} style={inputStyle} /></div>
                </div>

                <div style={sectionStyle}>Facturation</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <div><label style={labelStyle}>IBAN</label><input value={form.iban} onChange={s('iban')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>BIC</label><input value={form.bic} onChange={s('bic')} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Délai paiement (j)</label>
                    <select value={form.delai_paiement} onChange={s('delai_paiement')} style={inputStyle}>
                      {DELAIS.map(d => <option key={d} value={d}>{d} jours</option>)}
                    </select>
                  </div>
                </div>

                <div style={sectionStyle}>Notes</div>
                <textarea value={form.notes} onChange={s('notes')} rows={3}
                  style={{ ...inputStyle, resize: 'vertical' }} placeholder="Informations complémentaires..." />

                <button onClick={handleSave} disabled={saving}
                  style={{ marginTop: '16px', width: '100%', background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer le client'}
                </button>
              </div>
            </div>

          ) : selected ? (
            /* DÉTAIL CLIENT */
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Header client */}
              <div style={{ background: 'white', padding: '14px 20px', borderBottom: '1px solid #E2E6EA', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#0E5AA7', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' }}>
                  {selected.name?.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1A2130' }}>{selected.name}</div>
                  <div style={{ fontSize: '11px', color: '#8A95A3' }}>{selected.type} {selected.ville ? `• ${selected.ville}` : ''}</div>
                </div>
                <button onClick={() => deleteClient(selected)}
                  style={{ marginLeft: 'auto', background: '#FFEBEE', border: 'none', color: '#C62828', fontFamily: 'inherit', fontSize: '11px', fontWeight: '600', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer', flexShrink: 0 }}>
                  🗑 Supprimer le client
                </button>
              </div>

              {/* Onglets */}
              <div style={{ background: 'white', borderBottom: '1px solid #E2E6EA', display: 'flex', padding: '0 20px' }}>
                {[['infos','📋 Infos'],['documents','📄 Documents'],['historique','🕐 Historique']].map(([k,l]) => (
                  <button key={k} onClick={() => setTab(k)}
                    style={{ background: 'none', border: 'none', borderBottom: tab === k ? '2px solid #0E5AA7' : '2px solid transparent', color: tab === k ? '#0E5AA7' : '#8A95A3', fontFamily: 'inherit', fontSize: '12px', fontWeight: '600', padding: '10px 14px', cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

                {/* ONGLET INFOS */}
                {tab === 'infos' && (
                  <div style={{ maxWidth: '600px', background: 'white', borderRadius: '10px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
                    <div style={sectionStyle}>Identité</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div><label style={labelStyle}>Nom</label><input defaultValue={selected.name} onBlur={e => setSelected((s: any) => ({...s, name: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Type</label>
                        <select defaultValue={selected.type} onChange={e => setSelected((s: any) => ({...s, type: e.target.value}))} style={inputStyle}>
                          {TYPES_CLIENT.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div><label style={labelStyle}>SIRET</label><input defaultValue={selected.siret} onBlur={e => setSelected((s: any) => ({...s, siret: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>TVA intra.</label><input defaultValue={selected.tva_intracommunautaire} onBlur={e => setSelected((s: any) => ({...s, tva_intracommunautaire: e.target.value}))} style={inputStyle} /></div>
                    </div>

                    <div style={sectionStyle}>Adresse</div>
                    <div style={{ marginBottom: '8px' }}><label style={labelStyle}>Adresse</label><AddressPicker addresses={addresses} value={selected.adresse} onChange={({ label }: any) => setSelected((s: any) => ({ ...s, adresse: label }))} placeholder="Rechercher une adresse…" /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div><label style={labelStyle}>CP</label><input defaultValue={selected.cp} onBlur={e => setSelected((s: any) => ({...s, cp: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Ville</label><input defaultValue={selected.ville} onBlur={e => setSelected((s: any) => ({...s, ville: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Pays</label><input defaultValue={selected.pays} onBlur={e => setSelected((s: any) => ({...s, pays: e.target.value}))} style={inputStyle} /></div>
                    </div>

                    <div style={sectionStyle}>Contact principal</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div><label style={labelStyle}>Nom</label><input defaultValue={selected.contact_nom} onBlur={e => setSelected((s: any) => ({...s, contact_nom: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Prénom</label><input defaultValue={selected.contact_prenom} onBlur={e => setSelected((s: any) => ({...s, contact_prenom: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Fonction</label><input defaultValue={selected.contact_fonction} onBlur={e => setSelected((s: any) => ({...s, contact_fonction: e.target.value}))} style={inputStyle} /></div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div><label style={labelStyle}>Téléphone</label><input defaultValue={selected.contact_tel} onBlur={e => setSelected((s: any) => ({...s, contact_tel: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Email</label><input defaultValue={selected.contact_mail} onBlur={e => setSelected((s: any) => ({...s, contact_mail: e.target.value}))} style={inputStyle} /></div>
                    </div>

                    <div style={sectionStyle}>Facturation</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div><label style={labelStyle}>IBAN</label><input defaultValue={selected.iban} onBlur={e => setSelected((s: any) => ({...s, iban: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>BIC</label><input defaultValue={selected.bic} onBlur={e => setSelected((s: any) => ({...s, bic: e.target.value}))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Délai paiement</label>
                        <select defaultValue={selected.delai_paiement} onChange={e => setSelected((s: any) => ({...s, delai_paiement: e.target.value}))} style={inputStyle}>
                          {DELAIS.map(d => <option key={d} value={d}>{d} jours</option>)}
                        </select>
                      </div>
                    </div>

                    <div style={sectionStyle}>Notes</div>
                    <textarea defaultValue={selected.notes} onBlur={e => setSelected((s: any) => ({...s, notes: e.target.value}))} rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }} />

                    <button onClick={async () => { setSaving(true); await supabase.from('clients').update(selected).eq('id', selected.id); setSaving(false); loadClients() }}
                      style={{ marginTop: '16px', width: '100%', background: saving ? '#8A95A3' : '#0E5AA7', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '12px', fontWeight: '700', padding: '10px', borderRadius: '6px', cursor: 'pointer' }}>
                      {saving ? 'Enregistrement…' : '💾 Enregistrer les modifications'}
                    </button>
                  </div>
                )}

                {/* ONGLET DOCUMENTS */}
                {tab === 'documents' && (
                  <div>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center' }}>
                      <label style={{ background: uploading ? '#8A95A3' : '#0E5AA7', color: 'white', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                        {uploading ? '⏳ Upload…' : '📎 Ajouter un document'}
                        <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={uploadDoc} />
                      </label>
                      <span style={{ fontSize: '11px', color: '#8A95A3' }}>{docs.length} document{docs.length > 1 ? 's' : ''}</span>
                    </div>

                    {CATEGORIES_DOC.map(cat => {
                      const catDocs = docs.filter(d => d.categorie === cat)
                      if (catDocs.length === 0) return null
                      return (
                        <div key={cat} style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '10px', fontWeight: '700', color: '#8A95A3', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '6px' }}>{cat}</div>
                          {catDocs.map(doc => (
                            <div key={doc.id} style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '18px' }}>📄</span>
                              <div style={{ flex: 1 }}>
                                <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', fontWeight: '600', color: '#0E5AA7', textDecoration: 'none' }}>{doc.nom}</a>
                                <div style={{ fontSize: '10px', color: '#8A95A3', marginTop: '2px' }}>
                                  {doc.taille ? `${Math.round(doc.taille/1024)} Ko` : ''} • {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                                </div>
                              </div>
                              <select value={doc.categorie} onChange={e => updateDocCategorie(doc.id, e.target.value)}
                                style={{ fontSize: '10px', padding: '3px 6px', border: '1px solid #D0D4DA', borderRadius: '4px', fontFamily: 'inherit' }}>
                                {CATEGORIES_DOC.map(c => <option key={c}>{c}</option>)}
                              </select>
                              <button onClick={() => deleteDoc(doc)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '14px' }}>🗑</button>
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {/* Documents sans catégorie */}
                    {docs.filter(d => !CATEGORIES_DOC.includes(d.categorie)).map(doc => (
                      <div key={doc.id} style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>📄</span>
                        <div style={{ flex: 1 }}>
                          <a href={doc.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', fontWeight: '600', color: '#0E5AA7', textDecoration: 'none' }}>{doc.nom}</a>
                        </div>
                        <select value={doc.categorie || 'Autre'} onChange={e => updateDocCategorie(doc.id, e.target.value)}
                          style={{ fontSize: '10px', padding: '3px 6px', border: '1px solid #D0D4DA', borderRadius: '4px', fontFamily: 'inherit' }}>
                          {CATEGORIES_DOC.map(c => <option key={c}>{c}</option>)}
                        </select>
                        <button onClick={() => deleteDoc(doc)} style={{ background: 'none', border: 'none', color: '#C62828', cursor: 'pointer', fontSize: '14px' }}>🗑</button>
                      </div>
                    ))}

                    {docs.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8A95A3' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>📄</div>
                        <div style={{ fontSize: '12px' }}>Aucun document pour ce client</div>
                      </div>
                    )}
                  </div>
                )}

                {/* ONGLET HISTORIQUE */}
                {tab === 'historique' && (
                  <div>
                    {orders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: '#8A95A3' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🕐</div>
                        <div style={{ fontSize: '12px' }}>Aucune commande pour ce client</div>
                      </div>
                    ) : orders.map(o => (
                      <div key={o.id} style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '8px', padding: '12px 16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: '700' }}>{o.reference}</div>
                          <div style={{ fontSize: '11px', color: '#8A95A3', marginTop: '2px' }}>
                            {o.date_service ? new Date(o.date_service + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                          </div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: STATUS_COLORS[o.status] + '20', color: STATUS_COLORS[o.status] }}>
                          {o.status}
                        </span>
                        {o.price_ttc && <span style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>{parseFloat(o.price_ttc).toFixed(0)} €</span>}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>

          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A95A3' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
                <div style={{ fontSize: '14px' }}>Sélectionnez un client ou créez-en un nouveau</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
