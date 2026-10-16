// ============================================================================
// 🔥 [V4.3.0] ZenNotes Firebase 인증 + Firestore 클라우드 동기화 엔진
// ============================================================================
// - 기존 GAPI/GIS(구글 드라이브) 엔진은 `V4.2.4_구글인증동기화(최종)` 폴더에 원본 보존
// - 인증: Firebase Auth (Google 제공업체). 세션이 브라우저에 영구 보존되어 1시간 토큰 만료/무음 재연결 문제가 사라짐
// - 저장: Firestore  users/{uid}/items/{syncId}
//         대용량 본문(이미지·PDF 등 0.9MB 초과)은 users/{uid}/items/{syncId}/chunks/{i} 로 분할 저장
// - 로컬 IndexedDB가 원본(Offline-First)이며, Firestore는 기기 간 동기화 및 클라우드 보관용
//
// [함수 지도]
// 1. initFirebase() / handleAuthStateChanged()   : SDK 초기화 및 로그인 상태 감시
// 2. checkAuthState() / btn-auth 클릭           : 구름 아이콘 상태 표시, 로그인·로그아웃 (GEMINI.md 7번 정책)
// 3. smartSync()                                 : 동기화 총괄 (Pull → Push → 툼스톤 30일 청소)
// 4. fsPull() / fsApplyPulledDocs()              : serverUpdatedAt 커서 기반 델타 다운로드
// 5. fsPush() / fsPushItem()                     : 변경분 업로드 (분할 저장 포함), 툼스톤 기록
// 6. triggerBackgroundSync()                     : 타자 멈춤 3초 후 백그라운드 동기화
// 7. deleteAllCloudData()                        : 초기화 시 내 Firestore 데이터 전체 삭제
// 8. window.isZenOnline()                        : 공식 온라인 판정 창구 (로그인 + 네트워크)

let fbApp = null, fbAuth = null, fbStore = null, fbUser = null;
let isSyncRunning = false, isSyncQueued = false;

const FS_INLINE_MAX_BYTES = 900000;   // 본문+평문 합계가 이 크기 이하면 메인 문서에 그대로 저장
const FS_CHUNK_BYTES = 800000;        // 분할 조각 1개 최대 크기 (Firestore 문서 한도 1MiB 대비 안전마진)
const FS_PAGE_SIZE = 50;              // Pull 시 한 번에 읽는 문서 수
const FS_TOMBSTONE_TTL = 30 * 24 * 60 * 60 * 1000; // 영구삭제 꼬리표 보존 기간 (30일)

// ============================================================================
// 1. Firebase 초기화 및 로그인 상태 감시
// ============================================================================
function initFirebase() {
  // 🧹 구버전(GAPI) 토큰 잔재 청소 (zen_user_hint / zen_explicit_logout 은 정책상 계속 사용)
  ["zen_oauth_token", "zen_token_expiry", "zen_auto_login"].forEach((k) => localStorage.removeItem(k));

  if (typeof firebase === "undefined") {
    console.warn("⚠️ [Firebase] SDK를 불러오지 못했습니다(오프라인 등). 로컬 모드로 동작합니다.");
    checkAuthState();
    return;
  }

  try {
    fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbStore = firebase.firestore();
    fbAuth.onAuthStateChanged(handleAuthStateChanged);
    console.log("✅ [Firebase] 초기화 완료");
  } catch (e) {
    console.error("❌ [Firebase] 초기화 실패:", e);
    checkAuthState();
  }
}

function handleAuthStateChanged(user) {
  fbUser = user || null;

  if (fbUser) {
    // 🌟 [정책 ③] 로그인 성공 시 명시적 로그아웃 상태 해제 + 계정 힌트 영구 보존
    localStorage.removeItem("zen_explicit_logout");
    if (fbUser.email) localStorage.setItem("zen_user_hint", fbUser.email);
    console.log("🔑 [Firebase Auth] 로그인 상태:", fbUser.email);
    checkAuthState();
    smartSync();
  } else {
    console.log("🔒 [Firebase Auth] 로그아웃 상태");
    checkAuthState();
  }
}

// ============================================================================
// 2. 구름 아이콘 상태 표시 및 로그인/로그아웃
// ============================================================================
function checkAuthState() {
  const isOnline = window.isZenOnline();
  const authBtn = document.getElementById("btn-auth");
  const authBtnIcon = authBtn ? authBtn.querySelector("i") : null;
  const savedHint = localStorage.getItem("zen_user_hint");
  const isExplicitLogout = localStorage.getItem("zen_explicit_logout") === "true";

  if (authBtn) {
    if (isOnline) {
      authBtn.classList.add("is-logged-in");
      authBtn.classList.remove("is-logged-out");
      authBtn.setAttribute("title", savedHint ? `클라우드 연결됨 (${savedHint})` : "클라우드 연결됨 (클릭 시 로그아웃)");
      if (authBtnIcon) {
        authBtnIcon.className = "fa-solid fa-cloud";
        authBtnIcon.style.color = "var(--accent)";
      }
    } else {
      authBtn.classList.remove("is-logged-in");
      authBtn.classList.add("is-logged-out");
      if (fbUser && !navigator.onLine) {
        authBtn.setAttribute("title", "오프라인 (인터넷 연결 시 자동 동기화)");
      } else if (isExplicitLogout) {
        authBtn.setAttribute("title", "오프라인 (클릭 시 구글 로그인 및 계정 선택)");
      } else if (savedHint) {
        authBtn.setAttribute("title", `오프라인 (클릭 시 ${savedHint} 계정으로 연결)`);
      } else {
        authBtn.setAttribute("title", "오프라인 (클릭 시 구글 로그인)");
      }
      if (authBtnIcon) {
        authBtnIcon.className = "fa-solid fa-cloud";
        authBtnIcon.style.color = "var(--text-muted)";
      }
    }
  }

  window.ZEN_IS_ONLINE = isOnline;

  if (isOnline) {
    if (typeof updateUnsyncedCount === "function") updateUnsyncedCount();
    else updateUIState("online-idle");
  } else {
    updateUIState("offline-idle");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  checkAuthState();
});

// 🎯 구름 버튼 토글 (로그인 상태면 로그아웃 확인, 로그아웃 상태면 구글 로그인)
document.getElementById("btn-auth").addEventListener("click", async () => {
  if (!fbAuth) {
    showToast("클라우드 서비스를 불러오지 못했습니다.\n인터넷 연결 후 새로고침해 주세요.");
    return;
  }
  closeAllPanelsMobile();

  // 1. 로그인 상태 → 명시적 로그아웃 (정책 ①)
  if (fbUser) {
    const confirmLogout = confirm("클라우드 연동을 로그아웃하시겠습니까?\n로그아웃하면 자동 연동이 해제되고 다음 로그인 시 계정 선택창이 나타납니다.");
    if (!confirmLogout) return;

    localStorage.setItem("zen_explicit_logout", "true");
    localStorage.removeItem("zen_user_hint");
    try {
      await fbAuth.signOut();
      showToast("클라우드 연동이 해제되었습니다.");
    } catch (e) {
      console.error("❌ 로그아웃 실패:", e);
    }
    return;
  }

  if (!navigator.onLine) {
    showToast("인터넷에 연결되어 있지 않습니다.");
    return;
  }

  // 2. 로그아웃 상태 → 로그인 (정책 ① vs ②)
  // ⚠️ 팝업 차단 방지: 사용자 클릭 직후 await 없이 바로 signInWithPopup 호출
  const isExplicitLogout = localStorage.getItem("zen_explicit_logout") === "true";
  const savedHint = localStorage.getItem("zen_user_hint");
  const provider = new firebase.auth.GoogleAuthProvider();

  if (isExplicitLogout || !savedHint) {
    // ① 명시적 로그아웃 후 또는 최초 로그인 → 계정 선택창 표출
    provider.setCustomParameters({ prompt: "select_account" });
  } else {
    // ② 로그아웃한 적 없이 세션만 끊긴 경우 → 계정 선택창 없이 기존 계정으로 연결
    provider.setCustomParameters({ login_hint: savedHint });
  }

  try {
    await fbAuth.signInWithPopup(provider);
    showToast("클라우드에 성공적으로 연결되었습니다!");
    const icon = document.querySelector("#btn-auth i");
    if (icon) {
      icon.classList.add("blink-active");
      setTimeout(() => icon.classList.remove("blink-active"), 1500);
    }
  } catch (e) {
    const code = e && e.code ? e.code : "";
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
    if (code === "auth/popup-blocked") {
      showToast("팝업이 차단되었습니다.\n브라우저에서 팝업을 허용해 주세요.");
    } else if (code === "auth/unauthorized-domain") {
      showToast("승인되지 않은 도메인입니다.\nFirebase 콘솔의 승인된 도메인을 확인해 주세요.");
    } else if (code === "auth/network-request-failed") {
      showToast("네트워크 오류로 로그인하지 못했습니다.");
    } else {
      showToast("로그인에 실패했습니다.");
    }
    console.error("❌ [Firebase Auth] 로그인 실패:", e);
  }
});

// 🌐 네트워크 복구/단절 및 화면 복귀 시 상태 갱신·동기화
window.addEventListener("online", () => {
  checkAuthState();
  triggerBackgroundSync();
});
window.addEventListener("offline", () => {
  checkAuthState();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && window.isZenOnline()) triggerBackgroundSync();
});

// ============================================================================
// 3. 동기화 총괄 매니저 (Pull → Push → 툼스톤 청소)
// ============================================================================
async function smartSync() {
  if (!window.isZenOnline()) {
    checkAuthState();
    return;
  }
  if (isSyncRunning) {
    isSyncQueued = true; // 진행 중이면 끝난 뒤 한 번 더 실행
    return;
  }

  isSyncRunning = true;
  try {
    if (!(await waitForAppReady())) return;

    const uid = fbUser.uid;
    const syncStart = Date.now();
    updateUIState("syncing");
    console.log(">>> [Firestore] 클라우드 동기화 시작...");

    // 1) 클라우드 → 기기 (먼저 받아야 다른 기기의 영구삭제 꼬리표로 좀비 업로드를 막을 수 있음)
    const pulledChanged = await fsPull();

    // 2) 기기 → 클라우드
    const pushResult = await fsPush(syncStart);

    // 3) 30일 지난 영구삭제 꼬리표 청소 (하루 1회)
    await fsPurgeOldTombstones();

    if (pushResult.failed > 0) {
      throw new Error(`업로드 실패 ${pushResult.failed}건 (다음 동기화 때 재시도)`);
    }

    if (fbUser && fbUser.uid === uid) {
      localStorage.setItem("zen_last_sync_time", String(syncStart));
    }
    console.log("✅ [Firestore] 동기화 완료!");
    updateUnsyncedCount();
    updateUIState("synced");

    if (pulledChanged || pushResult.localChanged) refreshAfterSync();
  } catch (err) {
    console.error("❌ [Firestore] 동기화 실패:", err);
    updateUIState("sync-error");
  } finally {
    isSyncRunning = false;
    if (isSyncQueued) {
      isSyncQueued = false;
      setTimeout(smartSync, 500);
    }
  }
}

// 앱(IndexedDB + 4대장 폴더) 준비가 끝날 때까지 대기
async function waitForAppReady(maxMs = 15000) {
  const t0 = Date.now();
  while (!db || globalDesktopFolderId === null) {
    if (Date.now() - t0 > maxMs) return false;
    await new Promise((r) => setTimeout(r, 300));
  }
  return true;
}

// 동기화로 로컬이 바뀌었을 때 화면 갱신
function refreshAfterSync() {
  const checkTx = db.transaction(["memos"], "readonly");
  checkTx.objectStore("memos").get(currentMemoId || -1).onsuccess = (ev) => {
    const currentOpen = ev.target.result;
    if (currentMemoId && (!currentOpen || currentOpen.isDeleted || currentOpen.isPermanentlyDeleted)) {
      console.log("🚨 현재 편집 중인 노트가 다른 기기에서 삭제되었습니다. 화면을 초기화합니다.");
      if (typeof openTopDesktopMemo === "function") openTopDesktopMemo();
    }
    healDatabase(() => {
      loadMemoList();
      if (document.getElementById("file-manager-pane").style.display === "flex") {
        loadFileManager(currentFmFolderId);
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Firestore / IndexedDB 헬퍼
// ---------------------------------------------------------------------------
function fsItemsCol() {
  return fbStore.collection("users").doc(fbUser.uid).collection("items");
}

function fsKey(name) {
  return `zen_fs_${name}_${fbUser.uid}`;
}

function idbGetAll() {
  return new Promise((resolve, reject) => {
    const req = db.transaction(["memos"], "readonly").objectStore("memos").getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror = () => reject(req.error);
  });
}

function idbPutMany(records) {
  return new Promise((resolve, reject) => {
    if (!records.length) return resolve();
    const tx = db.transaction(["memos"], "readwrite");
    const store = tx.objectStore("memos");
    records.forEach((r) => store.put(r));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDeleteMany(ids) {
  return new Promise((resolve, reject) => {
    if (!ids.length) return resolve();
    const tx = db.transaction(["memos"], "readwrite");
    const store = tx.objectStore("memos");
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// UTF-8 바이트 길이 계산 (Firestore 크기 한도는 UTF-8 기준)
function utf8Len(str) {
  let n = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) { n += 4; i++; }
    else n += 3;
  }
  return n;
}

// 문자열을 UTF-8 기준 maxBytes 이하 조각으로 분할 (서로게이트 쌍은 쪼개지 않음)
function splitByBytes(str, maxBytes) {
  const out = [];
  let start = 0, bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    let w, step = 1;
    if (c < 0x80) w = 1;
    else if (c < 0x800) w = 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) { w = 4; step = 2; }
    else w = 3;

    if (bytes + w > maxBytes) {
      out.push(str.slice(start, i));
      start = i;
      bytes = 0;
    }
    bytes += w;
    i += step - 1;
  }
  out.push(str.slice(start));
  return out;
}

// ============================================================================
// 4. Pull: 클라우드 → 기기 (serverUpdatedAt 커서 기반 델타)
// ============================================================================
// 기기마다 시계가 다를 수 있으므로 "무엇이 새로 올라왔는가"는 서버 시각(serverUpdatedAt)으로 판단하고,
// "누가 더 최신인가"는 기존과 동일하게 updatedAt(최종 수정 시각)으로 판단합니다.
async function fsPull() {
  const cursorKey = fsKey("pull");
  const cursor = parseInt(localStorage.getItem(cursorKey) || "0", 10);
  let changed = false;
  let maxOk = cursor;
  let minFailed = Infinity;
  let lastDoc = null;

  while (true) {
    let q = fsItemsCol()
      .where("serverUpdatedAt", ">", firebase.firestore.Timestamp.fromMillis(cursor))
      .orderBy("serverUpdatedAt")
      .limit(FS_PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const r = await fsApplyPulledDocs(snap.docs);
    if (r.changed) changed = true;
    maxOk = Math.max(maxOk, r.maxOk);
    minFailed = Math.min(minFailed, r.minFailed);

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < FS_PAGE_SIZE) break;
  }

  // 다운로드에 실패한 문서가 있으면 그 직전까지만 커서를 전진시켜 다음 번에 재시도
  let newCursor = maxOk;
  if (minFailed !== Infinity) newCursor = Math.min(newCursor, minFailed - 1);
  if (newCursor > cursor) localStorage.setItem(cursorKey, String(newCursor));

  if (changed) console.log("⬇️ [Firestore] 클라우드 변경분을 기기에 반영했습니다.");
  return changed;
}

async function fsApplyPulledDocs(docs) {
  const localAll = await idbGetAll();
  const bySync = new Map();
  localAll.forEach((m) => { if (m.syncId) bySync.set(m.syncId, m); });

  const toPut = [];
  const toDelete = [];
  let maxOk = 0;
  let minFailed = Infinity;

  for (const d of docs) {
    const c = d.data();
    const ts = c.serverUpdatedAt && c.serverUpdatedAt.toMillis ? c.serverUpdatedAt.toMillis() : 0;
    const syncId = c.syncId || d.id;
    const local = bySync.get(syncId);

    // 🪦 영구삭제 꼬리표 → 내 기기에서도 물리 삭제
    if (c.isPermanentlyDeleted) {
      if (local) toDelete.push(local.id);
      maxOk = Math.max(maxOk, ts);
      continue;
    }

    // 내 기기 쪽이 같거나 더 최신이면 건너뜀 (내가 올린 것의 메아리 포함)
    if (local && !(Number(c.updatedAt || 0) > Number(local.updatedAt || 0))) {
      maxOk = Math.max(maxOk, ts);
      continue;
    }

    const rec = { ...c };
    delete rec.serverUpdatedAt;
    delete rec.chunkCount;
    delete rec.rev;
    delete rec.content;
    delete rec.plainText;
    rec.syncId = syncId;

    if (c.type !== "folder") {
      try {
        const body = await fsReadBody(d.ref, c);
        rec.content = body.content;
        rec.plainText = body.plainText;
      } catch (err) {
        // 다른 기기가 분할 업로드 중이거나 조각 일부 누락 → 빈 껍데기 덮어쓰기 방지, 다음 번 재시도
        console.warn(`⚠️ 본문 다운로드 보류 (${syncId}):`, err.message);
        minFailed = Math.min(minFailed, ts);
        continue;
      }
    }

    // 로컬 PK 및 부모 폴더 연결 (parentSyncId → 내 기기의 로컬 id)
    if (local) rec.id = local.id; else delete rec.id;
    if (rec.parentSyncId === null || rec.parentSyncId === undefined) {
      rec.parentId = null;
    } else {
      const p = bySync.get(rec.parentSyncId);
      rec.parentId = p ? p.id : -1; // 부모가 아직 없으면 2차 연결 대상
    }

    toPut.push(rec);
    maxOk = Math.max(maxOk, ts);
  }

  await idbPutMany(toPut);
  await idbDeleteMany(toDelete);

  // 2차 연결: 같은 묶음에서 새로 생긴 부모 폴더에 자식 연결 (못 찾으면 healDatabase가 바탕 화면으로 착륙)
  const orphans = toPut.filter((r) => r.parentId === -1);
  if (orphans.length) {
    const all = await idbGetAll();
    const map = new Map();
    all.forEach((m) => { if (m.syncId) map.set(m.syncId, m); });
    const fixes = [];
    orphans.forEach((r) => {
      const self = map.get(r.syncId);
      const p = map.get(r.parentSyncId);
      if (self && p) {
        self.parentId = p.id;
        fixes.push(self);
      }
    });
    await idbPutMany(fixes);
  }

  return { changed: toPut.length > 0 || toDelete.length > 0, maxOk, minFailed };
}

// 본문 읽기 (분할 저장된 경우 조각을 모아 복원)
async function fsReadBody(ref, c) {
  if (!c.chunkCount) {
    return { content: c.content || "", plainText: c.plainText || "" };
  }
  const snap = await ref.collection("chunks").get();
  const parts = [];
  snap.forEach((ch) => {
    const x = ch.data();
    if (x.rev === c.rev && typeof x.i === "number") parts[x.i] = x.data;
  });
  for (let i = 0; i < c.chunkCount; i++) {
    if (typeof parts[i] !== "string") throw new Error(`분할 조각 ${i + 1}/${c.chunkCount} 누락`);
  }
  const body = JSON.parse(parts.join(""));
  return { content: body.content || "", plainText: body.plainText || "" };
}

// ============================================================================
// 5. Push: 기기 → 클라우드
// ============================================================================
async function fsPush(syncStart) {
  const pushKey = fsKey("push");
  const pushCursor = parseInt(localStorage.getItem(pushKey) || "0", 10); // 0이면 최초 → 전체 업로드
  const localAll = await idbGetAll();

  // syncId 없는 레코드 보정
  const patched = localAll.filter((m) => !m.syncId);
  patched.forEach((m) => { m.syncId = generateSyncId(); });
  await idbPutMany(patched);
  const patchedSet = new Set(patched.map((m) => m.id));

  const byId = new Map(localAll.map((m) => [String(m.id), m]));
  const targets = localAll.filter(
    (m) => m.isPermanentlyDeleted || patchedSet.has(m.id) || Number(m.updatedAt || 0) > pushCursor
  );

  if (targets.length) console.log(`⬆️ [Firestore] 업로드 검사 대상 ${targets.length}개`);

  let failed = 0;
  const localDeleteIds = [];

  for (const m of targets) {
    try {
      const result = await fsPushItem(m, byId);
      // 🎯 [V3.4.4 원칙 유지] 클라우드에 꼬리표가 기록된 뒤에만 로컬에서 물리 삭제 (좀비 부활 차단)
      if (result === "tombstone") localDeleteIds.push(m.id);
    } catch (err) {
      failed++;
      console.warn(`⚠️ 업로드 실패 (${m.syncId}):`, err);
    }
  }

  await idbDeleteMany(localDeleteIds);

  if (failed === 0 && fbUser) localStorage.setItem(pushKey, String(syncStart));
  return { failed, localChanged: localDeleteIds.length > 0 };
}

async function fsPushItem(m, byId) {
  const ref = fsItemsCol().doc(m.syncId);
  const oldSnap = await ref.get();
  const old = oldSnap.exists ? oldSnap.data() : null;
  const oldChunks = old && old.chunkCount ? old.chunkCount : 0;
  const serverTs = firebase.firestore.FieldValue.serverTimestamp();

  // 🪦 영구 삭제 → 꼬리표(Tombstone) 기록 + 조각 삭제
  if (m.isPermanentlyDeleted) {
    if (!(old && old.isPermanentlyDeleted)) {
      await ref.set({
        syncId: m.syncId,
        isPermanentlyDeleted: true,
        updatedAt: Date.now(),
        chunkCount: 0,
        serverUpdatedAt: serverTs,
      });
    }
    await fsDeleteChunks(ref, 0, oldChunks);
    return "tombstone";
  }

  if (old) {
    if (old.isPermanentlyDeleted) return "skip"; // 다른 기기에서 영구 삭제됨 → 다음 Pull에서 로컬 정리
    if (Number(old.updatedAt || 0) >= Number(m.updatedAt || 0)) return "skip"; // 클라우드가 같거나 최신
  }

  // 부모 폴더의 글로벌 주민번호(syncId) 통역
  let pSyncId = null;
  if (m.parentId !== null && m.parentId !== undefined) {
    const p = byId.get(String(m.parentId));
    pSyncId = p ? p.syncId : (m.parentSyncId ?? null);
  }

  const meta = { ...m };
  delete meta.id;       // 로컬 PK는 기기마다 다르므로 올리지 않음
  delete meta.parentId; // 부모는 parentSyncId로만 전달
  delete meta.content;
  delete meta.plainText;
  meta.parentSyncId = pSyncId;
  const docData = JSON.parse(JSON.stringify(meta)); // undefined 필드 제거 (Firestore 저장 불가)

  let newChunks = 0;
  if (m.type !== "folder") {
    const content = m.content || "";
    const plainText = m.plainText || "";

    if (utf8Len(content) + utf8Len(plainText) <= FS_INLINE_MAX_BYTES) {
      docData.content = content;
      docData.plainText = plainText;
    } else {
      // 📦 대용량 노트 분할 저장: 조각을 먼저 모두 올린 뒤 메인 문서를 갱신
      // (rev가 일치하는 조각만 유효 → 업로드 도중 다른 기기가 읽어도 깨진 본문을 받지 않음)
      const rev = generateSyncId();
      const parts = splitByBytes(JSON.stringify({ content, plainText }), FS_CHUNK_BYTES);
      for (let i = 0; i < parts.length; i++) {
        await ref.collection("chunks").doc(String(i)).set({ i, rev, data: parts[i] });
      }
      newChunks = parts.length;
      docData.rev = rev;
      console.log(`📦 대용량 노트 분할 업로드: ${m.title || m.syncId} (${parts.length}조각)`);
    }
  }

  docData.chunkCount = newChunks;
  docData.serverUpdatedAt = serverTs;
  await ref.set(docData);

  // 이전보다 조각 수가 줄었으면 남은 옛 조각 삭제
  await fsDeleteChunks(ref, newChunks, oldChunks);
  return "uploaded";
}

async function fsDeleteChunks(ref, from, to) {
  for (let i = from; i < to; i++) {
    await ref.collection("chunks").doc(String(i)).delete();
  }
}

// 30일 지난 영구삭제 꼬리표 청소 (하루 1회)
async function fsPurgeOldTombstones() {
  const key = fsKey("purge");
  const last = parseInt(localStorage.getItem(key) || "0", 10);
  const now = Date.now();
  if (now - last < 24 * 60 * 60 * 1000) return;

  try {
    const snap = await fsItemsCol().where("isPermanentlyDeleted", "==", true).get();
    let count = 0;
    for (const d of snap.docs) {
      if (now - Number(d.data().updatedAt || 0) > FS_TOMBSTONE_TTL) {
        await d.ref.delete();
        count++;
      }
    }
    if (count) console.log(`🧹 [Firestore] 30일 지난 영구삭제 꼬리표 ${count}개 청소`);
    localStorage.setItem(key, String(now));
  } catch (e) {
    console.warn("꼬리표 청소 실패 (다음에 재시도):", e);
  }
}

// ============================================================================
// 6. 타자 멈춤 3초 감지 및 백그라운드 동기화 트리거
// ============================================================================
function triggerBackgroundSync() {
  if (backgroundSyncTimer) clearTimeout(backgroundSyncTimer);
  backgroundSyncTimer = setTimeout(() => {
    if (window.isZenOnline()) {
      console.log("🤫 [Firestore] 타자 멈춤(3초) 감지: 조용히 동기화를 시작합니다...");
      smartSync();
    }
  }, 3000);
}

// ============================================================================
// 7. 초기화용: 내 Firestore 데이터 전체 삭제
// ============================================================================
async function deleteAllCloudData() {
  if (!window.isZenOnline()) return false;
  const col = fsItemsCol();
  while (true) {
    const snap = await col.limit(100).get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      const c = d.data();
      if (c.chunkCount || c.rev) {
        const chunks = await d.ref.collection("chunks").get();
        for (const ch of chunks.docs) await ch.ref.delete();
      }
      await d.ref.delete();
    }
  }
  console.log("✅ [Firestore] 클라우드 데이터 삭제 완료");
  return true;
}

// 초기화 시 동기화 커서(zen_fs_*) 제거 → 다음 로그인 때 클라우드 전체를 다시 받음
function clearFirestoreSyncCursors() {
  Object.keys(localStorage)
    .filter((k) => k.startsWith("zen_fs_"))
    .forEach((k) => localStorage.removeItem(k));
}

// ============================================================================
// 8. 공식 온라인 판정 창구 (Single Source of Truth)
// ============================================================================
// 다른 파일(ui.js 등)에서 window.isZenOnline()으로 현재 클라우드 연결 상태를 확인합니다.
window.isZenOnline = function () {
  return Boolean(fbAuth && fbUser) && navigator.onLine !== false;
};

initFirebase();