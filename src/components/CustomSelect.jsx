import React, { useState, useRef, useEffect } from 'react'

export function CustomSelect({ options = [], value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find((opt) => opt.value === value) || options[0]

  return (
    <div className="relative w-full" ref={ref}>
      {label && <label className="block text-xs font-bold text-on-surface mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm flex items-center justify-between text-on-surface focus:ring-1 focus:ring-primary transition-all shadow-sm"
      >
        <span className="font-medium text-xs sm:text-sm">{selectedOption?.label || value}</span>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-surface rounded-xl border border-surface-variant shadow-2xl py-1 overflow-hidden animate-fadeIn">
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-on-surface hover:bg-surface-container-high'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <span className="material-symbols-outlined text-sm text-primary">check</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
