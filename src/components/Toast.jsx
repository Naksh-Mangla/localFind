import React, { useEffect, useState, useRef } from 'react'

export function Toast({ toast, onClose }) {
  const [isExiting, setIsExiting] = useState(false)
  const autoTimerRef = useRef(null)
  const closeTimerRef = useRef(null)
  // Track which toast the timers belong to: a replacement toast must never
  // be wiped by the previous toast's stale close timer.
  const toastIdRef = useRef(0)
  // Call sites pass inline arrows (new identity every parent render). Reading
  // onClose via ref keeps the timer effect keyed on `toast` only, so typing
  // in a form or an analytics tick can't restart the 4.2s clock or swallow
  // a manual dismiss landing inside the 260ms exit window.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!toast) return
    // Fresh toast owns fresh timers: a previous toast's exit window may have
    // left closeTimerRef non-null (cleanup clears timeouts, not refs), which
    // would make handleDismiss ignore the first tap on the new toast.
    autoTimerRef.current = null
    closeTimerRef.current = null
    setIsExiting(false)
    const myId = ++toastIdRef.current

    autoTimerRef.current = setTimeout(() => {
      if (toastIdRef.current !== myId) return
      setIsExiting(true)
      // Wait for exit animation to finish before actually closing
      closeTimerRef.current = setTimeout(() => {
        if (toastIdRef.current !== myId) return
        onCloseRef.current()
      }, 260)
    }, 4200)

    return () => {
      clearTimeout(autoTimerRef.current)
      clearTimeout(closeTimerRef.current)
      autoTimerRef.current = null
      closeTimerRef.current = null
    }
  }, [toast])

  // Unmount safety: no setState / onClose after unmount.
  useEffect(() => () => {
    toastIdRef.current += 1
    clearTimeout(autoTimerRef.current)
    clearTimeout(closeTimerRef.current)
  }, [])

  // Render-phase reset (official derived-state pattern): when toast A in its
  // exit animation is replaced by toast B, B would first paint one frame
  // with the stale isExiting=true (exit animation flash) until the effect
  // flips it. Resetting during render commits the correct state immediately.
  const prevToastRef = useRef(toast)
  if (toast !== prevToastRef.current) {
    prevToastRef.current = toast
    setIsExiting(false)
  }

  if (!toast) return null

  const isError = toast.type === 'error'
  const isSuccess = toast.type === 'success'

  const iconName = isError ? 'error' : isSuccess ? 'check_circle' : 'info'
  const iconColor = isError ? 'text-red-500' : isSuccess ? 'text-emerald-500' : 'text-primary'
  const borderColor = isError ? 'border-red-500/30' : isSuccess ? 'border-emerald-500/30' : 'border-primary/30'

  const handleDismiss = () => {
    if (closeTimerRef.current) return // already exiting — no double close
    clearTimeout(autoTimerRef.current) // manual close owns the exit; stop the auto timer so onClose fires once
    setIsExiting(true)
    const myId = toastIdRef.current
    closeTimerRef.current = setTimeout(() => {
      if (toastIdRef.current !== myId) return
      onCloseRef.current()
    }, 260)
  }

  return (
    <div className={`fixed top-[max(1.25rem,env(safe-area-inset-top,0px))] right-4 left-4 sm:left-auto sm:right-6 z-[130] sm:max-w-md w-auto ${isExiting ? 'animate-toast-out' : 'animate-toast-in'}`}>
      <div className={`bg-surface/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border ${borderColor} flex items-start gap-3 text-on-surface`}>
        <div className={`p-1.5 rounded-xl bg-surface-container-high ${iconColor} flex items-center justify-center shrink-0`}>
          <span className="material-symbols-outlined text-xl">{iconName}</span>
        </div>
        <div className="flex-1 pr-2">
          {toast.title && <h4 className="font-title-md text-sm font-bold text-on-surface">{toast.title}</h4>}
          <p className="text-xs text-on-surface-variant font-medium whitespace-pre-line leading-relaxed">{toast.message}</p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="tap-expand p-1 rounded-full text-on-surface-variant hover:bg-surface-variant transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  )
}
