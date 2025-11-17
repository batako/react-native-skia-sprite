declare module 'expo-document-picker' {
  export interface DocumentPickerAsset {
    name?: string;
    size?: number;
    uri?: string;
    fileCopyUri?: string | null;
    mimeType?: string | null;
  }

  export interface DocumentPickerResult {
    canceled: boolean;
    assets?: DocumentPickerAsset[];
  }

  export interface GetDocumentOptions {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
  }

  export function getDocumentAsync(options?: GetDocumentOptions): Promise<DocumentPickerResult>;
}
