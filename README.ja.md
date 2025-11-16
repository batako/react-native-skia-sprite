# react-native-skia-sprite-animator

`react-native-skia-sprite-animator` は React Native/Expo 上の [@shopify/react-native-skia](https://shopify.github.io/react-native-skia/) を利用してスプライトアニメーションを再生し、`expo-file-system` に JSON/画像を保存するための UI非依存ライブラリです。「再生 (SpriteAnimator)」「保存 (spriteStorage)」「エディター API」をまとめて提供します。

## 機能一覧

- **SpriteAnimator**: Skia Canvas 上での宣言的/命令的な再生、フレームイベント、反転描画、速度スケール、アニメーション別のメタデータなどをサポート。
- **spriteStorage**: `saveSprite` / `loadSprite` / `listSprites` / `deleteSprite` および保存先設定ヘルパーにより、JSON と画像を Expo File System に永続化。
- **エディター API**: `useSpriteEditor`（フレーム CRUD・選択・クリップボード・Undo/Redo・メタ編集・テンプレート import/export）、`SpriteTemplate` / `DefaultSpriteTemplate`、`SpriteEditUtils`（スナップ・矩形マージ・ヒットテスト）。
- **Expo スタンドアロンエディタ**: `examples/standalone-editor/` に、上記すべての機能を 1 画面で体験できるデモアプリを同梱。

## インストール

```bash
npm install react-native-skia-sprite-animator
# peer dependency
npx expo install react-native @shopify/react-native-skia expo-file-system
```

> Expo SDK 52 / React Native 0.82 / React 19 で検証しています。

## SpriteAnimator の使い方

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
      autoplay
      loop
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
- `data.frames`: `{ x, y, w, h, duration? }` の配列。`duration` を指定するとフレーム単位でミリ秒制御でき、未指定時は内部のデフォルトタイミング（約 12fps 相当）が使われます。
- `data.animations` / `animations`: `{ walk: [0, 1, 2] }` のようにアニメーション名とフレーム番号を紐づけます。ランタイムで差し替えたい場合は props の `animations` を渡してください。
- `data.animationsMeta` / `animationsMeta`: `{ blink: { loop: false } }` のようにアニメーション単位の設定を記述し、コンポーネント全体の `loop` 設定を上書きできます。
- `initialAnimation`: 再生開始時に選択するアニメーション名。指定が無い場合は最初のアニメーション、または素のフレーム順を使います。
- `autoplay`: コンポーネントがマウントされた直後に自動で再生するかどうか (デフォルト `true`)。
- `speedScale`: 再生速度の倍率。`2` で 2 倍速、`0.5` で半分の速度になります。
- `flipX` / `flipY`: 画像を左右・上下に反転して描画します (フレームデータの編集は不要)。
- `loop`: false の場合はアニメーションの最後のフレームで停止し、`onEnd` が一度だけ呼ばれます。
- `spriteScale`: 描画サイズを倍率指定したい場合に使用します (デフォルト 1)。
- `onAnimationEnd`: ループしないアニメーションが最後のフレームまで到達したときに一度だけ呼ばれます（引数はアニメーション名、または `null`）。
- `onFrameChange`: 描画フレームが変わるたびに `{ animationName, frameIndex, frameCursor }` を受け取ります。

### 再生制御 (Imperative Handle)

`SpriteAnimator` は `ref` 経由で Imperative Handle を公開しているため、ボタンやエディタ UI から直接アニメーションを制御できます。

```tsx
import { SpriteAnimator, type SpriteAnimatorHandle } from 'react-native-skia-sprite-animator';

const animatorRef = useRef<SpriteAnimatorHandle>(null);

return (
  <>
    <SpriteAnimator ref={animatorRef} data={heroData} image={heroSheet} autoplay={false} />
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

- `play(name?: string, opts?: { fromFrame?: number; speedScale?: number })`: 指定アニメーションを最初または任意のフレームから再生開始。非ループのアニメが最後で停止した後でも `{ fromFrame: 0 }` を渡せば再度冒頭から再生できます。
- `stop()`: 再生を止め、現在のアニメーションをフレーム `0` に戻す。
- `pause()`: 現在位置を維持したままタイマーを一時停止します（再開する場合は `play()` を使ってください）。
- `setFrame(frameIndex: number)`: 再生状態に関わらず、アクティブなアニメーション内の任意フレームへジャンプ。
- `isPlaying()` / `getCurrentAnimation()`: 最新の再生状態やアニメーション名を参照（レンダーは発生しません）。

### SpriteData の JSON 例

`SpriteData` はそのまま JSON 保存しやすい構造になっています。

````ts
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

### フレームイベント

`onFrameChange` / `onAnimationEnd` を使うと、再生状況を UI に反映できます。フレームイベントの型は `SpriteAnimatorFrameChangeEvent` として公開しています。

```ts
import type { SpriteAnimatorFrameChangeEvent } from "react-native-skia-sprite-animator";

const handleFrameChange = (event: SpriteAnimatorFrameChangeEvent) => {
  console.log(event.animationName, event.frameIndex);
};

<SpriteAnimator onFrameChange={handleFrameChange} onAnimationEnd={(name) => console.log("finish", name)} />;
````

````

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
````

### 設定オプション

- `configureSpriteStorage({ rootDir })`: 標準の `documentDirectory/sprites/` 以外に保存したい場合に使用します。
- `getSpriteStoragePaths()`: ライブラリが使用中のパスを返します。
- `clearSpriteStorage()`: 生成したフォルダとレジストリを削除します (テストやリセット用)。

## エディター API

UI を持たないエディター用ツール群も `src/editor/` で提供しています。これらを組み合わせれば、各プロダクトに最適なエディター UI を自由に構築できます。

- `useSpriteEditor`: フレーム一覧、選択状態、クリップボード、Undo/Redo、テンプレートベースの import/export を一括で管理する React Hook。UI には一切依存しないため、ボタンやジェスチャー、ショートカットに自由に接続できます。
- `SpriteEditUtils`: `snapToGrid`、`normalizeRect`、`pointInFrame`、`mergeFrames` など、エディターで使い回せるジオメトリ系のヘルパー群。
- `SpriteTemplate` / `DefaultSpriteTemplate`: エディター状態を `spriteStorage` と同じ JSON へ変換するためのインターフェースと標準テンプレート。独自テンプレートの実装も可能です。

詳しいサンプルやオプションの一覧は [docs/editor_api.ja.md](docs/editor_api.ja.md) を参照してください。

## スタンドアロンエディタ (Expo サンプル)

`examples/standalone-editor/` には、ライブラリの全機能を組み合わせた Expo アプリを用意しています。エディタの各パネルや `SpriteAnimator` プレビューが連動するため、導入前の確認や実装の参考に利用できます。

含まれる主な要素:

- `useSpriteEditor` によるフレーム CRUD／選択／クリップボード／Undo/Redo／メタデータ編集／テンプレート import/export。
- `SpriteAnimator` と同期する再生パネル（再生/停止/シーク/速度調整/選択フレームへのジャンプ）。
- `DefaultSpriteTemplate` とカスタムテンプレートの切り替え、エクスポート JSON プレビュー、インポートテキストエリア。
- `spriteStorage` 連携の保存・読み込み・削除・レジストリ更新、メタデータのバージョン管理。
- `SpriteEditUtils` を使ったグリッド、ヒットテスト、選択境界の描画。

利用手順 (`examples/standalone-editor/` ディレクトリで実行):

```bash
npm install
npm run start
```

パッケージは `link:../../` で参照しているため、ライブラリ本体のコードを編集すると即座にサンプルにも反映されます。

## 開発

```bash
npm install
npm run build
# npm publish と同じ tarball を生成したい場合
npm pack
```

ビルド成果物は `dist/` (ESM + 型定義) に出力されます。レンダリング用コンポーネントとストレージヘルパーに加えて、エディター API は完全に UI 非依存なのでアプリ側で自在に組み立てられます。

## ライセンス

MIT
