# AnimatedSprite2D パリティ作業計画

Godot の `AnimatedSprite2D` に近い操作性を `react-native-skia-sprite-animator` の `SpriteAnimator` へ持たせるための詳細タスクをまとめる。

## ゴール

1. 複数アニメーションを名前で切り替えられる `SpriteFrames` 相当のデータ構造を提供する。
2. `play`, `stop`, `pause`, `resume`, `setFrame`, `isPlaying` などの制御 API を提供する。
3. `onAnimationEnd`, `onFrameChange` などのイベントフックを提供する。
4. Expo/React Native アプリで即座に検証できるサンプル（PiyoSpriteDemo）を更新し、README で手順を公開する。

## 段階的なタスク

### Phase 1: データモデルと props の拡張

- [x] `SpriteAnimatorProps` に `animations?: Record<string, number[]>` を追加。
- [x] `initialAnimation?: string`, `autoplay?: boolean` の見直し（初期アニメーションを名前で指定する）。
- [x] `speedScale?: number`, `flipX?: boolean`, `flipY?: boolean` を props で受け付ける。
- [x] `SpriteData` 型を拡張し、JSON エクスポートしやすい構造を README / 型定義に記載。

### Phase 2: 再生制御ロジック

- [x] hooks: `const [animState, setAnimState] = useState({ name, playing, frameCursor, speed });` を導入。
- [x] `useEffect` のタイマーは「現在のアニメーションに属するフレーム列」を参照するようリファクタ。
- [x] `loop` はアニメーションごとに指定できるようにし、`animationsMeta?: Record<string, { loop?: boolean }>` を検討。
- [x] `play(name: string, opts?: { fromFrame?: number })` の実装:
  - 既存のタイマーをクリア
  - 指定アニメーションの最初（または `fromFrame`）から再生
  - state を更新して再生ループを再開
- [x] `stop()`→ playing=false, カーソル維持 or 0 に戻す (オプション)
- [x] `pause()` / `resume()`→ タイマー停止と再開
- [x] `setFrame(frameIndex: number)`→ playing 状態に関係なくフレームを即時反映

### Phase 3: Imperative handle / events

- [x] `useImperativeHandle(ref, () => ({ play, stop, pause, resume, setFrame, isPlaying, getCurrentAnimation }))` を実装。
- [x] 新しい props: `onAnimationEnd?: (name: string) => void`, `onFrameChange?: (payload) => void`。
- [x] `frame change` は `useEffect` で frameIndex が変わる度に呼ぶ (無限ループ防止に注意)。

### Phase 4: テスト・サンプル・ドキュメント

- [ ] Jest:
  - `play('walk')` を呼んだら state.name が `walk` になる
  - `stop()` で playing=false
  - `onAnimationEnd` がループしないアニメで呼ばれる
  - `setFrame()` を呼んだ後、`currentFrame` が更新される
- [ ] `PiyoSpriteDemo` にボタンを追加し、`play('walk')` / `play('blink')` 等を切り替えられるようにする。
- [ ] README に API セクションを追加（props・ImperativeHandle の使用例）。
- [ ] `spriteStorage` の JSON テンプレートに `animations` を追加し、保存・読み込みの互換性を確保。

## 依存や注意点

- `react-native` >= 0.81 で動作確認済み。スレッドをまたがないよう `useSharedValue` 等は使わず、JS 側の state 管理で完結させる。
- アニメーション数が多い場合もあるため、`frames` のコピーを避ける（カスタム hook で `useMemo` を使って index → frame 参照を高速化）。
- 今後、`speedScale` や `flipX` のような描画系 props を `Skia.Image` の `transform` で適用するときは、`Group` + `scale` などの性能に注意する。

## マイルストン目安

| フェーズ | 内容 | 担当/期限 |
| --- | --- | --- |
| Phase 1 | データモデル拡張 & props 整理 | TBA |
| Phase 2 | 再生制御ロジック | TBA |
| Phase 3 | Imperative handle / イベント | TBA |
| Phase 4 | テスト、サンプル更新、README整備 | TBA |

このドキュメントは進捗に合わせて更新し、GitHub Issues や PR にリンクする想定。
