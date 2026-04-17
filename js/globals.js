// 🎯 [Google API 설정]
const CLIENT_ID = '765080058790-uhqk1gj2ko8a197f26ujnq0gb4nl97ha.apps.googleusercontent.com';
const API_KEY = 'AIzaSyD1Z5E5e8tRfmG9fDruBM72pliOt6ZkShw';
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";
const SCOPES = "https://www.googleapis.com/auth/drive.file";
let tokenClient, gapiInited = false, gisInited = false;
let hasLoadedFromCloud = false;

// 🎯 [V3 추가] 토큰 만료 시간 추적용 변수
let tokenExpiryTime = 0;

// 🎯 [V3 추가] 타자 멈춤 감지용 백그라운드 동기화 타이머
let backgroundSyncTimer = null;

// 🎯 [앱 전역 상태]
let db, currentMemoId = null, saveTimer = null, isSaving = false, pendingSave = false, targetNewMemoFolderId = null;
let selectedMemos = new Set(), displayedMemos = [], lastSelectedId = null, isLoading = false, typingStartTime = 0;
let selectedTrashMemos = new Set(), displayedTrashMemos = [], lastSelectedTrashId = null;

// 🎯 [모바일 다중선택]
let isMultiSelectMode = false, isTrashMultiSelectMode = false, pressTimer = null, isPressTriggered = false;

// 🎯 [폴더 시스템 4대장]
let globalDesktopFolderId = null, globalSecurityFolderId = null, globalTrashFolderId = null, globalBackupFolderId = null;

// 🎯 [검색 타이머]
let mainSearchTimer = null, trashSearchTimer = null;

// 🎯 [UI 및 상태 타이머
let statusTextTimer = null, syncStartTime = 0, backPressTimer = 0, toastTimer = null, lastUndoData = null, refreshing = false, isReading = false;

// 🎯 [보안 폴더 상태]
let currentSecKey = null, isEditingSecureMemo = false, isSecurityUnlocked = false;
