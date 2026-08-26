/**
 * Local Flash Deal Notification & Alert Manager
 * Powered by standard Web Notifications API with 0 external fees.
 */

const NOTIFIED_DEALS_KEY = 'localfind_notified_deals'
const ALERTS_ENABLED_KEY = 'localfind_deal_alerts_enabled'

/**
 * Check if the browser supports standard Web Notifications
 */
export function isNotificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

/**
 * Get current browser notification permission
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export function getNotificationPermission() {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Check if the user has enabled deal alerts
 */
export function isDealAlertsEnabled() {
  if (!isNotificationSupported()) return false
  const enabled = localStorage.getItem(ALERTS_ENABLED_KEY) === 'true'
  return enabled && Notification.permission === 'granted'
}

/**
 * Request notification permission and enable deal alerts
 * @returns {Promise<boolean>} true if enabled successfully
 */
export async function enableDealAlerts() {
  if (!isNotificationSupported()) {
    alert('Web Notifications are not supported on this browser.')
    return false
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      localStorage.setItem(ALERTS_ENABLED_KEY, 'true')
      
      // Send a welcome confirmation test notification
      sendLocalNotification({
        title: '⚡ Local Flash Deal Alerts Active!',
        body: 'You will get notified whenever nearby shops launch 24-hr discounts.',
        tag: 'localfind-welcome-alert'
      })
      return true
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
 * Send a browser push notification
 */
export function sendLocalNotification({ title, body, icon = '/logo.svg', tag, data = {} }) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return null

  try {
    const notification = new Notification(title, {
      body,
      icon,
      badge: icon,
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
  } catch (err) {
    console.warn('Failed to dispatch notification:', err)
    return null
  }
}

/**
 * Scans products and notifies user of any new nearby flash deals
 */
export function checkAndNotifyNewDeals(products = [], userCoords = null) {
  if (!isDealAlertsEnabled() || !Array.isArray(products) || products.length === 0) {
    return
  }

  try {
    const now = Date.now()
    const notifiedIds = JSON.parse(localStorage.getItem(NOTIFIED_DEALS_KEY) || '[]')
    const notifiedSet = new Set(notifiedIds)

    // Filter active flash deals
    const activeDeals = products.filter((p) => {
      if (!p.is_flash_deal || !p.flash_deal_ends_at) return false
      const endTime = new Date(p.flash_deal_ends_at).getTime()
      return Number.isFinite(endTime) && endTime > now
    })

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

      // Update notified set
      newDealsToNotify.forEach((d) => notifiedSet.add(d.id))
      // Keep only recent 50 IDs in storage
      const updatedList = Array.from(notifiedSet).slice(-50)
      localStorage.setItem(NOTIFIED_DEALS_KEY, JSON.stringify(updatedList))
    }
  } catch (err) {
    console.warn('Error checking deal notifications:', err)
  }
}
