/**
 * Haptic feedback utility optimized for Android & mobile devices.
 * Uses the Web Vibration API with safe fallback for unsupported environments.
 */

export function triggerHaptic(type = 'light') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.vibrate) {
    return
  }

  try {
    switch (type) {
      case 'light':
        // Short subtle tap (e.g. tab switch, filter toggle)
        navigator.vibrate(10)
        break
      case 'medium':
        // Standard button press (e.g. open modal, click action)
        navigator.vibrate(22)
        break
      case 'heavy':
        // Prominent action (e.g. publish product, order trigger)
        navigator.vibrate(40)
        break
      case 'success':
        // Success celebration pattern (e.g. deal activated, saved)
        navigator.vibrate([15, 45, 25])
        break
      case 'warning':
        // Warning pattern (e.g. error, stock alert)
        navigator.vibrate([30, 40, 30])
        break
      case 'selection':
        // Micro click (e.g. scrolling dropdown, category select)
        navigator.vibrate(8)
        break
      default:
        navigator.vibrate(15)
    }
  } catch (e) {
    // Graceful silent ignore if blocked by browser permissions
  }
}
