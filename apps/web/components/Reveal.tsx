'use client'

import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Scroll-triggered reveal wrapper. Pure presentational — wrap any block
 * in <Reveal variant="up"> and it animates in once when it enters view.
 *
 * Inspired by Framer-built marketing sites (Kendal.ai, Linear, Vercel).
 * Uses framer-motion's whileInView so we don't manually wire up
 * IntersectionObserver — same effect, 5 lines of code instead of 50.
 *
 * Variants:
 *   up     — fade + slide up 30px (default; use for most sections)
 *   left   — fade + slide in from the left (use for "text" half of split layouts)
 *   right  — fade + slide in from the right (use for "image/mock" half)
 *   scale  — fade + grow from 92% (use for stat cards and hero mocks)
 *   fade   — opacity only (use for logo strips, subtle elements)
 *
 * Stagger:
 *   When `stagger` is true, the wrapper becomes a stagger parent and any
 *   direct children that are themselves <Reveal> render with a stepped
 *   delay (40ms each by default). Use for card grids.
 */
type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'fade'

const variantMap: Record<RevealVariant, Variants> = {
  up: {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.94 },
    visible: { opacity: 1, scale: 1 },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
}

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

export function Reveal({
  variant = 'up',
  delay = 0,
  duration = 0.6,
  stagger = false,
  as: Component = 'div',
  className,
  children,
}: {
  variant?: RevealVariant
  delay?: number
  duration?: number
  stagger?: boolean
  /** Render as a different element (e.g. 'section') so we don't pollute the DOM with extra divs */
  as?: 'div' | 'section' | 'article' | 'ul' | 'li' | 'header' | 'footer'
  className?: string
  children: ReactNode
}) {
  // Stagger parents don't animate their own appearance — they exist to
  // sequence their children. We still apply whileInView so the cascade
  // starts when the parent is on-screen.
  if (stagger) {
    const MotionComponent = motion[Component] as typeof motion.div
    return (
      <MotionComponent
        className={className}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        variants={staggerContainer}
      >
        {children}
      </MotionComponent>
    )
  }

  const MotionComponent = motion[Component] as typeof motion.div
  return (
    <MotionComponent
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={variantMap[variant]}
      transition={{
        duration,
        delay,
        ease: [0.22, 0.61, 0.36, 1], // ease-out-quart — feels Framer-y
      }}
    >
      {children}
    </MotionComponent>
  )
}
