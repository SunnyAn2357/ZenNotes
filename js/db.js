const request = indexedDB.open("ZenMemoDB_Ultimate", 2);

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
  if (!store.indexNames.contains("parentId")) {
    store.createIndex("parentId", "parentId", { unique: false });
  }
  if (!store.indexNames.contains("type")) {
    store.createIndex("type", "type", { unique: false });
  }
};

request.onsuccess = async (e) => {
  db = e.target.result;
  console.log("✅ 로컬 DB 연결 성공!");

  await initFileSystem();

  healDatabase(() => {
    runAutoPurge();
    loadMemoList();
    if (typeof updateUnsyncedCount === "function") updateUnsyncedCount();
    if (typeof handleLaunchParams === "function") handleLaunchParams();
  });
};

request.onerror = (e) => {
  console.error("❌ 로컬 DB 열기 실패:", e.target.error);
  alert(
    "브라우저 저장소(IndexedDB)에 접근할 수 없습니다.\n시크릿 모드이거나 쿠키 차단 설정이 켜져 있는지 확인해 주세요.",
  );
};

async function initFileSystem() {
  return new Promise((resolve) => {
    const tx = db.transaction(["memos"], "readwrite");
    const store = tx.objectStore("memos");
    let needsMigration = [];

    store.getAll().onsuccess = (e) => {
      const allData = e.target.result;

      allData.forEach((item) => {
        if (item.type === "folder") {
          let needsUpdate = false;
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
          if (needsUpdate) store.put(item);
        }
      });

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

      needsMigration = allData.filter((item) => item.type === undefined);

      if (!globalDesktopFolderId) {
        store.add({
          title: "바탕 화면",
          type: "folder",
          isSystem: "desktop",
          parentId: null,
          updatedAt: Date.now(),
          isDeleted: false,
          syncId: "sys_desktop",
        }).onsuccess = (ev) => {
          globalDesktopFolderId = ev.target.result;
          migrateFiles(globalDesktopFolderId);
        };
      }
      if (!globalSecurityFolderId) {
        store.add({
          title: "보안 폴더",
          type: "folder",
          isSystem: "security",
          parentId: null,
          isLocked: true,
          updatedAt: Date.now(),
          isDeleted: false,
          syncId: "sys_security",
        }).onsuccess = (ev) => {
          globalSecurityFolderId = ev.target.result;
        };
      }
      if (!globalTrashFolderId) {
        store.add({
          title: "휴지통",
          type: "folder",
          isSystem: "trash",
          parentId: null,
          updatedAt: Date.now(),
          isDeleted: false,
          syncId: "sys_trash",
        }).onsuccess = (ev) => {
          globalTrashFolderId = ev.target.result;
        };
      }
      if (!globalBackupFolderId) {
        store.add({
          title: "쓸어 담기",
          type: "folder",
          isSystem: "backup",
          parentId: null,
          updatedAt: Date.now(),
          isDeleted: false,
          syncId: "sys_backup",
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
    tx.oncomplete = () => resolve();
  });
}

function healDatabase(callback) {
  if (!db) {
    if (callback) callback();
    return;
  }
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  store.getAll().onsuccess = (e) => {
    const allData = e.target.result;
    const sysGroups = { desktop: [], security: [], trash: [], backup: [] };
    allData.forEach((m) => {
      if (m.isSystem && sysGroups[m.isSystem]) sysGroups[m.isSystem].push(m);
    });

    const dupToMasterMap = new Map();
    const duplicateIds = new Set();
    const validIds = new Set();

    Object.keys(sysGroups).forEach((sysType) => {
      const group = sysGroups[sysType];
      if (group.length > 1) {
        group.sort((a, b) => a.id - b.id);
        const masterId = group[0].id;
        if (sysType === "desktop") globalDesktopFolderId = masterId;
        if (sysType === "security") globalSecurityFolderId = masterId;
        if (sysType === "trash") globalTrashFolderId = masterId;
        if (sysType === "backup") globalBackupFolderId = masterId;

        for (let i = 1; i < group.length; i++) {
          const dupId = group[i].id;
          dupToMasterMap.set(dupId, masterId);
          duplicateIds.add(dupId);
          store.delete(dupId);
        }
      }
    });

    allData.forEach((m) => {
      if (!duplicateIds.has(m.id)) validIds.add(m.id);
    });

    allData.forEach((m) => {
      if (duplicateIds.has(m.id)) return;
      let currentParent = m.parentId;
      let changed = false;

      if (dupToMasterMap.has(currentParent)) {
        m.parentId = dupToMasterMap.get(currentParent);
        changed = true;
      } else if (currentParent !== null && !validIds.has(currentParent)) {
        m.parentId = globalDesktopFolderId;
        changed = true;
      }
      if (changed) store.put(m);
    });
  };
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
        m.isDeleted = true;
        m.deletedAt = Date.now();
        m.isPermanentlyDeleted = true;
        m.updatedAt = Date.now();
        cursor.update(m);
        isPurged = true;
      }
      cursor.continue();
    }
  };

  tx.oncomplete = () => {
    if (isPurged) {
      loadMemoList(true);
      if (typeof updateUnsyncedCount === "function") updateUnsyncedCount();
    }
  };
}

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

    if (isTitleEmptyOrAuto && hasNoContent) {
      m.isDeleted = true;
      m.deletedAt = Date.now();
      m.isPermanentlyDeleted = true;
      m.updatedAt = Date.now();
      store.put(m);
      tx.oncomplete = () => {
        loadMemoList(true);
        if (typeof updateUnsyncedCount === "function") updateUnsyncedCount();
      };
    }
  };
}

function forceSaveImmediate() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    executeSave();
  }
}

window.addEventListener("beforeunload", () => {
  purgeEmptyMemos();
  forceSaveImmediate();
});

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

// 🚀 [군사급 암호화 엔진] Web Crypto API (AES-GCM 256bit)
async function getCryptoKey(password) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );
  const salt = enc.encode("ZenNotes_Ultimate_Crypto_Salt_2026");
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

async function encryptData(plainText, cryptoKey) {
  if (!plainText) return "";
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    enc.encode(plainText),
  );
  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);

  return new Promise((resolve) => {
    const blob = new Blob([combined]);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(",")[1];
      resolve("ZENENC::" + base64);
    };
    reader.readAsDataURL(blob);
  });
}

async function decryptData(encryptedText, cryptoKey) {
  if (!encryptedText || !encryptedText.startsWith("ZENENC::"))
    return encryptedText;
  const base64 = encryptedText.replace("ZENENC::", "");
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    data,
  );
  return new TextDecoder().decode(decryptedBuffer);
}

// 🎯 통합 저장 엔진
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

  const targetParentId = currentMemoId
    ? await getMemoParentIdDB(currentMemoId)
    : targetNewMemoFolderId;
  const isSecure = await checkIsUnderSecurity(targetParentId);

  let finalContent = content;
  let finalPlainText = plainText;

  if (isSecure) {
    if (!currentSecKey) {
      showToast("보안 세션이 만료되어 변경 사항을 저장할 수 없습니다.");
      isSaving = false;
      updateUIState("saved");
      return;
    }
    finalContent = await encryptData(content, currentSecKey);
    finalPlainText = await encryptData(plainText, currentSecKey);
  }

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  if (currentMemoId) {
    store.get(currentMemoId).onsuccess = (e) => {
      const m = e.target.result;
      if (m) {
        m.title = title;
        m.content = finalContent;
        m.plainText = finalPlainText;
        m.updatedAt = Date.now();
        store.put(m);
      }
    };
  } else {
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
