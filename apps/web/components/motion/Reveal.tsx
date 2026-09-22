'use client';

import { useEffect, useRef } from 'react';

/**
 * Scroll reveal that cannot hide anything the visitor can already see.
 *
 * Two earlier attempts failed the same way: a plain whileInView wrapper and a
 * view() scroll timeline both left content parked at opacity 0 whenever the
 * observer or the timeline never resolved — the competency grid and the report
 * went missing from full-page captures. So this one measures first and only
 * hides an element that starts below the fold. Whatever is in the first frame
 * stays painted, which is what a screenshot, a link preview and a reader
 * without JavaScript all get.
 *
 * `stagger` moves the animation onto the direct children so a grid fills in row
 * by row instead of arriving as one block.
 */
export function Reveal({
  children,
  stagger,
  className,
}: {
  children: React.ReactNode;
  stagger?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) return;

    element.dataset.reveal = 'pending';

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        element.dataset.reveal = 'in';
        observer.disconnect();
      },
      { rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`${stagger ? 'reveal-stagger' : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
}
