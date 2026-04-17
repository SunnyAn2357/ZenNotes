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
  const hasToken =
    gapiInited && gisInited && gapi.client && gapi.client.getToken() !== null;
  const authBtnIcon = document.querySelector("#btn-auth i");

  if (authBtnIcon) authBtnIcon.style.color = hasToken ? "var(--accent)" : "";

  if (hasToken) {
    updateUIState("online-idle");
  } else {
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

    // 🚀 로그인/갱신 성공 시 수명을 다시 50분 연장!
    tokenExpiryTime = Date.now() + (50 * 60 * 1000);

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

// ============================================================================
// 🚀 [ZenNotes V3] 스마트 증분 동기화(Incremental Sync) 엔진
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
    const localMap = new Map(localData.map(m => [m.syncId, m]));
    const toDownload = [];
    const toUpload = [];

    // [다운로드 대상] 구글이 더 최신이거나 로컬에 없는 경우
    for (const cMeta of cloudIndex) {
      const lMemo = localMap.get(cMeta.syncId);
      if (!lMemo || cMeta.updatedAt > lMemo.updatedAt) {
        toDownload.push(cMeta);
      }
    }

    // [업로드 대상] 로컬이 더 최신이거나 구글에 없는 경우
    for (const lMemo of localData) {
      const cMeta = cloudIndex.find(c => c.syncId === lMemo.syncId);
      if (!cMeta || lMemo.updatedAt > cMeta.updatedAt) {
        toUpload.push(lMemo);
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

    // 화면 갱신
    if (needUIUpdate) {
      healDatabase(() => {
        loadMemoList();
        if (document.getElementById("file-manager-pane").style.display === "flex") {
          loadFileManager(currentFmFolderId);
        }
      });
    }

  } catch (err) {
    console.error("❌ V3 동기화 실패:", err);
    updateUIState("sync-error");
  }
}

// 🛠️ [V3 전용 헬퍼] 단일 파일 생성/덮어쓰기 함수
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
// 🚀 [ZenNotes V3] 평화로운 세션 만료 검문소 (사용자 방해 금지)
// ============================================================================
async function ensureValidToken() {
  if (!gisInited || !tokenClient) return false;

  const currentTime = Date.now();

  // 토큰이 없거나 수명(50분)이 초과되었다면?
  if (gapi.client.getToken() === null || currentTime >= tokenExpiryTime) {
    console.log("⚠️ 토큰 수명(50분) 만료! 글쓰기 방해를 막기 위해 동기화를 일시 정지합니다.");

    // 🚨 억지로 팝업을 띄우지 않습니다! 조용히 클라우드 연결만 끊습니다.
    if (gapi.client.getToken() !== null) {
      gapi.client.setToken(null);
    }

    // 🎯 [수정됨] 구름 아이콘을 회색으로 바꾸고 오프라인 상태로 갱신합니다.
    checkAuthState();

    // 검문 실패를 알려서, io.js가 로컬 DB에만 저장하고 클라우드 전송은 시도하지 않게 막습니다.
    return false;
  }

  // 아직 50분이 안 지났으면 안전하므로 동기화 통과!
  return true;
}

// ============================================================================
// 🚀 [V3] 타자 멈춤 감지 자동 백그라운드 동기화 (Debouncing)
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
// 🚀 [ZenNotes V3] 자동 마이그레이션 체크 및 실행 엔진 (독립형)
// ============================================================================
async function checkAndMigrateV3() {
  if (!gapi.client || !gapi.client.getToken()) return;
  const token = gapi.client.getToken().access_token;

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

    // 3. 옛날 파일이 발견되었다면! 자동 마이그레이션 모드 가동
    if (oldFileRes.result.files && oldFileRes.result.files.length > 0) {
      const confirmMigration = confirm("새로운 동기화 방식(V3)으로 데이터 업그레이드가 필요합니다.\n지금 바로 진행할까요? (약 10~30초 소요)");

      if (confirmMigration) {
        showToast("🚀 데이터 이사 중입니다. 화면을 닫지 마세요...");

        // 🎯 [신규 이사 로직] 스스로 폴더를 만들고 데이터를 쪼개서 올립니다.
        const metadata = { name: 'ZenNotes_Sync_Data', mimeType: 'application/vnd.google-apps.folder', parents: ['root'] };
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata)
        });
        const createdFolder = await createRes.json();
        const newFolderId = createdFolder.id;

        const allData = await new Promise((resolve) => {
          db.transaction(["memos"], "readonly").objectStore("memos").getAll().onsuccess = (e) => resolve(e.target.result);
        });

        const indexData = [];
        const filesToUpload = [];

        allData.forEach(memo => {
          const meta = { ...memo };
          delete meta.content; delete meta.plainText;
          indexData.push(meta);

          if (memo.type !== 'folder') {
            filesToUpload.push({
              name: `memo_${memo.syncId}.json`,
              content: JSON.stringify({ syncId: memo.syncId, content: memo.content || "", plainText: memo.plainText || "" })
            });
          }
        });

        // 명부 및 파일 업로드 실행
        await v3_uploadFile(token, 'index.json', JSON.stringify(indexData), newFolderId);

        for (let i = 0; i < filesToUpload.length; i++) {
          await v3_uploadFile(token, filesToUpload[i].name, filesToUpload[i].content, newFolderId);
          await new Promise(r => setTimeout(r, 200)); // 구글 서버 과부하 방지 (0.2초 딜레이)
        }

        // 4. 이사 완료 후 옛날 파일 이름 바꿔서 보관 (중복 실행 방지)
        const oldFileId = oldFileRes.result.files[0].id;
        await fetch(`https://www.googleapis.com/drive/v3/files/${oldFileId}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'ZenNotes_Backup_OLD_V2.json' })
        });

        console.log("🎊 데이터 이사 및 원본 보관 완료!");
        showToast("🎊 데이터 이사가 완벽하게 완료되었습니다!");
        smartSync(); // 새 집으로 첫 동기화
      }
    } else {
      // 옛날 파일도 없다면? 그냥 신규 유저이므로 동기화 실행 (smartSync가 알아서 새 폴더를 만듦)
      console.log("🌱 신규 유저: V3 환경을 구성합니다.");
      smartSync();
    }
  } catch (err) {
    console.error("❌ 이사 체크 중 오류:", err);
    smartSync(); // 에러 나도 일단 일반 동기화 시도는 해봅니다.
  }
}