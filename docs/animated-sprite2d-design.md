# AnimatedSprite2D 設計書

> Animation Studio で作成した JSON をそのまま受け取り、各フレームが固有の画像・サイズ・オフセットを持つケースでも Godot `AnimatedSprite2D` と同等の操作感で再生できる Skia コンポーネントを実装する。

## 0. コンポーネントのゴール

- **完全独立**: `SpriteAnimator` に依存せず、ステート管理・タイミング・描画を `AnimatedSprite2D` 単体で完結させる。
- **フレーム毎の画像差異**: 各フレームは別 URI/require/SkImage を参照でき、旧 PreviewPlayer（現在は廃止）で採用していた「最大フレームサイズ = Canvas サイズ」のレイアウトを尊重する。
- **Godot ライクな API**: `playing`/`animation`/`frame`/`speedScale`/`centered`/`flipH`/`flipV`/`offset` を持ち、imperative handle で `play`/`stop`/`pause`/`seekFrame` を制御できる。
- **JSON 互換**: Animation Studio (`cleanSpriteData`) が吐く `SpriteFramesResource` をそのまま渡せる。`autoplay` prop は JSON の `autoPlayAnimation` を書き換えるだけで描画には影響させない。
- **スタンドアロンエディタとの整合**: AnimatedSprite2DPreview（同期モード/自走モードを切り替え可能なプレビュー）で「Editor で見たままの挙動」を保証する。

## 1. 非ゴール

- スプライトシートの自動分割（既に Animation Studio 側で実施済み）
- Reanimated 等の外部タイムラインとの同期（`speedScale` 以上の制御は将来検討）
- レガシー `SpriteAnimator` との互換ラッパー（別途ユーティリティで提供予定）

## 2. データモデル

```ts
import type { SkImage } from '@shopify/react-native-skia';

type FrameImageSource =
  | { type: 'uri'; uri: string }
  | { type: 'require'; assetId: number }
  | { type: 'skImage'; image: SkImage };

interface AnimatedSpriteFrame {
  id: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  duration?: number; // ms
  offset?: { x: number; y: number };
  image: FrameImageSource;
}

interface SpriteFramesResource {
  frames: AnimatedSpriteFrame[];
  animations: Record<string, number[]>; // frame indexes
  animationsMeta?: Record<string, { loop?: boolean; fps?: number; multipliers?: number[] }>;
  autoPlayAnimation?: string | null;
  meta?: Record<string, unknown>;
}
```

- `cleanSpriteData` は Animation Studio JSON を `SpriteFramesResource` へ正規化し、余分なフレームを削除する。
- 各 `AnimatedSpriteFrame` は Animation Studio 内部 ID を `id` に持ち、UI 側での差分追跡に利用する。

## 3. 外部 API

```ts
interface AnimatedSprite2DProps {
  frames: SpriteFramesResource;
  animation?: string | null; // 描画したいアニメーション名。未指定時は autoPlay → 先頭。
  autoplay?: string | null; // frames.autoPlayAnimation を上書きするだけ（プレビューUIの設定保存用）。
  playing?: boolean; // true: 再生, false: ポーズ。未指定なら内部 state。
  frame?: number | null; // 明示的に表示する frame index（playing=false 扱い）。
  speedScale?: number; // デフォルト 1.0。全体速度を倍率で調整。
  centered?: boolean; // true（既定）：最大幅/高さの中心に揃える。false: 左上基準。
  flipH?: boolean;
  flipV?: boolean;
  offset?: { x: number; y: number }; // 全体オフセット。frame.offset と加算。
  onAnimationFinished?: (name: string | null) => void;
  onFrameChanged?: (payload: { animationName: string | null; frameIndex: number }) => void;
  style?: StyleProp<ViewStyle>;
}

interface AnimatedSprite2DHandle {
  play: (name?: string | null) => void;
  stop: () => void;
  pause: () => void;
  seekFrame: (frameIndex: number) => void;
  getCurrentAnimation: () => string | null;
  isPlaying: () => boolean;
}
```

### Prop/Handle の挙動

- `animation` を指定すると内部状態より優先され、変更時に即座に遷移する。
- `frame` を指定した瞬間に `playing=false` 扱いとなり、ティッカーは止まる。
- `speedScale` は per-frame `duration` を優先し、未設定の場合は `animationsMeta.fps/multipliers` → デフォルト FPS (12)。
- Imperative handle は props 非制御（`playing`/`animation` が undefined）の場合のみ内部状態を書き換える。
- `autoplay` は prop 変化時に `frames.autoPlayAnimation` を更新するだけで、即時再生には影響しない。

## 4. 内部アーキテクチャ

```
AnimatedSprite2D (forwardRef)
 ├─ useAnimatedSpriteController
 │    ├─ useAnimationState (animationName, playing, forcedFrame, callbacks)
 │    ├─ useFrameCache (image URI/require → SkImage, WeakMap + ref cache)
 │    ├─ useTicker (requestAnimationFrame, speed & loop handling)
 │    └─ useSceneBounds (max width/height, centered offsets)
 └─ AnimatedSprite2DView (Skia Canvas)
      ├─ Canvas size = centered ? sceneBounds : currentFrame size
      ├─ Group + transform (flipH/flipV/offset)
      └─ drawImageRect(frame)
```

### useAnimationState

- 入力: props (`frames`, `animation`, `autoplay`, `playing`, `frame`, `speedScale`) とコールバック。
- 責務:
  - 初期アニメーションを `animation` → `autoplay` → `frames.autoPlayAnimation` → 先頭アニメの順に決定。
  - `autoplay` 変更検知 → `frames.autoPlayAnimation` に直接書き戻し。
  - `frame` 指定時はその index を優先して描画し、ティッカーを停止。解除されたら `playing` state を復帰。
  - `onFrameChanged` / `onAnimationFinished` を Godot ライクなタイミングで呼び出す。
  - Imperative handle 向けに `play/stop/pause/seekFrame` を提供し、props 制御モードでは no-op。

### useFrameCache

- `FrameImageSource` の `uri`/`require` をキーに `WeakMap` で SkImage をキャッシュ。
- 未ロードのキーは `useImage` で非同期取得し、完了後に再レンダー。
- `skImage` ソースは即座に描画可能。

### useTicker

- `requestAnimationFrame` で `delta` を積算し、現在のフレーム duration を超えたらカーソルを進める。
- フレーム duration 計算順: `frame.duration` → `animationsMeta[name]?.fps`/`multipliers` → `DEFAULT_FPS`。
- ループしないアニメ (meta.loop=false) が終端に到達した場合: `playing=false` へ遷移し、`onAnimationFinished` を発火。
- `speedScale` を clamp (0.01–32) し、負荷の高い極端な設定を防ぐ。

### useSceneBounds

- 全フレームの幅/高さを走査し `maxWidth`/`maxHeight` を算出。
- `centered` true: Canvas サイズ = `maxWidth`/`maxHeight`。
- false: Canvas サイズ = 現在のフレームサイズ（存在しない場合は `maxWidth/Height`）。

## 5. 描画処理（AnimatedSprite2DView）

- `Canvas` の `style.width/height` に scene bounds を設定し、React Native 側のレイアウトにも反映する。
- `Group` 内で `translate` → `scale` を用い、`flipH` と `flipV` を実現。flip ありの際はキャンバス全体を軸に反転させる。
- 描画位置 = 基準座標 + `frame.offset` + `props.offset`。
  - `centered=true` の場合: `(canvasSize - frameSize) / 2` を基準にする。
- 画像描画は `SkiaImage` を使用し、将来 sprite sheet を扱う場合は `drawImageRect` + `clipRect` に展開可能なよう `x/y` 情報も保持しておく。

## 6. Animation Studio との統合

1. Studio で JSON を作成し `editor.exportJSON()` → `cleanSpriteData` に通す。
2. `AnimatedSprite2D` に `frames={resource}` を渡し、`animation`/`playing` 等を UI から操作。
3. Studio UI の `autoplay` トグルを動かすと `frames.autoPlayAnimation` に即時反映され、保存時に JSON へ書き戻される。
4. Standalone Editor のプレビュー画面は `AnimatedSprite2DPreview`（同期/自走モード）のみで構成し、実際のランタイム挙動をリアルタイムで確認できるようにする。

## 7. 実装ステップ

1. **型定義**: `FrameImageSource` / `AnimatedSpriteFrame` / `SpriteFramesResource` / `AnimatedSprite2DProps` / `AnimatedSprite2DHandle` を `src/editor/animatedSprite2dTypes.ts` に追加。
2. **フック実装**: `useAnimationState` / `useFrameCache` / `useTicker` / `useSceneBounds` を `src/editor/hooks/animatedSprite2d` 階層に作成。
3. **描画コンポーネント**: `AnimatedSprite2DView` を用意し、Skia Canvas + flip/offset ロジックを集約。
4. **コンテナ**: `AnimatedSprite2D.tsx` で props → controller → view を接続し、imperative handle を forward。
5. **エディタ統合**: Standalone Editor (`AnimatedSprite2DPreview`, `AnimationStudio`, docs) を更新し、新コンポーネントを使用。
6. **ドキュメント**: README / editor_api.\* / Animation Studio docs に API 例と注意点を追記。
7. **テスト**: フレーム遷移・loop 解除・flip/offset を jest + storybook 的プレビューで検証し、`npx eslint` を通す。

## 8. 将来拡張

- `origin`/`pivot` のサポート（Godot `offset + centered` との互換）。
- `useAnimatedSpriteController` の外部公開により、Reanimated 連携やタイムラインスクラブを容易にする。
- 画像プリロード/遅延読み込み戦略（大量フレームを持つアセットの UX 改善）。
- `SpriteAnimator` ↔ `AnimatedSprite2D` 変換ヘルパーの提供。
