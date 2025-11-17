import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { MacWindow } from './MacWindow';

const APP_FILES_DIR = `${FileSystem.documentDirectory ?? ''}app_files`;

export interface FileBrowserModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenFile: (uri: string) => void;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
}

interface FileEntry {
  name: string;
  uri: string;
  size?: number;
  modified?: number;
  isImage: boolean;
}

export const FileBrowserModal = ({
  visible,
  onClose,
  onOpenFile,
  allowedMimeTypes,
  allowedExtensions,
}: FileBrowserModalProps) => {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const shouldRender = visible;

  const ensureDirectory = useCallback(async () => {
    try {
      const dirInfo = await FileSystem.getInfoAsync(APP_FILES_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(APP_FILES_DIR, { intermediates: true });
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to access app files directory.');
    }
  }, []);

  const normalizedExtensions = React.useMemo(() => {
    if (!allowedExtensions?.length) {
      return undefined;
    }
    return allowedExtensions.map((ext) => ext.trim().toLowerCase().replace(/^\./, '.'));
  }, [allowedExtensions]);

  const matchesImageExtension = useCallback((name: string) => {
    return /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff)$/i.test(name);
  }, []);

  const mimeMatchesFilter = useCallback(
    (mime: string | undefined, name?: string): boolean => {
      if (!allowedMimeTypes?.length) {
        return true;
      }
      if (!mime) {
        if (
          name &&
          allowedMimeTypes.some((pattern) => pattern === 'image/*' || pattern.startsWith('image/'))
        ) {
          return matchesImageExtension(name);
        }
        return false;
      }
      return allowedMimeTypes.some((pattern) => {
        if (!pattern) {
          return false;
        }
        if (pattern === '*/*') {
          return true;
        }
        const [patternType, patternSub = '*'] = pattern.split('/');
        const [mimeType, mimeSub = '*'] = mime.split('/');
        const typeMatches = patternType === '*' || patternType === mimeType;
        const subMatches = patternSub === '*' || patternSub === mimeSub;
        return typeMatches && subMatches;
      });
    },
    [allowedMimeTypes, matchesImageExtension],
  );

  const extensionMatchesFilter = useCallback(
    (name: string): boolean => {
      if (!normalizedExtensions?.length) {
        return true;
      }
      const lowerName = name.toLowerCase();
      return normalizedExtensions.some((ext) => lowerName.endsWith(ext));
    },
    [normalizedExtensions],
  );

  const shouldIncludeFile = useCallback(
    (mime: string | undefined, name: string): boolean => {
      const hasMimeFilter = Boolean(allowedMimeTypes?.length);
      const hasExtensionFilter = Boolean(normalizedExtensions?.length);
      if (hasMimeFilter && hasExtensionFilter) {
        return mimeMatchesFilter(mime, name) && extensionMatchesFilter(name);
      }
      if (hasMimeFilter) {
        return mimeMatchesFilter(mime, name);
      }
      if (hasExtensionFilter) {
        return extensionMatchesFilter(name);
      }
      return true;
    },
    [allowedMimeTypes, extensionMatchesFilter, mimeMatchesFilter, normalizedExtensions],
  );

  const refreshEntries = useCallback(async () => {
    try {
      setIsLoading(true);
      await ensureDirectory();
      const files = await FileSystem.readDirectoryAsync(APP_FILES_DIR);
      const nextEntries: FileEntry[] = [];
      for (const name of files) {
        const uri = `${APP_FILES_DIR}/${name}`;
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) {
          continue;
        }
        const metadata = info as FileSystem.FileInfo & {
          mimeType?: string;
          modificationTime?: number;
          size?: number;
        };
        const mimeType = metadata.mimeType ?? '';
        const isImage =
          mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|heic|heif|tiff)$/i.test(name);
        if (!shouldIncludeFile(mimeType || undefined, name)) {
          continue;
        }
        nextEntries.push({
          name,
          uri,
          size: metadata.size ?? undefined,
          modified: metadata.modificationTime ?? undefined,
          isImage,
        });
      }
      nextEntries.sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0));
      setEntries(nextEntries);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load files.');
    } finally {
      setIsLoading(false);
    }
  }, [ensureDirectory, shouldIncludeFile]);

  useEffect(() => {
    if (visible) {
      refreshEntries();
    }
  }, [refreshEntries, visible]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleUpload = useCallback(async () => {
    try {
      const pickerTypes =
        allowedMimeTypes && allowedMimeTypes.length > 0 ? allowedMimeTypes : ['*/*'];
      const result = await DocumentPicker.getDocumentAsync({
        type: pickerTypes.length === 1 ? pickerTypes[0] : pickerTypes,
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) {
        return;
      }
      const asset = result.assets[0];
      const sourceUri = asset.fileCopyUri ?? asset.uri;
      if (!sourceUri) {
        Alert.alert('Upload failed', 'Could not access the selected file.');
        return;
      }
      const assetName = asset.name ?? sourceUri.split('/').pop() ?? 'file';
      if (!shouldIncludeFile(asset.mimeType ?? undefined, assetName)) {
        Alert.alert('Unsupported file', 'The selected file type is not allowed.');
        return;
      }
      await ensureDirectory();
      const extension = assetName.includes('.')
        ? assetName.substring(assetName.lastIndexOf('.'))
        : '';
      const targetName = assetName.length ? assetName : `file-${Date.now()}${extension ?? ''}`;
      const targetUri = `${APP_FILES_DIR}/${targetName}`;
      await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
      await refreshEntries();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to upload file.');
    }
  }, [allowedMimeTypes, ensureDirectory, refreshEntries, shouldIncludeFile]);

  const handleOpen = useCallback(
    (entry: FileEntry) => {
      onOpenFile(entry.uri);
      handleClose();
    },
    [handleClose, onOpenFile],
  );

  const handleDelete = useCallback(
    async (entry: FileEntry) => {
      Alert.alert('Delete File', `Remove "${entry.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(entry.uri, { idempotent: true });
              await refreshEntries();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to delete file.');
            }
          },
        },
      ]);
    },
    [refreshEntries],
  );

  const toolbarContent = (
    <TouchableOpacity style={styles.toolbarButton} onPress={handleUpload}>
      <Text style={styles.toolbarButtonText}>Upload</Text>
    </TouchableOpacity>
  );

  const renderWindow = () => (
    <MacWindow
      title="File Browser"
      onClose={handleClose}
      enableCompact={false}
      toolbarContent={toolbarContent}
      contentStyle={styles.content}
    >
      {isLoading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <FlatList
          style={styles.fileList}
          data={entries}
          keyExtractor={(item) => item.uri}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.fileRow}
              onPress={() => handleOpen(item)}
              activeOpacity={0.7}
            >
              {item.isImage ? (
                <Image source={{ uri: item.uri }} style={styles.thumbnail} />
              ) : (
                <View style={styles.thumbnailPlaceholder}>
                  <Text style={styles.thumbnailPlaceholderText}>FILE</Text>
                </View>
              )}
              <View style={styles.fileRowContent}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {item.name}
                </Text>
                {typeof item.size === 'number' && (
                  <Text style={styles.fileMeta}>{(item.size / 1024).toFixed(1)} KB</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
                activeOpacity={0.7}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No files uploaded yet.</Text>
            </View>
          }
        />
      )}
    </MacWindow>
  );

  if (!shouldRender) {
    return null;
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>{renderWindow()}</View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  toolbarButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#2b3247',
  },
  toolbarButtonText: {
    color: '#f2f6ff',
    fontSize: 13,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 12,
    minHeight: 320,
  },
  fileList: {
    flex: 1,
  },
  fileRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#252c45',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 6,
    backgroundColor: '#1a1f2f',
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 6,
    backgroundColor: '#1a1f2f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailPlaceholderText: {
    color: '#8f96b8',
    fontSize: 12,
    fontWeight: '600',
  },
  fileRowContent: {
    flex: 1,
  },
  deleteButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff6b6b66',
    backgroundColor: '#2f1f1f',
  },
  deleteButtonText: {
    color: '#ff7b7b',
    fontSize: 12,
    fontWeight: '600',
  },
  fileName: {
    color: '#e4eaff',
    fontWeight: '500',
  },
  fileMeta: {
    color: '#99a3c2',
    fontSize: 12,
    marginTop: 2,
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9aa2c0',
  },
});
