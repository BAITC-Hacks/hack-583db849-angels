'use client';

import { useEffect, useRef } from 'react';

/**
 * Draws a word as a grid of square pixels by sampling the rendered glyphs, so
 * the mark scales with the footer instead of shipping a fixed image.
 *
 * The canvas is always painted complete. The reveal is a CSS transition on the
 * element, not a repaint of partial pixels: an earlier version animated the
 * pixel alpha and could be caught half-drawn by a screenshot or by a frozen
 * animation frame, which is exactly the at-rest state this mark must survive.
 */
export function PixelWordmark({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

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

      const sample = document.createElement('canvas');
      sample.width = Math.max(1, Math.round(width));
      sample.height = Math.max(1, Math.round(height));
      const sampleContext = sample.getContext('2d');
      if (!sampleContext) return;

      const family = getComputedStyle(canvas).fontFamily;

      // Fit the word to both axes. Scaling to the width alone made the glyphs
      // taller than the canvas on a wide footer, which clipped the ascenders
      // and descenders. actualBoundingBox* measures the ink, not the em box,
      // so the mark sits on its optical centre rather than the baseline.
      const base = 100;
      sampleContext.font = `800 ${base}px ${family}`;
      const baseMetrics = sampleContext.measureText(text);
      const baseWidth = baseMetrics.width;
      const baseHeight = baseMetrics.actualBoundingBoxAscent + baseMetrics.actualBoundingBoxDescent;
      if (baseWidth <= 0 || baseHeight <= 0) return;

      const size = base * Math.min((width * 0.98) / baseWidth, (height * 0.94) / baseHeight);
      sampleContext.font = `800 ${size}px ${family}`;
      const metrics = sampleContext.measureText(text);

      sampleContext.textAlign = 'center';
      sampleContext.textBaseline = 'alphabetic';
      sampleContext.fillStyle = '#000';
      sampleContext.fillText(
        text,
        sample.width / 2,
        (sample.height + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2,
      );

      const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
      const step = Math.max(4, Math.round(height / 24));
      const cell = Math.max(2, step - 2);

      context.fillStyle = getComputedStyle(canvas).color;
      for (let y = 0; y < sample.height; y += step) {
        for (let x = 0; x < sample.width; x += step) {
          if (pixels[(y * sample.width + x) * 4 + 3] <= 128) continue;
          context.fillRect(x, y, cell, cell);
        }
      }
    }

    paint();

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          canvas?.classList.add('is-revealed');
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(canvas);

    const repaint = () => paint();
    window.addEventListener('resize', repaint);
    if (document.fonts?.ready) void document.fonts.ready.then(repaint);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', repaint);
    };
  }, [text]);

  return (
    <canvas ref={ref} role="img" aria-label={text} className={`pixel-wordmark text-brand-ink ${className ?? ''}`} />
  );
}
