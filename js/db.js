const request = indexedDB.open("ZenMemoDB_Ultimate", 2); // 🎯 버전 2로 업그레이드

request.onupgradeneeded = (e) => {
  db = e.target.result;
  let store;
  if (!db.objectStoreNames.contains("memos")) {
    store = db.createObjectStore("memos", {
      keyPath: "id",
      autoIncrement: true,
    });
    store.createIndex("updatedAt", "updatedAt", { unique: false });
  } else {
    store = e.target.transaction.objectStore("memos");
  }

  // 🎯 버전 2: 폴더 관리를 위한 필수 인덱스 추가 (무한 중첩 폴더용)
  if (!store.indexNames.contains("parentId")) {
    store.createIndex("parentId", "parentId", { unique: false });
  }
  if (!store.indexNames.contains("type")) {
    store.createIndex("type", "type", { unique: false }); // 'file' or 'folder'
  }
};

request.onsuccess = async (e) => {
  db = e.target.result;
  console.log("✅ 로컬 DB 연결 성공!");

  await initFileSystem(); // 🎯 시스템 폴더 생성 및 마이그레이션 실행

  // 🎯 [수정] 자가 치유 엔진 가동 후 안전하게 앱 로딩 진행
  healDatabase(() => {
    runAutoPurge();
    loadMemoList();
    updateUnsyncedCount();
    handleLaunchParams();
  });
};

// 👇 이 부분이 추가되었습니다. DB 연결이 막혔을 때 에러를 띄워줍니다.
request.onerror = (e) => {
  console.error("❌ 로컬 DB 열기 실패:", e.target.error);
  alert(
    "브라우저 저장소(IndexedDB)에 접근할 수 없습니다.\n시크릿 모드이거나 쿠키 차단 설정이 켜져 있는지 확인해 주세요.",
  );
};

// 🎯 [신규 함수 추가] 파일 시스템 초기화 및 기존 데이터 바탕화면으로 마이그레이션
async function initFileSystem() {
  return new Promise((resolve) => {
    const tx = db.transaction(["memos"], "readwrite");
    const store = tx.objectStore("memos");

    let needsMigration = [];

    store.getAll().onsuccess = (e) => {
      const allData = e.target.result;

      // 🚀 [신규: 1차 방어막] 과거에 만들어진 일반 폴더가 4대장 행세를 하거나, 고유 번호(syncId)가 없는 경우 강제 업그레이드
      allData.forEach((item) => {
        if (item.type === "folder") {
          let needsUpdate = false;

          // 이름이 같으면 무조건 4대장 시스템 폴더로 강제 편입 (과거 JSON 백업 파일 복원 시 완벽 대응)
          if (item.title === "바탕 화면" && item.isSystem !== "desktop") {
            item.isSystem = "desktop";
            needsUpdate = true;
          }
          if (item.title === "보안 폴더" && item.isSystem !== "security") {
            item.isSystem = "security";
            needsUpdate = true;
          }
          if (item.title === "휴지통" && item.isSystem !== "trash") {
            item.isSystem = "trash";
            needsUpdate = true;
          }
          if (item.title === "쓸어 담기" && item.isSystem !== "backup") {
            item.isSystem = "backup";
            needsUpdate = true;
          }

          // 4대장에게 구글 드라이브가 절대 헷갈리지 않을 '글로벌 고정 주민번호(syncId)' 발급
          if (item.isSystem === "desktop" && item.syncId !== "sys_desktop") {
            item.syncId = "sys_desktop";
            needsUpdate = true;
          }
          if (item.isSystem === "security" && item.syncId !== "sys_security") {
            item.syncId = "sys_security";
            needsUpdate = true;
          }
          if (item.isSystem === "trash" && item.syncId !== "sys_trash") {
            item.syncId = "sys_trash";
            needsUpdate = true;
          }
          if (item.isSystem === "backup" && item.syncId !== "sys_backup") {
            item.syncId = "sys_backup";
            needsUpdate = true;
          }

          if (needsUpdate) store.put(item); // 수정한 내용은 즉시 DB에 덮어쓰기
        }
      });

      // 1. 고정 시스템 폴더 존재 여부 확인
      const desktopFolder = allData.find(
        (item) => item.type === "folder" && item.isSystem === "desktop",
      );
      const securityFolder = allData.find(
        (item) => item.type === "folder" && item.isSystem === "security",
      );
      const trashFolder = allData.find(
        (item) => item.type === "folder" && item.isSystem === "trash",
      );
      const backupFolder = allData.find(
        (item) => item.type === "folder" && item.isSystem === "backup",
      );

      if (desktopFolder) globalDesktopFolderId = desktopFolder.id;
      if (securityFolder) globalSecurityFolderId = securityFolder.id;
      if (trashFolder) globalTrashFolderId = trashFolder.id;
      if (backupFolder) globalBackupFolderId = backupFolder.id;

      // 2. 과거에 만들어진 노트들 분류
      needsMigration = allData.filter((item) => item.type === undefined);

      // 3. 바탕 화면 폴더 생성 (고정 syncId 부여)
      if (!globalDesktopFolderId) {
        store.add({
          title: "바탕 화면",
          type: "folder",
          isSystem: "desktop",
          parentId: null,
          updatedAt: Date.now(),
          isDeleted: false,
          syncId: "sys_desktop", // 🎯 필수!
        }).onsuccess = (ev) => {
          globalDesktopFolderId = ev.target.result;
          migrateFiles(globalDesktopFolderId);
        };
      }

      // 4. 보안 폴더 생성
      if (!globalSecurityFolderId) {
        store.add({
          title: "보안 폴더",
          type: "folder",
          isSystem: "security",
          parentId: null,
          isLocked: true,
          updatedAt: Date.now(),
          isDeleted: false,
          syncId: "sys_security", // 🎯 필수!
        }).onsuccess = (ev) => {
          globalSecurityFolderId = ev.target.result;
        };
      }

      // 5. 🎯 휴지통 폴더 생성
      if (!globalTrashFolderId) {
        store.add({
          title: "휴지통",
          type: "folder",
          isSystem: "trash",
          parentId: null,
          updatedAt: Date.now(),
          isDeleted: false,
          syncId: "sys_trash", // 🎯 필수!
        }).onsuccess = (ev) => {
          globalTrashFolderId = ev.target.result;
        };
      }

      // 6. 🎯 쓸어 담기 폴더 생성 (4대장)
      if (!globalBackupFolderId) {
        store.add({
          title: "쓸어 담기",
          type: "folder",
          isSystem: "backup",
          parentId: null,
          updatedAt: Date.now(),
          isDeleted: false,
          syncId: "sys_backup", // 🎯 필수!
        }).onsuccess = (ev) => {
          globalBackupFolderId = ev.target.result;
        };
      }

      if (globalDesktopFolderId) migrateFiles(globalDesktopFolderId);

      function migrateFiles(targetDesktopId) {
        needsMigration.forEach((file) => {
          file.type = "file";
          file.parentId = targetDesktopId;
          store.put(file);
        });
      }
    };
    tx.oncomplete = () => {
      resolve();
    };
  });
}

// 🎯 [자가 치유 엔진] 중복 폴더 자동 병합 및 미아 파일 구출 시스템
function healDatabase(callback) {
  if (!db) {
    if (callback) callback();
    return;
  }

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  store.getAll().onsuccess = (e) => {
    const allData = e.target.result;
    let needsUpdate = false;

    // 1. 4대장(시스템 폴더) 종류별로 줄 세우기
    const sysGroups = { desktop: [], security: [], trash: [], backup: [] };
    allData.forEach((m) => {
      if (m.isSystem && sysGroups[m.isSystem]) sysGroups[m.isSystem].push(m);
    });

    const dupToMasterMap = new Map();
    const duplicateIds = new Set();
    const validIds = new Set();

    // 2. 중복 폴더 색출 및 파괴
    Object.keys(sysGroups).forEach((sysType) => {
      const group = sysGroups[sysType];
      if (group.length > 1) {
        group.sort((a, b) => a.id - b.id); // 가장 먼저 만들어진 '진짜 원본'을 찾음
        const masterId = group[0].id;

        // 🚀 [신규: 2차 방어막] 가짜 폴더를 폭파시켰을 때, 앱의 '글로벌 기억 장치'가 가짜를 가리키고 있다면 즉시 진짜 원본으로 교정!
        if (sysType === "desktop") globalDesktopFolderId = masterId;
        if (sysType === "security") globalSecurityFolderId = masterId;
        if (sysType === "trash") globalTrashFolderId = masterId;
        if (sysType === "backup") globalBackupFolderId = masterId;

        for (let i = 1; i < group.length; i++) {
          const dupId = group[i].id;
          dupToMasterMap.set(dupId, masterId); // 가짜 ID가 진짜 ID를 찾아갈 수 있게 지도 작성
          duplicateIds.add(dupId);
          store.delete(dupId); // 가짜 폴더 껍데기 통쾌하게 폭파!
          needsUpdate = true;
        }
      }
    });

    // 3. 살아남은 정상적인 ID 목록 작성
    allData.forEach((m) => {
      if (!duplicateIds.has(m.id)) validIds.add(m.id);
    });

    // 4. 가짜 폴더에 갇혀있던 파일이나 부모를 잃어버린 파일 구출 작전
    allData.forEach((m) => {
      if (duplicateIds.has(m.id)) return; // 폭파된 가짜 폴더는 무시

      let currentParent = m.parentId;
      let changed = false;

      // 작전 A: 가짜 폴더에 들어있던 파일들을 진짜 폴더(원본)로 무사히 이동
      if (dupToMasterMap.has(currentParent)) {
        m.parentId = dupToMasterMap.get(currentParent);
        changed = true;
      }
      // 작전 B: 동기화 오류로 부모 폴더를 잃어버려 허공에 뜬 미아 파일들을 바탕화면으로 안전하게 착륙
      else if (currentParent !== null && !validIds.has(currentParent)) {
        m.parentId = globalDesktopFolderId;
        changed = true;
      }

      if (changed) {
        store.put(m);
        needsUpdate = true;
      }
    });
  };

  // 청소 완료 보고
  tx.oncomplete = () => {
    if (callback) callback();
  };
}

function runAutoPurge() {
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.getAll().onsuccess = (e) => {
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    e.target.result.forEach((m) => {
      if (m.isDeleted && m.deletedAt && now - m.deletedAt > THIRTY_DAYS) {
        store.delete(m.id);
      }
    });
  };
}

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

// 🎯 [수정] 듀얼 상태점(에디터/파일관리창) 동시 제어 및 '미동기' 텍스트 적용
function updateUIState(state) {
  if (statusTextTimer) {
    clearTimeout(statusTextTimer);
    statusTextTimer = null;
  }
  const statusDots = document.querySelectorAll(".status-dot");
  const statusTexts = document.querySelectorAll(".status-text");

  const applyState = (dotClass, textStr, opacityStr) => {
    statusDots.forEach((dot) => (dot.className = `status-dot ${dotClass}`));
    statusTexts.forEach((t) => {
      t.innerText =
        textStr === "default" ? t.dataset.nsText || "미동기: 0" : textStr;
      if (opacityStr !== undefined) t.style.opacity = opacityStr;
    });
  };

  if (state === "typing" || state === "saving") {
    if (typingStartTime === 0) typingStartTime = Date.now();
    applyState("unsaved pulse-fast", "saving", "1");
  } else if (state === "saved") {
    const elapsed = Date.now() - typingStartTime;
    const remain = typingStartTime > 0 ? Math.max(0, 2000 - elapsed) : 0;
    statusTextTimer = setTimeout(() => {
      if (saveTimer || isSaving) return;
      typingStartTime = 0;
      applyState("saved pulse-slow", "saved", "1");
      statusTextTimer = setTimeout(() => {
        if (!saveTimer && !isSaving) applyState("saved", "default");
      }, 2000);
    }, remain);
  } else if (state === "syncing") {
    syncStartTime = Date.now();
    applyState("unsaved pulse-fast", "syncing", "1");
  } else if (state === "synced") {
    const elapsed = Date.now() - syncStartTime;
    const remain = syncStartTime > 0 ? Math.max(0, 2000 - elapsed) : 0;
    statusTextTimer = setTimeout(() => {
      syncStartTime = 0;
      applyState("saved", "synced", "1");
      statusTextTimer = setTimeout(() => {
        applyState("saved", "default");
      }, 2000);
    }, remain);
  } else if (state === "sync-error") {
    applyState("unsaved", "sync error", "1");
  } else {
    typingStartTime = 0;
    syncStartTime = 0;
    applyState("saved", "default", "1");
  }
}

function triggerAutoSave() {
  if (isLoading) return;
  updateUIState("typing");
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(executeSave, 1200);
}

// ✅ 추가할 함수: 동기화되지 않은 노트(ns) 개수 계산
function updateUnsyncedCount() {
  if (!db) return;
  const lastSync = parseInt(
    localStorage.getItem("zen_last_sync_time") || "0",
    10,
  );

  db
    .transaction(["memos"], "readonly")
    .objectStore("memos")
    .getAll().onsuccess = (e) => {
      const memos = e.target.result;
      const unsyncedCount = memos.filter((m) => m.updatedAt > lastSync).length;

      // 🎯 [수정] 모든 상태 텍스트에 '미동기: X' 적용
      const statusTexts = document.querySelectorAll(".status-text");
      statusTexts.forEach((t) => {
        t.dataset.nsText = `미동기: ${unsyncedCount}`;
        if (
          t.innerText.startsWith("미동기:") ||
          t.innerText.startsWith("ns:") ||
          t.innerText === "offline"
        ) {
          t.innerText = `미동기: ${unsyncedCount}`;
          t.style.opacity = "1";
        }
      });
    };
}

// 🎯 헬퍼 함수: DB에서 특정 메모의 parentId를 꺼내옵니다.
function getMemoParentIdDB(id) {
  return new Promise((resolve) => {
    db
      .transaction(["memos"], "readonly")
      .objectStore("memos")
      .get(id).onsuccess = (e) => {
        resolve(e.target.result ? e.target.result.parentId : null);
      };
  });
}

// 🎯 헬퍼 함수: 특정 폴더가 '보안 폴더' 소속인지 족보를 무한 추적하여 검증합니다.
async function checkIsUnderSecurity(folderId) {
  if (!folderId) return false;
  if (folderId === globalSecurityFolderId) return true;
  return new Promise((resolve) => {
    db
      .transaction(["memos"], "readonly")
      .objectStore("memos")
      .getAll().onsuccess = (e) => {
        const allData = e.target.result;
        const fMap = new Map();
        allData.forEach((m) => {
          if (m.type === "folder") fMap.set(m.id, m);
        });
        let curr = folderId;
        while (curr) {
          if (curr === globalSecurityFolderId) {
            resolve(true);
            return;
          }
          const parent = fMap.get(curr);
          if (!parent) break;
          curr = parent.parentId;
        }
        resolve(false);
      };
  });
}

function forceSaveImmediate() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    executeSave();
  }
}

window.addEventListener("beforeunload", () => {
  purgeEmptyMemos(); // 브라우저 종료 전 쓰레기 메모 청소
  forceSaveImmediate();
  // [핵심 변경사항] PC 종료 시 동기화(syncDataToCloud) 삭제 완료
});

// DB 전체를 스캔하여 빈 껍데기 메모를 '유령화(영구 숨김)' 처리하는 함수
function purgeEmptyMemos() {
  if (!db) return;
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  let isPurged = false;

  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const m = cursor.value;
      const title = (m.title || "").trim();
      const isTitleEmptyOrAuto =
        title === "" || title === "제목 없는 노트" || title === "Untitled";

      const plainText = (m.plainText || "").trim();
      const contentHTML = m.content || "";
      const hasNoContent = plainText === "" && !contentHTML.includes("<img");

      if (isTitleEmptyOrAuto && hasNoContent) {
        // 🎯 [수정] 즉각 삭제(cursor.delete) 대신 유령 꼬리표 부착!
        m.isDeleted = true; // 30일 청소부 작동을 위한 조건 1
        m.deletedAt = Date.now(); // 30일 청소부 작동을 위한 타이머
        m.isPermanentlyDeleted = true; // 휴지통에서도 숨기기 위한 투명 망토
        m.updatedAt = Date.now(); // 동기화 서버에 상태 변경 알림
        cursor.update(m);
        isPurged = true;
      }
      cursor.continue();
    }
  };

  tx.oncomplete = () => {
    if (isPurged) {
      loadMemoList(true); // 유령화된 메모가 있다면 목록 즉시 갱신
      if (typeof updateUnsyncedCount === "function") updateUnsyncedCount(); // 동기화 카운트 반영
    }
  };
}

// 🎯 방금까지 편집하던 '현재 노트' 단 1개만 검사해서 빈 껍데기면 유령화시키는 핀셋 함수
function purgeMemoIfEmpty(memoIdToEvict) {
  if (!memoIdToEvict || !db) return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  store.get(memoIdToEvict).onsuccess = (e) => {
    const m = e.target.result;
    if (!m) return;

    const title = (m.title || "").trim();
    const isTitleEmptyOrAuto =
      title === "" || title === "제목 없는 노트" || title === "Untitled";
    const plainText = (m.plainText || "").trim();
    const contentHTML = m.content || "";
    const hasNoContent = plainText === "" && !contentHTML.includes("<img");

    // 조건에 맞으면 해당 노트 딱 1개만 즉시 유령화
    if (isTitleEmptyOrAuto && hasNoContent) {
      // 🎯 [수정] 즉각 삭제(store.delete) 대신 유령 꼬리표 부착!
      m.isDeleted = true;
      m.deletedAt = Date.now();
      m.isPermanentlyDeleted = true;
      m.updatedAt = Date.now();
      store.put(m);

      tx.oncomplete = () => {
        loadMemoList(true); // 조용히 목록 새로고침
        if (typeof updateUnsyncedCount === "function") updateUnsyncedCount(); // 동기화 카운트 반영
      };
    }
  };
}

// ============================================================================
// 🚀 [군사급 암호화 엔진] Web Crypto API (AES-GCM 256bit)
// 상용 보안 앱에 사용되는 최상위 레벨의 브라우저 내장 암호화 시스템입니다.
// ============================================================================

// 1. 사용자의 비밀번호(문자열)를 강력한 AES-GCM 256비트 암호화 키로 변환하는 해시 공장
async function getCryptoKey(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );
  // 소금(Salt)은 로컬 DB 특성상 기기 간 동기화 후에도 복호화할 수 있도록 강력한 고정값을 사용합니다.
  const salt = enc.encode("ZenNotes_Ultimate_Crypto_Salt_2026");

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

// 2. 평문 텍스트(Base64 이미지 포함) -> 복호화 불가능한 외계어(암호문)로 변환
async function encryptData(plainText, cryptoKey) {
  if (!plainText) return "";

  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12바이트 랜덤 IV (초기화 벡터) 생성
  const enc = new TextEncoder();

  // 본문을 완전히 갈아엎어 암호화 버퍼로 변환합니다.
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    enc.encode(plainText),
  );

  // IV와 암호문을 한 덩어리로 합쳐서 Base64 텍스트로 인코딩합니다.
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  // 🎯 대용량 데이터(사진 등) 처리를 위해 Call Stack 크래시를 방지하는 Blob FileReader 기법 적용!
  return new Promise((resolve) => {
    const blob = new Blob([combined]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(",")[1];
      // 외계어 앞에 '이건 암호화된 노트다!'라는 꼬리표(ZENENC::)를 붙여줍니다.
      resolve("ZENENC::" + base64);
    };
    reader.readAsDataURL(blob);
  });
}

// 3. 외계어(암호문) -> 사람이 읽을 수 있는 평문으로 변환 (해독기)
async function decryptData(encryptedText, cryptoKey) {
  // 우리가 만든 암호문 형태가 아니면 그냥 그대로 반환(패스)합니다.
  if (!encryptedText || !encryptedText.startsWith("ZENENC::"))
    return encryptedText;

  // 꼬리표를 떼어내고 순수 암호문만 분리
  const base64 = encryptedText.replace("ZENENC::", "");
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);

  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  // 합쳐놨던 IV(12바이트)와 실제 암호 데이터를 다시 분리
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);

  // 열쇠(cryptoKey)를 넣고 자물쇠를 풉니다!
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    data,
  );

  // 한국어/영어로 완벽하게 복원!
  return new TextDecoder().decode(decryptedBuffer);
}

async function executeSave() {
  if (isSaving || isLoading) {
    pendingSave = true;
    return;
  }
  const title =
    document.getElementById("memo-title-input").value.trim() ||
    "제목 없는 노트";
  const content = quill.root.innerHTML,
    plainText = quill.getText();
  const hasNoText = plainText.trim() === "";
  const hasNoImage = !content.includes("<img");

  // 신규 노트인데 내용이 아무것도 없으면 저장하지 않음
  if (
    !currentMemoId &&
    !document.getElementById("memo-title-input").value &&
    hasNoText &&
    hasNoImage
  ) {
    updateUIState("saved");
    saveTimer = null;
    return;
  }

  isSaving = true;
  updateUIState("saving");

  // 🎯 1. 현재 편집 중인 노트가 암호화 대상(보안 폴더 소속)인지 검증합니다.
  const targetParentId = currentMemoId
    ? await getMemoParentIdDB(currentMemoId)
    : targetNewMemoFolderId;
  const isSecure = await checkIsUnderSecurity(targetParentId);

  let finalContent = content;
  let finalPlainText = plainText;

  // 🎯 2. 보안 구역일 경우 암호화 수행
  if (isSecure) {
    if (!currentSecKey) {
      showToast("보안 세션이 만료되어 변경 사항을 저장할 수 없습니다.");
      isSaving = false;
      updateUIState("saved");
      return; // 열쇠가 없으면 평문 유출 방지를 위해 저장을 차단
    }
    // 본문과 순수 텍스트를 모두 AES-GCM 외계어로 변환
    finalContent = await encryptData(content, currentSecKey);
    finalPlainText = await encryptData(plainText, currentSecKey);
  }

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  if (currentMemoId) {
    // 🎯 기존 노트 수정 시
    store.get(currentMemoId).onsuccess = (e) => {
      const m = e.target.result;
      if (m) {
        m.title = title; // 📌 제목은 검색을 위해 무조건 평문 유지!
        m.content = finalContent;
        m.plainText = finalPlainText;
        m.updatedAt = Date.now();
        store.put(m);
      }
    };
  } else {
    // 🎯 신규 노트 작성 시
    const memoData = {
      title,
      content: finalContent,
      plainText: finalPlainText,
      updatedAt: Date.now(),
      isDeleted: false,
      type: "file",
      syncId: generateSyncId(),
      parentId:
        targetNewMemoFolderId !== null
          ? targetNewMemoFolderId
          : globalDesktopFolderId,
    };
    store.add(memoData).onsuccess = (e) => {
      currentMemoId = e.target.result;
    };
  }

  tx.oncomplete = () => {
    isSaving = false;
    saveTimer = null;
    updateUIState("saved");
    loadMemoList(true);
    updateUnsyncedCount();
    if (pendingSave) {
      pendingSave = false;
      executeSave();
    }
  };
}
