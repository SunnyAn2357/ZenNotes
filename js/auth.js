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

async function syncDataToCloud() {
  if (!gapiInited || !gapi.client || gapi.client.getToken() === null) return;

  db
    .transaction(["memos"], "readonly")
    .objectStore("memos")
    .getAll().onsuccess = async (e) => {
      const allData = e.target.result;

      if (allData.length === 0 && !hasLoadedFromCloud) {
        console.warn(
          ">>> [보호장치] 로컬이 비어있어 클라우드에 빈 파일을 올리지 않습니다.",
        );
        return;
      }

      const cloudOptimizedData = allData.map((m) => {
        let clone = Object.assign({}, m);
        if (clone.content)
          clone.content = clone.content.replace(
            /src="data:image[^"]+"/gi,
            'src="" data-local-image="true"',
          );
        return clone;
      });

      try {
        const token = gapi.client.getToken().access_token;
        const res = await gapi.client.drive.files.list({
          q: "name = 'ZenNotes_Backup.json' and trashed = false",
          fields: "files(id)",
        });

        const file = res.result.files[0];

        const content = JSON.stringify({
          type: "ZenBackup",
          data: cloudOptimizedData,
        });

        updateUIState("syncing");

        if (file) {
          await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: content,
            },
          );
        } else {
          const metadata = {
            name: "ZenNotes_Backup.json",
            mimeType: "application/json",
            parents: ["root"],
          };
          const boundary = "-------314159265358979323846";
          const delimiter = `\r\n--${boundary}\r\n`;
          const close_delim = `\r\n--${boundary}--`;

          const body =
            delimiter +
            "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
            JSON.stringify(metadata) +
            delimiter +
            "Content-Type: application/json\r\n\r\n" +
            content +
            close_delim;

          await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": `multipart/related; boundary=${boundary}`,
              },
              body: body,
            },
          );
        }

        console.log("✅ 클라우드 동기화 완료");
        localStorage.setItem("zen_last_sync_time", Date.now()); // 👈 현재 시간을 '마지막 동기화 시간'으로 기록
        updateUnsyncedCount(); // ns: 0 으로 즉시 초기화
        updateUIState("synced");
        setTimeout(() => {
          if (gapi.client && gapi.client.getToken() !== null) {
            gapi.client.setToken(null);
            localStorage.removeItem("zen_logged_in");
            checkAuthState();
          }
        }, 10000); // 10초 뒤 조용히 권한 해제
      } catch (err) {
        console.error("❌ 전송 실패:", err);
        updateUIState("sync-error");
      }
    };
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

  // 만약 5초가 안 지나서 권한(토큰)이 살아있을 때 또 눌렀다면 바로 동기화 진행
  if (gapi.client.getToken() !== null) {
    smartSync();
    return;
  }

  // 권한이 없다면 구글에 조용히 토큰 요청
  tokenClient.callback = async (resp) => {
    if (resp.error !== undefined) {
      console.warn(">>> 동기화 취소 또는 에러", resp.error);
      return;
    }

    // 아이콘 깜빡임 효과
    const icon = document.querySelector("#btn-auth i");
    icon.classList.add("blink-active");
    setTimeout(() => icon.classList.remove("blink-active"), 1500);

    smartSync(); // 권한을 받아왔으니 즉시 백업(동기화) 시작
  };

  // prompt: 'consent'를 지웠기 때문에, 최초 1회 이후엔 동의 창 없이 스무스하게 넘어갑니다.
  tokenClient.requestAccessToken();
});

async function smartSync() {
  if (!gapi.client.getToken() || !db) return;
  console.log(">>> [데이터 우선 복구] 클라우드 확인 시작...");
  try {
    const res = await gapi.client.drive.files.list({
      q: "name = 'ZenNotes_Backup.json' and trashed = false",
      fields: "files(id, name)",
    });

    if (!res.result.files || res.result.files.length === 0) {
      console.warn(
        ">>> 클라우드에 백업 파일이 없습니다. 로컬 데이터를 업로드합니다.",
      );
      hasLoadedFromCloud = true;
      syncDataToCloud();
      return;
    }

    const fileId = res.result.files[0].id;
    const fileRes = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: "media",
    });

    let cloudData = fileRes.result;
    if (typeof cloudData === "string") {
      try {
        cloudData = JSON.parse(cloudData).data || [];
      } catch (e) {
        cloudData = [];
      }
    } else {
      cloudData = cloudData.data || [];
    }

    const tx = db.transaction(["memos"], "readwrite");
    const store = tx.objectStore("memos");

    store.getAll().onsuccess = (e) => {
      const localData = e.target.result;
      let needUIUpdate = false;
      const localMap = new Map(
        localData.map((m) => [m.syncId || m.id.toString(), m]),
      );

      cloudData.forEach((cloudMemo) => {
        const syncKey = cloudMemo.syncId || cloudMemo.id.toString();
        const localMemo = localMap.get(syncKey);

        if (!localMemo) {
          delete cloudMemo.id;
          cloudMemo.syncId = syncKey;
          store.add(cloudMemo);
          needUIUpdate = true;
        } else if (cloudMemo.updatedAt > localMemo.updatedAt) {
          let mergedContent = cloudMemo.content;
          if (localMemo.content) {
            const localSrcs = [];
            localMemo.content.replace(
              /<img[^>]+src="(data:image[^"]+)"/gi,
              (match, src) => {
                localSrcs.push(src);
              },
            );
            let imgIndex = 0;
            mergedContent = mergedContent.replace(
              /<img[^>]+data-local-image="true"[^>]*>/gi,
              (match) => {
                if (imgIndex < localSrcs.length) {
                  let restored = match
                    .replace(/src=""/i, `src="${localSrcs[imgIndex]}"`)
                    .replace(/ data-local-image="true"/i, "");
                  imgIndex++;
                  return restored;
                }
                return match;
              },
            );
          }
          cloudMemo.content = mergedContent;
          cloudMemo.id = localMemo.id;
          cloudMemo.syncId = syncKey;
          store.put(cloudMemo);
          needUIUpdate = true;
        }
      });

      tx.oncomplete = () => {
        console.log(">>> [동기화 병합 완료] 클라우드 로드 성공");
        hasLoadedFromCloud = true;

        // 🎯 [수정] 동기화 직후 자가 치유 엔진으로 중복 폴더 싹쓸이 병합
        healDatabase(() => {
          if (needUIUpdate) loadMemoList();
          checkAuthState();
          syncDataToCloud();
        });
      };
    };
  } catch (err) {
    console.error(">>> [스마트 동기화 오류] 통신 실패:", err);
    document.getElementById("status-dot").className = "status-dot unsaved";
  }
}
