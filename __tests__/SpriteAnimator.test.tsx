import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { SpriteAnimator, type SpriteFrame } from "../src/SpriteAnimator";
import type { ImageSourcePropType } from "react-native";
import type { SkImage } from "@shopify/react-native-skia";

jest.mock("@shopify/react-native-skia");

const skiaMock = jest.requireMock("@shopify/react-native-skia") as typeof import("../__mocks__/@shopify/react-native-skia");

const mockSkImage = (): SkImage =>
  ({
    width: () => 256,
    height: () => 256,
  } as unknown as SkImage);

const renderComponent = (ui: React.ReactElement) => {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(ui as any);
  });
  return renderer;
};

describe("SpriteAnimator", () => {
  const frames: SpriteFrame[] = [
    { x: 0, y: 0, w: 64, h: 64 },
    { x: 64, y: 0, w: 64, h: 64 },
  ];

  beforeEach(() => {
    jest.useFakeTimers();
    skiaMock.mockUseImage.mockReset();
    skiaMock.mockUseImage.mockReturnValue(null);
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it("renders the first frame rectangle", () => {
    const renderer = renderComponent(
      <SpriteAnimator image={mockSkImage()} data={{ frames }} spriteScale={2} />
    );

    expect(skiaMock.mockUseImage).not.toHaveBeenCalled();
    const groupNode = renderer.root.findByType(skiaMock.Group as any);
    const clipRect = groupNode.props.clip as { x: number; y: number; width: number; height: number };
    expect(clipRect).toBeTruthy();
    expect(clipRect.x).toBe(0);
    expect(clipRect.y).toBe(0);
    const imageNode = renderer.root.findByType(skiaMock.MockSkiaImage);
    expect(imageNode.props.x).toBeCloseTo(0);
    expect(imageNode.props.y).toBeCloseTo(0);
    expect(imageNode.props.width).toBe(512);
    expect(imageNode.props.height).toBe(512);
  });

  it("advances frames according to fps and calls onEnd when loop is false", () => {
    const onEnd = jest.fn();
    const renderer = renderComponent(
      <SpriteAnimator
        image={mockSkImage()}
        data={{ frames }}
        fps={10}
        loop={false}
        onEnd={onEnd}
      />
    );

    act(() => {
      jest.advanceTimersByTime(110);
    });

    let imageNode = renderer.root.findByType(skiaMock.MockSkiaImage);
    expect(imageNode.props.x).toBe(-64);
    expect(imageNode.props.y).toBeCloseTo(0);

    act(() => {
      jest.advanceTimersByTime(110);
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
    imageNode = renderer.root.findByType(skiaMock.MockSkiaImage);
    expect(imageNode.props.x).toBe(-64);
    expect(imageNode.props.y).toBeCloseTo(0);
  });

  it("respects speedScale to accelerate frame playback", () => {
    const renderer = renderComponent(
      <SpriteAnimator
        image={mockSkImage()}
        data={{ frames }}
        fps={10}
        speedScale={2}
      />
    );

    act(() => {
      jest.advanceTimersByTime(60);
    });

    const imageNode = renderer.root.findByType(skiaMock.MockSkiaImage);
    expect(imageNode.props.x).toBe(-64);
  });

  it("uses useImage for asset sources and skips autoplay for single-frame data", () => {
    const assetSource = "bundle://hero.png" as ImageSourcePropType;
    const resolvedImage = mockSkImage();
    skiaMock.mockUseImage.mockReturnValue(resolvedImage as any);

    const renderer = renderComponent(
      <SpriteAnimator image={assetSource} data={{ frames: [frames[0]] }} />
    );

    expect(skiaMock.mockUseImage).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    const imageNode = renderer.root.findByType(skiaMock.MockSkiaImage);
    expect(imageNode.props.x).toBeCloseTo(0);
  });

  it("clears pending timers on unmount", () => {
    const clearSpy = jest.spyOn(global, "clearTimeout");
    const renderer = renderComponent(
      <SpriteAnimator image={mockSkImage()} data={{ frames }} fps={12} />
    );

    act(() => {
      jest.advanceTimersByTime(50);
      renderer.unmount();
    });

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("renders nothing when no frames are provided", () => {
    const renderer = renderComponent(
      <SpriteAnimator image={mockSkImage()} data={{ frames: [] }} />
    );

    const images = renderer.root.findAllByType(skiaMock.MockSkiaImage);
    expect(images).toHaveLength(0);
  });

  it("selects the initial animation sequence by name when animations are provided", () => {
    const renderer = renderComponent(
      <SpriteAnimator
        image={mockSkImage()}
        data={{
          frames: [
            { x: 0, y: 0, w: 64, h: 64 },
            { x: 64, y: 0, w: 64, h: 64 },
            { x: 128, y: 0, w: 64, h: 64 },
          ],
        }}
        animations={{ blink: [2, 1] }}
        initialAnimation="blink"
        autoplay={false}
      />
    );

    const imageNode = renderer.root.findByType(skiaMock.MockSkiaImage);
    expect(imageNode.props.x).toBe(-128);
  });

  it("applies flip transforms when flipX or flipY are provided", () => {
    const renderer = renderComponent(
      <SpriteAnimator
        image={mockSkImage()}
        data={{ frames }}
        flipX
      />
    );

    const groupNodes = renderer.root.findAllByType(skiaMock.Group as any);
    const transformGroup = groupNodes.find(
      (node) => Array.isArray(node.props.transform)
    );
    expect(transformGroup?.props.transform).toEqual([
      { translateX: 64 },
      { scaleX: -1 },
    ]);
  });
});
