import React, { useState, useEffect } from 'react'
import { getRAGStatus } from '../utils/syncRAG'

export function Header({
  activeView,
  setActiveView,
  user,
  userLocationName,
  locationStatus = 'loading', // 'success' | 'approx' | 'error' | 'loading'
  onDetectLocation,
  onOpenSignIn,
  onRefreshProducts,
  refreshing,
  lastSyncedAt,
  dealAlertsActive = false,
  onToggleDealAlerts
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000)
    return () => clearInterval(timer)
  }, [])

  const syncRAG = getRAGStatus(lastSyncedAt)
  const getAvatarUrl = (userObj) => {
    if (userObj?.photoURL) return userObj.photoURL
    const name = encodeURIComponent(userObj?.displayName || userObj?.email || 'User')
    return `https://ui-avatars.com/api/?name=${name}&background=9c3e20&color=ffffff&bold=true`
  }

  return (
    <>
      {/* 📱 Mobile TopAppBar - Clean Linear/Apple Minimal Chrome */}
      <header className="md:hidden bg-surface/90 apple-frosted w-full z-20 flex items-center justify-between px-3 h-14 border-b border-surface-variant/40 sticky top-0 pt-[env(safe-area-inset-top,0px)]">
        {/* Brand Logo & Location Pill */}
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <div
            onClick={() => setActiveView('discover')}
            className="flex items-center gap-1 cursor-pointer flex-shrink-0 active:scale-95 transition-transform"
          >
            <img 
              src="/logo.svg" 
              alt="LocalFind" 
              className="w-7 h-7 rounded-full object-contain flex-shrink-0" 
            />
          </div>

          {/* Location Chip with Status Dot */}
          <button
            onClick={onDetectLocation}
            className="flex items-center gap-1.5 min-w-0 py-1 px-2 rounded-full hover:bg-surface-variant/50 active:scale-95 transition-all border border-surface-variant/50 bg-surface-container-high/70 flex-1 max-w-[140px] xs:max-w-[180px] sm:max-w-[220px]"
            title={
              locationStatus === 'gps' || locationStatus === 'success'
                ? '🛰️ Live Satellite GPS Active'
                : locationStatus === 'manual'
                ? '📍 Locked Manual Area'
                : locationStatus === 'approx'
                ? '⚠️ Approximate IP / Network Location (Tap to enter your exact area)'
                : 'Tap to change location'
            }
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              locationStatus === 'gps' || locationStatus === 'success'
                ? 'bg-emerald-500 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.8)]'
                : locationStatus === 'manual'
                ? 'bg-primary'
                : locationStatus === 'approx'
                ? 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]'
                : locationStatus === 'error'
                ? 'bg-rose-500'
                : 'bg-zinc-400 animate-pulse'
            }`}></span>
            <span className="text-[10px] xs:text-[11px] font-bold text-on-surface truncate">
              {userLocationName || 'Select Area'}
            </span>
            <span className="material-symbols-outlined text-[13px] text-on-surface-variant/60 flex-shrink-0">expand_more</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {onToggleDealAlerts && (
            <button
              onClick={onToggleDealAlerts}
              title={dealAlertsActive ? 'Deal Alerts Active' : 'Enable Deal Alerts'}
              className={`p-1.5 rounded-full border transition-all active:scale-90 flex items-center justify-center ${
                dealAlertsActive
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-surface-container-high/60 text-on-surface-variant border-surface-variant/40 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {dealAlertsActive ? 'notifications_active' : 'notifications'}
              </span>
            </button>
          )}

          {onRefreshProducts && (
            <button
              onClick={onRefreshProducts}
              disabled={refreshing}
              title={`Sync status: ${syncRAG.tooltip} (Last synced: ${syncRAG.label})`}
              className="p-1.5 rounded-full border border-surface-variant/40 bg-surface-container-high/60 text-on-surface-variant hover:text-on-surface transition-all active:scale-90"
            >
              <span className={`material-symbols-outlined text-[16px] ${refreshing ? 'animate-spin text-primary' : ''}`}>
                sync
              </span>
            </button>
          )}

          {user ? (
            <button
              onClick={() => setActiveView('merchant')}
              className="flex items-center gap-1 bg-primary text-on-primary px-2.5 py-1 rounded-full text-xs font-bold shadow-crisp-xs active:scale-95 transition-all"
            >
              <img
                src={getAvatarUrl(user)}
                alt="Seller"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=User&background=9c3e20&color=fff`
                }}
                className="w-4 h-4 rounded-full object-cover"
              />
              <span className="text-[11px]">Shop</span>
            </button>
          ) : (
            <button
              onClick={onOpenSignIn}
              className="bg-primary text-on-primary px-2.5 py-1 rounded-full text-[11px] font-bold shadow-crisp-xs flex items-center gap-1 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[13px]">storefront</span>
              <span>Sell</span>
            </button>
          )}
        </div>
      </header>

      {/* 💻 Desktop TopAppBar - Minimalist Apple / Linear Structured Chrome */}
      <header className="hidden md:flex bg-surface/90 apple-frosted w-full z-30 items-center justify-between px-8 py-3 border-b border-surface-variant/40 sticky top-0">
        {/* Left: Clean Brand Logo + Location */}
        <div className="flex items-center gap-5">
          <div
            onClick={() => setActiveView('discover')}
            className="flex items-center gap-2 cursor-pointer group select-none"
          >
            <img src="/logo.svg" alt="LocalFind Logo" className="w-8 h-8 rounded-full object-contain group-hover:scale-105 transition-transform" />
            <div className="flex items-center gap-2">
              <span className="font-display-lg text-xl font-black text-primary tracking-tight">
                LocalFind
              </span>
              <span className="text-[10px] font-extrabold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 tracking-wider">
                BY NAKSH
              </span>
            </div>
          </div>

          {/* Minimalist Location Selector Pill */}
          <button
            onClick={onDetectLocation}
            className="flex items-center gap-2 bg-surface-container-high/60 hover:bg-surface-container-high border border-surface-variant/50 hover:border-primary/40 rounded-full px-3.5 py-1.5 text-xs text-on-surface transition-all active:scale-95 group"
            title={
              locationStatus === 'gps' || locationStatus === 'success'
                ? '🛰️ Live Satellite GPS Active (Click to change)'
                : locationStatus === 'manual'
                ? '📍 Locked Manual Area (Click to change)'
                : locationStatus === 'approx'
                ? '⚠️ Approximate IP / Network Location (Click to enter your exact Pin Code & Area)'
                : 'Click to change your area or pin code'
            }
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              locationStatus === 'gps' || locationStatus === 'success'
                ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                : locationStatus === 'manual'
                ? 'bg-primary'
                : locationStatus === 'approx'
                ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] ring-2 ring-amber-500/20'
                : locationStatus === 'error'
                ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                : 'bg-zinc-400 animate-pulse'
            }`}></span>
            <span className="font-medium text-on-surface-variant">Location:</span>
            <span className="font-bold text-on-surface max-w-[180px] truncate">{userLocationName}</span>
            {locationStatus === 'approx' && (
              <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                Approx
              </span>
            )}
            <span className="material-symbols-outlined text-sm text-on-surface-variant/70 group-hover:text-primary transition-colors">
              expand_more
            </span>
          </button>
        </div>

        {/* Center: Apple-style Segmented View Tabs */}
        <div className="flex items-center bg-surface-container-high/70 p-1 rounded-full border border-surface-variant/50">
          <button
            onClick={() => setActiveView('discover')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeView === 'discover'
                ? 'bg-surface text-primary font-bold shadow-crisp-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">explore</span>
            <span>Explore Nearby</span>
          </button>

          <button
            onClick={() => setActiveView('merchant')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeView === 'merchant'
                ? 'bg-surface text-primary font-bold shadow-crisp-xs'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">storefront</span>
            <span>Shopkeeper Portal</span>
          </button>
        </div>

        {/* Right: Clean Action Utilities & User Avatar */}
        <div className="flex items-center gap-2.5">
          {/* Deal Alerts Icon Toggle */}
          {onToggleDealAlerts && (
            <button
              onClick={onToggleDealAlerts}
              title={dealAlertsActive ? 'Deal Alerts Active (Tap to mute)' : 'Turn on Local Flash Deal Alerts'}
              className={`p-2 rounded-full border transition-all active:scale-95 flex items-center justify-center ${
                dealAlertsActive
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  : 'bg-surface-container-high/60 text-on-surface-variant border-surface-variant/40 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {dealAlertsActive ? 'notifications_active' : 'notifications'}
              </span>
            </button>
          )}

          {/* Sync Button */}
          {onRefreshProducts && (
            <button
              onClick={onRefreshProducts}
              disabled={refreshing}
              title={`Sync status: ${syncRAG.tooltip} (Last synced: ${syncRAG.label})`}
              className="p-2 rounded-full border border-surface-variant/40 bg-surface-container-high/60 text-on-surface-variant hover:text-on-surface transition-all active:scale-95"
            >
              <span className={`material-symbols-outlined text-lg ${refreshing ? 'animate-spin text-primary' : ''}`}>
                sync
              </span>
            </button>
          )}

          {/* Profile / Sign In */}
          {user ? (
            <div className="flex items-center gap-2 pl-2 border-l border-surface-variant/50">
              <img
                src={getAvatarUrl(user)}
                alt="Account"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=User&background=9c3e20&color=fff`
                }}
                className="w-8 h-8 rounded-full object-cover border border-surface-variant/60"
              />
              <span className="text-xs font-semibold text-on-surface max-w-[120px] truncate">
                {user.displayName || user.email?.split('@')[0]}
              </span>
            </div>
          ) : (
            <button
              onClick={onOpenSignIn}
              className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-crisp-xs active:scale-95 flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">account_circle</span>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>
    </>
  )
}
