# スタンドアロンエディタリファクタリング方針

## 目的
現在の `AnimationStudio` 実装を、ライブラリが提供する再利用可能なツールキットへと再構築し、各機能ブロック（タイムラインエディタ、メタデータ管理、Sprite JSON ツール、ストレージモーダル等）を個別に利用できるようにする。利用者は完全版のスタジオを使うことも、自分の UI に合わせて必要なパーツだけ組み合わせることも可能にする。

## 基本方針
- **ブロック化**: `AnimationStudio` を構成する機能をタイムライン／フレームピッカー／メタデータ／ストレージ／プレビュー等に分割し、それぞれ独立したコンポーネントとして公開する。
- **状態管理フック優先**: 各機能の状態制御 (`useSpriteStorage`, `useMetadataManager`, `useTimelineEditor` など) をカスタムフックへ切り出し、UI からロジックを分離する。
- **依存注入の徹底**: ストレージAPI、ファイルピッカー、初期テンプレート、保護メタキーなどを props／context 経由で差し替え可能にする。
- **コントロールの統一**: アクションボタン／フォーム等の UI は統一スタイル (`IconButton` 等) を採用し、どのブロックでも同じ見た目・操作性になるようにする。
- **契約の文書化**: 各コンポーネント／フックの props やデータ構造を TypeScript 型と README で明記し、利用者がカスタム UI を構築しやすいようにする。

## リファクタリングステップ
1. **機能の棚卸し**: `AnimationStudio` に内包されている機能と依存関係を洗い出し、モジュール分割の単位を決める。
2. **カスタムフックの抽出**: タイムライン制御、メタデータ管理、Sprite JSON 操作、ストレージ連携などを `use*` フックとして切り出す。
3. **コンポーネントの公開**: 抽出したフックを props で受け取る UI コンポーネント（TimelinePanel、MetadataModal 等）を作成し、ライブラリの公開 API に加える。
4. **AnimationStudio の再構築**: 切り出したフック／コンポーネントを組み合わせたサンプル実装として `AnimationStudio` を再実装する。
5. **ドキュメント更新**: README や専用ドキュメントに、各ブロック／フックの使用方法、差し替え例、移行ガイドを追記する。
6. **デモとテスト**: Storybook 等で部分的な利用例を示し、ユニットテストや E2E テストで動作を検証する。

## ファイル構成例
- `components/editor/TimelinePanel.tsx`
- `components/editor/FramePickerModal.tsx`
- `components/editor/StorageModal.tsx`
- `components/editor/MetadataModal.tsx`
- `components/editor/SpriteJsonModal.tsx`
- `hooks/useTimelineEditor.ts`
- `hooks/useMetadataManager.ts`
- `hooks/useSpriteStorage.ts`

## 成果物
- ライブラリ利用者が自由に組み合わせられるモジュール式コンポーネント／フック群。
- API の TypeScript 定義と README ドキュメント。
- カスタムエディタ例や全機能を統合した `AnimationStudio` サンプル。

## 作業タスク
- [x] `useSpriteStorage` フックを実装し、StorageModal がそれを利用するようリファクタする。
- [x] メタデータ管理フックと MetadataModal を抽出。
- [ ] タイムライン関連の UI とロジックを独立コンポーネント＋フックへ分割。
- [ ] すべての公開 API に関する型定義と詳細ドキュメントを作成。
