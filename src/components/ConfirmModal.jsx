import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler'
import { triggerHaptic } from '../utils/haptics'

export function ConfirmModal({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  onConfirm,
  onCancel
}) {
  const [isExiting, setIsExiting] = useState(false)
  const closeTimerRef = useRef(null)
  // Confirm in-flight guard: a slow onConfirm (network delete/save) plus a
  // fast double-tap must not fire the action twice. Mirrors the cancel guard.
  // isConfirming mirrors it as state so the buttons can disable + spinner.
  const confirmingRef = useRef(false)
  const [isConfirming, setIsConfirming] = useState(false)
  // In-modal error: a failed/hung confirm keeps the modal open, so the
  // failure must be visible HERE — not just console + caller toast.
  const [confirmError, setConfirmError] = useState('')
  // Hang watchdog: if onConfirm neither resolves nor rejects (network
  // stall), the modal would otherwise sit spinner-locked with every close
  // path held until reload. 25s re-enables Cancel with an inline error.
  const CONFIRM_TIMEOUT_MS = 25000
  const confirmTimeoutRef = useRef(null)
  // Call sites pass inline arrows (new identity every parent render).
  // Reading onCancel via ref keeps handleClose — and every effect keyed on
  // it — stable, so the keydown listener isn't re-added on each render.
  const onCancelRef = useRef(onCancel)
  useEffect(() => {
    onCancelRef.current = onCancel
  })

  const handleClose = useCallback(() => {
    // Committed confirm in flight: the action was accepted and is running —
    // closing now (backdrop / Escape / back / Cancel) would imply it didn't
    // happen while it continues in the background. Hold the modal till done.
    if (closeTimerRef.current || confirmingRef.current) return
    setIsExiting(true)
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null
      setIsExiting(false)
      onCancelRef.current()
    }, 220)
  }, [])

  // Unmount safety: a parent that closes directly must not get a stale
  // onCancel after unmount.
  useEffect(() => () => {
    clearTimeout(closeTimerRef.current)
    clearTimeout(confirmTimeoutRef.current)
    confirmingRef.current = false
  }, [])

  const handleConfirm = useCallback(async () => {
    if (confirmingRef.current || closeTimerRef.current) return
    confirmingRef.current = true
    setIsConfirming(true)
    setConfirmError('')
    triggerHaptic('impact')
    clearTimeout(confirmTimeoutRef.current)
    confirmTimeoutRef.current = setTimeout(() => {
      // Still pending: assume hung. Release everything and say so in-modal.
      confirmingRef.current = false
      setIsConfirming(false)
      setConfirmError('Taking too long — check your connection and retry, or cancel.')
    }, CONFIRM_TIMEOUT_MS)
    try {
      await onConfirm()
    } catch (err) {
      // Failed confirm that keeps the modal open: show it inline (callers
      // should also toast, as Admin does). State reset happens in finally.
      clearTimeout(confirmTimeoutRef.current)
      console.warn('Confirm action failed:', err?.message || err)
      setConfirmError(err?.message ? `Failed: ${err.message}` : 'Action failed. Please retry.')
    } finally {
      // ALWAYS release, even when the caller swallowed the error without
      // re-throwing (Admin handlers toast internally and resolve normally).
      // Otherwise a failed-then-toasted action locks the modal forever with
      // every close path held — recoverable only by reload. On success the
      // parent unmounts us, making these safe no-ops.
      clearTimeout(confirmTimeoutRef.current)
      confirmingRef.current = false
      setIsConfirming(false)
    }
  }, [onConfirm])

  // Sync with Android back gesture
  useAndroidBackHandler(isOpen, handleClose, 'confirm_modal')

  useEffect(() => {
    if (!isOpen) return
    // Fresh open owns fresh timers: a previous exit's stale timer (still
    // pending if the modal was re-opened within 220ms, e.g. bulk deletes)
    // would otherwise fire the NEW modal's onCancel and briefly deaden its
    // Cancel/backdrop while pending.
    clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
    clearTimeout(confirmTimeoutRef.current)
    setIsExiting(false)
    setIsConfirming(false)
    setConfirmError('')
    confirmingRef.current = false
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // Closed while an exit was pending: drop the stale timer so it can
      // never fire into the next open.
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [isOpen, handleClose])

  if (!isOpen) return null

  const isDanger = type === 'danger'

  return (
    <div 
      onClick={handleClose}
      className={`fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm ${isExiting ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-surface-variant flex flex-col gap-4 text-center ${isExiting ? 'animate-springScaleOut' : 'animate-springScaleIn'}`}
      >
        <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-primary/10 text-primary'}`}>
          <span className="material-symbols-outlined text-2xl">
            {isDanger ? 'warning' : 'help_outline'}
          </span>
        </div>

        <div>
          <h3 className="font-headline-lg text-lg font-bold text-on-surface mb-1">{title}</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">{message}</p>
          {confirmError && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
              {confirmError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleClose}
            disabled={isConfirming}
            className="w-full bg-surface-container-high text-on-surface hover:bg-surface-variant py-2.5 px-4 rounded-xl text-xs font-semibold border border-surface-variant transition-colors hover-glow-ring disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirming}
            className={`w-full text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-md transition-all hover-glow-ring flex items-center justify-center gap-2 disabled:opacity-70 ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-container'
            }`}
          >
            {isConfirming && (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
