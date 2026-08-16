/**
 * Calculates whether a store is currently open or closed based on opening_time and closing_time (HH:MM in 24h format)
 */
export function getStoreOpenStatus(openingTime, closingTime) {
  const openT = openingTime || '09:00'
  const closeT = closingTime || '21:00'

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [openH, openM] = openT.split(':').map(Number)
  const [closeH, closeM] = closeT.split(':').map(Number)

  const openMinutes = (Number.isFinite(openH) ? openH : 9) * 60 + (Number.isFinite(openM) ? openM : 0)
  const closeMinutes = (Number.isFinite(closeH) ? closeH : 21) * 60 + (Number.isFinite(closeM) ? closeM : 0)

  // Format 12-hour AM/PM string for display
  const formatTime12h = (h, m) => {
    const validH = Number.isFinite(h) ? h : 9
    const validM = Number.isFinite(m) ? m : 0
    const period = validH >= 12 ? 'PM' : 'AM'
    const h12 = validH % 12 || 12
    const mStr = validM > 0 ? `:${validM < 10 ? '0' + validM : validM}` : ''
    return `${h12}${mStr} ${period}`
  }

  const openStr = formatTime12h(openH, openM)
  const closeStr = formatTime12h(closeH, closeM)

  // Check if store is open 24 hours (or same open/close times)
  if (openingTime === closingTime) {
    return {
      isOpen: true,
      label: 'Open 24 Hours',
      detail: 'Open all day and night',
      timingText: 'Open 24 Hours',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    }
  }

  let isOpen = false
  if (closeMinutes > openMinutes) {
    // Regular daytime hours (e.g. 09:00 to 21:00)
    isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes
  } else {
    // Overnight hours (e.g. 20:00 to 02:00)
    isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes
  }

  const timingText = `${openStr} – ${closeStr}`

  if (isOpen) {
    return {
      isOpen: true,
      label: 'Open Now',
      detail: `Closes at ${closeStr}`,
      timingText: timingText,
      badgeLabel: `Open Now • ${timingText}`,
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    }
  } else {
    return {
      isOpen: false,
      label: 'Closed',
      detail: `Opens at ${openStr}`,
      timingText: timingText,
      badgeLabel: `Closed • ${timingText}`,
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
      dotClass: 'bg-rose-500',
      textColor: 'text-rose-600 dark:text-rose-400'
    }
  }
}
