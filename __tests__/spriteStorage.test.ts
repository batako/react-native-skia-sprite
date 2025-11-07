import {
  saveSprite,
  listSprites,
  loadSprite,
  deleteSprite,
  configureSpriteStorage,
  getSpriteStoragePaths,
  clearSpriteStorage,
} from '../src/storage/spriteStorage';
import type { SpriteFrame } from '../src/SpriteAnimator';

jest.mock('expo-file-system/legacy');

const mockFs = jest.requireMock(
  'expo-file-system/legacy',
) as typeof import('../__mocks__/expo-file-system/legacy');

const sampleFrames: SpriteFrame[] = [{ x: 0, y: 0, w: 32, h: 32 }];
const TEMP_IMAGE = 'file:///tmp/temp.png';

const writeTempImage = (uri = TEMP_IMAGE) => {
  mockFs.__writeMockFile(uri, 'binary');
  return uri;
};

beforeEach(() => {
  mockFs.__resetMockFileSystem();
  configureSpriteStorage();
});

describe('spriteStorage', () => {
  it('saves sprites and lists summaries', async () => {
    writeTempImage();

    const stored = await saveSprite({
      imageTempUri: TEMP_IMAGE,
      sprite: {
        frames: sampleFrames,
        meta: { displayName: 'Hero' },
      },
    });

    expect(stored.meta.imageUri).toContain('/sprites/images/');
    const list = await listSprites();
    expect(list).toHaveLength(1);
    expect(list[0].displayName).toBe('Hero');

    const loaded = (await loadSprite(stored.id)) as {
      frames: SpriteFrame[];
    } | null;
    expect(loaded?.frames[0].w).toBe(32);
  });

  it('merges extra metadata and skips undefined values', async () => {
    writeTempImage();

    const stored = await saveSprite({
      imageTempUri: TEMP_IMAGE,
      sprite: {
        frames: sampleFrames,
        meta: {
          displayName: 'Hero',
          category: 'npc',
          note: undefined,
        },
      },
    });

    expect(stored.meta.category).toBe('npc');
    expect('note' in stored.meta).toBe(false);
  });

  it('deletes sprites and cleans registry', async () => {
    writeTempImage();
    const stored = await saveSprite({
      imageTempUri: TEMP_IMAGE,
      sprite: { frames: sampleFrames },
    });

    await deleteSprite(stored.id);

    const list = await listSprites();
    expect(list).toHaveLength(0);
    const missing = await loadSprite(stored.id);
    expect(missing).toBeNull();
  });

  it('no-ops when deleting a missing sprite', async () => {
    await expect(deleteSprite('missing')).resolves.toBeUndefined();
  });

  it('respects custom root configuration', async () => {
    configureSpriteStorage({ rootDir: 'file:///custom-root/' });
    writeTempImage();

    const stored = await saveSprite({
      imageTempUri: TEMP_IMAGE,
      sprite: { frames: sampleFrames },
    });

    expect(stored.meta.imageUri.startsWith('file:///custom-root/images/')).toBe(true);
    const paths = getSpriteStoragePaths();
    expect(paths.root).toBe('file:///custom-root/');
  });

  it('throws when imageTempUri is missing', async () => {
    await expect(
      saveSprite({ imageTempUri: '', sprite: { frames: sampleFrames } }),
    ).rejects.toThrow('imageTempUri is required');
  });

  it('throws when frames array is empty', async () => {
    writeTempImage();
    await expect(saveSprite({ imageTempUri: TEMP_IMAGE, sprite: { frames: [] } })).rejects.toThrow(
      'sprite.frames must contain at least one frame',
    );
  });

  it('generates fallback sprite ids when crypto.randomUUID is unavailable', async () => {
    writeTempImage();
    const cryptoGetter = jest
      .spyOn(globalThis as unknown as { crypto: Crypto }, 'crypto', 'get')
      .mockReturnValue(undefined as unknown as Crypto);

    const stored = await saveSprite({
      imageTempUri: TEMP_IMAGE,
      sprite: { frames: sampleFrames },
    });
    expect(stored.id.startsWith('sprite_')).toBe(true);
    cryptoGetter.mockRestore();
  });

  it('throws if document/cache directories are unavailable', async () => {
    mockFs.__setWritableDirectories(null, null);
    writeTempImage();
    await expect(
      saveSprite({ imageTempUri: TEMP_IMAGE, sprite: { frames: sampleFrames } }),
    ).rejects.toThrow('writable directory');
  });

  it('handles orphaned metadata that lacks a registry entry', async () => {
    const paths = getSpriteStoragePaths();
    await listSprites(); // ensure directories exist
    const spriteId = 'orphan';
    const imagePath = `${paths.images}${spriteId}.png`;
    mockFs.__writeMockFile(imagePath, 'img');
    mockFs.__writeMockFile(
      `${paths.meta}${spriteId}.json`,
      JSON.stringify({
        id: spriteId,
        frames: sampleFrames,
        meta: {
          displayName: 'Orphan',
          createdAt: Date.now(),
          version: 1,
          imageUri: imagePath,
        },
      }),
    );

    await deleteSprite(spriteId);
    expect(await loadSprite(spriteId)).toBeNull();
    expect(await listSprites()).toEqual([]);
  });

  it('updates existing registry entries when saving the same id', async () => {
    writeTempImage();
    const stored = await saveSprite({
      imageTempUri: TEMP_IMAGE,
      sprite: { frames: sampleFrames, meta: { displayName: 'Hero' } },
    });

    const secondImage = 'file:///tmp/temp2.png';
    writeTempImage(secondImage);
    await saveSprite({
      imageTempUri: secondImage,
      sprite: { id: stored.id, frames: sampleFrames, meta: { displayName: 'Hero v2' } },
    });

    const list = await listSprites();
    expect(list).toHaveLength(1);
    expect(list[0].displayName).toBe('Hero v2');
  });

  it('recovers from ensureStorage failures and resets internal promise state', async () => {
    writeTempImage();
    const makeDirSpy = jest.spyOn(mockFs, 'makeDirectoryAsync').mockImplementation(async () => {
      throw new Error('boom');
    });

    await expect(
      saveSprite({ imageTempUri: TEMP_IMAGE, sprite: { frames: sampleFrames } }),
    ).rejects.toThrow('boom');

    makeDirSpy.mockRestore();
    writeTempImage('file:///tmp/temp3.png');
    await expect(
      saveSprite({
        imageTempUri: 'file:///tmp/temp3.png',
        sprite: { frames: sampleFrames },
      }),
    ).resolves.toBeTruthy();
  });

  it('handles invalid registry JSON by falling back to an empty list', async () => {
    const { registry } = getSpriteStoragePaths();
    mockFs.__writeMockFile(registry, 'not json');
    const list = await listSprites();
    expect(list).toEqual([]);
  });

  it('clears the entire storage tree', async () => {
    const { root } = getSpriteStoragePaths();
    mockFs.__writeMockDirectory(root);
    await clearSpriteStorage();
    const info = await mockFs.getInfoAsync(root);
    expect(info.exists).toBe(false);
  });
});
