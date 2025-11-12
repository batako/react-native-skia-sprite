export interface RectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PointLike {
  x: number;
  y: number;
}

/**
 * Snaps a scalar value to the nearest grid unit.
 */
export const snapToGrid = (value: number, gridSize: number, origin = 0) => {
  if (!Number.isFinite(gridSize) || gridSize <= 0) {
    return value;
  }
  if (!Number.isFinite(value)) {
    return value;
  }
  const offset = value - origin;
  const snapped = Math.round(offset / gridSize) * gridSize;
  return origin + snapped;
};

/**
 * Returns a rect where width/height are always positive.
 */
export const normalizeRect = (rect: RectLike): RectLike => {
  let { x, y, w, h } = rect;
  if (w < 0) {
    x += w;
    w = Math.abs(w);
  }
  if (h < 0) {
    y += h;
    h = Math.abs(h);
  }
  return { x, y, w, h };
};

/**
 * Determines whether a point lies within a frame's bounds (inclusive start, exclusive end).
 */
export const pointInFrame = (point: PointLike, frame: RectLike) => {
  const rect = normalizeRect(frame);
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.w &&
    point.y >= rect.y &&
    point.y < rect.y + rect.h
  );
};

/**
 * Calculates the bounding box that contains all provided frames.
 */
export const mergeFrames = (frames: RectLike[]): RectLike | null => {
  if (!frames.length) {
    return null;
  }
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  frames.forEach((frame) => {
    const rect = normalizeRect(frame);
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.w);
    maxY = Math.max(maxY, rect.y + rect.h);
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
};
