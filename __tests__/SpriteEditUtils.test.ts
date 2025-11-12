import { mergeFrames, normalizeRect, pointInFrame, snapToGrid } from '../src/editor/utils/SpriteEditUtils';

describe('SpriteEditUtils', () => {
  it('snaps values to the nearest grid unit', () => {
    expect(snapToGrid(10, 8)).toBe(8);
    expect(snapToGrid(14, 8)).toBe(16);
    expect(snapToGrid(10, 0)).toBe(10);
    expect(snapToGrid(10, 8, 4)).toBe(12);
  });

  it('normalizes rectangles with negative dimensions', () => {
    expect(normalizeRect({ x: 10, y: 10, w: -5, h: -10 })).toEqual({ x: 5, y: 0, w: 5, h: 10 });
  });

  it('detects whether a point lies inside a frame', () => {
    const frame = { x: 0, y: 0, w: 10, h: 10 };
    expect(pointInFrame({ x: 5, y: 5 }, frame)).toBe(true);
    expect(pointInFrame({ x: 10, y: 5 }, frame)).toBe(false);
  });

  it('merges frames into a bounding box', () => {
    const merged = mergeFrames([
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 5, y: 5, w: 10, h: 10 },
    ]);
    expect(merged).toEqual({ x: 0, y: 0, w: 15, h: 15 });
    expect(mergeFrames([])).toBeNull();
  });
});
