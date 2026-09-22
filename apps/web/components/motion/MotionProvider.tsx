'use client';

import { MotionConfig } from 'motion/react';

/** Wires `prefers-reduced-motion` into every motion.* usage in the app. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
