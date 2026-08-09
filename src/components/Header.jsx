import React from 'react'

export function Header({
  activeView,
  setActiveView,
  user,
  userLocationName,
  locationStatus = 'loading', // 'success' | 'approx' | 'error' | 'loading'
  onDetectLocation,
  onOpenSignIn,
  onRefreshProducts,
  refreshing
}) {
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
      <header className="md:hidden bg-surface/90 backdrop-blur-md shadow-sm fixed top-0 w-full z-50 flex items-center justify-between px-container-margin h-16">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onDetectLocation}>
          <img src="/logo.svg" alt="LocalFind Logo" className="w-7 h-7 rounded-lg shadow-sm object-contain" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">YOUR LOCATION</span>
              <span className={`w-2 h-2 rounded-full ${statusColors.dotColor} animate-pulse`}></span>
              <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded">v1.9.0</span>
              <span className="text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/30">Built by NAKSH</span>
            </div>
            <span className="font-title-md text-sm text-on-surface line-clamp-1">{userLocationName || 'Detecting Location...'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onRefreshProducts && (
            <button
              onClick={onRefreshProducts}
              disabled={refreshing}
              title="Quickly refresh products"
              className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface hover:bg-surface-variant flex items-center justify-center transition-all active:scale-90 border border-surface-variant"
            >
              <span className={`material-symbols-outlined text-base ${refreshing ? 'animate-spin text-primary' : ''}`}>
                refresh
              </span>
            </button>
          )}

          {user ? (
            <button
              onClick={() => setActiveView('merchant')}
              className="flex items-center gap-2 bg-primary-container text-on-primary-container px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
            >
              <img
                src={getAvatarUrl(user)}
                alt={user.displayName || 'Seller'}
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=9c3e20&color=fff`
                }}
                className="w-6 h-6 rounded-full object-cover border border-white/40"
              />
              <span>Shop Dashboard</span>
            </button>
          ) : (
            <button
              onClick={onOpenSignIn}
              className="bg-primary text-on-primary px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">account_circle</span>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Desktop TopAppBar */}
      <header className="hidden md:flex bg-surface/90 backdrop-blur-md shadow-sm fixed top-0 w-full z-50 items-center justify-between px-container-margin h-20">
        <div className="flex items-center gap-6">
          <div
            onClick={() => setActiveView('discover')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <img src="/logo.svg" alt="LocalFind Logo" className="w-9 h-9 rounded-xl shadow-sm object-contain group-hover:scale-105 transition-transform" />
            <div className="flex items-baseline gap-1.5">
              <h1 className="font-display-lg text-3xl font-bold text-primary tracking-tight">
                LocalFind
              </h1>
              <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                v1.9.0
              </span>
              <span className="text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 shadow-sm">
                <span className="material-symbols-outlined text-[12px]">code</span>
                <span>Crafted by NAKSH</span>
              </span>
            </div>
          </div>
          <button
            onClick={onDetectLocation}
            className={`flex items-center gap-2 border transition-all rounded-full px-4 py-2 text-left ${statusColors.badgeBg}`}
          >
            <span className={`material-symbols-outlined text-lg ${statusColors.iconColor}`}>location_on</span>
            <div className="flex flex-col">
              <span className="font-label-caps text-[10px] text-on-surface-variant font-bold">LOCATION</span>
              <span className="font-title-md text-xs font-semibold max-w-[200px] truncate">{userLocationName}</span>
            </div>
          </button>

          {onRefreshProducts && (
            <button
              onClick={onRefreshProducts}
              disabled={refreshing}
              title="Refresh available products"
              className="flex items-center gap-1.5 bg-surface-container-high hover:bg-surface-variant text-on-surface border border-surface-variant px-3.5 py-2 rounded-full text-xs font-semibold shadow-sm transition-all active:scale-95"
            >
              <span className={`material-symbols-outlined text-base ${refreshing ? 'animate-spin text-primary' : ''}`}>
                refresh
              </span>
              <span>Refresh</span>
            </button>
          )}
        </div>

        <nav className="flex items-center gap-4">
          <button
            onClick={() => setActiveView('discover')}
            className={`font-title-md text-base flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeView === 'discover'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-variant/60'
            }`}
          >
            <span className="material-symbols-outlined">explore</span>
            <span>Explore Nearby</span>
          </button>

          <button
            onClick={() => setActiveView('merchant')}
            className={`font-title-md text-base flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeView === 'merchant'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-variant/60'
            }`}
          >
            <span className="material-symbols-outlined">storefront</span>
            <span>Shopkeeper Portal</span>
          </button>

          {user ? (
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-surface-variant">
              <img
                src={getAvatarUrl(user)}
                alt={user.displayName || 'Merchant'}
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=9c3e20&color=fff`
                }}
                className="w-10 h-10 rounded-full object-cover shadow-sm border border-surface-variant"
              />
              <div className="flex flex-col text-left">
                <span className="text-xs font-semibold text-on-surface">{user.displayName || 'Merchant Account'}</span>
                <span className="text-[10px] text-on-surface-variant">{user.email}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenSignIn}
              className="ml-2 bg-secondary text-on-secondary hover:bg-secondary/90 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
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
