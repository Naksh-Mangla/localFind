import React, { useState, useEffect, useRef } from 'react'

/**
 * 🍎 ViewTransition — Direction-aware cross-fade wrapper.
 *
 * Tracks the order of views so it can slide "forward" (right)
 * when navigating deeper and "backward" (left) when returning.
 * Falls back to a simple fade for unknown transitions.
 *
 * Usage:
 *   <ViewTransition viewKey={activeView} viewOrder={['discover','merchant','admin']}>
 *     {content}
 *   </ViewTransition>
 */
const TRANSITION_MS = 280

export function ViewTransition({ viewKey, viewOrder = [], children }) {
  const [displayedKey, setDisplayedKey] = useState(viewKey)
  const [animClass, setAnimClass] = useState('animate-fadeIn')
  const prevKeyRef = useRef(viewKey)
  const timerRef = useRef(null)
  // viewOrder is passed as an inline literal by callers (new identity every
  // render). Reading it via ref keeps the effect keyed on viewKey only, so a
  // parent re-render mid-exit can't cancel the pending swap and strand the UI.
  // Assigned in an effect (not during render) per React guidance.
  const orderRef = useRef(viewOrder)
  useEffect(() => {
    orderRef.current = viewOrder
  })

  // Reduced-motion is read at mount and re-read on every view change, so
  // toggling the OS setting mid-session takes effect on next navigate.
  const prefersReducedRef = useRef(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )

  useEffect(() => {
    prefersReducedRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

    // Rapid back-and-forth (A→B→A within the exit window): the pending swap
    // was cancelled by cleanup, so displayedKey already equals viewKey — but
    // animClass may still hold the exit class (ends at opacity: 0). Re-enter
    // instead of stranding the UI faded out until next navigation.
    if (viewKey === prevKeyRef.current) {
      setAnimClass('animate-fadeIn')
      return
    }

    // Reduced motion: swap content synchronously, no exit wait, no classes.
    if (prefersReducedRef.current) {
      setDisplayedKey(viewKey)
      setAnimClass('')
      prevKeyRef.current = viewKey
      return
    }

    // Determine direction: forward (slide right) or backward (slide left).
    // Unknown views (indexOf → -1, e.g. a stale ?view= link) fade instead of
    // sliding the wrong way: direction is meaningless off the known order.
    const order = orderRef.current || []
    const prevIdx = order.indexOf(prevKeyRef.current)
    const nextIdx = order.indexOf(viewKey)

    const isUnknown = prevIdx === -1 || nextIdx === -1
    const isForward = nextIdx > prevIdx
    const exitClass = isUnknown ? 'animate-fadeOut' : isForward ? 'animate-slideOutLeft' : 'animate-slideOutRight'
    const enterClass = isUnknown ? 'animate-fadeIn' : isForward ? 'animate-slideInRight' : 'animate-slideInLeft'

    // Phase 1: exit current view
    setAnimClass(exitClass)

    // Phase 2: after exit animation ends, swap content + enter
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDisplayedKey(viewKey)
      setAnimClass(enterClass)
      prevKeyRef.current = viewKey
    }, TRANSITION_MS - 60) // slightly less than exit duration for snappiness

    return () => clearTimeout(timerRef.current)
  }, [viewKey])

  // Unmount safety: never swap content after unmount.
  useEffect(() => () => clearTimeout(timerRef.current), [])

  // Respect reduced-motion: no animation class (swap was already synchronous).
  const prefersReduced = prefersReducedRef.current

  return (
    <div
      className={prefersReduced ? '' : animClass}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Render children keyed to the *displayed* view so content doesn't flash */}
      {typeof children === 'function' ? children(displayedKey) : children}
    </div>
  )
}
