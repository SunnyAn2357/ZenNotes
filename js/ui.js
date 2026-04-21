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

function toggleLeftPaneMobile() {
  if (document.activeElement) document.activeElement.blur(); // 👈 브라우저의 포커스를 뺏어 키보드를 강제로 숨깁니다.
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
  closeAllPanelsMobile();
  const synth = window.speechSynthesis;
  const btnIcon = this.querySelector("i");
  const btnText = this.querySelector(".btn-text");

  if (isReading || synth.speaking) {
    synth.cancel();
    isReading = false;
    btnIcon.className = "fa-solid fa-volume-high";
    btnText.innerText = "음성으로 듣기";
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
    btnText.innerText = "음성으로 듣기";
  };

  utterance.onerror = function () {
    console.warn(">>> 음성 읽기 중단");
    isReading = false;
    btnIcon.className = "fa-solid fa-volume-high";
    btnText.innerText = "음성으로 듣기";
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

// 🎯 [완벽 교정] 오작동 방지 0.5초 지연 + 유령 버튼(투명 클릭) 완벽 차단 토스트
function showToast(msg, undoData = null) {
  let toast = document.getElementById("zen-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "zen-toast";
    toast.style.cssText =
      "position:fixed; bottom:120px; left:50%; transform:translateX(-50%); background:rgba(30,30,32,0.95); color:var(--text-main); border:1px solid var(--border); padding:12px 24px; border-radius:12px; font-size:14px; font-weight:500; z-index:10005; opacity:0; transition:opacity 0.3s ease-in-out; white-space:pre-wrap; text-align:center; line-height:1.4; box-shadow:0 8px 24px rgba(0,0,0,0.6); width:max-content; max-width:90vw; word-break:keep-all; display:flex; align-items:center; gap:20px; pointer-events:none;";
    document.body.appendChild(toast);
  }

  let html = `<span>${msg}</span>`;

  if (undoData) {
    lastUndoData = undoData;
    // 처음엔 투명하고 터치 불가 상태로 대기
    html += `<button id="zen-undo-btn" style="color:var(--accent); font-weight:700; font-size:14px; padding:10px 12px; background:rgba(120,169,255,0.15); border:none; border-radius:6px; cursor:pointer; transition:opacity 0.3s ease-in-out, background 0.2s; flex-shrink:0; opacity:0; pointer-events:none;">실행 취소</button>`;
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

// 🎯 [실행 취소] 핵심 DB 롤백 엔진
function executeUndo() {
  if (!lastUndoData || !db) return;
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  lastUndoData.forEach((item) => {
    store.get(item.id).onsuccess = (e) => {
      const m = e.target.result;
      if (m) {
        if (item.action === "restore") {
          m.isDeleted = false; // 휴지통에서 다시 살려냄
          delete m.deletedAt;
        } else if (item.action === "moveBack") {
          m.parentId = item.oldParentId; // 원래 있던 방으로 되돌림
        }
        m.updatedAt = Date.now();
        store.put(m);
      }
    };
  });

  tx.oncomplete = () => {
    showToast("작업이 실행 취소되었습니다.");
    lastUndoData = null; // 기억 비우기
    loadFileManager(currentFmFolderId); // 현재 창 새로고침
    loadMemoList(true); // 메인 목록 새로고침
    updateUnsyncedCount();
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        console.log("✅ 서비스 워커 등록 완료! Scope:", registration.scope);

        // 🎯 새 버전의 서비스 워커가 발견되었을 때의 처리
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;

          newWorker.addEventListener("statechange", () => {
            // 새 워커가 다운로드 완료되었고, 기존에 작동 중인 워커가 있다면 (즉, 최초 설치가 아닌 '업데이트'라면)
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              const updateToast = document.getElementById("update-toast");
              updateToast.style.display = "flex";

              // 새로고침 버튼을 누르면 대기 중인 워커에게 강제 적용(SKIP_WAITING) 명령 전송
              document
                .getElementById("update-btn")
                .addEventListener("click", () => {
                  updateToast.style.display = "none";
                  newWorker.postMessage({ type: "SKIP_WAITING" });
                });
            }
          });
        });
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

    // 본문 세팅 (텍스트와 URL을 조합하여 삽입)
    if (sharedUrl || sharedText) {
      let content = "";
      if (sharedText) content += sharedText + "<br><br>";

      // URL이 있으면 클릭 가능한 링크 형태로 삽입
      if (sharedUrl) {
        content += `<a href="${sharedUrl}" target="_blank">${sharedUrl}</a><br><br>`;
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
function triggerMainSearch() {
  if (mainSearchTimer) clearTimeout(mainSearchTimer);
  mainSearchTimer = setTimeout(() => loadMemoList(true), 300);
}

function triggerTrashSearch() {
  if (trashSearchTimer) clearTimeout(trashSearchTimer);
  trashSearchTimer = setTimeout(() => loadTrashList(), 300);
}

// ============================================================================
// 🚨 [최종 철통 방어막] 화면 최소화 및 백그라운드 전환 시 '은행급 오토-락' 가동
// ============================================================================
document.addEventListener('visibilitychange', () => {
  // document.hidden이 true라는 것은: 
  // PC에서 창을 최소화했거나 다른 탭으로 넘어갔을 때, 
  // 모바일에서 홈 버튼을 누르거나 다른 앱으로 넘어갔을 때를 완벽히 잡아냅니다.
  if (document.hidden) {

    // 1. 메모리에 떠 있는 암호화 열쇠를 즉시 분쇄하여 완벽하게 잠급니다.
    currentSecKey = null;
    isSecurityUnlocked = false;

    // 2. 만약 유저가 '보안 노트'를 화면(에디터)에 열어두고 최소화했다면?
    // 평문 내용이 화면 잔상으로 남지 않도록 에디터의 글을 싹 지우고 새 노트로 덮어버립니다.
    if (isEditingSecureMemo) {
      // 🚀 [최종 교정] 긴급 대피! 무조건 가장 안전한 바탕화면 1등 노트로 피신시킵니다.
      if (typeof openTopDesktopMemo === 'function') {
        openTopDesktopMemo();
      } else {
        createNewMemo();
      }
      showToast("보안을 위해 노트가 닫혔습니다.");
    }

    // 3. 만약 유저가 파일 관리창에서 '보안 폴더 내부'를 구경 중이었다면?
    // 강제로 안전한 바탕화면(Home) 0층으로 쫓아내서 팝업창과 잔상을 모두 지워버립니다.
    if (document.getElementById('file-manager-pane').style.display === 'flex') {
      if (typeof forceCleanFmUI === 'function') forceCleanFmUI();
      resetFmToHome();
    }
  }
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