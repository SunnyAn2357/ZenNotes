function generateSyncId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function formatDateTime(timestamp) {
  const d = new Date(timestamp);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hr = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yr}.${mo}.${da}. ${hr}:${mi}`;
}

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
    html += `<button id="zen-undo-btn" style="color:var(--accent); font-weight:700; font-size:14px; padding:10px 12px; background:rgba(120,169,255,0.15); border:none; border-radius:6px; cursor:pointer; transition:opacity 0.3s ease-in-out, background 0.2s; flex-shrink:0; opacity:0; pointer-events:none;">실행 취소</button>`;
  }
  toast.innerHTML = html;
  toast.style.opacity = "1";
  toast.style.pointerEvents = "auto";

  if (undoData) {
    const undoBtn = document.getElementById("zen-undo-btn");
    undoBtn.onclick = () => {
      executeUndo();
      toast.style.opacity = "0";
      toast.style.pointerEvents = "none";
      undoBtn.style.pointerEvents = "none";
    };
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
      toast.style.pointerEvents = "none";
      const undoBtn = document.getElementById("zen-undo-btn");
      if (undoBtn) undoBtn.style.pointerEvents = "none";
      setTimeout(() => {
        if (toast.style.opacity === "0") toast.innerHTML = "";
      }, 300);
    },
    undoData ? 5000 : 2500,
  );
}

function executeUndo() {
  if (!lastUndoData || !db) return;
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  lastUndoData.forEach((item) => {
    store.get(item.id).onsuccess = (e) => {
      const m = e.target.result;
      if (m) {
        if (item.action === "restore") {
          m.isDeleted = false;
          delete m.deletedAt;
        } else if (item.action === "moveBack") {
          m.parentId = item.oldParentId;
        }
        m.updatedAt = Date.now();
        store.put(m);
      }
    };
  });

  tx.oncomplete = () => {
    showToast("작업이 실행 취소되었습니다.");
    lastUndoData = null;
    loadFileManager(currentFmFolderId);
    loadMemoList(true);
    updateUnsyncedCount();
  };
}

function toggleRightPane() {
  if (document.activeElement) document.activeElement.blur();
  const rp = document.getElementById("col-right");
  const gb = document.getElementById("global-menu-btn");
  document.getElementById("trash-pane").classList.remove("is-open");

  if (rp.classList.contains("is-closed")) {
    rp.classList.remove("is-closed");
    gb.style.display = "none";
    if (window.innerWidth <= 768)
      document.getElementById("mobile-overlay").classList.add("is-active");
    history.pushState({ panel: "right" }, "");
  } else {
    rp.classList.add("is-closed");
    gb.style.display = "flex";
    if (window.innerWidth <= 768)
      document.getElementById("mobile-overlay").classList.remove("is-active");
  }
}

function toggleTrashPane() {
  if (document.activeElement) document.activeElement.blur();
  const tp = document.getElementById("trash-pane");
  if (tp.classList.contains("is-open")) {
    tp.classList.remove("is-open");
    if (
      window.innerWidth <= 768 &&
      document.getElementById("col-right").classList.contains("is-closed")
    ) {
      document.getElementById("mobile-overlay").classList.remove("is-active");
    }
  } else {
    tp.classList.add("is-open");
    loadTrashList();
    if (window.innerWidth <= 768)
      document.getElementById("mobile-overlay").classList.add("is-active");
    history.pushState({ panel: "trash" }, "");
  }
}

function toggleLeftPaneMobile() {
  if (document.activeElement) document.activeElement.blur();
  const lp = document.getElementById("col-left");
  const ov = document.getElementById("mobile-overlay");
  lp.classList.toggle("is-mobile-open");
  if (lp.classList.contains("is-mobile-open")) {
    ov.classList.add("is-active");
    history.pushState({ panel: "left" }, "");
    document.getElementById("col-right").classList.add("is-closed");
    document.getElementById("trash-pane").classList.remove("is-open");
    document.getElementById("global-menu-btn").style.display = "flex";
  } else {
    ov.classList.remove("is-active");
  }
}

function closeAllPanelsMobile() {
  closeAllMemoMenus();
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

function handlePinClick(id, isPinned, e) {
  e.stopPropagation();
  togglePin(id, e);
}

function togglePin(id, e) {
  if (e) e.stopPropagation();
  forceSaveImmediate();

  const targets =
    selectedMemos.has(id) && selectedMemos.size > 1
      ? Array.from(selectedMemos)
      : [id];
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  targets.forEach((targetId) => {
    store.get(targetId).onsuccess = (ev) => {
      const memo = ev.target.result;
      if (memo) {
        if (memo.pinnedAt) delete memo.pinnedAt;
        else memo.pinnedAt = Date.now();
        store.put(memo);
      }
    };
  });

  tx.oncomplete = () => loadMemoList(true);
}

function startPress(e, memoId, isTrash) {
  if (e.target.closest(".memo-actions-wrap")) return;
  if (e.type === "touchstart" && e.touches.length > 1) return;

  isPressTriggered = false;
  pressTimer = setTimeout(() => {
    isPressTriggered = true;
    if (navigator.vibrate) navigator.vibrate(50);

    if (isTrash) {
      if (!isTrashMultiSelectMode) {
        selectedTrashMemos.clear();
        isTrashMultiSelectMode = true;
        history.pushState({ mode: "multi" }, "");
      }
      selectedTrashMemos.add(memoId);
      lastSelectedTrashId = memoId;
      loadTrashList();
    } else {
      if (!isMultiSelectMode) {
        selectedMemos.clear();
        isMultiSelectMode = true;
        history.pushState({ mode: "multi" }, "");
      }
      selectedMemos.add(memoId);
      lastSelectedId = memoId;
      loadMemoList(false);
    }
  }, 500);
}

function cancelPress() {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = null;
  }
}

function triggerMainSearch() {
  if (mainSearchTimer) clearTimeout(mainSearchTimer);
  mainSearchTimer = setTimeout(() => loadMemoList(true), 300);
}

function triggerTrashSearch() {
  if (trashSearchTimer) clearTimeout(trashSearchTimer);
  trashSearchTimer = setTimeout(() => loadTrashList(), 300);
}

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

async function insertRichLinkCard(url, fallbackTitle, fallbackText) {
  try {
    showToast("링크 정보를 분석 중입니다...\n(잠시만 기다려주세요)");
    const response = await fetch(
      `https://api.microlink.io?url=${encodeURIComponent(url)}`,
    );
    const data = await response.json();
    let cardData = {
      url: url,
      title: fallbackTitle || url,
      description: fallbackText || "",
      image: "",
    };

    if (data.status === "success") {
      cardData.title = data.data.title || cardData.title;
      cardData.description = data.data.description || cardData.description;
      cardData.image =
        data.data.image && data.data.image.url
          ? data.data.image.url
          : data.data.logo && data.data.logo.url
            ? data.data.logo.url
            : "";
    }
    const range = quill.getLength();
    quill.insertEmbed(range, "link-card", cardData, Quill.sources.USER);
    quill.insertText(range + 1, "\n", Quill.sources.USER);
    triggerAutoSave();
    showToast("링크 카드가 저장되었습니다.");
  } catch (error) {
    console.error("❌ 링크 분석 실패:", error);
    const range = quill.getLength();
    quill.insertText(range, url + "\n", Quill.sources.USER);
    triggerAutoSave();
  }
}

function handleLaunchParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("action") === "new") {
    createNewMemo();
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }
  const sharedTitle = urlParams.get("title");
  const sharedText = urlParams.get("text");
  const sharedUrl = urlParams.get("url");

  if (sharedTitle || sharedText || sharedUrl) {
    createNewMemo();
    if (sharedTitle)
      document.getElementById("memo-title-input").value = sharedTitle;
    if (sharedUrl) {
      insertRichLinkCard(sharedUrl, sharedTitle, sharedText);
    } else if (sharedText) {
      quill.root.innerHTML = sharedText + "<br><br>";
      triggerAutoSave();
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

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

function escapeFormattingBlock() {
  const range = quill.getSelection(true);
  if (!range) return false;
  const formats = quill.getFormat(range.index);
  if (formats.blockquote || formats["code-block"]) {
    let [line, offset] = quill.getLine(range.index);
    while (line && line.next) {
      let nextIdx = quill.getIndex(line.next);
      let nextFmt = quill.getFormat(nextIdx);
      if (!nextFmt.blockquote && !nextFmt["code-block"]) break;
      line = line.next;
    }
    if (line && line.next) {
      quill.setSelection(quill.getIndex(line.next), 0, Quill.sources.USER);
    } else {
      let escapeIndex = quill.getIndex(line) + line.length();
      quill.insertText(escapeIndex, "\n", Quill.sources.USER);
      quill.setSelection(escapeIndex, Quill.sources.SILENT);
      quill.removeFormat(escapeIndex, 1);
    }
    return true;
  }
  return false;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const tooltip = document.querySelector(".ql-tooltip");
    if (tooltip && !tooltip.classList.contains("ql-hidden")) {
      tooltip.classList.add("ql-hidden");
      return;
    }

    const openMenus = document.querySelectorAll(
      ".memo-actions-wrap.is-menu-open",
    );
    if (openMenus.length > 0) {
      closeAllMemoMenus();
      return;
    }

    const activeId = document.activeElement ? document.activeElement.id : "";
    if (
      activeId.includes("search-input") ||
      activeId.includes("sec-password")
    ) {
      if (document.activeElement.value !== "") {
        document.activeElement.value = "";
        document.activeElement.dispatchEvent(new Event("input"));
        return;
      } else {
        document.activeElement.blur();
        return;
      }
    }

    const globalMenu = document.getElementById("fm-global-menu");
    const itemMenu = document.getElementById("fm-item-menu");
    if (
      (globalMenu && globalMenu.classList.contains("is-active")) ||
      (itemMenu && itemMenu.classList.contains("is-active"))
    ) {
      if (globalMenu) globalMenu.classList.remove("is-active");
      if (itemMenu) itemMenu.classList.remove("is-active");
      return;
    }

    const fmPane = document.getElementById("file-manager-pane");
    const isFmOpen = fmPane && fmPane.style.display === "flex";
    const inMainMulti = isMultiSelectMode || selectedMemos.size > 1;
    const inTrashMulti = isTrashMultiSelectMode || selectedTrashMemos.size > 1;
    const isMobile = window.innerWidth <= 768;
    const isMobilePanelOpen =
      isMobile &&
      (document
        .getElementById("col-left")
        .classList.contains("is-mobile-open") ||
        !document.getElementById("col-right").classList.contains("is-closed") ||
        document.getElementById("trash-pane").classList.contains("is-open"));

    if (
      isFmOpen ||
      (isMobile && (inMainMulti || inTrashMulti || isMobilePanelOpen))
    ) {
      if (document.activeElement) document.activeElement.blur();
      history.back();
      return;
    }

    if (!isMobile) {
      if (inMainMulti || inTrashMulti) {
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
        if (document.activeElement) document.activeElement.blur();
        return;
      }
      const trashPane = document.getElementById("trash-pane");
      const rightPane = document.getElementById("col-right");
      if (trashPane.classList.contains("is-open")) {
        toggleTrashPane();
        return;
      } else if (!rightPane.classList.contains("is-closed")) {
        toggleRightPane();
        return;
      }
    }

    if (escapeFormattingBlock()) return;
  }
});

window.addEventListener("popstate", (e) => {
  if (programmaticBackCount > 0) {
    programmaticBackCount--;
    return;
  }

  const fmPane = document.getElementById("file-manager-pane");
  if (fmPane && fmPane.style.display === "flex") {
    const searchInput = document.getElementById("fm-search-input");
    const isSearching = searchInput && searchInput.value !== "";

    const globalMenu = document.getElementById("fm-global-menu");
    const itemMenu = document.getElementById("fm-item-menu");
    const moveModal = document.getElementById("fm-move-modal");
    const securityModal = document.getElementById("fm-security-modal");

    const isMenuOpen =
      (globalMenu && globalMenu.classList.contains("is-active")) ||
      (itemMenu && itemMenu.classList.contains("is-active"));
    const isModalOpen =
      (moveModal && moveModal.style.display === "flex") ||
      (securityModal && securityModal.style.display === "flex");

    if (isMenuOpen || isModalOpen) {
      if (globalMenu) globalMenu.classList.remove("is-active");
      if (itemMenu) itemMenu.classList.remove("is-active");
      if (moveModal && moveModal.style.display === "flex") closeMoveModal(true);
      if (securityModal && securityModal.style.display === "flex")
        closeSecurityModal(true);
      return;
    }

    if (isFmMultiSelectMode) {
      cancelFmMultiSelect(true);
      return;
    }
    if (isSearching) {
      resetFmToHome();
      return;
    }

    if (e.state && e.state.fmOpen) {
      fmPath = e.state.fmPath || [{ id: null, title: "Home" }];
      loadFileManager(e.state.fmFolderId);
      return;
    } else {
      closeFileManager();
      return;
    }
  }

  const trashPane = document.getElementById("trash-pane");
  const rightPane = document.getElementById("col-right");
  const leftPane = document.getElementById("col-left");
  const activeId = document.activeElement ? document.activeElement.id : "";

  const tooltip = document.querySelector(".ql-tooltip");
  if (tooltip && !tooltip.classList.contains("ql-hidden")) {
    tooltip.classList.add("ql-hidden");
    return;
  }

  if (activeId.includes("search-input")) {
    if (document.activeElement.value !== "") {
      document.activeElement.value = "";
      document.activeElement.dispatchEvent(new Event("input"));
      return;
    } else {
      document.activeElement.blur();
    }
  }

  const inMainMulti = isMultiSelectMode || selectedMemos.size > 1;
  const inTrashMulti = isTrashMultiSelectMode || selectedTrashMemos.size > 1;

  if (inMainMulti || inTrashMulti) {
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
    if (document.activeElement) document.activeElement.blur();
    return;
  }

  if (trashPane.classList.contains("is-open")) {
    trashPane.classList.remove("is-open");
    if (rightPane.classList.contains("is-closed")) {
      document.getElementById("mobile-overlay").classList.remove("is-active");
    }
    return;
  }
  if (
    !rightPane.classList.contains("is-closed") ||
    leftPane.classList.contains("is-mobile-open")
  ) {
    closeAllPanelsMobile();
    return;
  }

  if (escapeFormattingBlock()) return;

  if (window.innerWidth <= 768) {
    const now = Date.now();
    if (now - backPressTimer < 2000) {
      if (typeof purgeEmptyMemos === "function") purgeEmptyMemos();
      if (typeof executeSave === "function") executeSave();
      history.back();
    } else {
      backPressTimer = now;
      if (document.activeElement) document.activeElement.blur();
      if (window.quill && quill.hasFocus()) quill.blur();
      showToast(
        "뒤로가기 버튼을 한 번 더 누르면 종료됩니다.\n(온라인 동기화: 다음 로그인 시)",
      );
      history.pushState({ page: "main" }, "");
    }
  }
});

document.addEventListener(
  "click",
  (e) => {
    const inMainMulti = isMultiSelectMode || selectedMemos.size > 1;
    const inTrashMulti = isTrashMultiSelectMode || selectedTrashMemos.size > 1;

    if (
      (inMainMulti || inTrashMulti) &&
      !e.target.closest(".memo-item") &&
      !e.target.closest(".memo-actions-wrap")
    ) {
      e.preventDefault();
      e.stopPropagation();
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
);

document.addEventListener("click", (e) => {
  closeAllMemoMenus();
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

window.addEventListener("load", () => {
  if (window.innerWidth <= 768) {
    history.replaceState({ page: "base" }, "");
    history.pushState({ page: "main" }, "");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((registration) => {
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            const updateToast = document.getElementById("update-toast");
            updateToast.style.display = "flex";
            document
              .getElementById("update-btn")
              .addEventListener("click", () => {
                updateToast.style.display = "none";
                newWorker.postMessage({ type: "SKIP_WAITING" });
              });
          }
        });
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

if (window.visualViewport) {
  const toolbar = document.querySelector(".ql-toolbar.ql-snow");
  let isDocked = false;
  let viewportHandler = null;

  const updateToolbarPosition = () => {
    if (viewportHandler) cancelAnimationFrame(viewportHandler);
    viewportHandler = requestAnimationFrame(() => {
      if (window.innerWidth > 768 || !toolbar) {
        if (isDocked) {
          toolbar.style.cssText = "";
          isDocked = false;
        }
        return;
      }
      const isTyping =
        quill.hasFocus() ||
        document.activeElement === document.getElementById("memo-title-input");
      const isKeyboardUp =
        isTyping && window.visualViewport.height < window.screen.height * 0.75;

      if (isKeyboardUp) {
        const topPosition =
          window.visualViewport.offsetTop +
          window.visualViewport.height -
          toolbar.offsetHeight +
          2;
        toolbar.style.setProperty("position", "fixed", "important");
        toolbar.style.setProperty("top", `${topPosition}px`, "important");
        toolbar.style.setProperty("bottom", "auto", "important");
        toolbar.style.setProperty("z-index", "9999", "important");
        toolbar.style.setProperty(
          "box-shadow",
          "0 4px 0 var(--bg)",
          "important",
        );
        toolbar.style.setProperty("transform", "translateZ(0)", "important");
        toolbar.style.setProperty("transition", "none", "important");
        isDocked = true;
      } else {
        if (isDocked) {
          toolbar.style.cssText = "";
          isDocked = false;
        }
      }
    });
  };

  window.visualViewport.addEventListener("resize", updateToolbarPosition);
  window.visualViewport.addEventListener("scroll", updateToolbarPosition);
  quill.root.addEventListener("focus", updateToolbarPosition);
  document
    .getElementById("memo-title-input")
    .addEventListener("focus", updateToolbarPosition);
  quill.root.addEventListener("blur", () =>
    setTimeout(updateToolbarPosition, 100),
  );
  document
    .getElementById("memo-title-input")
    .addEventListener("blur", () => setTimeout(updateToolbarPosition, 100));
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    currentSecKey = null;
    isSecurityUnlocked = false;
    if (isEditingSecureMemo) {
      createNewMemo();
      showToast("보안을 위해 노트가 닫혔습니다. (비밀번호 재입력 필요)");
    }
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
      if (typeof forceCleanFmUI === "function") forceCleanFmUI();
      resetFmToHome();
    }
  }
});
