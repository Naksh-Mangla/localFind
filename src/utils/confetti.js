/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  LOCALFIND — ZERO-DEPENDENCY CANVAS CONFETTI
 * ═══════════════════════════════════════════════════════════════════════════
 *  Lightweight (0 external packages, 60fps) celebratory confetti burst for
 *  milestone level-ups and reward moments.
 */

export function fireMilestoneConfetti(durationMs = 2500) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  // Respect users who asked the OS to minimize motion: skip the animation
  // entirely (the milestone toast still confirms the achievement).
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  } catch {}

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '99999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  let width = (canvas.width = window.innerWidth * (window.devicePixelRatio || 1))
  let height = (canvas.height = window.innerHeight * (window.devicePixelRatio || 1))

  const colors = [
    '#f59e0b', // Amber / Gold
    '#10b981', // Emerald / Green
    '#3b82f6', // Blue
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#f43f5e', // Rose
    '#06b6d4', // Cyan
  ]

  const particleCount = 70
  const particles = Array.from({ length: particleCount }, () => ({
    x: width / 2 + (Math.random() - 0.5) * (width * 0.4),
    y: height * 0.35 + (Math.random() - 0.5) * 50,
    vx: (Math.random() - 0.5) * 14 * (window.devicePixelRatio || 1),
    vy: (Math.random() * -12 - 4) * (window.devicePixelRatio || 1),
    size: (Math.random() * 8 + 4) * (window.devicePixelRatio || 1),
    color: colors[Math.floor(Math.random() * colors.length)],
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 12,
    gravity: 0.35 * (window.devicePixelRatio || 1),
    opacity: 1,
    wobble: Math.random() * 10,
    wobbleSpeed: Math.random() * 0.1 + 0.05,
    shape: Math.random() > 0.4 ? 'rect' : 'circle',
  }))

  const startTime = Date.now()
  let animationFrameId

  const render = () => {
    const elapsed = Date.now() - startTime
    const progress = elapsed / durationMs

    if (progress >= 1) {
      if (canvas.parentNode) canvas.remove()
      return
    }

    ctx.clearRect(0, 0, width, height)

    particles.forEach((p) => {
      p.x += p.vx + Math.sin(p.wobble) * 1.5
      p.y += p.vy
      p.vy += p.gravity
      p.wobble += p.wobbleSpeed
      p.rotation += p.rotationSpeed
      p.opacity = Math.max(0, 1 - progress)

      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color

      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.restore()
    })

    animationFrameId = requestAnimationFrame(render)
  }

  animationFrameId = requestAnimationFrame(render)

  // Keep the canvas full-viewport if the screen rotates mid-burst
  const handleResize = () => {
    width = canvas.width = window.innerWidth * (window.devicePixelRatio || 1)
    height = canvas.height = window.innerHeight * (window.devicePixelRatio || 1)
  }
  window.addEventListener('resize', handleResize)

  // Auto clean-up timer
  setTimeout(() => {
    cancelAnimationFrame(animationFrameId)
    window.removeEventListener('resize', handleResize)
    if (canvas.parentNode) canvas.remove()
  }, durationMs + 200)
}
