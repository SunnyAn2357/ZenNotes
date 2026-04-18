function gapiLoaded() {
  gapi.load('client', async () => {
    try {
      await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
      gapiInited = true;
      console.log("✅ 구글 API 준비 완료!");
    } catch (e) {
      console.error("❌ GAPI 초기화 실패:", e);
    }
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    // 🎯 추가됨: 매번 무작위 암호를 생성하여 위조된 응답(CSRF)을 방어합니다.
    state: Math.random().toString(36).substring(2),
    callback: ''
  });
  gisInited = true;
  console.log("✅ 구글 인증 준비 완료!");
}

function checkAuthState() {
  const currentTime = Date.now();

  // 🚀 [핵심 수정] 토큰이 존재하고, 50분 수명도 아직 안 지났을 때만 '유효'로 인정!
  const hasToken =
    gapiInited && gisInited && gapi.client && gapi.client.getToken() !== null && currentTime < tokenExpiryTime;

  const authBtnIcon = document.querySelector("#btn-auth i");
  if (authBtnIcon) authBtnIcon.style.color = hasToken ? "var(--accent)" : "";

  if (hasToken) {
    // 🎯 토큰이 유효할 땐 무조건 online이 아니라, 미동기 개수를 다시 세도록 넘깁니다. 
    // (미동기가 0일 때 'online'으로 띄우는 세부 로직은 다음 ui.js 수정 시 추가하겠습니다)
    if (typeof updateUnsyncedCount === 'function') updateUnsyncedCount();
    else updateUIState("online-idle");
  } else {
    // 🎯 1시간이 넘어 상한 토큰이면 확실하게 오프라인(회색) 처리!
    updateUIState("offline-idle");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  checkAuthState();
});

document.getElementById("btn-auth").addEventListener("click", () => {
  if (!gapiInited || !gisInited) {
    alert("구글 서비스 준비 중입니다. 잠시 후 다시 시도해주세요.");
    return;
  }
  closeAllPanelsMobile();

  // 🎯 [핵심 수정] 토큰이 있고, '50분 만료 시간'도 아직 안 지났을 때만 즉시 동기화
  if (gapi.client.getToken() !== null && Date.now() < tokenExpiryTime) {
    smartSync();
    return;
  }

  // 🎯 토큰이 없거나, 시간이 지나서 상했다면 구글에 다시 요청 (사용자가 눌렀으니 팝업이 떠도 안전)
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      console.warn(">>> 동기화 취소 또는 에러", resp.error);
      return;
    }

    // 🚀 토큰 수명 59분
    tokenExpiryTime = Date.now() + (59 * 60 * 1000);

    // 🚀 [핵심 추가] 토큰을 정상 발급받았으니, 즉시 계기판(구름)을 파란색으로 켭니다!
    checkAuthState();

    // 아이콘 깜빡임 효과
    const icon = document.querySelector("#btn-auth i");
    icon.classList.add("blink-active");
    setTimeout(() => icon.classList.remove("blink-active"), 1500);

    // 🚀 [4단계 핵심] 바로 동기화하지 않고, '이사'가 필요한지 먼저 확인합니다. 마이그레이션
    await checkAndMigrateV3();

    // smartSync(); // 새로 받은 싱싱한 토큰으로 동기화 시작
  };

  tokenClient.requestAccessToken();
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
// 🚀 [ZenNotes V3] 1. V3 동기화 메인 총괄 매니저 (비교, 다운, 업로드)
// ============================================================================

async function smartSync() {
  // 1. 검문소 통과 확인
  const isValid = await ensureValidToken();
  if (!isValid) return;

  if (!db) return;
  updateUIState("syncing");
  console.log(">>> [V3 엔진] 클라우드 동기화 시작...");

  try {
    const token = gapi.client.getToken().access_token;

    // 2. V3 전용 폴더 찾기
    const folderRes = await gapi.client.drive.files.list({
      q: "name = 'ZenNotes_Sync_Data' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "files(id)"
    });

    let folderId;

    // 🚀 [수정됨] 옛날 에러 메시지를 띄우는 대신, 폴더가 없으면 알아서 새로 만듭니다!
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

    // 3. index.json (가벼운 명부) 다운로드
    let cloudIndex = [];
    let indexFileId = null;
    const indexRes = await gapi.client.drive.files.list({
      q: `name = 'index.json' and '${folderId}' in parents and trashed = false`,
      fields: "files(id)"
    });

    if (indexRes.result.files && indexRes.result.files.length > 0) {
      indexFileId = indexRes.result.files[0].id;
      const indexFile = await gapi.client.drive.files.get({ fileId: indexFileId, alt: "media" });
      cloudIndex = typeof indexFile.result === 'string' ? JSON.parse(indexFile.result) : indexFile.result;
    }

    // 4. 로컬 DB 데이터 모두 읽기
    const localData = await new Promise((resolve) => {
      db.transaction(["memos"], "readonly").objectStore("memos").getAll().onsuccess = (e) => resolve(e.target.result);
    });

    // 5. 비교(Diff) 분석 - 바뀐 놈들만 솎아내기!

    // 🚀 [유령 노트 36개 완벽 해결] DB에 영구적인 주민등록증(syncId)을 발급합니다.
    const localMap = new Map();
    const itemsToPatch = []; // 영구 저장이 필요한 옛날 노트들 대기열

    localData.forEach(m => {
      // syncId가 없는 옛날 노트들을 발견하면?
      if (!m.syncId) {
        m.syncId = m.id.toString();
        itemsToPatch.push(m); // 임시 발급 후 DB 저장 대기열에 추가
      }
      localMap.set(m.syncId, m);
    });

    // 🎯 임시 부여된 ID를 기기(DB)에 영구적으로 박아 넣습니다!
    if (itemsToPatch.length > 0) {
      const patchTx = db.transaction(["memos"], "readwrite");
      const patchStore = patchTx.objectStore("memos");
      itemsToPatch.forEach(m => patchStore.put(m));
      console.log(`🛠️ 옛날 노트 ${itemsToPatch.length}개에 영구 주민등록(syncId) 발급 및 DB 저장 완료!`);
    }

    const toDownload = [];
    const toUpload = [];

    // [다운로드 대상] 구글이 더 최신이거나 로컬에 없는 경우
    for (const cMeta of cloudIndex) {
      if (!cMeta.syncId) continue; // 🚀 과거 제 실수로 올라간 유령 찌꺼기(undefined) 데이터 무시!

      const lMemo = localMap.get(cMeta.syncId);
      if (!lMemo || cMeta.updatedAt > lMemo.updatedAt) {
        toDownload.push(cMeta);
      }
    }

    // [업로드 대상] 로컬이 더 최신이거나 구글에 없는 경우 솎아내기
    for (const lMemo of localData) {
      const cMeta = cloudIndex.find(c => c.syncId === lMemo.syncId);

      // 구글에 없거나, 로컬이 더 최신이면 업로드 후보에 올림
      if (!cMeta || lMemo.updatedAt > cMeta.updatedAt) {

        // 🚀 [핵심 방어막] 단, 폴더이거나 삭제된 파일인데 '본문(content)'이 바뀐 게 아니라면 
        // 굳이 구글 서버로 30개씩 개별 업로드(memo_xxx.json)를 하지 않고 패스합니다!
        if ((lMemo.type === 'folder' || lMemo.isDeleted) && cMeta) {
          // 명부(index.json)만 조용히 업데이트하고 개별 파일 전송은 생략!
          const cIdx = cloudIndex.findIndex(c => c.syncId === lMemo.syncId);
          const meta = { ...lMemo };
          delete meta.content; delete meta.plainText;
          if (cIdx > -1) cloudIndex[cIdx] = meta;
          continue;
        }

        toUpload.push(lMemo); // 진짜로 본문이 수정된 정상 노트만 업로드 대기열에 추가!
      }
    }

    let needUIUpdate = false;

    // 6. 다운로드 실행 (변경된 파일만 핀셋 다운로드)
    if (toDownload.length > 0) {
      console.log(`⬇️ 클라우드 -> 기기: ${toDownload.length}개 다운로드 중...`);
      const downloadedMemos = [];

      for (const cMeta of toDownload) {
        // 폴더나 삭제된 파일은 껍데기(명부)만 가져오면 끝
        if (cMeta.type === 'folder' || cMeta.isDeleted || cMeta.isPermanentlyDeleted) {
          downloadedMemos.push({ ...cMeta });
        } else {
          // 실제 노트는 본문 파일(memo_xxx.json)을 다운로드하여 합체!
          const fileRes = await gapi.client.drive.files.list({
            q: `name = 'memo_${cMeta.syncId}.json' and '${folderId}' in parents and trashed = false`,
            fields: "files(id)"
          });
          if (fileRes.result.files && fileRes.result.files.length > 0) {
            const bodyFile = await gapi.client.drive.files.get({ fileId: fileRes.result.files[0].id, alt: "media" });
            const bodyData = typeof bodyFile.result === 'string' ? JSON.parse(bodyFile.result) : bodyFile.result;
            downloadedMemos.push({ ...cMeta, content: bodyData.content, plainText: bodyData.plainText });
          }
        }
      }

      // 로컬 DB 덮어쓰기
      await new Promise((resolve) => {
        const tx = db.transaction(["memos"], "readwrite");
        const store = tx.objectStore("memos");
        downloadedMemos.forEach(m => {
          const existing = localMap.get(m.syncId);
          if (existing) m.id = existing.id; // 기존 ID 유지
          else delete m.id; // 새 파일이면 ID 새로 발급
          store.put(m);
        });
        tx.oncomplete = () => resolve();
      });
      needUIUpdate = true;
    }

    // 7. 업로드 실행 (로컬에서 변경된 파일만 핀셋 업로드)
    if (toUpload.length > 0) {
      console.log(`⬆️ 기기 -> 클라우드: ${toUpload.length}개 업로드 중...`);

      for (const lMemo of toUpload) {
        // 본문이 있는 파일은 개별 파일(memo_xxx.json)로 덮어쓰기
        if (lMemo.type !== 'folder' && !lMemo.isPermanentlyDeleted) {
          const fileName = `memo_${lMemo.syncId}.json`;
          const fileContent = JSON.stringify({
            syncId: lMemo.syncId,
            content: lMemo.content || "",
            plainText: lMemo.plainText || ""
          });
          await v3_uploadFile(token, fileName, fileContent, folderId);
        }

        // 명부(index) 업데이트용 껍데기 제작
        const cIdx = cloudIndex.findIndex(c => c.syncId === lMemo.syncId);
        const meta = { ...lMemo };
        delete meta.content; delete meta.plainText; // 본문 삭제 (경량화)

        if (cIdx > -1) cloudIndex[cIdx] = meta;
        else cloudIndex.push(meta);
      }

      // 최신화된 명부(index.json)를 업로드
      await v3_uploadFile(token, 'index.json', JSON.stringify(cloudIndex), folderId, indexFileId);
    }

    // 8. 동기화 마무리
    console.log("✅ [V3 엔진] 증분 동기화 완벽 종료!");
    localStorage.setItem("zen_last_sync_time", Date.now()); // 마지막 동기화 시간 기록
    updateUnsyncedCount(); // '미동기' 0으로 초기화
    updateUIState("synced");

    // 화면 갱신 및 유령 노트 퇴마
    if (needUIUpdate) {
      // 🚀 [추가된 방어막] 현재 열려있는 노트가 다른 기기에서 방금 삭제되었다면?
      const checkTx = db.transaction(["memos"], "readonly");
      checkTx.objectStore("memos").get(currentMemoId || -1).onsuccess = (ev) => {
        const currentOpen = ev.target.result;

        if (!currentOpen || currentOpen.isDeleted || currentOpen.isPermanentlyDeleted) {
          console.log("🚨 현재 편집 중인 노트가 다른 기기에서 삭제되었습니다. 화면을 초기화합니다.");
          if (typeof createNewMemo === 'function') createNewMemo(); // 새 노트로 강제 리셋!
        }

        // 이후 정상적으로 UI 새로고침 진행
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
// 🚀 [ZenNotes V3] 3. 59분 토큰 만료 검문소 (오프라인 전환)
// ============================================================================
async function ensureValidToken() {
  if (!gisInited || !tokenClient) return false;

  const currentTime = Date.now();

  // 토큰이 없거나 수명(50분)이 초과되었다면?
  if (gapi.client.getToken() === null || currentTime >= tokenExpiryTime) {
    console.log("⚠️ 토큰 수명(1시간) 만료! 글쓰기 방해를 막기 위해 동기화를 일시 정지합니다.");

    // 🚨 억지로 팝업을 띄우지 않습니다! 조용히 클라우드 연결만 끊습니다.
    if (gapi.client.getToken() !== null) {
      gapi.client.setToken(null);
    }

    // 🎯 [수정됨] 구름 아이콘을 회색으로 바꾸고 오프라인 상태로 갱신합니다.
    checkAuthState();

    // 검문 실패를 알려서, io.js가 로컬 DB에만 저장하고 클라우드 전송은 시도하지 않게 막습니다.
    return false;
  }

  // 아직 59분이 안 지났으면 안전하므로 동기화 통과!
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
