import React, { useState, useEffect, useRef } from 'react'
import { triggerHaptic } from '../utils/haptics'
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler'

export function AdminAuthModal({ isOpen, onClose, onUnlockSuccess, initialEmail = '' }) {
  useAndroidBackHandler(isOpen, onClose, 'admin_auth')

  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const emailInputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setPassword('')
      if (initialEmail) setEmail(initialEmail)
      setTimeout(() => {
        emailInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen, initialEmail])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Please enter both admin email and password.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onUnlockSuccess(email.trim(), password)
      triggerHaptic('success')
      onClose()
    } catch (err) {
      triggerHaptic('error')
      setError(err?.message || 'Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Click outside backdrop */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Card matching LocalFind Warm Apple/Linear UI */}
      <div className="relative w-full max-w-md bg-surface-container-lowest dark:bg-zinc-900 border border-surface-variant/60 dark:border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-[0_16px_40px_rgba(0,0,0,0.18)] z-10 text-on-surface">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
            </div>
            <div>
              <h2 className="font-headline-lg text-lg font-bold text-on-surface tracking-tight">Admin Portal</h2>
              <p className="text-xs text-on-surface-variant">Enter master credentials to unlock control panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-all"
          >
            ✕
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-2xl bg-error/10 border border-error/20 text-error text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>
            <span className="flex-1 font-semibold">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-primary">mail</span>
              <span>Admin Email *</span>
            </label>
            <input
              ref={emailInputRef}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. nakshmangla@gmail.com"
              required
              className="w-full px-4 py-3 bg-surface-container-high border border-surface-variant rounded-2xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-on-surface mb-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-primary">key</span>
              <span>Admin Password *</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                required
                className="w-full pl-4 pr-11 py-3 bg-surface-container-high border border-surface-variant rounded-2xl text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-primary hover:bg-primary-container text-on-primary font-bold rounded-2xl shadow-crisp-xs active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">lock_open</span>
                  <span>Unlock Admin Panel</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
