import React from 'react'
import { triggerHaptic } from '../utils/haptics'

export function ReviewStars({
  rating = 0,
  maxStars = 5,
  size = 'md',
  interactive = false,
  onChange = null,
  showValue = false,
  reviewCount = null
}) {
  const sizeClasses = {
    sm: 'text-[13px]',
    md: 'text-[18px]',
    lg: 'text-[26px]',
    xl: 'text-[32px]'
  }

  const starSize = sizeClasses[size] || sizeClasses.md

  return (
    <div className="inline-flex items-center gap-1 select-none">
      <div className="flex items-center">
        {Array.from({ length: maxStars }, (_, i) => {
          const starIndex = i + 1
          const isFilled = rating >= starIndex
          const isHalf = !isFilled && rating >= starIndex - 0.5

          if (interactive) {
            return (
              <button
                key={starIndex}
                type="button"
                onClick={() => {
                  triggerHaptic('selection')
                  if (onChange) onChange(starIndex)
                }}
                className={`p-1 min-w-[44px] min-h-[44px] flex items-center justify-center transition-all cursor-pointer focus:outline-none touch-manipulation active:scale-90 ${
                  isFilled ? 'text-amber-500 hover:scale-125 star-glow' : 'text-surface-variant hover:text-amber-300 hover:scale-110'
                }`}
                aria-label={`${starIndex} star`}
              >
                <span className={`material-symbols-outlined ${starSize} ${isFilled ? 'fill-1' : ''}`}>
                  {isFilled ? 'star' : isHalf ? 'star_half' : 'grade'}
                </span>
              </button>
            )
          }

          return (
            <span
              key={starIndex}
              className={`material-symbols-outlined ${starSize} ${
                isFilled || isHalf ? 'text-amber-500 fill-1' : 'text-surface-variant'
              }`}
            >
              {isFilled ? 'star' : isHalf ? 'star_half' : 'grade'}
            </span>
          )
        })}
      </div>

      {showValue && (
        <span className="font-bold text-xs text-on-surface ml-0.5">
          {rating ? rating.toFixed(1) : '0.0'}
        </span>
      )}

      {reviewCount !== null && reviewCount !== undefined && (
        <span className="text-[11px] text-on-surface-variant font-medium">
          ({reviewCount})
        </span>
      )}
    </div>
  )
}
