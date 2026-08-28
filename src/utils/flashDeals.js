import { useState, useEffect } from 'react'

/**
 * Calculates live flash deal countdown and discounted pricing
 */
export function getFlashDealInfo(product) {
  try {
    if (!product || !product.is_flash_deal || !product.flash_deal_ends_at) {
      return { isLive: false }
    }

    const now = Date.now()
    const endTime = new Date(product.flash_deal_ends_at).getTime()
    
    if (!Number.isFinite(endTime)) {
      return { isLive: false }
    }

    const diffMs = endTime - now

    if (diffMs <= 0) {
      return { isLive: false, isExpired: true }
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)

    let countdownText = ''
    if (hours > 0) {
      countdownText = `${hours}h ${minutes}m left`
    } else if (minutes > 0) {
      countdownText = `${minutes}m ${seconds}s left`
    } else {
      countdownText = `${seconds}s left`
    }

    const discountPercent = Number(product.flash_deal_discount) || 10
    const originalPrice = Number(product.price) || 0
    const discountedPrice = Math.round(originalPrice * (1 - discountPercent / 100))
    const savings = originalPrice - discountedPrice

    return {
      isLive: true,
      discountPercent,
      originalPrice,
      discountedPrice,
      savings,
      countdownText,
      hours,
      minutes,
      seconds
    }
  } catch (err) {
    console.warn('Error computing flash deal info:', err)
    return { isLive: false }
  }
}

// ⚡ Global Singleton Tick Subscriber (1 timer for the entire app, 0 timer storms on mobile)
const subscribers = new Set()
let timerId = null

function subscribe(callback) {
  subscribers.add(callback)
  if (!timerId && subscribers.size > 0) {
    timerId = setInterval(() => {
      // Pause ticking when tab is backgrounded to save Android battery
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      subscribers.forEach((cb) => cb())
    }, 1000)
  }
  return () => {
    subscribers.delete(callback)
    if (subscribers.size === 0 && timerId) {
      clearInterval(timerId)
      timerId = null
    }
  }
}

/**
 * High-performance React hook for deal countdowns.
 * Uses a single shared timer across all cards on screen with visibility-based battery pausing.
 */
export function useFlashDeal(product) {
  const [info, setInfo] = useState(() => getFlashDealInfo(product))

  useEffect(() => {
    if (!product?.is_flash_deal || !product?.flash_deal_ends_at) {
      setInfo({ isLive: false })
      return
    }
    // Update immediately on prop change
    setInfo(getFlashDealInfo(product))

    // Subscribe to shared 1s ticker
    const unsubscribe = subscribe(() => {
      setInfo(getFlashDealInfo(product))
    })

    return unsubscribe
  }, [product?.is_flash_deal, product?.flash_deal_ends_at, product?.price, product?.flash_deal_discount])

  return info
}
