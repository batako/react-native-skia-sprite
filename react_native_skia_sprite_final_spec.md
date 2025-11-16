# 💡 react-native-skia-sprite 最終方針

## 🔗 概要

**react-native-skia-sprite** は Expo/React Native 環境で使える、Skia 上で動作する **スプライトアニメーション用ライブラリ** です。

ユーザーがアプリ内で画像（SpriteSheet）と JSON をアップロードし、アニメーションを作成、再生できる構成を目指します。

---

## 🛠️ ライブラリの純淨性

- **UIは含まない。** デザインやエディタUIは各アプリ側が実装する前提。
- ライブラリは「アニメーション再生」と「編集基盤」と「ファイル管理」の3つの機能のみを提供します。
- ユーザーは、提供された Hooks と API を用いて自分の UI/操作派生を組み立てます。

---

## 🛠️ 構成モジュール

```
react-native-skia-sprite/
├─ SpriteAnimator.tsx           # Skia上で再生コンポーネント
├─ editor/
│  ├─ useSpriteEditor.ts        # 編集ロジックを提供
│  ├─ SpriteEditUtils.ts        # 矩形操作やスナップ等のユーティリティ
│  ├─ templates/
│  │   ├─ defaultTemplate.ts    # 標準JSONテンプレート
│  │   └─ customTemplate.ts     # 利用者が定義できるカスタムテンプレート
│  ├─ types.ts
├─ storage/
│  ├─ spriteStorage.ts          # FileSystem 上のセーブ・ロードAPI
│  └─ registry.json             # 内部レジストリ
└─ index.ts
```

---

## 🔧 主な機能

### 1. SpriteAnimator

Skia Canvas 上で画像を切り出し、指定フレームで再生する基盤コンポーネント。

```tsx
<SpriteAnimator
  image={require('./sprite.png')}
  data={{
    frames: [
      { x: 0, y: 0, w: 64, h: 64 },
      { x: 64, y: 0, w: 64, h: 64 },
    ],
  }}
  loop
  onEnd={() => console.log('done')}
/>
```

### 2. useSpriteEditor

UIなしで、編集状態やフレーム操作を管理する Hook。

```tsx
const { frames, selectedIndex, selectFrame, addFrame, updateFrame, deleteFrame, exportJSON } =
  useSpriteEditor(template);
```

### 3. SpriteEditUtils

- 点上選択判定 (`pointInFrame()`)
- グリッド調整 (`snapToGrid()`)
- 抽出矩形正規化 (`normalizeRect()`)
- 複数フレームの合成 (`mergeFrames()`)

### 4. SpriteTemplate API

編集結果(JSON)の出力フォーマットを自由に変えられるテンプレート機能。

```ts
const customTemplate: SpriteTemplate = {
  name: 'withAnimations',
  build: ({ displayName, frames, extra }) => ({
    id: crypto.randomUUID(),
    meta: { displayName, category: extra?.category ?? 'default' },
    frames,
    animations: extra?.animations ?? {},
  }),
};
```

`useSpriteEditor(customTemplate)` で使用すると、`exportJSON()` 時に出力構造が変わる。

### 5. spriteStorage

Expo FileSystem 上で JSON とメタデータを管理する API。

- `/sprites/meta/` にJSON保存
- `index.json` でリスト管理 (レジストリ)

```ts
await saveSprite({ sprite: json });
const sprite = await loadSprite(spriteId);
```

---

## 🛠️ JSON 構造 (デフォルト)

```json
{
  "id": "uuid",
  "meta": {
    "displayName": "Hero Walk",
    "createdAt": 1730890000000,
    "updatedAt": 1730893600000
  },
  "frames": [
    { "x": 0, "y": 0, "w": 64, "h": 64 },
    { "x": 64, "y": 0, "w": 64, "h": 64 }
  ]
}
```

- 最小構成は `frames`のみで動作。
- `animations` や `origin`などは各自のテンプレートで追加可能。

---

## 🛠️ テンプレート機能の使い方

```tsx
const editor = useSpriteEditor(customTemplate);

const json = editor.exportJSON({
  displayName: 'Enemy Run',
  imageUri: spriteImageUri,
  extra: { animations: { run: [0, 1, 2] } },
});
```

---

## 🌐 名前と配布

- npm package name: **react-native-skia-sprite**
- 現時点でnpmに同名パッケージは存在せず使用可能。
- 公開時: MIT ライセンスを推奨。

---

## 🔹 今後のロードマップ

| バージョン | 主要機能                                     |
| ---------- | -------------------------------------------- |
| v0.1       | SpriteAnimator + spriteStorage               |
| v0.2       | SpriteAnimator AnimatedSprite2D パリティ対応 |
| v0.3       | useSpriteEditor + SpriteEditUtils            |
| v0.4       | SpriteTemplate API 実装 (テンプレート可変更) |
| v0.5       | npm公開 + デモUI(サンプルエディタ)           |

---

## 🔑 結論

> **react-native-skia-sprite** は、「再生」「編集ロジック」「保存・JSONテンプレートベース」のみを提供する、単純で強力なSkiaスプライトエンジン基盤とする。
