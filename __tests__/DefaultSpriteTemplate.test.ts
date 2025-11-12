import { DefaultSpriteTemplate } from '../src/editor/templates/DefaultSpriteTemplate';
import type { SpriteEditorSnapshot } from '../src/editor/types';

describe('DefaultSpriteTemplate', () => {
  it('produces spriteStorage-compatible payloads', () => {
    const snapshot: SpriteEditorSnapshot = {
      frames: [
        { id: 'frame-a', x: 0, y: 0, w: 32, h: 32 },
        { id: 'frame-b', x: 32, y: 0, w: 32, h: 32 },
      ],
      animations: {
        walk: [0, 1],
      },
      animationsMeta: {
        walk: { loop: true },
      },
      selected: [],
      meta: { displayName: 'Runner' },
    };

    const payload = DefaultSpriteTemplate.toJSON(snapshot);
    expect(payload.frames).toEqual([
      { x: 0, y: 0, w: 32, h: 32 },
      { x: 32, y: 0, w: 32, h: 32 },
    ]);
    expect(payload.animations).toEqual({ walk: [0, 1] });
    expect(payload.meta).toEqual({ displayName: 'Runner' });
    expect(payload.frames.every((frame: any) => frame.id === undefined)).toBe(true);
  });

  it('hydrates editor state from JSON', () => {
    expect(DefaultSpriteTemplate.fromJSON).toBeDefined();
    const imported = DefaultSpriteTemplate.fromJSON!({
      frames: [{ x: 0, y: 0, w: 16, h: 16 }],
      animations: { idle: [0] },
      meta: { displayName: 'Hero' },
    });

    expect(imported).toBeTruthy();
    expect(imported?.frames?.[0].id).toBeDefined();
    expect(imported?.animations).toEqual({ idle: [0] });
  });
});
