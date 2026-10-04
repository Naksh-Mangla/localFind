import React from 'react'

/**
 * 🦴 SkeletonCard — Apple-polish shimmer placeholder that mirrors
 * the exact ProductCard layout so the grid doesn't "jump" when
 * real data loads in.
 */
export const SkeletonCard = React.memo(function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      className="bg-surface-container-lowest rounded-2xl sm:rounded-3xl border border-surface-variant/30 overflow-hidden flex flex-col"
    >
      {/* Image placeholder */}
      <div className="w-full aspect-square skeleton-bone" />

      {/* Content body */}
      <div className="p-2.5 sm:p-4 flex flex-col gap-2">
        {/* Title */}
        <div className="h-4 skeleton-bone w-3/4 rounded-md" />

        {/* Shop name + status row */}
        <div className="flex items-center justify-between gap-2">
          <div className="h-3 skeleton-bone w-1/2 rounded-md" />
          <div className="h-3 skeleton-bone w-14 rounded-full" />
        </div>

        {/* Badge row */}
        <div className="flex items-center gap-1.5">
          <div className="h-4 skeleton-bone w-12 rounded-full" />
          <div className="h-4 skeleton-bone w-10 rounded-full" />
        </div>

        {/* Price & button row */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-variant/20 mt-auto">
          <div className="h-5 skeleton-bone w-16 rounded-md" />
          <div className="h-7 skeleton-bone w-14 rounded-xl" />
        </div>
      </div>
    </div>
  )
})

/**
 * Renders a grid of skeleton cards for loading state.
 * @param {number} count - Number of skeleton cards to show (default 8)
 */
export function SkeletonGrid({ count = 8 }) {
  // Breakpoints mirror the real product grid exactly
  // (grid-cols-2 md:grid-cols-3 lg:grid-cols-4) so the layout
  // never shifts a column when data arrives.
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
