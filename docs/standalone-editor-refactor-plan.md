# Standalone Editor Refactor Plan

## Goal
Transform the current `AnimationStudio` implementation into a library-ready toolkit where each feature block (timeline editor, metadata manager, sprite JSON tools, storage modal, etc.) can be consumed individually. Users should be able to embed the full studio or compose custom editors from the same primitives.

## Guiding Principles
- **Composable Blocks**: Split `AnimationStudio` into discrete components (TimelinePanel, FramePickerModal, StorageModal, MetadataModal, SpriteJsonModal, PreviewPane, PlaybackControls). Each block exposes clear props and callbacks.
- **State Hooks First**: Extract state orchestration into hooks (`useSpriteStorage`, `useMetadataManager`, `useTimelineEditor`). The bundled `AnimationStudio` component becomes a thin composition of these hooks plus UI.
- **Dependency Injection Everywhere**: Storage API, file pickers, initial templates, protected metadata keys, and preview assets must be provided via props or context so consumers can replace them.
- **Consistent Controls**: All action buttons use the same `IconButton` UI contract. Shared styles live in one place to avoid duplication.
- **Documented Contracts**: Each component/hook includes TypeScript definitions and README documentation describing required/optional props and expected behavior.

## Refactor Steps
1. **Catalog Features**: Map out every feature currently living inside `AnimationStudio` and group them into logical modules.
2. **Extract Hooks**: Move timeline, metadata, sprite JSON, storage logic into their own `use*` hooks. Ensure hooks have minimal UI assumptions.
3. **Publish Components**: Create standalone components for each feature block. They consume the corresponding hook output via props.
4. **Rewrite AnimationStudio**: Rebuild the studio component as a composition of the exported blocks. Keep it as a showcase/example.
5. **Update Documentation**: Add README sections for each block, plus migration notes for consumers.
6. **Testing & Storybook**: Provide Storybook (or equivalent) examples demonstrating both the full studio and individual block usage.

## Naming & File Layout
- `components/editor/TimelinePanel.tsx`
- `components/editor/FramePickerModal.tsx`
- `components/editor/StorageModal.tsx`
- `components/editor/MetadataModal.tsx`
- `components/editor/SpriteJsonModal.tsx`
- `hooks/useTimelineEditor.ts`
- `hooks/useMetadataManager.ts`
- `hooks/useSpriteStorage.ts`

## Deliverables
- Modular React components ready for library consumption.
- Comprehensive README updates and API reference.
- Example apps showcasing custom layouts built from the blocks.

## Working Tasks
- [x] Implement `useSpriteStorage` hook and refactor StoragePanel to consume it.
- [x] Extract metadata management hook + modal.
- [x] Split timeline/timeline controls into independent component & hook.
- [ ] Provide TypeScript types + docs for all exported pieces.
