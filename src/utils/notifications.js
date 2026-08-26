/**
 * Local Flash Deal Notification & Alert Manager
 * Robust multi-platform Web Notifications API with Service Worker fallback.
 */

const NOTIFIED_DEALS_KEY = 'localfind_notified_deals'
const ALERTS_ENABLED_KEY = 'localfind_deal_alerts_enabled'
const SUBSCRIBED_AT_KEY = 'localfind_deal_alerts_subscribed_at'

/**
 * Check if the browser supports standard Web Notifications
 */
export function isNotificationSupported() {
  return typeof window !== 'undefined' && ('Notification' in window || ('serviceWorker' in navigator && 'PushManager' in window))
}

/**
 * Get current browser notification permission
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function getNotificationPermission() {
  if (!isNotificationSupported() || typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * Check if the user has enabled deal alerts
 */
export function isDealAlertsEnabled() {
  if (!isNotificationSupported() || typeof Notification === 'undefined') return false
  const enabled = localStorage.getItem(ALERTS_ENABLED_KEY) === 'true'
  return enabled && Notification.permission === 'granted'
}

/**
 * Request notification permission and enable deal alerts
 * Seeds all existing deals so the user only gets notified for FUTURE deals from this exact moment onward.
 * @param {Array} currentProducts - currently loaded products to baseline
 * @returns {Promise<boolean>} true if enabled successfully
 */
export async function enableDealAlerts(currentProducts = []) {
  if (!isNotificationSupported()) {
    alert('💡 Web Notifications are not supported on this browser.\n(If on iPhone Safari, tap "Share" → "Add to Home Screen" to enable notifications).')
    return false
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
    alert('⚠️ Notifications are currently blocked in your browser.\n\nTo enable:\n1. Tap the Lock (🔒) or Tune icon in your browser URL address bar.\n2. Set "Notifications" to "Allow".\n3. Tap the bell icon again.')
    return false
  }

  try {
    let permission = 'default'
    if (typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
      permission = await Notification.requestPermission()
    }

    if (permission === 'granted') {
      const now = Date.now()
      localStorage.setItem(ALERTS_ENABLED_KEY, 'true')
      localStorage.setItem(SUBSCRIBED_AT_KEY, String(now))
      
      // Baseline all current active deals so they don't immediately trigger
      if (Array.isArray(currentProducts) && currentProducts.length > 0) {
        const existingLiveDealIds = currentProducts
          .filter((p) => p.is_flash_deal && p.flash_deal_ends_at)
          .map((p) => p.id)
        localStorage.setItem(NOTIFIED_DEALS_KEY, JSON.stringify(existingLiveDealIds))
      } else {
        localStorage.setItem(NOTIFIED_DEALS_KEY, JSON.stringify([]))
      }

      // Send a welcome test notification
      await sendLocalNotification({
        title: '⚡ Local Flash Deal Alerts Active!',
        body: 'You will receive instant alerts when local shops launch 24-hr discounts.',
        tag: 'localfind-welcome-alert'
      })
      return true
    } else if (permission === 'denied') {
      localStorage.setItem(ALERTS_ENABLED_KEY, 'false')
      alert('⚠️ Notifications were not allowed. You can enable them anytime from your browser site settings.')
      return false
    } else {
      localStorage.setItem(ALERTS_ENABLED_KEY, 'false')
      return false
    }
  } catch (err) {
    console.warn('Notification permission request error:', err)
    return false
  }
}

/**
 * Disable deal alerts
 */
export function disableDealAlerts() {
  try {
    localStorage.setItem(ALERTS_ENABLED_KEY, 'false')
  } catch {}
}

/**
 * Send a browser push notification (with ServiceWorker & window.Notification support)
 */
export async function sendLocalNotification({ title, body, icon = '/icon-192.png', tag, data = {} }) {
  if (!isNotificationSupported() || (typeof Notification !== 'undefined' && Notification.permission !== 'granted')) {
    return null
  }

  // Resolve absolute URL for Android Chrome & mobile web push notification handlers
  const resolvedIcon = typeof window !== 'undefined' ? new URL(icon, window.location.origin).href : icon

  try {
    // 1. Try Service Worker showNotification (Mandatory for Android Chrome & mobile PWAs)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration && typeof registration.showNotification === 'function') {
          return await registration.showNotification(title, {
            body,
            icon: resolvedIcon,
            badge: resolvedIcon,
            tag: tag || 'localfind-deal',
            data,
            renotify: true,
            silent: false
          })
        }
      } catch (swErr) {
        console.warn('ServiceWorker showNotification attempt:', swErr)
      }
    }

    // 2. Fallback to desktop window.Notification constructor
    if (typeof Notification !== 'undefined') {
      const notification = new Notification(title, {
        body,
        icon: resolvedIcon,
        badge: resolvedIcon,
        tag: tag || 'localfind-deal',
        data,
        renotify: true,
        silent: false
      })

      notification.onclick = function (e) {
        e.preventDefault()
        window.focus()
        if (data?.productId) {
          window.dispatchEvent(new CustomEvent('openProductDetail', { detail: { productId: data.productId } }))
        }
        notification.close()
      }

      return notification
    }
    return null
  } catch (err) {
    console.warn('Failed to dispatch notification:', err)
    return null
  }
}

/**
 * Scans products and notifies user ONLY of new nearby flash deals launched AFTER subscription
 */
export function checkAndNotifyNewDeals(products = [], userCoords = null) {
  if (!isDealAlertsEnabled() || !Array.isArray(products) || products.length === 0) {
    return
  }

  try {
    const now = Date.now()
    const notifiedIds = JSON.parse(localStorage.getItem(NOTIFIED_DEALS_KEY) || '[]')
    const notifiedSet = new Set(notifiedIds)

    // Filter active flash deals that are currently live
    const activeDeals = products.filter((p) => {
      if (!p.is_flash_deal || !p.flash_deal_ends_at) return false
      const endTime = new Date(p.flash_deal_ends_at).getTime()
      return Number.isFinite(endTime) && endTime > now
    })

    // Only consider deals that have NOT yet been notified
    const newDealsToNotify = activeDeals.filter((deal) => !notifiedSet.has(deal.id))

    if (newDealsToNotify.length > 0) {
      // Pick the highest discount deal to notify
      const topDeal = newDealsToNotify[0]
      const discount = topDeal.flash_deal_discount || 20
      const shopName = topDeal.shop_name || 'Local Shop'
      const prodName = topDeal.name || 'Special Offer'
      const price = topDeal.price ? `₹${Math.round(topDeal.price * (1 - discount / 100))}` : 'Deal Price'

      sendLocalNotification({
        title: `⚡ ${discount}% OFF at ${shopName}!`,
        body: `${prodName} is now ${price} on Flash Deal! Tap to claim before offer ends.`,
        tag: `flash-${topDeal.id}`,
        data: { productId: topDeal.id }
      })

      // Update notified set so this deal won't notify again
      newDealsToNotify.forEach((d) => notifiedSet.add(d.id))
      // Keep only recent 50 IDs in storage
      const updatedList = Array.from(notifiedSet).slice(-50)
      localStorage.setItem(NOTIFIED_DEALS_KEY, JSON.stringify(updatedList))
    }
  } catch (err) {
    console.warn('Error checking deal notifications:', err)
  }
}
