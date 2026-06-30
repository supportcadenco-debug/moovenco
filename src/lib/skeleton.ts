// ─── src/lib/skeleton.ts ───────────────────────────────────────────────────
// Moteur de génération automatique du squelette d'une journée conducteur.
//
// Principe : on fournit la liste ordonnée des SERVICES de la journée
// (scolaires + occasionnels, chacun avec lieu de départ / lieu d'arrivée /
// horaires). Le moteur intercale automatiquement :
//   - PDS  (Prise De Service) au point d'attache du conducteur
//   - HLP  (Haut Le Pied) : trajets à vide entre deux lieux, durée calculée OSRM
//   - MEP  (Mise En Place / mise à disposition) avant chaque service
//   - FDS  (Fin De Service) retour au point d'attache
//
// Tous les temps "tampons" (PDS, MEP, FDS) sont COMPRESSIBLES : si l'amplitude
// dépasse la limite RSE, le moteur les réduit progressivement (jusqu'à un
// plancher) avant de lever une alerte.
//
// Le squelette renvoyé est entièrement MODIFIABLE : chaque créneau peut ensuite
// être édité manuellement (horaires, lieux, véhicule).

import { getRoute, AddressLike } from './osrm'
import {
  timeToMinutes, minutesToTime, calculAmplitude, checkJourneeRse,
  RSE_LIMITS, RseAlert, RseCheckResult,
} from './rse'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ServiceInput {
  label: string                 // ex "LG06", "S11", "O161249/V2"
  type: 'scolaire' | 'occasionnel' | 'regulier' | 'mixte'
  start_time: string            // début du service (HH:MM)
  end_time: string              // fin du service (HH:MM)
  from_address: AddressLike     // lieu de départ (avec lat/lng)
  to_address: AddressLike       // lieu d'arrivée (avec lat/lng)
  vehicle?: string
  circuit_id?: string | null
  notes?: string
}

export interface SkeletonSlot {
  label: string
  type: string
  color: string
  start_time: string
  end_time: string
  from_label: string
  to_label: string
  vehicle: string
  notes: string
  circuit_id: string | null
  editable: boolean             // toujours true — indique à l'UI que c'est modifiable
  generated: boolean            // true si créé par le moteur, false si manuel
  compressible: boolean         // true pour PDS/MEP/FDS (réductibles)
}

export interface SkeletonResult {
  slots: SkeletonSlot[]
  rse: RseCheckResult
  amplitude: number
  compressionApplied: boolean   // true si on a dû réduire des tampons
  alerts: RseAlert[]
}

// Forfaits de base (minutes) — compressibles jusqu'au plancher
const FORFAITS = {
  PDS_DEFAUT: 10, PDS_PLANCHER: 2,    // prise de service
  MEP_DEFAUT: 10, MEP_PLANCHER: 2,    // mise en place avant service
  FDS_DEFAUT: 10, FDS_PLANCHER: 2,    // fin de service
}

const COLORS = {
  neutre: '#9AA3B2',
  scolaire: '#1A2130',
  occasionnel: '#D4720A',
  regulier: '#1A9E50',
  mixte: '#C0157A',
}

function slot(partial: Partial<SkeletonSlot> & { label: string; start_time: string; end_time: string }): SkeletonSlot {
  return {
    type: 'neutre',
    color: COLORS.neutre,
    from_label: '',
    to_label: '',
    vehicle: '',
    notes: '',
    circuit_id: null,
    editable: true,
    generated: true,
    compressible: false,
    ...partial,
  }
}

// ─── Génération du squelette ─────────────────────────────────────────────────

/**
 * Génère le squelette complet d'une journée à partir de la liste des services.
 *
 * @param services      Services de la journée, dans l'ordre chronologique
 * @param pointAttache  Adresse de départ/retour du conducteur (avec lat/lng)
 * @param options       Contraintes de génération
 */
export async function buildSkeleton(
  services: ServiceInput[],
  pointAttache: AddressLike,
  options?: {
    amplitudeMax?: number       // override de la limite (défaut RSE 14h)
    pdsForfait?: number
    fdsForfait?: number
    mepForfait?: number
  }
): Promise<SkeletonResult> {
  const amplitudeMax = options?.amplitudeMax ?? RSE_LIMITS.AMPLITUDE_MAX_NORMAL

  if (services.length === 0) {
    return {
      slots: [], amplitude: 0, compressionApplied: false, alerts: [],
      rse: { amplitude: 0, tempsConduite: 0, tempsService: 0, alerts: [], severity: 'ok' },
    }
  }

  // Trier les services par heure de début
  const sorted = [...services].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))

  // Pré-calculer tous les trajets OSRM nécessaires (HLP) :
  //   attache -> 1er service, puis fin service N -> début service N+1, puis dernier -> attache
  const hlpAttacheVersPremier = await getRoute(pointAttache, sorted[0].from_address)
  const hlpEntreServices: number[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const r = await getRoute(sorted[i].to_address, sorted[i + 1].from_address)
    hlpEntreServices.push(r.durationMin)
  }
  const hlpDernierVersAttache = await getRoute(sorted[sorted.length - 1].to_address, pointAttache)

  // Construire le squelette avec forfaits par défaut, puis comprimer si besoin.
  function assemble(pds: number, mep: number, fds: number): SkeletonSlot[] {
    const result: SkeletonSlot[] = []
    const premier = sorted[0]
    const premierDebut = timeToMinutes(premier.start_time)

    // On remonte depuis le 1er service : MEP avant, HLP avant, PDS avant
    const mepDebut = premierDebut - mep
    const hlpDebut = mepDebut - hlpAttacheVersPremier.durationMin
    const pdsDebut = hlpDebut - pds

    // PDS au point d'attache
    result.push(slot({
      label: 'PDS', type: 'neutre', color: COLORS.neutre,
      start_time: minutesToTime(pdsDebut), end_time: minutesToTime(hlpDebut),
      from_label: pointAttache.name || 'Dépôt', to_label: pointAttache.name || 'Dépôt',
      compressible: true,
    }))

    // HLP : point d'attache -> 1er lieu de service
    result.push(slot({
      label: 'HLP', type: 'neutre', color: COLORS.neutre,
      start_time: minutesToTime(hlpDebut), end_time: minutesToTime(mepDebut),
      from_label: pointAttache.name || 'Dépôt', to_label: premier.from_address.name || premier.from_label || '',
      vehicle: premier.vehicle || '',
    }))

    // MEP avant le 1er service
    result.push(slot({
      label: 'MEP', type: 'neutre', color: COLORS.neutre,
      start_time: minutesToTime(mepDebut), end_time: premier.start_time,
      from_label: premier.from_address.name || '', to_label: premier.from_address.name || '',
      compressible: true,
    }))

    // Boucle sur les services + HLP intermédiaires
    for (let i = 0; i < sorted.length; i++) {
      const svc = sorted[i]
      // Le service lui-même
      result.push(slot({
        label: svc.label, type: svc.type, color: COLORS[svc.type] || COLORS.scolaire,
        start_time: svc.start_time, end_time: svc.end_time,
        from_label: svc.from_address.name || svc.from_label || '',
        to_label: svc.to_address.name || svc.to_label || '',
        vehicle: svc.vehicle || '', notes: svc.notes || '',
        circuit_id: svc.circuit_id || null, generated: false,
      }))

      // HLP vers le service suivant (sauf après le dernier)
      if (i < sorted.length - 1) {
        const suivant = sorted[i + 1]
        const finCourant = timeToMinutes(svc.end_time)
        const debutSuivant = timeToMinutes(suivant.start_time)
        const hlpDur = hlpEntreServices[i]
        const trou = debutSuivant - finCourant

        if (trou >= hlpDur) {
          // Assez de temps : HLP + éventuel temps mort (mise à dispo / attente)
          result.push(slot({
            label: 'HLP', type: 'neutre', color: COLORS.neutre,
            start_time: svc.end_time, end_time: minutesToTime(finCourant + hlpDur),
            from_label: svc.to_address.name || '', to_label: suivant.from_address.name || '',
            vehicle: suivant.vehicle || svc.vehicle || '',
          }))
          // S'il reste du temps avant le service suivant -> MEP / mise à disposition
          if (trou > hlpDur) {
            result.push(slot({
              label: 'MEP', type: 'neutre', color: COLORS.neutre,
              start_time: minutesToTime(finCourant + hlpDur), end_time: suivant.start_time,
              from_label: suivant.from_address.name || '', to_label: suivant.from_address.name || '',
              compressible: true,
            }))
          }
        } else {
          // Pas assez de temps entre les deux services : HLP quand même,
          // signalé comme tendu (l'UI affichera l'incohérence)
          result.push(slot({
            label: 'HLP', type: 'neutre', color: COLORS.neutre,
            start_time: svc.end_time, end_time: suivant.start_time,
            from_label: svc.to_address.name || '', to_label: suivant.from_address.name || '',
            vehicle: suivant.vehicle || '',
            notes: `⚠️ Trajet ${hlpDur}min mais seulement ${trou}min disponibles`,
          }))
        }
      }
    }

    // HLP retour : dernier lieu -> point d'attache
    const dernier = sorted[sorted.length - 1]
    const finDernier = timeToMinutes(dernier.end_time)
    result.push(slot({
      label: 'HLP', type: 'neutre', color: COLORS.neutre,
      start_time: dernier.end_time, end_time: minutesToTime(finDernier + hlpDernierVersAttache.durationMin),
      from_label: dernier.to_address.name || '', to_label: pointAttache.name || 'Dépôt',
      vehicle: dernier.vehicle || '',
    }))

    // FDS au point d'attache
    const fdsDebut = finDernier + hlpDernierVersAttache.durationMin
    result.push(slot({
      label: 'FDS', type: 'neutre', color: COLORS.neutre,
      start_time: minutesToTime(fdsDebut), end_time: minutesToTime(fdsDebut + fds),
      from_label: pointAttache.name || 'Dépôt', to_label: pointAttache.name || 'Dépôt',
      compressible: true,
    }))

    return result
  }

  // 1er essai avec forfaits par défaut
  let pds = options?.pdsForfait ?? FORFAITS.PDS_DEFAUT
  let mep = options?.mepForfait ?? FORFAITS.MEP_DEFAUT
  let fds = options?.fdsForfait ?? FORFAITS.FDS_DEFAUT

  let skeleton = assemble(pds, mep, fds)
  let amplitude = calculAmplitude(skeleton)
  let compressionApplied = false

  // Compression progressive si l'amplitude dépasse : on réduit les tampons
  // compressibles (PDS, MEP, FDS) jusqu'à leur plancher.
  if (amplitude > amplitudeMax) {
    compressionApplied = true
    // Réduire par paliers de 1 minute jusqu'à atteindre la limite ou les planchers
    while (amplitude > amplitudeMax &&
           (pds > FORFAITS.PDS_PLANCHER || mep > FORFAITS.MEP_PLANCHER || fds > FORFAITS.FDS_PLANCHER)) {
      if (pds > FORFAITS.PDS_PLANCHER) pds--
      if (mep > FORFAITS.MEP_PLANCHER) mep--
      if (fds > FORFAITS.FDS_PLANCHER) fds--
      skeleton = assemble(pds, mep, fds)
      amplitude = calculAmplitude(skeleton)
    }
  }

  const rse = checkJourneeRse(skeleton)

  return {
    slots: skeleton,
    rse,
    amplitude,
    compressionApplied,
    alerts: rse.alerts,
  }
}

// ─── Détection de doublon (pour l'envoi J+7) ────────────────────────────────

/**
 * Vérifie si un créneau scolaire pour ce circuit existe déjà dans la journée
 * (créé manuellement). Évite les doublons lors de l'envoi automatique J+7.
 */
export function circuitDejaPresent(
  existingSlots: { circuit_id?: string | null; label?: string }[],
  circuitId: string,
  circuitLabel: string
): boolean {
  return existingSlots.some(s =>
    (s.circuit_id && s.circuit_id === circuitId) ||
    (s.label && circuitLabel && s.label === circuitLabel)
  )
}
