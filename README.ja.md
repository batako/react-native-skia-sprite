# react-native-skia-sprite-animator

`react-native-skia-sprite-animator` は React Native/Expo 上の [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/) を利用してスプライトアニメーションを再生し、`expo-file-system` に JSON/画像を保存するための UI非依存ライブラリです。v0.1 では「再生 (SpriteAnimator)」と「保存 (spriteStorage)」の 2 機能を提供します。

## インストール

```bash
npm install react-native-skia-sprite-animator
# peer dependency
npx expo install react-native @shopify/react-native-skia expo-file-system
```

> Expo SDK 52 / React Native 0.82 / React 19 で検証しています。

## SpriteAnimator の使い方

```tsx
import { SpriteAnimator } from "react-native-skia-sprite-animator";
import heroSheet from "../assets/hero.png";

const frames = [
  { x: 0, y: 0, w: 64, h: 64 },
  { x: 64, y: 0, w: 64, h: 64 },
  { x: 128, y: 0, w: 64, h: 64 },
];

export function HeroPreview() {
  return (
    <SpriteAnimator
      image={heroSheet}
      data={{ frames }}
      fps={12}
      loop
      style={{ width: 64, height: 64 }}
      onEnd={() => console.log("animation finished")}
    />
  );
}
```

- `image`: `require()` や `SkImage` をそのまま渡せます。
- `data.frames`: `{ x, y, w, h, duration? }` の配列。`duration` を指定するとフレーム単位でミリ秒制御できます。
- `fps`: `duration` を指定していないフレームのデフォルト速度。
- `loop`: false の場合は最後のフレームで停止し、`onEnd` が一度だけ呼ばれます。
- `spriteScale`: 描画サイズを倍率指定したい場合に使用します (デフォルト 1)。

## spriteStorage API

`spriteStorage` は `expo-file-system` 上に `/sprites/images` と `/sprites/meta` を作成し、`registry.json` にレジストリを保存します。

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

### 設定オプション

- `configureSpriteStorage({ rootDir })`: 標準の `documentDirectory/sprites/` 以外に保存したい場合に使用します。
- `getSpriteStoragePaths()`: ライブラリが使用中のパスを返します。
- `clearSpriteStorage()`: 生成したフォルダとレジストリを削除します (テストやリセット用)。

## 開発

```bash
npm install
npm run build
```

`dist/` 以下に ESM/CommonJS 互換の出力を生成します。hook や UI はアプリ側で実装してください。次バージョンでは editor API を追加予定です。

## ライセンス

MIT
