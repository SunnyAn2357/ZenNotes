function gapiLoaded() {
  gapi.load('client', async () => {
    try {
      await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
      gapiInited = true;
      console.log("✅ 구글 API 준비 완료!");
      onAuthAPIsReady();
    } catch (e) {
      console.error("❌ GAPI 초기화 실패:", e);
    }
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    // 🎯 매번 무작위 암호를 생성하여 위조된 응답(CSRF)을 방어합니다.
    state: Math.random().toString(36).substring(2),
    callback: ''
  });
  gisInited = true;
  console.log("✅ 구글 인증 준비 완료!");
  onAuthAPIsReady();
}

// 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩
// 🚀 [상시 로그인 유지 시스템] 영속성 저장, 복원, 무음 갱신(Silent Refresh)
// 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩

// 🎯 1. 세션 보관 (localStorage 영속화)
function saveAuthSession(resp, userEmail = null) {
  if (!resp || !resp.access_token) return;

  const expiresInSec = resp.expires_in ? parseInt(resp.expires_in, 10) : 3540;
  // 안전마진 60초 확보하여 만료 시각 계산
  tokenExpiryTime = Date.now() + (expiresInSec * 1000);

  localStorage.setItem("zen_oauth_token", resp.access_token);
  localStorage.setItem("zen_token_expiry", tokenExpiryTime.toString());
  localStorage.setItem("zen_auto_login", "true");
  if (userEmail) {
    localStorage.setItem("zen_user_hint", userEmail);
  }

  scheduleTokenRefresh();
}

// 🎯 2. 완전 로그아웃
function clearAuthSession() {
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  tokenExpiryTime = 0;

  if (gapiInited && window.gapi && gapi.client) {
    const curToken = gapi.client.getToken();
    if (curToken && curToken.access_token && window.google?.accounts?.oauth2?.revoke) {
      try {
        google.accounts.oauth2.revoke(curToken.access_token, () => {});
      } catch (e) {}
    }
    gapi.client.setToken(null);
  }

  localStorage.removeItem("zen_oauth_token");
  localStorage.removeItem("zen_token_expiry");
  localStorage.removeItem("zen_auto_login");
  localStorage.removeItem("zen_user_hint");

  checkAuthState();
  console.log("🔒 [Google Auth] 안전하게 로그아웃되었습니다.");
}

let isRefreshing = false;
let refreshPromise = null;

// 🎯 3. 백그라운드 무음 갱신 (Silent Refresh - 팝업/알림 없이 조용히 토큰 갱신)
async function silentRefreshToken() {
  if (!gisInited || !tokenClient) return false;
  if (isRefreshing && refreshPromise) return refreshPromise;

  isRefreshing = true;
  refreshPromise = new Promise((resolve) => {
    const hint = localStorage.getItem("zen_user_hint") || "";
    const requestConfig = {
      prompt: "", // 🚀 핵심: 프롬프트 없이 무음 인가 요청
    };
    if (hint) {
      requestConfig.hint = hint; // 🚀 특정 계정을 지정하여 계정 선택 팝업 방지
    }

    const prevCallback = tokenClient.callback;

    tokenClient.callback = async (resp) => {
      isRefreshing = false;
      refreshPromise = null;
      tokenClient.callback = prevCallback;

      if (resp && !resp.error && resp.access_token) {
        console.log("🔄 [Google Auth] 백그라운드 무음 토큰 갱신 성공! (상시 로그인 유지)");
        gapi.client.setToken(resp);

        let userEmail = localStorage.getItem("zen_user_hint");
        if (!userEmail) {
          userEmail = await fetchUserEmail(resp.access_token);
        }
        saveAuthSession(resp, userEmail);
        checkAuthState();
        resolve(true);
      } else {
        console.warn("⚠️ 백그라운드 무음 갱신 미완료:", resp?.error);
        resolve(false);
      }
    };

    try {
      tokenClient.requestAccessToken(requestConfig);
    } catch (e) {
      console.warn("❌ silentRefreshToken 실행 오류:", e);
      isRefreshing = false;
      refreshPromise = null;
      tokenClient.callback = prevCallback;
      resolve(false);
    }
  });

  return refreshPromise;
}

// 🎯 4. 만료 5분 전 자동 갱신 스케줄러
function scheduleTokenRefresh() {
  if (tokenRefreshTimer) clearTimeout(tokenRefreshTimer);

  const now = Date.now();
  const leadTime = 5 * 60 * 1000; // 만료 5분 전
  const delay = Math.max(10000, (tokenExpiryTime - now) - leadTime);

  tokenRefreshTimer = setTimeout(async () => {
    console.log("⏰ 토큰 만료 5분 전 감지: 백그라운드 무음 갱신을 실행합니다...");
    const ok = await silentRefreshToken();
    if (!ok) {
      console.log("ℹ️ 백그라운드 갱신 대기 (동기화 트리거 시 재시도 예정)");
    }
  }, delay);
}

// 🎯 5. 유저 이메일 획득 (무음 갱신 시 hint로 사용하여 팝업 차단)
async function fetchUserEmail(accessToken) {
  try {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      return data.email || null;
    }
  } catch (e) {
    // 무시
  }
  return null;
}

// 🎯 6. 앱 초기화 시 토큰 복원 또는 자동 로그인
async function onAuthAPIsReady() {
  if (!gapiInited || !gisInited) return;

  const savedToken = localStorage.getItem("zen_oauth_token");
  const savedExpiry = parseInt(localStorage.getItem("zen_token_expiry") || "0", 10);
  const autoLogin = localStorage.getItem("zen_auto_login") === "true";
  const now = Date.now();

  // Case A: 로컬스토리지에 유효한 토큰이 남아있는 경우 (새로고침/재접속 시 즉시 연결!)
  if (savedToken && savedExpiry > (now + 60 * 1000)) {
    console.log("🔑 [Google Auth] 저장된 토큰 복원 완료! 즉시 클라우드 온라인 활성화");
    gapi.client.setToken({ access_token: savedToken });
    tokenExpiryTime = savedExpiry;
    checkAuthState();
    scheduleTokenRefresh();
    setTimeout(() => { smartSync(); }, 1500);
    return;
  }

  // Case B: 토큰이 만료되었지만 이전에 로그인했던 이력이 있는 경우 -> 백그라운드 무음 갱신
  if (autoLogin) {
    console.log("🔄 [Google Auth] 자동 로그인 감지: 백그라운드 무음 토큰 발급 시도...");
    const success = await silentRefreshToken();
    if (success) {
      setTimeout(() => { smartSync(); }, 1500);
    } else {
      checkAuthState();
    }
  } else {
    checkAuthState();
  }
}

function checkAuthState() {
  const hasToken = window.isZenOnline();

  const authBtnIcon = document.querySelector("#btn-auth i");
  if (authBtnIcon) authBtnIcon.style.color = hasToken ? "var(--accent)" : "";

  window.ZEN_IS_ONLINE = hasToken;

  if (hasToken) {
    if (typeof updateUnsyncedCount === 'function') updateUnsyncedCount();
    else updateUIState("online-idle");
  } else {
    updateUIState("offline-idle");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  checkAuthState();
});

// 🎯 구름 아이콘 클릭 시 (수동 동기화 또는 신규 로그인)
document.getElementById("btn-auth").addEventListener("click", () => {
  if (!gapiInited || !gisInited) {
    alert("구글 서비스 준비 중입니다. 잠시 후 다시 시도해주세요.");
    return;
  }
  closeAllPanelsMobile();

  // 토큰이 유효한 상태라면 즉시 스마트 동기화
  if (gapi.client.getToken() !== null && Date.now() < tokenExpiryTime) {
    smartSync();
    return;
  }

  // 사용자가 직접 클릭한 시점이므로 팝업 로그인 허용
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      console.warn(">>> 동기화 취소 또는 에러", resp.error);
      return;
    }

    let userEmail = localStorage.getItem("zen_user_hint");
    if (!userEmail) {
      userEmail = await fetchUserEmail(resp.access_token);
    }
    saveAuthSession(resp, userEmail);

    checkAuthState();

    // 아이콘 깜빡임 효과
    const icon = document.querySelector("#btn-auth i");
    if (icon) {
      icon.classList.add("blink-active");
      setTimeout(() => icon.classList.remove("blink-active"), 1500);
    }

    await checkAndMigrateV3();
  };

  tokenClient.requestAccessToken();
});

// 🎯 구름 아이콘 우클릭 시 명시적 로그아웃 지원
document.getElementById("btn-auth").addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const isOnline = window.isZenOnline();
  const autoLogin = localStorage.getItem("zen_auto_login") === "true";

  if (!isOnline && !autoLogin) {
    alert("현재 구글 연동이 되어 있지 않습니다.");
    return;
  }

  const confirmLogout = confirm("구글 드라이브 연동을 로그아웃하시겠습니까?\n로그아웃하면 자동 로그인이 해제됩니다.");
  if (confirmLogout) {
    clearAuthSession();
    alert("구글 드라이브 연동이 해제되었습니다.");
  }
});

// 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩
// 🚀 [ZenNotes V3] CLOUD SYNC ENGINE (구글 드라이브 증분 동기화 코어)
// 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩

// 1. smartSync()                     : V3 동기화 메인 총괄 매니저 (비교, 다운, 업로드)
// 2. v3_uploadFile(...)              : 구글 API 파일 전송 헬퍼
// 3. ensureValidToken()              : 59분 토큰 만료 검문소 (오프라인 전환)
// 4. triggerBackgroundSync()         : 타자 멈춤 3초 감지 및 백그라운드 동기화 트리거
// 5. checkAndMigrateV3()             : 구형 V2 유저 확인 및 마이그레이션 안내

// ============================================================================
// 🚀 [ZenNotes V3] 1. V3 동기화 메인 총괄 매니저 (비교, 다운, 업로드, 삭제)
// ============================================================================

async function smartSync() {
  const isValid = await ensureValidToken();
  if (!isValid) return;
  if (!db) return;

  updateUIState("syncing");
  console.log(">>> [V3 엔진] 클라우드 동기화 시작...");

  try {
    const token = gapi.client.getToken().access_token;

    // 1. V3 폴더 확보
    const folderRes = await gapi.client.drive.files.list({
      q: "name = 'ZenNotes_Sync_Data' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id)"
    });

    let folderId;
    if (!folderRes.result.files || folderRes.result.files.length === 0) {
      console.log("🌱 V3 폴더가 존재하지 않아 새로 생성합니다.");
      const metadata = { name: 'ZenNotes_Sync_Data', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] };
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });
      const createdFolder = await createRes.json();
      folderId = createdFolder.id;
    } else {
      folderId = folderRes.result.files[0].id;
    }

    // 2. 구글 드라이브 파일 전체 스캔 및 중복 파일 청소 (지도 생성)
    const allFilesRes = await gapi.client.drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, modifiedTime)",
      pageSize: 1000
    });

    const driveFiles = allFilesRes.result.files || [];
    const cloudFileMap = new Map();

    // 🚀 [핵심 1] 최신 파일이 배열 앞에 오도록 정렬하여 중복 방어
    driveFiles.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));

    for (const f of driveFiles) {
      if (!cloudFileMap.has(f.name)) {
        // 처음 본 이름(최신 파일)만 지도에 등록
        cloudFileMap.set(f.name, f.id);
      } else {
        // 이미 지도에 이름이 있다면 구글의 랙으로 생긴 과거의 쓰레기(중복) 파일!
        console.log(`🗑️ 중복 쓰레기 파일 발견 및 구글 서버에서 삭제: ${f.name}`);
        try {
          await gapi.client.drive.files.delete({ fileId: f.id });
        } catch (e) {
          console.warn("중복 파일 삭제 실패:", e);
        }
      }
    }

    // 3. index.json(명부) 다운로드
    let cloudIndex = [];
    const indexFileId = cloudFileMap.get('index.json');
    if (indexFileId) {
      const indexFile = await gapi.client.drive.files.get({ fileId: indexFileId, alt: "media" });
      cloudIndex = typeof indexFile.result === 'string' ? JSON.parse(indexFile.result) : indexFile.result;
    }

    // 4. 로컬 DB 읽기 및 싱크 ID 보정
    const localData = await new Promise((resolve) => {
      db.transaction(["memos"], "readonly").objectStore("memos").getAll().onsuccess = (e) => resolve(e.target.result);
    });

    const localMap = new Map();
    const itemsToPatch = [];
    localData.forEach(m => {
      if (!m.syncId) {
        m.syncId = generateSyncId(); // 🚀 무조건 고유 난수 발급으로 변경!
        itemsToPatch.push(m);
      }
      localMap.set(m.syncId, m);
    });

    if (itemsToPatch.length > 0) {
      const patchTx = db.transaction(["memos"], "readwrite");
      itemsToPatch.forEach(m => patchTx.objectStore("memos").put(m));
    }

    // 5. 비교 분석 (다운로드/업로드/삭제 분류)
    const toDownload = [];
    const toUpload = [];
    const toCloudDelete = [];
    let needIndexPatch = false; // 명부 강제 덮어쓰기 깃발
    let needUIUpdate = false;   // 화면 새로고침 깃발을 친구들 옆으로 모아둠!
    const toLocalDelete = [];   // 사망진단서를 보고 내 기기에서 치울 명단

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const originalLength = cloudIndex.length;

    // [30일 청소기] 명부를 훑으면서 30일 지난 진단서는 파쇄(제외)합니다.
    cloudIndex = cloudIndex.filter(cMeta => {
      if (cMeta.isPermanentlyDeleted && (now - cMeta.updatedAt > THIRTY_DAYS)) {
        return false; // 30일 지났으면 파쇄! (배열에서 제거됨)
      }
      return true;
    });

    if (cloudIndex.length !== originalLength) needIndexPatch = true; // 청소했으면 덮어쓰기 예약

    // [클라우드 -> 로컬] 구글이 더 최신인 경우
    for (const cMeta of cloudIndex) {
      if (!cMeta.syncId) continue;
      const lMemo = localMap.get(cMeta.syncId);

      // 🚀 [신규: 시체 치우기] 구글 명부에 사망진단서가 붙어있다면?
      if (cMeta.isPermanentlyDeleted) {
        if (lMemo) {
          toLocalDelete.push(lMemo.id); // 내 기기의 시체를 사형 큐에 넣음 (사망진단서가 있으면 무조건 사형 집행!)
        }
        continue; // 진단서는 다운로드(toDownload) 안 함!
      }

      if (!lMemo || cMeta.updatedAt > lMemo.updatedAt) toDownload.push(cMeta);
    }

    // [로컬 -> 클라우드] 기기가 더 최신인 경우
    for (const lMemo of localData) {
      const cMeta = cloudIndex.find(c => c.syncId === lMemo.syncId);

      if (lMemo.isPermanentlyDeleted) {
        toCloudDelete.push(lMemo);
        continue;
      }

      // 🚀 [핵심 방어막] 파일은 안 바뀌었지만 구글 명부에 족보(parentSyncId)가 빠져있다면?
      if (cMeta && cMeta.parentSyncId === undefined && lMemo.parentId !== null) {
        // 🚀 [수정됨] String()으로 감싸서 타입 불일치 에러 완벽 차단!
        const pNode = localData.find(d => String(d.id) === String(lMemo.parentId));
        if (pNode) {
          cMeta.parentSyncId = pNode.syncId; // 명부에 몰래 족보를 적어줍니다.
          needIndexPatch = true; // 명부 강제 덮어쓰기 예약!
        }
      }

      if (!cMeta || lMemo.updatedAt > cMeta.updatedAt) {
        if ((lMemo.type === 'folder' || lMemo.isDeleted) && cMeta) {
          const cIdx = cloudIndex.findIndex(c => c.syncId === lMemo.syncId);

          let pSyncId = null;
          if (lMemo.parentId !== null) {
            // 🚀 [수정됨] 여기도 String() 방어막 적용!
            const pNode = localData.find(d => String(d.id) === String(lMemo.parentId));
            if (pNode) pSyncId = pNode.syncId;
          }

          const meta = { ...lMemo, parentSyncId: pSyncId };
          delete meta.content; delete meta.plainText;
          if (cIdx > -1) cloudIndex[cIdx] = meta;
          needIndexPatch = true; // 🚀 [추가]
          continue;
        }
        toUpload.push(lMemo);
      }
    }

    // 🚀 [신규: 시체 치우기 실행] 진단서 확인 후 로컬 기기 물리적 폭파!
    if (toLocalDelete.length > 0) {
      const delTx = db.transaction(["memos"], "readwrite");
      toLocalDelete.forEach(id => delTx.objectStore("memos").delete(id));
      needUIUpdate = true;
    }

    // 6. 다운로드 실행
    if (toDownload.length > 0) {
      console.log(`⬇️ 클라우드 -> 기기: ${toDownload.length}개 다운로드 중...`);
      const downloadedMemos = [];
      for (const cMeta of toDownload) {
        // 🚀 cMeta.isDeleted 제거! 휴지통에 있어도 본문은 무조건 다운받습니다!
        if (cMeta.type === 'folder' || cMeta.isPermanentlyDeleted) {
          downloadedMemos.push({ ...cMeta });
        } else {
          const bodyFileId = cloudFileMap.get(`memo_${cMeta.syncId}.json`);
          if (bodyFileId) {
            try {
              const bodyFile = await gapi.client.drive.files.get({ fileId: bodyFileId, alt: "media" });
              const bodyData = typeof bodyFile.result === 'string' ? JSON.parse(bodyFile.result) : bodyFile.result;
              // 🚀 껍데기만 덮어쓰는 걸 막기 위해 fallback(|| "") 안전장치 추가
              downloadedMemos.push({ ...cMeta, content: bodyData.content || "", plainText: bodyData.plainText || "" });
            } catch (err) {
              console.warn("본문 다운로드 실패. 빈 껍데기 덮어쓰기 방어!", err);
              continue; // 에러 시 건너뜀
            }
          }
        }
      }

      await new Promise((resolve) => {
        const tx = db.transaction(["memos"], "readwrite");
        const store = tx.objectStore("memos");
        downloadedMemos.forEach(m => {
          const existing = localMap.get(m.syncId);
          if (existing) m.id = existing.id; else delete m.id;
          store.put(m);
        });
        tx.oncomplete = () => resolve();
      });
      needUIUpdate = true;
    }

    // 🚀 [핵심 4] 클라우드 영구 삭제 실행 (DELETE)
    const locallyDeletedIds = [];
    if (toCloudDelete.length > 0) {
      for (const lMemo of toCloudDelete) {
        const fileName = `memo_${lMemo.syncId}.json`;
        const cloudId = cloudFileMap.get(fileName);

        try {
          // 1. 구글 서버에 물리적 삭제 요청
          if (cloudId) {
            await gapi.client.drive.files.delete({ fileId: cloudId });
          }

          // 🚀 [수정됨] 명부에서 파내지 않고 사망진단서를 덮어씁니다.
          const idx = cloudIndex.findIndex(c => c.syncId === lMemo.syncId);
          const tombstone = {
            syncId: lMemo.syncId,
            isPermanentlyDeleted: true, // 사망 판정
            updatedAt: Date.now()
          };

          if (idx > -1) cloudIndex[idx] = tombstone;
          else cloudIndex.push(tombstone);

          needIndexPatch = true; // 명부 덮어쓰기 예약!
          locallyDeletedIds.push(lMemo.id); // 🎯 [V3.4.3] 클라우드 명부 업로드 성공 후 지우도록 예약

        } catch (e) {
          console.warn("클라우드 삭제 실패 (로컬 파일은 보존됩니다):", e);
        }
      }
    }

    // 7. 업로드 실행 (글로벌 족보 시스템 적용 버전)

    if (toUpload.length > 0) {
      console.log(`⬆️ 기기 -> 클라우드: ${toUpload.length}개 업로드 중...`);
      for (const lMemo of toUpload) {

        // 🚀 [신규] 내 부모의 '글로벌 주민번호(syncId)'를 찾아내는 통역 과정
        let pSyncId = null;
        if (lMemo.parentId !== null) {
          // 🎯 [V3.4.3 교정] String() 방어막으로 타입 불일치 에러 완벽 차단!
          const pNode = localData.find(d => String(d.id) === String(lMemo.parentId));
          if (pNode) pSyncId = pNode.syncId;
        }

        if (lMemo.type !== 'folder') {
          const fileName = `memo_${lMemo.syncId}.json`;

          // 🚀 본문 파일 내용물에 parentSyncId를 추가하여 업로드
          const fileContent = JSON.stringify({
            syncId: lMemo.syncId,
            parentSyncId: pSyncId,
            content: lMemo.content || "",
            plainText: lMemo.plainText || ""
          });

          const existingId = cloudFileMap.get(fileName);
          await v3_uploadFile(token, fileName, fileContent, folderId, existingId);
        }

        // 명부(index.json) 업데이트 준비
        const cIdx = cloudIndex.findIndex(c => c.syncId === lMemo.syncId);

        // 🚀 명부 데이터에도 parentSyncId를 포함시켜서 나중에 검색/복원을 돕습니다.
        const meta = { ...lMemo, parentSyncId: pSyncId };
        delete meta.content;
        delete meta.plainText;

        if (cIdx > -1) cloudIndex[cIdx] = meta;
        else cloudIndex.push(meta);
      }
    }

    // 변경사항이 있었다면 최종 명부(index.json)도 PATCH로 덮어쓰기
    // 🚀 [교정] needIndexPatch 깃발이 올라갔을 때도 덮어쓰도록 추가!
    if (toUpload.length > 0 || toCloudDelete.length > 0 || needIndexPatch) {
      await v3_uploadFile(token, 'index.json', JSON.stringify(cloudIndex), folderId, indexFileId);

      // 🎯 [V3.4.3 핵심 교정] 클라우드 명부 업로드가 100% 성공한 뒤에만 로컬 DB에서 최종 영구 삭제 (좀비 부활 원천 차단!)
      if (locallyDeletedIds.length > 0) {
        const delTx = db.transaction(["memos"], "readwrite");
        locallyDeletedIds.forEach(id => delTx.objectStore("memos").delete(id));
      }
    }

    // 8. 마무리
    console.log("✅ [V3 엔진] 증분 동기화 완벽 종료!");
    localStorage.setItem("zen_last_sync_time", Date.now());
    updateUnsyncedCount();
    updateUIState("synced");

    if (needUIUpdate) {
      const checkTx = db.transaction(["memos"], "readonly");
      checkTx.objectStore("memos").get(currentMemoId || -1).onsuccess = (ev) => {
        const currentOpen = ev.target.result;
        if (!currentOpen || currentOpen.isDeleted || currentOpen.isPermanentlyDeleted) {
          console.log("🚨 현재 편집 중인 노트가 다른 기기에서 삭제되었습니다. 화면을 초기화합니다.");
          if (typeof openTopDesktopMemo === 'function') openTopDesktopMemo();
        }
        healDatabase(() => {
          loadMemoList();
          if (document.getElementById("file-manager-pane").style.display === "flex") {
            loadFileManager(currentFmFolderId);
          }
        });
      };
    }

  } catch (err) {
    console.error("❌ V3 동기화 실패:", err);
    updateUIState("sync-error");
  }
}

// ============================================================================
// 🚀 [ZenNotes V3] 2. 구글 API 파일 전송 헬퍼
// ============================================================================
async function v3_uploadFile(token, fileName, fileContent, folderId, existingFileId = null) {
  let fileId = existingFileId;

  if (!fileId) {
    const res = await gapi.client.drive.files.list({
      q: `name = '${fileName}' and '${folderId}' in parents and trashed = false`,
      fields: "files(id)"
    });
    if (res.result.files && res.result.files.length > 0) fileId = res.result.files[0].id;
  }

  if (fileId) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: fileContent
    });
  } else {
    const metadata = { name: fileName, mimeType: 'application/json', parents: [folderId] };
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;
    const body = delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(metadata) + delimiter + 'Content-Type: application/json\r\n\r\n' + fileContent + close_delim;

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: body
    });
  }
}

// ============================================================================
// 🚀 [ZenNotes V3] 3. 토큰 유효성 검문소 (만료 임박 시 무음 자동 연장)
// ============================================================================
async function ensureValidToken() {
  if (!gisInited || !tokenClient) return false;

  const currentTime = Date.now();

  // 토큰이 없거나 수명이 2분 미만으로 남았다면?
  if (gapi.client.getToken() === null || (tokenExpiryTime - currentTime) < 2 * 60 * 1000) {
    // 🌟 자동 로그인이 활성화되어 있다면 백그라운드 무음 갱신을 먼저 시도합니다!
    if (localStorage.getItem("zen_auto_login") === "true") {
      console.log("🔄 [동기화 검문소] 토큰 만료 임박 감지: 무음 갱신을 시도합니다...");
      const refreshed = await silentRefreshToken();
      if (refreshed) {
        return true; // 성공 시 동기화 계속 진행!
      }
    }

    // 무음 갱신마저 실패(오프라인 등)한 경우에만 조용히 일시 정지 (글쓰기 방해 팝업 차단)
    console.log("⚠️ 토큰 만료 및 무음 갱신 실패: 글쓰기 방해를 막기 위해 조용히 로컬 모드를 유지합니다.");
    checkAuthState();
    return false;
  }

  // 아직 유효하므로 동기화 통과!
  return true;
}

// ============================================================================
// 🚀 [ZenNotes V3] 4. 타자 멈춤 3초 감지 및 백그라운드 동기화 트리거
// ============================================================================
function triggerBackgroundSync() {
  // 이미 타이머가 돌고 있다면 취소 (타자를 계속 치고 있다는 뜻)
  if (backgroundSyncTimer) clearTimeout(backgroundSyncTimer);

  // 3초 뒤에 조용히 실행하도록 알람 설정
  backgroundSyncTimer = setTimeout(async () => {
    // 구글에 로그인되어 있고, 토큰(50분)이 살아있을 때만 조용히 실행
    if (gapiInited && gapi.client && gapi.client.getToken() !== null) {
      const isValid = await ensureValidToken();
      if (isValid) {
        console.log("🤫 [V3] 유저 타자 멈춤(3초) 감지: 조용히 동기화를 시작합니다...");
        smartSync();
      }
    }
  }, 3000); // 👈 3초 (원하시면 5000으로 바꿔서 5초로 설정하셔도 됩니다)
}

// ============================================================================
// 🚀 [ZenNotes V3] 5. 구형 V2 유저 확인 및 마이그레이션 안내
// ============================================================================
async function checkAndMigrateV3() {
  if (!gapi.client || !gapi.client.getToken()) return;

  try {
    // 1. 새 V3 폴더가 이미 있는지 확인
    const folderRes = await gapi.client.drive.files.list({
      q: "name = 'ZenNotes_Sync_Data' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id)"
    });

    if (folderRes.result.files && folderRes.result.files.length > 0) {
      console.log("✅ V3 유저 확인: 일반 스마트 동기화를 진행합니다.");
      smartSync();
      return;
    }

    // 2. 옛날 백업 파일(V2)이 있는지 확인
    const oldFileRes = await gapi.client.drive.files.list({
      q: "name = 'ZenNotes_Backup.json' and trashed = false",
      fields: "files(id)"
    });

    // 3. 옛날 파일이 발견되었다면! migration.js의 튼튼한 함수 호출!
    if (oldFileRes.result.files && oldFileRes.result.files.length > 0) {
      const confirmMigration = confirm("새로운 동기화 방식(V3)으로 데이터 업그레이드가 필요합니다.\n지금 바로 진행할까요? (약 10~30초 소요)");

      if (confirmMigration) {
        // 🚀 기획자님이 갖고 계신 그 튼튼한 migration.js의 함수를 그대로 호출!
        if (typeof runV3MigrationTest === 'function') {
          // 옛날 파일 ID를 넘겨주어, 이사가 끝나면 이름을 바꾸게 합니다.
          await runV3MigrationTest(oldFileRes.result.files[0].id);
        } else {
          alert("migration.js 파일이 연결되지 않았습니다. index.html을 확인해주세요.");
        }
      }
    } else {
      console.log("🌱 신규 유저: V3 환경을 구성합니다.");
      smartSync();
    }
  } catch (err) {
    console.error("❌ 이사 체크 중 오류:", err);
    smartSync();
  }
}

// // 🎯 [신규] 공식 인증 상태 확인 창구 (Single Source of Truth)
// // 다른 파일(db.js 등)에서 window.isZenOnline()을 호출하여 현재 연결 상태를 확인할 수 있습니다.
// window.isZenOnline = function () {
//   try {
//     const currentTime = Date.now();
//     // 1. API 로드 완료 여부 2. 토큰 존재 여부 3. 59분 수명 내인지 여부를 통합 판단
//     return (
//       typeof gapiInited !== 'undefined' && gapiInited &&
//       typeof gisInited !== 'undefined' && gisInited &&
//       window.gapi && window.gapi.client &&
//       window.gapi.client.getToken() !== null &&
//       typeof tokenExpiryTime !== 'undefined' &&
//       currentTime < tokenExpiryTime
//     );
//   } catch (e) {
//     console.error("인증 상태 확인 중 오류:", e);
//     return false;
//   }
// };


window.isZenOnline = function () {
  const currentTime = Date.now();
  // 🚀 와이파이 연결 상태가 아닌, 오직 '구글 API 토큰'이 유효하게 살아있는지 검사합니다!
  return (
    typeof gapiInited !== 'undefined' && gapiInited &&
    typeof gisInited !== 'undefined' && gisInited &&
    window.gapi &&
    gapi.client &&
    gapi.client.getToken() !== null &&
    Boolean(gapi.client.getToken()?.access_token) &&
    currentTime < tokenExpiryTime
  );
};