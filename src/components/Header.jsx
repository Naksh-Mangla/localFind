import React from 'react'
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
      {/* Mobile TopAppBar */}
      <header className="md:hidden bg-surface/95 backdrop-blur-md shadow-sm fixed top-0 w-full z-50 flex items-center justify-between px-3 h-16 border-b border-surface-variant/40">
        {/* Left: Brand logo & Location bar */}
        <div
          className="flex items-center gap-2.5 cursor-pointer max-w-[65%] overflow-hidden"
          onClick={onDetectLocation}
          title="Tap to refresh location"
        >
          <img src="/logo.svg" alt="LocalFind Logo" className="w-8 h-8 rounded-xl shadow-xs object-contain flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 leading-none mb-1">
              <span className={`w-2 h-2 rounded-full ${statusColors.dotColor} animate-pulse flex-shrink-0`}></span>
              <span className="text-[9px] font-bold text-on-surface-variant tracking-wider uppercase truncate">
                LOCATION
              </span>
              <span className="text-[8px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 px-1 py-0.2 rounded border border-amber-500/30 flex-shrink-0">
                NAKSH
              </span>
            </div>
            <span className="font-title-md text-xs font-semibold text-on-surface truncate">
              {userLocationName || 'Detecting Location...'}
            </span>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {onRefreshProducts && (
            <button
              onClick={onRefreshProducts}
              disabled={refreshing}
              title={`Sync status: ${syncRAG.tooltip} (Last synced: ${syncRAG.label})`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold border shadow-xs transition-all active:scale-90 hover:brightness-105 ${syncRAG.colorClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${syncRAG.dotClass} ${refreshing ? 'animate-ping' : ''}`}></span>
              <span className={`material-symbols-outlined text-[14px] ${refreshing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span className="truncate max-w-[65px]">{refreshing ? 'Syncing...' : syncRAG.label}</span>
            </button>
          )}

          {user ? (
            <button
              onClick={() => setActiveView('merchant')}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-on-primary px-3 py-1.5 rounded-full text-xs font-bold shadow-sm active:scale-95 transition-all border border-white/20"
            >
              <img
                src={getAvatarUrl(user)}
                alt={user.displayName || 'Seller'}
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=9c3e20&color=fff`
                }}
                className="w-5 h-5 rounded-full object-cover border border-white/40"
              />
              <span className="text-[11px] font-semibold whitespace-nowrap">Dashboard</span>
            </button>
          ) : (
            <button
              onClick={onOpenSignIn}
              className="bg-primary hover:bg-primary/90 text-on-primary px-3 py-1.5 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition-all border border-white/20"
            >
              <span className="material-symbols-outlined text-sm">storefront</span>
              <span className="text-[11px] font-semibold">Become Seller</span>
            </button>
          )}
        </div>
      </header>

      {/* Desktop TopAppBar */}
      <header className="hidden md:flex bg-surface/90 backdrop-blur-md shadow-xs fixed top-0 w-full z-50 items-center justify-between px-container-margin h-20 border-b border-surface-variant/40">
        <div className="flex items-center gap-5">
          <div
            onClick={() => setActiveView('discover')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <img src="/logo.svg" alt="LocalFind Logo" className="w-9 h-9 rounded-xl shadow-xs object-contain group-hover:scale-105 transition-transform" />
            <div className="flex items-baseline gap-1.5">
              <h1 className="font-display-lg text-2xl font-bold text-primary tracking-tight">
                LocalFind
              </h1>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                v2.0.0
              </span>
              <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 shadow-xs">
                <span className="material-symbols-outlined text-[12px]">code</span>
                <span>Crafted by NAKSH</span>
              </span>
            </div>
          </div>
          <button
            onClick={onDetectLocation}
            className={`flex items-center gap-2.5 border transition-all rounded-full px-4 py-2 text-left hover:shadow-xs active:scale-95 ${statusColors.badgeBg}`}
          >
            <span className={`material-symbols-outlined text-lg ${statusColors.iconColor}`}>location_on</span>
            <div className="flex flex-col">
              <span className="font-label-caps text-[9px] text-on-surface-variant font-bold tracking-wider">YOUR LOCATION</span>
              <span className="font-title-md text-xs font-semibold max-w-[200px] truncate">{userLocationName}</span>
            </div>
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
            className={`font-title-md text-sm flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold active:scale-95 ${
              activeView === 'discover'
                ? 'bg-primary text-on-primary font-bold shadow-sm ring-2 ring-primary/20'
                : 'text-on-surface-variant hover:bg-surface-variant/70 border border-transparent hover:border-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-lg">explore</span>
            <span>Explore Nearby</span>
          </button>

          <button
            onClick={() => setActiveView('merchant')}
            className={`font-title-md text-sm flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-semibold active:scale-95 ${
              activeView === 'merchant'
                ? 'bg-primary text-on-primary font-bold shadow-sm ring-2 ring-primary/20'
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
              className="ml-2 bg-secondary text-on-secondary hover:bg-secondary/90 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 active:scale-95"
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
