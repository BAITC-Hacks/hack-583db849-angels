import { JetBrains_Mono, Onest } from 'next/font/google';

/**
 * The typefaces, created once and shared.
 *
 * The approved face is GT Walsheim, a licensed Grilli Type face whose files
 * cannot be served from a CDN and are not in the repository yet. Onest is the
 * closest freely available geometric grotesque. Both faces load Cyrillic too:
 * staff screens can be read in Russian. Whatever replaces them has to cover it.
 */
export const onest = Onest({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-onest',
  display: 'swap',
});

/** The monospace face for labels, ids and figures. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
