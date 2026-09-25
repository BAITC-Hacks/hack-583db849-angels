import { byteRange, countsAsView } from '../src/media/video-range';

describe('byte ranges for the videos', () => {
  it('reads the three forms of one range, and clamps the end to the file', () => {
    expect(byteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(byteRange('bytes=500-', 1000)).toEqual({ start: 500, end: 999 });
    expect(byteRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(byteRange('bytes=900-5000', 1000)).toEqual({ start: 900, end: 999 });
  });

  it('serves the whole file for no header, several ranges or a form it does not read', () => {
    expect(byteRange(undefined, 1000)).toBeUndefined();
    expect(byteRange('bytes=0-9,20-29', 1000)).toBeUndefined();
    expect(byteRange('items=0-9', 1000)).toBeUndefined();
    expect(byteRange('bytes=-', 1000)).toBeUndefined();
  });

  it('refuses a range outside the file', () => {
    expect(byteRange('bytes=1000-', 1000)).toBeNull();
    expect(byteRange('bytes=50-10', 1000)).toBeNull();
    expect(byteRange('bytes=-0', 1000)).toBeNull();
  });

  it('counts a viewing once: from the first byte, and not for a two-byte probe', () => {
    expect(countsAsView(undefined, 1000)).toBe(true);
    expect(countsAsView('bytes=0-', 1000)).toBe(true);
    expect(countsAsView('bytes=0-999', 1000)).toBe(true);
    expect(countsAsView('bytes=0-1', 1000)).toBe(false);
    expect(countsAsView('bytes=500-', 1000)).toBe(false);
    expect(countsAsView('bytes=2000-', 1000)).toBe(false);
  });
});
