'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'

export function PublicMotionProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  )
}
