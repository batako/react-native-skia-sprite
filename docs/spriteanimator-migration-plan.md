# SpriteAnimator 廃止に向けた移行方針

## 現状の課題

- Animation Studio では `SpriteAnimator` が `useEditorIntegration` のカーソル更新を担っており、現在は `SpriteAnimatorDriver` で背後再生してしのいでいる。
- `AnimatedSprite2DPreview` は同期描画モード（`frame={integration.frameCursor}`）で動作しており、AnimatedSprite2D 自身の自走モードと異なるコードパスを使っている。
- SpriteAnimator を完全に削除するには、タイムライン進行・エディタ API・プレビュー描画のすべてを AnimatedSprite2D 系のロジックへ置き換える必要がある。

## 移行ステップ（チェックリスト）

- [x] **共通 ticker の抽出**
  - `useAnimatedSpriteController` からフレーム進行ロジックを分離し、`fps`/`multipliers`/`speedScale`/`loop` を扱う ticker フックを用意する。
  - そのフックが `play/pause/stop/seek` と `onFrameChanged` を提供し、エディタ／ランタイムの両方で共有できるようにする。

- [x] **Integration の置き換え**
  - `useEditorIntegration` で `SpriteAnimatorHandle` 依存を削除し、上記 ticker を利用して `frameCursor` や `isPlaying` を管理する。
  - TimelinePanel / Animation Frames の操作も ticker 経由で synchronise する。

- [x] **プレビューの統一**
  - `AnimatedSprite2DPreview` に同期描画モードと自走モードを両立させ、Studio では前者・アプリでは後者を使えるようにする。
  - AnimatedSprite2D コンポーネント単体が fps/multiplier/loop を正しく再生することをテスト手順として明記する。

- [ ] **SpriteAnimatorDriver の削除 / SpriteAnimator の非推奨化**
  - 上記が完了し、`integration.frameCursor` が AnimatedSprite2D ベースで更新されるようになったら `SpriteAnimatorDriver` を廃止する。
  - `SpriteAnimator` コンポーネントは公開 API として引き続き提供し、プロダクト利用者には互換性を保証する。エディタでは未使用としつつ、ドキュメントで「AnimatedSprite2D への移行を推奨・SpriteAnimator は将来的に非推奨予定」と明記する。

> **メモ:** チェックが付いた項目は実施済み。未チェックの項目は今後の実装対象。README / editor_api.* / design docs でも同じタスク状況を反映させること。

## ドキュメント更新

- README / editor_api.*: AnimatedSprite2D を公式プレビューとして強調し、同期モードと自走モードの違いを説明する。
- `docs/animated-sprite2d-design.md`: PreviewPlayer から AnimatedSprite2D への移行だけでなく、ticker 共通化→SpriteAnimator 非推奨化までのロードマップを追記する。
- CHANGELOG / RELEASE_NOTES: SpriteAnimator が公開 API として残ること、ただし新機能は AnimatedSprite2D に集約することを案内する。

## 残タスク

- 上記の「移行ステップ」を実際の開発 TODO として落とし込んだもの。優先度や担当者を割り振る際はこのリストを起点にする。
- ticker 抽出＋ `useEditorIntegration` 更新
- `AnimatedSprite2DPreview` の自走モード追加
- `SpriteAnimatorDriver` / PreviewPlayer の完全削除
- テスト＆ドキュメント整備
