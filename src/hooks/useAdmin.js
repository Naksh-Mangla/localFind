import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

/**
 * Checks if the currently signed-in Firebase user is an admin.
 * Calls /api/admin/check on mount. If it returns 200, isAdmin = true.
 * If user is not signed in or the check returns 401/403, isAdmin stays false.
 * No visible UI side-effects for non-admins — they never know the route exists.
 */
export function useAdmin(user) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRole, setAdminRole] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      setAdminRole(null)
      setChecking(false)
      return
    }

    let cancelled = false

    async function check() {
      try {
        const data = await apiFetch('/api/admin/check')
        if (!cancelled && data?.isAdmin) {
          setIsAdmin(true)
          setAdminRole(data.role || 'admin')
        }
      } catch {
        // 401/403 — user is not an admin, that's fine
        if (!cancelled) {
          setIsAdmin(false)
          setAdminRole(null)
        }
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [user])

  return { isAdmin, adminRole, checking }
}
