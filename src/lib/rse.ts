// ─── src/lib/rse.ts ────────────────────────────────────────────────────────
// Réglementation Sociale Européenne — transport routier de voyageurs
// Règlement CE 561/2006 + Convention collective transport routier de voyageurs
//
// Toutes les durées sont manipulées en MINUTES pour éviter les erreurs
// d'arrondi liées aux flottants. Les fonctions d'affichage convertissent
// en HH:MM uniquement à la sortie.

// ─── Constantes réglementaires ──────────────────────────────────────────────

export const RSE_LIMITS = {
  // Amplitude journalière (intervalle entre 2 repos journaliers)
  AMPLITUDE_MAX_NORMAL: 14 * 60,      // 14h00 — repos quotidien normal (convention collective FR)
  AMPLITUDE_MAX_REDUIT: 15 * 60,      // 15h00 — si repos quotidien réduit pris
  AMPLITUDE_MAX_EQUIPAGE: 18 * 60,    // 18h00 — double équipage (conv. collective FR)

  // Temps de conduite
  CONDUITE_MAX_JOUR: 9 * 60,          // 9h00 — conduite max par jour
  CONDUITE_MAX_JOUR_EXCEPTIONNEL: 10 * 60, // 10h00 — 2x par semaine max
  CONDUITE_MAX_CONTINUE: 4 * 60 + 30, // 4h30 — avant pause obligatoire
  CONDUITE_MAX_SEMAINE: 56 * 60,      // 56h — par semaine isolée
  CONDUITE_MAX_2_SEMAINES: 90 * 60,   // 90h — cumulé sur 2 semaines consécutives

  // Pauses (règlement 561/2006)
  PAUSE_APRES_CONDUITE_CONTINUE: 45,  // 45min après 4h30 de conduite continue
  PAUSE_FRACTIONNEE_1: 15,            // 1ère partie si fractionnée
  PAUSE_FRACTIONNEE_2: 30,            // 2e partie si fractionnée

  // Pauses (code du travail — temps de travail effectif, distinct de la conduite)
  PAUSE_CDT_APRES_6H: 30,             // 30min après 6h de travail effectif
  PAUSE_CDT_APRES_9H: 45,             // 45min après 9h de travail effectif

  // Repos journalier
  REPOS_JOURNALIER_NORMAL: 11 * 60,   // 11h00 consécutives minimum
  REPOS_JOURNALIER_REDUIT: 9 * 60,    // 9h00 minimum (max 3x entre 2 repos hebdo)
  REPOS_JOURNALIER_FRACTIONNE_1: 3 * 60,  // 1ère partie si fractionné
  REPOS_JOURNALIER_FRACTIONNE_2: 9 * 60,  // 2e partie si fractionné
  REPOS_EQUIPAGE: 9 * 60,             // 9h en double équipage (période de 30h)

  // Repos hebdomadaire
  REPOS_HEBDO_NORMAL: 45 * 60,        // 45h consécutives
  REPOS_HEBDO_REDUIT: 24 * 60,        // 24h minimum (à récupérer sous 3 semaines)

  // Cycle de travail
  MAX_PERIODES_24H_CONSECUTIVES: 6,   // 6 périodes de 24h max avant repos hebdo
} as const

export type RseSeverity = 'ok' | 'warning' | 'danger'

export interface RseAlert {
  code: string
  severity: RseSeverity
  message: string
  valeur?: number       // valeur calculée (minutes)
  limite?: number       // limite réglementaire dépassée (minutes)
}

// ─── Utilitaires temps ───────────────────────────────────────────────────────

/** "07:30" -> 450 (minutes depuis minuit) */
export function timeToMinutes(time: string): number {
  if (!time) return 0
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

/** 450 -> "07:30" */
export function minutesToTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/** Durée lisible : 125 -> "2h05" */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.abs(Math.round(minutes))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}h${String(m).padStart(2, '0')}`
}

// ─── Calcul amplitude journalière ────────────────────────────────────────────

export interface SlotLike {
  start_time: string
  end_time: string
  type?: string
}

/**
 * Amplitude = intervalle entre le premier et le dernier événement de la journée
 * (prise de service -> fin de service), tous types de créneaux confondus
 * sauf 'repos'.
 */
export function calculAmplitude(slots: SlotLike[]): number {
  const actifs = slots.filter(s => s.type !== 'repos' && s.start_time && s.end_time)
  if (actifs.length === 0) return 0
  const starts = actifs.map(s => timeToMinutes(s.start_time))
  const ends = actifs.map(s => {
    const e = timeToMinutes(s.end_time)
    // Gère le passage minuit (ex: 23:00 -> 00:30)
    return e < timeToMinutes(s.start_time) ? e + 1440 : e
  })
  return Math.max(...ends) - Math.min(...starts)
}

/**
 * Temps de conduite total = somme des créneaux de type scolaire/occasionnel/
 * regulier/mixte (les seuls considérés comme "conduite" dans Moovenco ;
 * HLP est aussi de la conduite).
 */
const TYPES_CONDUITE = ['scolaire', 'occasionnel', 'regulier', 'mixte']

export function calculTempsConduite(slots: SlotLike[]): number {
  return slots
    .filter(s => TYPES_CONDUITE.includes(s.type || '') || s.label === 'HLP')
    .reduce((total, s) => {
      const start = timeToMinutes(s.start_time)
      let end = timeToMinutes(s.end_time)
      if (end < start) end += 1440
      return total + (end - start)
    }, 0)
}

/** Temps de service = amplitude moins les vraies coupures (repos pris dans la journée) */
export function calculTempsService(slots: SlotLike[]): number {
  const actifs = slots.filter(s => s.type !== 'repos' && s.start_time && s.end_time)
  return actifs.reduce((total, s) => {
    const start = timeToMinutes(s.start_time)
    let end = timeToMinutes(s.end_time)
    if (end < start) end += 1440
    return total + (end - start)
  }, 0)
}

// ─── Vérification de conformité ──────────────────────────────────────────────

export interface RseCheckResult {
  amplitude: number
  tempsConduite: number
  tempsService: number
  alerts: RseAlert[]
  severity: RseSeverity
}

export function checkJourneeRse(slots: SlotLike[], options?: { repreceptionNormal?: boolean }): RseCheckResult {
  const amplitude = calculAmplitude(slots)
  const tempsConduite = calculTempsConduite(slots)
  const tempsService = calculTempsService(slots)
  const alerts: RseAlert[] = []

  const ampliMax = options?.repreceptionNormal === false
    ? RSE_LIMITS.AMPLITUDE_MAX_REDUIT
    : RSE_LIMITS.AMPLITUDE_MAX_NORMAL

  if (amplitude > ampliMax) {
    alerts.push({
      code: 'AMPLITUDE_DEPASSEE',
      severity: 'danger',
      message: `Amplitude ${formatDuration(amplitude)} — dépasse la limite de ${formatDuration(ampliMax)}`,
      valeur: amplitude,
      limite: ampliMax,
    })
  } else if (amplitude > ampliMax - 60) {
    alerts.push({
      code: 'AMPLITUDE_PROCHE_LIMITE',
      severity: 'warning',
      message: `Amplitude ${formatDuration(amplitude)} — proche de la limite (${formatDuration(ampliMax)})`,
      valeur: amplitude,
      limite: ampliMax,
    })
  }

  if (tempsConduite > RSE_LIMITS.CONDUITE_MAX_JOUR_EXCEPTIONNEL) {
    alerts.push({
      code: 'CONDUITE_DEPASSEE',
      severity: 'danger',
      message: `Conduite ${formatDuration(tempsConduite)} — dépasse le maximum absolu de ${formatDuration(RSE_LIMITS.CONDUITE_MAX_JOUR_EXCEPTIONNEL)}`,
      valeur: tempsConduite,
      limite: RSE_LIMITS.CONDUITE_MAX_JOUR_EXCEPTIONNEL,
    })
  } else if (tempsConduite > RSE_LIMITS.CONDUITE_MAX_JOUR) {
    alerts.push({
      code: 'CONDUITE_EXCEPTIONNELLE',
      severity: 'warning',
      message: `Conduite ${formatDuration(tempsConduite)} — dépassement exceptionnel (max 2x/semaine)`,
      valeur: tempsConduite,
      limite: RSE_LIMITS.CONDUITE_MAX_JOUR,
    })
  }

  // Pause code du travail après 6h / 9h de service
  if (tempsService > RSE_LIMITS.CONDUITE_MAX_JOUR && !hasAdequatePause(slots, tempsService)) {
    const seuil = tempsService > 9 * 60 ? RSE_LIMITS.PAUSE_CDT_APRES_9H : RSE_LIMITS.PAUSE_CDT_APRES_6H
    alerts.push({
      code: 'PAUSE_INSUFFISANTE',
      severity: 'warning',
      message: `Pause obligatoire de ${seuil}min non détectée dans la journée`,
      valeur: 0,
      limite: seuil,
    })
  }

  const severity: RseSeverity = alerts.some(a => a.severity === 'danger')
    ? 'danger'
    : alerts.some(a => a.severity === 'warning') ? 'warning' : 'ok'

  return { amplitude, tempsConduite, tempsService, alerts, severity }
}

/** Détecte un trou (créneau libre) d'au moins `seuil` minutes dans la journée */
function hasAdequatePause(slots: SlotLike[], tempsService: number): boolean {
  const seuilPause = tempsService > 9 * 60 ? RSE_LIMITS.PAUSE_CDT_APRES_9H : RSE_LIMITS.PAUSE_CDT_APRES_6H
  const actifs = [...slots]
    .filter(s => s.type !== 'repos' && s.start_time && s.end_time)
    .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time))

  for (let i = 0; i < actifs.length - 1; i++) {
    const finCourant = timeToMinutes(actifs[i].end_time)
    const debutSuivant = timeToMinutes(actifs[i + 1].start_time)
    if (debutSuivant - finCourant >= seuilPause) return true
  }
  return false
}

// ─── Repos entre deux journées ───────────────────────────────────────────────

/**
 * Vérifie le repos entre la fin d'une journée (HH:MM, date J) et le début
 * de la journée suivante (HH:MM, date J+1).
 */
export function checkReposJournalier(
  finJ: string, dateJ: string,
  debutJ1: string, dateJ1: string
): RseAlert | null {
  const finDate = new Date(`${dateJ}T${finJ}:00`)
  const debutDate = new Date(`${dateJ1}T${debutJ1}:00`)
  const reposMin = Math.round((debutDate.getTime() - finDate.getTime()) / 60000)

  if (reposMin < RSE_LIMITS.REPOS_JOURNALIER_REDUIT) {
    return {
      code: 'REPOS_JOURNALIER_INSUFFISANT',
      severity: 'danger',
      message: `Repos de ${formatDuration(reposMin)} entre les 2 journées — minimum légal ${formatDuration(RSE_LIMITS.REPOS_JOURNALIER_REDUIT)}`,
      valeur: reposMin,
      limite: RSE_LIMITS.REPOS_JOURNALIER_REDUIT,
    }
  }
  if (reposMin < RSE_LIMITS.REPOS_JOURNALIER_NORMAL) {
    return {
      code: 'REPOS_JOURNALIER_REDUIT',
      severity: 'warning',
      message: `Repos réduit de ${formatDuration(reposMin)} (normal : ${formatDuration(RSE_LIMITS.REPOS_JOURNALIER_NORMAL)}) — max 3x entre 2 repos hebdo`,
      valeur: reposMin,
      limite: RSE_LIMITS.REPOS_JOURNALIER_NORMAL,
    }
  }
  return null
}

// ─── Cumul hebdomadaire / bi-hebdomadaire ───────────────────────────────────

export interface WeeklyConduiteResult {
  totalSemaine: number
  alerts: RseAlert[]
}

export function checkConduiteHebdo(slotsParJour: SlotLike[][]): WeeklyConduiteResult {
  const totalSemaine = slotsParJour.reduce((sum, jour) => sum + calculTempsConduite(jour), 0)
  const alerts: RseAlert[] = []

  if (totalSemaine > RSE_LIMITS.CONDUITE_MAX_SEMAINE) {
    alerts.push({
      code: 'CONDUITE_HEBDO_DEPASSEE',
      severity: 'danger',
      message: `Conduite hebdomadaire ${formatDuration(totalSemaine)} — dépasse la limite de ${formatDuration(RSE_LIMITS.CONDUITE_MAX_SEMAINE)}`,
      valeur: totalSemaine,
      limite: RSE_LIMITS.CONDUITE_MAX_SEMAINE,
    })
  } else if (totalSemaine > RSE_LIMITS.CONDUITE_MAX_SEMAINE - 5 * 60) {
    alerts.push({
      code: 'CONDUITE_HEBDO_PROCHE_LIMITE',
      severity: 'warning',
      message: `Conduite hebdomadaire ${formatDuration(totalSemaine)} — proche de la limite (${formatDuration(RSE_LIMITS.CONDUITE_MAX_SEMAINE)})`,
      valeur: totalSemaine,
      limite: RSE_LIMITS.CONDUITE_MAX_SEMAINE,
    })
  }

  return { totalSemaine, alerts }
}

export function checkConduite2Semaines(totalSemaine1: number, totalSemaine2: number): RseAlert | null {
  const total = totalSemaine1 + totalSemaine2
  if (total > RSE_LIMITS.CONDUITE_MAX_2_SEMAINES) {
    return {
      code: 'CONDUITE_2SEM_DEPASSEE',
      severity: 'danger',
      message: `Conduite sur 2 semaines ${formatDuration(total)} — dépasse la limite de ${formatDuration(RSE_LIMITS.CONDUITE_MAX_2_SEMAINES)}`,
      valeur: total,
      limite: RSE_LIMITS.CONDUITE_MAX_2_SEMAINES,
    }
  }
  return null
}

// ─── Repos hebdomadaire ───────────────────────────────────────────────────────

export function checkReposHebdo(dureeReposMin: number): RseAlert | null {
  if (dureeReposMin < RSE_LIMITS.REPOS_HEBDO_REDUIT) {
    return {
      code: 'REPOS_HEBDO_INSUFFISANT',
      severity: 'danger',
      message: `Repos hebdomadaire ${formatDuration(dureeReposMin)} — minimum légal ${formatDuration(RSE_LIMITS.REPOS_HEBDO_REDUIT)}`,
      valeur: dureeReposMin,
      limite: RSE_LIMITS.REPOS_HEBDO_REDUIT,
    }
  }
  if (dureeReposMin < RSE_LIMITS.REPOS_HEBDO_NORMAL) {
    return {
      code: 'REPOS_HEBDO_REDUIT',
      severity: 'warning',
      message: `Repos hebdomadaire réduit ${formatDuration(dureeReposMin)} — à compenser sous 3 semaines`,
      valeur: dureeReposMin,
      limite: RSE_LIMITS.REPOS_HEBDO_NORMAL,
    }
  }
  return null
}

// ─── Helper d'affichage couleur / icône selon sévérité ──────────────────────

export function severityColor(severity: RseSeverity): { bg: string; text: string; border: string } {
  switch (severity) {
    case 'danger':  return { bg: '#FFEBEE', text: '#C62828', border: '#FFCDD2' }
    case 'warning': return { bg: '#FFF3E0', text: '#D4720A', border: '#FFE0B2' }
    default:        return { bg: '#E8F5E9', text: '#1A9E50', border: '#A5D6A7' }
  }
}
