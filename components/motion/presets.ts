import type { Variants } from 'motion/react'

export const staggerVariants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.065,
    },
  },
} satisfies Variants

export const revealVariants = {
  hidden: { opacity: 0.96, y: 9 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
} satisfies Variants
