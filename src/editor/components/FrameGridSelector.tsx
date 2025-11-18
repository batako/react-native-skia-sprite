import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { DataSourceParam } from '@shopify/react-native-skia';
import type { ImageSourcePropType } from 'react-native';
import { IconButton } from './IconButton';
import { SelectableTextInput } from './SelectableTextInput';

/**
 * Represents a selectable grid cell to be converted into sprite frames.
 */
export interface FrameGridCell {
  /** Stable identifier for the cell. */
  id: string;
  /** Row index within the generated grid. */
  row: number;
  /** Column index within the generated grid. */
  column: number;
  /** Pixel X coordinate. */
  x: number;
  /** Pixel Y coordinate. */
  y: number;
  /** Cell width in pixels. */
  width: number;
  /** Cell height in pixels. */
  height: number;
}

/**
 * Additional metadata describing an image source for the grid selector.
 */
export interface FrameGridImageDescriptor {
  /** Image source (URI, require, etc). */
  source: DataSourceParam;
  /** Known intrinsic width of the image. */
  width?: number;
  /** Known intrinsic height of the image. */
  height?: number;
  /** Optional display name. */
  name?: string;
  /** Optional internal identifier. */
  id?: string;
}

/** Allowed `image` prop formats for {@link FrameGridSelector}. */
export type FrameGridImageProp = DataSourceParam | FrameGridImageDescriptor;

const isImageDescriptor = (value: FrameGridImageProp): value is FrameGridImageDescriptor => {
  return typeof value === 'object' && value !== null && 'source' in value;
};

/**
 * Props for the {@link FrameGridSelector} component.
 */
export interface FrameGridSelectorProps {
  /** Primary image to render when slicing. */
  image?: FrameGridImageProp;
  /** Fallback image when `image` is absent. */
  fallbackImage?: FrameGridImageProp;
  /** Called with generated cells when user adds frames. */
  onAddFrames: (cells: FrameGridCell[], image?: FrameGridImageDescriptor) => void;
  /** Default cell width. */
  defaultCellWidth?: number;
  /** Default cell height. */
  defaultCellHeight?: number;
  /** Message shown when no image is available. */
  emptyMessage?: string;
}

const normalizeImage = (value?: FrameGridImageProp): FrameGridImageDescriptor | undefined => {
  if (!value) {
    return undefined;
  }
  if (isImageDescriptor(value)) {
    return value;
  }
  return { source: value as DataSourceParam };
};

/**
 * Interactive grid overlay that helps slice sprite sheets into individual frames.
 */
export const FrameGridSelector = ({
  image,
  fallbackImage,
  onAddFrames,
  defaultCellWidth = 32,
  defaultCellHeight = 32,
  emptyMessage = 'Select a sprite image to preview it here.',
}: FrameGridSelectorProps) => {
  const normalizedImage = useMemo(() => {
    const primary = normalizeImage(image);
    if (primary) {
      return primary;
    }
    return normalizeImage(fallbackImage);
  }, [image, fallbackImage]);
  const resolvedImage = normalizedImage?.source ?? null;
  const rnImageSource: ImageSourcePropType | null = useMemo(() => {
    if (!resolvedImage) {
      return null;
    }
    if (typeof resolvedImage === 'number') {
      return resolvedImage;
    }
    if (typeof resolvedImage === 'string') {
      return { uri: resolvedImage };
    }
    if ('uri' in (resolvedImage as Record<string, unknown>)) {
      const uriValue = (resolvedImage as { uri?: string }).uri;
      if (uriValue) {
        return { uri: uriValue };
      }
    }
    return resolvedImage as ImageSourcePropType;
  }, [resolvedImage]);
  const [horizontal, setHorizontal] = useState(4);
  const [vertical, setVertical] = useState(1);
  const [cellWidth, setCellWidth] = useState(defaultCellWidth);
  const [cellHeight, setCellHeight] = useState(defaultCellHeight);
  const [separationX, setSeparationX] = useState(0);
  const [separationY, setSeparationY] = useState(0);
  const [offsetX, setOffsetXInternal] = useState(0);
  const [offsetY, setOffsetYInternal] = useState(0);
  const [scale, setScale] = useState(1);
  const [fitScaleTarget, setFitScaleTarget] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [horizontalOrder, setHorizontalOrder] = useState<'ltr' | 'rtl'>('ltr');
  const [verticalOrder, setVerticalOrder] = useState<'ttb' | 'btt'>('ttb');
  const [primaryAxis, setPrimaryAxis] = useState<'horizontal' | 'vertical'>('horizontal');
  const [imageWidth, setImageWidth] = useState(
    normalizedImage?.width ?? defaultCellWidth * horizontal,
  );
  const [imageHeight, setImageHeight] = useState(
    normalizedImage?.height ?? defaultCellHeight * vertical,
  );
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const lastViewportRef = useRef({ width: 0, height: 0 });
  const [autoScaled, setAutoScaled] = useState(false);

  useEffect(() => {
    if (normalizedImage?.width && normalizedImage?.height) {
      setImageWidth(normalizedImage.width);
      setImageHeight(normalizedImage.height);
      return;
    }
    if (!resolvedImage) {
      setImageWidth(0);
      setImageHeight(0);
      return;
    }
    if (typeof resolvedImage === 'number') {
      const source = Image.resolveAssetSource(resolvedImage);
      if (source?.width && source?.height) {
        setImageWidth(source.width);
        setImageHeight(source.height);
      }
      return;
    }
    const uri =
      typeof resolvedImage === 'string' ? resolvedImage : (resolvedImage as { uri?: string }).uri;
    if (!uri) {
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled) {
          return;
        }
        setImageWidth(width);
        setImageHeight(height);
      },
      () => {
        // ignore errors
      },
    );
    return () => {
      cancelled = true;
    };
  }, [normalizedImage, resolvedImage]);

  useEffect(() => {
    setAutoScaled(false);
  }, [rnImageSource, normalizedImage?.width, normalizedImage?.height, imageWidth, imageHeight]);

  useEffect(() => {
    if (viewportSize.width <= 0 || viewportSize.height <= 0) {
      return;
    }
    const last = lastViewportRef.current;
    if (viewportSize.width !== last.width || viewportSize.height !== last.height) {
      lastViewportRef.current = viewportSize;
      setAutoScaled(false);
    }
  }, [viewportSize]);

  useEffect(() => {
    if (horizontal <= 0 || imageWidth <= 0) {
      return;
    }
    const nextWidth = Math.max(1, Math.floor(imageWidth / horizontal));
    setCellWidth((prev) => (prev === nextWidth ? prev : nextWidth));
  }, [horizontal, imageWidth]);

  useEffect(() => {
    if (vertical <= 0 || imageHeight <= 0) {
      return;
    }
    const nextHeight = Math.max(1, Math.floor(imageHeight / vertical));
    setCellHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, [vertical, imageHeight]);

  useEffect(() => {
    if (!rnImageSource) {
      return;
    }
    if (
      autoScaled ||
      viewportSize.width <= 0 ||
      viewportSize.height <= 0 ||
      imageWidth <= 0 ||
      imageHeight <= 0
    ) {
      return;
    }
    const availableWidth = Math.max(0, viewportSize.width - 24);
    const availableHeight = Math.max(0, viewportSize.height - 24);
    const fitScale = Math.min(availableWidth / imageWidth, availableHeight / imageHeight);
    if (!Number.isFinite(fitScale) || fitScale <= 0) {
      return;
    }
    const desiredScale = Math.max(fitScale, 0.05);
    const roundedScale = parseFloat(desiredScale.toFixed(3));
    setFitScaleTarget(roundedScale);
    if (Math.abs(roundedScale - scale) > 0.01) {
      setScale(roundedScale);
    }
    setAutoScaled(true);
  }, [autoScaled, viewportSize, imageWidth, imageHeight, rnImageSource, scale]);

  const cells = useMemo<FrameGridCell[]>(() => {
    const list: FrameGridCell[] = [];
    for (let row = 0; row < vertical; row += 1) {
      for (let col = 0; col < horizontal; col += 1) {
        const x = offsetX + col * (cellWidth + separationX);
        const y = offsetY + row * (cellHeight + separationY);
        list.push({
          id: `${row}-${col}`,
          row,
          column: col,
          x,
          y,
          width: cellWidth,
          height: cellHeight,
        });
      }
    }
    return list;
  }, [cellWidth, cellHeight, horizontal, offsetX, offsetY, separationX, separationY, vertical]);

  const canvasWidth = imageWidth * scale;
  const canvasHeight = imageHeight * scale;
  const isImageReady = Boolean(rnImageSource && imageWidth > 0 && imageHeight > 0);

  const setOffsetX = (val: number) => {
    setOffsetXInternal(val);
    setSelectedIds([]);
  };

  const setOffsetY = (val: number) => {
    setOffsetYInternal(val);
    setSelectedIds([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((value) => value !== id);
      }
      return [...prev, id];
    });
  };

  const handleAddFrames = () => {
    const selectedCells = selectedIds
      .map((id) => cells.find((cell) => cell.id === id))
      .filter((cell): cell is FrameGridCell => Boolean(cell));
    if (!normalizedImage) {
      onAddFrames(selectedCells);
    } else {
      onAddFrames(selectedCells, normalizedImage);
    }
    setSelectedIds([]);
  };

  const selectedCount = selectedIds.length;

  const changeScale = (delta: number) => {
    setScale((prev) => Math.max(0.05, parseFloat((prev + delta).toFixed(2))));
  };

  const resetScale = () => setScale(fitScaleTarget);

  const selectAllCells = () => {
    if (!rnImageSource || imageWidth <= 0 || imageHeight <= 0) {
      return;
    }
    const ordered = [...cells]
      .filter(
        (cell) =>
          cell.x >= 0 &&
          cell.y >= 0 &&
          cell.x + cell.width <= imageWidth &&
          cell.y + cell.height <= imageHeight,
      )
      .sort((a, b) => {
        const primaryIsRow = primaryAxis === 'horizontal';
        const primaryDirection = primaryIsRow ? verticalOrder : horizontalOrder;
        const secondaryDirection = primaryIsRow ? horizontalOrder : verticalOrder;

        if (primaryDirection === 'ttb' || primaryDirection === 'btt') {
          const rowOrder = primaryDirection === 'ttb' ? a.row - b.row : b.row - a.row;
          if (rowOrder !== 0) {
            return rowOrder;
          }
          return secondaryDirection === 'ltr' ? a.column - b.column : b.column - a.column;
        }
        const colOrder = primaryDirection === 'ltr' ? a.column - b.column : b.column - a.column;
        if (colOrder !== 0) {
          return colOrder;
        }
        return secondaryDirection === 'ttb' ? a.row - b.row : b.row - a.row;
      });
    setSelectedIds(ordered.map((cell) => cell.id));
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.selectorRow}>
        <View style={styles.previewColumn}>
          <View style={styles.orderRow}>
            <View style={styles.orderField}>
              <Text style={styles.orderLabel}>Primary axis</Text>
              <View style={styles.orderButtons}>
                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    primaryAxis === 'horizontal' && styles.orderButtonActive,
                  ]}
                  onPress={() => setPrimaryAxis('horizontal')}
                >
                  <Text style={styles.orderButtonText}>Horizontal first</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    primaryAxis === 'vertical' && styles.orderButtonActive,
                  ]}
                  onPress={() => setPrimaryAxis('vertical')}
                >
                  <Text style={styles.orderButtonText}>Vertical first</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.orderField}>
              <Text style={styles.orderLabel}>Horizontal</Text>
              <View style={styles.orderButtons}>
                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    horizontalOrder === 'ltr' && styles.orderButtonActive,
                  ]}
                  onPress={() => setHorizontalOrder('ltr')}
                >
                  <Text style={styles.orderButtonText}>Left → Right</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    horizontalOrder === 'rtl' && styles.orderButtonActive,
                  ]}
                  onPress={() => setHorizontalOrder('rtl')}
                >
                  <Text style={styles.orderButtonText}>Right → Left</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.orderField}>
              <Text style={styles.orderLabel}>Vertical</Text>
              <View style={styles.orderButtons}>
                <TouchableOpacity
                  style={[styles.orderButton, verticalOrder === 'ttb' && styles.orderButtonActive]}
                  onPress={() => setVerticalOrder('ttb')}
                >
                  <Text style={styles.orderButtonText}>Top → Bottom</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.orderButton, verticalOrder === 'btt' && styles.orderButtonActive]}
                  onPress={() => setVerticalOrder('btt')}
                >
                  <Text style={styles.orderButtonText}>Bottom → Top</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.orderActions}>
              <TouchableOpacity style={styles.autoSelectButton} onPress={selectAllCells}>
                <Text style={styles.autoSelectText}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.autoSelectButton, styles.clearButton]}
                onPress={() => setSelectedIds([])}
              >
                <Text style={styles.autoSelectText}>Clear selection</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View
            style={styles.scrollWrapper}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
              setViewportSize({ width, height });
            }}
          >
            <View pointerEvents="box-none" style={styles.zoomOverlay}>
              <View style={styles.zoomControls}>
                <IconButton
                  name="zoom-out"
                  onPress={() => changeScale(-0.25)}
                  accessibilityLabel="Zoom out"
                  style={styles.zoomButton}
                />
                <Pressable
                  onPress={resetScale}
                  accessibilityRole="button"
                  accessibilityLabel="Reset zoom to 100%"
                  style={styles.zoomTextButton}
                >
                  <Text style={styles.zoomLabel}>{Math.round(scale * 100)}%</Text>
                </Pressable>
                <IconButton
                  name="zoom-in"
                  onPress={() => changeScale(0.25)}
                  accessibilityLabel="Zoom in"
                  style={styles.zoomButton}
                />
              </View>
            </View>
            <ScrollView
              horizontal
              style={styles.imageScroll}
              contentContainerStyle={styles.imageScrollContent}
              showsHorizontalScrollIndicator
              persistentScrollbar
            >
              <ScrollView
                style={styles.imageScrollVertical}
                contentContainerStyle={styles.imageScrollContent}
                showsVerticalScrollIndicator
                persistentScrollbar
              >
                <View style={styles.imageFrameContainer}>
                  {isImageReady && rnImageSource ? (
                    <View style={[styles.imageFrame, { width: canvasWidth, height: canvasHeight }]}>
                      <Image
                        source={rnImageSource}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: imageWidth * scale,
                          height: imageHeight * scale,
                        }}
                      />
                      {cells.map((cell) => {
                        const fitsWithinImage =
                          cell.x >= 0 &&
                          cell.y >= 0 &&
                          cell.x + cell.width <= imageWidth &&
                          cell.y + cell.height <= imageHeight;
                        if (!fitsWithinImage) {
                          return null;
                        }
                        const left = cell.x * scale;
                        const top = cell.y * scale;
                        const width = cell.width * scale;
                        const height = cell.height * scale;
                        const isSelected = selectedIds.includes(cell.id);
                        const order = isSelected ? selectedIds.indexOf(cell.id) : -1;
                        return (
                          <TouchableOpacity
                            key={cell.id}
                            style={[
                              styles.cell,
                              {
                                left,
                                top,
                                width,
                                height,
                                borderColor: isSelected ? '#4f8dff' : 'rgba(255,255,255,0.35)',
                                backgroundColor: isSelected
                                  ? 'rgba(79,141,255,0.15)'
                                  : 'transparent',
                              },
                            ]}
                            onPress={() => toggleSelection(cell.id)}
                            activeOpacity={0.7}
                          >
                            {isSelected && <Text style={styles.orderText}>{order}</Text>}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateTitle}>Image not selected</Text>
                      <Text style={styles.emptyStateText}>{emptyMessage}</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </ScrollView>
          </View>
        </View>
        <View style={styles.controlsColumn}>
          <NumericInputField
            label="Horizontal (cells)"
            value={horizontal}
            onCommit={setHorizontal}
            sanitize={(val) => Math.max(1, Math.floor(val))}
            showStepControls
            step={1}
          />
          <NumericInputField
            label="Vertical (cells)"
            value={vertical}
            onCommit={setVertical}
            sanitize={(val) => Math.max(1, Math.floor(val))}
            showStepControls
            step={1}
          />
          <NumericInputField
            label="Size X (px)"
            value={cellWidth}
            onCommit={setCellWidth}
            sanitize={(val) => Math.max(1, val)}
            showStepControls
            step={1}
          />
          <NumericInputField
            label="Size Y (px)"
            value={cellHeight}
            onCommit={setCellHeight}
            sanitize={(val) => Math.max(1, val)}
            showStepControls
            step={1}
          />
          <NumericInputField
            label="Spacing X (px)"
            value={separationX}
            onCommit={setSeparationX}
            sanitize={(val) => Math.max(0, val)}
            showStepControls
            step={1}
          />
          <NumericInputField
            label="Spacing Y (px)"
            value={separationY}
            onCommit={setSeparationY}
            sanitize={(val) => Math.max(0, val)}
            showStepControls
            step={1}
          />
          <NumericInputField
            label="Offset X (px)"
            value={offsetX}
            onCommit={setOffsetX}
            allowNegative
            showStepControls
            step={1}
          />
          <NumericInputField
            label="Offset Y (px)"
            value={offsetY}
            onCommit={setOffsetY}
            allowNegative
            showStepControls
            step={1}
          />
        </View>
      </View>
      <TouchableOpacity
        style={[styles.addButton, !selectedCount && styles.addButtonDisabled]}
        disabled={!selectedCount}
        onPress={handleAddFrames}
      >
        <Text style={styles.addButtonText}>
          {selectedCount
            ? `Add ${selectedCount} frame${selectedCount > 1 ? 's' : ''}`
            : 'No frames selected'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    marginBottom: 8,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    flex: 1,
    minHeight: 0,
  },
  previewColumn: {
    flex: 1,
    marginRight: 12,
    minHeight: 240,
    flexShrink: 1,
    minWidth: 0,
  },
  controlsColumn: {
    width: 210,
    paddingLeft: 12,
  },
  zoomOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 5,
    pointerEvents: 'box-none',
  },
  zoomControls: {
    flexDirection: 'row',
    paddingHorizontal: 0,
    paddingVertical: 0,
    height: 36,
    alignItems: 'center',
    gap: 0,
  },
  zoomButton: {
    marginRight: 4,
    marginBottom: 0,
  },
  zoomTextButton: {
    marginRight: 4,
  },
  zoomLabel: {
    color: '#dfe7ff',
    fontWeight: '600',
    fontSize: 12,
    minWidth: 50,
    textAlign: 'center',
  },
  orderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderField: {
    marginRight: 12,
  },
  orderLabel: {
    color: '#c7d3f3',
    fontSize: 12,
    marginBottom: 4,
  },
  orderButtons: {
    flexDirection: 'row',
  },
  orderButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#2a3142',
    marginRight: 6,
  },
  orderButtonActive: {
    borderColor: '#4f8dff',
  },
  orderButtonText: {
    color: '#e3eaff',
    fontSize: 12,
  },
  orderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  autoSelectButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  clearButton: {},
  autoSelectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollWrapper: {
    flex: 1,
    flexBasis: 0,
    width: '100%',
    minHeight: 340,
    maxHeight: '100%',
    marginBottom: 0,
    position: 'relative',
    backgroundColor: '#444444',
  },
  imageScroll: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  imageScrollVertical: {
    width: '100%',
    height: '100%',
  },
  imageScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageFrameContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    backgroundColor: '#444444',
  },
  imageFrame: {
    borderWidth: 1,
    borderColor: '#2a3142',
    overflow: 'hidden',
    alignSelf: 'center',
    position: 'relative',
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#d4dae8',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  emptyStateTitle: {
    color: '#e5ebff',
    fontWeight: '600',
    marginBottom: 6,
    fontSize: 14,
  },
  emptyStateText: {
    color: '#b8c1db',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  cell: {
    position: 'absolute',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  orderText: {
    color: '#fff',
    fontSize: 12,
  },
  fieldRow: {
    marginBottom: 10,
  },
  fieldLabel: {
    color: '#9fa9c2',
    fontSize: 12,
    marginBottom: 4,
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldInput: {
    backgroundColor: '#1c2130',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30384a',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
  },
  fieldInputWithButtons: {
    marginHorizontal: 4,
  },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a3142',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#191f2f',
  },
  stepButtonLeft: {
    marginRight: 4,
  },
  stepButtonRight: {
    marginLeft: 4,
  },
  stepButtonText: {
    color: '#dfe3ff',
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  addButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#4f8dff',
    alignItems: 'center',
    alignSelf: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#2a3142',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

interface NumericInputFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  sanitize?: (value: number) => number;
  allowNegative?: boolean;
  step?: number;
  showStepControls?: boolean;
}

const NumericInputField: React.FC<NumericInputFieldProps> = ({
  label,
  value,
  onCommit,
  sanitize,
  allowNegative = false,
  step = 1,
  showStepControls = false,
}) => {
  const [text, setText] = useState(String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(String(value));
    }
  }, [value, isFocused]);

  const applySanitize = (next: number) => (sanitize ? sanitize(next) : next);

  const commitValue = (next: number) => {
    const sanitized = applySanitize(next);
    onCommit(sanitized);
    setText(String(sanitized));
  };

  const handleChangeText = (next: string) => {
    const pattern = allowNegative ? /^-?\d*$/ : /^\d*$/;
    if (!pattern.test(next)) {
      return;
    }
    setText(next);
    if (next === '' || next === '-' || next === '-0') {
      return;
    }
    const numericValue = Number(next);
    if (!Number.isNaN(numericValue)) {
      commitValue(numericValue);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (text === '' || text === '-' || text === '-0') {
      setText(String(value));
      return;
    }
    const numericValue = Number(text);
    if (Number.isNaN(numericValue)) {
      setText(String(value));
      return;
    }
    commitValue(numericValue);
  };

  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputRow}>
        {showStepControls && (
          <TouchableOpacity
            style={[styles.stepButton, styles.stepButtonLeft]}
            onPress={() => commitValue(value - step)}
            accessibilityLabel={`Decrease ${label}`}
          >
            <Text style={styles.stepButtonText}>-</Text>
          </TouchableOpacity>
        )}
        <SelectableTextInput
          value={text}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          style={[styles.fieldInput, showStepControls && styles.fieldInputWithButtons]}
          keyboardType="numeric"
          inputMode="numeric"
        />
        {showStepControls && (
          <TouchableOpacity
            style={[styles.stepButton, styles.stepButtonRight]}
            onPress={() => commitValue(value + step)}
            accessibilityLabel={`Increase ${label}`}
          >
            <Text style={styles.stepButtonText}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
