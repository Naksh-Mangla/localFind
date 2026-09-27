import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '../lib/api'

/**
 * Manages Admin Authentication & Session Lock.
 * Provides password-protected gatekeeper with session storage token.
 */
export function useAdmin(user) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [adminUser, setAdminUser] = useState(null)
  const [checking, setChecking] = useState(true)

  // Verify active session or Firebase admin status
  const verifyStatus = useCallback(async () => {
    const savedToken = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('localfind_admin_token') : null
    
    try {
      const data = await apiFetch('/api/admin/check')
      if (data?.isAdmin) {
        setIsAdmin(true)
        setAdminUser({
          email: data.email || user?.email || 'Administrator',
          role: data.role || 'admin',
          uid: data.uid || user?.uid
        })
        if (savedToken) {
          setIsUnlocked(true)
        }
      }
    } catch {
      if (!savedToken) {
        setIsAdmin(false)
        setIsUnlocked(false)
        setAdminUser(null)
      }
    } finally {
      setChecking(false)
    }
  }, [user])

  useEffect(() => {
    verifyStatus()
  }, [verifyStatus])

  // Login with Admin Email + Password
  const loginWithPassword = useCallback(async (email, password) => {
    const res = await apiFetch('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    })

    if (res?.token) {
      sessionStorage.setItem('localfind_admin_token', res.token)
      setIsAdmin(true)
      setIsUnlocked(true)
      setAdminUser(res.user)
      return { success: true, user: res.user }
    }

    throw new Error(res?.error || 'Login failed')
  }, [])

  // Lock admin session
  const lockAdmin = useCallback(() => {
    sessionStorage.removeItem('localfind_admin_token')
    setIsUnlocked(false)
  }, [])

  return {
    isAdmin,
    isUnlocked,
    adminUser,
    checking,
    loginWithPassword,
    lockAdmin,
    refreshAdmin: verifyStatus
  }
}
