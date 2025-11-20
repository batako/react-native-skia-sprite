# react-native-skia-sprite-animator

`react-native-skia-sprite-animator` は React Native / Expo + [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/) 向けの UI 非依存ヘルパーです。推奨ランタイムである `AnimatedSprite2D`、永続化ヘルパー（`spriteStorage`）、エディター用の headless API 群をまとめて提供します。旧来の `SpriteAnimator` コンポーネントは **v0.4.0** が最後のリリースで、**v0.4.1 以降で削除** される予定です。

## 機能一覧

- **AnimatedSprite2D** – エディター / テンプレートが出力する JSON をそのまま読み込み、オートプレイ、タイムラインの上書き、反転描画、`AnimatedSprite2DHandle` 経由の命令的制御に対応した軽量ランタイム。
- **SpriteAnimator**（レガシー。v0.4.0 で非推奨、v0.4.1+ で削除予定）– Skia 上で宣言的 / 命令的に再生できる旧来のコンポーネント。新規コードは `AnimatedSprite2D` を利用してください。
- **spriteStorage** – `saveSprite` / `loadSprite` / `listSprites` / `deleteSprite` と保存先設定ヘルパーで、Expo File System に JSON + メタデータを永続化。
- **エディター API** – `useSpriteEditor`（フレーム CRUD、選択、クリップボード、Undo/Redo、メタ編集）や `useTimelineEditor` / `useMetadataManager` / `useSpriteStorage` など UI 非依存の各種フック、`DefaultSpriteTemplate`（インポート / エクスポート）と `SpriteEditUtils`（グリッドスナップ、矩形マージ、ヒットテスト）。
- **Expo スタンドアロンエディタ** – `examples/standalone-editor/` 以下に、上記 API を 1 画面に集約したサンプルアプリを同梱。

> ⚠️ `SpriteAnimator` はバージョン **v0.4.0** まで利用できますが、**v0.4.1 以降で削除** されます。新しいコードは `AnimatedSprite2D` へ移行してください。

## インストール

```bash
npm install react-native-skia-sprite-animator
# peer dependency
npx expo install react-native @shopify/react-native-skia expo-file-system
```

> Expo SDK 52 / React Native 0.82（>=0.81 で動作確認済み）/ React 19 で検証済み。

## AnimatedSprite2D の使い方

```tsx
import { AnimatedSprite2D, type SpriteFramesResource } from 'react-native-skia-sprite-animator';
import spriteSheet from '../assets/hero.png';
import spriteJson from '../assets/hero.json';

const frames: SpriteFramesResource = {
  frames: spriteJson.frames,
  animations: spriteJson.animations,
  animationsMeta: spriteJson.animationsMeta,
  autoPlayAnimation: spriteJson.autoPlayAnimation ?? null,
};

export function HeroPreview() {
  return (
    <AnimatedSprite2D
      frames={frames}
      animation="idle"
      autoplay="idle"
      speedScale={1}
      centered
      style={{ width: 128, height: 128 }}
    />
  );
}
```

`AnimatedSprite2D` は `cleanSpriteData` や `buildAnimatedSpriteFrames`、Animation Studio のエクスポートが生成する `SpriteFramesResource` をそのまま受け取ります。命令的ハンドル（`play` / `pause` / `seekFrame` など）は `SpriteAnimator` と同じインターフェースで提供され、余分な Skia 設定を必要としません。

## SpriteAnimator の使い方（v0.4.0 で廃止予定）

```tsx
import { SpriteAnimator, type SpriteData } from 'react-native-skia-sprite-animator';
import heroSheet from '../assets/hero.png';

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
    displayName: 'Hero Sprite',
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
      speedScale={1}
      flipX={false}
      flipY={false}
      spriteScale={1}
      style={{ width: 64, height: 64 }}
      onEnd={() => console.log('animation finished')}
    />
  );
}
```

- `image`: `require()` や `SkImage` をそのまま渡せます。
- `data.frames`: `{ x, y, w, h, duration?, imageUri? }` の配列。`duration` は後方互換のために残しつつ、`imageUri` を指定するとフレーム単位で別画像を参照できます（未指定時は `image` prop を使用）。
- `data.animations` / `animations`: `{ walk: [0, 1, 2] }` のようにアニメーション名とフレーム番号を紐づけます。ランタイムで差し替えたい場合は props の `animations` を渡してください。
- `data.animationsMeta` / `animationsMeta`: 各アニメーションごとに `loop` / `fps` / `multipliers`（フレーム倍率）を設定するメタデータです。
- `data.autoPlayAnimation`: 初期表示時に自動再生させたいアニメーション名（任意）。
- `initialAnimation`: 再生開始時に選択するアニメーション名。指定が無い場合は最初のアニメーション、または素のフレーム順を使います。
- `speedScale`: 再生速度の倍率。`2` で 2 倍速、`0.5` で半分の速度になります。
- `flipX` / `flipY`: 画像を左右・上下に反転して描画します。
- `spriteScale`: 描画サイズを倍率指定したい場合に使用します（デフォルト 1）。
- `onAnimationEnd`: ループしないアニメーションが最後のフレームまで到達したときに一度だけ呼ばれます。
- `onFrameChange`: 描画フレームが変わるたびに `{ animationName, frameIndex, frameCursor }` を受け取ります。

### 再生制御 (Imperative Handle)

```tsx
import { SpriteAnimator, type SpriteAnimatorHandle } from 'react-native-skia-sprite-animator';

const animatorRef = useRef<SpriteAnimatorHandle>(null);

return (
  <>
    <SpriteAnimator ref={animatorRef} data={heroData} image={heroSheet} />
    <Button title="Play Idle" onPress={() => animatorRef.current?.play('idle')} />
    <Button
      title="Blink Once"
      onPress={() => animatorRef.current?.play('blink', { speedScale: 1.5 })}
    />
    <Button title="Pause" onPress={() => animatorRef.current?.pause()} />
  </>
);
```

利用できるメソッド:

- `play(name?: string, opts?: { fromFrame?: number; speedScale?: number })`: 指定アニメーションを冒頭または任意フレームから再生。
- `stop()`: 再生を止め、現在のアニメーションをフレーム `0` に戻します。
- `pause()`: 現在位置を維持したままタイマーを一時停止。
- `setFrame(frameIndex: number)`: アクティブなアニメーション内の任意フレームへジャンプ。
- `isPlaying()` / `getCurrentAnimation()`: 直近の再生状態とアニメーション名を取得。

### SpriteData の JSON 例

```ts
const data: SpriteData = {
  frames: [
    { x: 0, y: 0, w: 64, h: 64, duration: 120, imageUri: 'file:///sprites/images/hero.png' },
    { x: 64, y: 0, w: 64, h: 64, imageUri: 'file:///sprites/images/fx.png' },
  ],
  animations: {
    walk: [0, 1],
    blink: [1],
  },
  animationsMeta: {
    walk: { loop: true, fps: 8, multipliers: [1, 0.75] },
    blink: { loop: false, fps: 5, multipliers: [1] },
  },
  autoPlayAnimation: 'walk',
  meta: {
    displayName: 'Hero Walk',
    createdAt: 1730890000000,
    updatedAt: 1730893600000,
  },
};
```

> `cleanSpriteData` と既定テンプレートは、すべてのアニメーションに `fps` / `multipliers` を含めるため、追加設定なしで完全なタイミング情報を渡せます。

### フレームイベント

```ts
import type { SpriteAnimatorFrameChangeEvent } from 'react-native-skia-sprite-animator';

const handleFrameChange = (event: SpriteAnimatorFrameChangeEvent) => {
  console.log(event.animationName, event.frameIndex);
};

<SpriteAnimator onFrameChange={handleFrameChange} onAnimationEnd={(name) => console.log('finish', name)} />;
```

## spriteStorage API

`spriteStorage` は `expo-file-system` 上に `/sprites/meta` と `registry.json` を作成し、JSON とメタデータを永続化します。

```ts
import {
  saveSprite,
  loadSprite,
  listSprites,
  deleteSprite,
  type SpriteSavePayload,
} from 'react-native-skia-sprite-animator';

const payload: SpriteSavePayload = {
  frames,
  meta: {
    displayName: 'Hero Walk',
  },
  animations: {
    walk: [0, 1, 2],
  },
  animationsMeta: {
    blink: { loop: false },
  },
};

const saved = await saveSprite({ sprite: payload });

const items = await listSprites();
const full = await loadSprite(saved.id);
await deleteSprite(saved.id);
```

### 設定ヘルパー

- `configureSpriteStorage({ rootDir })`: デフォルトの `documentDirectory/sprites/` を変更。
- `getSpriteStoragePaths()`: 内部ディレクトリ / registry パスを確認。
- `clearSpriteStorage()`: 生成したフォルダ / registry を削除（テストやリセット用）。

## エディター API

`src/editor/` 配下には UI 非依存のエディター基盤が揃っています。

- `useSpriteEditor`: フレーム CRUD、選択、クリップボード、Undo/Redo、テンプレート連携を担う React Hook。
- `useEditorIntegration`: `useSpriteEditor` の状態をプレビュー（`SpriteAnimator` / `AnimatedSprite2D`）に橋渡しし、再生操作や速度、選択同期をまとめて返す Hook。
- `useTimelineEditor`: タイムラインの選択、クリップボード、レイアウト情報を管理するヘルパー。
- `useMetadataManager`: メタデータを `{ key, value }` の行として扱い、追加 / 削除 / 保存を一元管理。
- `useSpriteStorage`: `spriteStorage` を UI フレンドリーな状態管理でラップ（`status` や `isBusy`、`SpriteSummary` リストなど）。
- `AnimationStudio`: 上記 Hook を全てまとめた編集画面。フレーム一覧、メタデータ、JSON 入出力、ストレージ、タイムライン、プレビューを 1 つのコンポーネントで利用可能。
- `SpriteEditUtils`: `snapToGrid` / `normalizeRect` / `pointInFrame` / `mergeFrames` などの幾何ヘルパー。
- `DefaultSpriteTemplate`: エディター状態を `spriteStorage` 想定の JSON 形式に変換。

詳細は [docs/editor_api.ja.md](docs/editor_api.ja.md) を参照してください。

## スタンドアロンエディタ（Expo サンプル）

`examples/standalone-editor/` には全 API を 1 画面で確認できる Expo アプリを同梱しています。

- `useSpriteEditor` によるフレーム編集、選択、クリップボード、Undo/Redo、メタ編集、テンプレート対応の入出力。
- ライブ編集状態を `SpriteAnimator` / `AnimatedSprite2D` に流し込んだリアルタイムプレビュー。
- `DefaultSpriteTemplate` を使った JSON エクスポート / インポート UI。
- `spriteStorage` によるローカル永続化（保存 / 読み込み / 一覧 / 削除）。
- Skia キャンバス上での `SpriteEditUtils` デモ（グリッド、ヒットテスト、選択枠など）。

`examples/standalone-editor` で `npm install` → `npm run start` を実行すれば起動できます。メインパッケージを `link:../../` で参照しているため、ライブラリを変更すると即座にサンプルへ反映されます。

## Development

```bash
npm install
npm run build
# npm publish と同等の tarball を確認したい場合
npm pack
```

成果物は `dist/`（ESM + 型定義）に出力されます。Hook / UI コンポーネントは意図的に UI 非依存に保たれているため、各アプリは独自のエディタを組み立てられます。

## License

MIT
