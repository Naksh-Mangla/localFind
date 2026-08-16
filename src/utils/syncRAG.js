/**
 * Calculates human-readable relative time and RAG status for timestamps
 * RAG Status Rules:
 * - Green: < 1 day (Fresh)
 * - Amber/Yellow: 1 to 7 days
 * - Red: > 7 days (Needs Attention / Stale)
 */
export function getRAGStatus(timestamp) {
  if (!timestamp) {
    return {
      status: 'green',
      label: 'Just now',
      colorClass: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
      tooltip: 'Real-time updated'
    }
  }

  const now = Date.now()
  const date = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()
  const diffMs = Math.max(0, now - date)
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Time format
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

  // RAG Logic:
  // < 1 day (< 24 hours) => Green
  // 1 to 7 days => Amber / Yellow
  // > 7 days => Red
  if (diffDays < 1) {
    return {
      status: 'green',
      label,
      colorClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-600 dark:text-emerald-400',
      tooltip: 'Synced within 24 hours (Fresh)'
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
      tooltip: 'Synced over a week ago (Stale)'
    }
  }
}
