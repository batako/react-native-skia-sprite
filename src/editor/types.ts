import type {
  SpriteAnimations,
  SpriteAnimationsMeta,
  SpriteFrame as RenderSpriteFrame,
} from '../SpriteAnimator';

/**
 * SpriteFrame extension that includes a stable identifier required by editor features.
 */
export interface SpriteEditorFrame extends RenderSpriteFrame {
  id: string;
}

/**
 * Metadata stored alongside the editor state.
 */
export interface SpriteEditorMeta {
  displayName?: string;
  imageUri?: string;
  version?: number;
  [key: string]: unknown;
}

/**
 * Selection tracks the ids of frames that are currently highlighted in the editor UI.
 */
export type SpriteEditorSelection = string[];

/**
 * Snapshot stored inside the undo/redo stacks.
 */
export interface SpriteEditorSnapshot {
  frames: SpriteEditorFrame[];
  animations: SpriteAnimations;
  animationsMeta?: SpriteAnimationsMeta;
  selected: SpriteEditorSelection;
  meta: SpriteEditorMeta;
}

/**
 * Full editor state including clipboard + history buffers.
 */
export interface SpriteEditorState extends SpriteEditorSnapshot {
  clipboard: SpriteEditorFrame[];
  history: SpriteEditorSnapshot[];
  future: SpriteEditorSnapshot[];
}
