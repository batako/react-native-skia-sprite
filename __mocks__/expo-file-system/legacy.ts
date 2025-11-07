type Entry = {
  isDirectory: boolean;
  data?: string;
};

/* eslint-disable jsdoc/require-jsdoc */
const store = new Map<string, Entry>();

const DEFAULT_DOCUMENT_DIR = 'file:///mock/documents/';
const DEFAULT_CACHE_DIR = 'file:///mock/cache/';

export let documentDirectory: string | null = DEFAULT_DOCUMENT_DIR;
export let cacheDirectory: string | null = DEFAULT_CACHE_DIR;

export const __setWritableDirectories = (doc: string | null, cache: string | null) => {
  documentDirectory = doc;
  cacheDirectory = cache;
};

export const __resetMockFileSystem = () => {
  store.clear();
  documentDirectory = DEFAULT_DOCUMENT_DIR;
  cacheDirectory = DEFAULT_CACHE_DIR;
};

export const __writeMockFile = (uri: string, data: string) => {
  store.set(uri, { isDirectory: false, data });
};

export const __writeMockDirectory = (uri: string) => {
  store.set(uri, { isDirectory: true });
};

const ensureDirectory = (uri: string) => {
  if (!store.has(uri)) {
    store.set(uri, { isDirectory: true });
  }
};

export const getInfoAsync = async (uri: string) => {
  const entry = store.get(uri);
  return {
    exists: Boolean(entry),
    isDirectory: entry?.isDirectory ?? false,
    uri,
  };
};

export const makeDirectoryAsync = async (uri: string, _options?: { intermediates?: boolean }) => {
  ensureDirectory(uri);
};

export const writeAsStringAsync = async (uri: string, contents: string) => {
  store.set(uri, { isDirectory: false, data: contents });
};

export const readAsStringAsync = async (uri: string) => {
  const entry = store.get(uri);
  if (!entry || entry.isDirectory) {
    throw new Error(`File not found: ${uri}`);
  }
  return entry.data ?? '';
};

export const deleteAsync = async (uri: string, _options?: { idempotent?: boolean }) => {
  store.delete(uri);
};

export const copyAsync = async ({ from, to }: { from: string; to: string }) => {
  const source = store.get(from);
  if (!source || source.isDirectory) {
    throw new Error(`Source file missing: ${from}`);
  }
  store.set(to, { isDirectory: false, data: source.data });
};
