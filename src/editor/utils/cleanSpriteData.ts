import type {
  SpriteAnimations,
  SpriteAnimationsMeta,
  SpriteFrame,
  SpriteData,
} from '../../SpriteAnimator';

type SpriteDataLike<TFrame extends SpriteFrame> = Pick<
  SpriteData,
  'animations' | 'animationsMeta' | 'meta'
> & {
  frames: TFrame[];
  [key: string]: unknown;
};

export interface CleanSpriteDataResult<TFrame extends SpriteFrame> extends SpriteDataLike<TFrame> {
  frameIndexMap: number[];
  removedFrameIndexes: number[];
  animations: SpriteAnimations;
  animationsMeta?: SpriteAnimationsMeta;
}

export const cleanSpriteData = <TFrame extends SpriteFrame>(
  data: SpriteDataLike<TFrame>,
): CleanSpriteDataResult<TFrame> => {
  const animations = data.animations ?? {};
  const referencedRawIndexes = new Set<number>();
  Object.values(animations).forEach((sequence) => {
    if (!Array.isArray(sequence)) {
      return;
    }
    sequence.forEach((index) => {
      if (typeof index === 'number' && Number.isFinite(index)) {
        referencedRawIndexes.add(index);
      }
    });
  });

  const keepAllFrames = referencedRawIndexes.size === 0;
  const frameKey = (frame: SpriteFrame) =>
    `${frame.x}|${frame.y}|${frame.w}|${frame.h}|${frame.duration ?? ''}`;

  const canonicalByRaw = new Map<number, number>();
  const canonicalOrder: number[] = [];
  const keyToCanonical = new Map<string, number>();

  data.frames.forEach((frame, index) => {
    const key = frameKey(frame);
    if (!keyToCanonical.has(key)) {
      keyToCanonical.set(key, index);
      canonicalByRaw.set(index, index);
      canonicalOrder.push(index);
    } else {
      canonicalByRaw.set(index, keyToCanonical.get(key)!);
    }
  });

  const canonicalReferences = new Set<number>();
  referencedRawIndexes.forEach((rawIndex) => {
    const canonical = canonicalByRaw.get(rawIndex);
    if (typeof canonical === 'number') {
      canonicalReferences.add(canonical);
    }
  });

  const canonicalToFinal = new Map<number, number>();
  const frames: TFrame[] = [];
  canonicalOrder.forEach((rawIndex) => {
    if (!keepAllFrames && !canonicalReferences.has(rawIndex)) {
      canonicalToFinal.set(rawIndex, -1);
      return;
    }
    const nextIndex = frames.length;
    frames.push(data.frames[rawIndex]);
    canonicalToFinal.set(rawIndex, nextIndex);
  });

  const frameIndexMap = data.frames.map((_, rawIndex) => {
    const canonical = canonicalByRaw.get(rawIndex);
    if (canonical === undefined) {
      return -1;
    }
    const mapped = canonicalToFinal.get(canonical);
    return typeof mapped === 'number' ? mapped : -1;
  });

  const cleanedAnimations: SpriteAnimations = {};
  Object.entries(animations).forEach(([name, sequence]) => {
    if (!Array.isArray(sequence)) {
      cleanedAnimations[name] = [];
      return;
    }
    const remapped = sequence
      .map((index) => (typeof index === 'number' ? (frameIndexMap[index] ?? -1) : -1))
      .filter((index) => index >= 0);
    cleanedAnimations[name] = remapped;
  });

  const validAnimationNames = new Set(
    Object.entries(cleanedAnimations)
      .filter(([, sequence]) => sequence.length > 0)
      .map(([name]) => name),
  );

  let animationsMeta: SpriteAnimationsMeta | undefined;
  if (data.animationsMeta) {
    Object.entries(data.animationsMeta).forEach(([name, meta]) => {
      if (!validAnimationNames.has(name)) {
        return;
      }
      if (!animationsMeta) {
        animationsMeta = {};
      }
      animationsMeta[name] = meta;
    });
  }

  const removedFrameIndexes = data.frames
    .map((_, rawIndex) => (frameIndexMap[rawIndex] === -1 ? rawIndex : -1))
    .filter((index) => index >= 0);

  return {
    ...data,
    frames,
    animations: cleanedAnimations,
    animationsMeta,
    frameIndexMap,
    removedFrameIndexes,
  };
};
