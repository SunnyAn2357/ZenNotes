// 🎯 [앱 전역 상태 변수 모음] 가장 먼저 실행되어 모든 모듈이 공유하는 뇌세포들입니다.
let db,
  currentMemoId = null,
  saveTimer = null,
  isSaving = false,
  pendingSave = false,
  targetNewMemoFolderId = null;
let selectedMemos = new Set(),
  displayedMemos = [],
  lastSelectedId = null,
  isLoading = false,
  typingStartTime = 0;
let selectedTrashMemos = new Set(),
  displayedTrashMemos = [],
  lastSelectedTrashId = null;
let isMultiSelectMode = false,
  isTrashMultiSelectMode = false,
  pressTimer = null,
  isPressTriggered = false;

let globalDesktopFolderId = null,
  globalSecurityFolderId = null,
  globalTrashFolderId = null,
  globalBackupFolderId = null;
let currentSecKey = null,
  isEditingSecureMemo = false;

let statusTextTimer = null,
  syncStartTime = 0,
  backPressTimer = 0,
  toastTimer = null,
  lastUndoData = null,
  refreshing = false;
let mainSearchTimer = null,
  trashSearchTimer = null,
  isReading = false;
