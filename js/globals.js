// 🎯 [V4.3.0] Firebase 설정 (구글 드라이브 GAPI/GIS 설정을 대체)
// ※ apiKey는 웹 앱 공개용 식별자입니다. 데이터 보호는 Firestore 보안 규칙(본인 UID만 접근)이 담당합니다.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCPI34XN0NMTXXr5DYQeAtLwEcl5IaBN6g",
  authDomain: "zennotes-ads.firebaseapp.com",
  projectId: "zennotes-ads",
  storageBucket: "zennotes-ads.firebasestorage.app",
  messagingSenderId: "68150500972",
  appId: "1:68150500972:web:77f20999bf01eb7aa10249"
};

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
let currentSecKey = null, isEditingSecureMemo = false, isSecurityUnlocked = false, pendingRecentSecureMemoId = null;

// 🎯 [히스토리 방어막]
var programmaticBackCount = 0, isProgrammaticBack = false;
