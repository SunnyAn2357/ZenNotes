function generateSyncId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function toggleMemoMenu(e) {
  e.stopPropagation();
  const currentWrap = e.target.closest(".memo-actions-wrap");
  const isCurrentlyOpen = currentWrap.classList.contains("is-menu-open");
  closeAllMemoMenus();
  if (!isCurrentlyOpen) currentWrap.classList.add("is-menu-open");
}

function closeAllMemoMenus() {
  document
    .querySelectorAll(".memo-actions-wrap.is-menu-open")
    .forEach((wrap) => {
      wrap.classList.remove("is-menu-open");
    });
}

// 🎯 [교정] 핀 아이콘 클릭 시 즉시 고정/해제 실행
function handlePinClick(id, isPinned, e) {
  e.stopPropagation();
  // 복잡한 메뉴 체크 없이 바로 토글 함수 호출
  togglePin(id, e);
}

function toggleRightPane() {
  if (document.activeElement) document.activeElement.blur(); // 👈 추가
  const rp = document.getElementById("col-right");
  const gb = document.getElementById("global-menu-btn");

  document.getElementById("trash-pane").classList.remove("is-open");

  if (rp.classList.contains("is-closed")) {
    rp.classList.remove("is-closed");
    gb.style.display = "none";
    // [수정된 부분] 모바일에서 우측 패널 열 때 투명 방어막(오버레이) 켜기
    if (window.innerWidth <= 768) {
      document.getElementById("mobile-overlay").classList.add("is-active");
    }
    history.pushState({ panel: "right" }, ""); // 🎯 PC 환경도 브라우저 뒤로가기 기록을 남깁니다!
  } else {
    rp.classList.add("is-closed");
    gb.style.display = "flex";
    // [수정된 부분] 모바일에서 우측 패널 닫을 때 방어막 끄기
    if (window.innerWidth <= 768)
      document.getElementById("mobile-overlay").classList.remove("is-active");
  }
}

function toggleTrashPane() {
  if (document.activeElement) document.activeElement.blur(); // 👈 추가
  const tp = document.getElementById("trash-pane");
  if (tp.classList.contains("is-open")) {
    tp.classList.remove("is-open");
    // [수정된 부분] 휴지통만 닫았는데 우측 패널마저 닫혀있다면 방어막 끄기
    if (
      window.innerWidth <= 768 &&
      document.getElementById("col-right").classList.contains("is-closed")
    ) {
      document.getElementById("mobile-overlay").classList.remove("is-active");
    }
  } else {
    tp.classList.add("is-open");
    loadTrashList();
    // [수정된 부분] 모바일에서 휴지통 열 때 투명 방어막(오버레이) 켜기
    if (window.innerWidth <= 768) {
      document.getElementById("mobile-overlay").classList.add("is-active");
    }
    history.pushState({ panel: "trash" }, ""); // 🎯 PC 환경도 브라우저 뒤로가기 기록을 남깁니다!
  }
}

// [추가] 다중 선택 모드 방어막 (캡처링 단계)
// 화면의 다른 버튼이 눌리기 직전에 가장 먼저 가로채서 이벤트를 소멸시킵니다.
document.addEventListener(
  "click",
  (e) => {
    const inMainMulti = isMultiSelectMode || selectedMemos.size > 1;
    const inTrashMulti = isTrashMultiSelectMode || selectedTrashMemos.size > 1;

    // 다중 선택 중일 때, 리스트나 메뉴가 아닌 다른 곳(새 노트, 검색창, 중앙 에디터 등)을 클릭했다면
    if (
      (inMainMulti || inTrashMulti) &&
      !e.target.closest(".memo-item") &&
      !e.target.closest(".memo-actions-wrap")
    ) {
      e.preventDefault(); // 원래 하려던 동작(텍스트박스 포커스 등) 취소
      e.stopPropagation(); // 클릭 이벤트가 버튼(새 노트 작성 등)으로 전달되는 것을 완벽히 차단

      if (inMainMulti) {
        isMultiSelectMode = false;
        selectedMemos.clear();
        if (currentMemoId) selectedMemos.add(currentMemoId);
        loadMemoList(false);
      }
      if (inTrashMulti) {
        isTrashMultiSelectMode = false;
        selectedTrashMemos.clear();
        loadTrashList();
      }
    }
  },
  true,
); // <-- true: 캡처링 활성화. 자바스크립트에서 이벤트를 가장 먼저 낚아챕니다.

// 기존 화면 닫기 및 메뉴 닫기용 클릭 이벤트 (버블링 단계)
document.addEventListener("click", (e) => {
  closeAllMemoMenus();
  // 🎯 파일 관리창 팝업 메뉴 닫기 로직
  const fmItemMenu = document.getElementById("fm-item-menu");
  const fmGlobalMenu = document.getElementById("fm-global-menu");
  if (fmItemMenu) fmItemMenu.classList.remove("is-active");
  if (fmGlobalMenu) fmGlobalMenu.classList.remove("is-active");

  // 🎯 [V4.2.2] 좌측 삼선 노트 메뉴 닫기 로직
  const leftNoteMenu = document.getElementById("left-note-menu");
  const leftNoteMenuBtn = document.getElementById("left-note-menu-btn");
  if (
    leftNoteMenu &&
    leftNoteMenu.classList.contains("is-active") &&
    !leftNoteMenu.contains(e.target) &&
    (!leftNoteMenuBtn || !leftNoteMenuBtn.contains(e.target))
  ) {
    closeLeftNoteMenu();
  }

  const rp = document.getElementById("col-right");
  const tp = document.getElementById("trash-pane");
  const gb = document.getElementById("global-menu-btn");

  if (
    !rp.classList.contains("is-closed") &&
    !rp.contains(e.target) &&
    !tp.contains(e.target) &&
    !gb.contains(e.target)
  ) {
    rp.classList.add("is-closed");
    gb.style.display = "flex";
  }
  if (
    tp.classList.contains("is-open") &&
    !tp.contains(e.target) &&
    !rp.contains(e.target) &&
    !gb.contains(e.target)
  ) {
    tp.classList.remove("is-open");
  }
});

function handleLeftHamburger() {
  closeLeftNoteMenu();
  if (window.matchMedia('(max-width: 768px)').matches) {
    toggleLeftPaneMobile();
  } else {
    const colLeft = document.getElementById('col-left');
    colLeft.classList.toggle('collapsed');
    const collapseBtn = document.getElementById('left-collapse-btn');
    const isCollapsed = colLeft.classList.contains('collapsed');
    if (isCollapsed && typeof closeSidebarSearchBar === 'function') {
      closeSidebarSearchBar(true);
    }
    if (collapseBtn) {
      collapseBtn.classList.toggle('is-collapsed', isCollapsed);
      collapseBtn.setAttribute('title', isCollapsed ? '사이드바 펼치기' : '사이드바 접기');
      collapseBtn.setAttribute('aria-label', isCollapsed ? '사이드바 펼치기' : '사이드바 접기');
    }
  }
}

function toggleSidebarSearchBar(forceOpen) {
  closeLeftNoteMenu();
  const bar = document.getElementById('sidebar-search-bar');
  const btn = document.getElementById('btn-sidebar-search-toggle');
  const inp = document.getElementById('list-search-input');
  if (!bar) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !bar.classList.contains('is-open');
  if (shouldOpen) {
    bar.classList.add('is-open');
    if (btn) btn.classList.add('is-active');
    setTimeout(() => {
      if (inp) {
        inp.focus();
        inp.select();
      }
    }, 20);
  } else {
    closeSidebarSearchBar(true);
  }
}

function closeSidebarSearchBar(clearQuery = true) {
  const bar = document.getElementById('sidebar-search-bar');
  const btn = document.getElementById('btn-sidebar-search-toggle');
  const inp = document.getElementById('list-search-input');
  if (bar) bar.classList.remove('is-open');
  if (btn) btn.classList.remove('is-active');
  if (clearQuery && inp && inp.value !== '') {
    inp.value = '';
    triggerMainSearch();
  } else {
    syncMainSearchClearBtn();
  }
}

function toggleLeftPaneMobile() {
  if (document.activeElement) document.activeElement.blur(); // 👈 브라우저의 포커스를 뺏어 키보드를 강제로 숨깁니다.
  closeLeftNoteMenu();
  const lp = document.getElementById("col-left");
  const ov = document.getElementById("mobile-overlay");
  lp.classList.toggle("is-mobile-open");
  if (lp.classList.contains("is-mobile-open")) {
    ov.classList.add("is-active");
    history.pushState({ panel: "left" }, ""); // 👈 이 줄을 추가하세요!
    document.getElementById("col-right").classList.add("is-closed");
    document.getElementById("trash-pane").classList.remove("is-open");
    document.getElementById("global-menu-btn").style.display = "flex";
  } else {
    ov.classList.remove("is-active");
  }
}

function closeAllPanelsMobile() {
  closeAllMemoMenus();
  closeLeftNoteMenu();

  // 🎯 PC와 모바일 환경 차별 없이, 열려있는 모든 패널을 깔끔하게 닫아줍니다!
  document.getElementById("col-left").classList.remove("is-mobile-open");
  document.getElementById("col-right").classList.add("is-closed");
  document.getElementById("trash-pane").classList.remove("is-open");
  document.getElementById("mobile-overlay").classList.remove("is-active");
  document.getElementById("global-menu-btn").style.display = "flex";
}

window.addEventListener("resize", () => {
  if (window.innerWidth > 768) {
    document.getElementById("col-left").classList.remove("is-mobile-open");
    document.getElementById("mobile-overlay").classList.remove("is-active");
    if (
      document.getElementById("col-right").classList.contains("is-closed") &&
      !document.getElementById("trash-pane").classList.contains("is-open")
    ) {
      document.getElementById("global-menu-btn").style.display = "flex";
    }
  }
});

document.getElementById("btn-read-memo").addEventListener("click", function () {
  closeLeftNoteMenu();
  closeAllPanelsMobile();
  const synth = window.speechSynthesis;
  const btnIcon = this.querySelector("i");
  const btnText = this.querySelector(".btn-text");

  if (isReading || synth.speaking) {
    synth.cancel();
    isReading = false;
    btnIcon.className = "fa-solid fa-volume-high";
    btnText.innerText = "음성 재생";
    return;
  }

  const textToRead = quill.getText().trim();
  if (!textToRead) return;

  const utterance = new SpeechSynthesisUtterance(textToRead);
  utterance.lang = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(textToRead.substring(0, 50))
    ? "ko-KR"
    : "en-US";
  utterance.rate = 1.0;

  utterance.onend = function () {
    isReading = false;
    btnIcon.className = "fa-solid fa-volume-high";
    btnText.innerText = "음성 재생";
  };

  utterance.onerror = function () {
    console.warn(">>> 음성 읽기 중단");
    isReading = false;
    btnIcon.className = "fa-solid fa-volume-high";
    btnText.innerText = "음성 재생";
  };

  synth.cancel();
  synth.speak(utterance);
  isReading = true;
  btnIcon.className = "fa-solid fa-stop";
  btnText.innerText = "읽기 중지";
});

// ============================================================================
// 모바일 하드웨어 '뒤로가기' 완벽 제어 및 앱 종료 방어(토스트) 로직
// ============================================================================

window.addEventListener("load", () => {
  if (window.innerWidth <= 768) {
    // 1. 진짜 첫 화면을 'base'로 못 박아둡니다.
    history.replaceState({ page: "base" }, "");
    // 2. 그 위에 'main'을 얹어 완벽한 이중 방어막을 칩니다.
    history.pushState({ page: "main" }, "");
  }
});

// 🎯 [V4.9.12] Zen 스타일 컴팩트 캡슐형 토스트 (모바일 1줄 칼정렬 & 줄바꿈 방어)
function showToast(msg, undoData = null) {
  let toast = document.getElementById("zen-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "zen-toast";
    document.body.appendChild(toast);
  }

  const hasNewline = typeof msg === "string" && msg.includes("\n");
  const isMobile = window.innerWidth <= 600;

  toast.style.cssText =
    "position:fixed; bottom:calc(36px + env(safe-area-inset-bottom, 0px)); left:50%; transform:translateX(-50%); " +
    "background:var(--toast-bg); color:var(--toast-text); border:1px solid var(--border); " +
    (isMobile ? "padding:8px 16px; font-size:12.5px; border-radius:24px; gap:12px; " : "padding:10px 20px; font-size:13.5px; border-radius:28px; gap:16px; ") +
    "font-weight:600; z-index:2000000 !important; opacity:0; transition:opacity 0.25s ease-in-out; " +
    "text-align:center; line-height:1.35; box-shadow:0 12px 32px rgba(0,0,0,0.35); " +
    "width:max-content; max-width:calc(100vw - 32px); box-sizing:border-box; display:flex; align-items:center; justify-content:center; " +
    (hasNewline ? "white-space:pre-wrap; word-break:break-word; " : "white-space:nowrap; word-break:normal; ") +
    "pointer-events:none;";
  toast.style.zIndex = "2000000";

  let html = `<span>${msg}</span>`;

  if (undoData) {
    lastUndoData = undoData;
    // 처음엔 투명하고 터치 불가 상태로 대기
    html += `<button id="zen-undo-btn" style="color:var(--accent); font-weight:700; font-size:13px; padding:6px 12px; background:rgba(120,169,255,0.15); border:none; border-radius:16px; cursor:pointer; transition:opacity 0.3s ease-in-out, background 0.2s; flex-shrink:0; opacity:0; pointer-events:none; white-space:nowrap;">실행 취소</button>`;
  }

  toast.innerHTML = html;
  toast.style.opacity = "1";
  toast.style.pointerEvents = "auto"; // 토스트 껍데기 터치 활성화

  if (undoData) {
    const undoBtn = document.getElementById("zen-undo-btn");

    // 👇 이 내부가 수정된 부분입니다.
    undoBtn.onclick = () => {
      executeUndo();
      toast.style.opacity = "0";
      toast.style.pointerEvents = "none";
      undoBtn.style.pointerEvents = "none"; // 🎯 취소 누르는 즉시 버튼 센서 파괴

      // 🟢 [수정됨] 백그라운드에서 돌고 있는 기존 타이머를 즉시 추적하여 파괴합니다.
      if (typeof toastTimer !== "undefined" && toastTimer) {
        clearTimeout(toastTimer);
        toastTimer = null;
      }

      // 🟢 [수정됨] 타이머가 죽었으므로, 원래 타이머가 하던 '알맹이 삭제' 역할을 여기서 대신 수행합니다.
      setTimeout(() => {
        if (toast.style.opacity === "0") {
          toast.innerHTML = ""; // 0.3초 뒤 물리적 삭제
        }
      }, 300);
    };
    // 👆 여기까지 수정되었습니다.

    // 0.5초 뒤에 버튼만 스르륵 나타나면서 터치 활성화 (그대로 유지)
    setTimeout(() => {
      if (undoBtn) {
        undoBtn.style.opacity = "1";
        undoBtn.style.pointerEvents = "auto";
      }
    }, 500);
  }

  if (toastTimer) clearTimeout(toastTimer);

  toastTimer = setTimeout(
    () => {
      toast.style.opacity = "0";
      toast.style.pointerEvents = "none"; // 토스트 껍데기 터치 투과

      // 🎯 [유령 퇴마 로직] 자식 버튼의 센서도 확실하게 끄고, 0.3초(투명해지는 시간) 뒤에 알맹이를 아예 삭제!
      const undoBtn = document.getElementById("zen-undo-btn");
      if (undoBtn) undoBtn.style.pointerEvents = "none";

      setTimeout(() => {
        if (toast.style.opacity === "0") {
          toast.innerHTML = ""; // 허공에 남은 버튼의 잔해를 물리적으로 완전 삭제
        }
      }, 300);
    },
    undoData ? 5000 : 2500,
  );
}

// 🎯 [실행 취소] 핵심 DB 롤백 엔진 (restore / moveBack / renameBack 통합)
function executeUndo() {
  if (!Array.isArray(lastUndoData) || lastUndoData.length === 0 || !db) return;
  const undoItems = lastUndoData.slice();
  lastUndoData = null;

  const existingToast = document.getElementById("zen-toast");
  if (existingToast) {
    existingToast.style.opacity = "0";
    existingToast.style.pointerEvents = "none";
  }
  if (typeof toastTimer !== "undefined" && toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  const renamedUpdates = [];
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  undoItems.forEach((item) => {
    if (!item || item.id === undefined || item.id === null) return;
    store.get(item.id).onsuccess = (e) => {
      const m = e.target.result;
      if (!m) return;
      if (item.action === "restore") {
        m.isDeleted = false;
        delete m.deletedAt;
      } else if (item.action === "moveBack") {
        m.parentId = item.oldParentId !== undefined ? item.oldParentId : null;
        if (item.oldParentSyncId) m.parentSyncId = item.oldParentSyncId;
        else delete m.parentSyncId;
        if (item.wasDeleted) {
          m.isDeleted = true;
          if (item.oldDeletedAt) m.deletedAt = item.oldDeletedAt;
        } else {
          m.isDeleted = false;
          delete m.deletedAt;
        }
      } else if (item.action === "renameBack" && typeof item.oldTitle === "string") {
        m.title = item.oldTitle;
        renamedUpdates.push({ id: m.id, oldTitle: item.oldTitle });
      }
      m.updatedAt = Date.now();
      store.put(m);
    };
  });

  tx.oncomplete = () => {
    renamedUpdates.forEach((r) => {
      if (typeof updateRecentNoteTitleIfExist === "function") {
        updateRecentNoteTitleIfExist(r.id, r.oldTitle);
      }
      if (typeof currentMemoId !== "undefined" && Number(currentMemoId) === Number(r.id)) {
        const titleInput = document.getElementById("memo-title-input");
        if (titleInput) titleInput.value = r.oldTitle;
        document.title = r.oldTitle;
      }
    });

    showToast("작업이 실행 취소되었습니다.");
    if (typeof loadMemoList === "function") loadMemoList(true);
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex" && typeof loadFileManager === "function") {
      loadFileManager(typeof currentFmFolderId !== "undefined" ? currentFmFolderId : null);
    }
    const trashPane = document.getElementById("trash-pane");
    if (trashPane && trashPane.classList.contains("is-open") && typeof loadTrashList === "function") {
      loadTrashList();
    }
    if (typeof updateLeftMenuCurrentFolderPath === "function") {
      updateLeftMenuCurrentFolderPath();
    }
    if (typeof updateUnsyncedCount === "function") updateUnsyncedCount();
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  };
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const isDesktopWebView = !!(window.chrome && window.chrome.webview);
    if (isDesktopWebView) return;
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        console.log("✅ 서비스 워커 등록 완료! Scope:", registration.scope);

        // 🎯 업데이트 팝업(토스트) 표시 헬퍼 함수
        const showUpdateToast = (worker) => {
          const updateToast = document.getElementById("update-toast");
          if (!updateToast) return;
          updateToast.style.display = "flex";

          const updateBtn = document.getElementById("update-btn");
          if (updateBtn) {
            updateBtn.onclick = () => {
              updateToast.style.display = "none";
              worker.postMessage({ type: "SKIP_WAITING" });
            };
          }
        };

        // 🎯 1. 이미 백그라운드에 다운로드되어 대기(waiting) 중인 새 워커가 있다면 즉시 팝업 표시
        if (registration.waiting && navigator.serviceWorker.controller) {
          showUpdateToast(registration.waiting);
        }

        // 🎯 2. 새로운 버전의 서비스 워커 설치가 발견되었을 때
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateToast(newWorker);
            }
          });
        });

        // 🎯 3. 깃허브 호스팅 환경: 앱 접속 시 서버의 최신 sw.js 즉시 확인 요청
        try {
          registration.update();
        } catch (e) {}
      })
      .catch((error) => {
        console.error("❌ 서비스 워커 등록 실패:", error);
      });

    // 🎯 대기 중이던 새 워커가 권한을 넘겨받고 활성화되면 페이지를 1회 새로고침하여 새 화면 표시
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

// 👇 수정: 앱 숏컷 & 공유 타겟 처리 함수 (기본 기능 복구)
function handleLaunchParams() {
  const urlParams = new URLSearchParams(window.location.search);

  // 1. 앱 숏컷(새 노트 작성)으로 앱을 켰을 때
  if (urlParams.get("action") === "new") {
    createNewMemo();
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  // 2. 다른 앱(유튜브, 웹브라우저 등)에서 '공유하기'로 ZenNotes를 선택했을 때
  const sharedTitle = urlParams.get("title");
  const sharedText = urlParams.get("text");
  const sharedUrl = urlParams.get("url");

  if (sharedTitle || sharedText || sharedUrl) {
    createNewMemo(); // 빈 노트를 하나 열고

    // 제목 세팅
    if (sharedTitle) {
      document.getElementById("memo-title-input").value = sharedTitle;
    }

    // 본문 세팅 (텍스트와 URL을 안전하게 이스케이프·검증하여 삽입)
    if (sharedUrl || sharedText) {
      let content = "";
      if (sharedText) {
        content += escapeHtmlSafe(sharedText).replace(/\r?\n/g, "<br>") + "<br><br>";
      }

      // URL이 있으면 http/https 프로토콜 검증 후 클릭 가능한 링크 형태로 삽입
      if (sharedUrl) {
        let safeHref = "";
        try {
          const parsedUrl = new URL(sharedUrl);
          if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
            safeHref = parsedUrl.href;
          }
        } catch (e) {}
        const escapedDisplay = escapeHtmlSafe(sharedUrl);
        if (safeHref) {
          content += `<a href="${escapeHtmlSafe(safeHref)}" target="_blank" rel="noopener noreferrer">${escapedDisplay}</a><br><br>`;
        } else {
          content += `${escapedDisplay}<br><br>`;
        }
      }

      quill.root.innerHTML = content;
      triggerAutoSave(); // 안전하게 자동 저장 실행
    }

    // 새로고침 방지를 위해 URL을 깔끔하게 정리합니다.
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

// --- [추가] 모바일 롱프레스 다중선택 함수 ---
function startPress(e, memoId, isTrash) {
  if (e.target.closest(".memo-actions-wrap")) return; // 메뉴 터치는 무시
  if (e.type === "touchstart" && e.touches.length > 1) return; // 멀티터치 무시

  isPressTriggered = false;
  pressTimer = setTimeout(() => {
    isPressTriggered = true;
    if (navigator.vibrate) navigator.vibrate(50); // 모바일 진동 피드백

    if (isTrash) {
      // [핵심 수정] 휴지통: 다중 선택 시작 시 기존 바구니를 싹 비우고 시작
      if (!isTrashMultiSelectMode) {
        selectedTrashMemos.clear();
        isTrashMultiSelectMode = true;
        history.pushState({ mode: "multi" }, ""); // 👈 1. 휴지통 방어막 추가!
      }
      selectedTrashMemos.add(memoId);
      lastSelectedTrashId = memoId;
      loadTrashList();
    } else {
      // [핵심 수정] 메인 목록: 다중 선택 시작 시 현재 열린 노트의 선택을 지우고 새로 시작
      if (!isMultiSelectMode) {
        selectedMemos.clear();
        isMultiSelectMode = true;
        history.pushState({ mode: "multi" }, ""); // 👈 2. 메인창 방어막 추가!
      }
      selectedMemos.add(memoId);
      lastSelectedId = memoId;
      loadMemoList(false);
    }
  }, 500); // 0.5초(500ms) 길게 누르면 다중선택 진입
}

function cancelPress() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}

// 🎯 [성능 최적화] 검색창 3종 디바운스(Debounce) 타이머
function syncMainSearchClearBtn() {
  const inp = document.getElementById("list-search-input");
  const clearBtn = document.getElementById("list-search-clear-btn");
  if (clearBtn) {
    clearBtn.style.display = inp && inp.value.length > 0 ? "flex" : "none";
  }
}

function triggerMainSearch() {
  syncMainSearchClearBtn();
  if (mainSearchTimer) clearTimeout(mainSearchTimer);
  mainSearchTimer = setTimeout(() => loadMemoList(true), 220);
}

function triggerTrashSearch() {
  if (trashSearchTimer) clearTimeout(trashSearchTimer);
  trashSearchTimer = setTimeout(() => loadTrashList(), 300);
}

// ============================================================================
// [V1.2.0] 앱 화면 잠금(비밀번호 입력 · 화면 자동 잠금) & 2중 오토-락 엔진
// ============================================================================
const APP_LOCK_ENABLED_KEY = "zen_app_lock_enabled";
const APP_LOCK_HASH_KEY = "zen_app_lock_hash";
const APP_LOCK_HINT_KEY = "zen_app_lock_hint";
const APP_LOCK_AUTO_KEY = "zen_app_lock_auto";

let appLockSetupMode = "setup"; // 'setup' | 'change' | 'disable' | 'masterReset'
let isAppLockSubmitting = false;
let appLockMasterResetTimer = null;

const ZEN_DUBEOLSIK_COMPAT_MAP = {
  "\u3131": "r", "\u3132": "r", "\u3133": "rt", "\u3134": "s", "\u3135": "sw", "\u3136": "sg",
  "\u3137": "e", "\u3138": "e", "\u3139": "f", "\u313a": "fr", "\u313b": "fa", "\u313c": "fq",
  "\u313d": "ft", "\u313e": "fx", "\u313f": "fv", "\u3140": "fg", "\u3141": "a", "\u3142": "q",
  "\u3143": "q", "\u3144": "qt", "\u3145": "t", "\u3146": "t", "\u3147": "d", "\u3148": "w",
  "\u3149": "w", "\u314a": "c", "\u314b": "z", "\u314c": "x", "\u314d": "v", "\u314e": "g",
  "\u314f": "k", "\u3150": "o", "\u3151": "i", "\u3152": "o", "\u3153": "j", "\u3154": "p",
  "\u3155": "u", "\u3156": "p", "\u3157": "h", "\u3158": "hk", "\u3159": "ho", "\u315a": "hl",
  "\u315b": "y", "\u315c": "n", "\u315d": "nj", "\u315e": "np", "\u315f": "nl", "\u3160": "b",
  "\u3161": "m", "\u3162": "ml", "\u3163": "l"
};
const ZEN_HANGUL_CHO = ["r", "r", "s", "e", "e", "f", "a", "q", "q", "t", "t", "d", "w", "w", "c", "z", "x", "v", "g"];
const ZEN_HANGUL_JUNG = ["k", "o", "i", "o", "j", "p", "u", "p", "h", "hk", "ho", "hl", "y", "n", "nj", "np", "nl", "b", "m", "ml", "l"];
const ZEN_HANGUL_JONG = ["", "r", "r", "rt", "s", "sw", "sg", "e", "f", "fr", "fa", "fq", "ft", "fx", "fv", "fg", "a", "q", "qt", "t", "t", "d", "w", "c", "z", "x", "v", "g"];

function normalizeAppLockMasterCandidate(raw) {
  const str = String(raw || "").trim();
  if (!str) return "";
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = str.charCodeAt(i);
    if (ZEN_DUBEOLSIK_COMPAT_MAP[ch]) {
      out += ZEN_DUBEOLSIK_COMPAT_MAP[ch];
    } else if (code >= 0xac00 && code <= 0xd7a3) {
      const sIndex = code - 0xac00;
      const choIdx = Math.floor(sIndex / (21 * 28));
      const jungIdx = Math.floor((sIndex % (21 * 28)) / 28);
      const jongIdx = sIndex % 28;
      out += (ZEN_HANGUL_CHO[choIdx] || "") + (ZEN_HANGUL_JUNG[jungIdx] || "") + (ZEN_HANGUL_JONG[jongIdx] || "");
    } else if (code >= 0x1100 && code <= 0x1112) {
      out += ZEN_HANGUL_CHO[code - 0x1100] || "";
    } else if (code >= 0x1161 && code <= 0x1175) {
      out += ZEN_HANGUL_JUNG[code - 0x1161] || "";
    } else if (code >= 0x11a8 && code <= 0x11c2) {
      out += ZEN_HANGUL_JONG[code - 0x11a8 + 1] || "";
    } else {
      out += ch.toLowerCase();
    }
  }
  return out;
}

function isAppLockMasterKey(raw) {
  return normalizeAppLockMasterCandidate(raw) === "myads";
}

function isAppLockSetupModalOpen() {
  const modal = document.getElementById("app-lock-setup-modal");
  return Boolean(modal && modal.style.display === "flex");
}

function requestNativeWebViewFocus() {
  if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === "function") {
    try {
      window.chrome.webview.postMessage(JSON.stringify({ type: "focusWebView" }));
    } catch (e) {}
  }
}

window.__zenNativeDialogDepth = window.__zenNativeDialogDepth || 0;
window.__zenSuppressBlurLockUntil = window.__zenSuppressBlurLockUntil || 0;

function beginNativeDialogPause() {
  window.__zenNativeDialogDepth = (window.__zenNativeDialogDepth || 0) + 1;
}

function endNativeDialogPause() {
  window.__zenNativeDialogDepth = Math.max(0, (window.__zenNativeDialogDepth || 1) - 1);
  window.__zenSuppressBlurLockUntil = Date.now() + 600;
}

function isNativeDialogSuppressingBlur() {
  return (
    (window.__zenNativeDialogDepth || 0) > 0 ||
    Date.now() < (window.__zenSuppressBlurLockUntil || 0)
  );
}

// [V1.7.9] 보안 폴더 내 생성/수정/조회/삭제(CRUD) 직후 순간 포커스 이탈 오탐 방지
function markSecurityCrudActivity(durationMs = 800) {
  const until = Date.now() + Math.max(200, Number(durationMs) || 800);
  window.__zenSuppressBlurLockUntil = Math.max(
    window.__zenSuppressBlurLockUntil || 0,
    until
  );
}

// [V1.7.9] 앱 내장 confirm/alert/prompt 호출 중 발생하는 blur/deactivate 오토락 오작동 원천 차단
(function wrapNativeDialogsForAutoLock() {
  if (window.__zenNativeDialogsWrapped) return;
  window.__zenNativeDialogsWrapped = true;
  ["confirm", "alert", "prompt"].forEach((fnName) => {
    const orig = typeof window[fnName] === "function" ? window[fnName].bind(window) : null;
    if (!orig) return;
    window[fnName] = function (...args) {
      beginNativeDialogPause();
      try {
        return orig(...args);
      } finally {
        endNativeDialogPause();
      }
    };
  });
})();

function openFilePickerWithAutoLockPause(inputEl) {
  if (!inputEl) return;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener("focus", onFocusReturn, true);
    inputEl.removeEventListener("change", finish);
    inputEl.removeEventListener("cancel", finish);
    endNativeDialogPause();
  };
  const onFocusReturn = () => {
    setTimeout(finish, 180);
  };
  beginNativeDialogPause();
  window.addEventListener("focus", onFocusReturn, true);
  inputEl.addEventListener("change", finish, { once: true });
  inputEl.addEventListener("cancel", finish, { once: true });
  inputEl.click();
}

function isAppLockEnabled() {
  return (
    localStorage.getItem(APP_LOCK_ENABLED_KEY) === "true" &&
    Boolean(localStorage.getItem(APP_LOCK_HASH_KEY))
  );
}

function isAppLockAutoEnabled() {
  if (!isAppLockEnabled()) return false;
  return localStorage.getItem(APP_LOCK_AUTO_KEY) === "true";
}

function isAppScreenLocked() {
  const overlay = document.getElementById("app-lock-overlay");
  return Boolean(
    window.__zenAppScreenLocked ||
      (overlay && overlay.style.display === "flex")
  );
}

async function sha256Hex(text) {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

let appLockLiveCheckSeq = 0;

function focusAppLockInputNow() {
  if (!isAppScreenLocked() || isAppLockSetupModalOpen()) return;
  const input = document.getElementById("app-lock-input");
  if (input && document.activeElement !== input) {
    input.focus();
  }
}

function triggerMasterPasswordResetModal() {
  if (appLockMasterResetTimer) {
    clearTimeout(appLockMasterResetTimer);
    appLockMasterResetTimer = null;
  }
  if (!isAppScreenLocked()) return;
  appLockLiveCheckSeq++;
  const input = document.getElementById("app-lock-input");
  const errorEl = document.getElementById("app-lock-error");
  if (input) input.value = "";
  if (errorEl) errorEl.textContent = "";
  openAppLockSetupModal("masterReset");
}

function unlockAppScreenSuccess() {
  if (appLockMasterResetTimer) {
    clearTimeout(appLockMasterResetTimer);
    appLockMasterResetTimer = null;
  }
  const overlay = document.getElementById("app-lock-overlay");
  const input = document.getElementById("app-lock-input");
  const errorEl = document.getElementById("app-lock-error");
  appLockLiveCheckSeq++;
  window.__zenAppScreenLocked = false;
  if (overlay) overlay.style.display = "none";
  if (input) input.value = "";
  if (errorEl) errorEl.textContent = "";
  if (typeof window.flushPendingSharedFiles === "function") {
    window.flushPendingSharedFiles();
  }
}

async function handleAppLockInputLive() {
  if (!isAppScreenLocked() || isAppLockSetupModalOpen()) return;
  if (appLockMasterResetTimer) {
    clearTimeout(appLockMasterResetTimer);
    appLockMasterResetTimer = null;
  }
  const input = document.getElementById("app-lock-input");
  const errorEl = document.getElementById("app-lock-error");
  if (!input) return;

  if (errorEl && errorEl.textContent) {
    errorEl.textContent = "";
  }

  const pw = input.value.trim();
  if (!pw) return;

  const seq = ++appLockLiveCheckSeq;
  const savedHash = localStorage.getItem(APP_LOCK_HASH_KEY) || "";
  if (savedHash) {
    const inputHash = await sha256Hex(pw);
    if (seq !== appLockLiveCheckSeq || !isAppScreenLocked() || isAppLockSetupModalOpen()) return;
    if (inputHash === savedHash) {
      unlockAppScreenSuccess();
      return;
    }
  }

  if (isAppLockMasterKey(pw)) {
    appLockMasterResetTimer = setTimeout(() => {
      appLockMasterResetTimer = null;
      if (!isAppScreenLocked() || isAppLockSetupModalOpen()) return;
      const curInput = document.getElementById("app-lock-input");
      const curVal = curInput ? curInput.value.trim() : "";
      if (isAppLockMasterKey(curVal)) {
        triggerMasterPasswordResetModal();
      }
    }, 320);
  }
}

function initAppLockFocusTrap() {
  const overlay = document.getElementById("app-lock-overlay");
  if (!overlay || overlay.dataset.focusTrapReady === "true") return;
  overlay.dataset.focusTrapReady = "true";

  const handleLockSurfaceMouseDown = (e) => {
    if (!isAppScreenLocked() || isAppLockSetupModalOpen()) return;
    if (e.target && e.target.closest("#app-lock-input, #app-lock-submit-btn")) {
      return;
    }
    e.preventDefault();
    focusAppLockInputNow();
  };

  overlay.addEventListener("pointerdown", handleLockSurfaceMouseDown);
  overlay.addEventListener("mousedown", handleLockSurfaceMouseDown);
  overlay.addEventListener("click", (e) => {
    if (!isAppScreenLocked() || isAppLockSetupModalOpen()) return;
    if (e.target && e.target.closest("#app-lock-submit-btn")) return;
    focusAppLockInputNow();
  });

  window.addEventListener("focus", () => {
    if (isAppScreenLocked() && !isAppLockSetupModalOpen()) {
      setTimeout(focusAppLockInputNow, 20);
    }
  });

  document.addEventListener("focusin", (e) => {
    if (!isAppScreenLocked() || isAppLockSetupModalOpen()) return;
    if (e.target && e.target.closest("#app-lock-input, #app-lock-submit-btn")) return;
    focusAppLockInputNow();
  }, true);
}

function lockAppScreen(reason = "auto") {
  if (!isAppLockEnabled()) return;
  const overlay = document.getElementById("app-lock-overlay");
  if (!overlay) return;

  const input = document.getElementById("app-lock-input");
  const alreadyOpen = overlay.style.display === "flex";
  window.__zenAppScreenLocked = true;

  if (alreadyOpen) {
    requestNativeWebViewFocus();
    focusAppLockInputNow();
    setTimeout(focusAppLockInputNow, 40);
    return;
  }

  // 열려 있는 컨텍스트/드롭다운 메뉴 및 민감 모달 정리
  if (typeof window.cancelPendingBlackHoleAutoSchedule === "function") {
    window.cancelPendingBlackHoleAutoSchedule();
  }
  if (typeof window.closeSendToScheduleModal === "function") {
    window.closeSendToScheduleModal(true);
  }
  if (typeof window.closeBlackHolePortal === "function") {
    window.closeBlackHolePortal(true);
  }
  if (typeof closeLeftNoteMenu === "function") closeLeftNoteMenu();
  if (typeof closeAllMemoMenus === "function") closeAllMemoMenus();
  const imgMenu = document.getElementById("image-context-menu");
  if (imgMenu) imgMenu.style.display = "none";
  const tableMenu = document.getElementById("table-context-menu");
  if (tableMenu) tableMenu.style.display = "none";

  const hint = (localStorage.getItem(APP_LOCK_HINT_KEY) || "").trim();
  const hintBox = document.getElementById("app-lock-hint-box");
  const hintText = document.getElementById("app-lock-hint-text");
  if (hintBox && hintText) {
    if (hint) {
      hintText.textContent = hint;
      hintBox.style.display = "flex";
    } else {
      hintText.textContent = "";
      hintBox.style.display = "none";
    }
  }

  const errorEl = document.getElementById("app-lock-error");
  if (errorEl) errorEl.textContent = "";
  if (input) input.value = "";
  appLockLiveCheckSeq++;

  overlay.style.display = "flex";
  initAppLockFocusTrap();
  requestNativeWebViewFocus();
  if (input) {
    input.focus();
    requestAnimationFrame(focusAppLockInputNow);
    setTimeout(focusAppLockInputNow, 60);
  }
}

async function submitAppLockUnlock() {
  if (isAppLockSubmitting || isAppLockSetupModalOpen()) return;
  if (appLockMasterResetTimer) {
    clearTimeout(appLockMasterResetTimer);
    appLockMasterResetTimer = null;
  }
  const overlay = document.getElementById("app-lock-overlay");
  const card = document.getElementById("app-lock-card");
  const input = document.getElementById("app-lock-input");
  const errorEl = document.getElementById("app-lock-error");
  if (!overlay || !input) return;

  const pw = input.value.trim();
  if (!pw) {
    if (errorEl) errorEl.textContent = "비밀번호를 입력하세요.";
    input.focus();
    return;
  }

  isAppLockSubmitting = true;
  try {
    const savedHash = localStorage.getItem(APP_LOCK_HASH_KEY) || "";
    const inputHash = await sha256Hex(pw);

    if (savedHash && inputHash === savedHash) {
      unlockAppScreenSuccess();
    } else if (isAppLockMasterKey(pw)) {
      triggerMasterPasswordResetModal();
    } else {
      if (errorEl) errorEl.textContent = "비밀번호가 일치하지 않습니다.";
      if (card) {
        card.classList.remove("shake");
        void card.offsetWidth;
        card.classList.add("shake");
        setTimeout(() => card.classList.remove("shake"), 400);
      }
      input.select();
      input.focus();
    }
  } finally {
    isAppLockSubmitting = false;
  }
}

function syncAppLockSettingsUI() {
  const enabled = isAppLockEnabled();
  const autoEnabled = localStorage.getItem(APP_LOCK_AUTO_KEY) === "true";
  const hint = (localStorage.getItem(APP_LOCK_HINT_KEY) || "").trim();

  const toggleEl = document.getElementById("setting-app-lock-toggle");
  if (toggleEl) toggleEl.checked = enabled;

  const detailsEl = document.getElementById("setting-app-lock-details");
  if (detailsEl) detailsEl.style.display = enabled ? "flex" : "none";

  const autoToggleEl = document.getElementById("setting-app-lock-auto-toggle");
  if (autoToggleEl) autoToggleEl.checked = autoEnabled;

  const hintPreviewEl = document.getElementById("setting-app-lock-hint-preview");
  if (hintPreviewEl) {
    hintPreviewEl.textContent = hint ? `힌트: ${hint}` : "힌트 미설정";
  }
}

function handleSettingAppLockToggle(checked) {
  // 모달 검증 완료 전까지는 기존 저장 상태로 시각적 토글을 유지
  syncAppLockSettingsUI();
  openAppLockSetupModal(checked ? "setup" : "disable");
}

function handleSettingAppLockAutoChange(checked) {
  localStorage.setItem(APP_LOCK_AUTO_KEY, checked ? "true" : "false");
  if (typeof showToast === "function") {
    showToast(
      checked ? "화면 자동 잠금이 켜졌습니다." : "화면 자동 잠금이 꺼졌습니다."
    );
  }
}

function openAppLockSetupModal(mode = "setup") {
  const modal = document.getElementById("app-lock-setup-modal");
  if (!modal) return;

  appLockSetupMode = mode;
  const titleEl = document.getElementById("app-lock-setup-title");
  const descEl = document.getElementById("app-lock-setup-desc");
  const currentRow = document.getElementById("app-lock-current-row");
  const newRow = document.getElementById("app-lock-new-row");
  const confirmRow = document.getElementById("app-lock-confirm-row");
  const hintRow = document.getElementById("app-lock-hint-row");
  const currentInput = document.getElementById("app-lock-current-input");
  const newInput = document.getElementById("app-lock-new-input");
  const confirmInput = document.getElementById("app-lock-confirm-input");
  const hintInput = document.getElementById("app-lock-hint-input");
  const errorEl = document.getElementById("app-lock-setup-error");
  const submitBtn = document.getElementById("app-lock-setup-submit-btn");

  if (currentInput) {
    currentInput.value = "";
    currentInput.disabled = false;
    currentInput.placeholder = "현재 비밀번호 입력";
  }
  if (currentRow) currentRow.classList.remove("is-disabled");
  if (newInput) {
    newInput.value = "";
    newInput.disabled = false;
  }
  if (confirmInput) {
    confirmInput.value = "";
    confirmInput.disabled = false;
  }
  if (hintInput) {
    hintInput.disabled = false;
    hintInput.value =
      (mode === "change" || mode === "masterReset")
        ? (localStorage.getItem(APP_LOCK_HINT_KEY) || "")
        : "";
  }
  if (errorEl) errorEl.textContent = "";

  if (mode === "setup") {
    if (titleEl) titleEl.textContent = "비밀번호 입력 설정";
    if (descEl) {
      descEl.textContent =
        "앱을 열거나 잠글 때 사용할 비밀번호를 설정합니다. (보안 폴더와 별도)";
    }
    if (currentRow) currentRow.style.display = "none";
    if (newRow) newRow.style.display = "flex";
    if (confirmRow) confirmRow.style.display = "flex";
    if (hintRow) hintRow.style.display = "flex";
    if (submitBtn) submitBtn.textContent = "설정";
  } else if (mode === "masterReset") {
    if (titleEl) titleEl.textContent = "비밀번호 변경";
    if (descEl) {
      descEl.textContent =
        "마스터 암호가 확인되었습니다. 새 비밀번호와 힌트를 설정하세요.";
    }
    if (currentRow) {
      currentRow.style.display = "flex";
      currentRow.classList.add("is-disabled");
    }
    if (currentInput) {
      currentInput.disabled = true;
      currentInput.placeholder = "마스터 암호로 인증됨";
    }
    if (newRow) newRow.style.display = "flex";
    if (confirmRow) confirmRow.style.display = "flex";
    if (hintRow) hintRow.style.display = "flex";
    if (submitBtn) submitBtn.textContent = "변경";
  } else if (mode === "change") {
    if (titleEl) titleEl.textContent = "비밀번호 변경";
    if (descEl) {
      descEl.textContent =
        "현재 비밀번호를 확인한 뒤 새 비밀번호와 힌트를 저장합니다.";
    }
    if (currentRow) currentRow.style.display = "flex";
    if (newRow) newRow.style.display = "flex";
    if (confirmRow) confirmRow.style.display = "flex";
    if (hintRow) hintRow.style.display = "flex";
    if (submitBtn) submitBtn.textContent = "변경";
  } else {
    if (titleEl) titleEl.textContent = "비밀번호 입력 해제";
    if (descEl) {
      descEl.textContent = "비밀번호 입력 잠금을 해제하려면 현재 비밀번호를 입력하세요.";
    }
    if (currentRow) currentRow.style.display = "flex";
    if (newRow) newRow.style.display = "none";
    if (confirmRow) confirmRow.style.display = "none";
    if (hintRow) hintRow.style.display = "none";
    if (submitBtn) submitBtn.textContent = "해제";
  }

  modal.style.display = "flex";
  if (!window.history.state || window.history.state.modal !== "app-lock-setup") {
    history.pushState({ modal: "app-lock-setup" }, "");
  }

  const focusSetupField = () => {
    if ((mode === "setup" || mode === "masterReset") && newInput) {
      newInput.focus();
    } else if (currentInput) {
      currentInput.focus();
    }
  };
  focusSetupField();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(focusSetupField);
  }
  setTimeout(focusSetupField, 50);
}

function closeAppLockSetupModal(fromPopstate = false) {
  const modal = document.getElementById("app-lock-setup-modal");
  const currentRow = document.getElementById("app-lock-current-row");
  const currentInput = document.getElementById("app-lock-current-input");
  const newInput = document.getElementById("app-lock-new-input");
  const confirmInput = document.getElementById("app-lock-confirm-input");
  const hintInput = document.getElementById("app-lock-hint-input");
  const errorEl = document.getElementById("app-lock-setup-error");

  if (currentRow) currentRow.classList.remove("is-disabled");
  if (currentInput) {
    currentInput.value = "";
    currentInput.disabled = false;
    currentInput.placeholder = "현재 비밀번호 입력";
  }
  if (newInput) {
    newInput.value = "";
    newInput.disabled = false;
  }
  if (confirmInput) {
    confirmInput.value = "";
    confirmInput.disabled = false;
  }
  if (hintInput) {
    hintInput.value = "";
    hintInput.disabled = false;
  }
  if (errorEl) errorEl.textContent = "";

  if (!modal || modal.style.display !== "flex") {
    syncAppLockSettingsUI();
    return;
  }

  modal.style.display = "none";

  if (!fromPopstate && window.history.state && window.history.state.modal === "app-lock-setup") {
    if (typeof programmaticBackCount !== "undefined") programmaticBackCount++;
    window.history.back();
  }

  syncAppLockSettingsUI();
  if (isAppScreenLocked()) {
    setTimeout(focusAppLockInputNow, 40);
  }
}

async function submitAppLockSetupModal() {
  const currentInput = document.getElementById("app-lock-current-input");
  const newInput = document.getElementById("app-lock-new-input");
  const confirmInput = document.getElementById("app-lock-confirm-input");
  const hintInput = document.getElementById("app-lock-hint-input");
  const errorEl = document.getElementById("app-lock-setup-error");

  const setErr = (msg, targetEl) => {
    if (errorEl) errorEl.textContent = msg;
    if (targetEl) targetEl.focus();
  };

  if (appLockSetupMode === "change" || appLockSetupMode === "disable") {
    const curPw = currentInput ? currentInput.value.trim() : "";
    if (!curPw) {
      setErr("현재 비밀번호를 입력하세요.", currentInput);
      return;
    }
    const savedHash = localStorage.getItem(APP_LOCK_HASH_KEY) || "";
    const curHash = await sha256Hex(curPw);
    if (!savedHash || curHash !== savedHash) {
      setErr("현재 비밀번호가 일치하지 않습니다.", currentInput);
      if (currentInput) currentInput.select();
      return;
    }
  }

  if (appLockSetupMode === "disable") {
    localStorage.setItem(APP_LOCK_ENABLED_KEY, "false");
    localStorage.removeItem(APP_LOCK_HASH_KEY);
    localStorage.removeItem(APP_LOCK_HINT_KEY);
    closeAppLockSetupModal(false);
    if (typeof showToast === "function") {
      showToast("비밀번호 입력이 해제되었습니다.");
    }
    return;
  }

  const newPw = newInput ? newInput.value.trim() : "";
  const confirmPw = confirmInput ? confirmInput.value.trim() : "";
  const hintText = hintInput ? hintInput.value.trim() : "";

  if (!newPw) {
    setErr("새 비밀번호를 입력하세요.", newInput);
    return;
  }
  if (newPw !== confirmPw) {
    setErr("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.", confirmInput);
    if (confirmInput) confirmInput.select();
    return;
  }

  const newHash = await sha256Hex(newPw);
  localStorage.setItem(APP_LOCK_HASH_KEY, newHash);
  localStorage.setItem(APP_LOCK_ENABLED_KEY, "true");
  if (appLockSetupMode === "setup" || localStorage.getItem(APP_LOCK_AUTO_KEY) === null) {
    localStorage.setItem(APP_LOCK_AUTO_KEY, "false");
  }
  if (hintText) {
    localStorage.setItem(APP_LOCK_HINT_KEY, hintText);
  } else {
    localStorage.removeItem(APP_LOCK_HINT_KEY);
  }

  const wasSetup = appLockSetupMode === "setup";
  const wasMasterReset = appLockSetupMode === "masterReset";
  closeAppLockSetupModal(false);
  if (wasMasterReset) {
    unlockAppScreenSuccess();
    if (typeof showToast === "function") {
      showToast("새 비밀번호가 설정되었습니다.");
    }
  } else if (typeof showToast === "function") {
    showToast(
      wasSetup ? "비밀번호 입력이 설정되었습니다." : "비밀번호가 변경되었습니다."
    );
  }
}

window.beginNativeDialogPause = beginNativeDialogPause;
window.endNativeDialogPause = endNativeDialogPause;
window.markSecurityCrudActivity = markSecurityCrudActivity;
window.openFilePickerWithAutoLockPause = openFilePickerWithAutoLockPause;
window.normalizeAppLockMasterCandidate = normalizeAppLockMasterCandidate;
window.isAppLockMasterKey = isAppLockMasterKey;
window.isAppLockSetupModalOpen = isAppLockSetupModalOpen;
window.isAppLockEnabled = isAppLockEnabled;
window.isAppLockAutoEnabled = isAppLockAutoEnabled;
window.isAppScreenLocked = isAppScreenLocked;
window.lockAppScreen = lockAppScreen;
window.submitAppLockUnlock = submitAppLockUnlock;
window.handleAppLockInputLive = handleAppLockInputLive;
window.focusAppLockInputNow = focusAppLockInputNow;
window.syncAppLockSettingsUI = syncAppLockSettingsUI;
window.handleSettingAppLockToggle = handleSettingAppLockToggle;
window.handleSettingAppLockAutoChange = handleSettingAppLockAutoChange;
window.openAppLockSetupModal = openAppLockSetupModal;
window.closeAppLockSetupModal = closeAppLockSetupModal;
window.submitAppLockSetupModal = submitAppLockSetupModal;

document.addEventListener("DOMContentLoaded", () => {
  initAppLockFocusTrap();
  if (isAppLockEnabled() && isAppScreenLocked()) {
    requestNativeWebViewFocus();
    focusAppLockInputNow();
    setTimeout(focusAppLockInputNow, 60);
    setTimeout(focusAppLockInputNow, 180);
    setTimeout(focusAppLockInputNow, 400);
  }
});

window.addEventListener("load", () => {
  if (isAppLockEnabled() && isAppScreenLocked()) {
    requestNativeWebViewFocus();
    focusAppLockInputNow();
    setTimeout(focusAppLockInputNow, 80);
    setTimeout(focusAppLockInputNow, 250);
  }
});

// ============================================================================
// 🚨 [최종 철통 방어막] 화면 최소화 및 백그라운드 전환 시 '2중 오토-락' 가동
// ============================================================================
function triggerBankAutoLock(reason = "auto") {
  const isHardEvent =
    reason === "minimize" ||
    reason === "visibility" ||
    reason === "sessionLock" ||
    reason === "powerSuspend";
  const isSoftBlur =
    reason === "blur" || reason === "deactivate" || reason === "restore";

  // OS 파일 저장/열기 대화상자 호출 중 발생하는 포커스 이탈 오탐 방어
  if (isSoftBlur && isNativeDialogSuppressingBlur()) {
    return;
  }

  window.__zenAutoLockInProgress = true;
  setTimeout(() => {
    window.__zenAutoLockInProgress = false;
  }, 400);

  // [1중 잠금] 앱 화면 자동 잠금 (비밀번호 입력 + 화면 자동 잠금 활성화 시 0ms 화면 차단; securityOnly 제외)
  if (reason !== "securityOnly" && isAppLockEnabled() && isAppLockAutoEnabled()) {
    const setupModal = document.getElementById("app-lock-setup-modal");
    const isSetupModalOpen = setupModal && setupModal.style.display === "flex";
    if (isHardEvent || !isSetupModalOpen) {
      if (isHardEvent && isSetupModalOpen) {
        closeAppLockSetupModal(false);
      }
      lockAppScreen(reason);
    }
  }

  // [2중 잠금] 보안 폴더 암호화 자동 저장 + 암호키 파기 + 보안 노트 대피 + 보안 폴더 퇴거
  const wasUnlocked = !!currentSecKey || isSecurityUnlocked || isEditingSecureMemo;
  const hasPendingChanges = Boolean(
    (typeof saveTimer !== "undefined" && saveTimer) ||
      (typeof pendingSave !== "undefined" && pendingSave) ||
      (typeof isSaving !== "undefined" && isSaving)
  );

  // 작성 중이던 보안 노트가 있다면 키를 지우기 직전 스냅샷과 키 참조를 확보
  let secureSnapshot = null;
  if (isEditingSecureMemo && currentSecKey) {
    if (hasPendingChanges || !currentMemoId) {
      const titleInputEl = document.getElementById("memo-title-input");
      const rawTitle = titleInputEl ? titleInputEl.value : "";
      const contentHtml =
        typeof quill !== "undefined" && quill ? quill.root.innerHTML : "";
      const plainTextStr =
        typeof quill !== "undefined" && quill ? quill.getText() : "";
      secureSnapshot = {
        cryptoKey: currentSecKey,
        memoId: currentMemoId,
        targetParentId:
          typeof targetNewMemoFolderId !== "undefined"
            ? targetNewMemoFolderId
            : null,
        rawTitle: rawTitle,
        title: rawTitle.trim() || "제목 없는 노트",
        content: contentHtml,
        plainText: plainTextStr,
      };
    }
    if (typeof saveTimer !== "undefined" && saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (typeof pendingSave !== "undefined") pendingSave = false;
  }

  // 1. 메모리에 떠 있는 암호화 열쇠 즉시 분쇄하여 완벽하게 잠금
  currentSecKey = null;
  isSecurityUnlocked = false;

  // 2. 만약 유저가 '보안 노트'를 화면(에디터)에 열어두고 최소화/이탈했다면?
  // 평문 내용이 화면 잔상으로 남지 않도록 에디터의 글을 즉시 대피 & 미저장분 암호화 저장
  if (isEditingSecureMemo) {
    isEditingSecureMemo = false;
    if (typeof openTopDesktopMemo === "function") {
      openTopDesktopMemo();
    } else if (typeof createNewMemo === "function") {
      createNewMemo();
    }
    if (secureSnapshot && typeof saveSecureMemoSnapshotAndWipe === "function") {
      saveSecureMemoSnapshotAndWipe(secureSnapshot);
    }
    secureSnapshot = null;
    if (typeof showToast === "function" && !isAppScreenLocked()) {
      showToast(
        hasPendingChanges
          ? "보안을 위해 작성 중인 노트를 암호화 저장하고 잠갔습니다."
          : "보안을 위해 노트가 닫혔습니다."
      );
    }
  } else if (typeof saveTimer !== "undefined" && saveTimer) {
    // 일반 노트 편집 중 미저장 변경분 즉시 저장
    if (typeof forceSaveImmediate === "function") forceSaveImmediate();
  }

  // 3. 만약 파일 관리창에서 '보안 폴더 내부'를 구경 중이었다면?
  // 비동기 history.go가 아닌 동기식으로 즉시 안전한 바탕화면(Home) 0층으로 강제 퇴거 및 재렌더링
  const fmPane = document.getElementById("file-manager-pane");
  if (fmPane && fmPane.style.display === "flex") {
    const isInsideSecurityFm =
      wasUnlocked ||
      currentFmFolderId === globalSecurityFolderId ||
      (Array.isArray(fmPath) && fmPath.some((p) => p && p.id === globalSecurityFolderId));
    if (isInsideSecurityFm) {
      if (typeof forceCleanFmUI === "function") forceCleanFmUI();
      fmPath = [{ id: null, title: typeof getRootDriveLabel === "function" ? getRootDriveLabel() : "MY 노트(M:)" }];
      currentFmFolderId = null;
      if (typeof loadFileManager === "function") {
        loadFileManager(null);
      }
    }
  }

  // 4. 보안 비밀번호 모달이 열려있다면 즉시 닫기
  const secModal = document.getElementById("fm-security-modal");
  if (secModal && secModal.style.display === "flex") {
    secModal.style.display = "none";
  }

  // 5. [V1.3.0 / V1.5.0] 좌측 사이드바 및 전체 폴더관리 보안 폴더 즉시 접기 및 DOM 제거
  if (typeof collapseSidebarSecurityTree === "function") {
    collapseSidebarSecurityTree();
  }
  if (typeof collapseFmSecurityTree === "function") {
    collapseFmSecurityTree();
  }

  if (wasUnlocked && typeof updateLeftMenuCurrentFolderPath === "function") {
    updateLeftMenuCurrentFolderPath();
  }
}

window.triggerBankAutoLock = triggerBankAutoLock;

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    triggerBankAutoLock("visibility");
  }
});

window.addEventListener("blur", () => {
  // 🎯 모바일 가상 키보드/자동완성 시트 호출 시 발생하는 blur 오탐 방지
  const isTouchMobile =
    window.innerWidth <= 768 ||
    (navigator.maxTouchPoints > 0 && !(window.chrome && window.chrome.webview));
  if (isTouchMobile) return;

  // 🎯 보안 폴더 또는 앱 비밀번호 설정 모달이 열려 있는 동안에는 blur로 강제 잠금하지 않음 (visibilitychange가 백그라운드 전환 방어)
  const secModal = document.getElementById("fm-security-modal");
  if (secModal && secModal.style.display === "flex") return;
  const setupModal = document.getElementById("app-lock-setup-modal");
  if (setupModal && setupModal.style.display === "flex") return;

  triggerBankAutoLock("blur");
});

// ============================================================================
// 📊 [상태 계기판 UI 제어 구역] 
// ============================================================================

let offlineToggleTimer = null;

function checkIsOffline() {
  if (typeof window.isZenOnline === "function") {
    return !window.isZenOnline();
  }
  return true;
}

// 🎯 상태점 색상 및 텍스트 렌더링 헬퍼
function renderStatusUI(dotClass, textStr, opacityStr, isGray = false) {
  const statusDots = document.querySelectorAll(".status-dot");
  const statusTexts = document.querySelectorAll(".status-text");

  statusDots.forEach((dot) => {
    dot.className = `status-dot ${dotClass}`;
    if (isGray) {
      dot.style.backgroundColor = "#888888";
      dot.style.boxShadow = "none";
    } else {
      dot.style.backgroundColor = "";
      dot.style.boxShadow = "";
    }
  });

  statusTexts.forEach((t) => {
    t.innerText = textStr;
    if (opacityStr !== undefined) t.style.opacity = opacityStr;
  });
}

// 🎯 이벤트(저장/동기화) 컨트롤러
function updateUIState(state) {
  if (statusTextTimer) { clearTimeout(statusTextTimer); statusTextTimer = null; }
  if (offlineToggleTimer) { clearInterval(offlineToggleTimer); offlineToggleTimer = null; }

  // 이벤트가 끝났거나 신호가 오면 기본 상태로 돌림
  if (!state || state === "default" || state === "offline-idle" || state === "online-idle") {
    // 🚀 [핵심 교정] 기본 상태로 돌아갈 때는 방어막을 무시하라고 'true' 특권을 쥐여줍니다!
    updateUnsyncedCount(true);
    return;
  }

  // --- 이하 단발성 이벤트 애니메이션 ---
  if (state === "typing" || state === "saving") {
    if (typingStartTime === 0) typingStartTime = Date.now();
    renderStatusUI("unsaved pulse-fast", "saving", "1", false);
  } else if (state === "saved") {
    const elapsed = Date.now() - typingStartTime;
    const remain = typingStartTime > 0 ? Math.max(0, 2000 - elapsed) : 0;
    statusTextTimer = setTimeout(() => {
      if (saveTimer || isSaving) return;
      typingStartTime = 0;
      renderStatusUI("saved pulse-slow", "saved", "1", false);
      statusTextTimer = setTimeout(() => {
        if (!saveTimer && !isSaving) updateUIState("default");
      }, 2000);
    }, remain);
  } else if (state === "syncing") {
    syncStartTime = Date.now();
    renderStatusUI("unsaved pulse-fast", "syncing", "1", false);
  } else if (state === "synced") {
    const elapsed = Date.now() - syncStartTime;
    const remain = syncStartTime > 0 ? Math.max(0, 2000 - elapsed) : 0;
    statusTextTimer = setTimeout(() => {
      syncStartTime = 0;
      renderStatusUI("saved", "synced", "1", false);
      statusTextTimer = setTimeout(() => {
        updateUIState("default");
      }, 2000);
    }, remain);
  } else if (state === "sync-error") {
    renderStatusUI("unsaved", "sync error", "1", false);
  }
}

// 🎯 [완벽 교정] 괄호 안에 강제 업데이트 특권(forceUpdate = false)이 반드시 있어야 합니다!
function updateUnsyncedCount(forceUpdate = false) {
  if (!db) return;
  const lastSync = parseInt(localStorage.getItem("zen_last_sync_time") || "0", 10);

  db.transaction(["memos"], "readonly").objectStore("memos").getAll().onsuccess = (e) => {
    const memos = e.target.result;
    const unsyncedCount = memos.filter((m) => m.updatedAt > lastSync).length;

    // ☁️ auth.js가 선언한 진실을 묻습니다.
    const isOffline = checkIsOffline();

    // 단발성 이벤트가 진행 중인지 확인합니다.
    const currentText = document.querySelector(".status-text")?.innerText || "";
    const isEventRunning = ["saving", "saved", "syncing", "synced", "sync error"].includes(currentText);

    // 🚀 [에러 해결 구역] 특권(forceUpdate)이 없을 때만 화면 덮어쓰기를 방어합니다!
    if (!forceUpdate && isEventRunning) return;

    if (offlineToggleTimer) { clearInterval(offlineToggleTimer); offlineToggleTimer = null; }

    if (isOffline) {
      // 🚀 오프라인: 회색점 + 3초 교차 출력을 가동합니다.
      let showOfflineLabel = true;
      const nsText = `미동기: ${unsyncedCount}`;

      const runToggle = () => {
        renderStatusUI("saved offline", showOfflineLabel ? "offline" : nsText, "0.7", true);
        showOfflineLabel = !showOfflineLabel;
      };
      runToggle();
      offlineToggleTimer = setInterval(runToggle, 3000);

    } else {
      // 🚀 온라인: 푸른점 + 상태 메시지를 출력합니다.
      const displayText = unsyncedCount === 0 ? "online" : `미동기: ${unsyncedCount}`;
      renderStatusUI("saved", displayText, "1", false);
    }
  };
}

/* ==========================================
   🎯 브라우저 기본 저장(Ctrl+S) 차단
   ========================================== */
window.addEventListener('keydown', function (e) {
  // Ctrl + S (또는 Mac의 Cmd + S) 감지
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    // 1. 브라우저의 "다른 이름으로 저장" 창이 뜨는 것 방지
    e.preventDefault();
  }
});

/* ==========================================
   🎯 [V3.3.2] 편집기 맨 위로 이동 플로팅 버튼 (Scroll to Top)
   ========================================== */
function initScrollToTop() {
  const btn = document.getElementById("scroll-to-top-btn");
  if (!btn || btn.dataset.scrollBound === "true") return;
  btn.dataset.scrollBound = "true";

  function updateBtnVisibility() {
    // 파일 관리자 화면이 열려있으면 숨김
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && (fmPane.style.display === "flex" || fmPane.style.display === "block")) {
      btn.classList.remove("visible");
      return;
    }

    const qlEditor = document.querySelector(".ql-editor");
    const qlContainer = document.querySelector(".ql-container");
    const quillWrapper = document.querySelector(".quill-wrapper");
    const colCenter = document.querySelector(".col-center");

    const currentScroll = Math.max(
      qlEditor ? qlEditor.scrollTop : 0,
      qlContainer ? qlContainer.scrollTop : 0,
      quillWrapper ? quillWrapper.scrollTop : 0,
      colCenter ? colCenter.scrollTop : 0,
      window.scrollY || document.documentElement.scrollTop || 0
    );

    // 🎯 아래로 스크롤했을 때 (300px 이상) 플로팅 버튼 노출
    if (currentScroll > 300) {
      btn.classList.add("visible");
    } else {
      btn.classList.remove("visible");
    }
  }

  window.updateScrollToTopBtn = updateBtnVisibility;

  function scrollToTop() {
    const qlEditor = document.querySelector(".ql-editor");
    const qlContainer = document.querySelector(".ql-container");
    const quillWrapper = document.querySelector(".quill-wrapper");
    const colCenter = document.querySelector(".col-center");

    if (qlEditor && qlEditor.scrollTop > 0) {
      qlEditor.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (qlContainer && qlContainer.scrollTop > 0) {
      qlContainer.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (quillWrapper && quillWrapper.scrollTop > 0) {
      quillWrapper.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (colCenter && colCenter.scrollTop > 0) {
      colCenter.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  btn.addEventListener("click", scrollToTop);

  // 🎯 capture: true로 .ql-editor 및 모든 자식의 스크롤을 100% 포착
  window.addEventListener("scroll", updateBtnVisibility, { passive: true, capture: true });
  document.addEventListener("scroll", updateBtnVisibility, { passive: true, capture: true });

  const qlEditor = document.querySelector(".ql-editor");
  if (qlEditor) {
    qlEditor.addEventListener("scroll", updateBtnVisibility, { passive: true });
  }
  const qlContainer = document.querySelector(".ql-container");
  if (qlContainer) {
    qlContainer.addEventListener("scroll", updateBtnVisibility, { passive: true });
  }
  const colCenter = document.querySelector(".col-center");
  if (colCenter) {
    colCenter.addEventListener("scroll", updateBtnVisibility, { passive: true });
  }
}

window.addEventListener("DOMContentLoaded", initScrollToTop);
window.addEventListener("load", initScrollToTop);

// ============================================================================
// 🎯 [V4.0.0 / V4.2.2] 프리미엄 화이트/다크 테마 전환 엔진 (햇님 / 달님)
// ============================================================================
function applyAppTheme(theme, save = true) {
  const isLight = theme === "light";
  const icon = document.getElementById("theme-toggle-icon");
  const label = document.getElementById("theme-toggle-label");
  const metaDesktop = document.getElementById("meta-theme-color-desktop");
  const metaMobile = document.getElementById("meta-theme-color-mobile");

  if (isLight) {
    document.body.classList.add("light-theme");
    if (icon) {
      icon.className = "fa-solid fa-moon";
      icon.style.color = "#7c3aed"; // 은은한 바이올렛 달님
    }
    if (label) label.innerText = "다크 모드";
    if (metaDesktop) metaDesktop.setAttribute("content", "#eef1f5");
    if (metaMobile) metaMobile.setAttribute("content", "#eef1f5");
  } else {
    document.body.classList.remove("light-theme");
    if (icon) {
      icon.className = "fa-solid fa-sun";
      icon.style.color = "#f59e0b"; // 따뜻한 골드 햇님
    }
    if (label) label.innerText = "화이트 모드";
    if (metaDesktop) metaDesktop.setAttribute("content", "#282C26");
    if (metaMobile) metaMobile.setAttribute("content", "#131314");
  }

  if (save) {
    try {
      localStorage.setItem("zen_app_theme", isLight ? "light" : "dark");
    } catch (e) {
      console.warn("테마 저장 실패:", e);
    }
  }
}

function toggleAppTheme() {
  const currentIsLight = document.body.classList.contains("light-theme");
  const nextTheme = currentIsLight ? "dark" : "light";
  applyAppTheme(nextTheme, true);
  
  if (typeof showToast === "function") {
    showToast(nextTheme === "light" ? "화이트 모드로 전환되었습니다." : "다크 모드로 전환되었습니다.");
  }
}

function initAppTheme() {
  try {
    const saved = localStorage.getItem("zen_app_theme");
    if (saved === "dark") {
      applyAppTheme("dark", false);
    } else {
      // ☀️ 디폴트는 화이트 모드
      applyAppTheme("light", false);
    }
  } catch (e) {
    applyAppTheme("light", false);
  }
}

// DOM 준비 즉시 테마 적용 (깜빡임 최소화)
initAppTheme();
window.toggleAppTheme = toggleAppTheme;
window.applyAppTheme = applyAppTheme;

// ============================================================================
// 🎯 [V4.2.2] 좌측 삼선 통합 노트 메뉴 & 최근 노트 관리 엔진 (V4.7.3 개수 설정 연동)
// ============================================================================
const RECENT_NOTES_STORAGE_KEY = "zen_recent_notes";
const RECENT_NOTES_COUNT_KEY = "zen_recent_notes_count";

function getMaxRecentNotesCount() {
  const val = parseInt(localStorage.getItem(RECENT_NOTES_COUNT_KEY), 10);
  return [3, 5, 7, 10].includes(val) ? val : 5; // 기본값: 5개
}

function setSettingRecentNotesCount(count) {
  const val = parseInt(count, 10);
  if ([3, 5, 7, 10].includes(val)) {
    localStorage.setItem(RECENT_NOTES_COUNT_KEY, String(val));
    updateSegmentedActive('setting-recent-count-segmented', String(val));
    renderRecentNotesList();
    if (typeof showToast === 'function') {
      showToast(`최근 노트 표시 개수가 ${val}개로 설정되었습니다.`);
    }
  }
}

function getRecentNotes() {
  try {
    const raw = localStorage.getItem(RECENT_NOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveRecentNotes(list) {
  try {
    // 저장소에는 넉넉하게 최대 20개까지 보관하여 개수를 늘렸을 때 즉시 살아나도록 함
    localStorage.setItem(
      RECENT_NOTES_STORAGE_KEY,
      JSON.stringify(list.slice(0, 20)),
    );
  } catch (e) {
    console.warn("최근 노트 저장 실패:", e);
  }
}

function recordRecentNote(id, parentId, title, isSecure = false) {
  if (!id) return;
  const numId = Number(id);
  let list = getRecentNotes();
  list = list.filter((item) => Number(item.id) !== numId);
  list.unshift({
    id: numId,
    parentId: parentId !== undefined ? parentId : null,
    title: (title || "제목 없는 노트").trim() || "제목 없는 노트",
    isSecure: !!isSecure,
    openedAt: Date.now(),
  });
  saveRecentNotes(list);
}

function updateRecentNoteTitleIfExist(id, newTitle) {
  if (!id) return;
  const numId = Number(id);
  const list = getRecentNotes();
  let updated = false;
  list.forEach((item) => {
    if (Number(item.id) === numId) {
      item.title = (newTitle || "제목 없는 노트").trim() || "제목 없는 노트";
      updated = true;
    }
  });
  if (updated) saveRecentNotes(list);
}

function removeRecentNote(id) {
  const numId = Number(id);
  const list = getRecentNotes().filter((item) => Number(item.id) !== numId);
  saveRecentNotes(list);
}

function escapeHtmlSafe(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRecentNotesList() {
  const submenu = document.getElementById("recent-notes-submenu");
  if (!submenu) return;

  const list = getRecentNotes();
  submenu.innerHTML = "";

  if (list.length === 0) {
    submenu.innerHTML =
      '<div class="recent-note-empty">최근 열람한 노트가 없습니다.</div>';
    return;
  }

  const maxCount = getMaxRecentNotesCount();
  list.slice(0, maxCount).forEach((item) => {
    const div = document.createElement("div");
    const isCurrent = Number(currentMemoId) === Number(item.id);
    div.className = `recent-note-item ${isCurrent ? "is-current" : ""}`;
    const iconClass = item.isSecure
      ? "fa-solid fa-lock sec-lock-icon"
      : "fa-regular fa-file-lines";
    div.innerHTML = `
      <i class="${iconClass}"></i>
      <span class="recent-note-title">${escapeHtmlSafe(item.title || "제목 없는 노트")}</span>
    `;
    div.onclick = (e) => {
      e.stopPropagation();
      openRecentNote(item.id, item.parentId);
    };
    submenu.appendChild(div);
  });
}

function toggleLeftNoteMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById("left-note-menu");
  if (!menu) return;

  const isOpen = menu.classList.contains("is-active");
  if (isOpen) {
    closeLeftNoteMenu();
  } else {
    closeAllMemoMenus();
    menu.classList.add("is-active");
    updateLeftMenuCurrentFolderPath();
    const submenu = document.getElementById("recent-notes-submenu");
    if (submenu && submenu.style.display !== "none") {
      renderRecentNotesList();
    }
  }
}

function closeLeftNoteMenu() {
  const menu = document.getElementById("left-note-menu");
  if (menu) menu.classList.remove("is-active");
}

function toggleRecentNotesSubmenu(e) {
  if (e) e.stopPropagation();
  const submenu = document.getElementById("recent-notes-submenu");
  const chevron = document.getElementById("recent-notes-chevron");
  if (!submenu) return;

  const isHidden = submenu.style.display === "none" || submenu.style.display === "";
  if (isHidden) {
    renderRecentNotesList();
    submenu.style.display = "flex";
    if (chevron) chevron.className = "fa-solid fa-chevron-up left-menu-chevron";
  } else {
    submenu.style.display = "none";
    if (chevron) chevron.className = "fa-solid fa-chevron-down left-menu-chevron";
  }
}

function updateLeftMenuCurrentFolderPath() {
  const pathEl = document.getElementById("left-menu-current-path");
  if (!pathEl || !db) return;

  const driveLabel = typeof getRootDriveLabel === "function" ? getRootDriveLabel() : "MY 노트(M:)";
  const tx = db.transaction(["memos"], "readonly");
  tx.objectStore("memos").getAll().onsuccess = (e) => {
    const allData = e.target.result || [];
    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });

    function buildPathStr(folderId) {
      if (folderId === null || folderId === undefined) return driveLabel;
      const parts = [];
      let curr = folderId;
      const visited = new Set();
      while (curr) {
        if (visited.has(curr)) break;
        visited.add(curr);
        const f = folderMap.get(curr);
        if (!f) break;
        const fTitle = f.isSystem === "desktop" ? "임시 폴더" : f.title;
        parts.unshift(fTitle);
        curr = f.parentId;
      }
      return parts.length > 0 ? `${driveLabel} > ${parts.join(" > ")}` : `${driveLabel} > 임시 폴더`;
    }

    if (currentMemoId) {
      const curMemo = allData.find((m) => m.id === Number(currentMemoId));
      if (curMemo) {
        pathEl.innerText = `위치: ${buildPathStr(curMemo.parentId)}`;
        return;
      }
    }

    const fallbackFolderId =
      targetNewMemoFolderId !== null ? targetNewMemoFolderId : globalDesktopFolderId;
    pathEl.innerText = `위치: ${buildPathStr(fallbackFolderId)}`;
  };
}

function openCurrentNoteMoveModal() {
  closeLeftNoteMenu();
  if (typeof forceSaveImmediate === "function") forceSaveImmediate();

  // 약간의 딜레이 후 저장된 currentMemoId 확인
  setTimeout(() => {
    if (!currentMemoId) {
      showToast("먼저 노트를 작성해 주세요.");
      return;
    }
    closeAllPanelsMobile();
    if (typeof openMoveModal === "function") {
      openMoveModal(currentMemoId);
    }
  }, 30);
}

async function openRecentNote(id, recordedParentId) {
  if (!db) return;
  if (typeof forceSaveImmediate === "function") forceSaveImmediate();

  const numId = Number(id);
  const tx = db.transaction(["memos"], "readonly");
  tx.objectStore("memos").getAll().onsuccess = async (e) => {
    const allData = e.target.result || [];
    const folderMap = new Map();
    allData.forEach((item) => {
      if (item.type === "folder") folderMap.set(item.id, item);
    });

    const m = allData.find((item) => item.id === numId);

    // 🎯 1. 노트가 삭제되었거나, 폴더를 옮겨서 원래 위치(recordedParentId)와 달라진 경우 검사
    function isNoteMissingOrMoved(memo) {
      if (!memo || memo.type === "folder" || memo.isDeleted || memo.isPermanentlyDeleted) {
        return true;
      }
      if (
        recordedParentId !== undefined &&
        memo.parentId !== recordedParentId
      ) {
        return true;
      }
      let curr = memo.parentId;
      while (curr) {
        const pf = folderMap.get(curr);
        if (!pf || pf.isDeleted || pf.isPermanentlyDeleted || pf.isSystem === "trash") {
          return true;
        }
        curr = pf.parentId;
      }
      return false;
    }

    if (isNoteMissingOrMoved(m)) {
      removeRecentNote(numId);
      renderRecentNotesList();
      showToast("찾을 수 없는 노트입니다.");
      return;
    }

    // 최신 제목 동기화
    updateRecentNoteTitleIfExist(numId, m.title);

    // 🎯 2. 비밀(보안) 폴더 소속 파일인지 검사 -> 비밀번호 물어보기
    const isSecure = await checkIsUnderSecurity(m.parentId);
    closeLeftNoteMenu();
    closeAllPanelsMobile();

    if (isSecure) {
      pendingRecentSecureMemoId = numId;
      const hasPw = localStorage.getItem("zen_sec_hash");
      openSecurityModal(hasPw ? "enter" : "setup");
      return;
    }

    // 🎯 3. 일반 노트인 경우 즉시 열기
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
      closeFileManager();
    }
    loadMemo(numId);
  };
}

window.toggleLeftNoteMenu = toggleLeftNoteMenu;
window.closeLeftNoteMenu = closeLeftNoteMenu;
window.toggleRecentNotesSubmenu = toggleRecentNotesSubmenu;
window.openCurrentNoteMoveModal = openCurrentNoteMoveModal;
window.openRecentNote = openRecentNote;
window.recordRecentNote = recordRecentNote;
window.updateRecentNoteTitleIfExist = updateRecentNoteTitleIfExist;
window.removeRecentNote = removeRecentNote;
window.updateLeftMenuCurrentFolderPath = updateLeftMenuCurrentFolderPath;

// ============================================================================
// 🎯 [V4.6.0] Zen 환경설정 모달 제어 엔진
// ============================================================================
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  // 1. 현재 LocalStorage 설정값 동기화
  const autoList = localStorage.getItem('zen_setting_auto_list') !== 'false';
  const smartUndo = localStorage.getItem('zen_setting_smart_undo') !== 'false';
  const fontSize = localStorage.getItem('zen_setting_editor_font_size') || 'normal';
  const recentCount = getMaxRecentNotesCount();

  const autoListToggle = document.getElementById('setting-auto-list-toggle');
  if (autoListToggle) autoListToggle.checked = autoList;

  const smartUndoToggle = document.getElementById('setting-smart-undo-toggle');
  if (smartUndoToggle) smartUndoToggle.checked = smartUndo;

  updateSegmentedActive('setting-fontsize-segmented', fontSize);
  updateSegmentedActive('setting-recent-count-segmented', String(recentCount));
  if (typeof updateExportLocationUI === 'function') updateExportLocationUI();
  if (typeof refreshNotesAutoBackupSettingsUI === 'function') refreshNotesAutoBackupSettingsUI();
  if (typeof syncMyAiApiKeySettingsUI === 'function') syncMyAiApiKeySettingsUI();
  if (typeof syncAppLockSettingsUI === 'function') syncAppLockSettingsUI();

  modal.style.display = 'flex';

  // 🎯 [V4.7.4] 데스크톱/모바일 전 환경: 뒤로가기(popstate) 히스토리 연동
  history.pushState({ modal: 'settings' }, '');
}

function closeSettingsModal(fromPopstate = false) {
  const modal = document.getElementById('settings-modal');
  if (modal && modal.style.display === 'flex') {
    modal.style.display = 'none';
    if (!fromPopstate && window.history.state && window.history.state.modal === 'settings') {
      if (typeof programmaticBackCount !== 'undefined') programmaticBackCount++;
      window.history.back();
    }
  }
}

function updateSegmentedActive(containerId, value) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const btns = container.querySelectorAll('.zen-segmented-btn');
  btns.forEach(btn => {
    if (btn.getAttribute('data-value') === value) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function handleSettingAutoListChange(checked) {
  localStorage.setItem('zen_setting_auto_list', checked ? 'true' : 'false');
  if (typeof showToast === 'function') {
    showToast(checked ? '자동 목록 변환이 켜졌습니다.' : '자동 목록 변환이 꺼졌습니다.');
  }
}

function handleSettingSmartUndoChange(checked) {
  localStorage.setItem('zen_setting_smart_undo', checked ? 'true' : 'false');
  if (typeof showToast === 'function') {
    showToast(checked ? '글머리기호 즉시 취소가 켜졌습니다.' : '글머리기호 즉시 취소가 꺼졌습니다.');
  }
}

function setSettingEditorFontSize(val) {
  localStorage.setItem('zen_setting_editor_font_size', val);
  updateSegmentedActive('setting-fontsize-segmented', val);
  applyEditorFontSize(val);
  if (typeof showToast === 'function') {
    showToast(val === 'large' ? '본문 글자 크기가 조금 더 커졌습니다.' : '본문 글자 크기가 표준으로 변경되었습니다.');
  }
}

function applyEditorFontSize(val) {
  const editorRoot = document.querySelector('#editor .ql-editor');
  if (!editorRoot) return;
  if (val === 'large') {
    editorRoot.style.fontSize = '17.5px';
    editorRoot.style.lineHeight = '1.75';
  } else {
    editorRoot.style.fontSize = '';
    editorRoot.style.lineHeight = '';
  }
}

// 초기화 시 폰트 설정 반영
document.addEventListener('DOMContentLoaded', () => {
  const fontSize = localStorage.getItem('zen_setting_editor_font_size') || 'normal';
  if (fontSize === 'large') {
    setTimeout(() => applyEditorFontSize('large'), 100);
  }
});

window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.handleSettingAutoListChange = handleSettingAutoListChange;
window.handleSettingSmartUndoChange = handleSettingSmartUndoChange;
window.setSettingEditorFontSize = setSettingEditorFontSize;
window.setSettingRecentNotesCount = setSettingRecentNotesCount;
window.applyEditorFontSize = applyEditorFontSize;

// ============================================================================
// ============================================================================
// 🎯 [V4.9.5] 에디터 본문 독립 확대·축소(Word/Notion 방식) & 초기화 토스트 엔진
// - 앱 창 프레임(상단바, 사이드바, 툴바)은 100% 고정하여 화면 흔들림·지터 원천 차단
// - 에디터 본문(.ql-editor, 글자, 이미지, 표)만 Ctrl+Wheel 및 모바일 핀치로 부드럽게 확대/축소 (50% ~ 250%)
// - 배율 != 100%일 때 상단 중앙(top: 32px, left: 50%)에 '화면 확대·축소 초기화' 토스트 표출
// - 토스트는 본문 바깥 body 직속이므로 언제나 100% 정규 크기 불변 유지!
// - 클릭 또는 Ctrl + 0 시 즉시 100% 원복 및 소멸, 미조작 시 1분(60초) 후 자동 숨김
// ============================================================================
let editorZoomLevel = 1.0;
let zoomResetToastTimer = null;
let initialPinchDist = 0;
let initialPinchZoom = 1.0;

/**
 * 에디터 본문(.ql-editor) 요소를 안전하게 탐색
 */
function getTargetEditorElement() {
  return document.querySelector("#editor .ql-editor") || document.querySelector(".ql-editor");
}

/**
 * 에디터 본문 CSS 배율 적용 및 토스트 상태 갱신
 */
function applyEditorZoom(newScale, silentToast = false) {
  const clamped = Math.max(0.5, Math.min(2.5, Math.round(newScale * 100) / 100));
  editorZoomLevel = clamped;

  const target = getTargetEditorElement();
  if (target) {
    if (Math.abs(clamped - 1.0) <= 0.02) {
      target.style.removeProperty("zoom");
    } else {
      target.style.zoom = clamped.toFixed(2);
    }
  }

  // 이미지 리사이저 오버레이 위치 실시간 동기화
  if (typeof window.syncZenImageResizerPosition === "function") {
    window.syncZenImageResizerPosition();
  }

  // 가운데 편집 창 초슬림 스크롤바 위치/크기 실시간 동기화
  if (typeof window.refreshCenterEditorScrollbar === "function") {
    window.refreshCenterEditorScrollbar();
  }

  // 100% 여부에 따른 토스트 제어
  if (Math.abs(editorZoomLevel - 1.0) > 0.02) {
    if (!silentToast) {
      showZoomResetToast();
    }
  } else {
    hideZoomResetToast();
  }
}

/**
 * 상대 배율 변경 (+0.1, -0.1 등)
 */
function changeEditorZoomDelta(delta) {
  applyEditorZoom(editorZoomLevel + delta);
}

/**
 * 에디터 본문 배율 100% 원복
 */
function resetEditorZoom() {
  hideZoomResetToast();
  applyEditorZoom(1.0);

  // C# 데스크톱 앱 창 줌도 방어적으로 1.0 원복
  if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
    try {
      window.chrome.webview.postMessage("resetZoom");
    } catch (e) {}
  }
}

/**
 * '화면 확대·축소 초기화' 토스트 팝업 표시
 */
function showZoomResetToast() {
  const toast = document.getElementById("zen-zoom-reset-toast");
  if (!toast) return;

  toast.style.display = "inline-flex";
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // 1분(60초) 자동 소멸 타이머 리셋
  if (zoomResetToastTimer) {
    clearTimeout(zoomResetToastTimer);
  }
  zoomResetToastTimer = setTimeout(() => {
    hideZoomResetToast();
  }, 60000);
}

/**
 * '화면 확대·축소 초기화' 토스트 팝업 숨김
 */
function hideZoomResetToast() {
  if (zoomResetToastTimer) {
    clearTimeout(zoomResetToastTimer);
    zoomResetToastTimer = null;
  }
  const toast = document.getElementById("zen-zoom-reset-toast");
  if (!toast) return;

  toast.classList.remove("show");
  setTimeout(() => {
    if (!toast.classList.contains("show")) {
      toast.style.display = "none";
    }
  }, 220);
}

/**
 * 에디터 독립 확대·축소 제스처 및 단축키 리스너 초기화
 */
function initEditorZoomEngine() {
  const toast = document.getElementById("zen-zoom-reset-toast");
  if (toast) {
    toast.addEventListener("click", (e) => {
      e.stopPropagation();
      resetEditorZoom();
    });
  }

  // 1. 에디터 및 본문 영역 Ctrl + Wheel 감지
  window.addEventListener("wheel", (e) => {
    if (!e.ctrlKey) return;

    // 마우스 커서가 에디터 본문, 중앙 칼럼, 툴바 등 에디터 관련 영역 위에 있을 때 가로챔
    const target = e.target;
    const isEditorArea = target && (
      target.closest("#editor") ||
      target.closest(".quill-wrapper") ||
      target.closest(".col-center") ||
      target.closest(".ql-editor")
    );

    if (isEditorArea) {
      e.preventDefault();
      e.stopPropagation();
      const step = 0.05;
      if (e.deltaY < 0) {
        changeEditorZoomDelta(step);
      } else if (e.deltaY > 0) {
        changeEditorZoomDelta(-step);
      }
    }
  }, { passive: false });

  // 2. 단축키 감지: Ctrl + 0 (리셋), Ctrl + '+' / '=' (확대), Ctrl + '-' (축소)
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey) {
      if (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        if (Math.abs(editorZoomLevel - 1.0) > 0.02) {
          e.preventDefault();
          resetEditorZoom();
        }
      } else if (e.key === '+' || e.key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        changeEditorZoomDelta(0.1);
      } else if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        changeEditorZoomDelta(-0.1);
      }
    }
  });

  // 3. 모바일 터치 2점 핀치 제스처 (에디터 영역 한정)
  const editorArea = document.querySelector(".col-center") || document.body;
  editorArea.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      initialPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      initialPinchZoom = editorZoomLevel;
    }
  }, { passive: true });

  editorArea.addEventListener("touchmove", (e) => {
    if (e.touches && e.touches.length === 2 && initialPinchDist > 0) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      const ratio = currentDist / initialPinchDist;
      applyEditorZoom(initialPinchZoom * ratio);
      e.preventDefault(); // 전체 창 핀치 방지
    }
  }, { passive: false });

  editorArea.addEventListener("touchend", (e) => {
    if (e.touches.length < 2) {
      initialPinchDist = 0;
    }
  }, { passive: true });

  // 노트를 새로 로드할 때 현재 배율 유지 적용
  document.addEventListener("zen-memo-loaded", () => {
    if (Math.abs(editorZoomLevel - 1.0) > 0.02) {
      const target = getTargetEditorElement();
      if (target) {
        target.style.zoom = editorZoomLevel.toFixed(2);
      }
    }
  });
}

// [V1.3.0] 좌측 사이드바 너비 드래그 리사이저 초기화
const SIDEBAR_WIDTH_KEY = "zen_sidebar_width";
function applySavedSidebarWidth() {
  const colLeft = document.getElementById("col-left");
  if (!colLeft) return;
  const saved = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || "", 10);
  if (!isNaN(saved) && saved >= 220 && saved <= 480) {
    colLeft.style.setProperty("--sidebar-width", `${saved}px`);
  }
}

function initSidebarResizer() {
  applySavedSidebarWidth();
  const resizer = document.getElementById("left-sidebar-resizer");
  const colLeft = document.getElementById("col-left");
  if (!resizer || !colLeft || window.__zenSidebarResizerBound) return;
  window.__zenSidebarResizerBound = true;

  let isDragging = false;
  let startX = 0;
  let startWidth = 285;

  resizer.addEventListener("mousedown", (e) => {
    if (colLeft.classList.contains("collapsed") || window.innerWidth <= 768) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startWidth = colLeft.getBoundingClientRect().width || 285;
    colLeft.classList.add("is-resizing");
    document.body.style.cursor = "col-resize";
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const rawW = startWidth + (e.clientX - startX);
    const clampedW = Math.max(220, Math.min(480, Math.round(rawW)));
    colLeft.style.setProperty("--sidebar-width", `${clampedW}px`);
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    colLeft.classList.remove("is-resizing");
    document.body.style.cursor = "";
    const curW = Math.round(colLeft.getBoundingClientRect().width || 285);
    const clampedW = Math.max(220, Math.min(480, curW));
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampedW));
  });

  resizer.addEventListener("dblclick", () => {
    if (colLeft.classList.contains("collapsed") || window.innerWidth <= 768) return;
    colLeft.style.setProperty("--sidebar-width", "285px");
    localStorage.setItem(SIDEBAR_WIDTH_KEY, "285");
  });
}

// ============================================================================
// [V1.8.2] 가운데 편집 창 전용 초슬림 자동 숨김 오버레이 스크롤바
// ============================================================================
function initCenterEditorScrollbar() {
  if (window.__zenCenterScrollbarInitialized) {
    if (typeof window.refreshCenterEditorScrollbar === "function") {
      window.refreshCenterEditorScrollbar();
    }
    return;
  }
  window.__zenCenterScrollbarInitialized = true;

  let track = document.getElementById("zen-center-scrollbar");
  let thumb = track ? track.querySelector(".zen-center-scrollbar-thumb") : null;
  if (!track) {
    track = document.createElement("div");
    track.id = "zen-center-scrollbar";
    track.className = "zen-center-scrollbar";
    track.setAttribute("aria-hidden", "true");

    thumb = document.createElement("div");
    thumb.className = "zen-center-scrollbar-thumb";
    track.appendChild(thumb);
    document.body.appendChild(track);
  }

  const MIN_OVERFLOW_PX = 2;
  const MIN_THUMB_HEIGHT_PX = 32;
  const HIDE_DELAY_SCROLL_MS = 1200;
  const HIDE_DELAY_LEAVE_MS = 800;

  let hideTimer = null;
  let rafId = 0;
  let isHovered = false;
  let isDragging = false;
  let lastScrolledEl = null;
  let currentTrackHeight = 0;
  let currentThumbHeight = MIN_THUMB_HEIGHT_PX;
  let currentMaxScroll = 0;

  let resizeObserver = null;
  let editorMutationObserver = null;
  let stateMutationObserver = null;
  const observedResizeTargets = new WeakSet();
  const observedMutationTargets = new WeakSet();
  const observedImageLoadTargets = new WeakSet();

  function getCandidateElements() {
    return {
      qlEditor: document.querySelector("#editor .ql-editor"),
      editorContainer: document.getElementById("editor"),
      colCenter: document.querySelector(".col-center"),
    };
  }

  function isCenterScrollCandidate(el) {
    if (!el || el.nodeType !== 1) return false;
    const { qlEditor, editorContainer, colCenter } = getCandidateElements();
    return el === qlEditor || el === editorContainer || el === colCenter;
  }

  function getOverflowAmount(el) {
    if (!el || !el.isConnected) return 0;
    return Math.max(0, el.scrollHeight - el.clientHeight);
  }

  function getActiveScrollEl() {
    const { qlEditor, editorContainer, colCenter } = getCandidateElements();
    if (lastScrolledEl && isCenterScrollCandidate(lastScrolledEl) && getOverflowAmount(lastScrolledEl) > MIN_OVERFLOW_PX) {
      return lastScrolledEl;
    }

    const ordered = window.innerWidth <= 768
      ? [colCenter, editorContainer, qlEditor]
      : [qlEditor, editorContainer, colCenter];

    let bestEl = null;
    let bestOverflow = MIN_OVERFLOW_PX;
    for (const candidate of ordered) {
      const overflow = getOverflowAmount(candidate);
      if (overflow > bestOverflow) {
        bestOverflow = overflow;
        bestEl = candidate;
      }
    }
    return bestEl;
  }

  function shouldSuppressScrollbar() {
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && (fmPane.style.display === "flex" || fmPane.style.display === "block")) {
      return true;
    }
    if (document.body.classList.contains("is-pdf-exporting")) {
      return true;
    }
    if (window.__zenAppScreenLocked === true) {
      return true;
    }
    return false;
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function resetScrollbarState() {
    clearHideTimer();
    currentTrackHeight = 0;
    currentMaxScroll = 0;
    track.classList.remove("has-overflow", "is-active", "is-hovered", "is-dragging");
  }

  function syncTrackAndThumb() {
    if (shouldSuppressScrollbar()) {
      resetScrollbarState();
      return null;
    }

    const el = getActiveScrollEl();
    if (!el) {
      resetScrollbarState();
      return null;
    }

    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    if (scrollHeight <= 0 || clientHeight <= 0 || maxScroll <= MIN_OVERFLOW_PX) {
      resetScrollbarState();
      return null;
    }

    let top = 72;
    let bottom = 8;
    if (window.innerWidth <= 768) {
      top = 68;
      bottom = 58;
    } else {
      const editorContainer = document.getElementById("editor");
      if (editorContainer) {
        const rect = editorContainer.getBoundingClientRect();
        top = Math.max(Math.round(rect.top) + 6, 70);
      }
    }

    const trackHeight = Math.max(40, window.innerHeight - top - bottom);
    const thumbHeight = Math.max(
      MIN_THUMB_HEIGHT_PX,
      Math.min(trackHeight, Math.round((clientHeight / scrollHeight) * trackHeight))
    );
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const ratio = Math.max(0, Math.min(1, el.scrollTop / maxScroll));
    const thumbTop = Math.round(ratio * maxThumbTop);

    currentTrackHeight = trackHeight;
    currentThumbHeight = thumbHeight;
    currentMaxScroll = maxScroll;

    track.style.top = top + "px";
    track.style.height = trackHeight + "px";
    thumb.style.height = thumbHeight + "px";
    thumb.style.transform = "translateY(" + thumbTop + "px)";
    track.classList.add("has-overflow");

    return el;
  }

  function scheduleSync() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      syncTrackAndThumb();
    });
  }

  function revealTemporarily(delayMs = HIDE_DELAY_SCROLL_MS) {
    if (!track.classList.contains("has-overflow")) return;
    track.classList.add("is-active");
    clearHideTimer();
    if (!isHovered && !isDragging) {
      hideTimer = setTimeout(() => {
        hideTimer = null;
        if (!isHovered && !isDragging) {
          track.classList.remove("is-active");
        }
      }, delayMs);
    }
  }

  function onDocumentScroll(e) {
    if (!isCenterScrollCandidate(e.target)) return;
    lastScrolledEl = e.target;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    const activeEl = syncTrackAndThumb();
    if (activeEl) {
      revealTemporarily(HIDE_DELAY_SCROLL_MS);
    }
  }

  function startDrag(e, targetEl) {
    const el = targetEl || syncTrackAndThumb();
    if (!el) return;

    const initialMaxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    const initialMaxThumbTop = Math.max(0, currentTrackHeight - currentThumbHeight);
    if (initialMaxThumbTop <= 0) return;

    isDragging = true;
    clearHideTimer();
    track.classList.add("is-active", "is-dragging");
    document.body.classList.add("zen-scrollbar-dragging");

    const startClientY = e.clientY;
    const startScrollTop = el.scrollTop;

    function onPointerMove(moveEvent) {
      if (!isDragging) return;
      const latestMaxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      const latestMaxThumbTop = Math.max(1, currentTrackHeight - currentThumbHeight);
      const deltaY = moveEvent.clientY - startClientY;
      const nextScrollTop = startScrollTop + (deltaY / latestMaxThumbTop) * latestMaxScroll;
      el.scrollTop = Math.max(0, Math.min(latestMaxScroll, nextScrollTop));
      syncTrackAndThumb();
    }

    function stopDrag() {
      if (!isDragging) return;
      isDragging = false;
      track.classList.remove("is-dragging");
      document.body.classList.remove("zen-scrollbar-dragging");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
      window.removeEventListener("blur", stopDrag);
      if (!isHovered) {
        revealTemporarily(HIDE_DELAY_SCROLL_MS);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
    window.addEventListener("blur", stopDrag);
  }

  function ensureObservers() {
    const { qlEditor, editorContainer, colCenter } = getCandidateElements();

    if (typeof ResizeObserver === "function") {
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(scheduleSync);
      }
      for (const el of [colCenter, editorContainer, qlEditor]) {
        if (el && !observedResizeTargets.has(el)) {
          observedResizeTargets.add(el);
          resizeObserver.observe(el);
        }
      }
    }

    if (typeof MutationObserver === "function") {
      if (!editorMutationObserver) {
        editorMutationObserver = new MutationObserver(scheduleSync);
      }
      if (editorContainer && !observedMutationTargets.has(editorContainer)) {
        observedMutationTargets.add(editorContainer);
        editorMutationObserver.observe(editorContainer, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      if (!stateMutationObserver) {
        stateMutationObserver = new MutationObserver(scheduleSync);
      }
      const fmPane = document.getElementById("file-manager-pane");
      if (fmPane && !observedMutationTargets.has(fmPane)) {
        observedMutationTargets.add(fmPane);
        stateMutationObserver.observe(fmPane, { attributes: true, attributeFilter: ["style"] });
      }
      const appLockOverlay = document.getElementById("app-lock-overlay");
      if (appLockOverlay && !observedMutationTargets.has(appLockOverlay)) {
        observedMutationTargets.add(appLockOverlay);
        stateMutationObserver.observe(appLockOverlay, { attributes: true, attributeFilter: ["style"] });
      }
      if (document.body && !observedMutationTargets.has(document.body)) {
        observedMutationTargets.add(document.body);
        stateMutationObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
      }
    }

    if (editorContainer && !observedImageLoadTargets.has(editorContainer)) {
      observedImageLoadTargets.add(editorContainer);
      editorContainer.addEventListener("load", scheduleSync, { capture: true, passive: true });
    }
  }

  track.addEventListener("mouseenter", () => {
    isHovered = true;
    clearHideTimer();
    const activeEl = syncTrackAndThumb();
    if (activeEl) {
      track.classList.add("is-hovered", "is-active");
    }
  });

  track.addEventListener("mouseleave", () => {
    isHovered = false;
    track.classList.remove("is-hovered");
    if (!isDragging) {
      revealTemporarily(HIDE_DELAY_LEAVE_MS);
    }
  });

  thumb.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const activeEl = syncTrackAndThumb();
    if (activeEl) {
      startDrag(e, activeEl);
    }
  });

  track.addEventListener("pointerdown", (e) => {
    if (e.target !== track) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const activeEl = syncTrackAndThumb();
    if (!activeEl) return;

    const trackRect = track.getBoundingClientRect();
    const clickY = e.clientY - trackRect.top;
    const maxThumbTop = Math.max(0, currentTrackHeight - currentThumbHeight);
    const targetThumbTop = Math.max(0, Math.min(maxThumbTop, clickY - currentThumbHeight / 2));
    const jumpRatio = maxThumbTop > 0 ? (targetThumbTop / maxThumbTop) : 0;
    const maxScroll = Math.max(0, activeEl.scrollHeight - activeEl.clientHeight);
    activeEl.scrollTop = jumpRatio * maxScroll;
    syncTrackAndThumb();
    startDrag(e, activeEl);
  });

  track.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("scroll", onDocumentScroll, { passive: true, capture: true });
  window.addEventListener("resize", scheduleSync, { passive: true });

  window.refreshCenterEditorScrollbar = () => {
    ensureObservers();
    scheduleSync();
  };

  ensureObservers();
  syncTrackAndThumb();
}

// 하위 호환성 글로벌 함수 노출
window.toggleSidebarSearchBar = toggleSidebarSearchBar;
window.closeSidebarSearchBar = closeSidebarSearchBar;
window.executeUndo = executeUndo;
window.syncMainSearchClearBtn = syncMainSearchClearBtn;
window.showZoomResetToast = showZoomResetToast;
window.hideZoomResetToast = hideZoomResetToast;
window.resetAppZoomScale = resetEditorZoom;
window.resetEditorZoom = resetEditorZoom;
window.applyEditorZoom = applyEditorZoom;
window.initSidebarResizer = initSidebarResizer;
window.initCenterEditorScrollbar = initCenterEditorScrollbar;
window.addEventListener("DOMContentLoaded", initEditorZoomEngine);
window.addEventListener("DOMContentLoaded", initSidebarResizer);
window.addEventListener("DOMContentLoaded", initCenterEditorScrollbar);
window.addEventListener("load", initCenterEditorScrollbar);
