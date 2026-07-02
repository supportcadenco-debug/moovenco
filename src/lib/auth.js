import { supabase } from './supabase'

export async function getCurrentProfile() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  return profile
}

export async function getPermissions(companyId, role) {
  const { data } = await supabase
    .from('permissions')
    .select('*')
    .eq('company_id', companyId)
    .eq('role', role)

  const perms = {}
  ;(data || []).forEach(p => { perms[p.module] = p.access })
  return perms
}

// Modules principaux affichés dans la sidebar.
// Anomalies -> intégré comme sous-onglet dans Atelier
// Personnel / Clients -> sous-onglets dans Comptabilité
// Adresses -> sous-onglet dans Commercial
// Permissions -> déplacé dans SETTINGS_MODULES (icône ⚙️ Réglages)
export const MODULES = [
  { key: 'dashboard',    label: 'Dashboard',    icon: '📊', href: '/dashboard' },
  { key: 'planning',     label: 'Planning',     icon: '📅', href: '/planning' },
  { key: 'commercial',   label: 'Commercial',   icon: '💼', href: '/commercial' },
  { key: 'comptabilite', label: 'Comptabilité', icon: '💰', href: '/comptabilite' },
  { key: 'atelier',      label: 'Atelier',      icon: '🔧', href: '/atelier' },
  { key: 'scolaire',     label: 'Scolaire',     icon: '🏫', href: '/scolaire' },
  { key: 'import',       label: 'Import',       icon: '📥', href: '/import' },
]

// Modules regroupés derrière l'icône ⚙️ Réglages en bas de la sidebar
export const SETTINGS_MODULES = [
  { key: 'permissions', label: 'Permissions', icon: '🔐', href: '/permissions' },
]

export function filterModules(modules, perms, role) {
  if (role === 'super_admin' || role === 'directeur') return modules
  return modules.filter(m => {
    if (m.key === 'permissions') return role === 'super_admin'
    const access = perms[m.key]
    return access && access !== 'none'
  })
}