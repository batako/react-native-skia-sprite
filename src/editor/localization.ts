import * as Localization from 'expo-localization';

/** Allowed locales for the editor string bundle. */
type SupportedLanguage = 'en' | 'ja';

/* eslint-disable jsdoc/require-jsdoc */
export type EditorStrings = {
  general: {
    zoomOut: string;
    zoomIn: string;
    resetZoom: string;
    cancel: string;
    delete: string;
    errorTitle: string;
    decreaseValue: string;
    increaseValue: string;
    confirmValue: string;
  };
  frameGrid: {
    primaryAxisLabel: string;
    horizontalFirst: string;
    verticalFirst: string;
    horizontalLabel: string;
    leftToRight: string;
    rightToLeft: string;
    verticalLabel: string;
    topToBottom: string;
    bottomToTop: string;
    selectAll: string;
    clearSelection: string;
    emptyStateTitle: string;
    emptyStateDescription: string;
    horizontalCellsLabel: string;
    verticalCellsLabel: string;
    sizeXLabel: string;
    sizeYLabel: string;
    spacingXLabel: string;
    spacingYLabel: string;
    offsetXLabel: string;
    offsetYLabel: string;
    addSingleFrame: string;
    addMultipleFrames: string;
    noFramesSelected: string;
  };
  preview: {
    framesMissing: string;
    pausePreview: string;
    playPreview: string;
    stopPreview: string;
  };
  animationStudio: {
    requireNameMessage: string;
    animationPreviewTitle: string;
    animationsTitle: string;
    animationFramesTitle: string;
    statusSaved: string;
    statusLoaded: string;
    statusCleared: string;
    needFramesBeforeSave: string;
    saveSprite: string;
    openStorageManager: string;
    editMetadata: string;
    openSpriteJsonTools: string;
    addAnimation: string;
    deleteAnimation: string;
    disableLoop: string;
    enableLoop: string;
    disableAutoplay: string;
    enableAutoplay: string;
    renameMissing: string;
    renameDuplicate: string;
    importFailedTitle: string;
    importFailedDescription: string;
    deleteAnimationTitle: string;
    deleteAnimationMessage: string;
    templateExported: string;
    templateImported: string;
    clearActiveSprite: string;
  };
  metadataModal: {
    title: string;
    heading: string;
    addEntry: string;
    removeEntry: string;
    apply: string;
    keyLabel: string;
    valueLabel: string;
    keyPlaceholder: string;
    valuePlaceholder: string;
    helpText: string;
  };
  templateModal: {
    title: string;
    description: string;
    exportButton: string;
    importButton: string;
    exportPlaceholder: string;
    importPlaceholder: string;
    downloadedMessage: string;
    downloadFailedMessage: string;
    shareDialogTitle: string;
  };
  storagePanel: {
    title: string;
    spriteNameLabel: string;
    spriteNamePlaceholder: string;
    saveSprite: string;
    loadSprite: string;
    deleteSprite: string;
    deleteSpriteTitle: string;
    deleteSpriteMessage: string;
    emptyList: string;
    updatedPrefix: string;
    statusSaved: string;
    statusLoaded: string;
    statusOverwritten: string;
    statusRenamed: string;
    statusDeleted: string;
    statusNeedFrames: string;
    statusMissing: string;
    statusNameRequired: string;
  };
  timeline: {
    multiplierLabel: string;
    thumbPlaceholder: string;
    pausePreview: string;
    stopPreview: string;
    restart: string;
    restartReverse: string;
    playPreview: string;
    playReverse: string;
    importImage: string;
    openFramePicker: string;
  };
  timelineControls: {
    copyFrame: string;
    pasteFrame: string;
    moveLeft: string;
    moveRight: string;
    removeFrame: string;
  };
  fileBrowser: {
    title: string;
    uploadButton: string;
    webpToggleLabel: string;
    webpToggleDescription: string;
    webpConversionFailedTitle: string;
    webpConversionFailedMessage: string;
    deleteButton: string;
    deleteConfirmTitle: string;
    deleteConfirmMessage: string;
    noFiles: string;
    errorAccess: string;
    errorLoad: string;
    uploadFailedTitle: string;
    uploadFailedMessage: string;
    unsupportedFileTitle: string;
    unsupportedFileMessage: string;
    errorUpload: string;
    errorDelete: string;
    thumbnailLabel: string;
  };
  editorScreen: {
    subtitle: string;
    legalHeading: string;
    infoAppSectionHeading: string;
    infoAppHeading: string;
    infoAppDescription: string;
    infoAppJsonUsage: string;
    infoAppModuleNote: string;
    infoAppCustomization: string;
    infoAppSampleHeading: string;
    infoAppSampleDescription: string;
    infoAppSampleCodeLabel: string;
    infoAppSampleCode: string;
    infoAppSamplePreviewLabel: string;
    infoAppLinkLabel: string;
    infoCenterTitle: string;
    appVersionLabel: string;
    legalOverviewIntro: string;
    termsTitle: string;
    privacyTitle: string;
    licensesTitle: string;
    termsBodyIntro: string;
    termsBodyUse: string;
    termsBodyContact: string;
    privacyBodyIntro: string;
    privacyBodyContact: string;
    licensesIntro: string;
    helpHeading: string;
    helpOverviewIntro: string;
    contactLinkLabel: string;
    githubLinkLabel: string;
  };
  framePicker: {
    title: string;
    emptyMessage: string;
  };
};
/* eslint-enable jsdoc/require-jsdoc */

const translations: Record<SupportedLanguage, EditorStrings> = {
  en: {
    general: {
      zoomOut: 'Zoom out',
      zoomIn: 'Zoom in',
      resetZoom: 'Reset zoom to 100%',
      cancel: 'Cancel',
      delete: 'Delete',
      errorTitle: 'Error',
      decreaseValue: 'Decrease {label}',
      increaseValue: 'Increase {label}',
      confirmValue: 'Apply value',
    },
    frameGrid: {
      primaryAxisLabel: 'Primary axis',
      horizontalFirst: 'Horizontal first',
      verticalFirst: 'Vertical first',
      horizontalLabel: 'Horizontal',
      leftToRight: 'Left → Right',
      rightToLeft: 'Right → Left',
      verticalLabel: 'Vertical',
      topToBottom: 'Top → Bottom',
      bottomToTop: 'Bottom → Top',
      selectAll: 'Select all cells',
      clearSelection: 'Clear selection',
      emptyStateTitle: 'Image not selected',
      emptyStateDescription: 'Select a sprite image to preview it here.',
      horizontalCellsLabel: 'Horizontal (cells)',
      verticalCellsLabel: 'Vertical (cells)',
      sizeXLabel: 'Size X (px)',
      sizeYLabel: 'Size Y (px)',
      spacingXLabel: 'Spacing X (px)',
      spacingYLabel: 'Spacing Y (px)',
      offsetXLabel: 'Offset X (px)',
      offsetYLabel: 'Offset Y (px)',
      addSingleFrame: 'Add 1 frame',
      addMultipleFrames: 'Add {count} frames',
      noFramesSelected: 'No frames selected',
    },
    preview: {
      framesMissing:
        'Frame images are missing. AnimatedSprite2D preview becomes available once each frame has its own image URI.',
      pausePreview: 'Pause preview',
      playPreview: 'Play preview',
      stopPreview: 'Stop preview',
    },
    animationStudio: {
      requireNameMessage: 'Use Sprite Storage to name and save new sprites.',
      animationPreviewTitle: 'Animation Preview',
      animationsTitle: 'Animations',
      animationFramesTitle: 'Animation Frames',
      statusSaved: 'Saved {name}',
      statusLoaded: 'Loaded {name}',
      statusCleared: 'Started a new sprite',
      needFramesBeforeSave: 'Add at least one frame before saving.',
      saveSprite: 'Save sprite',
      openStorageManager: 'Open storage manager',
      editMetadata: 'Edit metadata',
      openSpriteJsonTools: 'Open sprite JSON tools',
      addAnimation: 'Add animation',
      deleteAnimation: 'Delete animation',
      disableLoop: 'Disable loop for animation',
      enableLoop: 'Enable loop for animation',
      disableAutoplay: 'Disable autoplay for this animation',
      enableAutoplay: 'Enable autoplay for this animation',
      renameMissing: 'Please enter a name',
      renameDuplicate: 'An animation with the same name already exists',
      importFailedTitle: 'Import failed',
      importFailedDescription: 'Unable to load the selected image.',
      deleteAnimationTitle: 'Delete animation?',
      deleteAnimationMessage: 'Are you sure you want to remove this animation?',
      templateExported: 'Exported spriteStorage-compatible JSON.',
      templateImported: 'Import succeeded and editor history was reset.',
      clearActiveSprite: 'Close current sprite',
    },
    metadataModal: {
      title: 'Metadata',
      heading: 'Primitive keys are exported with the sprite.',
      addEntry: 'Add entry',
      removeEntry: 'Remove metadata entry',
      apply: 'Apply metadata',
      keyLabel: 'Key',
      valueLabel: 'Value',
      keyPlaceholder: 'metadata key',
      valuePlaceholder: 'value',
      helpText: 'Saved metadata is included when exporting JSON or saving via Sprite Storage.',
    },
    templateModal: {
      title: 'Sprite JSON',
      description: 'Uses the same format consumed by the preview runtime and storage helpers.',
      exportButton: 'Export',
      importButton: 'Import',
      exportPlaceholder: 'Press Export to view the current payload',
      importPlaceholder: 'Paste JSON here and press Import',
      downloadedMessage: 'Sprite JSON exported. Share or save when the picker appears.',
      downloadFailedMessage: 'Could not generate the sprite JSON file.',
      shareDialogTitle: 'Share exported sprite JSON',
    },
    storagePanel: {
      title: 'Sprite Storage',
      spriteNameLabel: 'Sprite name',
      spriteNamePlaceholder: 'Untitled Sprite',
      saveSprite: 'Save sprite',
      loadSprite: 'Load sprite',
      deleteSprite: 'Delete sprite',
      deleteSpriteTitle: 'Delete sprite?',
      deleteSpriteMessage: 'Are you sure you want to remove "{name}" from storage?',
      emptyList: 'No sprites saved yet. Use the form above to add one.',
      updatedPrefix: 'Updated',
      statusSaved: 'Saved sprite {name}.',
      statusLoaded: 'Loaded sprite {name}.',
      statusOverwritten: 'Overwrote sprite {name}.',
      statusRenamed: 'Renamed sprite to {name}.',
      statusDeleted: 'Deleted sprite {name}.',
      statusNeedFrames: 'Add at least one frame before saving.',
      statusMissing: 'Sprite not found on disk.',
      statusNameRequired: 'Name cannot be empty.',
    },
    timeline: {
      multiplierLabel: 'Multiplier',
      thumbPlaceholder: 'No Image',
      pausePreview: 'Pause animation preview',
      stopPreview: 'Stop animation preview',
      restart: 'Restart animation from beginning',
      restartReverse: 'Restart animation in reverse from beginning',
      playPreview: 'Play animation preview',
      playReverse: 'Play animation in reverse',
      importImage: 'Import image as frame',
      openFramePicker: 'Open frame picker modal',
    },
    timelineControls: {
      copyFrame: 'Copy timeline frame',
      pasteFrame: 'Paste timeline frame',
      moveLeft: 'Move frame left',
      moveRight: 'Move frame right',
      removeFrame: 'Remove timeline frame',
    },
    fileBrowser: {
      title: 'File Browser',
      uploadButton: 'Upload',
      webpToggleLabel: 'Optimize image uploads (use WebP if smaller)',
      webpToggleDescription:
        'Automatically converts images to WebP when it produces a smaller file. Turn off to keep originals unchanged.',
      webpConversionFailedTitle: 'Conversion failed',
      webpConversionFailedMessage: 'Could not convert the image. The original file was kept.',
      deleteButton: 'Delete',
      deleteConfirmTitle: 'Delete File',
      deleteConfirmMessage: 'Remove "{name}"?',
      noFiles: 'No files uploaded yet.',
      errorAccess: 'Failed to access app files directory.',
      errorLoad: 'Failed to load files.',
      uploadFailedTitle: 'Upload failed',
      uploadFailedMessage: 'Could not access the selected file.',
      unsupportedFileTitle: 'Unsupported file',
      unsupportedFileMessage: 'The selected file type is not allowed.',
      errorUpload: 'Failed to upload file.',
      errorDelete: 'Failed to delete file.',
      thumbnailLabel: 'FILE',
    },
    editorScreen: {
      subtitle:
        'Edit frames, play animations, preview with AnimatedSprite2D, and persist sprites to disk with a single screen.',
      legalHeading: 'Policies & Notices',
      infoAppSectionHeading: 'App Info',
      infoAppHeading: 'App Overview',
      infoAppDescription:
        'This app is built directly with react-native-skia-sprite-animator. The on-screen Animation Studio, Sprite Storage workflow, and AnimatedSprite2D preview are the same components exported by the library.',
      infoAppModuleNote:
        'Combining these pieces lets you slice sprite sheets, edit animation timelines, manage metadata, and preview results without bespoke tooling, and you can embed or customize them to match your editor.',
      infoAppCustomization: '',
      infoAppJsonUsage:
        'The exported cleanSpriteData JSON is understood by AnimatedSprite2D and the Sprite Storage helpers, so apps using react-native-skia-sprite-animator can load it without additional conversion.',
      infoAppSampleHeading: 'Demo',
      infoAppSampleDescription:
        'Load the exported JSON next to your sprite sheet image and feed it into AnimatedSprite2D. The snippet below maps each frame to the subset inside the sheet, and the preview underneath renders the exact same setup.',
      infoAppSampleCodeLabel: 'Sample code',
      infoAppSampleCode:
        "import React from 'react';\nimport spriteSheet from './assets/sprite.png';\nimport spriteJson from './assets/sprite.json';\nimport { AnimatedSprite2D } from 'react-native-skia-sprite-animator';\n\nconst frames = {\n  frames: spriteJson.frames.map((frame) => ({\n    id: frame.id,\n    width: frame.w,\n    height: frame.h,\n    duration: frame.duration,\n    image: {\n      type: 'require',\n      assetId: spriteSheet,\n      subset: frame.x !== undefined && frame.y !== undefined\n        ? { x: frame.x, y: frame.y, width: frame.w, height: frame.h }\n        : undefined,\n    },\n  })),\n  animations: spriteJson.animations,\n  animationsMeta: spriteJson.animationsMeta,\n  autoPlayAnimation: spriteJson.autoPlayAnimation ?? null,\n  meta: spriteJson.meta,\n};\n\nexport const PlayerPreview = () => {\n  return <AnimatedSprite2D frames={frames} animation=\"walk\" autoplay=\"walk\" centered />;\n};",
      infoAppSamplePreviewLabel: 'AnimatedSprite2D preview',
      infoAppLinkLabel: 'App Overview',
      infoCenterTitle: 'Info & Support',
      appVersionLabel: 'App Version',
      legalOverviewIntro:
        'Review the policies covering usage, privacy, and open-source software packaged with the app.',
      termsTitle: 'Terms of Service',
      privacyTitle: 'Privacy Policy',
      licensesTitle: 'Open Source Licenses',
      termsBodyIntro:
        'By installing or using React Native Skia Sprite Animator you agree to follow applicable laws, respect intellectual property, and refrain from uploading assets that infringe third-party rights. You are solely responsible for the projects you create and the data you import into the app.',
      termsBodyUse:
        'The app is provided on an “as-is” basis without warranties of any kind. We may update or remove features at any time. Access can be suspended if abusive behavior, reverse engineering, or attempts to breach security safeguards are detected.',
      termsBodyContact:
        'You are responsible for maintaining backups of your files. We are not liable for loss of data, business interruption, or any indirect or consequential damages arising from use of the application. Continued use after updates constitutes acceptance of any revised terms.',
      privacyBodyIntro:
        'React Native Skia Sprite Animator does not collect personal data, analytics, or tracking information. Sprite sheets, JSON exports, and local saves remain on your device unless you explicitly share them. Expo runtime components and the underlying operating system may collect anonymous diagnostics under their own policies.',
      privacyBodyContact:
        'If you contact us for support, any email or message is used solely to respond to that request and is discarded when the conversation ends. We do not sell or share user data. Deleting the app removes locally stored content from your device.',
      licensesIntro:
        'React Native Skia Sprite Animator uses the open-source modules listed below. Refer to each project for complete license texts.',
      helpHeading: 'Help & Links',
      helpOverviewIntro:
        'Share feedback or explore the latest project updates using the links below.',
      contactLinkLabel: 'Contact Form',
      githubLinkLabel: 'GitHub Repository',
    },
    framePicker: {
      title: 'Frame Picker',
      emptyMessage: 'Select an image from the file browser to begin slicing.',
    },
  },
  ja: {
    general: {
      zoomOut: 'ズームアウト',
      zoomIn: 'ズームイン',
      resetZoom: 'ズームを100%にリセット',
      cancel: 'キャンセル',
      delete: '削除',
      errorTitle: 'エラー',
      decreaseValue: '{label} を減らす',
      increaseValue: '{label} を増やす',
      confirmValue: '値を確定',
    },
    frameGrid: {
      primaryAxisLabel: '優先方向',
      horizontalFirst: '横方向を優先',
      verticalFirst: '縦方向を優先',
      horizontalLabel: '横方向',
      leftToRight: '左 → 右',
      rightToLeft: '右 → 左',
      verticalLabel: '縦方向',
      topToBottom: '上 → 下',
      bottomToTop: '下 → 上',
      selectAll: '全フレームを選択',
      clearSelection: '選択を解除',
      emptyStateTitle: '画像が選択されていません',
      emptyStateDescription: 'ここにプレビューするスプライト画像を選択してください。',
      horizontalCellsLabel: '横方向（セル数）',
      verticalCellsLabel: '縦方向（セル数）',
      sizeXLabel: 'セル幅 (px)',
      sizeYLabel: 'セル高さ (px)',
      spacingXLabel: '横スペース (px)',
      spacingYLabel: '縦スペース (px)',
      offsetXLabel: 'Xオフセット (px)',
      offsetYLabel: 'Yオフセット (px)',
      addSingleFrame: '1フレームを追加',
      addMultipleFrames: '{count}フレームを追加',
      noFramesSelected: 'フレームが選択されていません',
    },
    preview: {
      framesMissing:
        'フレーム画像がありません。各フレームに画像URIを設定すると AnimatedSprite2D のプレビューが表示されます。',
      pausePreview: 'プレビューを一時停止',
      playPreview: 'プレビューを再生',
      stopPreview: 'プレビューを停止',
    },
    animationStudio: {
      requireNameMessage: 'スプライトストレージで名前を付けて保存してください。',
      animationPreviewTitle: 'アニメーションプレビュー',
      animationsTitle: 'アニメーション',
      animationFramesTitle: 'アニメーションフレーム',
      statusSaved: '{name} を保存しました',
      statusLoaded: '{name} を読み込みました',
      statusCleared: '新規スプライトを開始しました',
      needFramesBeforeSave: '保存する前に少なくとも1フレーム追加してください。',
      saveSprite: 'スプライトを保存',
      openStorageManager: 'ストレージを開く',
      editMetadata: 'メタデータを編集',
      openSpriteJsonTools: 'Sprite JSON ツールを開く',
      addAnimation: 'アニメーションを追加',
      deleteAnimation: 'アニメーションを削除',
      disableLoop: 'このアニメーションのループを無効化',
      enableLoop: 'このアニメーションのループを有効化',
      disableAutoplay: 'このアニメーションの自動再生を無効化',
      enableAutoplay: 'このアニメーションの自動再生を有効化',
      renameMissing: '名前を入力してください',
      renameDuplicate: '同じ名前のアニメーションが既に存在します',
      importFailedTitle: 'インポートに失敗しました',
      importFailedDescription: '選択した画像を読み込めませんでした。',
      deleteAnimationTitle: 'アニメーションを削除しますか？',
      deleteAnimationMessage: 'このアニメーションを削除してもよろしいですか？',
      templateExported: 'スプライトストレージ互換の JSON をエクスポートしました。',
      templateImported: 'インポートが完了し、エディタ履歴をリセットしました。',
      clearActiveSprite: '現在のスプライトを閉じる',
    },
    metadataModal: {
      title: 'メタデータ',
      heading: 'プリミティブのキーはスプライトと一緒にエクスポートされます。',
      addEntry: '追加',
      removeEntry: 'このメタデータを削除',
      apply: 'メタデータを適用',
      keyLabel: 'キー',
      valueLabel: '値',
      keyPlaceholder: 'メタデータキー',
      valuePlaceholder: '値',
      helpText:
        '保存されたメタデータはJSONのエクスポートやスプライトストレージでの保存時に含まれます。',
    },
    templateModal: {
      title: 'スプライトJSON',
      description: 'プレビューランタイムやストレージ機能と同じフォーマットで書き出します。',
      exportButton: 'エクスポート',
      importButton: 'インポート',
      exportPlaceholder: '「エクスポート」を押すと現在の内容が表示されます',
      importPlaceholder: 'JSONを貼り付けて「インポート」を押してください',
      downloadedMessage: 'スプライトJSONを書き出しました。共有メニューから保存してください。',
      downloadFailedMessage: 'スプライトJSONファイルを作成できませんでした。',
      shareDialogTitle: 'スプライトJSONを共有',
    },
    storagePanel: {
      title: 'スプライトストレージ',
      spriteNameLabel: 'スプライト名',
      spriteNamePlaceholder: '名称未設定のスプライト',
      saveSprite: 'スプライトを保存',
      loadSprite: 'スプライトを読み込み',
      deleteSprite: 'スプライトを削除',
      deleteSpriteTitle: 'スプライトを削除しますか？',
      deleteSpriteMessage: '「{name}」をストレージから削除しますか？',
      emptyList: 'まだスプライトが保存されていません。上のフォームから追加できます。',
      updatedPrefix: '更新日',
      statusSaved: 'スプライト {name} を保存しました。',
      statusLoaded: 'スプライト {name} を読み込みました。',
      statusOverwritten: 'スプライト {name} を上書きしました。',
      statusRenamed: 'スプライト名を {name} に変更しました。',
      statusDeleted: 'スプライト {name} を削除しました。',
      statusNeedFrames: '保存する前に少なくとも1フレーム追加してください。',
      statusMissing: 'ストレージ上にスプライトが見つかりません。',
      statusNameRequired: '名前を入力してください。',
    },
    timeline: {
      multiplierLabel: '倍率',
      thumbPlaceholder: '画像なし',
      pausePreview: 'アニメーションプレビューを一時停止',
      stopPreview: 'アニメーションプレビューを停止',
      restart: '最初から再生',
      restartReverse: '逆再生を最初から実行',
      playPreview: 'アニメーションプレビューを再生',
      playReverse: 'アニメーションを逆再生',
      importImage: '画像からフレームを追加',
      openFramePicker: 'フレームピッカーを開く',
    },
    timelineControls: {
      copyFrame: 'タイムラインのフレームをコピー',
      pasteFrame: 'タイムラインのフレームを貼り付け',
      moveLeft: 'フレームを左へ移動',
      moveRight: 'フレームを右へ移動',
      removeFrame: 'タイムラインのフレームを削除',
    },
    fileBrowser: {
      title: 'ファイルブラウザー',
      uploadButton: 'アップロード',
      webpToggleLabel: '画像を最適化（小さい場合は WebP に変換）',
      webpToggleDescription:
        'アップロード時に WebP へ変換し、元よりファイルサイズが小さければそちらを採用します。元の形式を必ず残したい場合はオフにしてください。',
      webpConversionFailedTitle: '変換に失敗しました',
      webpConversionFailedMessage:
        '画像を変換できなかったため、元のファイルをそのまま使用しました。',
      deleteButton: '削除',
      deleteConfirmTitle: 'ファイルを削除',
      deleteConfirmMessage: '「{name}」を削除しますか？',
      noFiles: 'まだファイルがアップロードされていません。',
      errorAccess: 'アプリのファイルディレクトリにアクセスできませんでした。',
      errorLoad: 'ファイルを読み込めませんでした。',
      uploadFailedTitle: 'アップロードに失敗しました',
      uploadFailedMessage: '選択したファイルにアクセスできませんでした。',
      unsupportedFileTitle: 'サポートされていないファイル',
      unsupportedFileMessage: '選択したファイルタイプは許可されていません。',
      errorUpload: 'ファイルをアップロードできませんでした。',
      errorDelete: 'ファイルを削除できませんでした。',
      thumbnailLabel: 'ファイル',
    },
    editorScreen: {
      subtitle:
        'フレーム編集・アニメーション再生・AnimatedSprite2Dでのプレビュー・ディスク保存をこの画面でまとめて行えます。',
      legalHeading: '利用規約・ポリシー',
      infoAppSectionHeading: 'アプリ情報',
      infoAppHeading: 'アプリ概要',
      infoAppDescription:
        'このアプリは react-native-skia-sprite-animator をそのまま使って構築したサンプルです。Animation Studio、Sprite Storage のワークフロー、AnimatedSprite2D のプレビューは、ライブラリが公開するコンポーネントを組み合わせて実装しています。',
      infoAppModuleNote:
        'これらのコンポーネントを組み合わせれば、スプライトシートの切り出しやアニメーションタイムラインの編集、メタデータ管理、再生プレビューまでを独自ツールなしで行えます。既存のエディタに組み込んだり、用途に応じてカスタマイズすることも可能です。',
      infoAppCustomization: '',
      infoAppJsonUsage:
        'エクスポートされる cleanSpriteData JSON は AnimatedSprite2D と Sprite Storage ヘルパーが理解できるフォーマットなので、react-native-skia-sprite-animator を利用するアプリでは変換なしで読み込めます。',
      infoAppSampleHeading: 'デモ',
      infoAppSampleDescription:
        'JSON とスプライトシートの画像ファイルを読み込み、各フレームを AnimatedSprite2D が期待するフォーマットへ変換して描画します。下のプレビューはこのサンプルコードと同じ設定で動作しています。',
      infoAppSampleCodeLabel: 'サンプルコード',
      infoAppSampleCode:
        "import React from 'react';\nimport spriteSheet from './assets/sprite.png';\nimport spriteJson from './assets/sprite.json';\nimport { AnimatedSprite2D } from 'react-native-skia-sprite-animator';\n\nconst frames = {\n  frames: spriteJson.frames.map((frame) => ({\n    id: frame.id,\n    width: frame.w,\n    height: frame.h,\n    duration: frame.duration,\n    image: {\n      type: 'require',\n      assetId: spriteSheet,\n      subset: frame.x !== undefined && frame.y !== undefined\n        ? { x: frame.x, y: frame.y, width: frame.w, height: frame.h }\n        : undefined,\n    },\n  })),\n  animations: spriteJson.animations,\n  animationsMeta: spriteJson.animationsMeta,\n  autoPlayAnimation: spriteJson.autoPlayAnimation ?? null,\n  meta: spriteJson.meta,\n};\n\nexport const PlayerPreview = () => {\n  return <AnimatedSprite2D frames={frames} animation=\"walk\" autoplay=\"walk\" centered />;\n};",
      infoAppSamplePreviewLabel: 'AnimatedSprite2D プレビュー',
      infoAppLinkLabel: 'アプリ概要',
      infoCenterTitle: 'インフォメーション',
      legalOverviewIntro:
        '本アプリに適用される利用規約・プライバシーポリシー・オープンソースライセンスはこちらから確認できます。',
      termsTitle: '利用規約',
      privacyTitle: 'プライバシーポリシー',
      licensesTitle: 'オープンソースライセンス',
      termsBodyIntro:
        'React Native Skia Sprite Animator をインストールまたは利用することにより、利用者は適用法令を遵守し、知的財産権を尊重し、第三者の権利を侵害する素材をアップロードしないことに同意したものとみなします。アプリに取り込むデータや成果物の管理は利用者の責任です。',
      termsBodyUse:
        '本アプリは現状有姿で提供され、明示または黙示を問わず一切の保証を行いません。不正利用、リバースエンジニアリング、セキュリティ侵害を試みる行為が確認された場合は予告なく利用を停止することがあります。',
      termsBodyContact:
        '作業内容のバックアップは利用者が管理してください。アプリの仕様変更や利用停止に起因するデータ消失、営業上の損失、その他の損害について開発者は責任を負いません。規約は予告なく改定され、改定後も利用を継続する場合は新しい規約に同意したものとみなされます。',
      privacyBodyIntro:
        'React Native Skia Sprite Animator は個人情報や解析データを収集しません。スプライト画像や JSON などのデータは利用者のデバイスに留まり、利用者が明示的に共有しない限り外部へ送信されません。Expo ランタイムや OS が匿名の診断情報を収集する場合がありますが、それぞれのポリシーに従います。',
      privacyBodyContact:
        'サポート依頼で受け取ったメールアドレス等は回答のみに使用し、第三者へ共有・販売することはありません。アプリをアンインストールすればローカルに保存されたデータも削除されます。',
      licensesIntro:
        'React Native Skia Sprite Animator は以下のオープンソースモジュールを利用しています。各プロジェクトのライセンス文を参照してください。',
      helpHeading: 'サポート情報',
      appVersionLabel: 'アプリバージョン',
      helpOverviewIntro: 'ご意見・ご要望や最新の開発状況は以下のリンクからご覧いただけます。',
      contactLinkLabel: 'お問い合わせフォーム',
      githubLinkLabel: 'GitHub リポジトリ',
    },
    framePicker: {
      title: 'フレームピッカー',
      emptyMessage: 'ファイルブラウザーから画像を選択すると分割を開始できます。',
    },
  },
};

/**
 * Returns true when the provided locale hints should map to Japanese strings.
 */
const shouldUseJapanese = (languageCode?: string | null, regionCode?: string | null) => {
  const normalizedLanguage = languageCode?.toLowerCase();
  const normalizedRegion = regionCode?.toUpperCase();
  if (normalizedLanguage === 'ja') {
    return true;
  }
  if (normalizedRegion === 'JP') {
    return true;
  }
  return false;
};

/**
 * Resolves the best-fit editor language key based on the device locale.
 */
const getLanguageKey = (): SupportedLanguage => {
  try {
    if (typeof Localization.getLocales === 'function') {
      const locales = Localization.getLocales();
      if (Array.isArray(locales) && locales.length > 0) {
        const primary = locales[0];
        if (shouldUseJapanese(primary?.languageCode, primary?.regionCode)) {
          return 'ja';
        }
        if (primary?.languageTag) {
          const normalizedTag = primary.languageTag.replace(/_/g, '-');
          const [languageTag, regionTag] = normalizedTag.split('-');
          if (shouldUseJapanese(languageTag, regionTag)) {
            return 'ja';
          }
        }
      }
    }
  } catch {
    // ignore errors
  }
  return 'en';
};

/**
 * Returns the localized string table for the detected device language.
 */
export const getEditorStrings = (): EditorStrings => {
  return translations[getLanguageKey()];
};

/**
 * Performs placeholder substitution on a localized template string.
 */
export const formatEditorString = (
  template: string,
  values: Record<string, string | number>,
): string => {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const replacement = values[key];
    return typeof replacement === 'undefined' ? '' : String(replacement);
  });
};
