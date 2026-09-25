/**
 * The mark: a "U" for inVision U, drawn in square pixels on the dark tile, in
 * the same grid-with-gaps as the pixel wordmark at the foot of the landing.
 * app/icon.svg carries the same pixels, so the favicon and the header agree
 * (`tests/brandMark.test.ts` holds them together).
 */

/** Seven by seven cells; [column, row]. Two-pixel stems, a rounded foot. */
export const MARK_PIXELS: ReadonlyArray<readonly [number, number]> = [
  ...[0, 1, 2, 3, 4].flatMap((row) => [[0, row], [1, row], [5, row], [6, row]] as const),
  [0, 5], [1, 5], [2, 5], [4, 5], [5, 5], [6, 5],
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
];

/** Pixel geometry in the 64×64 viewBox: 5-unit squares on a 7-unit step, centred. */
export const MARK_STEP = 7;
export const MARK_CELL = 5;
export const MARK_ORIGIN = (64 - (6 * MARK_STEP + MARK_CELL)) / 2;

export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={`shrink-0 ${className ?? ''}`}>
      <rect width="64" height="64" rx="16" fill="#131313" stroke="var(--line-strong)" />
      {MARK_PIXELS.map(([column, row]) => (
        <rect
          key={`${column}-${row}`}
          x={MARK_ORIGIN + column * MARK_STEP}
          y={MARK_ORIGIN + row * MARK_STEP}
          width={MARK_CELL}
          height={MARK_CELL}
          fill="var(--brand)"
        />
      ))}
    </svg>
  );
}
