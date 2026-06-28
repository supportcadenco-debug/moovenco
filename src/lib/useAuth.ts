import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentProfile, getPermissions } from './auth'

export function useAuth(requiredModule?: string) {
  const [profile, setProfile] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const prof = await getCurrentProfile()
      if (!prof) { router.replace('/auth'); return }

      if (prof.role === 'super_admin' || prof.role === 'directeur') {
        setProfile(prof); setReady(true); return
      }

      if (requiredModule) {
        const perms = await getPermissions(prof.company_id, prof.role)
        const access = perms[requiredModule]
        if (!access || access === 'none') {
          router.replace('/acces-refuse'); return
        }
      }

      setProfile(prof)
      setReady(true)
    }
    check()
  }, [])

  return { profile, ready }
}