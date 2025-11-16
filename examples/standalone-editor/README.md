# Standalone Sprite Editor (Expo)

This Expo app demonstrates every public API shipped in `react-native-skia-sprite-animator`. It is the canonical sample for v0.4.x and later releases and mirrors the editor architecture described in the project roadmap.

## Features

- Real-time editing powered by `useSpriteEditor`
- Canvas playback via `SpriteAnimator`
- Export/import panel that previews spriteStorage JSON
- Local persistence backed by `spriteStorage`
- Utility helpers from `SpriteEditUtils` (grid, snapping, hit testing)
- Metadata editing (name, origin, other custom fields)

## Getting Started

```bash
npm install
npm run start
```

The example links to the library source through `link:../../`, so any local edits in the repository instantly show up inside the editor.

> **Important:** Metro watches the whole workspace. Before starting the example, keep `react-native-skia-sprite-animator/node_modules` removed so React/Skia dependencies are not duplicated. Reinstall there only when building the library, then delete the folder again before running the Expo app.

## Directory Layout

```
examples/standalone-editor/
  App.tsx
  src/
    screens/EditorScreen.tsx
    components/
      SpriteCanvasView.tsx
      FrameList.tsx
      PlaybackControls.tsx
      TemplatePanel.tsx
      StoragePanel.tsx
      MetaEditor.tsx
    hooks/
      useEditorIntegration.ts
  assets/
    sample-sprite.png
```

Each component is intentionally simple and focuses on exposing the corresponding API surface. Non-essential styling is kept lightweight so the code remains approachable.
