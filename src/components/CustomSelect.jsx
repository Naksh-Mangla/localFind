import React, { useState, useRef, useEffect } from 'react'

export function CustomSelect({ options = [], value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusIndex, setFocusIndex] = useState(-1)
  const ref = useRef(null)
  const triggerRef = useRef(null)

  const selectedIndex = Math.max(0, options.findIndex((opt) => opt.value === value))

  const closeAndRefocus = () => {
    setIsOpen(false)
    setFocusIndex(-1)
    // Focus falls to body when the open menu unmounts — return it.
    triggerRef.current?.focus()
  }

  const selectAt = (idx) => {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value)
    closeAndRefocus()
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false)
        setFocusIndex(-1)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Roving focus follows keyboard navigation inside the open listbox.
  useEffect(() => {
    if (!isOpen || focusIndex < 0) return
    ref.current?.querySelector(`[data-opt-index="${focusIndex}"]`)?.focus()
  }, [isOpen, focusIndex])

  const selectedOption = options[selectedIndex] || options[0]

  const handleTriggerKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsOpen(true)
      setFocusIndex(e.key === 'ArrowUp' ? options.length - 1 : selectedIndex)
    }
  }

  const handleListKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeAndRefocus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusIndex((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusIndex((i) => (i - 1 + options.length) % options.length)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setFocusIndex(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setFocusIndex(options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectAt(focusIndex)
    } else if (e.key === 'Tab') {
      setIsOpen(false)
      setFocusIndex(-1)
    } else if (e.key.length === 1) {
      // Type-ahead: jump to the next option starting with the typed letter.
      const ch = e.key.toLowerCase()
      const start = (focusIndex + 1) % options.length
      for (let n = 0; n < options.length; n++) {
        const idx = (start + n) % options.length
        if (options[idx].label?.toLowerCase().startsWith(ch)) {
          setFocusIndex(idx)
          break
        }
      }
    }
  }

  return (
    <div className="relative w-full" ref={ref}>
      {label && <label className="block text-xs font-bold text-on-surface mb-1">{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setIsOpen((o) => !o)
          setFocusIndex(selectedIndex)
        }}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label ? `${label} ${selectedOption?.label || value}` : `Select ${selectedOption?.label || value}`}
        className="w-full bg-surface-container-high border border-surface-variant rounded-xl p-3 text-sm flex items-center justify-between text-on-surface focus:ring-1 focus:ring-primary transition-all shadow-sm"
      >
        <span className="font-medium text-xs sm:text-sm">{selectedOption?.label || value}</span>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {isOpen && (
        <div role="listbox" aria-label={label || 'Options'} onKeyDown={handleListKeyDown} className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-surface rounded-xl border border-surface-variant shadow-2xl py-1 overflow-hidden animate-fadeIn">
          {options.map((opt, idx) => {
            const isSelected = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-opt-index={idx}
                tabIndex={-1}
                onClick={() => selectAt(idx)}
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
