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
  lastSyncedAt
}) {
  // Live ticker to keep relative sync time up to date every 10 seconds
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

  // Dynamic status color classes for GPS location indicator
  // Green = success, Orange = approx, Red = cant get / error
  const getStatusColorClasses = () => {
    switch (locationStatus) {
      case 'success':
        return {
          badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
          iconColor: 'text-emerald-500',
          dotColor: 'bg-emerald-500'
        }
      case 'approx':
        return {
          badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400',
          iconColor: 'text-amber-500',
          dotColor: 'bg-amber-500'
        }
      case 'error':
        return {
          badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400',
          iconColor: 'text-rose-500',
          dotColor: 'bg-rose-500'
        }
      default:
        return {
          badgeBg: 'bg-primary/10 border-primary/20 text-primary',
          iconColor: 'text-primary',
          dotColor: 'bg-primary'
        }
    }
  }

  const statusColors = getStatusColorClasses()

  return (
    <>
      {/* Mobile TopAppBar - Apple Frosted Glass Layout */}
      <header className="md:hidden bg-surface/80 apple-frosted shadow-crisp-xs w-full z-20 flex items-center justify-between px-3.5 h-16 border-b border-surface-variant/40 sticky top-0">
        {/* Left: Brand logo & Compact Location Pill */}
        <div className="flex items-center gap-2 max-w-[65%] overflow-hidden">
          <img 
            src="/logo.svg" 
            alt="LocalFind Logo" 
            onClick={() => setActiveView('discover')}
            className="w-8 h-8 rounded-full shadow-crisp-xs object-contain flex-shrink-0 cursor-pointer active:scale-90 transition-transform" 
          />
          <div
            className="flex items-center gap-1.5 min-w-0 cursor-pointer p-1.5 px-3 rounded-full hover:bg-surface-variant/50 active:scale-95 transition-all border border-surface-variant/40 bg-surface-container-low/80"
            onClick={onDetectLocation}
            title="Tap to change location"
          >
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1 leading-none mb-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${statusColors.dotColor} flex-shrink-0 ${locationStatus === 'success' ? 'animate-pulse' : ''}`}></span>
                <span className="text-[8px] font-extrabold text-on-surface-variant tracking-wider uppercase truncate">
                  LOCATION
                </span>
              </div>
              <span className="font-title-md text-[11px] font-bold text-on-surface truncate max-w-[130px] leading-tight">
                {userLocationName || 'Detecting Location...'}
              </span>
            </div>
            <span className="material-symbols-outlined text-[13px] text-on-surface-variant/70 shrink-0">edit</span>
          </div>
        </div>

        {/* Right: Action Buttons (Apple Capsule Pills) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onRefreshProducts && (
            <button
              onClick={onRefreshProducts}
              disabled={refreshing}
              title={`Sync status: ${syncRAG.tooltip} (Last synced: ${syncRAG.label})`}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold border shadow-crisp-xs transition-all active:scale-90 ${syncRAG.colorClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${syncRAG.dotClass} ${refreshing ? 'animate-ping' : ''}`}></span>
              <span className={`material-symbols-outlined text-[13px] ${refreshing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span className="truncate max-w-[50px]">{refreshing ? 'Syncing' : syncRAG.label}</span>
            </button>
          )}

          {user ? (
            <button
              onClick={() => setActiveView('merchant')}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-on-primary px-3.5 py-1.5 rounded-full text-[11px] font-bold shadow-crisp-xs active:scale-95 transition-all border border-white/20"
            >
              <img
                src={getAvatarUrl(user)}
                alt={user.displayName || 'Seller'}
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=9c3e20&color=fff`
                }}
                className="w-4 h-4 rounded-full object-cover border border-white/40"
              />
              <span className="text-[10px] font-bold whitespace-nowrap">Shop</span>
            </button>
          ) : (
            <button
              onClick={onOpenSignIn}
              className="bg-primary hover:bg-primary/90 text-on-primary px-3.5 py-1.5 rounded-full text-[10px] font-bold shadow-crisp-xs flex items-center gap-1 active:scale-95 transition-all border border-white/20"
            >
              <span className="material-symbols-outlined text-[14px]">storefront</span>
              <span className="text-[10px] font-bold">Sell</span>
            </button>
          )}
        </div>
      </header>

      {/* Desktop TopAppBar - Apple Frosted Glass Layout */}
      <header className="hidden md:flex bg-surface/80 apple-frosted shadow-crisp-xs w-full z-30 items-center justify-between px-6 py-3.5 border-b border-surface-variant/40 sticky top-0">
        <div className="flex items-center gap-5">
          <div
            onClick={() => setActiveView('discover')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <img src="/logo.svg" alt="LocalFind Logo" className="w-9 h-9 rounded-full shadow-crisp-xs object-contain group-hover:scale-105 transition-transform" />
            <div className="flex items-baseline gap-1.5">
              <h1 className="font-display-lg text-2xl font-bold text-primary tracking-tight">
                LocalFind
              </h1>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                v2.2.0
              </span>
              <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 shadow-xs">
                <span className="material-symbols-outlined text-[12px]">code</span>
                <span>Crafted by NAKSH</span>
              </span>
            </div>
          </div>
          <button
            onClick={onDetectLocation}
            className={`flex items-center gap-2.5 border transition-all rounded-full px-4 py-2 text-left hover:shadow-xs active:scale-95 group ${statusColors.badgeBg}`}
            title="Click to change your area or pin code"
          >
            <span className={`material-symbols-outlined text-lg ${statusColors.iconColor}`}>location_on</span>
            <div className="flex flex-col">
              <span className="font-label-caps text-[9px] text-on-surface-variant font-bold tracking-wider">YOUR LOCATION</span>
              <span className="font-title-md text-xs font-semibold max-w-[200px] truncate">{userLocationName}</span>
            </div>
            <span className="text-[10px] font-bold bg-surface/80 px-2 py-0.5 rounded-full border border-surface-variant/60 ml-1 text-on-surface-variant group-hover:text-primary transition-colors flex items-center gap-0.5">
              <span className="material-symbols-outlined text-[12px]">edit</span>
              <span>Change</span>
            </span>
          </button>

          {/* Desktop Live Sync Teller with RAG Badge */}
          {onRefreshProducts && (
            <button
              onClick={onRefreshProducts}
              disabled={refreshing}
              title={`Sync status: ${syncRAG.tooltip} (Last synced: ${syncRAG.label})`}
              className={`flex items-center gap-2 border px-3.5 py-2 rounded-full text-xs font-bold shadow-xs transition-all active:scale-95 hover:brightness-105 ${syncRAG.colorClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${syncRAG.dotClass} ${refreshing ? 'animate-ping' : ''}`}></span>
              <span className={`material-symbols-outlined text-base ${refreshing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{refreshing ? 'Syncing...' : `Synced ${syncRAG.label}`}</span>
            </button>
          )}
        </div>

        <nav className="flex items-center gap-3">
          <button
            onClick={() => setActiveView('discover')}
            className={`font-title-md text-sm flex items-center gap-2 px-5 py-2.5 rounded-full transition-all font-semibold active:scale-95 ${
              activeView === 'discover'
                ? 'bg-primary text-on-primary font-bold shadow-crisp-xs ring-2 ring-primary/20 scale-[1.02]'
                : 'text-on-surface-variant hover:bg-surface-variant/70 border border-transparent hover:border-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-lg">explore</span>
            <span>Explore Nearby</span>
          </button>

          <button
            onClick={() => setActiveView('merchant')}
            className={`font-title-md text-sm flex items-center gap-2 px-5 py-2.5 rounded-full transition-all font-semibold active:scale-95 ${
              activeView === 'merchant'
                ? 'bg-primary text-on-primary font-bold shadow-crisp-xs ring-2 ring-primary/20 scale-[1.02]'
                : 'text-on-surface-variant hover:bg-surface-variant/70 border border-transparent hover:border-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-lg">storefront</span>
            <span>Shopkeeper Portal</span>
          </button>

          {user ? (
            <div className="flex items-center gap-3 ml-2 pl-3 border-l border-surface-variant">
              <img
                src={getAvatarUrl(user)}
                alt={user.displayName || 'Merchant'}
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=9c3e20&color=fff`
                }}
                className="w-9 h-9 rounded-full object-cover shadow-xs border border-surface-variant"
              />
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-on-surface leading-tight">{user.displayName || 'Merchant Account'}</span>
                <span className="text-[10px] text-on-surface-variant truncate max-w-[140px]">{user.email}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenSignIn}
              className="ml-2 bg-secondary text-on-secondary hover:bg-secondary/90 px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-crisp-xs flex items-center gap-2 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">account_circle</span>
              <span>Merchant Sign In</span>
            </button>
          )}
        </nav>
      </header>
    </>
  )
}
