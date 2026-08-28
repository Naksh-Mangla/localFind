import React, { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { useAndroidBackHandler } from '../hooks/useAndroidBackHandler'
import { triggerHaptic } from '../utils/haptics'

// Cross-browser Android Canvas rounded rect polyfill
function drawRoundedRect(ctx, x, y, width, height, radius = 0) {
  const r = typeof radius === 'number' ? radius : Array.isArray(radius) ? radius[0] : 0
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, [r])
  } else {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }
}

export function StoreQRStandeeModal({ shop = {}, products = [], onClose }) {
  // Sync with Android back gesture
  useAndroidBackHandler(Boolean(shop), onClose, 'qr_standee')

  const [qrDataUrl, setQrDataUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [generatingDownload, setGeneratingDownload] = useState(false)
  const standeeCardRef = useRef(null)

  const shopId = shop?.id || shop?.shop_id || ''
  const shopUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?shopId=${shopId}`
    : `https://localfind.pages.dev/?shopId=${shopId}`

  // Generate crisp QR code on mount
  useEffect(() => {
    if (!shopId) return
    QRCode.toDataURL(shopUrl, {
      width: 600,
      margin: 1,
      color: {
        dark: '#1d1d1f',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR Generation failed:', err))
  }, [shopId, shopUrl])

  // Copy Direct Link to Clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shopUrl)
      setCopied(true)
      triggerHaptic('success')
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.warn('Clipboard write failed:', err)
    }
  }

  // Native Print Trigger
  const handlePrint = () => {
    triggerHaptic('medium')
    window.print()
  }

  // High-Resolution 1200x1600 PNG Download Generator
  const handleDownloadPNG = async () => {
    if (!qrDataUrl || !shop) return
    setGeneratingDownload(true)
    triggerHaptic('medium')

    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas 2D context unavailable')

      const width = 1200
      const height = 1600
      canvas.width = width
      canvas.height = height

      // 1. Background Gradient & Canvas Base
      const bgGrad = ctx.createLinearGradient(0, 0, width, height)
      bgGrad.addColorStop(0, '#ffffff')
      bgGrad.addColorStop(0.5, '#fffbf7')
      bgGrad.addColorStop(1, '#fef5ee')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // Outer Border
      ctx.strokeStyle = '#e8d8cc'
      ctx.lineWidth = 12
      ctx.strokeRect(30, 30, width - 60, height - 60)

      // 2. Top Header Ribbon (LocalFind Brand)
      const headerGrad = ctx.createLinearGradient(60, 60, width - 60, 220)
      headerGrad.addColorStop(0, '#9c3e20')
      headerGrad.addColorStop(1, '#c85028')
      ctx.fillStyle = headerGrad
      ctx.beginPath()
      drawRoundedRect(ctx, 60, 60, width - 120, 180, 24)
      ctx.fill()

      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.font = 'bold 52px system-ui, -apple-system, sans-serif'
      ctx.fillText('LocalFind', width / 2, 145)

      ctx.font = '600 24px system-ui, -apple-system, sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
      ctx.fillText('✨ SHOP LOCAL • VERIFIED NEIGHBORHOOD STORE', width / 2, 195)

      // 3. Shop Name
      ctx.fillStyle = '#1d1d1f'
      ctx.font = 'bold 64px system-ui, -apple-system, sans-serif'
      const displayShopName = shop?.shop_name || 'My Local Store'
      ctx.fillText(displayShopName, width / 2, 330)

      // 4. Shop Address / Location
      ctx.fillStyle = '#71717a'
      ctx.font = '500 28px system-ui, -apple-system, sans-serif'
      const displayAddress = shop?.address_text || 'Local Market Area'
      // Truncate address if too long
      const truncatedAddr = displayAddress.length > 55 ? displayAddress.substring(0, 52) + '...' : displayAddress
      ctx.fillText(`📍 ${truncatedAddr}`, width / 2, 385)

      // 5. QR Code Box with Double Frame
      const qrBoxSize = 580
      const qrBoxX = (width - qrBoxSize) / 2
      const qrBoxY = 460

      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 32)
      ctx.fill()
      ctx.strokeStyle = '#9c3e20'
      ctx.lineWidth = 6
      ctx.stroke()

      // Draw QR Image onto Canvas
      const qrImg = new Image()
      qrImg.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        qrImg.onload = () => {
          ctx.drawImage(qrImg, qrBoxX + 30, qrBoxY + 30, qrBoxSize - 60, qrBoxSize - 60)
          resolve()
        }
        qrImg.onerror = reject
        qrImg.src = qrDataUrl
      })

      // 6. Action Callout Box
      ctx.fillStyle = '#fff4ed'
      ctx.beginPath()
      drawRoundedRect(ctx, 100, 1090, width - 200, 260, 24)
      ctx.fill()
      ctx.strokeStyle = '#f4c7ab'
      ctx.lineWidth = 3
      ctx.stroke()

      ctx.fillStyle = '#9c3e20'
      ctx.font = 'bold 38px system-ui, -apple-system, sans-serif'
      ctx.fillText('📱 SCAN WITH PHONE CAMERA', width / 2, 1165)

      ctx.fillStyle = '#27272a'
      ctx.font = '600 30px system-ui, -apple-system, sans-serif'
      ctx.fillText("Browse Today's Counter Prices & Flash Deals", width / 2, 1225)

      ctx.fillStyle = '#059669'
      ctx.font = 'bold 26px system-ui, -apple-system, sans-serif'
      ctx.fillText('💬 Direct WhatsApp Order & Fast Pickup', width / 2, 1285)

      // 7. Footer
      ctx.fillStyle = '#a1a1aa'
      ctx.font = '500 22px system-ui, -apple-system, sans-serif'
      ctx.fillText('Supported by LocalFind Hyperlocal Platform • Crafted by NAKSH', width / 2, 1490)

      // 8. Trigger File Download
      const pngUrl = canvas.toDataURL('image/png')
      const downloadAnchor = document.createElement('a')
      const safeName = (shop?.shop_name || 'Store').replace(/[^a-zA-Z0-9]/g, '_')
      downloadAnchor.download = `${safeName}_Store_QR_Standee.png`
      downloadAnchor.href = pngUrl
      document.body.appendChild(downloadAnchor)
      downloadAnchor.click()
      document.body.removeChild(downloadAnchor)
    } catch (err) {
      console.error('Failed to generate standee PNG:', err)
      alert('Could not download image. Please use the Print option.')
    } finally {
      setGeneratingDownload(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      {/* Container Dialog */}
      <div className="bg-surface apple-frosted border border-surface-variant/80 rounded-3xl shadow-crisp-xl w-full max-w-lg overflow-hidden my-auto animate-popIn">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-surface-variant/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">qr_code_scanner</span>
            <div>
              <h3 className="font-title-md text-base font-bold text-on-surface">Store Counter QR Standee</h3>
              <p className="text-[11px] text-on-surface-variant">Place on your billing counter for walk-in shoppers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-surface-variant/70 text-on-surface-variant transition-colors active:scale-90"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Standee Preview Card (Printable Target) */}
        <div className="p-4 sm:p-6 bg-surface-container-lowest/60 max-h-[62vh] overflow-y-auto hide-scrollbar">
          <div
            ref={standeeCardRef}
            id="printable-standee"
            className="bg-gradient-to-b from-white via-amber-50/20 to-orange-50/30 text-zinc-900 border-2 border-amber-200/80 rounded-3xl p-5 sm:p-6 shadow-md text-center flex flex-col items-center relative overflow-hidden"
          >
            {/* Top Brand Banner */}
            <div className="w-full bg-gradient-to-r from-primary to-orange-600 text-white py-2.5 px-4 rounded-2xl mb-4 shadow-sm">
              <span className="font-display-lg text-lg font-black tracking-tight block">LocalFind</span>
              <span className="text-[9px] font-bold opacity-90 tracking-wider uppercase block">
                ✨ Verified Neighborhood Store
              </span>
            </div>

            {/* Shop Details */}
            <h2 className="font-headline-lg text-xl sm:text-2xl font-black text-zinc-900 leading-tight mb-1">
              {shop?.shop_name || 'My Local Store'}
            </h2>
            <p className="text-xs text-zinc-600 font-medium mb-4 line-clamp-1 max-w-[280px]">
              📍 {shop?.address_text || 'Local Area'}
            </p>

            {/* High-Resolution QR Box */}
            <div className="bg-white p-3 rounded-3xl border-2 border-primary shadow-inner mb-4 relative group">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${shop?.shop_name || 'Store'}`}
                  className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
                />
              ) : (
                <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                  <span className="material-symbols-outlined animate-spin text-2xl text-primary">sync</span>
                </div>
              )}
            </div>

            {/* Instruction Callout Box */}
            <div className="w-full bg-orange-500/10 border border-orange-500/25 rounded-2xl p-3 mb-3 text-center">
              <span className="text-[11px] font-black text-primary uppercase tracking-wider block mb-0.5">
                📱 SCAN WITH CAMERA
              </span>
              <p className="text-xs font-bold text-zinc-800 leading-snug">
                Browse Today's Counter Prices & Flash Deals
              </p>
              <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                💬 Direct WhatsApp Orders & Pickup
              </span>
            </div>

            {/* Standee Footer */}
            <div className="text-[9px] text-zinc-400 font-semibold tracking-wide">
              Supported by LocalFind • Crafted by NAKSH
            </div>
          </div>
        </div>

        {/* Modal Action Controls */}
        <div className="p-4 sm:p-5 border-t border-surface-variant/50 bg-surface flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrint}
              className="bg-primary hover:bg-primary/90 text-on-primary py-2.5 px-4 rounded-full text-xs font-bold transition-all shadow-crisp-xs flex items-center justify-center gap-1.5 active:scale-95 border border-white/20"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>Print Standee</span>
            </button>

            <button
              onClick={handleDownloadPNG}
              disabled={generatingDownload}
              className="bg-surface-container-high hover:bg-surface-variant text-on-surface py-2.5 px-4 rounded-full text-xs font-bold transition-all border border-surface-variant/70 flex items-center justify-center gap-1.5 shadow-crisp-xs active:scale-95"
            >
              <span className="material-symbols-outlined text-base text-primary">
                {generatingDownload ? 'sync' : 'download'}
              </span>
              <span>{generatingDownload ? 'Saving...' : 'Download PNG'}</span>
            </button>
          </div>

          {/* Copy Direct Shop Link */}
          <button
            onClick={handleCopyLink}
            className="w-full bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface py-2 px-3 rounded-full text-[11px] font-semibold border border-surface-variant/40 flex items-center justify-center gap-1.5 transition-all active:scale-98"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check_circle' : 'link'}
            </span>
            <span className="truncate max-w-[280px]">
              {copied ? 'Link Copied to Clipboard!' : shopUrl}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default StoreQRStandeeModal
