type Entry = {
  isDirectory: boolean;
  data?: string;
};

const store = new Map<string, Entry>();

const DEFAULT_DOCUMENT_DIR = 'file:///mock/documents/';
const DEFAULT_CACHE_DIR = 'file:///mock/cache/';

/** Mock value for expo-file-system documentDirectory. */
export let documentDirectory: string | null = DEFAULT_DOCUMENT_DIR;
/** Mock value for expo-file-system cacheDirectory. */
export let cacheDirectory: string | null = DEFAULT_CACHE_DIR;

/**
 * Overrides the writable directories used by the mock environment.
 */
export const __setWritableDirectories = (doc: string | null, cache: string | null) => {
  documentDirectory = doc;
  cacheDirectory = cache;
};

/**
 * Clears all mock entries and restores the default directories.
 */
export const __resetMockFileSystem = () => {
  store.clear();
  documentDirectory = DEFAULT_DOCUMENT_DIR;
  cacheDirectory = DEFAULT_CACHE_DIR;
};

/**
 * Creates a mock file entry with the provided contents.
 */
export const __writeMockFile = (uri: string, data: string) => {
  store.set(uri, { isDirectory: false, data });
};

/**
 * Creates a mock directory entry.
 */
export const __writeMockDirectory = (uri: string) => {
  store.set(uri, { isDirectory: true });
};

const ensureDirectory = (uri: string) => {
  if (!store.has(uri)) {
    store.set(uri, { isDirectory: true });
  }
};

/**
 * Mimics expo-file-system getInfoAsync.
 */
export const getInfoAsync = async (uri: string) => {
  const entry = store.get(uri);
  return {
    exists: Boolean(entry),
    isDirectory: entry?.isDirectory ?? false,
    uri,
  };
};

/**
 * Mimics expo-file-system makeDirectoryAsync.
 */
export const makeDirectoryAsync = async (uri: string, _options?: { intermediates?: boolean }) => {
  ensureDirectory(uri);
};

/**
 * Writes text data into a mock file.
 */
export const writeAsStringAsync = async (uri: string, contents: string) => {
  store.set(uri, { isDirectory: false, data: contents });
};

/**
 * Reads text data from a mock file.
 */
export const readAsStringAsync = async (uri: string) => {
  const entry = store.get(uri);
  if (!entry || entry.isDirectory) {
    throw new Error(`File not found: ${uri}`);
  }
  return entry.data ?? '';
};

/**
 * Deletes a mock file or directory.
 */
export const deleteAsync = async (uri: string, _options?: { idempotent?: boolean }) => {
  store.delete(uri);
};

/**
 * Copies a mock file entry.
 */
export const copyAsync = async ({ from, to }: { from: string; to: string }) => {
  const source = store.get(from);
  if (!source || source.isDirectory) {
    throw new Error(`Source file missing: ${from}`);
  }
  store.set(to, { isDirectory: false, data: source.data });
};
