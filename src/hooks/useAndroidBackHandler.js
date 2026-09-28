import { useEffect, useRef } from 'react'

/**
 * Syncs an open modal with browser history so that the
 * Android hardware / swipe-back gesture closes the modal instead of navigating away.
 * @param {boolean} isOpen - Whether the modal/overlay is currently visible
 * @param {() => void} onClose - Callback to close the modal
 * @param {string} modalKey - Unique key for the modal state
 * @param {boolean} disabled - When true (mandatory modals like first-run location
 *   setup), the first back press is swallowed (entry re-pushed) so accidental
 *   presses can't dismiss the gate; a second consecutive press is let through so
 *   the user always retains a way out.
 */
export function useAndroidBackHandler(isOpen, onClose, modalKey = 'modal', disabled = false) {
  const pushedRef = useRef(false)
  const trapCountRef = useRef(0)
  const onCloseRef = useRef(onClose)
  const disabledRef = useRef(disabled)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    disabledRef.current = disabled
  }, [disabled])

  useEffect(() => {
    if (!isOpen) {
      pushedRef.current = false
      return
    }

    const stateKey = `localfind_modal_${modalKey}`
    // Push dummy history entry when modal opens
    window.history.pushState({ [stateKey]: true, localfindModal: true }, '')
    pushedRef.current = true
    trapCountRef.current = 0

    const handlePopState = (e) => {
      if (!pushedRef.current) return
      if (disabledRef.current) {
        // Mandatory modal: swallow the FIRST back press (accidental), but let the
        // second consecutive one through so the user is never fully stranded
        // (e.g. GPS denied + offline pincode lookup). Re-push clears forward
        // history, so no stack growth from the swallowed press.
        trapCountRef.current += 1
        if (trapCountRef.current >= 2) {
          pushedRef.current = false
          return
        }
        window.history.pushState({ [stateKey]: true, localfindModal: true }, '')
        return
      }
      // Only close if OUR entry was popped. When nested modals are open,
      // popping the inner entry leaves the outer's state on top — outer must stay open.
      const ourEntryStillOnStack = Boolean(e.state && e.state[stateKey])
      if (ourEntryStillOnStack) return
      pushedRef.current = false
      if (onCloseRef.current) {
        onCloseRef.current()
      }
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // If closed by user clicking close button (not via back button), pop the dummy history entry
      if (pushedRef.current) {
        pushedRef.current = false
        if (window.history.state && window.history.state[stateKey]) {
          window.history.back()
        }
      }
    }
  }, [isOpen, modalKey])
  // NOTE: `disabled` is intentionally NOT a dep — the handler reads it via
  // disabledRef, so toggling mandatory mode while open causes no pop+push churn.
}
