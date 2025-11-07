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

- `image`: `require()` や `SkImage` をそのまま渡せます。
- `data.frames`: `{ x, y, w, h, duration? }` の配列。`duration` を指定するとフレーム単位でミリ秒制御できます。
- `data.animations` / `animations`: `{ walk: [0, 1, 2] }` のようにアニメーション名とフレーム番号を紐づけます。ランタイムで差し替えたい場合は props の `animations` を渡してください。
- `data.animationsMeta` / `animationsMeta`: `{ blink: { loop: false } }` のようにアニメーション単位の設定を記述し、コンポーネント全体の `loop` 設定を上書きできます。
- `initialAnimation`: 再生開始時に選択するアニメーション名。指定が無い場合は最初のアニメーション、または素のフレーム順を使います。
- `autoplay`: コンポーネントがマウントされた直後に自動で再生するかどうか (デフォルト `true`)。
- `speedScale`: 再生速度の倍率。`2` で 2 倍速、`0.5` で半分の速度になります。
- `flipX` / `flipY`: 画像を左右・上下に反転して描画します (フレームデータの編集は不要)。
- `fps`: `duration` を指定していないフレームのデフォルト速度。
- `loop`: false の場合はアニメーションの最後のフレームで停止し、`onEnd` が一度だけ呼ばれます。
- `spriteScale`: 描画サイズを倍率指定したい場合に使用します (デフォルト 1)。

### 再生制御 (Imperative Handle)

`SpriteAnimator` は `ref` 経由で Imperative Handle を公開しているため、ボタンやエディタ UI から直接アニメーションを制御できます。

```tsx
import { SpriteAnimator, type SpriteAnimatorHandle } from "react-native-skia-sprite-animator";

const animatorRef = useRef<SpriteAnimatorHandle>(null);

return (
  <>
    <SpriteAnimator ref={animatorRef} data={heroData} image={heroSheet} autoplay={false} />
    <Button title="Play Idle" onPress={() => animatorRef.current?.play("idle")} />
    <Button title="Blink Once" onPress={() => animatorRef.current?.play("blink", { speedScale: 1.5 })} />
    <Button title="Pause" onPress={() => animatorRef.current?.pause()} />
    <Button title="Resume" onPress={() => animatorRef.current?.resume()} />
  </>
);
```

利用できるメソッド:

- `play(name?: string, opts?: { fromFrame?: number; speedScale?: number })`: 指定アニメーションを最初または任意のフレームから再生開始。
- `stop()`: 再生を止め、現在のアニメーションをフレーム `0` に戻す。
- `pause()` / `resume()`: 現在位置を維持したままタイマーを一時停止／再開。
- `setFrame(frameIndex: number)`: 再生状態に関わらず、アクティブなアニメーション内の任意フレームへジャンプ。
- `isPlaying()` / `getCurrentAnimation()`: 最新の再生状態やアニメーション名を参照（レンダーは発生しません）。

### SpriteData の JSON 例

`SpriteData` はそのまま JSON 保存しやすい構造になっています。

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
  animationsMeta: {
    walk: { loop: true },
    blink: { loop: false },
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
  animationsMeta: {
    blink: { loop: false },
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
