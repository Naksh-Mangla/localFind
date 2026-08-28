import { useState, useEffect, useCallback } from 'react'
import { triggerHaptic } from '../utils/haptics'

/**
 * Hook to manage PWA Installation on Android and supported browsers.
 * Captures `beforeinstallprompt` and triggers native Android APK-style installation.
 */
export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if running as a standalone PWA or Android TWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://')

    if (isStandalone) {
      setIsInstalled(true)
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevent default mini-infobar on Android Chrome
      e.preventDefault()
      setInstallPrompt(e)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
      triggerHaptic('success')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return false
    triggerHaptic('medium')
    try {
      installPrompt.prompt()
      const choiceResult = await installPrompt.userChoice
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true)
        triggerHaptic('success')
      }
      setInstallPrompt(null)
      return choiceResult.outcome === 'accepted'
    } catch (err) {
      console.warn('PWA Install prompt error:', err)
      return false
    }
  }, [installPrompt])

  return {
    canInstall: Boolean(installPrompt) && !isInstalled,
    isInstalled,
    promptInstall
  }
}
