/* eslint-disable jsdoc/require-jsdoc */
import React from 'react';

export const mockUseImage = jest.fn(() => null);

export const Canvas = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('skia-canvas', null, children);

export const Group = ({
  children,
  clip,
  transform,
}: {
  children?: React.ReactNode;
  clip?: unknown;
  transform?: unknown;
}) => React.createElement('skia-group', { clip, transform }, children);

export const MockSkiaImage = (props: Record<string, unknown>) =>
  React.createElement('skia-image', props);

export const Image = (props: Record<string, unknown>) => React.createElement(MockSkiaImage, props);

export const Skia = {
  XYWHRect: (x: number, y: number, w: number, h: number) => ({ x, y, w, h }),
};

export const useImage = mockUseImage;

export type SkImage = {
  width: () => number;
  height: () => number;
};
