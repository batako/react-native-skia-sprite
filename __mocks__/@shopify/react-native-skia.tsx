import React from 'react';

/**
 * Mock implementation for Skia's useImage hook.
 */
export const mockUseImage = jest.fn(() => null);

/**
 * Lightweight Canvas placeholder for Skia components in tests.
 */
export const Canvas = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('skia-canvas', null, children);

/**
 * Lightweight Group placeholder for Skia components in tests.
 */
export const Group = ({
  children,
  clip,
  transform,
}: {
  children?: React.ReactNode;
  clip?: unknown;
  transform?: unknown;
}) => React.createElement('skia-group', { clip, transform }, children);

/**
 * Mock Skia image element used by the Jest environment.
 */
export const MockSkiaImage = (props: Record<string, unknown>) =>
  React.createElement('skia-image', props);

/**
 * Alias to the mock image component mimicking Skia's API.
 */
export const Image = (props: Record<string, unknown>) => React.createElement(MockSkiaImage, props);

/**
 * Minimal Skia namespace surface needed inside tests.
 */
export const Skia = {
  XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }),
};

/**
 * Re-export of the mocked useImage hook.
 */
export const useImage = mockUseImage;

/**
 * Minimal SkImage type used by tests.
 */
export type SkImage = {
  /** Returns the mocked width. */
  width: () => number;
  /** Returns the mocked height. */
  height: () => number;
};
