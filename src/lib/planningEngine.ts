// ─── src/lib/planningEngine.ts ─────────────────────────────────────────────
// Couche de liaison entre les données Supabase (circuits, arrêts, adresses,
// point d'attache conducteur) et le moteur de squelette (skeleton.ts).
//
// C'est ici qu'on traduit un circuit_id + un conducteur en un appel à
// buildSkeleton(), puis qu'on insère les créneaux générés dans la table slots.

import { supabase } from './supabase'
import { buildSkeleton, ServiceInput, SkeletonSlot, circuitDejaPresent } from './skeleton'
import { AddressLike } from './osrm'

const COMPANY_ID = 'bae899ec-b4fd-4b0d-bacf-112e0a2bc6c5'

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ─── Récupération du point d'attache d'un conducteur ─────────────────────────

export async function getPointAttache(driverId: string): Promise<AddressLike> {
  const fallback: AddressLike = { name: 'Dépôt Janzé', lat: 47.9583, lng: -1.4972 }

  const { data: dd } = await supabase
    .from('driver_details')
    .select('point_attache_id')
    .eq('id', driverId)
    .single()

  if (!dd?.point_attache_id) return fallback

  const { data: addr } = await supabase
    .from('addresses')
    .select('id, name, address, lat, lng')
    .eq('id', dd.point_attache_id)
    .single()

  if (!addr || addr.lat == null || addr.lng == null) return fallback
  return { id: addr.id, name: addr.name, lat: addr.lat, lng: addr.lng }
}

// ─── Construire un ServiceInput depuis un circuit ────────────────────────────

export async function circuitToService(circuitId: string): Promise<ServiceInput | null> {
  const { data: circuit } = await supabase
    .from('circuits')
    .select('*')
    .eq('id', circuitId)
    .single()
  if (!circuit) return null

  // Récupérer les arrêts ordonnés avec leurs adresses GPS
  const { data: stops } = await supabase
    .from('circuit_stops')
    .select('order_index, addresses(id, name, address, lat, lng)')
    .eq('circuit_id', circuitId)
    .order('order_index')

  const validStops = (stops || []).filter((s: any) => s.addresses)
  if (validStops.length === 0) return null

  const premier: any = validStops[0].addresses
  const dernier: any = validStops[validStops.length - 1].addresses

  return {
    label: circuit.code || circuit.name,
    type: 'scolaire',
    start_time: circuit.heure_debut || '07:00',
    end_time: circuit.heure_fin || '08:30',
    from_address: { id: premier.id, name: premier.name, lat: premier.lat, lng: premier.lng },
    to_address: { id: dernier.id, name: dernier.name, lat: dernier.lat, lng: dernier.lng },
    vehicle: circuit.vehicule_defaut || '',
    circuit_id: circuit.id,
  }
}

// ─── Générer et insérer le squelette d'un circuit pour un conducteur ─────────

export interface GenerationResult {
  ok: boolean
  inserted: number
  amplitude: number
  compressionApplied: boolean
  alerts: { code: string; severity: string; message: string }[]
  error?: string
}

/**
 * Génère le squelette complet pour un circuit et un conducteur sur une journée,
 * puis insère les créneaux dans la table slots.
 *
 * @param planningId  ID du planning (journée) déjà créé
 * @param driverId    ID du conducteur
 * @param circuitId   ID du circuit à planifier
 * @param existingSlots  Créneaux déjà présents ce jour (pour éviter doublons)
 */
export async function genererSquelettePourCircuit(
  planningId: string,
  driverId: string,
  circuitId: string,
  existingSlots: { circuit_id?: string | null; label?: string }[] = []
): Promise<GenerationResult> {
  // Construire le service depuis le circuit
  const service = await circuitToService(circuitId)
  if (!service) {
    return { ok: false, inserted: 0, amplitude: 0, compressionApplied: false, alerts: [], error: 'Circuit sans arrêts géolocalisés' }
  }

  // Anti-doublon : si le circuit est déjà planifié ce jour, on ne refait rien
  if (circuitDejaPresent(existingSlots, circuitId, service.label)) {
    return { ok: true, inserted: 0, amplitude: 0, compressionApplied: false, alerts: [], error: 'Circuit déjà présent (doublon évité)' }
  }

  // Récupérer le point d'attache du conducteur
  const pointAttache = await getPointAttache(driverId)

  // Générer le squelette via le moteur
  const result = await buildSkeleton([service], pointAttache)

  // Insérer les créneaux
  let inserted = 0
  for (const s of result.slots) {
    const { error } = await supabase.from('slots').insert({
      id: generateId(), company_id: COMPANY_ID, planning_id: planningId,
      label: s.label, type: s.type, color: s.color,
      start_time: s.start_time, end_time: s.end_time,
      from_label: s.from_label, to_label: s.to_label,
      vehicle: s.vehicle || '', notes: s.notes || '',
      circuit_id: s.circuit_id || null,
    })
    if (!error) inserted++
  }

  return {
    ok: true,
    inserted,
    amplitude: result.amplitude,
    compressionApplied: result.compressionApplied,
    alerts: result.alerts.map(a => ({ code: a.code, severity: a.severity, message: a.message })),
  }
}

// ─── Recalcul complet d'une journée ──────────────────────────────────────────

// Préfixes de labels considérés comme des tampons générés automatiquement.
// On détecte par préfixe (pas égalité exacte) pour attraper les variantes
// comme "HLP retour", "PDS matin", etc.
const TAMPON_PREFIXES = ['PDS', 'HLP', 'MEP', 'FDS', 'MAD']

function estTampon(label: string | null | undefined): boolean {
  if (!label) return false
  const l = label.trim().toUpperCase()
  return TAMPON_PREFIXES.some(p => l.startsWith(p))
}

/**
 * Récupère une adresse complète depuis son id (pour les services manuels).
 */
async function getAddressById(addressId: string | null): Promise<AddressLike | null> {
  if (!addressId) return null
  const { data } = await supabase
    .from('addresses')
    .select('id, name, address, lat, lng')
    .eq('id', addressId)
    .single()
  if (!data) return null
  return { id: data.id, name: data.name, lat: data.lat, lng: data.lng }
}

/**
 * Recalcule TOUT le squelette d'une journée :
 *  1. Récupère les vrais services (tout sauf tampons PDS/HLP/MEP/FDS)
 *  2. Supprime les anciens tampons
 *  3. Régénère PDS/HLP/MEP/FDS autour des services conservés
 *
 * Appelé à chaque ajout ou suppression de créneau pour garder le squelette
 * cohérent (les FDS/HLP retour se replacent après le nouveau dernier service).
 */
export async function recalculerJournee(
  planningId: string,
  driverId: string
): Promise<GenerationResult> {
  // 1. Charger tous les créneaux de la journée
  const { data: allSlots } = await supabase
    .from('slots')
    .select('*')
    .eq('planning_id', planningId)
    .order('start_time')

  if (!allSlots || allSlots.length === 0) {
    return { ok: true, inserted: 0, amplitude: 0, compressionApplied: false, alerts: [] }
  }

  // 2. Séparer les vrais services des tampons (détection par préfixe)
  const services = allSlots.filter((s: any) => !estTampon(s.label))
  const tampons = allSlots.filter((s: any) => estTampon(s.label))

  // Si pas de vrai service, on nettoie juste les tampons orphelins
  if (services.length === 0) {
    for (const t of tampons) await supabase.from('slots').delete().eq('id', t.id)
    return { ok: true, inserted: 0, amplitude: 0, compressionApplied: false, alerts: [] }
  }

  // 3. Reconstruire les ServiceInput depuis les vrais services
  const serviceInputs: ServiceInput[] = []
  for (const s of services) {
    // Adresses : priorité aux from_address_id/to_address_id (carnet),
    // sinon on tente via le circuit, sinon fallback texte sans GPS.
    let fromAddr = await getAddressById(s.from_address_id)
    let toAddr = await getAddressById(s.to_address_id)

    // Si c'est un circuit scolaire sans adresses explicites, on les déduit
    if ((!fromAddr || !toAddr) && s.circuit_id) {
      const svc = await circuitToService(s.circuit_id)
      if (svc) {
        if (!fromAddr) fromAddr = svc.from_address
        if (!toAddr) toAddr = svc.to_address
      }
    }

    serviceInputs.push({
      label: s.label,
      type: (s.type as any) || 'occasionnel',
      start_time: s.start_time,
      end_time: s.end_time,
      from_address: fromAddr || { name: s.from_label || '', lat: null, lng: null },
      to_address: toAddr || { name: s.to_label || '', lat: null, lng: null },
      vehicle: s.vehicle || '',
      circuit_id: s.circuit_id || null,
      notes: s.notes || '',
    })
  }

  // 4. Supprimer tous les anciens tampons
  for (const t of tampons) {
    await supabase.from('slots').delete().eq('id', t.id)
  }

  // 5. Régénérer le squelette complet autour des services
  const pointAttache = await getPointAttache(driverId)
  const result = await buildSkeleton(serviceInputs, pointAttache)

  // 6. Insérer UNIQUEMENT les tampons régénérés (les services existent déjà)
  //    On reconnaît les tampons par leur label.
  let inserted = 0
  for (const sl of result.slots) {
    if (!estTampon(sl.label)) continue  // on ne réinsère pas les services
    const { error } = await supabase.from('slots').insert({
      id: generateId(), company_id: COMPANY_ID, planning_id: planningId,
      label: sl.label, type: sl.type, color: sl.color,
      start_time: sl.start_time, end_time: sl.end_time,
      from_label: sl.from_label, to_label: sl.to_label,
      vehicle: sl.vehicle || '', notes: sl.notes || '',
      circuit_id: null,
    })
    if (!error) inserted++
  }

  return {
    ok: true,
    inserted,
    amplitude: result.amplitude,
    compressionApplied: result.compressionApplied,
    alerts: result.alerts.map(a => ({ code: a.code, severity: a.severity, message: a.message })),
  }
}

/**
 * Génère le squelette pour PLUSIEURS circuits sur la même journée (cas d'un
 * conducteur avec 2 circuits scolaires différents -> journée REG).
 * Les services sont combinés et le squelette est calculé en une seule passe
 * pour optimiser les HLP entre eux.
 */
export async function genererSquelettePourCircuits(
  planningId: string,
  driverId: string,
  circuitIds: string[],
  existingSlots: { circuit_id?: string | null; label?: string }[] = []
): Promise<GenerationResult> {
  // Construire tous les services, en filtrant les doublons
  const services: ServiceInput[] = []
  for (const cid of circuitIds) {
    const svc = await circuitToService(cid)
    if (svc && !circuitDejaPresent(existingSlots, cid, svc.label)) {
      services.push(svc)
    }
  }

  if (services.length === 0) {
    return { ok: true, inserted: 0, amplitude: 0, compressionApplied: false, alerts: [], error: 'Aucun circuit à planifier (doublons évités)' }
  }

  const pointAttache = await getPointAttache(driverId)
  const result = await buildSkeleton(services, pointAttache)

  let inserted = 0
  for (const s of result.slots) {
    const { error } = await supabase.from('slots').insert({
      id: generateId(), company_id: COMPANY_ID, planning_id: planningId,
      label: s.label, type: s.type, color: s.color,
      start_time: s.start_time, end_time: s.end_time,
      from_label: s.from_label, to_label: s.to_label,
      vehicle: s.vehicle || '', notes: s.notes || '',
      circuit_id: s.circuit_id || null,
    })
    if (!error) inserted++
  }

  return {
    ok: true,
    inserted,
    amplitude: result.amplitude,
    compressionApplied: result.compressionApplied,
    alerts: result.alerts.map(a => ({ code: a.code, severity: a.severity, message: a.message })),
  }
}
