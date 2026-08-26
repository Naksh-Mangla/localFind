/**
 * Safely parses any date/timestamp into a Unix millisecond timestamp.
 * Handles ISO 8601 strings, SQLite 'YYYY-MM-DD HH:MM:SS', Unix epoch seconds/ms, and Safari edge cases.
 * @param {string|number|Date} timestamp
 * @returns {number|null}
 */
export function parseTimestamp(timestamp) {
  if (!timestamp) return null
  if (typeof timestamp === 'number') {
    return timestamp < 1e11 ? timestamp * 1000 : timestamp
  }
  if (typeof timestamp === 'string') {
    const trimmed = timestamp.trim()
    // If numeric string (e.g. "1724245200000")
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed)
      return num < 1e11 ? num * 1000 : num
    }
    // Normalize SQLite timestamps (e.g. "2026-08-21 14:30:00") for Safari/iOS compatibility
    let cleanStr = trimmed
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(cleanStr)) {
      cleanStr = cleanStr.replace(' ', 'T')
      if (!cleanStr.endsWith('Z') && !cleanStr.includes('+')) {
        cleanStr += 'Z'
      }
    }
    const parsed = new Date(cleanStr).getTime()
    return isNaN(parsed) ? null : parsed
  }
  if (timestamp instanceof Date) {
    const parsed = timestamp.getTime()
    return isNaN(parsed) ? null : parsed
  }
  return null
}

/**
 * Calculates human-readable relative time and RAG status for timestamps
 * RAG Status Rules:
 * - Green: < 1 day (Fresh)
 * - Amber/Yellow: 1 to 7 days
 * - Red: > 7 days (Needs Attention / Stale)
 * @param {string|number|Date} timestamp
 * @returns {{status: 'green'|'amber'|'red', label: string, colorClass: string, dotClass: string, textClass: string, tooltip: string}}
 */
export function getRAGStatus(timestamp) {
  const dateMs = parseTimestamp(timestamp)

  if (!dateMs) {
    return {
      status: 'green',
      label: 'Just now',
      colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      tooltip: 'Real-time updated'
    }
  }

  const now = Date.now()
  // Handle slight client/server clock skews
  const diffMs = Math.max(0, now - dateMs)
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Human-readable relative time format
  let label = 'Just now'
  if (diffMinutes < 1) {
    label = 'Just now'
  } else if (diffMinutes < 60) {
    label = `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    label = `${diffHours}h ago`
  } else if (diffDays === 1) {
    label = '1 day ago'
  } else if (diffDays < 7) {
    label = `${diffDays} days ago`
  } else if (diffDays < 30) {
    label = `${Math.floor(diffDays / 7)}w ago`
  } else {
    label = `${Math.floor(diffDays / 30)}mo ago`
  }

  // RAG Freshness Logic:
  // < 1 day (< 24 hours) => Green (Fresh)
  // 1 to 7 days => Amber / Yellow (Moderate)
  // > 7 days => Red (Stale)
  if (diffDays < 1) {
    return {
      status: 'green',
      label,
      colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      tooltip: 'Synced within 24 hours (Fresh & In-Stock)'
    }
  } else if (diffDays >= 1 && diffDays <= 7) {
    return {
      status: 'amber',
      label,
      colorClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
      dotClass: 'bg-amber-500',
      textClass: 'text-amber-600 dark:text-amber-400',
      tooltip: 'Synced 1-7 days ago (Moderate)'
    }
  } else {
    return {
      status: 'red',
      label,
      colorClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
      dotClass: 'bg-rose-500',
      textClass: 'text-rose-600 dark:text-rose-400',
      tooltip: 'Synced over a week ago (Needs Stock Confirmation)'
    }
  }
}
