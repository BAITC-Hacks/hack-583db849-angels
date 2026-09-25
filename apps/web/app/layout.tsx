import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { MotionProvider } from '../components/motion/MotionProvider';
import { jetbrainsMono, onest } from './fonts';
import './style.css';

export const metadata: Metadata = {
  title: 'AI Leader ID — inVision U',
  description: 'An AI layer around the admissions interview: evidence for the people who decide.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffde9' },
    { media: '(prefers-color-scheme: dark)', color: '#131313' },
  ],
};

/**
 * Resolves a concrete theme before first paint so the page never flashes the
 * wrong ground. A blocked or empty localStorage falls back to the system
 * preference rather than throwing.
 *
 * `beforeInteractive` puts it in the initial HTML and runs it ahead of
 * hydration, which is the only moment early enough to matter.
 */
const themeScript = `(function(){try{var s=localStorage.getItem('invision-theme');var t=(s==='dark'||s==='light')?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${onest.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <Script id="theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
