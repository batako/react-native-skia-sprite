import type {
  SpriteAnimationMeta,
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

const DEFAULT_ANIMATION_FPS = 5;
const MIN_ANIMATION_FPS = 1;
const MAX_ANIMATION_FPS = 60;
const DEFAULT_MULTIPLIER = 1;
const MIN_MULTIPLIER = 0.1;
const MULTIPLIER_EPSILON = 0.0001;

type LegacyAnimationSettings = {
  fps?: Record<string, number>;
  multipliers?: Record<string, Record<number, number>>;
};

const clampLegacyFps = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_ANIMATION_FPS;
  }
  if (value < MIN_ANIMATION_FPS) {
    return MIN_ANIMATION_FPS;
  }
  if (value > MAX_ANIMATION_FPS) {
    return MAX_ANIMATION_FPS;
  }
  return value;
};

const clampLegacyMultiplier = (value: number) => {
  if (!Number.isFinite(value)) {
    return DEFAULT_MULTIPLIER;
  }
  return Math.max(MIN_MULTIPLIER, value);
};

const normalizeLegacyMultipliers = (values: number[]) => {
  const normalized = values.map((value) => clampLegacyMultiplier(value ?? DEFAULT_MULTIPLIER));
  while (
    normalized.length &&
    Math.abs((normalized[normalized.length - 1] ?? DEFAULT_MULTIPLIER) - DEFAULT_MULTIPLIER) <
      MULTIPLIER_EPSILON
  ) {
    normalized.pop();
  }
  return normalized;
};

const mergeAnimationMeta = (
  base: SpriteAnimationsMeta | undefined,
  name: string,
  mutator: (draft: SpriteAnimationMeta) => void,
): SpriteAnimationsMeta => {
  const next = { ...(base ?? {}) };
  const draft: SpriteAnimationMeta = { ...(next[name] ?? {}) };
  mutator(draft);
  if (Object.keys(draft).length === 0) {
    delete next[name];
  } else {
    next[name] = draft;
  }
  return next;
};

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
    const { duration: _duration, ...rest } = data.frames[rawIndex];
    frames.push(rest as TFrame);
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

  const legacySettings = (data.meta as { animationSettings?: LegacyAnimationSettings })
    ?.animationSettings;
  if (legacySettings) {
    if (legacySettings.fps) {
      Object.entries(legacySettings.fps).forEach(([name, value]) => {
        if (!validAnimationNames.has(name)) {
          return;
        }
        if (!Number.isFinite(value)) {
          return;
        }
        const clamped = clampLegacyFps(value);
        if (clamped === DEFAULT_ANIMATION_FPS) {
          return;
        }
        animationsMeta = mergeAnimationMeta(animationsMeta, name, (draft) => {
          draft.fps = clamped;
        });
      });
    }
    if (legacySettings.multipliers) {
      Object.entries(legacySettings.multipliers).forEach(([name, record]) => {
        if (!validAnimationNames.has(name) || !record) {
          return;
        }
        const entries = Object.entries(record)
          .map(([index, multiplier]) => ({ index: Number(index), multiplier }))
          .filter(({ index }) => Number.isFinite(index) && index >= 0);
        if (!entries.length) {
          return;
        }
        const maxIndex = entries.reduce((max, { index }) => Math.max(max, index), -1);
        const values = new Array(maxIndex + 1).fill(DEFAULT_MULTIPLIER);
        entries.forEach(({ index, multiplier }) => {
          values[index] = clampLegacyMultiplier(multiplier);
        });
        const normalized = normalizeLegacyMultipliers(values);
        if (!normalized.length) {
          return;
        }
        animationsMeta = mergeAnimationMeta(animationsMeta, name, (draft) => {
          draft.multipliers = normalized;
        });
      });
    }
  }

  const removedFrameIndexes = data.frames
    .map((_, rawIndex) => (frameIndexMap[rawIndex] === -1 ? rawIndex : -1))
    .filter((index) => index >= 0);

  const finalAnimationsMeta: SpriteAnimationsMeta = {};
  Object.entries(cleanedAnimations).forEach(([name, sequence]) => {
    const baseEntry = animationsMeta?.[name] ?? {};
    const finalEntry: SpriteAnimationMeta = {};
    if (typeof baseEntry.loop === 'boolean') {
      finalEntry.loop = baseEntry.loop;
    }
    if (typeof baseEntry.autoPlay === 'boolean') {
      finalEntry.autoPlay = baseEntry.autoPlay;
    }
    const fps = clampLegacyFps(baseEntry.fps ?? DEFAULT_ANIMATION_FPS);
    finalEntry.fps = fps;
    const sourceMultipliers = Array.isArray(baseEntry.multipliers) ? baseEntry.multipliers : [];
    const expanded: number[] = [];
    for (let i = 0; i < sequence.length; i += 1) {
      expanded.push(
        clampLegacyMultiplier(
          i < sourceMultipliers.length ? sourceMultipliers[i]! : DEFAULT_MULTIPLIER,
        ),
      );
    }
    finalEntry.multipliers = expanded;
    finalAnimationsMeta[name] = finalEntry;
  });

  let meta = data.meta ? { ...data.meta } : undefined;
  if (meta && 'animationSettings' in meta) {
    const { animationSettings, ...rest } = meta as Record<string, unknown> & {
      animationSettings?: LegacyAnimationSettings;
    };
    meta = rest;
  }

  return {
    ...data,
    meta,
    frames,
    animations: cleanedAnimations,
    animationsMeta: finalAnimationsMeta,
    frameIndexMap,
    removedFrameIndexes,
  };
};
