// ─── Utilitaires globaux Moovenco ────────────────────────────────────────────
import { supabase } from './supabase'
import { COMPANY_ID } from './constants'

// ── ID unique ─────────────────────────────────────────────────────────────────
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ── Numérotation documents ─────────────────────────────────────────────────────
export function getNextNumero(docs: any[], prefix: string): string {
  const year = new Date().getFullYear()
  const existing = docs.filter(d => d.numero?.startsWith(`${prefix}${year}-`))
  const max = existing.reduce((acc, d) => {
    const n = parseInt(d.numero?.split('-')[1] || '0')
    return n > acc ? n : acc
  }, 0)
  return `${prefix}${year}-${String(max + 1).padStart(3, '0')}`
}

// ── Formatage montant ──────────────────────────────────────────────────────────
export function formatMontant(v: any): string {
  return parseFloat(v || 0).toFixed(2)
}

// ── Calcul montants ────────────────────────────────────────────────────────────
export function calcMontantHT(form: any): number {
  const { tarif_mode, tarif_km, distance_km, tarif_journee, nb_jours, frais_attente } = form
  if (tarif_mode === 'km')
    return (parseFloat(tarif_km) || 0) * (parseInt(distance_km) || 0) + (parseFloat(frais_attente) || 0)
  if (tarif_mode === 'journee')
    return (parseFloat(tarif_journee) || 0) + (parseFloat(frais_attente) || 0)
  if (tarif_mode === 'multi_jours')
    return (parseFloat(tarif_journee) || 0) * (parseInt(nb_jours) || 1) + (parseFloat(frais_attente) || 0)
  return 0
}

export function calcTotaux(form: any) {
  const ht  = calcMontantHT(form)
  const tva = ht * (form.tva_taux / 100)
  return { ht, tva, ttc: ht + tva }
}

// ── Lignes automatiques ────────────────────────────────────────────────────────
export function buildLignesAuto(form: any): any[] {
  const { tarif_mode, tarif_km, distance_km, tarif_journee, nb_jours, frais_attente, vehicle_type, date_service } = form
  const dateStr = date_service ? new Date(date_service).toLocaleDateString('fr-FR') : ''
  const lignes: any[] = []

  if (tarif_mode === 'km')
    lignes.push({ description: `Transport ${vehicle_type} — ${distance_km || '?'} km${dateStr ? ' le ' + dateStr : ''}`, quantite: parseInt(distance_km) || 1, prix_unitaire: parseFloat(tarif_km) || 0 })
  else if (tarif_mode === 'journee')
    lignes.push({ description: `Forfait journée ${vehicle_type}${dateStr ? ' le ' + dateStr : ''}`, quantite: 1, prix_unitaire: parseFloat(tarif_journee) || 0 })
  else
    lignes.push({ description: `Forfait ${nb_jours} jour(s) ${vehicle_type}`, quantite: parseInt(nb_jours) || 1, prix_unitaire: parseFloat(tarif_journee) || 0 })

  if (parseFloat(frais_attente) > 0)
    lignes.push({ description: "Frais d'attente conducteur", quantite: 1, prix_unitaire: parseFloat(frais_attente) })

  return lignes
}

// ── Client auto-création ───────────────────────────────────────────────────────
export async function ensureClient(form: any): Promise<string | null> {
  if (form.client_id) return form.client_id
  if (!form.client_nom) return null

  const { data: existing } = await supabase.from('clients').select('id')
    .eq('company_id', COMPANY_ID).ilike('name', form.client_nom).maybeSingle()
  if (existing) return existing.id

  const newId = generateId()
  await supabase.from('clients').insert({
    id: newId, company_id: COMPANY_ID,
    name: form.client_nom, type: form.client_type,
    adresse: form.client_adresse, cp: form.client_cp, ville: form.client_ville,
    email: form.client_email, contact_mail: form.client_email,
    siret: form.client_siret,
    contact_nom:    form.client_contact_nom?.split(' ').slice(1).join(' ') || '',
    contact_prenom: form.client_contact_nom?.split(' ')[0] || '',
    contact_tel: form.client_contact_tel,
    active: true,
  })
  return newId
}

// ── Tarif auto ─────────────────────────────────────────────────────────────────
export function getTarifAuto(tarifs: any[], vehicle: string, client: string) {
  return tarifs.find(t => t.vehicle_type === vehicle && t.client_type === client) || null
}
