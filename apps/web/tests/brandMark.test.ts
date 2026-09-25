import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MARK_CELL, MARK_ORIGIN, MARK_PIXELS, MARK_STEP } from '../components/ui/BrandMark';

describe('the brand mark', () => {
  it('is drawn with the same pixels in the favicon and in the header', () => {
    const svg = readFileSync(join(process.cwd(), 'app/icon.svg'), 'utf8');
    const fromIcon = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="(\d+)" height="(\d+)"/g)]
      .map(([, x, y]) => `${x},${y}`)
      .sort();
    const fromComponent = MARK_PIXELS.map(
      ([column, row]) => `${MARK_ORIGIN + column * MARK_STEP},${MARK_ORIGIN + row * MARK_STEP}`,
    ).sort();
    expect(fromIcon).toEqual(fromComponent);
    expect(svg).toContain(`width="${MARK_CELL}" height="${MARK_CELL}"`);
  });

  it('reads as a U: two stems and a closed foot, symmetric', () => {
    const cells = new Set(MARK_PIXELS.map(([column, row]) => `${column},${row}`));
    for (const [column, row] of MARK_PIXELS) expect(cells.has(`${6 - column},${row}`)).toBe(true);
    expect(cells.has('3,6')).toBe(true);
    for (let row = 0; row < 5; row += 1) expect(cells.has(`3,${row}`)).toBe(false);
  });
});
