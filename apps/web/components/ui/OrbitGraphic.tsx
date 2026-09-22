'use client';

import { motion } from 'motion/react';

const CENTER = 200;

interface Ring {
  radius: number;
  dashed?: boolean;
  duration: number;
  reverse?: boolean;
  glow?: boolean;
  dots: number[]; // angles in degrees
}

const rings: Ring[] = [
  { radius: 78, duration: 22, dots: [20, 200] },
  { radius: 128, duration: 16, reverse: true, glow: true, dots: [90, 310] },
  { radius: 172, duration: 30, dots: [150, 260, 5] },
];

function dotPosition(radius: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return { cx: CENTER + radius * Math.cos(angle), cy: CENTER + radius * Math.sin(angle) };
}

/**
 * Slowly orbiting rings around a pulsing core — stands in for "continuous
 * evaluation across competencies" without claiming any real data. Respects
 * prefers-reduced-motion via the app-wide MotionProvider.
 */
export function OrbitGraphic({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true">
      {rings.map((ring, i) => (
        <circle
          key={i}
          cx={CENTER}
          cy={CENTER}
          r={ring.radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeDasharray="2 6"
        />
      ))}

      {rings.map((ring, i) => (
        <motion.g
          key={i}
          style={{ transformBox: 'view-box', transformOrigin: '200px 200px' }}
          animate={{ rotate: ring.reverse ? -360 : 360 }}
          transition={{ repeat: Infinity, duration: ring.duration, ease: 'linear' }}
        >
          {ring.dots.map((angle, j) => {
            const { cx, cy } = dotPosition(ring.radius, angle);
            return (
              <circle
                key={j}
                cx={cx}
                cy={cy}
                r={ring.glow ? 6 : 4}
                fill={ring.glow ? 'var(--brand)' : 'none'}
                stroke={ring.glow ? 'none' : 'currentColor'}
                strokeWidth={ring.glow ? 0 : 1.5}

              />
            );
          })}
        </motion.g>
      ))}

      <motion.circle
        cx={CENTER}
        cy={CENTER}
        r={20}
        fill="var(--brand)"
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: 'easeInOut' }}
      />
    </svg>
  );
}
