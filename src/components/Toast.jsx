import React, { useEffect } from 'react'

export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      onClose()
    }, 4500)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  const isError = toast.type === 'error'
  const isSuccess = toast.type === 'success'

  const iconName = isError ? 'error' : isSuccess ? 'check_circle' : 'info'
  const iconColor = isError ? 'text-red-500' : isSuccess ? 'text-emerald-500' : 'text-primary'
  const borderColor = isError ? 'border-red-500/30' : isSuccess ? 'border-emerald-500/30' : 'border-primary/30'

  return (
    <div className="fixed top-20 right-4 left-4 sm:left-auto sm:right-6 z-50 max-w-md w-full animate-fadeIn">
      <div className={`bg-surface/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border ${borderColor} flex items-start gap-3 text-on-surface`}>
        <div className={`p-1.5 rounded-xl bg-surface-container-high ${iconColor} flex items-center justify-center shrink-0`}>
          <span className="material-symbols-outlined text-xl">{iconName}</span>
        </div>
        <div className="flex-1 pr-2">
          {toast.title && <h4 className="font-title-md text-sm font-bold text-on-surface">{toast.title}</h4>}
          <p className="text-xs text-on-surface-variant font-medium whitespace-pre-line leading-relaxed">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-on-surface-variant hover:bg-surface-variant transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  )
}
