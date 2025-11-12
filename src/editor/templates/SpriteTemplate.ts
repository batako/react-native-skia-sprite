import type { SpriteEditorSnapshot } from '../types';

/**
 * Interface used to translate editor state into serializable formats.
 */
export interface SpriteTemplate<TData = unknown> {
  /** Template identifier, e.g. "spriteStorage". */
  name: string;
  /** Template semantic version for downstream tooling. */
  version: number;
  /** Converts the editor snapshot into exportable JSON. */
  toJSON: (state: SpriteEditorSnapshot) => TData;
  /**
   * Optional import hook allowing editor state to be reconstructed
   * from template-specific payloads.
   */
  fromJSON?: (data: TData) => Partial<SpriteEditorSnapshot> | null |
    undefined;
}
