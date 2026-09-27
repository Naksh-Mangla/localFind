import React, { useState } from 'react'
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
  const [hoverRating, setHoverRating] = useState(0)

  // Explicit pixel sizes for vector SVG stars to ensure crispness on all screens
  const sizeMap = {
    sm: { size: 16, stroke: 1.5 },
    md: { size: 22, stroke: 1.5 },
    lg: { size: 32, stroke: 1.5 },
    xl: { size: 40, stroke: 1.5 }
  }

  const currentSize = sizeMap[size] || sizeMap.md
  const activeRating = interactive && hoverRating > 0 ? hoverRating : Number(rating) || 0

  return (
    <div className="inline-flex items-center gap-1.5 select-none" role="group" aria-label="Rating">
      <div 
        className="flex items-center gap-1"
        onMouseLeave={() => {
          if (interactive) setHoverRating(0)
        }}
      >
        {Array.from({ length: maxStars }, (_, i) => {
          const starIndex = i + 1
          const isFull = activeRating >= starIndex
          const isHalf = !isFull && activeRating >= starIndex - 0.5
          const starId = `star-grad-${starIndex}-${Math.random().toString(36).substring(2, 7)}`

          if (interactive) {
            return (
              <button
                key={starIndex}
                type="button"
                onClick={() => {
                  triggerHaptic('selection')
                  if (onChange) onChange(starIndex)
                }}
                onMouseEnter={() => setHoverRating(starIndex)}
                className={`p-1.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-150 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/40 touch-manipulation active:scale-90 ${
                  isFull 
                    ? 'text-amber-500 scale-105' 
                    : 'text-slate-300 dark:text-slate-600 hover:text-amber-400 hover:scale-110'
                }`}
                aria-label={`${starIndex} star${starIndex > 1 ? 's' : ''}`}
              >
                <svg
                  width={currentSize.size}
                  height={currentSize.size}
                  viewBox="0 0 24 24"
                  fill={isFull ? '#f59e0b' : 'transparent'}
                  stroke={isFull ? '#d97706' : '#94a3b8'}
                  strokeWidth={currentSize.stroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-transform duration-150 ${isFull ? 'drop-shadow-[0_2px_6px_rgba(245,158,11,0.5)]' : ''}`}
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )
          }

          return (
            <span
              key={starIndex}
              className="inline-flex items-center justify-center"
              title={`${rating} / 5`}
            >
              <svg
                width={currentSize.size}
                height={currentSize.size}
                viewBox="0 0 24 24"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={currentSize.stroke}
                className={isFull || isHalf ? 'drop-shadow-[0_1px_3px_rgba(245,158,11,0.4)]' : ''}
              >
                {isHalf ? (
                  <>
                    <defs>
                      <linearGradient id={starId}>
                        <stop offset="50%" stopColor="#f59e0b" />
                        <stop offset="50%" stopColor="transparent" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon
                      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                      fill={`url(#${starId})`}
                      stroke="#f59e0b"
                    />
                  </>
                ) : (
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    fill={isFull ? '#f59e0b' : 'transparent'}
                    stroke={isFull ? '#d97706' : '#cbd5e1'}
                  />
                )}
              </svg>
            </span>
          )
        })}
      </div>

      {showValue && (
        <span className="font-bold text-xs text-amber-600 dark:text-amber-400 ml-0.5">
          {rating ? Number(rating).toFixed(1) : '0.0'}
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
