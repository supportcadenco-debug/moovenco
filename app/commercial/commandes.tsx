'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../src/lib/supabase'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

const STATUT_COLORS = {
  confirme: { bg: '#E3F2FD', text: '#1565C0', label: 'Confirmée' },
  affecte:  { bg: '#FFF3E0', text: '#D4720A', label: 'Affectée' },
  termine:  { bg: '#E8F5E9', text: '#1A9E50', label: 'Terminée' },
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function Commandes({ onUnreadCountChange }) {
  const [orders, setOrders] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('avecRetour') // 'avecRetour' | 'tous' | 'nonVus'

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: o }, { data: d }] = await Promise.all([
      supabase.from('orders').select('*').eq('company_id', COMPANY_ID).order('date_service', { ascending: false }),
      supabase.from('profiles').select('id, name').eq('company_id', COMPANY_ID).eq('role', 'conducteur'),
    ])
    setOrders(o || [])
    setDrivers(d || [])
    setLoading(false)
    if (onUnreadCountChange) {
      onUnreadCountChange((o || []).filter(x => x.retour_recu_at && !x.retour_vu).length)
    }
  }

  function driverName(uid) {
    return drivers.find(d => d.id === uid)?.name || uid || '—'
  }

  async function markAsSeen(order) {
    await supabase.from('orders').update({ retour_vu: true }).eq('id', order.id)
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, retour_vu: true } : o))
    if (onUnreadCountChange) {
      setOrders(prev => {
        const updated = prev.map(o => o.id === order.id ? { ...o, retour_vu: true } : o)
        onUnreadCountChange(updated.filter(x => x.retour_recu_at && !x.retour_vu).length)
        return updated
      })
    }
  }

  const hasRetour = (o) => !!o.retour_recu_at
  const filteredOrders = orders.filter(o => {
    if (filter === 'avecRetour') return hasRetour(o)
    if (filter === 'nonVus') return hasRetour(o) && !o.retour_vu
    return true
  })

  if (loading) {
    return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A95A3', fontSize: '13px' }}>Chargement…</div>
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* LISTE */}
      <div style={{ width: '340px', minWidth: '340px', borderRight: '1px solid #E2E6EA', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: '4px', padding: '10px', borderBottom: '1px solid #E2E6EA', background: '#F8F9FB' }}>
          {[['avecRetour', 'Avec retour'], ['nonVus', 'Non vus'], ['tous', 'Toutes']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: '6px', border: '1px solid #D0D4DA', background: filter === v ? '#0E5AA7' : 'white', color: filter === v ? 'white' : '#4A5568', fontSize: '10px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredOrders.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#8A95A3', fontSize: '12px' }}>Aucune commande ici.</div>
          ) : filteredOrders.map(o => {
            const statut = STATUT_COLORS[o.status] || { bg: '#F0F2F5', text: '#8A95A3', label: o.status }
            const unread = hasRetour(o) && !o.retour_vu
            return (
              <div key={o.id} onClick={() => setSelected(o)}
                style={{ padding: '12px 14px', borderBottom: '1px solid #F0F2F5', cursor: 'pointer', background: selected?.id === o.id ? '#F0F7FF' : unread ? '#FFF8E1' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#1A2130' }}>
                    {unread && <span style={{ color: '#D4720A' }}>🔔 </span>}
                    {o.reference || o.id.slice(0, 8)}
                  </span>
                  <span style={{ fontSize: '9px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: statut.bg, color: statut.text }}>{statut.label}</span>
                </div>
                <div style={{ fontSize: '10px', color: '#8A95A3' }}>{o.destination || o.client_responsable || '—'} · {o.date_service || '—'}</div>
                {hasRetour(o) && (
                  <div style={{ fontSize: '9px', color: '#4A5568', marginTop: '3px' }}>
                    ↩ Retour reçu {fmtDateTime(o.retour_recu_at)} — {driverName(o.retour_conducteur_uid)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* DÉTAIL */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {!selected ? (
          <div style={{ textAlign: 'center', color: '#8A95A3', padding: '60px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
            <div style={{ fontSize: '13px' }}>Sélectionnez une commande pour voir le détail du retour BC</div>
          </div>
        ) : (
          <div style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1A2130' }}>{selected.reference || selected.id.slice(0, 8)}</div>
                <div style={{ fontSize: '12px', color: '#8A95A3', marginTop: '2px' }}>{selected.destination} — {selected.date_service}</div>
              </div>
              {hasRetour(selected) && !selected.retour_vu && (
                <button onClick={() => markAsSeen(selected)}
                  style={{ background: '#1A9E50', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '11px', fontWeight: '700', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer' }}>
                  ✓ Marquer comme vu
                </button>
              )}
            </div>

            {!hasRetour(selected) ? (
              <div style={{ background: '#F8F9FB', borderRadius: '8px', padding: '16px', fontSize: '12px', color: '#8A95A3' }}>
                Aucun retour BC n'a encore été envoyé par le conducteur pour cette commande.
              </div>
            ) : (
              <>
                <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>↩ Retour BC</div>
                  <div style={{ fontSize: '11px', color: '#4A5568', marginBottom: '4px' }}>Reçu le <strong>{fmtDateTime(selected.retour_recu_at)}</strong></div>
                  <div style={{ fontSize: '11px', color: '#4A5568' }}>Conducteur : <strong>{driverName(selected.retour_conducteur_uid)}</strong></div>
                </div>

                {(selected.retour_km_dep_garage != null || selected.retour_km_ret_garage != null) && (
                  <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>🚌 Véhicule & kilométrage</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#4A5568' }}>
                      {selected.retour_vehicule_reel && <div>Véhicule réel : <strong>{selected.retour_vehicule_reel}</strong></div>}
                      {selected.retour_pax_reel != null && <div>Passagers réels : <strong>{selected.retour_pax_reel}</strong></div>}
                      {selected.retour_km_dep_garage != null && <div>Km départ garage : <strong>{selected.retour_km_dep_garage}</strong></div>}
                      {selected.retour_km_dep_client != null && <div>Km départ client : <strong>{selected.retour_km_dep_client}</strong></div>}
                      {selected.retour_km_ret_client != null && <div>Km retour client : <strong>{selected.retour_km_ret_client}</strong></div>}
                      {selected.retour_km_ret_garage != null && <div>Km retour garage : <strong>{selected.retour_km_ret_garage}</strong></div>}
                      {selected.retour_km_vide != null && <div>Km à vide : <strong>{selected.retour_km_vide}</strong></div>}
                      {selected.retour_km_nat != null && <div>Km national : <strong>{selected.retour_km_nat}</strong></div>}
                      {selected.retour_km_hue != null && <div>Km HUE : <strong>{selected.retour_km_hue}</strong></div>}
                    </div>
                  </div>
                )}

                {(selected.retour_heure_dep_client || selected.retour_heure_ret_garage) && (
                  <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>🕐 Horaires réels</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px', color: '#4A5568' }}>
                      {selected.retour_heure_dep_client && <div>Départ client : <strong>{selected.retour_heure_dep_client}{selected.retour_heure_dep_client_j1 ? ' (J+1)' : ''}</strong></div>}
                      {selected.retour_heure_ret_client && <div>Retour client : <strong>{selected.retour_heure_ret_client}{selected.retour_heure_ret_client_j1 ? ' (J+1)' : ''}</strong></div>}
                      {selected.retour_heure_ret_garage && <div>Retour garage : <strong>{selected.retour_heure_ret_garage}{selected.retour_heure_ret_garage_j1 ? ' (J+1)' : ''}</strong></div>}
                    </div>
                  </div>
                )}

                {selected.retour_validation_statut && (
                  <div style={{ background: 'white', border: '1px solid #E2E6EA', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#1A2130', marginBottom: '10px' }}>✅ Validation de la course</div>
                    <div style={{ fontSize: '11px', color: '#4A5568', marginBottom: '6px' }}>Statut : <strong>{selected.retour_validation_statut}</strong></div>
                    {selected.retour_validation_obs && (
                      <div style={{ fontSize: '11px', color: '#4A5568', background: '#F8F9FB', padding: '8px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>{selected.retour_validation_obs}</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
