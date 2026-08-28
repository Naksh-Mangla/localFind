import React, { useEffect } from 'react'
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
  // Sync with Android back gesture
  useAndroidBackHandler(isOpen, onCancel, 'confirm_modal')
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isDanger = type === 'danger'

  return (
    <div 
      onClick={onCancel}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-surface rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-surface-variant flex flex-col gap-4 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 mx-auto flex items-center justify-center">
          <span className="material-symbols-outlined text-2xl">
            {isDanger ? 'warning' : 'help_outline'}
          </span>
        </div>

        <div>
          <h3 className="font-headline-lg text-lg font-bold text-on-surface mb-1">{title}</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">{message}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onCancel}
            className="w-full bg-surface-container-high text-on-surface hover:bg-surface-variant py-2.5 px-4 rounded-xl text-xs font-semibold border border-surface-variant transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`w-full text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-md transition-all ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-primary-container'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
