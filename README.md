# react-native-skia-sprite-animator

`react-native-skia-sprite-animator` is a UI-agnostic helper built for React Native/Expo projects that rely on [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/). It focuses on two things in v0.1: playing sprite-sheet animations (`SpriteAnimator`) and persisting sprite JSON + images to `expo-file-system` (`spriteStorage`).

## Installation

```bash
npm install react-native-skia-sprite-animator
# peer dependencies
npx expo install react-native @shopify/react-native-skia expo-file-system
```

> Tested with Expo SDK 52, React Native 0.82 (works with >=0.81), and React 19.

## Using SpriteAnimator

```tsx
import { SpriteAnimator, type SpriteData } from "react-native-skia-sprite-animator";
import heroSheet from "../assets/hero.png";

const heroData: SpriteData = {
  frames: [
    { x: 0, y: 0, w: 64, h: 64 },
    { x: 64, y: 0, w: 64, h: 64 },
    { x: 128, y: 0, w: 64, h: 64 },
  ],
  animations: {
    idle: [0, 1, 2, 1],
    blink: [2],
  },
  meta: {
    displayName: "Hero Sprite",
    origin: { x: 0.5, y: 1 },
  },
};

export function HeroPreview() {
  return (
    <SpriteAnimator
      image={heroSheet}
      data={heroData}
      initialAnimation="idle"
      animations={heroData.animations}
      autoplay
      fps={12}
      loop
      speedScale={1}
      flipX={false}
      flipY={false}
      spriteScale={1}
      style={{ width: 64, height: 64 }}
      onEnd={() => console.log("animation finished")}
    />
  );
}
```

- `image`: Accepts both `require()` assets and `SkImage` values.
- `data.frames`: Array of `{ x, y, w, h, duration? }`. `duration` (ms) overrides the default fps per frame.
- `data.animations` / `animations`: Map animation names to frame indexes (e.g. `{ walk: [0, 1, 2] }`). Pass an explicit `animations` prop when you need runtime overrides.
- `initialAnimation`: Name of the animation that should play first. Falls back to the first available animation or raw frame order.
- `autoplay`: Whether the component should start advancing frames immediately (defaults to `true`).
- `speedScale`: Multiplier applied to frame timing (`2` renders twice as fast, `0.5` slows down).
- `flipX` / `flipY`: Mirror the rendered sprite horizontally or vertically without changing the source image.
- `fps`: Default playback speed for frames without an explicit `duration`.
- `loop`: When `false`, stops on the last frame of the active animation and fires `onEnd` once.
- `spriteScale`: Scales the rendered width/height without modifying frame data (defaults to `1`).

### SpriteData JSON shape

`SpriteData` is intentionally JSON-friendly so you can persist/export it as-is:

```ts
const data: SpriteData = {
  frames: [
    { x: 0, y: 0, w: 64, h: 64, duration: 120 },
    { x: 64, y: 0, w: 64, h: 64 },
  ],
  animations: {
    walk: [0, 1],
    blink: [1],
  },
  meta: {
    displayName: "Hero Walk",
    imageUri: "file:///sprites/images/img_hero.png",
    origin: { x: 0.5, y: 1 },
    version: 2,
  },
};
```

## spriteStorage API

`spriteStorage` creates `/sprites/images`, `/sprites/meta`, and a `registry.json` file under `expo-file-system` so you can persist sprites alongside their metadata.

```ts
import {
  saveSprite,
  loadSprite,
  listSprites,
  deleteSprite,
  type SpriteSavePayload,
} from "react-native-skia-sprite-animator";

const payload: SpriteSavePayload = {
  frames,
  meta: {
    displayName: "Hero Walk",
    version: 1,
  },
  animations: {
    walk: [0, 1, 2],
  },
};

const saved = await saveSprite({
  imageTempUri: tempImageUri,
  sprite: payload,
});

const items = await listSprites();
const full = await loadSprite(saved.id);
await deleteSprite(saved.id);
```

### Configuration helpers

- `configureSpriteStorage({ rootDir })`: Override the default `documentDirectory/sprites/` root.
- `getSpriteStoragePaths()`: Inspect the internal directories and registry file path.
- `clearSpriteStorage()`: Remove the generated folders/registry (helpful for tests or resets).

## Development

```bash
npm install
npm run build
# optional: generate the same tarball npm publish would ship
npm pack
```

Build artifacts land in `dist/` (ESM + type declarations). Hooks/UI components are intentionally out of scope so each app can design its own editor. Editor APIs arrive in the next roadmap milestone.

## License

MIT
