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

    smartSync(); // 새로 받은 싱싱한 토큰으로 동기화 시작
  };

  // prompt: '' 옵션을 사용하여 이미 로그인된 경우 동의 절차를 간소화합니다.
  tokenClient.requestAccessToken({ prompt: '' });
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

    if (!folderRes.result.files || folderRes.result.files.length === 0) {
      console.warn("❌ V3 폴더가 없습니다. 우측 메뉴의 [V3 업로드 테스트]를 먼저 실행해주세요.");
      updateUIState("sync-error");
      return;
    }
    const folderId = folderRes.result.files[0].id;

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