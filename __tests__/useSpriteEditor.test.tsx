import React, { forwardRef, useImperativeHandle } from 'react';
import TestRenderer, { act, ReactTestRenderer } from 'react-test-renderer';
import type { SpriteEditorApi, UseSpriteEditorOptions } from '../src/editor/hooks/useSpriteEditor';
import { useSpriteEditor } from '../src/editor/hooks/useSpriteEditor';
import { DefaultSpriteTemplate } from '../src/editor/templates/DefaultSpriteTemplate';

const renderEditor = (options?: UseSpriteEditorOptions) => {
  const ref = React.createRef<SpriteEditorApi>();
  const Harness = forwardRef<SpriteEditorApi, {}>((_props, forwardedRef) => {
    const api = useSpriteEditor(options);
    useImperativeHandle(forwardedRef, () => api, [api]);
    return null;
  });

  let root: ReactTestRenderer | null = null;
  act(() => {
    root = TestRenderer.create(<Harness ref={ref} />);
  });

  return {
    get api() {
      if (!ref.current) {
        throw new Error('Editor API not ready');
      }
      return ref.current;
    },
    unmount() {
      if (!root) return;
      act(() => {
        root?.unmount();
      });
    },
  };
};

const createFrame = (offset: number) => ({
  x: offset,
  y: offset,
  w: 16,
  h: 16,
});

describe('useSpriteEditor', () => {
  it('supports frame CRUD with animation index maintenance', () => {
    const harness = renderEditor();
    act(() => {
      harness.api.addFrame(createFrame(0));
      harness.api.addFrame(createFrame(16));
      harness.api.setAnimations({ walk: [0, 1] });
      harness.api.addFrame(createFrame(32), { index: 1 });
    });

    expect(harness.api.state.frames).toHaveLength(3);
    expect(harness.api.state.animations.walk).toEqual([0, 2]);

    const firstId = harness.api.state.frames[0].id;
    act(() => {
      harness.api.removeFrame(firstId);
    });

    expect(harness.api.state.frames).toHaveLength(2);
    expect(harness.api.state.animations.walk).toEqual([1]);

    harness.unmount();
  });

  it('handles undo/redo stacks', () => {
    const harness = renderEditor({ historyLimit: 5 });
    act(() => {
      harness.api.addFrame(createFrame(0));
      harness.api.addFrame(createFrame(20));
      harness.api.addFrame(createFrame(40));
    });

    expect(harness.api.canUndo).toBe(true);

    act(() => {
      harness.api.undo();
    });

    expect(harness.api.state.frames).toHaveLength(2);
    expect(harness.api.canRedo).toBe(true);

    act(() => {
      harness.api.redo();
    });

    expect(harness.api.state.frames).toHaveLength(3);
    harness.unmount();
  });

  it('supports clipboard copy/paste workflows', () => {
    const harness = renderEditor();
    act(() => {
      const frame = harness.api.addFrame(createFrame(0));
      harness.api.setSelection([frame.id]);
      harness.api.copySelected();
      harness.api.pasteClipboard();
    });

    expect(harness.api.state.frames).toHaveLength(2);
    const [first, second] = harness.api.state.frames;
    expect(first.id).not.toEqual(second.id);
    harness.unmount();
  });

  it('exports and imports via the default template', () => {
    const harness = renderEditor();
    act(() => {
      const frame = harness.api.addFrame(createFrame(4));
      harness.api.setSelection([frame.id]);
      harness.api.setAnimations({ idle: [0] });
      harness.api.updateMeta({ displayName: 'Hero' });
    });

    const payload = harness.api.exportJSON(DefaultSpriteTemplate);
    expect(payload).toMatchObject({
      frames: [
        {
          x: 4,
          y: 4,
          w: 16,
          h: 16,
        },
      ],
      animations: {
        idle: [0],
      },
      meta: {
        displayName: 'Hero',
      },
    });

    act(() => {
      harness.api.importJSON({
        ...payload,
        frames: [
          { x: 1, y: 1, w: 8, h: 8 },
          { x: 2, y: 2, w: 8, h: 8 },
        ],
        animations: { blink: [0, 1] },
      });
    });

    expect(harness.api.state.frames).toHaveLength(2);
    expect(harness.api.state.animations).toEqual({ blink: [0, 1] });
    harness.unmount();
  });
});
