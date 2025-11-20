# Editor API リファレンス

UI を含まないエディター用プリミティブを利用することで、任意の React Native/Expo アプリ上にカスタムスプライトエディターを構築できます。公開されている API は主に次の 3 つです。

1. `useSpriteEditor` – フレーム管理や選択、クリップボード、Undo/Redo、spriteStorage 互換の import/export を提供する React Hook。
2. `SpriteEditUtils` – スナップやヒットテストなど、エディターでよく使うジオメトリ系ヘルパー。
3. シリアライズヘルパー – `DefaultSpriteTemplate` が spriteStorage 互換の JSON を生成/復元します。

> **注意:** 旧来の `SpriteAnimator` コンポーネントは v0.4.0 までは利用できますが、v0.4.1 以降で削除予定の deprecated 機能です。今後は `AnimatedSprite2D` を利用してください。

---

## useSpriteEditor Hook

```tsx
import { useSpriteEditor } from 'react-native-skia-sprite-animator';

const EditorScreen = () => {
  const editor = useSpriteEditor({ historyLimit: 100 });

  const handleAdd = () => {
    editor.addFrame({ x: 0, y: 0, w: 64, h: 64 });
  };

  return (
    <>
      <Button title="Add Frame" onPress={handleAdd} />
      <Button title="Undo" onPress={editor.undo} disabled={!editor.canUndo} />
    </>
  );
};
```

### オプション

| オプション                | 説明                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `initialState`            | マウント時の初期フレーム/アニメーション/メタ情報を指定します。 |
| `historyLimit`            | Undo スタックの最大保持数 (デフォルト 50)。                    |
| `trackSelectionInHistory` | `true` の場合、選択の変化も Undo 対象になります。              |

### 返される API

- `state`: フレーム、アニメーション、選択、クリップボード、履歴、メタ情報を含む完全な状態。
- `addFrame(frame, options?)`: フレームを追加して ID を自動採番し、アニメーション内の参照を再計算します。
- `updateFrame(id, partial)`: フレームの座標や duration を更新します (ID は保持)。
- `removeFrame(id)` / `removeFrames(ids)`: フレームを削除し、アニメーション参照もクリーンアップします。
- `reorderFrames(from, to)`: フレーム順序を並び替えてもアニメーション参照を保護します。
- `setSelection(ids, { append })` / `selectFrame` / `selectAll` / `clearSelection`: 選択状態を制御するユーティリティ。
- `copySelected` / `cutSelected` / `pasteClipboard({ index })`: クリップボード操作。ペースト時は ID を振り直します。
- `undo` / `redo` / `canUndo` / `canRedo`: Undo/Redo 操作と状態。
- `setAnimations` / `setAnimationsMeta` / `updateMeta`: アニメーションやメタ情報の更新。
- `exportJSON()`: スナップショットを spriteStorage 互換 JSON へシリアライズします。
- `importJSON(data)`: spriteStorage 互換 JSON から状態を復元します (Undo 対応)。
- `reset(nextState?)`: エディター内容を置き換えます。

### クリップボード利用例

```ts
const { state, copySelected, pasteClipboard } = useSpriteEditor();

const copy = () => {
  if (!state.selected.length) return;
  copySelected();
};

const paste = () => {
  pasteClipboard(); // 選択済みフレームの直後、または末尾に挿入
};
```

---

## useTimelineEditor Hook

`useTimelineEditor` はタイムライン UI 向けの軽量状態フックです。選択中のインデックス、コピー用のクリップボード、タイムラインの高さなどをまとめて管理できるため、再生ツールバーやスクロールビューと連携しやすくなります。

```ts
import { useTimelineEditor } from 'react-native-skia-sprite-animator';

const timeline = useTimelineEditor({ onBeforeSelectionChange: commitMultiplier });
```

### オプション

| オプション                | 説明                                                  |
| ------------------------- | ----------------------------------------------------- |
| `initialSelectedIndex`    | フック初期化時に選択済みとするインデックス。          |
| `onBeforeSelectionChange` | `setSelectedIndex` 実行前に呼び出されるコールバック。 |

### 返される API

- `selectedIndex` / `setSelectedIndex`: 現在のタイムライン選択と更新ロジック。
- `clipboard` / `hasClipboard`: コピー済みフレーム ID の配列と有無。
- `copySelection(sequence, override?)`: 現在の（または指定した）位置のフレームをコピーします。
- `clearClipboard()`: クリップボードをクリア。
- `setMeasuredHeight(height)` / `updateFilledHeight(updater)`: タイムライン列とアニメーション列の高さを揃えるための測定値を記録。

`useSpriteEditor` と組み合わせて、TimelinePanel やカスタム再生 UI の状態管理に利用してください。

---

## useMetadataManager Hook

`useMetadataManager` はエディターメタ情報を「キー／値」ペアとして編集するためのフックです。数値・文字列・真偽値のみを扱い、protected キーを指定すると読み取り専用として扱います。

```ts
import { useMetadataManager } from 'react-native-skia-sprite-animator';

const { entries, addEntry, updateEntry, removeEntry, resetEntries, applyEntries } =
  useMetadataManager({ editor, protectedKeys: ['displayName'] });
```

### 返される API

- `entries`: `{ id, key, value, readOnly }` 形式の配列。モーダルやフォームにそのままバインドできます。
- `addEntry()` / `removeEntry(id)`: 行の追加・削除。
- `updateEntry(id, field, text)`: 指定行のキーまたは値を更新。
- `resetEntries()`: `editor.state.meta` から再読み込み。
- `applyEntries()`: 変更内容を `editor.updateMeta` へ反映し、削除されたキーも整理します。

---

## useSpriteStorage Hook

`useSpriteStorage` は `spriteStorage` の list/load/save/delete を React Hooks でラップしたものです。ステータス文字列やビジーフラグも提供するため、保存ダイアログやストレージブラウザを簡単に構築できます。

```ts
import { useSpriteStorage } from 'react-native-skia-sprite-animator';

const storage = useSpriteStorage({
  editor,
  onSpriteSaved: (summary) => console.log('saved', summary.displayName),
});
```

### オプション

| オプション       | 説明                                                         |
| ---------------- | ------------------------------------------------------------ |
| `editor`         | 永続化したい `SpriteEditorApi` インスタンス。                |
| `controller`     | list/load/save/delete を差し替える際に指定するカスタム実装。 |
| `onSpriteSaved`  | セーブ／上書き完了時に呼ばれるコールバック。                 |
| `onSpriteLoaded` | ロード完了時に呼ばれるコールバック。                         |

### 返される API

- `sprites`: `SpriteSummary` の配列（表示名、作成日時、更新日時を含む）。
- `status`: UI に表示できるステータス／エラーメッセージ。
- `isBusy`: 非同期処理中フラグ。
- `refresh()`: レジストリを再読み込み。
- `saveSpriteAs(name)` / `overwriteSprite(id, name)`: 現在のエディター状態を保存。
- `loadSpriteById(id)`: 指定 ID のスプライトを読み込み、エディターに import。
- `renameSprite(id, name)`: 保存済みスプライトの表示名だけを更新。
- `deleteSpriteById(id, displayName)`: ストレージから削除。

`controller` を差し替えれば、任意のストレージ（クラウド API やユーザー独自のファイルシステム）にも簡単に対応できます。

---

## useEditorIntegration Hook

`useEditorIntegration` は `useSpriteEditor` の状態とプレビュー用アニメーションコンポーネント（従来の `SpriteAnimator` や推奨される `AnimatedSprite2D`）を結び付けるためのフックです。`playForward` / `playReverse` / `seekFrame` といった再生操作、`animatorRef`、現在のアニメーション名、速度倍率などをまとめて返すため、プレビュー UI が常に編集内容と同期します。

```tsx
import {
  useEditorIntegration,
  useSpriteEditor,
  SpriteAnimator,
} from 'react-native-skia-sprite-animator';

const editor = useSpriteEditor();
const integration = useEditorIntegration({ editor });

<SpriteAnimator
  ref={integration.animatorRef}
  image={spriteSheet}
  data={integration.runtimeData}
  onFrameChange={integration.onFrameChange}
/>;
```

戻り値（`EditorIntegration` 型）は、再生ハンドラーや選択管理・速度調整・プレビュー用データ (`runtimeData`) などをすべて含みます。

---

## AnimationStudio コンポーネント

`AnimationStudio` は、フレーム一覧・メタデータ編集・Sprite JSON import/export・spriteStorage モーダル・タイムライン・プレビューを 1 つにまとめた完成済み UI です。`useSpriteEditor` と `useEditorIntegration` の戻り値、表示したい画像を渡すだけでアプリに組み込めます。

```tsx
import {
  AnimationStudio,
  useEditorIntegration,
  useSpriteEditor,
} from 'react-native-skia-sprite-animator';

const editor = useSpriteEditor();
const integration = useEditorIntegration({ editor });

<AnimationStudio editor={editor} integration={integration} image={spriteSheet} />;
```

- `storageController`: 保存/読み込み/削除/一覧を独自ストレージへ差し替える場合に渡します。
- `protectedMetaKeys`: Metadata エディター上で削除させたくないキーを指定します（デフォルトは `['displayName', 'createdAt', 'updatedAt']`）。

---

## シリアライズヘルパー

`exportJSON()` / `importJSON()` は常に組み込みの `DefaultSpriteTemplate` を使用し、spriteStorage 互換の JSON をやり取りします。SpriteAnimator へのプレビューや `spriteStorage` 連携はこの JSON をそのまま使えば OK です。

```ts
const payload = editor.exportJSON();
await saveSprite({ sprite: payload });

editor.importJSON(payload); // Undo 可能
```

保存前に一部のキーを削除したい場合は `cleanSpriteData` を通して正規化してください。

---

## ジオメトリヘルパー (`SpriteEditUtils`)

| ヘルパー                               | 説明                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| `snapToGrid(value, gridSize, origin?)` | 指定グリッドへ値をスナップさせます (origin 既定値は `0`)。   |
| `normalizeRect(rect)`                  | 幅/高さが負数でも正規化し、`x/y` を補正します。              |
| `pointInFrame(point, rect)`            | ポイントが矩形内にあるか判定します (始点含む・終点除外)。    |
| `mergeFrames(frames)`                  | 与えられた矩形すべてを含むバウンディングボックスを返します。 |

これらのヘルパーはマーキー選択やハンドル描画など、UI 実装でよく使う下支えロジックとして活用できます。

---

## 移行メモ

- ランタイム側 (`SpriteAnimator` / `spriteStorage`) は従来と同じ JSON スキーマを受け付けます。
- エディター内部ではフレームごとに `id` を保持しますが、`exportJSON()` は出力時に ID を取り除くため、既存ランタイムを変更する必要はありません。
- 既存の `spriteStorage` JSON を編集したい場合は `DefaultSpriteTemplate.fromJSON()` で読み込み、編集後に再度 `exportJSON` してください。
- Undo スタックはデフォルトで 50 件です。`historyLimit` を調整してメモリ使用量とトレードオフできます。
