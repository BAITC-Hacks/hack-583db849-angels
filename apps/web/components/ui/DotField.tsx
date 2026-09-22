'use client';

import { useEffect, useRef } from 'react';

/**
 * Background grid of dots that brightens around the pointer. One canvas, one
 * animation frame per pointer move, no library — this replaces the WebGL
 * background because the pitch runs on whatever laptop is in the room.
 *
 * Reduced-motion visitors get the static grid: the field still reads, it just
 * stops following the cursor.
 */
export function DotField({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pointer = { x: -1e4, y: -1e4 };
    let frame = 0;

    function paint() {
      if (!canvas || !context) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);

      const accent = getComputedStyle(canvas).color;
      const step = 22;
      const reach = 170;

      for (let y = step; y < height; y += step) {
        for (let x = step; x < width; x += step) {
          const distance = Math.hypot(x - pointer.x, y - pointer.y);
          const near = reduced ? 0 : Math.max(0, 1 - distance / reach);
          const drift = Math.max(0, 1 - Math.hypot(x - width * 0.12, y - height * 0.5) / (Math.max(width, height) * 0.7));
          const alpha = 0.1 + drift * 0.3 + near * 0.65;

          context.globalAlpha = Math.min(alpha, 0.95);
          context.fillStyle = accent;
          context.beginPath();
          context.arc(x, y, 1.1 + near * 1.6, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    }

    function schedule() {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        paint();
      });
    }

    function handlePointer(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      schedule();
    }

    function handleLeave() {
      pointer.x = -1e4;
      pointer.y = -1e4;
      schedule();
    }

    paint();
    window.addEventListener('resize', schedule);
    if (!reduced) {
      window.addEventListener('pointermove', handlePointer, { passive: true });
      window.addEventListener('pointerleave', handleLeave);
    }

    return () => {
      window.removeEventListener('resize', schedule);
      window.removeEventListener('pointermove', handlePointer);
      window.removeEventListener('pointerleave', handleLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={`pointer-events-none text-brand-ink ${className ?? ''}`}
    />
  );
}
