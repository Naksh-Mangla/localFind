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
