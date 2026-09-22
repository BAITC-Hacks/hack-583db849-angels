'use client';

import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import { useRef } from 'react';

/**
 * The button holds no React state: which icon shows is decided by CSS from the
 * data-theme the inline script in app/layout.tsx set before first paint. That
 * keeps server and client markup identical and avoids a flash of the wrong icon
 * on hydration.
 *
 * Switching runs through a View Transition so the new theme wipes in as a circle
 * growing out of the button. Browsers without the API, and anyone who asked for
 * reduced motion, get the same instant switch as before.
 *
 * The stored value is a per-viewer convenience wrapped in try/catch; applicant
 * data never goes to browser storage (see the S2 specification, section 37).
 */
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { ready: Promise<void> };
};

export function ThemeToggle({ className }: { className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

    const apply = () => {
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('invision-theme', next);
      } catch {
        // Private windows and blocked site data are fine: the theme resets next visit.
      }
    };

    const startViewTransition = (document as ViewTransitionDocument).startViewTransition;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const button = ref.current;

    if (!startViewTransition || reduced || !button) {
      apply();
      return;
    }

    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

    const transition = startViewTransition.call(document, apply);
    void transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
      );
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      aria-label="Switch theme"
      title="Switch theme"
      className={`inline-flex h-9 w-9 items-center justify-center rounded-control border border-border-subtle text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink ${className ?? ''}`}
    >
      <MoonIcon aria-hidden="true" className="theme-light-only h-[18px] w-[18px]" />
      <SunIcon aria-hidden="true" className="theme-dark-only h-[18px] w-[18px]" />
    </button>
  );
}
