import { useEffect, useRef } from 'react'

/**
 * Syncs an open modal with browser history so that the
 * Android hardware / swipe-back gesture closes the modal instead of navigating away.
 * @param {boolean} isOpen - Whether the modal/overlay is currently visible
 * @param {() => void} onClose - Callback to close the modal
 * @param {string} modalKey - Unique key for the modal state
 */
export function useAndroidBackHandler(isOpen, onClose, modalKey = 'modal') {
  const pushedRef = useRef(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) {
      pushedRef.current = false
      return
    }

    const stateKey = `localfind_modal_${modalKey}`
    // Push dummy history entry when modal opens
    window.history.pushState({ [stateKey]: true, localfindModal: true }, '')
    pushedRef.current = true

    const handlePopState = (e) => {
      if (pushedRef.current) {
        pushedRef.current = false
        if (onCloseRef.current) {
          onCloseRef.current()
        }
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
}
