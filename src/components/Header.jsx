import React from 'react'

export function Header({
  activeView,
  setActiveView,
  user,
  userLocationName,
  onDetectLocation,
  onOpenSignIn
}) {
  const getAvatarUrl = (userObj) => {
    if (userObj?.photoURL) return userObj.photoURL
    const name = encodeURIComponent(userObj?.displayName || userObj?.email || 'Merchant')
    return `https://ui-avatars.com/api/?name=${name}&background=9c3e20&color=ffffff&bold=true`
  }

  return (
    <>
      {/* Mobile TopAppBar */}
      <header class="md:hidden bg-surface/90 backdrop-blur-md shadow-sm fixed top-0 w-full z-50 flex items-center justify-between px-container-margin h-16">
        <div class="flex items-center gap-2 cursor-pointer" onClick={onDetectLocation}>
          <span class="material-symbols-outlined text-primary text-2xl">location_on</span>
          <div class="flex flex-col">
            <span class="font-label-caps text-[10px] text-on-surface-variant uppercase tracking-wider">YOUR LOCATION</span>
            <span class="font-title-md text-sm text-on-surface line-clamp-1">{userLocationName || 'Detecting Location...'}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          {user ? (
            <button
              onClick={() => setActiveView('merchant')}
              class="flex items-center gap-2 bg-primary-container text-on-primary-container px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm"
            >
              <img
                src={getAvatarUrl(user)}
                alt={user.displayName || 'Seller'}
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=9c3e20&color=fff`
                }}
                class="w-6 h-6 rounded-full object-cover border border-white/40"
              />
              <span>Shop Dashboard</span>
            </button>
          ) : (
            <button
              onClick={onOpenSignIn}
              class="bg-primary text-on-primary px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm flex items-center gap-1.5"
            >
              <span class="material-symbols-outlined text-base">account_circle</span>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </header>

      {/* Desktop TopAppBar */}
      <header class="hidden md:flex bg-surface/90 backdrop-blur-md shadow-sm fixed top-0 w-full z-50 items-center justify-between px-container-margin h-20">
        <div class="flex items-center gap-8">
          <h1
            onClick={() => setActiveView('discover')}
            class="font-display-lg text-3xl font-bold text-primary tracking-tight cursor-pointer"
          >
            LocalFind
          </h1>
          <button
            onClick={onDetectLocation}
            class="flex items-center gap-2 bg-surface-container-high hover:bg-surface-variant transition-colors rounded-full px-4 py-2 text-left"
          >
            <span class="material-symbols-outlined text-primary">location_on</span>
            <span class="font-title-md text-sm text-on-surface">{userLocationName || 'Detect Location'}</span>
            <span class="material-symbols-outlined text-on-surface-variant text-sm">my_location</span>
          </button>
        </div>

        <nav class="flex items-center gap-4">
          <button
            onClick={() => setActiveView('discover')}
            class={`font-title-md text-base flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeView === 'discover'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-variant/60'
            }`}
          >
            <span class="material-symbols-outlined">explore</span>
            <span>Explore Nearby</span>
          </button>

          <button
            onClick={() => setActiveView('merchant')}
            class={`font-title-md text-base flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              activeView === 'merchant'
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-variant/60'
            }`}
          >
            <span class="material-symbols-outlined">storefront</span>
            <span>Shopkeeper Portal</span>
          </button>

          {user ? (
            <div class="flex items-center gap-3 ml-4 pl-4 border-l border-surface-variant">
              <img
                src={getAvatarUrl(user)}
                alt={user.displayName || 'Merchant'}
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=9c3e20&color=fff`
                }}
                class="w-10 h-10 rounded-full object-cover shadow-sm border border-surface-variant"
              />
              <div class="flex flex-col text-left">
                <span class="text-xs font-semibold text-on-surface">{user.displayName || 'Merchant Account'}</span>
                <span class="text-[10px] text-on-surface-variant">{user.email}</span>
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenSignIn}
              class="ml-2 bg-secondary text-on-secondary hover:bg-secondary/90 px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center gap-2"
            >
              <span class="material-symbols-outlined text-lg">account_circle</span>
              <span>Merchant Sign In</span>
            </button>
          )}
        </nav>
      </header>
    </>
  )
}
