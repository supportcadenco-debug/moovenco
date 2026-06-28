'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentProfile, getPermissions } from './auth'

export function useAuth(requiredModule?: string, requiredAccess: 'read' | 'write' = 'read') {
  const [profile, setProfile] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const prof = await getCurrentProfile()
      if (!prof) { router.replace('/auth'); return }

      // super_admin et directeur ont accès à tout
      if (prof.role === 'super_admin' || prof.role === 'directeur') {
        setProfile(prof); setReady(true); return
      }

      if (requiredModule) {
        const perms = await getPermissions(prof.company_id, prof.role)
        const access = perms[requiredModule]
        if (!access || access === 'none') {
          router.replace('/accès-refusé'); return
        }
        if (requiredAccess === 'write' && access === 'read') {
          // lecture seule OK — on laisse passer mais on le note dans le profil
          setProfile({ ...prof, readOnly: true })
          setReady(true); return
        }
      }

      setProfile(prof)
      setReady(true)
    }
    check()
  }, [])

  return { profile, ready }
}