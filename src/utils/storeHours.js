/**
 * Calculates whether a store is currently open or closed based on opening_time and closing_time (HH:MM in 24h format)
 */
export function getStoreOpenStatus(openingTime = '09:00', closingTime = '21:00') {
  if (!openingTime || !closingTime) {
    return {
      isOpen: true,
      label: 'Open Now',
      detail: 'Open today',
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500'
    }
  }

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const [openH, openM] = openingTime.split(':').map(Number)
  const [closeH, closeM] = closingTime.split(':').map(Number)

  const openMinutes = (openH || 9) * 60 + (openM || 0)
  const closeMinutes = (closeH || 21) * 60 + (closeM || 0)

  // Format 12-hour AM/PM string for display
  const formatTime12h = (h, m) => {
    const period = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    const mStr = m > 0 ? `:${m < 10 ? '0' + m : m}` : ''
    return `${h12}${mStr} ${period}`
  }

  const openStr = formatTime12h(openH || 9, openM || 0)
  const closeStr = formatTime12h(closeH || 21, closeM || 0)

  let isOpen = false
  if (closeMinutes > openMinutes) {
    // Regular daytime hours (e.g. 09:00 to 21:00)
    isOpen = currentMinutes >= openMinutes && currentMinutes < closeMinutes
  } else {
    // Overnight hours (e.g. 20:00 to 02:00)
    isOpen = currentMinutes >= openMinutes || currentMinutes < closeMinutes
  }

  if (isOpen) {
    return {
      isOpen: true,
      label: 'Open Now',
      detail: `Closes at ${closeStr}`,
      timingText: `${openStr} – ${closeStr}`,
      badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    }
  } else {
    return {
      isOpen: false,
      label: 'Closed',
      detail: `Opens at ${openStr}`,
      timingText: `${openStr} – ${closeStr}`,
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
      dotClass: 'bg-rose-500',
      textColor: 'text-rose-600 dark:text-rose-400'
    }
  }
}
