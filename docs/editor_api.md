# Editor API Reference

v0.3 introduces headless editor primitives so you can build custom sprite editors without relying on prebuilt UI. The API surface consists of three pieces:

1. `useSpriteEditor` – React hook that manages frames, selection, clipboard, history, and template-based import/export.
2. `SpriteEditUtils` – geometry helpers for snapping, hit-testing, and layout math.
3. Templates – `SpriteTemplate` interface plus `DefaultSpriteTemplate` for spriteStorage-compatible JSON.

> **Note:** The legacy `SpriteAnimator` component stays available through v0.4.0 but will be **removed starting with v0.4.1**. Prefer the newer `AnimatedSprite2D` runtime when wiring previews or playback controls.

---

## useSpriteEditor hook

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

### Options

| Option                    | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `initialState`            | Seeds frames/animations/meta when the hook mounts.    |
| `historyLimit`            | Maximum undo depth (defaults to 50).                  |
| `trackSelectionInHistory` | When `true`, selection changes create undo snapshots. |

### Returned API

- `state`: Full editor state (`frames`, `animations`, `animationsMeta`, `selected`, `clipboard`, `history`, `future`, `meta`). Selections reference frame ids to keep them stable even when frames are reordered.
- `addFrame(frame, options?)`: Inserts a frame (auto-generates ids) and shifts animation indexes when needed.
- `updateFrame(id, partial)`: Patches coordinates/duration without touching ids.
- `removeFrame(id)` / `removeFrames(ids)`: Removes frames and cleans animation references.
- `reorderFrames(from, to)`: Moves frames while preserving animation references.
- `setSelection(ids, { append })`, `selectFrame`, `selectAll`, `clearSelection`: Selection utilities for building range/toggle UIs.
- `copySelected`, `cutSelected`, `pasteClipboard({ index })`: Clipboard helpers that duplicate frames with fresh ids when pasted.
- `undo`, `redo`, `canUndo`, `canRedo`: History helpers (snapshots are lightweight and respect `historyLimit`).
- `setAnimations`, `setAnimationsMeta`, `updateMeta`: Control higher-level sprite metadata.
- `exportJSON()`: Serialises the current snapshot into spriteStorage-compatible JSON.
- `importJSON(data)`: Rehydrates editor state from spriteStorage-compatible payloads (includes undo support so imports can be reverted).
- `reset(nextState?)`: Replaces the current editor contents.

### Clipboard example

```ts
const { state, copySelected, pasteClipboard } = useSpriteEditor();

const copy = () => {
  if (!state.selected.length) return;
  copySelected();
};

const paste = () => {
  pasteClipboard(); // inserts after the last selected frame or at the end
};
```

---

## useTimelineEditor hook

`useTimelineEditor` is a lightweight utility hook for timeline-oriented UIs. It keeps track of the selected timeline index, clipboard payloads, and layout measurements so you can drive custom toolbars or scrollers.

```ts
import { useTimelineEditor } from 'react-native-skia-sprite-animator';

const timeline = useTimelineEditor({ onBeforeSelectionChange: commitPendingEdits });
```

### Options

| Option                    | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| `initialSelectedIndex`    | Pre-selects a timeline index when the hook mounts.               |
| `onBeforeSelectionChange` | Callback fired before `setSelectedIndex` mutates internal state. |

### Returned API

- `selectedIndex`: Currently selected timeline index (`null` when nothing is selected).
- `setSelectedIndex(updater)`: Updates the selection (either via value or updater function).
- `clipboard` / `hasClipboard`: Stores cloned frame ids for copy/paste operations.
- `copySelection(sequence, overrideIndex?)`: Copies the frame id at the current (or provided) index.
- `clearClipboard()`: Clears the stored clipboard payload.
- `setMeasuredHeight(height)` / `updateFilledHeight(updater)`: Track scroll container measurements to keep animation lists aligned next to the timeline.

Use it alongside `useSpriteEditor` to keep toolbar buttons, contextual menus, and multiplier inputs in sync with the actual cursor inside `SpriteAnimator`.

---

## useMetadataManager hook

`useMetadataManager` normalizes meta entries stored in `SpriteEditorApi.state.meta` so you can edit simple key/value pairs in a modal without writing boilerplate. It only surfaces primitive types (string/number/boolean) to prevent surprises when serializing to JSON.

```ts
import { useMetadataManager } from 'react-native-skia-sprite-animator';

const { entries, addEntry, updateEntry, removeEntry, applyEntries } = useMetadataManager({
  editor,
  protectedKeys: ['displayName'],
});
```

### Returned API

- `entries`: Array of `{ id, key, value, readOnly }` describing editable fields.
- `addEntry()`: Appends a blank row.
- `updateEntry(id, 'key' | 'value', text)`: Updates the draft value for a given row (ignores read-only entries).
- `removeEntry(id)`: Removes rows that aren't protected.
- `resetEntries()`: Resyncs drafts from the editor state (useful when reopening modals).
- `applyEntries()`: Persists primitive keys back into `editor.updateMeta`, removing keys that were deleted unless they are in `protectedKeys`.

---

## useSpriteStorage hook

`useSpriteStorage` wraps the spriteStorage helpers with UI-friendly state, making it easy to build save/load dialogs or integrate with custom persistence backends.

```ts
import { useSpriteStorage } from 'react-native-skia-sprite-animator';

const storage = useSpriteStorage({
  editor,
  onSpriteSaved: (summary) => console.log('saved', summary.displayName),
});
```

### Options

| Option           | Description                                                                 |
| ---------------- | --------------------------------------------------------------------------- |
| `editor`         | Required `SpriteEditorApi` instance whose state should be persisted.        |
| `controller`     | Overrides the default storage helpers (list/load/save/delete) if necessary. |
| `onSpriteSaved`  | Called whenever a sprite is saved or overwritten.                           |
| `onSpriteLoaded` | Called whenever a sprite is loaded into the editor.                         |

### Returned API

- `sprites`: Array of `SpriteSummary` entries fetched from storage.
- `status`: Human-readable status/error string for UI messages.
- `isBusy`: Boolean you can use to disable buttons while async work is happening.
- `refresh()`: Reloads the storage registry.
- `saveSpriteAs(name)`: Persists the current editor state under a new name.
- `loadSpriteById(id)`: Loads a sprite and imports it into the editor.
- `overwriteSprite(id, name)`: Replaces an existing sprite by id.
- `renameSprite(id, name)`: Updates the stored display name without touching frames.
- `deleteSpriteById(id, displayName)`: Removes a sprite from storage.

You can provide a custom `controller` to back these operations with your own filesystem, HTTP API, or cloud storage layer.

---

## useEditorIntegration hook

`useEditorIntegration` ties `useSpriteEditor` state to an animation preview. Historically this targeted the `SpriteAnimator` component, but you can feed the returned `runtimeData` into `AnimatedSprite2D` as well. It exposes imperative handlers (play/pause/seek), playback speed, selected animations, and refs so that your preview widgets stay synchronized with the editor state.

```tsx
import {
  useEditorIntegration,
  useSpriteEditor,
  SpriteAnimator,
} from 'react-native-skia-sprite-animator';

const editor = useSpriteEditor();
const integration = useEditorIntegration({ editor });

return (
  <SpriteAnimator
    ref={integration.animatorRef}
    image={spriteSheet}
    data={integration.runtimeData}
    onFrameChange={integration.onFrameChange}
  />
);
```

The returned object (exported as `EditorIntegration`) includes helpers such as `playForward`, `playReverse`, `seekFrame`, `setActiveAnimation`, `setSpeedScale`, `onFrameChange`, `onAnimationEnd`, and the `runtimeData` snapshot consumed by the animator/preview components.

---

## AnimationStudio component

`AnimationStudio` is a ready-made editor surface that combines every hook above: frame list, metadata editor, sprite JSON import/export, sprite storage modal, timeline panel, and the SpriteAnimator preview. Bring your own editor instance, integration hook result, and sprite sheet image.

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

Additional props:

- `storageController`: Override the save/load/list/delete helpers when you want to persist somewhere other than `expo-file-system`.
- `protectedMetaKeys`: Prevent specific metadata keys from being deleted in the Metadata editor (defaults to `['displayName', 'createdAt', 'updatedAt']`).

---

## Serialization helpers

`exportJSON()` and `importJSON()` always use the built-in `DefaultSpriteTemplate`, which mirrors the spriteStorage payload (frames are exported without ids). Use it whenever you need to persist editor state or preview the JSON handed to `SpriteAnimator`.

```ts
const payload = editor.exportJSON();
await saveSprite({ sprite: payload });

editor.importJSON(payload); // undoable
```

If you need to strip transient fields before saving, run the payload through `cleanSpriteData`.

---

## Geometry helpers (`SpriteEditUtils`)

| Helper                                 | Description                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `snapToGrid(value, gridSize, origin?)` | Snaps scalar values to a grid (origin defaults to `0`).                        |
| `normalizeRect(rect)`                  | Ensures width/height are positive by adjusting `x/y` when needed.              |
| `pointInFrame(point, rect)`            | Hit-test helper (inclusive start, exclusive end).                              |
| `mergeFrames(frames)`                  | Returns the bounding rectangle that covers every frame (or `null` when empty). |

Geometry helpers are UI-agnostic utilities intended for marquee tools, selection overlays, and drag handlers.

---

## Migration notes (v0.2 → v0.3)

- Renderer inputs remain unchanged: `SpriteAnimator` and `spriteStorage` still expect the v0.2 schema.
- Editor state tracks frames by `id` internally, but `exportJSON()` strips ids during export so runtime components continue to work without modification.
- Use `DefaultSpriteTemplate.fromJSON()` to load legacy spriteStorage payloads into the editor before editing.
- Undo depth now defaults to 50 snapshots; adjust `historyLimit` if you need more/less aggressive memory usage.
