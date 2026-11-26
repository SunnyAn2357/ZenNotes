let fmSearchTimer = null;
function syncFmSearchClearBtn() {
  const inp = document.getElementById("fm-search-input");
  const clearBtn = document.getElementById("fm-search-clear-btn");
  if (clearBtn) {
    clearBtn.style.display = inp && inp.value.length > 0 ? "flex" : "none";
  }
}

function triggerFmSearch() {
  syncFmSearchClearBtn();
  if (fmSearchTimer) clearTimeout(fmSearchTimer);
  fmSearchTimer = setTimeout(() => loadFileManager(currentFmFolderId), 220);
}

function clearFmSearch() {
  const inp = document.getElementById("fm-search-input");
  if (inp) {
    inp.value = "";
    inp.focus();
  }
  syncFmSearchClearBtn();
  loadFileManager(currentFmFolderId);
}

// 🎯 [신규] 스크롤 감지 시 다중 선택 하단 바 숨기기 / 멈추면 보이기
let fmScrollTimer = null;
const fmBodyScrollEl = document.querySelector(".fm-body");
if (fmBodyScrollEl) {
  fmBodyScrollEl.addEventListener("scroll", () => {
    if (!isFmMultiSelectMode) return; // 다중 선택 모드가 아니면 무시

    const bottomBar = document.getElementById("fm-bottom-bar");
    if (bottomBar) {
      bottomBar.classList.add("is-hidden-by-scroll"); // 스크롤 중에는 바닥으로 숨김

      if (fmScrollTimer) clearTimeout(fmScrollTimer);
      fmScrollTimer = setTimeout(() => {
        bottomBar.classList.remove("is-hidden-by-scroll"); // 스크롤 멈추고 0.4초 뒤에 스르륵 등장
      }, 400);
    }
  });
}

// 🎯 [V1.5.0] 파일 관리창(FM) 탐색기 트리 전역 상태 & 렌더링 엔진 (사이드바와 UI 통일, 고정 노트 제외)
let currentFmFolderId = null;
let isCurrentInTrash = false;
let fmPath = [{ id: null, title: typeof getRootDriveLabel === "function" ? getRootDriveLabel() : "MY 노트(M:)" }];
let currentFmDisplayedItems = [];
let lastFmSelectedId = null;

let fmExpandedSet = new Set();
let fmDriveCollapsed = false;
let fmSelectedRowKey = "drive:root";
let fmFocusedRowKey = "drive:root";
window.__zenPendingFmSecurityExpand = false;
window.__zenFmTreeDataCache = null;

function getFmDriveRootTitle() {
  return typeof getRootDriveLabel === "function" ? getRootDriveLabel() : "MY 노트(M:)";
}

function getFmFolderDisplayTitle(folder) {
  if (!folder) return "폴더";
  if (folder.isSystem === "desktop" || folder.syncId === "sys_desktop") return "임시 폴더";
  if (folder.isSystem === "trash" || folder.syncId === "sys_trash") return "휴지통";
  if (folder.isSystem === "security" || folder.syncId === "sys_security") return "보안 폴더";
  if (folder.isSystem === "bh_official" || folder.syncId === "sys_bh_official") return "공문 분석";
  if (folder.isSystem === "bh_memo" || folder.syncId === "sys_bh_memo") return "쪽지 분석";
  if (folder.isSystem === "bh_doc" || folder.syncId === "sys_bh_doc") return "문서 분석";
  return folder.title || "폴더";
}

function getFmSelectedItemMetaMap() {
  const cache = window.__zenFmTreeDataCache || window.__zenTreeDataCache;
  return cache ? cache.byId : null;
}

function areAllSelectedFmItemsInTrash() {
  if (!fmSelectedItems || fmSelectedItems.size === 0) return isCurrentInTrash;
  const byId = getFmSelectedItemMetaMap();
  if (!byId) return isCurrentInTrash;
  let hasAny = false;
  for (const id of fmSelectedItems) {
    const item = byId.get(id);
    if (item) {
      hasAny = true;
      if (!item.isDeleted) return false;
    }
  }
  return hasAny ? true : isCurrentInTrash;
}

function collapseFmSecurityTree() {
  const cache = window.__zenFmTreeDataCache || window.__zenTreeDataCache;
  window.__zenPendingFmSecurityExpand = false;
  Array.from(fmExpandedSet).forEach((id) => {
    if (id === globalSecurityFolderId || (cache && cache.isUnderSecuritySync(id))) {
      fmExpandedSet.delete(id);
    }
  });
  if (
    currentFmFolderId !== null &&
    (currentFmFolderId === globalSecurityFolderId || (cache && cache.isUnderSecuritySync(currentFmFolderId)))
  ) {
    currentFmFolderId = null;
    fmSelectedRowKey = "drive:root";
    fmFocusedRowKey = "drive:root";
    fmPath = [{ id: null, title: getFmDriveRootTitle() }];
  }
  document.querySelectorAll("#fm-list .tree-under-security").forEach((el) => el.remove());
  const fmPane = document.getElementById("file-manager-pane");
  if (fmPane && fmPane.style.display === "flex") {
    loadFileManager(currentFmFolderId);
  }
}

function setFmSubtreeExpanded(folderId, expand) {
  closeSidebarContextMenu();
  const cache = window.__zenFmTreeDataCache;
  if (!cache || folderId === null || folderId === undefined) return;

  const isSec = folderId === globalSecurityFolderId || cache.isUnderSecuritySync(folderId);
  if (expand && isSec && (!isSecurityUnlocked || !currentSecKey)) {
    window.__zenPendingFmSecurityExpand = true;
    const hasPw = localStorage.getItem("zen_sec_hash");
    openSecurityModal(hasPw ? "enter" : "setup");
    return;
  }

  const collected = [];
  const visited = new Set();
  const isTrashTarget = folderId === globalTrashFolderId || cache.isTrashDescendantSync(folderId);
  function walk(fid) {
    if (visited.has(fid)) return;
    visited.add(fid);
    collected.push(fid);
    if (isTrashTarget) {
      const tSubs = fid === globalTrashFolderId
        ? cache.trashRootFolders
        : (cache.trashChildrenFoldersByParent.get(fid) || []);
      tSubs.forEach((sf) => walk(sf.id));
    } else {
      const subs = cache.childrenFoldersByParent.get(fid) || [];
      subs.forEach((sf) => walk(sf.id));
    }
  }
  walk(folderId);

  collected.forEach((fid) => {
    if (expand) fmExpandedSet.add(fid);
    else fmExpandedSet.delete(fid);
  });

  renderFmTreeFromCache();
}

function setFmAllUnderDriveExpanded(expand) {
  closeSidebarContextMenu();
  const cache = window.__zenFmTreeDataCache;
  if (!cache) return;

  if (expand) {
    fmDriveCollapsed = false;
    cache.folderMap.forEach((f) => {
      if (!f || f.isDeleted || f.isPermanentlyDeleted) return;
      if (f.isSystem === "security" || f.isSystem === "trash" || f.isSystem === "backup") return;
      if (cache.isUnderSecuritySync(f.id) || cache.isUnderTrashSync(f.id)) return;
      fmExpandedSet.add(f.id);
    });
  } else {
    Array.from(fmExpandedSet).forEach((id) => {
      if (id !== globalSecurityFolderId && !cache.isUnderSecuritySync(id)) {
        fmExpandedSet.delete(id);
      }
    });
  }

  renderFmTreeFromCache();
}

function toggleFmAllFolders() {
  const cache = window.__zenFmTreeDataCache;
  if (!cache) return;
  const hasAnyExpanded = Array.from(fmExpandedSet).some((id) => {
    if (id === globalSecurityFolderId || id === globalTrashFolderId) return false;
    if (cache.isUnderSecuritySync(id) || cache.isUnderTrashSync(id)) return false;
    return cache.folderMap.has(id);
  });
  setFmAllUnderDriveExpanded(!hasAnyExpanded);
}

function buildFmBreadcrumbSteps(folderId, cache) {
  const rootTitle = getFmDriveRootTitle();
  const steps = [{ id: null, title: rootTitle }];
  if (folderId === null || folderId === undefined || !cache) return steps;

  if (folderId === globalSecurityFolderId) {
    return [{ id: globalSecurityFolderId, title: "보안 폴더" }];
  }
  if (folderId === globalTrashFolderId) {
    steps.push({ id: globalTrashFolderId, title: "휴지통" });
    return steps;
  }

  const chain = [];
  let curr = folderId;
  const visited = new Set();
  let includesSecurity = false;
  let includesTrash = false;
  while (curr !== null && curr !== undefined) {
    if (visited.has(curr)) break;
    visited.add(curr);
    const f = cache.folderMap.get(curr) || cache.byId.get(curr);
    if (!f) break;
    if (f.isSystem === "security") includesSecurity = true;
    if (f.isDeleted || f.isSystem === "trash") includesTrash = true;
    chain.unshift({ id: f.id, title: getFmFolderDisplayTitle(f) });
    curr = f.parentId;
  }

  if (includesSecurity) return chain;
  if (includesTrash && !chain.some((s) => s.id === globalTrashFolderId)) {
    return [{ id: null, title: rootTitle }, { id: globalTrashFolderId, title: "휴지통" }, ...chain];
  }
  return [{ id: null, title: rootTitle }, ...chain];
}

function loadFileManager(selectedFolderId) {
  if (arguments.length > 0 && selectedFolderId !== undefined) {
    currentFmFolderId = selectedFolderId;
  }
  const list = document.getElementById("fm-list");
  if (!list || !db) return;
  syncFmSearchClearBtn();

  const tx = db.transaction(["memos"], "readonly");
  tx.objectStore("memos").getAll().onsuccess = (e) => {
    const allData = e.target.result || [];
    const cache = buildSidebarTreeCache(allData);
    window.__zenFmTreeDataCache = cache;

    if (
      currentFmFolderId !== null &&
      currentFmFolderId !== undefined &&
      currentFmFolderId !== globalSecurityFolderId &&
      cache.isUnderSecuritySync(currentFmFolderId) &&
      (!isSecurityUnlocked || !currentSecKey)
    ) {
      currentFmFolderId = null;
      fmSelectedRowKey = "drive:root";
    } else if (
      currentFmFolderId !== null &&
      currentFmFolderId !== undefined &&
      !cache.folderMap.has(currentFmFolderId)
    ) {
      currentFmFolderId = null;
      fmSelectedRowKey = "drive:root";
    }

    renderFmTreeFromCache();
  };
}

// 🎯 [신규] 텔레포트(타임머신) 작동 전 UI 찌꺼기 강제 청소
function forceCleanFmUI() {
  isFmMultiSelectMode = false;
  fmSelectedItems.clear();
  lastFmSelectedId = null;
  updateFmBottomBar();

  const globalMenu = document.getElementById("fm-global-menu");
  const itemMenu = document.getElementById("fm-item-menu");
  const moveModal = document.getElementById("fm-move-modal");
  const securityModal = document.getElementById("fm-security-modal");

  if (globalMenu) globalMenu.classList.remove("is-active");
  if (itemMenu) itemMenu.classList.remove("is-active");
  if (moveModal) moveModal.style.display = "none";
  if (securityModal) securityModal.style.display = "none";
  if (typeof closeSidebarContextMenu === "function") closeSidebarContextMenu();
  if (typeof closeFmTextInputModal === "function") {
    closeFmTextInputModal(null, false);
  }
  movingItemIds = [];
}

// 경로(Breadcrumb)를 HTML로 그려주는 함수
function renderFmBreadcrumbs() {
  const container = document.getElementById("fm-breadcrumbs");
  if (!container) return;
  container.innerHTML = "";
  const driveLabel = getFmDriveRootTitle();
  const steps = Array.isArray(fmPath) && fmPath.length > 0 ? fmPath : [{ id: null, title: driveLabel }];

  steps.forEach((p, index) => {
    const isLast = index === steps.length - 1;
    const isSecurityCrumb = p.id === globalSecurityFolderId || p.title === "보안 폴더";
    const span = document.createElement("span");
    span.className = `fm-crumb ${isLast ? "active" : ""}`;
    const crumbTitle =
      p.id === null
        ? driveLabel
        : (p.id === globalDesktopFolderId ? "임시 폴더" : p.title);
    const iconHtml =
      p.id === null
        ? '<i class="fa-solid fa-hard-drive" style="margin-right:6px;"></i>'
        : (isSecurityCrumb ? '<i class="fa-solid fa-lock-open" style="margin-right:6px; color:#f59e0b;"></i>' : '');
    span.innerHTML = `${iconHtml}${escapeTreeHtml(crumbTitle)}`;

    span.onclick = () => {
      const si = document.getElementById("fm-search-input");
      if (si && si.value !== "") {
        si.value = "";
        syncFmSearchClearBtn();
      }
      if (p.id === null) {
        fmDriveCollapsed = false;
        currentFmFolderId = null;
        fmSelectedRowKey = "drive:root";
        fmFocusedRowKey = "drive:root";
      } else {
        fmDriveCollapsed = false;
        currentFmFolderId = p.id;
        fmExpandedSet.add(p.id);
        fmSelectedRowKey = `folder:${p.id}`;
        fmFocusedRowKey = fmSelectedRowKey;
      }
      renderFmTreeFromCache();
    };

    span.addEventListener("dragover", (e) => {
      if (window.__zenInternalTreeDragging || (e.dataTransfer && e.dataTransfer.types.includes("application/zen-fm-id"))) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        span.classList.add("fm-drag-over");
      }
    });
    span.addEventListener("dragleave", () => {
      span.classList.remove("fm-drag-over");
    });
    span.addEventListener("drop", async (e) => {
      span.classList.remove("fm-drag-over");
      const dragIds = parseDraggedTreeIds(e);
      if (dragIds.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      window.__zenInternalTreeDragging = false;
      __zenDraggedTreeIds = [];
      if (p.id === globalTrashFolderId) {
        await deleteItemsToTrashWithUndo(dragIds);
      } else {
        await moveItemsToFolder(dragIds, p.id);
      }
    });

    container.appendChild(span);

    if (!isLast) {
      const sep = document.createElement("i");
      sep.className = "fa-solid fa-chevron-right fm-crumb-sep";
      container.appendChild(sep);
    }
  });
}

// 🎯 [V1.5.0] FM 상단 경로 바 우측 원클릭 퀵 액션 버튼 (루트 새 노트 제거 -> 새 폴더, 선택, 펼침/접기, 정렬)
function renderFmQuickActions(cache) {
  const container = document.getElementById("fm-quick-actions");
  if (!container) return;

  let html = "";
  const dataCache = cache || window.__zenFmTreeDataCache;
  const hasExpanded = Array.from(fmExpandedSet).some((id) => {
    if (id === globalSecurityFolderId || id === globalTrashFolderId) return false;
    if (dataCache && (dataCache.isUnderSecuritySync(id) || dataCache.isUnderTrashSync(id))) return false;
    return !dataCache || dataCache.folderMap.has(id);
  });
  const sortMode = typeof getSidebarNoteSortMode === "function" ? getSidebarNoteSortMode() : "updated";
  const nextSort = sortMode === "name" ? "updated" : "name";

  if (isFmMultiSelectMode) {
    const selectableItems = (currentFmDisplayedItems || []).filter(
      (m) => m && !m.isSystem,
    );
    const allSelected =
      selectableItems.length > 0 &&
      selectableItems.every((m) => fmSelectedItems.has(m.id));
    html += `
      <button type="button" class="fm-quick-btn is-active" onclick="toggleFmSelectAll()" title="${allSelected ? "전체 선택 해제" : "전체 선택"}">
        <i class="fa-solid ${allSelected ? "fa-square-check" : "fa-list-check"}"></i> <span>${allSelected ? "전체 해제" : "전체 선택"}</span>
      </button>
      <button type="button" class="fm-quick-btn" onclick="toggleFmAllFolders()" title="${hasExpanded ? "모든 폴더 접기" : "모든 폴더 펼치기"}">
        <i class="fa-solid ${hasExpanded ? "fa-angles-up" : "fa-angles-down"}"></i> <span class="fm-quick-label">${hasExpanded ? "모두 접기" : "모두 펼치기"}</span>
      </button>
      <button type="button" class="fm-quick-btn" onclick="cancelFmMultiSelect()" title="선택 모드 취소">
        <i class="fa-solid fa-xmark"></i> <span class="fm-quick-label">취소</span>
      </button>
    `;
  } else {
    html += `
      <button type="button" class="fm-quick-btn" onclick="createNewFolder()" title="새 폴더 만들기">
        <i class="fa-solid fa-folder-plus"></i> <span class="fm-quick-label">새 폴더</span>
      </button>
      <button type="button" class="fm-quick-btn" onclick="startFmMultiSelect()" title="다중 선택 모드 켜기">
        <i class="fa-solid fa-list-check"></i> <span class="fm-quick-label">다중 선택</span>
      </button>
      <button type="button" class="fm-quick-btn" onclick="toggleFmAllFolders()" title="${hasExpanded ? "모든 폴더 접기" : "모든 폴더 펼치기"}">
        <i class="fa-solid ${hasExpanded ? "fa-angles-up" : "fa-angles-down"}"></i> <span class="fm-quick-label">${hasExpanded ? "모두 접기" : "모두 펼치기"}</span>
      </button>
      <button type="button" class="fm-quick-btn" onclick="setSidebarNoteSortMode('${nextSort}')" title="정렬 기준 전환 (현재: ${sortMode === "name" ? "이름순" : "최신 수정순"})">
        <i class="${sortMode === "name" ? "fa-solid fa-arrow-down-a-z" : "fa-regular fa-clock"}"></i> <span class="fm-quick-label">${sortMode === "name" ? "이름순" : "최신순"}</span>
      </button>
    `;
  }

  container.innerHTML = html;
}

// 🎯 [V4.2.4] 다중 선택 모드에서 현재 FM 화면의 선택 가능 항목 전체 선택 / 전체 해제 토글
function toggleFmSelectAll() {
  if (!isFmMultiSelectMode) {
    startFmMultiSelect();
    return;
  }
  const selectableItems = (currentFmDisplayedItems || []).filter(
    (m) => m && !m.isSystem,
  );
  if (selectableItems.length === 0) {
    showToast("선택할 수 있는 항목이 없습니다.");
    return;
  }
  const allSelected = selectableItems.every((m) => fmSelectedItems.has(m.id));
  if (allSelected) {
    selectableItems.forEach((m) => fmSelectedItems.delete(m.id));
  } else {
    selectableItems.forEach((m) => fmSelectedItems.add(m.id));
  }
  updateFmBottomBar();
  renderFmTreeFromCache();
}
window.toggleFmSelectAll = toggleFmSelectAll;

// 🎯 [V1.5.0] 파일관리창 상단 더보기 메뉴 (트리 탐색기 모드 기준)
function toggleFmGlobalMenu(e) {
  e.stopPropagation();
  if (typeof closeSidebarContextMenu === "function") closeSidebarContextMenu();
  const menu = document.getElementById("fm-global-menu");
  if (!menu) return;

  const sortMode = typeof getSidebarNoteSortMode === "function" ? getSidebarNoteSortMode() : "updated";
  let html = `
    <div class="fm-dropdown-item" onclick="createNewFolder()"><i class="fa-solid fa-folder-plus"></i> 새 폴더</div>
    <div class="fm-dropdown-item" onclick="startFmMultiSelect()"><i class="fa-solid fa-list-check"></i> 다중 선택</div>
    <div class="fm-dropdown-item" onclick="document.getElementById('fm-global-menu').classList.remove('is-active'); setFmAllUnderDriveExpanded(true)"><i class="fa-solid fa-angles-down"></i> 모두 펼치기</div>
    <div class="fm-dropdown-item" onclick="document.getElementById('fm-global-menu').classList.remove('is-active'); setFmAllUnderDriveExpanded(false)"><i class="fa-solid fa-angles-up"></i> 모두 접기</div>
    <div class="fm-dropdown-item" onclick="document.getElementById('fm-global-menu').classList.remove('is-active'); setSidebarNoteSortMode('updated')"><i class="${sortMode === 'updated' ? 'fa-solid fa-check' : 'fa-regular fa-clock'}" style="${sortMode === 'updated' ? 'color: var(--accent);' : ''}"></i> 정렬: 최신 수정순</div>
    <div class="fm-dropdown-item" onclick="document.getElementById('fm-global-menu').classList.remove('is-active'); setSidebarNoteSortMode('name')"><i class="${sortMode === 'name' ? 'fa-solid fa-check' : 'fa-solid fa-arrow-down-a-z'}" style="${sortMode === 'name' ? 'color: var(--accent);' : ''}"></i> 정렬: 이름순</div>
    <div class="fm-dropdown-item" onclick="document.getElementById('fm-global-menu').classList.remove('is-active'); emptyTrash()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> 휴지통 비우기</div>
  `;

  menu.innerHTML = html;
  menu.style.top = `${e.clientY + 10}px`;
  menu.style.left = `${Math.max(8, e.clientX - 150)}px`;
  menu.classList.toggle("is-active");
  const itemMenu = document.getElementById("fm-item-menu");
  if (itemMenu) itemMenu.classList.remove("is-active");
}

// 🎯 특정 폴더에 새 노트 작성 후 즉시 열기
function createNewMemoInFolder(folderId) {
  closeFileManager();
  createNewMemo(folderId);
  const gm = document.getElementById("fm-global-menu");
  if (gm) gm.classList.remove("is-active");
}

async function createFolderInsideTarget(targetParentId) {
  const itemMenu = document.getElementById("fm-item-menu");
  if (itemMenu) itemMenu.classList.remove("is-active");
  const globalMenu = document.getElementById("fm-global-menu");
  if (globalMenu) globalMenu.classList.remove("is-active");
  if (!db) return;

  const isUnderSec =
    targetParentId !== null && typeof checkIsUnderSecurity === "function"
      ? await checkIsUnderSecurity(targetParentId)
      : false;
  if (isUnderSec && !isSecurityUnlocked) {
    showToast("보안 폴더 잠금을 먼저 해제해주세요.");
    return;
  }

  const name = await requestFmTextInput({
    title: "하위 폴더 만들기",
    desc: "새 폴더 이름을 입력하세요.",
    defaultValue: "새 폴더",
    confirmText: "만들기",
    iconClass: "fa-solid fa-folder-plus",
  });
  if (!name || name.trim() === "") return;
  if (isUnderSec && !isSecurityUnlocked) return;

  let parentSyncId = null;
  if (targetParentId !== null) {
    const pf = await new Promise((resolve) => {
      db.transaction(["memos"], "readonly").objectStore("memos").get(targetParentId).onsuccess = (e) => resolve(e.target.result);
    });
    if (pf) parentSyncId = pf.syncId || null;
  }

  let createdId = null;
  const tx = db.transaction(["memos"], "readwrite");
  tx.objectStore("memos").add({
    title: name.trim(),
    type: "folder",
    parentId: targetParentId,
    parentSyncId: parentSyncId,
    syncId: typeof generateSyncId === "function" ? generateSyncId() : Date.now().toString(36),
    updatedAt: Date.now(),
    isDeleted: false,
  }).onsuccess = (e) => {
    createdId = e.target.result;
  };
  tx.oncomplete = () => {
    fmDriveCollapsed = false;
    if (targetParentId !== null) fmExpandedSet.add(targetParentId);
    if (createdId !== null && createdId !== undefined) {
      fmExpandedSet.add(createdId);
      currentFmFolderId = createdId;
      fmSelectedRowKey = `folder:${createdId}`;
      fmFocusedRowKey = fmSelectedRowKey;
    }
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
      loadFileManager(currentFmFolderId);
    }
    loadMemoList(true);
    updateUnsyncedCount();
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  };
}

// 🎯 파라미터에 sysType 및 isPinned 추가 및 3대장 메뉴 분기
function openFmItemMenu(e, id, type, isTrashMode, sysType, isPinned = false) {
  e.stopPropagation();
  document.getElementById("fm-global-menu").classList.remove("is-active");

  const menu = document.getElementById("fm-item-menu");
  let html = "";

  if (sysType === "desktop") {
    html = `
                    <div class="fm-dropdown-item" onclick="createNewMemoInFolder(${id})"><i class="fa-solid fa-pen-to-square"></i> 여기에 새 노트</div>
                    <div class="fm-dropdown-item" onclick="createFolderInsideTarget(${id})"><i class="fa-solid fa-folder-plus"></i> 하위 폴더 만들기</div>
                    <div class="fm-dropdown-item" onclick="emptyTempFolder()"><i class="fa-solid fa-broom" style="color: var(--danger);"></i> 임시 폴더 비우기</div>
                `;
  } else if (sysType === "bh_official" || sysType === "bh_memo" || sysType === "bh_doc") {
    html = `
                    <div class="fm-dropdown-item" onclick="createNewMemoInFolder(${id})"><i class="fa-solid fa-pen-to-square"></i> 여기에 새 노트</div>
                    <div class="fm-dropdown-item" onclick="createFolderInsideTarget(${id})"><i class="fa-solid fa-folder-plus"></i> 하위 폴더 만들기</div>
                `;
  } else if (sysType === "security") {
    const secAutoLockOn = isSecurityAutoLockEnabled();
    html = `
                    <div class="fm-dropdown-item" onclick="toggleSecurityAutoLock()"><i class="fa-solid ${secAutoLockOn ? "fa-shield-halved" : "fa-shield"}"></i> ${secAutoLockOn ? "오토락 사용" : "오토락 해제"}</div>
                    <div class="fm-dropdown-item" onclick="handleSecurityMenuChange()"><i class="fa-solid fa-key"></i> 비번 변경</div>
                    <div class="fm-dropdown-item" onclick="emergencyDeleteSecurity()"><i class="fa-solid fa-skull" style="color: var(--danger);"></i> 비상 삭제</div>
                `;
  } else if (sysType === "trash") {
    html = `<div class="fm-dropdown-item" onclick="emptyTrash()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> 비우기</div>`;
  } else if (isTrashMode) {
    html = `
                    <div class="fm-dropdown-item" onclick="fmRestore(${id})"><i class="fa-solid fa-rotate-left" style="color: var(--accent);"></i> 복구하기</div>
                    <div class="fm-dropdown-item" onclick="openMoveModal(${id})"><i class="fa-solid fa-arrows-up-down-left-right"></i> 이동하기</div>
                    <div class="fm-dropdown-item" onclick="fmHardDelete(${id})"><i class="fa-solid fa-xmark" style="color: var(--danger);"></i> 영구 삭제</div>
                `;
  } else {
    html = "";
    if (type !== "folder") {
      html += `<div class="fm-dropdown-item" onclick="fmTogglePin(${id})"><i class="fa-solid fa-thumbtack" style="color: ${isPinned ? "var(--text-muted)" : "var(--accent)"};"></i> ${isPinned ? "고정 해제" : "상단 고정"}</div>`;
    }
    html += `
                    <div class="fm-dropdown-item" onclick="fmRename(${id})"><i class="fa-solid fa-pen"></i> 이름 바꾸기</div>
                    <div class="fm-dropdown-item" onclick="openMoveModal(${id})"><i class="fa-solid fa-arrows-up-down-left-right"></i> 이동하기</div>
                `;
    if (type !== "folder") {
      html += `<div class="fm-dropdown-item" onclick="fmDuplicate(${id})"><i class="fa-solid fa-copy"></i> 복사본 만들기</div>`;
    }
    html += `<div class="fm-dropdown-item" onclick="fmDelete(${id})"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> 휴지통으로</div>`;
  }
  menu.innerHTML = html;
  menu.style.top = `${e.clientY + 10}px`;
  menu.style.left = `${e.clientX - 120}px`;
  menu.classList.add("is-active");
}

function emptyTempFolder() {
  const itemMenu = document.getElementById("fm-item-menu");
  if (itemMenu) itemMenu.classList.remove("is-active");
  const globalMenu = document.getElementById("fm-global-menu");
  if (globalMenu) globalMenu.classList.remove("is-active");
  if (!db || globalDesktopFolderId === null || globalDesktopFolderId === undefined) return;

  const txRead = db.transaction(["memos"], "readonly");
  txRead.objectStore("memos").getAll().onsuccess = (e) => {
    const allData = e.target.result || [];
    const targets = allData.filter(
      (m) =>
        m &&
        m.parentId === globalDesktopFolderId &&
        !m.isDeleted &&
        !m.isPermanentlyDeleted,
    );
    if (targets.length === 0) {
      if (typeof showToast === "function") showToast("임시 폴더가 이미 비어있습니다.");
      return;
    }
    if (!confirm(`임시 폴더의 모든 항목(${targets.length}개)을 휴지통으로 보내시겠습니까?`)) {
      return;
    }

    const now = Date.now();
    const undoPayload = [];
    const txWrite = db.transaction(["memos"], "readwrite");
    const store = txWrite.objectStore("memos");
    targets.forEach((m) => {
      m.isDeleted = true;
      m.deletedAt = now;
      m.updatedAt = now;
      store.put(m);
      undoPayload.push({ id: m.id, action: "restore" });
    });

    txWrite.oncomplete = () => {
      ensureActiveMemoNotDeleted();
      const fmPane = document.getElementById("file-manager-pane");
      if (fmPane && fmPane.style.display === "flex") {
        loadFileManager(currentFmFolderId);
      }
      loadMemoList(true);
      updateUnsyncedCount();
      if (typeof showToast === "function") {
        showToast("임시 폴더의 항목을 휴지통으로 이동했습니다.", undoPayload);
      }
      if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
    };
  };
}

// 🎯 [V4.5.3] FM에서 노트 핀 고정 / 고정 해제 토글
function fmTogglePin(id) {
  const itemMenu = document.getElementById("fm-item-menu");
  if (itemMenu) itemMenu.classList.remove("is-active");

  let isNowPinned = false;
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m || m.type === "folder") return;
    if (m.pinnedAt) {
      delete m.pinnedAt;
      isNowPinned = false;
    } else {
      m.pinnedAt = Date.now();
      isNowPinned = true;
    }
    m.updatedAt = Date.now();
    store.put(m);
  };
  tx.oncomplete = () => {
    loadFileManager(currentFmFolderId);
    loadMemoList(true);
    updateUnsyncedCount();
    showToast(isNowPinned ? "노트가 상단에 고정되었습니다." : "고정이 해제되었습니다.");
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  };
}

// 🎯 [V4.5.3] FM에서 삭제 작업 후 현재 에디터에 열려 있던 노트가 삭제(또는 상위 폴더 삭제)되었다면 즉시 바탕화면 1번 노트로 전환
function ensureActiveMemoNotDeleted() {
  if (!currentMemoId || !db) return;
  const tx = db.transaction(["memos"], "readonly");
  tx.objectStore("memos").getAll().onsuccess = (e) => {
    const allData = e.target.result || [];
    const cur = allData.find((m) => m.id === Number(currentMemoId));
    if (!cur || cur.isDeleted || cur.isPermanentlyDeleted) {
      if (typeof openTopDesktopMemo === "function") openTopDesktopMemo();
      return;
    }
    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });
    let p = cur.parentId;
    while (p) {
      if (p === globalTrashFolderId) {
        if (typeof openTopDesktopMemo === "function") openTopDesktopMemo();
        return;
      }
      const pf = folderMap.get(p);
      if (!pf) break;
      if (pf.isDeleted || pf.isPermanentlyDeleted || pf.isSystem === "trash") {
        if (typeof openTopDesktopMemo === "function") openTopDesktopMemo();
        return;
      }
      p = pf.parentId;
    }
  };
}

// 🎯 [V1.1.5] 인앱 텍스트 입력 모달 (OS prompt() 포커스 이탈/오토-락 오작동 원천 차단)
let pendingFmTextPromptResolve = null;

function ensureFmTextInputModal() {
  let modal = document.getElementById("fm-name-prompt-modal");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "fm-name-prompt-modal";
  modal.className = "fm-modal-overlay";
  modal.style.zIndex = "3500";
  modal.innerHTML = `
    <div class="fm-modal" style="max-width: 380px; width: 90vw;" onclick="event.stopPropagation()">
      <div class="fm-modal-header" style="padding: 15px 20px;">
        <span id="fm-name-prompt-title" style="font-size: 15.5px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-folder-plus" style="color: var(--accent);"></i>
          <span>새 폴더</span>
        </span>
        <i id="fm-name-prompt-x" class="fa-solid fa-xmark" style="cursor: pointer; font-size: 18px; color: var(--text-muted);"></i>
      </div>
      <div class="fm-modal-body" style="padding: 16px 20px;" onclick="event.stopPropagation()">
        <div id="fm-name-prompt-desc" style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px; line-height: 1.45;"></div>
        <input type="text" id="fm-name-prompt-input" class="link-field-input" autocomplete="off" />
      </div>
      <div class="fm-modal-footer" style="padding: 12px 18px;" onclick="event.stopPropagation()">
        <button type="button" id="fm-name-prompt-cancel-btn" style="background: var(--surface-hover); color: var(--text-main);">취소</button>
        <button type="button" id="fm-name-prompt-confirm-btn" style="background: var(--accent); color: var(--accent-contrast); font-weight: 700;">확인</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const input = modal.querySelector("#fm-name-prompt-input");
  const cancelBtn = modal.querySelector("#fm-name-prompt-cancel-btn");
  const confirmBtn = modal.querySelector("#fm-name-prompt-confirm-btn");
  const xBtn = modal.querySelector("#fm-name-prompt-x");

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeFmTextInputModal(null, false);
  });
  if (xBtn) xBtn.addEventListener("click", () => closeFmTextInputModal(null, false));
  if (cancelBtn) cancelBtn.addEventListener("click", () => closeFmTextInputModal(null, false));
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      closeFmTextInputModal(input ? input.value : "", false);
    });
  }
  if (input) {
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        setTimeout(() => closeFmTextInputModal(input.value, false), 0);
      } else if (e.key === "Escape") {
        e.preventDefault();
        closeFmTextInputModal(null, false);
      }
    });
  }

  return modal;
}

function closeFmTextInputModal(resultValue = null, fromPopstate = false) {
  const modal = document.getElementById("fm-name-prompt-modal");
  const resolveFn = pendingFmTextPromptResolve;
  pendingFmTextPromptResolve = null;

  if (modal && modal.style.display === "flex") {
    modal.style.display = "none";
  }

  const finish = () => {
    if (resolveFn) resolveFn(resultValue);
  };

  if (!fromPopstate && window.history.state && window.history.state.modal === "fm-name-prompt") {
    if (typeof programmaticBackCount !== "undefined") programmaticBackCount++;
    let settled = false;
    const onPop = () => {
      if (settled) return;
      settled = true;
      window.removeEventListener("popstate", onPop);
      finish();
    };
    window.addEventListener("popstate", onPop);
    history.back();
    setTimeout(() => {
      if (!settled) {
        settled = true;
        window.removeEventListener("popstate", onPop);
        finish();
      }
    }, 60);
    return;
  }

  finish();
}
window.closeFmTextInputModal = closeFmTextInputModal;

function requestFmTextInput({
  title = "새 폴더",
  desc = "이름을 입력하세요.",
  defaultValue = "",
  confirmText = "확인",
  iconClass = "fa-solid fa-folder-plus",
} = {}) {
  if (pendingFmTextPromptResolve) {
    closeFmTextInputModal(null, false);
  }

  const modal = ensureFmTextInputModal();
  const titleEl = modal.querySelector("#fm-name-prompt-title");
  const descEl = modal.querySelector("#fm-name-prompt-desc");
  const input = modal.querySelector("#fm-name-prompt-input");
  const confirmBtn = modal.querySelector("#fm-name-prompt-confirm-btn");

  if (titleEl) {
    titleEl.innerHTML = `<i class="${iconClass}" style="color: var(--accent);"></i><span>${title}</span>`;
  }
  if (descEl) descEl.textContent = desc;
  if (confirmBtn) confirmBtn.textContent = confirmText;
  if (input) input.value = defaultValue;

  modal.style.display = "flex";
  history.pushState({ modal: "fm-name-prompt" }, "");

  setTimeout(() => {
    if (input) {
      input.focus();
      input.select();
    }
  }, 40);

  return new Promise((resolve) => {
    pendingFmTextPromptResolve = resolve;
  });
}

// 1. 새 폴더 생성 (🎯 [V1.5.0] 트리 모드에서는 선택 폴더/루트에 생성 후 제자리 트리 확장 및 선택)
async function createNewFolder() {
  const globalMenu = document.getElementById("fm-global-menu");
  if (globalMenu) globalMenu.classList.remove("is-active");
  if (!db) return;

  const cache = window.__zenFmTreeDataCache || window.__zenTreeDataCache;
  let parent = currentFmFolderId;
  if (
    parent !== null &&
    parent !== undefined &&
    (parent === globalTrashFolderId || (cache && cache.isUnderTrashSync(parent)))
  ) {
    parent = null;
  }

  const isUnderSec = parent !== null && typeof checkIsUnderSecurity === "function"
    ? await checkIsUnderSecurity(parent)
    : false;
  if (isUnderSec && !isSecurityUnlocked) {
    showToast("보안 폴더 잠금을 먼저 해제해주세요.");
    return;
  }

  const name = await requestFmTextInput({
    title: "새 폴더",
    desc: parent !== null ? "선택한 폴더 아래에 새 폴더를 만듭니다." : `${getFmDriveRootTitle()} 아래에 새 폴더를 만듭니다.`,
    defaultValue: "새 폴더",
    confirmText: "만들기",
    iconClass: "fa-solid fa-folder-plus",
  });
  if (!name || name.trim() === "") return;
  if (isUnderSec && !isSecurityUnlocked) return;

  const trimmedName = name.trim();
  let parentSyncId = null;
  if (parent !== null && db) {
    const parentObj = await new Promise((resolve) => {
      db
        .transaction(["memos"], "readonly")
        .objectStore("memos")
        .get(parent).onsuccess = (e) => resolve(e.target.result);
    });
    if (parentObj) parentSyncId = parentObj.syncId || null;
  }

  const tx = db.transaction(["memos"], "readwrite");
  let createdFolderId = null;
  tx.objectStore("memos").add({
    title: trimmedName,
    type: "folder",
    parentId: parent,
    parentSyncId: parentSyncId,
    syncId: typeof generateSyncId === "function" ? generateSyncId() : Date.now().toString(36),
    updatedAt: Date.now(),
    isDeleted: false,
  }).onsuccess = (e) => {
    createdFolderId = e.target.result;
  };

  tx.oncomplete = () => {
    fmDriveCollapsed = false;
    if (parent !== null) {
      fmExpandedSet.add(parent);
      if (!isUnderSec) sidebarExpandedSet.add(parent);
    }
    if (createdFolderId !== null && createdFolderId !== undefined) {
      fmExpandedSet.add(createdFolderId);
      currentFmFolderId = createdFolderId;
      fmSelectedRowKey = `folder:${createdFolderId}`;
      fmFocusedRowKey = fmSelectedRowKey;
      if (!isUnderSec) sidebarExpandedSet.add(createdFolderId);
    }
    if (!isUnderSec && typeof saveSidebarExpandedState === "function") saveSidebarExpandedState();
    const searchInput = document.getElementById("fm-search-input");
    if (searchInput && searchInput.value !== "") {
      searchInput.value = "";
      syncFmSearchClearBtn();
    }
    loadFileManager(currentFmFolderId);
    loadMemoList(true);
    updateUnsyncedCount();
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 2. 이름 바꾸기 (🎯 [V1.5.0] 사이드바·폴더관리 통합 실행 취소 토스트 및 Ctrl+Z 지원)
async function fmRename(id) {
  const itemMenu = document.getElementById("fm-item-menu");
  if (itemMenu) itemMenu.classList.remove("is-active");
  if (!db) return;

  const target = await new Promise((resolve) => {
    db
      .transaction(["memos"], "readonly")
      .objectStore("memos")
      .get(id).onsuccess = (e) => resolve(e.target.result);
  });
  if (!target) return;
  if (target.isSystem) {
    if (typeof showToast === "function") showToast("시스템 폴더 이름은 변경할 수 없습니다.");
    return;
  }

  const isUnderSec = target.parentId !== null && typeof checkIsUnderSecurity === "function"
    ? await checkIsUnderSecurity(target.parentId)
    : false;
  if (isUnderSec && !isSecurityUnlocked) {
    showToast("보안 폴더 잠금을 먼저 해제해주세요.");
    return;
  }

  const oldTitle = target.title || "";
  const newName = await requestFmTextInput({
    title: "이름 바꾸기",
    desc: "새 이름을 입력하세요.",
    defaultValue: oldTitle,
    confirmText: "변경",
    iconClass: "fa-solid fa-pen",
  });
  if (!newName || newName.trim() === "" || newName.trim() === oldTitle) return;
  if (isUnderSec && !isSecurityUnlocked) return;

  const trimmedTitle = newName.trim();
  let renamedTitle = null;
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m) return;
    renamedTitle = trimmedTitle;
    m.title = renamedTitle;
    m.updatedAt = Date.now();
    store.put(m);
  };
  tx.oncomplete = () => {
    if (renamedTitle !== null) {
      if (typeof updateRecentNoteTitleIfExist === "function") {
        updateRecentNoteTitleIfExist(id, renamedTitle);
      }
      if (Number(currentMemoId) === Number(id)) {
        const titleInput = document.getElementById("memo-title-input");
        if (titleInput) titleInput.value = renamedTitle;
        document.title = renamedTitle;
      }
      if (typeof showToast === "function") {
        showToast("이름이 변경되었습니다.", [{ id, action: "renameBack", oldTitle }]);
      }
    }
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
      loadFileManager(currentFmFolderId);
    }
    loadMemoList(true);
    updateUnsyncedCount();
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 3. 파일 복사본 만들기
function fmDuplicate(id) {
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m || m.type === "folder") return;

    const clone = {
      ...m,
      syncId: generateSyncId(),
      title: `(사본) ${m.title}`,
      updatedAt: Date.now(),
    };
    delete clone.id; // 🎯 복사본에 완전히 새로운 ID가 발급되도록 기존 ID 폐기
    store.add(clone);
  };
  tx.oncomplete = () => {
    loadFileManager(currentFmFolderId);
    loadMemoList(true);
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// [V1.7.9] 보안 폴더 내 노트 생성/수정/조회/삭제 시 순간 포커스 이탈 오토락 보호
function guardSecurityCrudAutoLock(durationMs = 1000) {
  if (
    ((typeof isSecurityUnlocked !== "undefined" && isSecurityUnlocked) ||
      (typeof isEditingSecureMemo !== "undefined" && isEditingSecureMemo)) &&
    typeof markSecurityCrudActivity === "function"
  ) {
    markSecurityCrudActivity(durationMs);
  }
}

// 4. 휴지통으로 이동
function fmDelete(id) {
  guardSecurityCrudAutoLock(1000);
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  let deletedAny = false;
  store.get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m || m.isSystem) return;
    m.isDeleted = true;
    m.deletedAt = Date.now();
    m.updatedAt = Date.now();
    store.put(m);
    deletedAny = true;
  };
  tx.oncomplete = () => {
    if (!deletedAny) return;
    ensureActiveMemoNotDeleted();
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
      loadFileManager(currentFmFolderId);
    }
    loadMemoList(true);
    const trashPane = document.getElementById("trash-pane");
    if (trashPane && trashPane.classList.contains("is-open")) loadTrashList();
    updateUnsyncedCount();
    showToast("휴지통으로 이동되었습니다.", [{ id: id, action: "restore" }]);
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 5. 복구하기 (부모 폴더가 없거나 삭제 상태이면 임시 폴더로 구출)
function fmRestore(id) {
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.getAll().onsuccess = (e) => {
    const allData = e.target.result || [];
    const byId = new Map();
    allData.forEach((entry) => byId.set(entry.id, entry));
    const m = byId.get(id);
    if (!m) return;
    m.isDeleted = false;
    delete m.deletedAt;
    if (m.parentId !== null && m.parentId !== undefined) {
      const p = byId.get(m.parentId);
      if (!p || p.isDeleted || p.isPermanentlyDeleted) {
        if (m.type === "folder") {
          m.parentId = null;
          delete m.parentSyncId;
        } else if (typeof globalDesktopFolderId !== "undefined" && globalDesktopFolderId !== null) {
          m.parentId = globalDesktopFolderId;
          m.parentSyncId = "sys_desktop";
        }
      }
    }
    m.updatedAt = Date.now();
    store.put(m);
  };
  tx.oncomplete = () => {
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
      loadFileManager(currentFmFolderId);
    }
    loadMemoList(true);
    const trashPane = document.getElementById("trash-pane");
    if (trashPane && trashPane.classList.contains("is-open")) loadTrashList();
    updateUnsyncedCount();
    if (typeof showToast === "function") showToast("항목이 복구되었습니다.");
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 6. 영구 삭제 (폴더인 경우 하위 자손도 함께 영구 삭제 처리)
function fmHardDelete(id) {
  guardSecurityCrudAutoLock(1000);
  if (!confirm("이 항목을 영구 삭제하시겠습니까?")) return;
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m || m.isSystem) return;
    m.isPermanentlyDeleted = true;
    m.updatedAt = Date.now();
    store.put(m);
    if (m.type === "folder" && typeof markDescendantsPermanentlyDeleted === "function") {
      markDescendantsPermanentlyDeleted(store, m.id);
    }
  };
  tx.oncomplete = () => {
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
      loadFileManager(currentFmFolderId);
    }
    loadMemoList(true);
    const trashPane = document.getElementById("trash-pane");
    if (trashPane && trashPane.classList.contains("is-open")) loadTrashList();
    updateUnsyncedCount();
    if (typeof showToast === "function") showToast("항목이 영구 삭제되었습니다.");
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 🎯 [No.016] 다중 선택 및 이동/삭제 통합 로직
let movingItemIds = []; // 단일/다중 이동을 모두 담는 배열로 업그레이드!
let selectedDestId = undefined;

let isFmMultiSelectMode = false;

// 🎯 [No.020] 보안 폴더 전용 변수 및 해시 엔진
let securityMode = "enter"; // 'setup', 'enter', 'change', 'disableAutoLock'
let tempSecPassword = ""; // 👈 [신규] 2번 입력할 때 처음 입력한 비번을 기억할 변수
let secLiveCheckSeq = 0;

const SEC_AUTOLOCK_STORAGE_KEY = "zen_sec_autolock";

function isSecurityAutoLockEnabled() {
  try {
    return localStorage.getItem(SEC_AUTOLOCK_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function setSecurityAutoLockEnabled(enabled) {
  try {
    localStorage.setItem(SEC_AUTOLOCK_STORAGE_KEY, enabled ? "true" : "false");
  } catch {}
}

function toggleSecurityAutoLock() {
  const fmGlobal = document.getElementById("fm-global-menu");
  if (fmGlobal) fmGlobal.classList.remove("is-active");
  const fmItem = document.getElementById("fm-item-menu");
  if (fmItem) fmItem.classList.remove("is-active");

  if (!isSecurityAutoLockEnabled()) {
    setSecurityAutoLockEnabled(true);
    if (typeof showToast === "function") {
      showToast("보안 폴더 오토락이 활성화되었습니다.");
    }
    return;
  }

  if (!localStorage.getItem("zen_sec_hash")) {
    if (typeof showToast === "function") {
      showToast("먼저 보안 폴더 비밀번호를 설정해 주세요.");
    }
    return;
  }
  openSecurityModal("disableAutoLock");
}

window.isSecurityAutoLockEnabled = isSecurityAutoLockEnabled;
window.setSecurityAutoLockEnabled = setSecurityAutoLockEnabled;
window.toggleSecurityAutoLock = toggleSecurityAutoLock;

// 비밀번호를 복호화 불가능한 난수(Hash)로 변환하는 함수
async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 🎯 보안 팝업 열기 (UI 문구 및 상태 초기화)
function openSecurityModal(mode) {
  securityMode = mode;
  secLiveCheckSeq++;
  const modal = document.getElementById("fm-security-modal");
  const title = document
    .getElementById("sec-modal-title")
    .querySelector("span");
  const desc = document.getElementById("sec-modal-desc");
  const input = document.getElementById("sec-password-input");
  const btn = document.getElementById("sec-confirm-btn");

  // 🎯 [핵심 1] 팝업이 열릴 때 반드시 방어막을 1장 추가합니다!
  history.pushState({ mode: "modal" }, "");

  // 팝업이 열릴 때마다 입력창과 상태를 깨끗하게 초기화
  input.value = "";
  input.dataset.step = "1";
  tempSecPassword = "";
  modal.style.display = "flex";
  setTimeout(() => input.focus(), 100);

  if (mode === "setup") {
    title.innerHTML =
      '<i class="fa-solid fa-key" style="color: #f59e0b;"></i> 비번 설정';
    desc.innerHTML = "보안 폴더에 사용할 <b>새 비밀번호</b>를 입력하세요.";
    btn.innerText = "다음"; // 1차 입력이므로 '다음'으로 표기
  } else if (mode === "change") {
    title.innerHTML =
      '<i class="fa-solid fa-key" style="color: #f59e0b;"></i> 비번 변경';
    desc.innerHTML = "<b>현재 비밀번호</b>를 입력하세요.";
    btn.innerText = "다음";
  } else if (mode === "disableAutoLock") {
    title.innerHTML =
      '<i class="fa-solid fa-shield-halved" style="color: #f59e0b;"></i> 오토락 해제';
    desc.innerHTML = "보안 폴더 오토락을 해제하려면 <b>비밀번호</b>를 입력하세요.";
    btn.innerText = "오토락 해제";
  } else {
    // enter
    title.innerHTML =
      '<i class="fa-solid fa-lock" style="color: #f59e0b;"></i> 보안 폴더';
    desc.innerHTML = "비밀번호를 입력하세요.";
    btn.innerText = "잠금 해제";
  }
}

// 🎯 [완벽 교정]
function closeSecurityModal(fromPopstate = false) {
  secLiveCheckSeq++;
  pendingRecentSecureMemoId = null;
  window.__zenPendingSidebarSecurityExpand = false;
  if (document.getElementById("fm-security-modal").style.display === "none")
    return;
  document.getElementById("fm-security-modal").style.display = "none";

  // 모달이 닫힐 때 유령 방어막 청소
  if (!fromPopstate) {
    programmaticBackCount++; // 스위치 켜기 대신 숫자를 1 올림
    history.back();
  }
}

let isSecSubmitting = false;

async function handleSecurityPasswordInputLive() {
  if (isSecSubmitting) return;
  const modal = document.getElementById("fm-security-modal");
  if (!modal || modal.style.display !== "flex") return;
  const input = document.getElementById("sec-password-input");
  if (!input) return;

  const isLiveTarget =
    securityMode === "enter" ||
    securityMode === "disableAutoLock" ||
    (securityMode === "change" && input.dataset.step === "1");
  if (!isLiveTarget) return;

  const pw = input.value.trim();
  if (!pw) return;

  const savedHash = localStorage.getItem("zen_sec_hash");
  if (!savedHash) return;

  const seq = ++secLiveCheckSeq;
  const hash = await hashPassword(pw);
  if (seq !== secLiveCheckSeq || isSecSubmitting || modal.style.display !== "flex") return;
  if (hash === savedHash) {
    submitSecurityPassword();
  }
}
window.handleSecurityPasswordInputLive = handleSecurityPasswordInputLive;

// 🎯 비밀번호 제출 및 검증 로직
async function submitSecurityPassword() {
  if (isSecSubmitting) return;
  secLiveCheckSeq++;
  const input = document.getElementById("sec-password-input");
  const desc = document.getElementById("sec-modal-desc");
  const btn = document.getElementById("sec-confirm-btn");
  const pw = input.value.trim();

  if (!pw) {
    showToast("비밀번호를 입력하세요.");
    return;
  }

  isSecSubmitting = true;
  if (btn) btn.disabled = true;

  try {
  const savedHash = localStorage.getItem("zen_sec_hash");
  const step = input.dataset.step;

  // ----------------------------------------------------
  // 1. 잠금 해제 (Enter)
  // ----------------------------------------------------
  if (securityMode === "enter") {
    const hash = await hashPassword(pw);
    if (hash === savedHash) {
      isSecurityUnlocked = true;
      currentSecKey = await getCryptoKey(pw); // 🚀 [핵심] 암호화 열쇠 획득!
      document.getElementById("fm-security-modal").style.display = "none";

      // 🎯 [V4.2.2] 최근 노트에서 보안 노트를 클릭하여 비번을 입력한 경우: FM으로 가지 않고 즉시 해당 노트를 복호화하여 오픈!
      if (pendingRecentSecureMemoId !== null) {
        const targetId = pendingRecentSecureMemoId;
        pendingRecentSecureMemoId = null;
        programmaticBackCount++;
        history.back();
        const fmPane = document.getElementById("file-manager-pane");
        if (fmPane && fmPane.style.display === "flex") {
          closeFileManager();
        }
        if (Number(currentMemoId) === Number(targetId)) {
          currentMemoId = null;
        }
        loadMemo(targetId);
      } else if (window.__zenPendingSidebarSecurityExpand || window.__zenPendingFmSecurityExpand) {
        const fromFm = !!window.__zenPendingFmSecurityExpand;
        const fromSidebar = !!window.__zenPendingSidebarSecurityExpand;
        window.__zenPendingSidebarSecurityExpand = false;
        window.__zenPendingFmSecurityExpand = false;
        programmaticBackCount++;
        history.back();
        if (globalSecurityFolderId !== null) {
          if (fromSidebar && typeof expandSidebarFolderInMemory === "function") {
            expandSidebarFolderInMemory(globalSecurityFolderId);
          }
          if (fromFm) {
            fmExpandedSet.add(globalSecurityFolderId);
            currentFmFolderId = globalSecurityFolderId;
            fmSelectedRowKey = `folder:${globalSecurityFolderId}`;
            fmFocusedRowKey = fmSelectedRowKey;
            loadFileManager(globalSecurityFolderId);
          }
        }
        loadMemoList(true);
        if (typeof showToast === "function") {
          showToast("보안 폴더 잠금이 해제되었습니다.");
        }
      } else {
        enterSecurityFolder(); // 이 안에서 replaceState가 작동!
      }
    } else {
      showToast("비밀번호가 일치하지 않습니다.");
      input.value = "";
      setTimeout(() => { input.focus(); }, 60);
    }
  }
  // ----------------------------------------------------
  // 2. 새 비밀번호 설정 (Setup) - 2단계 확인
  // ----------------------------------------------------
  else if (securityMode === "setup") {
    if (step === "1") {
      tempSecPassword = pw; // 1차 입력값 기억
      input.dataset.step = "2";
      input.value = "";
      desc.innerHTML = "확인을 위해 <b>1번 더 입력하세요.</b>"; // UI 문구 변경
      btn.innerText = "설정 완료";
      setTimeout(() => { input.focus(); }, 60);
    } else if (step === "2") {
      if (pw === tempSecPassword) {
        const hash = await hashPassword(pw);
        localStorage.setItem("zen_sec_hash", hash);
        showToast("비밀번호가 안전하게 설정되었습니다.");

        isSecurityUnlocked = true;
        currentSecKey = await getCryptoKey(pw); // 🚀 [핵심] 암호화 열쇠 획득!
        document.getElementById("fm-security-modal").style.display = "none";

        if (pendingRecentSecureMemoId !== null) {
          const targetId = pendingRecentSecureMemoId;
          pendingRecentSecureMemoId = null;
          programmaticBackCount++;
          history.back();
          const fmPane = document.getElementById("file-manager-pane");
          if (fmPane && fmPane.style.display === "flex") {
            closeFileManager();
          }
          if (Number(currentMemoId) === Number(targetId)) {
            currentMemoId = null;
          }
          loadMemo(targetId);
        } else if (window.__zenPendingSidebarSecurityExpand || window.__zenPendingFmSecurityExpand) {
          const fromFm = !!window.__zenPendingFmSecurityExpand;
          const fromSidebar = !!window.__zenPendingSidebarSecurityExpand;
          window.__zenPendingSidebarSecurityExpand = false;
          window.__zenPendingFmSecurityExpand = false;
          programmaticBackCount++;
          history.back();
          if (globalSecurityFolderId !== null) {
            if (fromSidebar && typeof expandSidebarFolderInMemory === "function") {
              expandSidebarFolderInMemory(globalSecurityFolderId);
            }
            if (fromFm) {
              fmExpandedSet.add(globalSecurityFolderId);
              currentFmFolderId = globalSecurityFolderId;
              fmSelectedRowKey = `folder:${globalSecurityFolderId}`;
              fmFocusedRowKey = fmSelectedRowKey;
              loadFileManager(globalSecurityFolderId);
            }
          }
          loadMemoList(true);
          if (typeof showToast === "function") {
            showToast("보안 폴더 잠금이 해제되었습니다.");
          }
        } else {
          enterSecurityFolder();
        }
      } else {
        showToast("비밀번호가 일치하지 않습니다. 처음부터 다시 입력해주세요.");
        openSecurityModal("setup"); // 1단계로 강제 초기화
        setTimeout(() => { input.focus(); }, 120);
      }
    }
  }
  // ----------------------------------------------------
  // 3. 비밀번호 변경 (Change) - 3단계 확인
  // ----------------------------------------------------
  else if (securityMode === "change") {
    if (step === "1") {
      const hash = await hashPassword(pw);
      if (hash === savedHash) {
        // 현재 비번이 맞으면 새 비번 입력 단계로 이동
        input.dataset.step = "2";
        input.value = "";
        desc.innerHTML = "<b>새 비밀번호</b>를 입력하세요.";
        setTimeout(() => { input.focus(); }, 60);
      } else {
        showToast("현재 비밀번호가 틀렸습니다.");
        input.value = "";
        setTimeout(() => { input.focus(); }, 60);
      }
    } else if (step === "2") {
      tempSecPassword = pw; // 새 비번 1차 입력값 기억
      input.dataset.step = "3";
      input.value = "";
      desc.innerHTML = "확인을 위해 <b>1번 더 입력하세요.</b>"; // UI 문구 변경
      btn.innerText = "변경 완료";
      setTimeout(() => { input.focus(); }, 60);
    } else if (step === "3") {
      if (pw === tempSecPassword) {
        // 새 비번 1차 입력값과 일치하면 최종 저장
        const hash = await hashPassword(pw);
        localStorage.setItem("zen_sec_hash", hash);
        currentSecKey = await getCryptoKey(pw); // 🚀 [핵심] 암호화 열쇠 최신화!
        showToast("비밀번호가 성공적으로 변경되었습니다.");
        closeSecurityModal();
      } else {
        showToast(
          "비밀번호가 일치하지 않습니다. 새 비밀번호를 다시 입력해주세요.",
        );
        // 2단계(새 비번 다시 입력)로 되돌림
        input.dataset.step = "2";
        input.value = "";
        desc.innerHTML = "<b>새 비밀번호</b>를 입력하세요.";
        btn.innerText = "다음";
        setTimeout(() => { input.focus(); }, 60);
      }
    }
  }
  // ----------------------------------------------------
  // 4. 오토락 해제 확인 (disableAutoLock)
  // ----------------------------------------------------
  else if (securityMode === "disableAutoLock") {
    const hash = await hashPassword(pw);
    if (hash === savedHash) {
      setSecurityAutoLockEnabled(false);
      closeSecurityModal();
      if (typeof showToast === "function") {
        showToast("보안 폴더 오토락이 해제되었습니다.");
      }
    } else {
      showToast("비밀번호가 일치하지 않습니다.");
      input.value = "";
      setTimeout(() => { input.focus(); }, 60);
    }
  }
  } finally {
    isSecSubmitting = false;
    if (btn) btn.disabled = false;
  }
}

function enterSecurityFolder() {
  fmPath.push({ id: globalSecurityFolderId, title: "보안 폴더" });

  // 🚨 [완벽 교정] 기획자님 말씀대로 "다른 일반 폴더랑 똑같이" pushState를 기본으로 씁니다!
  // 단, 방금 전 비밀번호 팝업창을 거쳐왔을 때(mode === 'modal')만 예외적으로 팝업 기록을 덮어씁니다.
  if (history.state && history.state.mode === "modal") {
    history.replaceState(
      { fmOpen: true, fmFolderId: globalSecurityFolderId, fmPath: fmPath },
      "",
    );
  } else {
    history.pushState(
      { fmOpen: true, fmFolderId: globalSecurityFolderId, fmPath: fmPath },
      "",
    );
  }

  loadFileManager(globalSecurityFolderId);
}

function handleSecurityMenuChange() {
  document.getElementById("fm-global-menu").classList.remove("is-active");
  const hasPw = localStorage.getItem("zen_sec_hash");
  openSecurityModal(hasPw ? "change" : "setup"); // 비번 없으면 똑똑하게 설정 창으로
}

// 🎯 [킬 스위치] 지인들의 뼈아픈 경험을 위한 비상 삭제 시스템
function emergencyDeleteSecurity() {
  document.getElementById("fm-global-menu").classList.remove("is-active");
  if (!localStorage.getItem("zen_sec_hash")) {
    showToast("설정된 비밀번호가 없어 삭제할 내용이 없습니다.");
    return;
  }

  const confirmText = prompt(
    '🚨  [모든 내용 삭제] + [비번 초기화]  🚨\n       "동의"라고 입력하세요.',
  );
  if (confirmText !== "동의") {
    showToast("비상 삭제가 취소되었습니다.");
    return;
  }

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  store.getAll().onsuccess = (e) => {
    const allData = e.target.result;
    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });

    function isDescendantOfSec(parentId) {
      let curr = parentId;
      while (curr) {
        if (curr === globalSecurityFolderId) return true;
        const pf = folderMap.get(curr);
        if (!pf) break;
        curr = pf.parentId;
      }
      return false;
    }

    allData.forEach((m) => {
      if (m.isSystem === "security") return; // 폴더 껍데기는 살려둠
      // 보안폴더 직속이거나 하위 자손이면 가차 없이 영구 삭제 처리 (클라우드도 함께 삭제 연동)!
      if (
        m.parentId === globalSecurityFolderId ||
        isDescendantOfSec(m.parentId)
      ) {
        m.isPermanentlyDeleted = true;
        m.updatedAt = Date.now();
        store.put(m);
      }
    });
  };

  tx.oncomplete = () => {
    localStorage.removeItem("zen_sec_hash");
    localStorage.removeItem(SEC_AUTOLOCK_STORAGE_KEY);
    isSecurityUnlocked = false;
    currentSecKey = null;
    showToast("보안 폴더 데이터가 삭제되고 비밀 번호가 초기화되었습니다.");
    resetFmToHome();

    // 🚀 [추가] 보안 폴더 폭파 후, 안전하게 바탕화면 1등 노트를 엽니다!
    if (typeof openTopDesktopMemo === 'function') openTopDesktopMemo();

    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

let fmSelectedItems = new Set();
// 🎯 [완벽 교정] 여러 겹의 방어막을 동시에 해제할 수 있도록 카운터로 업그레이드! (globals.js에서 전역 관리)
programmaticBackCount = 0;

// 🎯 [신규] 파일 관리창 전용 롱프레스(길게 누르기) 다중 선택 진입
function startFmPress(e, m) {
  if (e.target.closest(".memo-actions-wrap")) return; // 메뉴 터치 시 무시
  if (e.type === "touchstart" && e.touches.length > 1) return; // 멀티터치 무시

  isPressTriggered = false;

  // 🎯 시스템 폴더는 롱프레스 다중 선택에서 제외
  if (m.isSystem) return;

  pressTimer = setTimeout(() => {
    isPressTriggered = true;
    if (navigator.vibrate) navigator.vibrate(50); // 햅틱 피드백

    if (!isFmMultiSelectMode) {
      fmSelectedItems.clear();
      isFmMultiSelectMode = true;
      history.pushState({ mode: "multi" }, ""); // 👈 3. 파일관리창 방어막 추가!
    }

    fmSelectedItems.add(m.id); // 꾹 누른 녀석을 첫 번째로 선택
    lastFmSelectedId = m.id;
    document.getElementById("fm-global-menu").classList.remove("is-active");

    updateFmBottomBar();
    loadFileManager(currentFmFolderId); // 체크박스 렌더링
  }, 500); // 0.5초 꾹 누르면 발동
}

// 🎯 위치 및 선택 항목 소속에 따라 하단 바 버튼 세팅을 지능형으로 렌더링
function updateFmBottomBar() {
  const bar = document.getElementById("fm-bottom-bar");
  const countLabel = document.getElementById("fm-selected-count");
  const btnGroup = document.getElementById("fm-bottom-btn-group");
  const fmBody = document.querySelector(".fm-body");
  if (!bar) return;

  if (isFmMultiSelectMode) {
    bar.classList.add("is-visible");
    if (fmBody) fmBody.classList.add("has-bottom-bar");

    if (countLabel) countLabel.innerText = `${fmSelectedItems.size}개 선택됨`;

    const allTrashSelected = areAllSelectedFmItemsInTrash();
    if (btnGroup) {
      if (allTrashSelected && fmSelectedItems.size > 0) {
        btnGroup.innerHTML = `
                          <button class="fm-bottom-btn" onclick="fmBatchRestore()"><i class="fa-solid fa-rotate-left" style="color: var(--accent);"></i> <span style="color: var(--accent);">복구</span></button>
                          <button class="fm-bottom-btn" onclick="fmBatchHardDelete()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> <span style="color: var(--danger);">영구 삭제</span></button>
                      `;
      } else {
        btnGroup.innerHTML = `
                          <button class="fm-bottom-btn" onclick="openFmBatchMoveModal()"><i class="fa-solid fa-arrows-up-down-left-right" style="color: var(--accent);"></i> <span style="color: var(--accent);">이동</span></button>
                          <button class="fm-bottom-btn" onclick="fmBatchDelete()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> <span style="color: var(--danger);">휴지통으로</span></button>
                      `;
      }
    }
  } else {
    bar.classList.remove("is-visible");
    bar.classList.remove("is-hidden-by-scroll");
    if (fmBody) fmBody.classList.remove("has-bottom-bar");
  }
}

// 🎯 [완벽 교정] 다중 선택 영구 삭제 / 휴지통 이동 처리
function fmBatchHardDelete() {
  if (fmSelectedItems.size === 0) {
    showToast("삭제할 항목을 선택해주세요.");
    return;
  }

  const isInsideTrash = areAllSelectedFmItemsInTrash();
  const confirmMsg = isInsideTrash
    ? `선택한 ${fmSelectedItems.size}개 항목을 영구 삭제(복구 불가) 하시겠습니까?`
    : `선택한 ${fmSelectedItems.size}개 항목을 휴지통으로 보낼까요?`;

  if (!confirm(confirmMsg)) return;

  const targetIds = Array.from(fmSelectedItems);
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  const undoPayload = [];
  let affectedCount = 0;

  targetIds.forEach((id) => {
    store.get(id).onsuccess = (e) => {
      const m = e.target.result;
      if (m && !m.isSystem) {
        if (m.isDeleted || isInsideTrash) {
          m.isPermanentlyDeleted = true;
          if (m.type === "folder" && typeof markDescendantsPermanentlyDeleted === "function") {
            markDescendantsPermanentlyDeleted(store, m.id);
          }
        } else {
          m.isDeleted = true;
          m.deletedAt = Date.now();
          undoPayload.push({ id: m.id, action: "restore" });
        }
        m.updatedAt = Date.now();
        store.put(m);
        affectedCount++;
      }
    };
  });

  tx.oncomplete = () => {
    cancelFmMultiSelect();
    ensureActiveMemoNotDeleted();
    loadMemoList(true);
    const trashPane = document.getElementById("trash-pane");
    if (trashPane && trashPane.classList.contains("is-open")) loadTrashList();
    updateUnsyncedCount();

    if (isInsideTrash) {
      showToast(`${affectedCount}개 항목이 영구 삭제되었습니다.`);
    } else if (undoPayload.length > 0) {
      showToast(`${undoPayload.length}개 항목이 휴지통으로 이동되었습니다.`, undoPayload);
    }
    loadFileManager(currentFmFolderId);
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

function startFmMultiSelect() {
  const globalMenu = document.getElementById("fm-global-menu");
  const itemMenu = document.getElementById("fm-item-menu");

  if (globalMenu) globalMenu.classList.remove("is-active");
  if (itemMenu) itemMenu.classList.remove("is-active");

  if (!isFmMultiSelectMode) {
    // 🎯 메뉴 방어막이 사라졌으므로, 교체(replace)가 아닌 무조건 추가(push)를 합니다!
    history.pushState({ mode: "multi" }, "");
  }

  isFmMultiSelectMode = true;
  fmSelectedItems.clear();
  lastFmSelectedId = null;
  updateFmBottomBar();
  loadFileManager(currentFmFolderId);
}

// 🎯 [완벽 교정]
function cancelFmMultiSelect(fromPopstate = false) {
  if (!isFmMultiSelectMode) return;
  isFmMultiSelectMode = false;
  fmSelectedItems.clear();
  lastFmSelectedId = null;

  updateFmBottomBar();
  loadFileManager(currentFmFolderId);

  if (!fromPopstate) {
    programmaticBackCount++; // 숫자를 1 올림
    history.back();
  }
}

// 단일 항목 이동 (기존 팝업에서 호출)
function openMoveModal(id) {
  movingItemIds = [id];
  selectedDestId = undefined;

  const itemMenu = document.getElementById("fm-item-menu");
  const globalMenu = document.getElementById("fm-global-menu");

  if (itemMenu) itemMenu.classList.remove("is-active");
  if (globalMenu) globalMenu.classList.remove("is-active");

  // 🎯 교체(replace) 로직을 지우고, 모달이 뜨므로 무조건 방어막 1장 추가(push)!
  history.pushState({ mode: "modal" }, "");

  document.getElementById("fm-move-modal").style.display = "flex";
  renderDestFolders();
}

// 🎯 일괄 이동 (하단 액션바에서 호출)
function openFmBatchMoveModal() {
  if (fmSelectedItems.size === 0) {
    showToast("이동할 항목을 선택해주세요.");
    return;
  }
  movingItemIds = Array.from(fmSelectedItems); // 선택된 놈들을 싹 다 배열로!
  selectedDestId = undefined;
  history.pushState({ mode: "modal" }, ""); // 👈 추가: 다중선택 위에 모달이 뜨므로 방어막 1장 추가!
  document.getElementById("fm-move-modal").style.display = "flex";
  renderDestFolders();
}

// 🎯 [완벽 교정] 위치 및 선택 항목 소속에 따른 다중 선택 삭제/영구삭제 분기 로직
function fmBatchDelete() {
  guardSecurityCrudAutoLock(1000);
  if (fmSelectedItems.size === 0) {
    showToast("삭제할 항목을 선택해주세요.");
    return;
  }

  const isInsideTrash = areAllSelectedFmItemsInTrash();
  if (isInsideTrash) {
    fmBatchHardDelete();
    return;
  }
  const confirmMsg = `선택한 ${fmSelectedItems.size}개 항목을 휴지통으로 보낼까요?`;
  if (!confirm(confirmMsg)) return;

  const targetIds = Array.from(fmSelectedItems);
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  const undoPayload = [];

  targetIds.forEach((id) => {
    store.get(id).onsuccess = (e) => {
      const m = e.target.result;
      if (m && !m.isSystem) {
        if (m.isDeleted) {
          m.isPermanentlyDeleted = true;
          if (m.type === "folder" && typeof markDescendantsPermanentlyDeleted === "function") {
            markDescendantsPermanentlyDeleted(store, m.id);
          }
        } else {
          m.isDeleted = true;
          m.deletedAt = Date.now();
          undoPayload.push({ id: m.id, action: "restore" });
        }
        m.updatedAt = Date.now();
        store.put(m);
      }
    };
  });

  tx.oncomplete = () => {
    cancelFmMultiSelect();
    ensureActiveMemoNotDeleted();
    loadMemoList(true);
    const trashPane = document.getElementById("trash-pane");
    if (trashPane && trashPane.classList.contains("is-open")) loadTrashList();
    updateUnsyncedCount();

    if (undoPayload.length > 0) {
      showToast(`${undoPayload.length}개 항목이 휴지통으로 이동되었습니다.`, undoPayload);
    }
    loadFileManager(currentFmFolderId);
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 🎯 [완벽 교정]
function closeMoveModal(fromPopstate = false) {
  if (document.getElementById("fm-move-modal").style.display === "none") return;
  document.getElementById("fm-move-modal").style.display = "none";
  movingItemIds = [];
  selectedDestId = undefined;

  // 모달이 닫힐 때 유령 방어막 청소
  if (!fromPopstate) {
    programmaticBackCount++; // 숫자를 1 올림
    history.back();
  }
}

function renderDestFolders(scrollToFolderId = undefined) {
  const container = document.getElementById("fm-dest-list");
  container.innerHTML =
    '<div style="padding:8px 10px 10px; font-size:12px; color:var(--text-muted); line-height:1.4;">이동할 위치를 선택하세요 <span style="opacity:0.8;">(폴더 선택 후 <b>+ 새 폴더</b> 클릭 시 하위 폴더로 생성)</span></div>';

  const tx = db.transaction(["memos"], "readonly");
  tx.objectStore("memos").getAll().onsuccess = (e) => {
    const allData = e.target.result;

    // 🎯 1. 폴더 가계도 생성
    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });

    // 🎯 [V4.2.2 / V4.2.3] FM이 열려있는지, 아니면 메인 편집창 삼선 메뉴에서 호출되었는지 판별
    const fmPane = document.getElementById("file-manager-pane");
    const isFmOpen = fmPane && fmPane.style.display === "flex";
    let currentOriginFolderId = currentFmFolderId;
    if (!isFmOpen && movingItemIds.length === 1) {
      const targetItem = allData.find(
        (m) => m.id === Number(movingItemIds[0]),
      );
      currentOriginFolderId = targetItem ? targetItem.parentId : undefined;
    }

    // 🎯 2. 목적지 자격 검사 (휴지통 소속이거나, 영구삭제(유령)이거나, 선택한 항목 자신/자식이면 제외)
    function isValidDestination(folderId) {
      if (movingItemIds.includes(folderId)) return false; // 내 자신에게 이동 불가

      let curr = folderId;
      while (curr) {
        if (movingItemIds.includes(curr)) return false; // 내 자식 폴더들 안으로도 이동 불가

        const f = folderMap.get(curr);
        if (!f) break;

        // 조상 중에 하나라도 휴지통 소속이거나, 일반 삭제됐거나, 영구 삭제된 유령이면 절대 불가!
        if (f.isDeleted || f.isPermanentlyDeleted || f.isSystem === "trash")
          return false;

        curr = f.parentId;
      }
      return true;
    }

    // 🎯 3. 유효한 일반 하위 폴더들을 부모 ID 기준으로 그룹핑 (트리 계층 구조 렌더링용)
    const childrenByParent = new Map();
    allData.forEach((m) => {
      if (
        m.type === "folder" &&
        !m.isSystem &&
        !m.isDeleted &&
        !m.isPermanentlyDeleted &&
        isValidDestination(m.id)
      ) {
        const pid = m.parentId !== undefined ? m.parentId : null;
        if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
        childrenByParent.get(pid).push(m);
      }
    });

    // 각 부모 아래 자식 폴더들을 이름순 정렬
    childrenByParent.forEach((list) => {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    });

    // 재귀적으로 자식 폴더 트리를 추가하는 헬퍼
    function appendSubtree(parentId, depth) {
      const children = childrenByParent.get(parentId) || [];
      children.forEach((child) => {
        const isCurrentLoc =
          currentOriginFolderId !== undefined &&
          child.id === currentOriginFolderId &&
          !isCurrentInTrash;
        container.appendChild(
          createDestItem(
            child.id,
            child.title,
            "fa-folder",
            "var(--text-main)",
            depth,
            isCurrentLoc,
          ),
        );
        appendSubtree(child.id, depth + 1);
      });
    }

    // 🎯 4. 가상 드라이브 루트 -> 공문 분석 -> 쪽지 분석 -> 문서 분석 -> 임시 폴더 + 사용자 폴더 -> 구분선 -> 보안 폴더
    const driveTitle = getFmDriveRootTitle();
    if (isValidDestination(null)) {
      const isDriveCurrent =
        currentOriginFolderId !== undefined &&
        currentOriginFolderId === null &&
        !isCurrentInTrash;
      container.appendChild(
        createDestItem(null, driveTitle, "fa-hard-drive", "var(--accent)", 0, isDriveCurrent),
      );
    }

    if (typeof globalBhOfficialFolderId !== "undefined" && globalBhOfficialFolderId !== null && isValidDestination(globalBhOfficialFolderId)) {
      const isCur = currentOriginFolderId !== undefined && globalBhOfficialFolderId === currentOriginFolderId && !isCurrentInTrash;
      container.appendChild(
        createDestItem(globalBhOfficialFolderId, "공문 분석", "fa-file-signature", "#6366f1", 1, isCur),
      );
      appendSubtree(globalBhOfficialFolderId, 2);
    }

    if (typeof globalBhMemoFolderId !== "undefined" && globalBhMemoFolderId !== null && isValidDestination(globalBhMemoFolderId)) {
      const isCur = currentOriginFolderId !== undefined && globalBhMemoFolderId === currentOriginFolderId && !isCurrentInTrash;
      container.appendChild(
        createDestItem(globalBhMemoFolderId, "쪽지 분석", "fa-paper-plane", "#0284c7", 1, isCur),
      );
      appendSubtree(globalBhMemoFolderId, 2);
    }

    if (typeof globalBhDocFolderId !== "undefined" && globalBhDocFolderId !== null && isValidDestination(globalBhDocFolderId)) {
      const isCur = currentOriginFolderId !== undefined && globalBhDocFolderId === currentOriginFolderId && !isCurrentInTrash;
      container.appendChild(
        createDestItem(globalBhDocFolderId, "문서 분석", "fa-file-lines", "#059669", 1, isCur),
      );
      appendSubtree(globalBhDocFolderId, 2);
    }

    if (globalDesktopFolderId !== null && isValidDestination(globalDesktopFolderId)) {
      const isDesktopCurrent =
        currentOriginFolderId !== undefined &&
        globalDesktopFolderId === currentOriginFolderId &&
        !isCurrentInTrash;
      container.appendChild(
        createDestItem(globalDesktopFolderId, "임시 폴더", "fa-inbox", "var(--accent)", 1, isDesktopCurrent),
      );
      appendSubtree(globalDesktopFolderId, 2);
    }

    appendSubtree(null, 1);

    if (globalSecurityFolderId !== null && isValidDestination(globalSecurityFolderId)) {
      container.appendChild(document.createElement("hr")).style.cssText =
        "margin:8px 0; border:none; border-top:1px solid var(--border);";
      const isSecCurrent =
        currentOriginFolderId !== undefined &&
        globalSecurityFolderId === currentOriginFolderId &&
        !isCurrentInTrash;
      container.appendChild(
        createDestItem(globalSecurityFolderId, "보안 폴더", "fa-lock", "#f59e0b", 0, isSecCurrent),
      );
      appendSubtree(globalSecurityFolderId, 1);
    }

    // 만약 부모가 특이한 경우(위 트리에 포함되지 않은 고아성 유효 폴더)가 있다면 누락 없이 출력
    const renderedIds = new Set(
      Array.from(container.querySelectorAll(".fm-dest-item")).map((el) =>
        el.dataset.folderId === "null" ? null : Number(el.dataset.folderId),
      ),
    );
    allData.forEach((m) => {
      if (
        m.type === "folder" &&
        !m.isSystem &&
        !m.isDeleted &&
        !m.isPermanentlyDeleted &&
        isValidDestination(m.id) &&
        !renderedIds.has(m.id)
      ) {
        const isCurrentLoc =
          currentOriginFolderId !== undefined &&
          m.id === currentOriginFolderId &&
          !isCurrentInTrash;
        container.appendChild(
          createDestItem(m.id, m.title, "fa-folder", "var(--text-main)", 0, isCurrentLoc),
        );
      }
    });

    // 방금 새 폴더를 만든 경우 해당 폴더로 부드럽게 스크롤
    if (scrollToFolderId !== undefined) {
      const targetEl = container.querySelector(
        `.fm-dest-item[data-folder-id="${scrollToFolderId}"]`,
      );
      if (targetEl) {
        targetEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  };
}

// 🎯 6. 아이콘 색상, 트리 들여쓰기(depth), 현재 위치 배지 적용
function createDestItem(id, title, icon, colorStyle, depth = 0, isCurrentLoc = false) {
  const div = document.createElement("div");
  div.className = `fm-dest-item ${selectedDestId === id ? "active" : ""}`;
  div.dataset.folderId = id === null ? "null" : String(id);
  div.dataset.isCurrentLoc = isCurrentLoc ? "true" : "false";

  const indentPx = 14 + Math.min(depth, 6) * 18;
  div.style.paddingLeft = `${indentPx}px`;

  const branchHtml =
    depth > 0 ? `<span class="fm-dest-tree-branch">└</span>` : "";
  const badgeHtml = isCurrentLoc
    ? `<span class="fm-dest-current-badge">현재 위치</span>`
    : "";

  div.innerHTML = `${branchHtml}<i class="fa-solid ${icon}" style="color: ${colorStyle}; width: 20px; text-align: center; flex-shrink: 0;"></i> <span style="line-height: 1.4; word-break: break-all;">${title}</span>${badgeHtml}`;
  div.onclick = () => {
    selectedDestId = id;
    document
      .querySelectorAll(".fm-dest-item")
      .forEach((el) => el.classList.remove("active"));
    div.classList.add("active");
  };
  return div;
}

// 🎯 [V4.2.3] 이동 모달 내부에서 즉시 새 폴더를 만들고 이동 목적지로 자동 선택하는 함수
async function createFolderInMoveModal() {
  if (!db) return;

  // 1. 새 폴더가 만들어질 부모 폴더 결정:
  // 사용자가 모달에서 특정 폴더를 선택해 두었다면 그 폴더 내부에 생성하고,
  // 아직 아무것도 선택하지 않았다면 Home(null)에 생성합니다.
  const parentFolderId = selectedDestId !== undefined ? selectedDestId : null;

  // 2. 보안 폴더(또는 그 하위 폴더) 내부에 만들려는 경우 잠금 해제 여부 확인
  const isParentUnderSec = await checkIsUnderSecurity(parentFolderId);
  if (isParentUnderSec && !isSecurityUnlocked) {
    showToast("잠긴 보안 폴더 내부에는 새 폴더를 만들 수 없습니다.\n먼저 보안 폴더의 잠금을 해제해주세요.");
    return;
  }

  // 3. 부모 폴더 이름 및 syncId 조회
  let parentTitle = getFmDriveRootTitle();
  let parentSyncId = null;
  if (parentFolderId !== null) {
    const parentObj = await new Promise((resolve) => {
      db
        .transaction(["memos"], "readonly")
        .objectStore("memos")
        .get(parentFolderId).onsuccess = (e) => resolve(e.target.result);
    });
    if (parentObj) {
      parentTitle = getFmFolderDisplayTitle(parentObj);
      parentSyncId = parentObj.syncId || null;
    }
  }

  const folderName = await requestFmTextInput({
    title: "새 폴더",
    desc: `[${parentTitle}] 안에 생성할 새 폴더 이름을 입력하세요.`,
    defaultValue: "새 폴더",
    confirmText: "만들기",
    iconClass: "fa-solid fa-folder-plus",
  });
  if (!folderName || folderName.trim() === "") return;
  if (isParentUnderSec && !isSecurityUnlocked) return;

  const trimmedName = folderName.trim();
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  let createdFolderId = null;
  store.add({
    title: trimmedName,
    type: "folder",
    parentId: parentFolderId,
    parentSyncId: parentSyncId,
    updatedAt: Date.now(),
    isDeleted: false,
    syncId: generateSyncId(),
  }).onsuccess = (e) => {
    createdFolderId = e.target.result;
  };

  tx.oncomplete = () => {
    if (createdFolderId !== null) {
      // 새로 만든 폴더를 즉시 이동 목적지로 자동 선택!
      selectedDestId = createdFolderId;
      renderDestFolders(createdFolderId);

      const fmPane = document.getElementById("file-manager-pane");
      if (fmPane && fmPane.style.display === "flex") {
        loadFileManager(currentFmFolderId);
      }
      updateUnsyncedCount();
      if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
      showToast(`'${trimmedName}' 폴더가 생성되어 이동 위치로 선택되었습니다.`);
    }
  };
}
window.createFolderInMoveModal = createFolderInMoveModal;

// 🎯 [V4.1.7] 폴더 간 아이템(노트/폴더) 이동을 실행하는 핵심 공용 엔진
async function moveItemsToFolder(itemIds, targetFolderId) {
  if (!itemIds || itemIds.length === 0) return;
  if (targetFolderId === undefined) {
    alert("이동할 위치를 선택해주세요.");
    return;
  }

  // 1. 목적지가 보안 폴더 구역인지 확인
  const isDestSecure = await checkIsUnderSecurity(targetFolderId);

  // 2. 사이클 검사 및 하위 항목 암호화 처리를 위해 전체 데이터 로드
  const allData = await new Promise((resolve) => {
    const tx = db.transaction(["memos"], "readonly");
    tx.objectStore("memos").getAll().onsuccess = (e) => resolve(e.target.result || []);
  });
  const byIdMap = new Map();
  const folderMap = new Map();
  allData.forEach((entry) => {
    byIdMap.set(entry.id, entry);
    if (entry.type === "folder") folderMap.set(entry.id, entry);
  });

  function isDescendantFolderCycle(movedFolderId, candidateTargetId) {
    if (candidateTargetId === null || candidateTargetId === undefined) return false;
    if (Number(movedFolderId) === Number(candidateTargetId)) return true;
    let curr = candidateTargetId;
    const seen = new Set();
    while (curr !== null && curr !== undefined) {
      if (seen.has(curr)) break;
      seen.add(curr);
      if (Number(curr) === Number(movedFolderId)) return true;
      const pf = folderMap.get(curr);
      if (!pf) break;
      curr = pf.parentId;
    }
    return false;
  }

  const itemsToMove = [];
  for (const id of itemIds) {
    const m = byIdMap.get(id);
    if (m && !m.isSystem) {
      const effectiveTargetId =
        m.type !== "folder" && (targetFolderId === null || targetFolderId === undefined)
          ? (typeof globalDesktopFolderId !== "undefined" ? globalDesktopFolderId : null)
          : targetFolderId;
      if (m.type === "folder" && isDescendantFolderCycle(m.id, effectiveTargetId)) {
        if (typeof showToast === "function") {
          showToast("폴더를 자기 자신이나 하위 폴더로 이동할 수 없습니다.");
        }
        return;
      }
      if (m.parentId !== effectiveTargetId || m.isDeleted) {
        itemsToMove.push({ m, effectiveTargetId });
      }
    }
  }

  if (itemsToMove.length === 0) {
    showToast("이미 해당 위치에 있는 항목입니다.");
    return;
  }

  // 이동 대상 폴더의 모든 자손 노트도 경계 이동 시 암·복호화 대상에 포함
  function collectDescendantMemos(folderId, outList, visitedFolders = new Set()) {
    if (visitedFolders.has(folderId)) return;
    visitedFolders.add(folderId);
    allData.forEach((child) => {
      if (child.isPermanentlyDeleted) return;
      if (child.parentId === folderId) {
        if (child.type === "folder") {
          collectDescendantMemos(child.id, outList, visitedFolders);
        } else {
          outList.push(child);
        }
      }
    });
  }

  const extraCryptoDescendantMemos = [];
  let needsCrypto = false;
  for (const entry of itemsToMove) {
    const m = entry.m;
    const isItemSecure = await checkIsUnderSecurity(m.parentId);
    if (isItemSecure !== isDestSecure) {
      needsCrypto = true;
      if (m.type === "folder") {
        collectDescendantMemos(m.id, extraCryptoDescendantMemos);
      }
    }
  }

  if (needsCrypto && !currentSecKey) {
    alert(
      "보안 구역으로 넣거나 빼려면, 먼저 보안 폴더를 한 번 열어서(잠금 해제) 열쇠를 활성화해야 합니다.",
    );
    return;
  }

  if (typeof showToast === "function") {
    showToast("항목을 이동하고 있습니다...");
  }

  let actualMoveCount = 0;
  const undoPayload = [];
  const putRecords = [];
  const seenPutIds = new Set();

  for (const entry of itemsToMove) {
    const m = entry.m;
    const destId = entry.effectiveTargetId;
    const isItemSecure = await checkIsUnderSecurity(m.parentId);
    undoPayload.push({
      id: m.id,
      action: "moveBack",
      oldParentId: m.parentId,
      oldParentSyncId: m.parentSyncId || null,
      wasDeleted: !!m.isDeleted,
      oldDeletedAt: m.deletedAt || null,
    });

    if (m.type !== "folder") {
      if (!isItemSecure && isDestSecure && !String(m.content || "").startsWith("ZENENC::")) {
        m.content = await encryptData(m.content || "", currentSecKey);
        m.plainText = await encryptData(m.plainText || "", currentSecKey);
      } else if (isItemSecure && !isDestSecure) {
        if (String(m.content || "").startsWith("ZENENC::")) {
          m.content = await decryptData(m.content, currentSecKey);
        }
        if (String(m.plainText || "").startsWith("ZENENC::")) {
          m.plainText = await decryptData(m.plainText, currentSecKey);
        }
      }
    }

    let destSyncId = null;
    if (destId !== null && destId !== undefined) {
      const destFolder = byIdMap.get(destId);
      if (destFolder) {
        destSyncId = destFolder.syncId || (destFolder.isSystem === "desktop" ? "sys_desktop" : null);
      }
    }

    m.parentId = destId;
    if (destSyncId) m.parentSyncId = destSyncId;
    else delete m.parentSyncId;
    m.updatedAt = Date.now();
    if (m.isDeleted) {
      m.isDeleted = false;
      delete m.deletedAt;
      delete m.isPermanentlyDeleted;
    }
    if (!seenPutIds.has(m.id)) {
      seenPutIds.add(m.id);
      putRecords.push(m);
    }
    actualMoveCount++;
  }

  for (const descMemo of extraCryptoDescendantMemos) {
    if (seenPutIds.has(descMemo.id)) continue;
    if (isDestSecure) {
      if (!String(descMemo.content || "").startsWith("ZENENC::")) {
        descMemo.content = await encryptData(descMemo.content || "", currentSecKey);
      }
      if (!String(descMemo.plainText || "").startsWith("ZENENC::")) {
        descMemo.plainText = await encryptData(descMemo.plainText || "", currentSecKey);
      }
    } else {
      if (String(descMemo.content || "").startsWith("ZENENC::")) {
        descMemo.content = await decryptData(descMemo.content, currentSecKey);
      }
      if (String(descMemo.plainText || "").startsWith("ZENENC::")) {
        descMemo.plainText = await decryptData(descMemo.plainText, currentSecKey);
      }
    }
    descMemo.updatedAt = Date.now();
    seenPutIds.add(descMemo.id);
    putRecords.push(descMemo);
  }

  // 5. 변환이 끝난 데이터를 다시 DB에 꽂아 넣습니다.
  const putTx = db.transaction(["memos"], "readwrite");
  const putStore = putTx.objectStore("memos");
  putRecords.forEach((m) => putStore.put(m));

  return new Promise((resolve) => {
    putTx.oncomplete = () => {
      if (actualMoveCount > 0) {
        if (needsCrypto) {
          showToast(
            `${actualMoveCount}개 항목이 안전하게 변환되어 이동되었습니다.`,
          );
        } else {
          showToast(`${actualMoveCount}개 항목이 이동되었습니다.`, undoPayload);
        }
        loadMemoList(true);
      }
      const fmPane = document.getElementById("file-manager-pane");
      if (fmPane && fmPane.style.display === "flex") {
        loadFileManager(currentFmFolderId);
      }
      const trashPane = document.getElementById("trash-pane");
      if (trashPane && trashPane.classList.contains("is-open")) {
        loadTrashList();
      }
      if (typeof updateUnsyncedCount === "function") updateUnsyncedCount();
      if (typeof updateLeftMenuCurrentFolderPath === "function") {
        updateLeftMenuCurrentFolderPath();
      }
      if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
      resolve();
    };
  });
}

// 🎯 [완벽 교정] 스마트 이동 엔진 (모달 확인 버튼)
document.getElementById("fm-move-confirm-btn").onclick = async () => {
  if (selectedDestId === undefined) {
    alert("이동할 위치를 선택해주세요.");
    return;
  }

  // 현재 위치 배지가 붙은 폴더를 그대로 누른 경우(휴지통 복구가 아닐 때) 모달을 닫지 않고 친절하게 안내
  const activeDestEl = document.querySelector(".fm-dest-item.active");
  if (
    activeDestEl &&
    activeDestEl.dataset.isCurrentLoc === "true" &&
    !isCurrentInTrash
  ) {
    showToast("이미 현재 위치한 폴더입니다.\n이동할 다른 폴더를 선택하거나 '+ 새 폴더'를 눌러주세요.");
    return;
  }

  const targetId = selectedDestId;
  const items = [...movingItemIds];

  let stepsToPop = 0; // 🎯 벗길 방어막 개수

  // 1. 이동 팝업창 닫기
  document.getElementById("fm-move-modal").style.display = "none";
  movingItemIds = [];
  selectedDestId = undefined;
  stepsToPop++;

  // 2. 다중 선택 모드 끄기
  if (isFmMultiSelectMode) {
    isFmMultiSelectMode = false;
    fmSelectedItems.clear();
    updateFmBottomBar();
    stepsToPop++;
  }

  // 3. 브라우저 히스토리 롤백 (이중 뒤로가기를 한 번에 처리)
  if (stepsToPop > 0) {
    isProgrammaticBack = true;
    history.go(-stepsToPop);
  }

  // 4. 공용 이동 엔진 실행
  await moveItemsToFolder(items, targetId);
};

// 🎯 [V1.5.0] 전체 폴더관리 열기: 항상 가상 드라이브 루트(1단계 펼침)에서 시작 + 에디터 잠금
function openFileManager() {
  if (document.activeElement) document.activeElement.blur();
  closeAllMemoMenus();
  if (typeof closeSidebarContextMenu === "function") closeSidebarContextMenu();
  if (typeof closeLeftNoteMenu === "function") closeLeftNoteMenu();
  forceSaveImmediate();

  closeAllPanelsMobile();

  isMultiSelectMode = false;
  selectedMemos.clear();
  isTrashMultiSelectMode = false;
  selectedTrashMemos.clear();
  isFmMultiSelectMode = false;
  fmSelectedItems.clear();
  lastFmSelectedId = null;
  loadMemoList(false);

  document.getElementById("col-left").style.display = "none";
  document.getElementById("col-right").style.display = "none";
  document.getElementById("mobile-left-menu-btn").style.display = "none";
  document.getElementById("global-menu-btn").style.display = "none";

  document.getElementById("file-manager-pane").style.display = "flex";
  const fmSearchInp = document.getElementById("fm-search-input");
  if (fmSearchInp) fmSearchInp.value = "";
  syncFmSearchClearBtn();
  if (typeof updateZoomToastPosition === 'function') setTimeout(updateZoomToastPosition, 50);

  quill.blur();
  quill.disable();

  // 항상 드라이브 루트(1단계)에서 시작
  fmExpandedSet.clear();
  fmDriveCollapsed = false;
  currentFmFolderId = null;
  isCurrentInTrash = false;
  fmSelectedRowKey = "drive:root";
  fmFocusedRowKey = "drive:root";
  fmPath = [{ id: null, title: getFmDriveRootTitle() }];
  updateFmBottomBar();

  if (!(history.state && history.state.fmOpen)) {
    history.pushState({ fmOpen: true, fmFolderId: null, fmPath: fmPath }, "");
  }
  loadFileManager(null);
}

function closeFileManager(fromPopstate = false) {
  const fmPane = document.getElementById("file-manager-pane");
  if (fmPane) fmPane.style.display = "none";
  if (typeof closeSidebarContextMenu === "function") closeSidebarContextMenu();

  document.getElementById("col-left").style.display = "";
  document.getElementById("col-right").style.display = "";
  document.getElementById("mobile-left-menu-btn").style.display = "";
  document.getElementById("global-menu-btn").style.display = "flex";

  isFmMultiSelectMode = false;
  fmSelectedItems.clear();
  lastFmSelectedId = null;
  updateFmBottomBar();

  if (!fromPopstate && history.state && history.state.fmOpen) {
    programmaticBackCount++;
    history.back();
  }

  quill.enable();
  if (typeof updateZoomToastPosition === 'function') setTimeout(updateZoomToastPosition, 50);
}

// 🎯 [완벽 교정] 어떤 폴더(특히 보안폴더)에서도 드라이브 루트로 안전하게 복귀
function resetFmToHome() {
  const searchInput = document.getElementById("fm-search-input");
  if (searchInput) searchInput.value = "";
  syncFmSearchClearBtn();

  if (typeof forceCleanFmUI === "function") forceCleanFmUI();

  fmExpandedSet.clear();
  fmDriveCollapsed = false;
  currentFmFolderId = null;
  isCurrentInTrash = false;
  fmSelectedRowKey = "drive:root";
  fmFocusedRowKey = "drive:root";
  fmPath = [{ id: null, title: getFmDriveRootTitle() }];
  loadFileManager(null);
}

// 🎯 [완벽 복구] 파일 매니저 삼선 버튼: 그냥 창만 닫으면 끝! (원래 보던 노트가 그대로 있음)
function handleFmHamburger() {
  closeFileManager();
}

function createNewMemo(folderId = null) {
  guardSecurityCrudAutoLock(800);
  forceSaveImmediate();
  targetNewMemoFolderId = folderId; // 🎯 새 노트가 저장될 특정 폴더 위치 기억
  isEditingSecureMemo = false; // 🎯 새 노트 작성 시 보안 노트 편집 상태 해제
  if (folderId !== null && typeof checkIsUnderSecurity === "function") {
    checkIsUnderSecurity(folderId).then((sec) => {
      if (!currentMemoId && targetNewMemoFolderId === folderId) {
        isEditingSecureMemo = !!sec;
      }
    });
  }

  const previousMemoId = currentMemoId;
  if (previousMemoId) purgeMemoIfEmpty(previousMemoId);

  currentMemoId = null;
  selectedMemos.clear();
  lastSelectedId = null;
  document.getElementById("memo-title-input").value = "";
  document.title = "새 노트";

  isLoading = true;
  quill.root.innerHTML = "";

  if (typeof checkAuthState === 'function') checkAuthState();

  loadMemoList(false);
  closeAllPanelsMobile();

  // 🎯 [추가] 새 노트를 열 때 기존 노트의 Ctrl+Z 수정 기록을 완벽히 지움
  setTimeout(() => quill.history.clear(), 10);
  setTimeout(() => {
    isLoading = false;
    if (typeof window.isAppScreenLocked === 'function' && window.isAppScreenLocked()) return;
    // [V1.6.1] 새 노트 작성 시 항상 제목 입력란을 기본 포커스로 고정
    const titleInput = document.getElementById("memo-title-input");
    if (titleInput && window.innerWidth > 768) {
      titleInput.focus();
    }
  }, 10);
}

// ============================================================================
// [V1.3.0 / V1.4.0] 좌측 사이드바 콤팩트 폴더 트리 탐색기 엔진
// ============================================================================
const SIDEBAR_EXPANDED_KEY = "zen_sidebar_expanded_folders";
const SIDEBAR_PINNED_COLLAPSED_KEY = "zen_sidebar_pinned_collapsed";
const SIDEBAR_DRIVE_COLLAPSED_KEY = "zen_sidebar_drive_collapsed";
const SIDEBAR_NOTE_SORT_KEY = "zen_sidebar_note_sort";

let sidebarExpandedSet = new Set();
let sidebarExpandedLoaded = false;
let sidebarPinnedCollapsed = localStorage.getItem(SIDEBAR_PINNED_COLLAPSED_KEY) === "true";
let sidebarDriveCollapsed = localStorage.getItem(SIDEBAR_DRIVE_COLLAPSED_KEY) === "true";
let sidebarSelectedFolderId = null;
let sidebarSelectedDrive = false;
let sidebarFocusedRowKey = null;
let __zenDraggedTreeIds = [];
let __zenSpringLoadTimer = null;
let __zenSpringLoadFolderId = null;

window.__zenTreeDataCache = null;
window.__zenPendingSidebarSecurityExpand = false;
window.__zenInternalTreeDragging = false;

function getSidebarNoteSortMode() {
  return localStorage.getItem(SIDEBAR_NOTE_SORT_KEY) === "name" ? "name" : "updated";
}

function setSidebarNoteSortMode(mode) {
  const next = mode === "name" ? "name" : "updated";
  try {
    localStorage.setItem(SIDEBAR_NOTE_SORT_KEY, next);
  } catch {}
  renderSidebarTreeFromCache();
  const fmPane = document.getElementById("file-manager-pane");
  if (fmPane && fmPane.style.display === "flex" && typeof renderFmTreeFromCache === "function") {
    renderFmTreeFromCache();
  }
  if (typeof showToast === "function") {
    showToast(next === "name" ? "정렬 기준: 이름순" : "정렬 기준: 최신 수정순");
  }
}

function sortSidebarNotes(arr) {
  const copy = Array.isArray(arr) ? arr.slice() : [];
  if (getSidebarNoteSortMode() === "name") {
    return copy.sort((a, b) => {
      const cmp = compareNaturalKorean(a.title || "제목 없는 노트", b.title || "제목 없는 노트");
      if (cmp !== 0) return cmp;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }
  return copy.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function compareNaturalKorean(a, b) {
  return String(a || "").localeCompare(String(b || ""), "ko", {
    numeric: true,
    sensitivity: "base",
  });
}

function escapeTreeHtml(str) {
  if (typeof escapeHtmlSafe === "function") return escapeHtmlSafe(str);
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clearSpringLoadTimer() {
  if (__zenSpringLoadTimer) {
    clearTimeout(__zenSpringLoadTimer);
    __zenSpringLoadTimer = null;
  }
  __zenSpringLoadFolderId = null;
}

function buildSidebarTreeCache(allData) {
  const list = Array.isArray(allData) ? allData : [];
  const byId = new Map();
  const folderMap = new Map();
  const childrenFoldersByParent = new Map();
  const childrenNotesByParent = new Map();

  list.forEach((m) => {
    if (!m) return;
    byId.set(m.id, m);
    if (m.type === "folder") folderMap.set(m.id, m);
  });

  function isUnderTrashSync(parentId) {
    if (parentId === null || parentId === undefined) return false;
    if (typeof globalTrashFolderId !== "undefined" && globalTrashFolderId !== null && parentId === globalTrashFolderId) {
      return true;
    }
    let curr = parentId;
    const visited = new Set();
    while (curr !== null && curr !== undefined) {
      if (visited.has(curr)) return true;
      visited.add(curr);
      if (typeof globalTrashFolderId !== "undefined" && globalTrashFolderId !== null && curr === globalTrashFolderId) {
        return true;
      }
      const pf = folderMap.get(curr);
      if (!pf) return false;
      if (pf.isDeleted || pf.isPermanentlyDeleted || pf.isSystem === "trash") return true;
      curr = pf.parentId;
    }
    return false;
  }

  function isUnderSecuritySync(parentId) {
    if (parentId === null || parentId === undefined) return false;
    if (typeof globalSecurityFolderId !== "undefined" && globalSecurityFolderId !== null && parentId === globalSecurityFolderId) {
      return true;
    }
    let curr = parentId;
    const visited = new Set();
    while (curr !== null && curr !== undefined) {
      if (visited.has(curr)) return false;
      visited.add(curr);
      if (typeof globalSecurityFolderId !== "undefined" && globalSecurityFolderId !== null && curr === globalSecurityFolderId) {
        return true;
      }
      const pf = folderMap.get(curr);
      if (!pf) return false;
      if (pf.isSystem === "security") return true;
      curr = pf.parentId;
    }
    return false;
  }

  function isDescendantFolderSync(ancestorId, targetId) {
    if (ancestorId === null || ancestorId === undefined || targetId === null || targetId === undefined) {
      return false;
    }
    if (ancestorId === targetId) return true;
    let curr = targetId;
    const visited = new Set();
    while (curr !== null && curr !== undefined) {
      if (visited.has(curr)) return false;
      visited.add(curr);
      if (curr === ancestorId) return true;
      const pf = folderMap.get(curr);
      if (!pf) return false;
      curr = pf.parentId;
    }
    return false;
  }

  function getFolderPathString(folderId) {
    const driveLabel = getFmDriveRootTitle();
    if (folderId === null || folderId === undefined) return driveLabel;
    const parts = [];
    let curr = folderId;
    const visited = new Set();
    let includesSecurity = false;
    while (curr !== null && curr !== undefined) {
      if (visited.has(curr)) break;
      visited.add(curr);
      const pf = folderMap.get(curr);
      if (!pf) break;
      if (pf.isSystem === "security") includesSecurity = true;
      parts.unshift(pf.isSystem === "desktop" ? "임시 폴더" : (pf.title || "폴더"));
      curr = pf.parentId;
    }
    if (parts.length === 0) return driveLabel;
    return includesSecurity ? parts.join(" > ") : `${driveLabel} > ${parts.join(" > ")}`;
  }

  const trashChildrenFoldersByParent = new Map();
  const trashChildrenNotesByParent = new Map();
  const trashRootFolders = [];
  const trashRootNotes = [];
  let trashFolderObj = null;

  function isTrashDescendantSync(folderId) {
    if (folderId === null || folderId === undefined) return false;
    if (typeof globalTrashFolderId !== "undefined" && globalTrashFolderId !== null && folderId === globalTrashFolderId) {
      return true;
    }
    const f = folderMap.get(folderId);
    return !!(f && (f.isDeleted || f.isSystem === "trash" || isUnderTrashSync(f.parentId)));
  }

  const secLockedForTrash = !isSecurityUnlocked || !currentSecKey;

  list.forEach((m) => {
    if (!m || m.isPermanentlyDeleted) return;
    if (m.type === "folder" && (m.isSystem === "trash" || (typeof globalTrashFolderId !== "undefined" && m.id === globalTrashFolderId))) {
      trashFolderObj = m;
      return;
    }
    if (m.type === "folder" && m.isSystem === "backup") return;

    if (m.isDeleted) {
      if (m.isSystem) return;
      const isSecItem = isUnderSecuritySync(m.parentId) ||
        String(m.content || "").startsWith("ZENENC::") ||
        String(m.plainText || "").startsWith("ZENENC::");
      if (secLockedForTrash && isSecItem) return;

      const pf = (m.parentId !== undefined && m.parentId !== null) ? byId.get(m.parentId) : null;
      const underDeletedFolder = pf && pf.type === "folder" && pf.isDeleted && !pf.isPermanentlyDeleted && !pf.isSystem;
      if (underDeletedFolder) {
        if (m.type === "folder") {
          if (!trashChildrenFoldersByParent.has(pf.id)) trashChildrenFoldersByParent.set(pf.id, []);
          trashChildrenFoldersByParent.get(pf.id).push(m);
        } else {
          if (!trashChildrenNotesByParent.has(pf.id)) trashChildrenNotesByParent.set(pf.id, []);
          trashChildrenNotesByParent.get(pf.id).push(m);
        }
      } else {
        if (m.type === "folder") trashRootFolders.push(m);
        else trashRootNotes.push(m);
      }
      return;
    }

    if (isUnderTrashSync(m.parentId)) return;

    const pKey = (m.parentId === undefined || m.parentId === null) ? null : m.parentId;
    if (m.type === "folder") {
      if (!childrenFoldersByParent.has(pKey)) childrenFoldersByParent.set(pKey, []);
      childrenFoldersByParent.get(pKey).push(m);
    } else {
      if (!childrenNotesByParent.has(pKey)) childrenNotesByParent.set(pKey, []);
      childrenNotesByParent.get(pKey).push(m);
    }
  });

  const trashTotalCount = trashRootFolders.length + trashRootNotes.length;

  function countActiveDescendants(folderId) {
    let count = 0;
    const visited = new Set();
    function walk(fid) {
      if (visited.has(fid)) return;
      visited.add(fid);
      const subN = childrenNotesByParent.get(fid) || [];
      const subF = childrenFoldersByParent.get(fid) || [];
      count += subN.length + subF.length;
      subF.forEach((sf) => walk(sf.id));
    }
    walk(folderId);
    return count;
  }

  return {
    rawAll: list,
    byId,
    folderMap,
    childrenFoldersByParent,
    childrenNotesByParent,
    trashFolderObj,
    trashRootFolders,
    trashRootNotes,
    trashChildrenFoldersByParent,
    trashChildrenNotesByParent,
    trashTotalCount,
    isUnderTrashSync,
    isTrashDescendantSync,
    isUnderSecuritySync,
    isDescendantFolderSync,
    getFolderPathString,
    countActiveDescendants,
  };
}

function ensureSidebarExpandedInitialized() {
  if (!sidebarExpandedLoaded) {
    sidebarExpandedLoaded = true;
    const raw = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (raw === null) {
      if (typeof globalDesktopFolderId !== "undefined" && globalDesktopFolderId !== null) {
        sidebarExpandedSet.add(globalDesktopFolderId);
      }
    } else {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((id) => {
            if (id !== null && id !== undefined && id !== globalSecurityFolderId) {
              sidebarExpandedSet.add(id);
            }
          });
        }
      } catch {}
    }
  }
  const cache = window.__zenTreeDataCache;
  if (!isSecurityUnlocked || !currentSecKey) {
    Array.from(sidebarExpandedSet).forEach((id) => {
      if (id === globalSecurityFolderId || (cache && cache.isUnderSecuritySync(id))) {
        sidebarExpandedSet.delete(id);
      }
    });
  }
}

function saveSidebarExpandedState() {
  const cache = window.__zenTreeDataCache;
  const persistable = Array.from(sidebarExpandedSet).filter((id) => {
    if (id === null || id === undefined) return false;
    if (id === globalSecurityFolderId || id === globalTrashFolderId) return false;
    if (cache && (cache.isUnderSecuritySync(id) || cache.isTrashDescendantSync(id))) return false;
    return true;
  });
  try {
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(persistable));
  } catch {}
}

function expandSidebarFolderInMemory(folderId) {
  if (folderId === null || folderId === undefined) return;
  ensureSidebarExpandedInitialized();
  sidebarExpandedSet.add(folderId);
}

function collapseSidebarSecurityTree() {
  const cache = window.__zenTreeDataCache;
  window.__zenPendingSidebarSecurityExpand = false;
  Array.from(sidebarExpandedSet).forEach((id) => {
    if (id === globalSecurityFolderId || (cache && cache.isUnderSecuritySync(id))) {
      sidebarExpandedSet.delete(id);
    }
  });
  if (
    sidebarSelectedFolderId !== null &&
    (sidebarSelectedFolderId === globalSecurityFolderId || (cache && cache.isUnderSecuritySync(sidebarSelectedFolderId)))
  ) {
    sidebarSelectedFolderId = null;
  }
  document.querySelectorAll("#memo-list .tree-under-security").forEach((el) => el.remove());
  loadMemoList(false);
}

function lockSecurityFolderOnly() {
  closeSidebarContextMenu();
  if (typeof triggerBankAutoLock === "function") {
    triggerBankAutoLock("securityOnly");
  }
  if (typeof showToast === "function") {
    showToast("보안 폴더가 잠겼습니다.");
  }
}

function setSubtreeExpanded(folderId, expand) {
  closeSidebarContextMenu();
  const cache = window.__zenTreeDataCache;
  if (!cache || folderId === null || folderId === undefined) return;
  ensureSidebarExpandedInitialized();

  const isSec = folderId === globalSecurityFolderId || cache.isUnderSecuritySync(folderId);
  const isTrashTarget = folderId === globalTrashFolderId || cache.isTrashDescendantSync(folderId);
  if (expand && isSec && (!isSecurityUnlocked || !currentSecKey)) {
    window.__zenPendingSidebarSecurityExpand = true;
    const hasPw = localStorage.getItem("zen_sec_hash");
    openSecurityModal(hasPw ? "enter" : "setup");
    return;
  }

  const collected = [];
  const visited = new Set();
  function walk(fid) {
    if (visited.has(fid)) return;
    visited.add(fid);
    collected.push(fid);
    if (isTrashTarget) {
      const tSubs = fid === globalTrashFolderId
        ? cache.trashRootFolders
        : (cache.trashChildrenFoldersByParent.get(fid) || []);
      tSubs.forEach((sf) => walk(sf.id));
    } else {
      const subs = cache.childrenFoldersByParent.get(fid) || [];
      subs.forEach((sf) => walk(sf.id));
    }
  }
  walk(folderId);

  collected.forEach((fid) => {
    if (expand) sidebarExpandedSet.add(fid);
    else sidebarExpandedSet.delete(fid);
  });

  if (!isSec && !isTrashTarget) saveSidebarExpandedState();
  renderSidebarTreeFromCache();
}

function setAllUnderDriveExpanded(expand) {
  closeSidebarContextMenu();
  const cache = window.__zenTreeDataCache;
  if (!cache) return;
  ensureSidebarExpandedInitialized();

  if (expand) {
    sidebarDriveCollapsed = false;
    try {
      localStorage.setItem(SIDEBAR_DRIVE_COLLAPSED_KEY, "false");
    } catch {}
    cache.folderMap.forEach((f) => {
      if (!f || f.isDeleted || f.isPermanentlyDeleted) return;
      if (f.isSystem === "security" || f.isSystem === "trash" || f.isSystem === "backup") return;
      if (cache.isUnderSecuritySync(f.id) || cache.isUnderTrashSync(f.id)) return;
      sidebarExpandedSet.add(f.id);
    });
  } else {
    Array.from(sidebarExpandedSet).forEach((id) => {
      if (id !== globalSecurityFolderId && !cache.isUnderSecuritySync(id)) {
        sidebarExpandedSet.delete(id);
      }
    });
  }

  saveSidebarExpandedState();
  renderSidebarTreeFromCache();
}

function toggleAllSidebarFolders() {
  const cache = window.__zenTreeDataCache;
  if (!cache) return;
  ensureSidebarExpandedInitialized();

  const hasAnyNonSecurityExpanded = Array.from(sidebarExpandedSet).some((id) => {
    if (id === globalSecurityFolderId) return false;
    if (cache.isUnderSecuritySync(id)) return false;
    return cache.folderMap.has(id);
  });

  setAllUnderDriveExpanded(!hasAnyNonSecurityExpanded);
}

function clearMainSearch(closeBar = false) {
  const inp = document.getElementById("list-search-input");
  if (inp) {
    inp.value = "";
  }
  if (closeBar && typeof closeSidebarSearchBar === "function") {
    closeSidebarSearchBar(false);
  } else if (inp) {
    inp.focus();
  }
  if (typeof syncMainSearchClearBtn === "function") syncMainSearchClearBtn();
  loadMemoList(false);
}

function createNewMemoSmart() {
  closeSidebarContextMenu();
  const cache = window.__zenTreeDataCache;
  let candidate = sidebarSelectedDrive ? globalDesktopFolderId : sidebarSelectedFolderId;

  if ((candidate === null || candidate === undefined) && !sidebarSelectedDrive && currentMemoId && cache) {
    const curMemo = cache.byId.get(currentMemoId);
    if (curMemo && curMemo.parentId !== undefined) {
      candidate = curMemo.parentId;
    }
  }

  let targetFolderId = typeof globalDesktopFolderId !== "undefined" ? globalDesktopFolderId : null;
  if (candidate !== null && candidate !== undefined && cache) {
    const pf = cache.folderMap.get(candidate);
    if (pf && !pf.isDeleted && !pf.isPermanentlyDeleted && !cache.isUnderTrashSync(candidate)) {
      const isUnderSec = candidate === globalSecurityFolderId || cache.isUnderSecuritySync(candidate);
      if (isUnderSec) {
        if (isSecurityUnlocked && currentSecKey) {
          targetFolderId = candidate;
          expandSidebarFolderInMemory(candidate);
        }
      } else {
        targetFolderId = candidate;
        sidebarDriveCollapsed = false;
        try {
          localStorage.setItem(SIDEBAR_DRIVE_COLLAPSED_KEY, "false");
        } catch {}
        sidebarExpandedSet.add(candidate);
        saveSidebarExpandedState();
      }
    }
  } else if (targetFolderId !== null) {
    sidebarDriveCollapsed = false;
    try {
      localStorage.setItem(SIDEBAR_DRIVE_COLLAPSED_KEY, "false");
    } catch {}
    sidebarExpandedSet.add(targetFolderId);
    saveSidebarExpandedState();
  }

  createNewMemo(targetFolderId);
}

async function createSidebarFolder(parentFolderId = null) {
  closeSidebarContextMenu();
  if (!db) return null;

  const isUnderSec = parentFolderId !== null && typeof checkIsUnderSecurity === "function"
    ? await checkIsUnderSecurity(parentFolderId)
    : false;
  if (isUnderSec && (!isSecurityUnlocked || !currentSecKey)) {
    showToast("보안 폴더 잠금을 먼저 해제해주세요.");
    return null;
  }

  const name = await requestFmTextInput({
    title: "새 폴더",
    desc: parentFolderId !== null ? "선택한 폴더 아래에 새 폴더를 만듭니다." : `${getFmDriveRootTitle()} 아래에 새 폴더를 만듭니다.`,
    defaultValue: "새 폴더",
    confirmText: "만들기",
    iconClass: "fa-solid fa-folder-plus",
  });
  if (!name || name.trim() === "") return null;
  if (isUnderSec && (!isSecurityUnlocked || !currentSecKey)) return null;

  const trimmedName = name.trim();
  let parentSyncId = null;
  if (parentFolderId !== null) {
    const parentObj = await new Promise((resolve) => {
      db.transaction(["memos"], "readonly").objectStore("memos").get(parentFolderId).onsuccess = (e) => resolve(e.target.result);
    });
    if (parentObj) parentSyncId = parentObj.syncId || null;
  }

  let createdId = null;
  const tx = db.transaction(["memos"], "readwrite");
  tx.objectStore("memos").add({
    title: trimmedName,
    type: "folder",
    parentId: parentFolderId,
    parentSyncId: parentSyncId,
    syncId: typeof generateSyncId === "function" ? generateSyncId() : Date.now().toString(36),
    updatedAt: Date.now(),
    isDeleted: false,
  }).onsuccess = (e) => {
    createdId = e.target.result;
  };

  return new Promise((resolve) => {
    tx.oncomplete = () => {
      ensureSidebarExpandedInitialized();
      if (!isUnderSec && sidebarDriveCollapsed) {
        sidebarDriveCollapsed = false;
        try {
          localStorage.setItem(SIDEBAR_DRIVE_COLLAPSED_KEY, "false");
        } catch {}
      }
      if (parentFolderId !== null) {
        if (isUnderSec) expandSidebarFolderInMemory(parentFolderId);
        else sidebarExpandedSet.add(parentFolderId);
      }
      if (createdId !== null && createdId !== undefined) {
        sidebarSelectedDrive = false;
        sidebarSelectedFolderId = createdId;
        if (isUnderSec) expandSidebarFolderInMemory(createdId);
        else sidebarExpandedSet.add(createdId);
      }
      saveSidebarExpandedState();
      loadMemoList(true);
      updateUnsyncedCount();
      if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
      resolve(createdId);
    };
  });
}

function createSidebarFolderFromHeader() {
  let parentId = null;
  const cache = window.__zenTreeDataCache;
  if (!sidebarSelectedDrive && sidebarSelectedFolderId !== null && cache && cache.folderMap.has(sidebarSelectedFolderId)) {
    const selFolder = cache.folderMap.get(sidebarSelectedFolderId);
    if (selFolder && selFolder.isSystem !== "security" && selFolder.isSystem !== "trash" && !cache.isUnderTrashSync(selFolder.id)) {
      if (!cache.isUnderSecuritySync(selFolder.id) || (isSecurityUnlocked && currentSecKey)) {
        parentId = selFolder.id;
      }
    }
  }
  return createSidebarFolder(parentId);
}

function revealMemoInSidebarTree(memoId) {
  const cache = window.__zenTreeDataCache;
  if (!cache || !memoId) return;
  const m = cache.byId.get(memoId);
  if (!m) return;

  ensureSidebarExpandedInitialized();
  const isSec = cache.isUnderSecuritySync(m.parentId);
  if (isSec && (!isSecurityUnlocked || !currentSecKey)) return;

  let changed = false;
  if (!isSec && sidebarDriveCollapsed) {
    sidebarDriveCollapsed = false;
    try {
      localStorage.setItem(SIDEBAR_DRIVE_COLLAPSED_KEY, "false");
    } catch {}
    changed = true;
  }

  let curr = m.parentId;
  const visited = new Set();
  while (curr !== null && curr !== undefined) {
    if (visited.has(curr)) break;
    visited.add(curr);
    if (!sidebarExpandedSet.has(curr)) {
      sidebarExpandedSet.add(curr);
      changed = true;
    }
    const pf = cache.folderMap.get(curr);
    if (!pf) break;
    curr = pf.parentId;
  }

  if (changed) saveSidebarExpandedState();

  const searchInp = document.getElementById("list-search-input");
  const hasSearch = searchInp && searchInp.value.trim().length > 0;
  if (changed && !hasSearch) {
    renderSidebarTreeFromCache();
  }

  setTimeout(() => {
    const activeRow = document.querySelector(`#memo-list .tree-row-note[data-memo-id="${memoId}"]:not(.is-pinned-entry)`)
      || document.querySelector(`#memo-list .tree-row-note[data-memo-id="${memoId}"]`);
    if (activeRow && typeof activeRow.scrollIntoView === "function") {
      activeRow.scrollIntoView({ block: "nearest" });
    }
  }, 15);
}

function closeSidebarContextMenu() {
  const menu = document.getElementById("sidebar-context-menu");
  if (menu) {
    menu.style.display = "none";
    menu.innerHTML = "";
  }
}

async function deleteItemsToTrashWithUndo(itemIds) {
  guardSecurityCrudAutoLock(1000);
  if (!Array.isArray(itemIds) || itemIds.length === 0 || !db) return;

  const uniqueIds = Array.from(new Set(itemIds.map((id) => Number(id)).filter((n) => !isNaN(n))));
  if (uniqueIds.length === 0) return;

  const now = Date.now();
  const undoPayload = [];
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  await new Promise((resolve) => {
    store.getAll().onsuccess = (e) => {
      const allData = e.target.result || [];
      const byId = new Map();
      allData.forEach((entry) => byId.set(entry.id, entry));
      uniqueIds.forEach((id) => {
        const m = byId.get(id);
        if (
          m &&
          !m.isDeleted &&
          !m.isPermanentlyDeleted &&
          !m.isSystem
        ) {
          m.isDeleted = true;
          m.deletedAt = now;
          m.updatedAt = now;
          store.put(m);
          undoPayload.push({ id: m.id, action: "restore" });
        }
      });
    };
    tx.oncomplete = () => resolve();
  });

  if (undoPayload.length === 0) return;
  ensureActiveMemoNotDeleted();
  loadMemoList(true);
  const fmPane = document.getElementById("file-manager-pane");
  if (fmPane && fmPane.style.display === "flex") loadFileManager(currentFmFolderId);
  const trashPane = document.getElementById("trash-pane");
  if (trashPane && trashPane.classList.contains("is-open")) loadTrashList();
  updateUnsyncedCount();
  if (typeof showToast === "function") {
    showToast(`${undoPayload.length}개 항목이 휴지통으로 이동되었습니다.`, undoPayload);
  }
  if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
}

function deleteSidebarFolderWithConfirm(folderId) {
  guardSecurityCrudAutoLock(1000);
  closeSidebarContextMenu();
  const cache = window.__zenFmTreeDataCache || window.__zenTreeDataCache;
  const folder = cache ? cache.folderMap.get(folderId) : null;
  const folderTitle = folder ? (folder.title || "폴더") : "폴더";
  const childCount = cache ? cache.countActiveDescendants(folderId) : 0;
  const msg = childCount > 0
    ? `'${folderTitle}' 폴더와 내부 항목 ${childCount}개를 휴지통으로 보내시겠습니까?`
    : `'${folderTitle}' 폴더를 휴지통으로 보내시겠습니까?`;
  if (!confirm(msg)) return;
  if (sidebarSelectedFolderId === folderId) sidebarSelectedFolderId = null;
  if (currentFmFolderId === folderId) {
    currentFmFolderId = null;
    fmSelectedRowKey = "drive:root";
  }
  fmDelete(folderId);
}

function deleteSidebarNoteWithConfirm(noteId) {
  guardSecurityCrudAutoLock(1000);
  closeSidebarContextMenu();
  const targets =
    selectedMemos.has(noteId) && selectedMemos.size > 1
      ? Array.from(selectedMemos)
      : [noteId];
  const msg = targets.length > 1
    ? `선택한 ${targets.length}개의 노트를 휴지통으로 보냅니다.`
    : "이 노트를 휴지통으로 보내시겠습니까?";
  if (!confirm(msg)) return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  const undoPayload = [];
  targets.forEach((tid) => {
    store.get(tid).onsuccess = (ev) => {
      const m = ev.target.result;
      if (m && !m.isSystem) {
        m.isDeleted = true;
        m.deletedAt = Date.now();
        m.updatedAt = Date.now();
        store.put(m);
        undoPayload.push({ id: m.id, action: "restore" });
      }
    };
  });
  tx.oncomplete = () => {
    isMultiSelectMode = false;
    targets.forEach((tid) => selectedMemos.delete(tid));
    ensureActiveMemoNotDeleted();
    loadMemoList(true);
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") loadFileManager(currentFmFolderId);
    const trashPane = document.getElementById("trash-pane");
    if (trashPane && trashPane.classList.contains("is-open")) loadTrashList();
    updateUnsyncedCount();
    if (undoPayload.length > 0 && typeof showToast === "function") {
      showToast(`${undoPayload.length}개 노트가 휴지통으로 이동되었습니다.`, undoPayload);
    }
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  };
}

function toggleNotePinFromSidebar(noteId) {
  closeSidebarContextMenu();
  if (!db) return;
  let isNowPinned = false;
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(noteId).onsuccess = (ev) => {
    const m = ev.target.result;
    if (!m || m.type === "folder") return;
    if (m.pinnedAt) {
      delete m.pinnedAt;
      isNowPinned = false;
    } else {
      m.pinnedAt = Date.now();
      isNowPinned = true;
    }
    store.put(m);
  };
  tx.oncomplete = () => {
    loadMemoList(true);
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") loadFileManager(currentFmFolderId);
    updateUnsyncedCount();
    if (typeof showToast === "function") {
      showToast(isNowPinned ? "상단에 고정되었습니다." : "고정이 해제되었습니다.");
    }
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  };
}

function duplicateNoteFromSidebar(noteId) {
  closeSidebarContextMenu();
  if (!db) return;
  let clonedId = null;
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(noteId).onsuccess = (ev) => {
    const m = ev.target.result;
    if (!m || m.type === "folder") return;
    const clone = {
      ...m,
      syncId: typeof generateSyncId === "function" ? generateSyncId() : Date.now().toString(36),
      title: `(사본) ${m.title || "제목 없는 노트"}`,
      updatedAt: Date.now(),
    };
    delete clone.pinnedAt;
    delete clone.id;
    store.add(clone).onsuccess = (addEv) => {
      clonedId = addEv.target.result;
    };
  };
  tx.oncomplete = () => {
    loadMemoList(true);
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
      loadFileManager(currentFmFolderId);
      updateUnsyncedCount();
    } else {
      updateUnsyncedCount();
      if (clonedId && typeof loadMemo === "function") loadMemo(clonedId);
    }
    if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
  };
}

function getExplorerSurfaceState(surface) {
  if (surface === "fm") {
    return {
      listId: "fm-list",
      expandedSet: fmExpandedSet,
      isDriveCollapsed: () => fmDriveCollapsed,
      setDriveCollapsed: (v) => { fmDriveCollapsed = !!v; },
      getSelectedFolderId: () => currentFmFolderId,
      setSelectedFolderId: (v) => { currentFmFolderId = v; },
      isDriveSelected: () => currentFmFolderId === null,
      setDriveSelected: (v) => { if (v) currentFmFolderId = null; },
      getFocusedRowKey: () => fmFocusedRowKey,
      setFocusedRowKey: (k) => { fmFocusedRowKey = k; },
      getCache: () => window.__zenFmTreeDataCache || window.__zenTreeDataCache,
      rerender: () => renderFmTreeFromCache(),
      expandInMemory: (fid) => { if (fid !== null && fid !== undefined) fmExpandedSet.add(fid); },
      saveExpanded: () => {},
      setPendingSecurityExpand: (v) => { window.__zenPendingFmSecurityExpand = !!v; },
    };
  }
  return {
    listId: "memo-list",
    expandedSet: sidebarExpandedSet,
    isDriveCollapsed: () => sidebarDriveCollapsed,
    setDriveCollapsed: (v) => {
      sidebarDriveCollapsed = !!v;
      try { localStorage.setItem(SIDEBAR_DRIVE_COLLAPSED_KEY, sidebarDriveCollapsed ? "true" : "false"); } catch {}
    },
    getSelectedFolderId: () => sidebarSelectedFolderId,
    setSelectedFolderId: (v) => { sidebarSelectedFolderId = v; },
    isDriveSelected: () => sidebarSelectedDrive,
    setDriveSelected: (v) => { sidebarSelectedDrive = !!v; },
    getFocusedRowKey: () => sidebarFocusedRowKey,
    setFocusedRowKey: (k) => { sidebarFocusedRowKey = k; },
    getCache: () => window.__zenTreeDataCache,
    rerender: () => renderSidebarTreeFromCache(),
    expandInMemory: (fid) => expandSidebarFolderInMemory(fid),
    saveExpanded: () => saveSidebarExpandedState(),
    setPendingSecurityExpand: (v) => { window.__zenPendingSidebarSecurityExpand = !!v; },
  };
}

function openSidebarContextMenu(e, meta) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const menu = document.getElementById("sidebar-context-menu");
  if (!menu) return;

  const surface = meta && meta.surface === "fm" ? "fm" : "sidebar";
  const st = getExplorerSurfaceState(surface);
  const cache = st.getCache();
  const items = [];
  const sortMode = getSidebarNoteSortMode();

  const createFolderAction = (parentId) => {
    if (surface === "fm") {
      if (parentId === null) {
        currentFmFolderId = null;
        return createNewFolder();
      }
      return createFolderInsideTarget(parentId);
    }
    return createSidebarFolder(parentId);
  };

  const createNoteAction = (folderId) => {
    if (surface === "fm") {
      createNewMemoInFolder(folderId);
      return;
    }
    if (cache && (folderId === globalSecurityFolderId || cache.isUnderSecuritySync(folderId))) {
      expandSidebarFolderInMemory(folderId);
    } else if (folderId !== null && folderId !== undefined) {
      sidebarExpandedSet.add(folderId);
      saveSidebarExpandedState();
    }
    createNewMemo(folderId);
  };

  const subtreeExpandAction = (fid, expand) => {
    if (surface === "fm") setFmSubtreeExpanded(fid, expand);
    else setSubtreeExpanded(fid, expand);
  };

  const allExpandAction = (expand) => {
    if (surface === "fm") setFmAllUnderDriveExpanded(expand);
    else setAllUnderDriveExpanded(expand);
  };

  if (meta.kind === "drive") {
    items.push({ label: "새 폴더 만들기", icon: "fa-solid fa-folder-plus", fn: () => createFolderAction(null) });
    if (surface !== "fm") {
      items.push({ label: "임시 폴더에 새 노트", icon: "fa-solid fa-pen-to-square", fn: () => {
        st.setDriveCollapsed(false);
        if (globalDesktopFolderId !== null) sidebarExpandedSet.add(globalDesktopFolderId);
        saveSidebarExpandedState();
        createNewMemo(globalDesktopFolderId);
      }});
    }
    items.push({ divider: true });
    items.push({ label: "모두 펼치기", icon: "fa-solid fa-angles-down", fn: () => allExpandAction(true) });
    items.push({ label: "모두 접기", icon: "fa-solid fa-angles-up", fn: () => allExpandAction(false) });
    items.push({ divider: true });
    items.push({ label: "정렬: 최신 수정순", icon: sortMode === "updated" ? "fa-solid fa-check" : "fa-regular fa-clock", checked: sortMode === "updated", fn: () => setSidebarNoteSortMode("updated") });
    items.push({ label: "정렬: 이름순", icon: sortMode === "name" ? "fa-solid fa-check" : "fa-solid fa-arrow-down-a-z", checked: sortMode === "name", fn: () => setSidebarNoteSortMode("name") });
    if (surface !== "fm") {
      items.push({ divider: true });
      items.push({ label: "전체 폴더관리 열기", icon: "fa-solid fa-folder-open", fn: () => openFileManager() });
    }
  } else if (meta.kind === "trashFolder" || meta.kind === "trashNote") {
    items.push({ label: "복구하기", icon: "fa-solid fa-rotate-left", fn: () => fmRestore(meta.id) });
    items.push({ label: "다른 폴더로 이동", icon: "fa-solid fa-arrows-up-down-left-right", fn: () => openMoveModal(meta.id) });
    items.push({ divider: true });
    items.push({ label: "영구 삭제", icon: "fa-solid fa-xmark", danger: true, fn: () => fmHardDelete(meta.id) });
  } else if (meta.kind === "folder") {
    const f = cache ? cache.folderMap.get(meta.id) : null;
    const sysType = meta.sysType || (f ? f.isSystem : "");
    if (sysType === "desktop") {
      items.push({ label: "여기에 새 노트", icon: "fa-solid fa-pen-to-square", fn: () => createNoteAction(meta.id) });
      items.push({ label: "하위 폴더 만들기", icon: "fa-solid fa-folder-plus", fn: () => createFolderAction(meta.id) });
      items.push({ divider: true });
      items.push({ label: "하위 모두 펼치기", icon: "fa-solid fa-angles-down", fn: () => subtreeExpandAction(meta.id, true) });
      items.push({ label: "하위 모두 접기", icon: "fa-solid fa-angles-up", fn: () => subtreeExpandAction(meta.id, false) });
      items.push({ divider: true });
      items.push({ label: "임시 폴더 비우기", icon: "fa-solid fa-broom", danger: true, fn: () => emptyTempFolder() });
    } else if (sysType === "bh_official" || sysType === "bh_memo" || sysType === "bh_doc") {
      items.push({ label: "이 폴더에 새 노트", icon: "fa-solid fa-pen-to-square", fn: () => createNoteAction(meta.id) });
      items.push({ label: "하위 폴더 만들기", icon: "fa-solid fa-folder-plus", fn: () => createFolderAction(meta.id) });
      items.push({ divider: true });
      items.push({ label: "하위 모두 펼치기", icon: "fa-solid fa-angles-down", fn: () => subtreeExpandAction(meta.id, true) });
      items.push({ label: "하위 모두 접기", icon: "fa-solid fa-angles-up", fn: () => subtreeExpandAction(meta.id, false) });
    } else if (sysType === "trash") {
      items.push({ label: "하위 모두 펼치기", icon: "fa-solid fa-angles-down", fn: () => subtreeExpandAction(meta.id, true) });
      items.push({ label: "하위 모두 접기", icon: "fa-solid fa-angles-up", fn: () => subtreeExpandAction(meta.id, false) });
      items.push({ divider: true });
      items.push({ label: "휴지통 비우기", icon: "fa-solid fa-trash-can", danger: true, fn: () => emptyTrash() });
    } else if (sysType === "bh_official" || sysType === "bh_memo" || sysType === "bh_doc") {
      items.push({ label: "이 폴더에 새 노트", icon: "fa-solid fa-pen-to-square", fn: () => createNoteAction(meta.id) });
      items.push({ label: "하위 폴더 만들기", icon: "fa-solid fa-folder-plus", fn: () => createFolderAction(meta.id) });
      items.push({ divider: true });
      items.push({ label: "하위 모두 펼치기", icon: "fa-solid fa-angles-down", fn: () => subtreeExpandAction(meta.id, true) });
      items.push({ label: "하위 모두 접기", icon: "fa-solid fa-angles-up", fn: () => subtreeExpandAction(meta.id, false) });
    } else if (sysType === "security") {
      const unlocked = Boolean(isSecurityUnlocked && currentSecKey);
      if (!unlocked) {
        items.push({ label: "잠금 해제", icon: "fa-solid fa-lock-open", fn: () => {
          st.setPendingSecurityExpand(true);
          const hasPw = localStorage.getItem("zen_sec_hash");
          openSecurityModal(hasPw ? "enter" : "setup");
        }});
      } else {
        items.push({ label: "보안 노트 작성", icon: "fa-solid fa-pen-to-square", fn: () => createNoteAction(meta.id) });
        items.push({ label: "하위 폴더 만들기", icon: "fa-solid fa-folder-plus", fn: () => createFolderAction(meta.id) });
        items.push({ label: "하위 모두 펼치기", icon: "fa-solid fa-angles-down", fn: () => subtreeExpandAction(meta.id, true) });
        items.push({ label: "하위 모두 접기", icon: "fa-solid fa-angles-up", fn: () => subtreeExpandAction(meta.id, false) });
        items.push({ label: "지금 잠그기", icon: "fa-solid fa-lock", fn: () => lockSecurityFolderOnly() });
      }
      items.push({ divider: true });
      const secAutoLockOn = isSecurityAutoLockEnabled();
      items.push({
        label: secAutoLockOn ? "오토락 사용" : "오토락 해제",
        icon: secAutoLockOn ? "fa-solid fa-shield-halved" : "fa-solid fa-shield",
        toggle: secAutoLockOn,
        fn: () => toggleSecurityAutoLock(),
      });
      items.push({ label: "비밀번호 변경", icon: "fa-solid fa-key", fn: () => handleSecurityMenuChange() });
      items.push({ label: "비상 삭제", icon: "fa-solid fa-triangle-exclamation", danger: true, fn: () => emergencyDeleteSecurity() });
    } else {
      items.push({ label: "이 폴더에 새 노트", icon: "fa-solid fa-pen-to-square", fn: () => createNoteAction(meta.id) });
      items.push({ label: "하위 폴더 만들기", icon: "fa-solid fa-folder-plus", fn: () => createFolderAction(meta.id) });
      items.push({ divider: true });
      items.push({ label: "하위 모두 펼치기", icon: "fa-solid fa-angles-down", fn: () => subtreeExpandAction(meta.id, true) });
      items.push({ label: "하위 모두 접기", icon: "fa-solid fa-angles-up", fn: () => subtreeExpandAction(meta.id, false) });
      items.push({ divider: true });
      items.push({ label: "이름 바꾸기", icon: "fa-solid fa-pen", fn: () => fmRename(meta.id) });
      items.push({ label: "이동하기", icon: "fa-solid fa-arrows-up-down-left-right", fn: () => openMoveModal(meta.id) });
      items.push({ label: "휴지통으로", icon: "fa-solid fa-trash-can", danger: true, fn: () => deleteSidebarFolderWithConfirm(meta.id) });
    }
  } else if (meta.kind === "note") {
    if (!meta.isUnderSecurity) {
      items.push({
        label: meta.isPinned ? "고정 해제" : "상단 고정",
        icon: "fa-solid fa-thumbtack",
        fn: () => toggleNotePinFromSidebar(meta.id),
      });
    }
    items.push({ label: "이름 바꾸기", icon: "fa-solid fa-pen", fn: () => fmRename(meta.id) });
    items.push({ label: "복사본 만들기", icon: "fa-solid fa-copy", fn: () => duplicateNoteFromSidebar(meta.id) });
    items.push({ label: "이동하기", icon: "fa-solid fa-arrows-up-down-left-right", fn: () => openMoveModal(meta.id) });
    items.push({ label: "공유하기 (.myns)", icon: "fa-solid fa-share-nodes", fn: () => {
      if (typeof exportMemoByIdAsMYNS === "function") exportMemoByIdAsMYNS(meta.id);
    }});
    items.push({ divider: true });
    items.push({ label: "휴지통으로", icon: "fa-solid fa-trash-can", danger: true, fn: () => deleteSidebarNoteWithConfirm(meta.id) });
  } else {
    items.push({ label: "새 폴더 만들기", icon: "fa-solid fa-folder-plus", fn: () => createFolderAction(null) });
    if (surface !== "fm") {
      items.push({ label: "임시 폴더에 새 노트", icon: "fa-solid fa-pen-to-square", fn: () => createNewMemo(globalDesktopFolderId) });
    }
    items.push({ divider: true });
    items.push({ label: "모두 펼치기", icon: "fa-solid fa-angles-down", fn: () => allExpandAction(true) });
    items.push({ label: "모두 접기", icon: "fa-solid fa-angles-up", fn: () => allExpandAction(false) });
    if (surface === "fm") {
      items.push({ divider: true });
      items.push({ label: "정렬: 최신 수정순", icon: sortMode === "updated" ? "fa-solid fa-check" : "fa-regular fa-clock", checked: sortMode === "updated", fn: () => setSidebarNoteSortMode("updated") });
      items.push({ label: "정렬: 이름순", icon: sortMode === "name" ? "fa-solid fa-check" : "fa-solid fa-arrow-down-a-z", checked: sortMode === "name", fn: () => setSidebarNoteSortMode("name") });
    } else {
      items.push({ label: "전체 폴더관리 열기", icon: "fa-solid fa-folder-open", fn: () => openFileManager() });
    }
  }

  menu.innerHTML = "";
  items.forEach((it) => {
    if (it.divider) {
      const div = document.createElement("div");
      div.className = "sidebar-context-divider";
      menu.appendChild(div);
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `sidebar-context-item${it.danger ? " is-danger" : ""}${it.checked ? " is-checked" : ""}`;
    const toggleHtml = typeof it.toggle === "boolean"
      ? `<span class="sidebar-ctx-toggle${it.toggle ? " is-on" : ""}" aria-hidden="true"></span>`
      : "";
    btn.innerHTML = `<i class="${it.icon}"></i><span>${escapeTreeHtml(it.label)}</span>${toggleHtml}`;
    btn.onclick = (ev) => {
      ev.stopPropagation();
      closeSidebarContextMenu();
      it.fn();
    };
    menu.appendChild(btn);
  });

  menu.style.display = "block";
  const vw = window.innerWidth || 1024;
  const vh = window.innerHeight || 768;
  const mw = menu.offsetWidth || 188;
  const mh = menu.offsetHeight || 220;
  const clickX = e && typeof e.clientX === "number" ? e.clientX : 120;
  const clickY = e && typeof e.clientY === "number" ? e.clientY : 120;
  const left = Math.max(8, Math.min(vw - mw - 8, clickX));
  const top = Math.max(8, Math.min(vh - mh - 8, clickY));
  menu.style.left = `${Math.round(left)}px`;
  menu.style.top = `${Math.round(top)}px`;
}

function setSurfaceKeyboardFocusRow(rowEl, surface = "sidebar") {
  const st = getExplorerSurfaceState(surface);
  const listEl = document.getElementById(st.listId);
  if (!listEl) return;
  listEl.querySelectorAll(".tree-row.is-kbd-focus").forEach((el) => el.classList.remove("is-kbd-focus"));
  if (!rowEl) {
    st.setFocusedRowKey(null);
    return;
  }
  st.setFocusedRowKey(rowEl.dataset.rowKey || null);
  rowEl.classList.add("is-kbd-focus");
  if (typeof rowEl.scrollIntoView === "function") {
    rowEl.scrollIntoView({ block: "nearest" });
  }
}

function bindSurfaceKeyboardNav(surface = "sidebar") {
  const st = getExplorerSurfaceState(surface);
  const listEl = document.getElementById(st.listId);
  if (!listEl || listEl.__zenKeyNavBound) return;
  listEl.__zenKeyNavBound = true;

  listEl.addEventListener("keydown", (e) => {
    if (typeof isAppScreenLocked === "function" && isAppScreenLocked()) return;
    if (e.target && e.target.closest && e.target.closest("input, textarea")) return;
    const ctxMenu = document.getElementById("sidebar-context-menu");
    if (ctxMenu && ctxMenu.style.display === "block") return;

    const handledKeys = ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft", "Enter", "F2", "Delete"];
    if (!handledKeys.includes(e.key)) return;

    const rows = Array.from(listEl.querySelectorAll(".tree-row"));
    if (rows.length === 0) return;

    const focusedKey = st.getFocusedRowKey();
    let idx = rows.findIndex((r) => focusedKey && r.dataset.rowKey === focusedKey);
    if (idx === -1) idx = rows.findIndex((r) => r.classList.contains("is-active"));
    if (idx === -1) idx = rows.findIndex((r) => r.classList.contains("is-active-folder"));
    if (idx === -1) idx = 0;

    const curRow = rows[idx];

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSurfaceKeyboardFocusRow(rows[Math.min(rows.length - 1, idx + 1)], surface);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSurfaceKeyboardFocusRow(rows[Math.max(0, idx - 1)], surface);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (curRow.dataset.driveRoot === "true") {
        if (st.isDriveCollapsed()) {
          st.setDriveCollapsed(false);
          st.setFocusedRowKey("drive:root");
          st.rerender();
        } else if (idx + 1 < rows.length && rows[idx + 1].dataset.parentKey === "drive:root") {
          setSurfaceKeyboardFocusRow(rows[idx + 1], surface);
        }
        return;
      }
      if (curRow.dataset.folderId) {
        const fid = Number(curRow.dataset.folderId);
        if (!curRow.classList.contains("is-expanded")) {
          st.setFocusedRowKey(curRow.dataset.rowKey);
          curRow.click();
        } else if (idx + 1 < rows.length && rows[idx + 1].dataset.parentKey === `folder:${fid}`) {
          setSurfaceKeyboardFocusRow(rows[idx + 1], surface);
        }
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (curRow.dataset.driveRoot === "true") {
        if (!st.isDriveCollapsed()) {
          st.setDriveCollapsed(true);
          st.setFocusedRowKey("drive:root");
          st.rerender();
        }
        return;
      }
      if (curRow.dataset.folderId && curRow.classList.contains("is-expanded")) {
        st.setFocusedRowKey(curRow.dataset.rowKey);
        curRow.click();
        return;
      }
      const pKey = curRow.dataset.parentKey;
      if (pKey) {
        const pRow = rows.find((r) => r.dataset.rowKey === pKey);
        if (pRow) setSurfaceKeyboardFocusRow(pRow, surface);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      st.setFocusedRowKey(curRow.dataset.rowKey || null);
      curRow.click();
      return;
    }
    if (curRow.classList.contains("tree-in-trash")) {
      if (e.key === "Delete") {
        e.preventDefault();
        const tid = Number(curRow.dataset.folderId || curRow.dataset.memoId);
        if (!isNaN(tid)) fmHardDelete(tid);
      }
      return;
    }
    if (e.key === "F2") {
      e.preventDefault();
      if (curRow.dataset.folderId && !curRow.classList.contains("is-system-folder") && curRow.dataset.driveRoot !== "true") {
        fmRename(Number(curRow.dataset.folderId));
      } else if (curRow.dataset.memoId) {
        fmRename(Number(curRow.dataset.memoId));
      }
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      if (curRow.dataset.folderId && !curRow.classList.contains("is-system-folder") && curRow.dataset.driveRoot !== "true") {
        deleteSidebarFolderWithConfirm(Number(curRow.dataset.folderId));
      } else if (curRow.dataset.memoId) {
        deleteSidebarNoteWithConfirm(Number(curRow.dataset.memoId));
      }
    }
  });
}

function bindSidebarKeyboardNav() {
  bindSurfaceKeyboardNav("sidebar");
}

function bindFmKeyboardNav() {
  const fmListEl = document.getElementById("fm-list");
  if (fmListEl && !fmListEl.__zenContextBound) {
    fmListEl.__zenContextBound = true;
    fmListEl.addEventListener("scroll", closeSidebarContextMenu, { passive: true });
    fmListEl.addEventListener("contextmenu", (e) => {
      if (e.target && e.target.closest && e.target.closest(".tree-row")) return;
      openSidebarContextMenu(e, { kind: "blank", surface: "fm" });
    });
  }
  bindSurfaceKeyboardNav("fm");
}

(function bindGlobalSidebarContextClose() {
  if (window.__zenSidebarContextCloseBound) return;
  window.__zenSidebarContextCloseBound = true;
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("sidebar-context-menu");
    if (menu && menu.style.display === "block" && !menu.contains(e.target)) {
      closeSidebarContextMenu();
    }
  });
  const listEl = document.getElementById("memo-list");
  if (listEl) {
    listEl.addEventListener("scroll", closeSidebarContextMenu, { passive: true });
    listEl.addEventListener("contextmenu", (e) => {
      if (e.target && e.target.closest && e.target.closest(".tree-row")) return;
      openSidebarContextMenu(e, { kind: "blank", surface: "sidebar" });
    });
  }
  bindSidebarKeyboardNav();
  bindFmKeyboardNav();
})();

function handleSidebarNoteRowClick(e, memoId, parentId) {
  if (e.target && e.target.closest && e.target.closest(".tree-row-actions, .tree-pin-toggle-btn")) return;
  closeSidebarContextMenu();
  if (isPressTriggered) {
    isPressTriggered = false;
    return;
  }

  const isCtrl = e.ctrlKey || e.metaKey;
  const isShift = e.shiftKey;

  if (isMultiSelectMode && !isCtrl && !isShift) {
    if (selectedMemos.has(memoId)) {
      selectedMemos.delete(memoId);
      if (selectedMemos.size === 0) isMultiSelectMode = false;
    } else {
      selectedMemos.add(memoId);
      lastSelectedId = memoId;
    }
    loadMemoList(false);
    return;
  }

  forceSaveImmediate();

  if (isShift && lastSelectedId !== null) {
    const cIdx = displayedMemos.findIndex((m) => m.id === memoId);
    const lIdx = displayedMemos.findIndex((m) => m.id === lastSelectedId);
    if (cIdx !== -1 && lIdx !== -1) {
      const start = Math.min(cIdx, lIdx);
      const end = Math.max(cIdx, lIdx);
      if (!isCtrl) selectedMemos.clear();
      for (let i = start; i <= end; i++) {
        selectedMemos.add(displayedMemos[i].id);
      }
    }
    loadMemoList(false);
  } else if (isCtrl) {
    if (selectedMemos.has(memoId)) selectedMemos.delete(memoId);
    else selectedMemos.add(memoId);
    lastSelectedId = memoId;
    loadMemoList(false);
  } else {
    if (window.getSelection) {
      const sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
    selectedMemos.clear();
    selectedMemos.add(memoId);
    lastSelectedId = memoId;
    isMultiSelectMode = false;
    sidebarSelectedDrive = false;
    sidebarSelectedFolderId = (parentId === undefined) ? null : parentId;
    loadMemo(memoId);
  }
}

function attachSidebarDragSource(li, itemMeta, surface = "sidebar") {
  li.draggable = true;
  li.addEventListener("dragstart", (e) => {
    cancelPress();
    closeSidebarContextMenu();
    window.__zenInternalTreeDragging = true;
    let ids = [itemMeta.id];
    if (surface === "fm") {
      if (isFmMultiSelectMode && fmSelectedItems.has(itemMeta.id) && fmSelectedItems.size > 0) {
        ids = Array.from(fmSelectedItems);
      }
    } else if (itemMeta.kind === "note" && selectedMemos.has(itemMeta.id) && selectedMemos.size > 1) {
      ids = Array.from(selectedMemos);
    }
    __zenDraggedTreeIds = ids;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("application/zen-tree-ids", JSON.stringify(ids)); } catch {}
      try { e.dataTransfer.setData("text/plain", String(ids[0])); } catch {}
    }
    li.classList.add("is-dragging");
  });

  li.addEventListener("dragend", () => {
    window.__zenInternalTreeDragging = false;
    __zenDraggedTreeIds = [];
    clearSpringLoadTimer();
    document.querySelectorAll("#memo-list .is-drop-target, #memo-list .is-dragging, #fm-list .is-drop-target, #fm-list .is-dragging").forEach((el) => {
      el.classList.remove("is-drop-target", "is-dragging");
    });
  });
}

function parseDraggedTreeIds(e) {
  if (Array.isArray(__zenDraggedTreeIds) && __zenDraggedTreeIds.length > 0) {
    return __zenDraggedTreeIds.slice();
  }
  if (e && e.dataTransfer) {
    try {
      const raw = e.dataTransfer.getData("application/zen-tree-ids");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    try {
      const fmRaw = e.dataTransfer.getData("application/zen-fm-id");
      if (fmRaw) {
        const parsed = fmRaw.split(",").map((x) => parseInt(x, 10)).filter((n) => !isNaN(n));
        if (parsed.length > 0) return parsed;
      }
    } catch {}
  }
  return [];
}

function attachSidebarFolderDropTarget(li, folderObj, isLockedSecurity, surface = "sidebar") {
  if (isLockedSecurity) return;
  const st = getExplorerSurfaceState(surface);
  const isTrashRoot = folderObj.id === globalTrashFolderId || folderObj.isSystem === "trash";

  li.addEventListener("dragover", (e) => {
    if (!window.__zenInternalTreeDragging) return;
    const dragIds = parseDraggedTreeIds(e);
    if (dragIds.length === 0 || (dragIds.length === 1 && dragIds[0] === folderObj.id)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    li.classList.add("is-drop-target");

    if (!isTrashRoot && !st.expandedSet.has(folderObj.id) && __zenSpringLoadFolderId !== folderObj.id) {
      clearSpringLoadTimer();
      __zenSpringLoadFolderId = folderObj.id;
      __zenSpringLoadTimer = setTimeout(() => {
        if (!window.__zenInternalTreeDragging) return;
        const cache = st.getCache();
        const isSec = cache && (folderObj.id === globalSecurityFolderId || cache.isUnderSecuritySync(folderObj.id));
        if (isSec && (!isSecurityUnlocked || !currentSecKey)) return;
        st.expandedSet.add(folderObj.id);
        if (!isSec) st.saveExpanded();
        st.rerender();
      }, 600);
    }
  });

  li.addEventListener("dragleave", (e) => {
    if (e.relatedTarget && li.contains(e.relatedTarget)) return;
    li.classList.remove("is-drop-target");
    if (__zenSpringLoadFolderId === folderObj.id) clearSpringLoadTimer();
  });

  li.addEventListener("drop", async (e) => {
    if (!window.__zenInternalTreeDragging) return;
    e.preventDefault();
    e.stopPropagation();
    li.classList.remove("is-drop-target");
    clearSpringLoadTimer();
    const dragIds = parseDraggedTreeIds(e);
    window.__zenInternalTreeDragging = false;
    __zenDraggedTreeIds = [];
    if (dragIds.length === 0) return;

    if (isTrashRoot) {
      await deleteItemsToTrashWithUndo(dragIds);
      return;
    }

    const cache = st.getCache();
    const isSec = cache && (folderObj.id === globalSecurityFolderId || cache.isUnderSecuritySync(folderObj.id));
    if (isSec) st.expandInMemory(folderObj.id);
    else {
      st.expandedSet.add(folderObj.id);
      st.saveExpanded();
    }
    await moveItemsToFolder(dragIds, folderObj.id);
  });
}

function handleFmSelectableClick(itemObj, e) {
  if (!itemObj) return;
  const isSys = Boolean(itemObj.isSystem);
  if (isSys) {
    showToast("시스템 폴더는 선택할 수 없습니다.");
    return;
  }
  if (!isFmMultiSelectMode) {
    isFmMultiSelectMode = true;
    fmSelectedItems.clear();
    history.pushState({ mode: "multi" }, "");
  }
  const selectableList = (currentFmDisplayedItems || []).filter(
    (it) => it && !it.isSystem,
  );
  if (e && e.shiftKey && lastFmSelectedId !== null) {
    const cIdx = selectableList.findIndex((it) => it.id === itemObj.id);
    const lIdx = selectableList.findIndex((it) => it.id === lastFmSelectedId);
    if (cIdx !== -1 && lIdx !== -1) {
      const start = Math.min(cIdx, lIdx);
      const end = Math.max(cIdx, lIdx);
      for (let i = start; i <= end; i++) {
        fmSelectedItems.add(selectableList[i].id);
      }
    } else {
      fmSelectedItems.add(itemObj.id);
    }
  } else {
    if (fmSelectedItems.has(itemObj.id)) fmSelectedItems.delete(itemObj.id);
    else fmSelectedItems.add(itemObj.id);
    lastFmSelectedId = itemObj.id;
  }
  updateFmBottomBar();
  renderFmTreeFromCache();
}

function createTreeDriveElement(directChildCount, surface = "sidebar") {
  const st = getExplorerSurfaceState(surface);
  const driveLabel = getFmDriveRootTitle();
  const rowKey = "drive:root";
  const isCollapsed = st.isDriveCollapsed();
  const isSelected = st.isDriveSelected();
  const li = document.createElement("li");
  li.className = [
    "tree-row",
    "tree-row-folder",
    "tree-row-drive",
    !isCollapsed ? "is-expanded" : "",
    isSelected ? "is-active-folder" : "",
    st.getFocusedRowKey() === rowKey ? "is-kbd-focus" : "",
  ].filter(Boolean).join(" ");

  li.dataset.driveRoot = "true";
  li.dataset.rowKey = rowKey;
  li.style.setProperty("--depth", "0");
  li.title = driveLabel;

  const countHtml = directChildCount > 0
    ? `<span class="tree-folder-count">${directChildCount}</span>`
    : "";

  li.innerHTML = `
    <i class="fa-solid fa-chevron-right tree-chevron" aria-hidden="true"></i>
    <i class="fa-solid fa-hard-drive tree-folder-icon is-drive" aria-hidden="true"></i>
    <span class="tree-folder-title">${escapeTreeHtml(driveLabel)}</span>
    ${countHtml}
    <span class="tree-row-actions">
      <button type="button" class="tree-act-btn tree-act-add" title="새 폴더 만들기"><i class="fa-solid fa-folder-plus"></i></button>
      <button type="button" class="tree-act-btn tree-act-more" title="드라이브 메뉴"><i class="fa-solid fa-ellipsis"></i></button>
    </span>
  `;

  const addBtn = li.querySelector(".tree-act-add");
  if (addBtn) {
    addBtn.onclick = (ev) => {
      ev.stopPropagation();
      if (surface === "fm") {
        currentFmFolderId = null;
        createNewFolder();
      } else {
        createSidebarFolder(null);
      }
    };
  }

  const moreBtn = li.querySelector(".tree-act-more");
  if (moreBtn) {
    moreBtn.onclick = (ev) => {
      openSidebarContextMenu(ev, { kind: "drive", surface });
    };
  }

  li.onclick = (e) => {
    if (e.target && e.target.closest && e.target.closest(".tree-row-actions")) return;
    closeSidebarContextMenu();
    st.setDriveSelected(true);
    st.setSelectedFolderId(null);
    st.setFocusedRowKey(rowKey);
    st.setDriveCollapsed(!st.isDriveCollapsed());
    st.rerender();
  };

  li.oncontextmenu = (e) => {
    openSidebarContextMenu(e, { kind: "drive", surface });
  };

  li.addEventListener("dragover", (e) => {
    if (!window.__zenInternalTreeDragging) return;
    const dragIds = parseDraggedTreeIds(e);
    if (dragIds.length === 0) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    li.classList.add("is-drop-target");

    if (st.isDriveCollapsed() && __zenSpringLoadFolderId !== "__drive_root__") {
      clearSpringLoadTimer();
      __zenSpringLoadFolderId = "__drive_root__";
      __zenSpringLoadTimer = setTimeout(() => {
        if (!window.__zenInternalTreeDragging) return;
        st.setDriveCollapsed(false);
        st.rerender();
      }, 600);
    }
  });

  li.addEventListener("dragleave", (e) => {
    if (e.relatedTarget && li.contains(e.relatedTarget)) return;
    li.classList.remove("is-drop-target");
    if (__zenSpringLoadFolderId === "__drive_root__") clearSpringLoadTimer();
  });

  li.addEventListener("drop", async (e) => {
    if (!window.__zenInternalTreeDragging) return;
    e.preventDefault();
    e.stopPropagation();
    li.classList.remove("is-drop-target");
    clearSpringLoadTimer();
    const dragIds = parseDraggedTreeIds(e);
    window.__zenInternalTreeDragging = false;
    __zenDraggedTreeIds = [];
    if (dragIds.length === 0) return;
    st.setDriveCollapsed(false);
    await moveItemsToFolder(dragIds, null);
  });

  return li;
}

function createTreeNoteElement(m, depth, cache, options) {
  const opts = options || {};
  const surface = opts.surface === "fm" ? "fm" : "sidebar";
  const st = getExplorerSurfaceState(surface);
  const isFm = surface === "fm";
  const isUnderTrash = !!opts.isUnderTrash;
  const li = document.createElement("li");
  const isActive = isFm
    ? (isFmMultiSelectMode ? fmSelectedItems.has(m.id) : Number(currentMemoId) === Number(m.id))
    : (isMultiSelectMode ? selectedMemos.has(m.id) : Number(currentMemoId) === Number(m.id));
  const isSelected = isFm
    ? (isFmMultiSelectMode && fmSelectedItems.has(m.id))
    : (!isActive && selectedMemos.has(m.id));
  const rowKey = opts.inPinnedSection ? `pinned:${m.id}` : `note:${m.id}`;

  li.className = [
    "tree-row",
    "tree-row-note",
    isActive && !isFm ? "active is-active" : "",
    isFm && !isFmMultiSelectMode && Number(currentMemoId) === Number(m.id) ? "is-active" : "",
    isSelected ? "is-selected" : "",
    opts.inPinnedSection ? "is-pinned-entry" : "",
    opts.searchPath ? "is-search-result" : "",
    opts.isUnderSecurity ? "tree-under-security" : "",
    isUnderTrash ? "tree-in-trash" : "",
    st.getFocusedRowKey() === rowKey ? "is-kbd-focus" : "",
  ].filter(Boolean).join(" ");

  li.dataset.memoId = String(m.id);
  li.dataset.rowKey = rowKey;
  if (opts.parentKey) li.dataset.parentKey = opts.parentKey;
  li.style.setProperty("--depth", String(Math.min(depth, 6)));

  const titleText = (m.title && String(m.title).trim()) || "제목 없는 노트";
  const pathText = opts.searchPath || (isUnderTrash ? "휴지통" : cache.getFolderPathString(m.parentId));
  li.title = isUnderTrash
    ? `${titleText}\n위치: 휴지통\n삭제: ${formatDateTime(m.deletedAt || m.updatedAt || Date.now())}`
    : `${titleText}\n위치: ${pathText}\n수정: ${formatDateTime(m.updatedAt || Date.now())}`;

  let guidesHtml = "";
  const clampedDepth = Math.min(depth, 6);
  for (let i = 0; i < clampedDepth; i++) {
    guidesHtml += '<span class="tree-guide" aria-hidden="true"></span>';
  }

  const checkboxHtml = (isFm && isFmMultiSelectMode)
    ? `<i class="${fmSelectedItems.has(m.id) ? "fa-solid fa-square-check is-checked" : "fa-regular fa-square"} fm-tree-checkbox" aria-hidden="true"></i>`
    : "";

  const leftIconHtml = opts.inPinnedSection
    ? `<button type="button" class="tree-pin-toggle-btn" title="고정 해제" aria-label="고정 해제" onclick="event.stopPropagation(); toggleNotePinFromSidebar(${m.id});"><i class="fa-solid fa-thumbtack"></i></button>`
    : '<i class="fa-regular fa-file-lines tree-note-icon" aria-hidden="true"></i>';

  const pinBadge = (!opts.inPinnedSection && !isUnderTrash && m.pinnedAt)
    ? '<i class="fa-solid fa-thumbtack tree-inline-pin" title="고정된 노트"></i>'
    : "";
  const pathBadge = opts.searchPath
    ? `<span class="tree-search-path">${escapeTreeHtml(opts.searchPath)}</span>`
    : "";
  const fmDateMeta = isFm
    ? `<span class="fm-row-meta">${escapeTreeHtml(formatDateTime((isUnderTrash ? m.deletedAt : m.updatedAt) || m.updatedAt || Date.now()))}</span>`
    : "";

  let actionsHtml = "";
  if (isUnderTrash) {
    if (isFm) {
      actionsHtml = `
        <button type="button" class="tree-act-btn tree-act-restore" title="복구하기"><i class="fa-solid fa-rotate-left"></i></button>
        <button type="button" class="tree-act-btn tree-act-harddel" title="영구 삭제"><i class="fa-solid fa-xmark"></i></button>
      `;
    }
    actionsHtml += '<button type="button" class="tree-act-btn tree-act-more" title="더보기 메뉴"><i class="fa-solid fa-ellipsis"></i></button>';
  } else {
    const quickPinHtml = (opts.inPinnedSection || opts.isUnderSecurity)
      ? ""
      : `<button type="button" class="tree-act-btn ${m.pinnedAt ? "is-pinned" : ""}" title="${m.pinnedAt ? "고정 해제" : "상단 고정"}" onclick="event.stopPropagation(); toggleNotePinFromSidebar(${m.id});"><i class="fa-solid fa-thumbtack"></i></button>`;
    const fmExtraActions = isFm
      ? `
        <button type="button" class="tree-act-btn tree-act-rename" title="이름 바꾸기"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="tree-act-btn tree-act-move" title="이동하기"><i class="fa-solid fa-arrows-up-down-left-right"></i></button>
        <button type="button" class="tree-act-btn tree-act-delete" title="휴지통으로"><i class="fa-solid fa-trash-can"></i></button>
      `
      : "";
    actionsHtml = `
      ${quickPinHtml}
      ${fmExtraActions}
      <button type="button" class="tree-act-btn tree-act-more" title="더보기 메뉴"><i class="fa-solid fa-ellipsis"></i></button>
    `;
  }

  li.innerHTML = `
    ${guidesHtml}
    ${checkboxHtml}
    ${leftIconHtml}
    <span class="tree-note-text">
      <span class="tree-note-title">${escapeTreeHtml(titleText)}</span>
      ${pathBadge}
    </span>
    ${pinBadge}
    ${fmDateMeta}
    <span class="tree-row-actions">
      ${actionsHtml}
    </span>
  `;

  const bindBtn = (sel, fn) => {
    const b = li.querySelector(sel);
    if (b) b.onclick = (ev) => { ev.stopPropagation(); fn(ev); };
  };
  bindBtn(".tree-act-restore", () => fmRestore(m.id));
  bindBtn(".tree-act-harddel", () => fmHardDelete(m.id));
  bindBtn(".tree-act-rename", () => fmRename(m.id));
  bindBtn(".tree-act-move", () => openMoveModal(m.id));
  bindBtn(".tree-act-delete", () => deleteSidebarNoteWithConfirm(m.id));

  const moreBtn = li.querySelector(".tree-act-more");
  if (moreBtn) {
    moreBtn.onclick = (ev) => {
      openSidebarContextMenu(ev, isUnderTrash
        ? { kind: "trashNote", id: m.id, surface }
        : {
            kind: "note",
            id: m.id,
            isPinned: !!m.pinnedAt,
            isUnderSecurity: !!opts.isUnderSecurity,
            surface,
          });
    };
  }

  if (!isUnderTrash) {
    li.addEventListener("mousedown", (e) => {
      if (e.target && e.target.closest && e.target.closest(".tree-pin-toggle-btn, .tree-row-actions")) return;
      if (e.button === 0) startPress(e, m.id, false);
    });
    li.addEventListener("touchstart", (e) => {
      if (e.target && e.target.closest && e.target.closest(".tree-pin-toggle-btn, .tree-row-actions")) return;
      startPress(e, m.id, false);
    }, { passive: true });
    li.addEventListener("mouseup", cancelPress);
    li.addEventListener("mouseleave", cancelPress);
    li.addEventListener("touchend", cancelPress);
    li.addEventListener("touchmove", cancelPress, { passive: true });
  }

  li.onclick = (e) => {
    if (e.target && e.target.closest && e.target.closest(".tree-row-actions, .tree-pin-toggle-btn")) return;
    st.setFocusedRowKey(rowKey);
    if (isFm) {
      closeSidebarContextMenu();
      if (isPressTriggered) { isPressTriggered = false; return; }
      if (isFmMultiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
        handleFmSelectableClick(m, e);
        return;
      }
      if (isUnderTrash) {
        showToast("휴지통에 있는 노트입니다. 복구 버튼 또는 우클릭 메뉴에서 복구 후 열어주세요.");
        return;
      }
      closeFileManager();
      loadMemo(m.id);
      return;
    }
    if (isUnderTrash) {
      closeSidebarContextMenu();
      showToast("휴지통에 있는 노트입니다. 우클릭 또는 더보기 메뉴에서 복구 후 열어주세요.");
      return;
    }
    handleSidebarNoteRowClick(e, m.id, m.parentId);
  };

  li.oncontextmenu = (e) => {
    openSidebarContextMenu(e, isUnderTrash
      ? { kind: "trashNote", id: m.id, surface }
      : {
          kind: "note",
          id: m.id,
          isPinned: !!m.pinnedAt,
          isUnderSecurity: !!opts.isUnderSecurity,
          surface,
        });
  };

  if (!isUnderTrash) {
    attachSidebarDragSource(li, { kind: "note", id: m.id }, surface);
  }
  return li;
}

function createTreeFolderElement(folderObj, depth, cache, options) {
  const opts = options || {};
  const surface = opts.surface === "fm" ? "fm" : "sidebar";
  const st = getExplorerSurfaceState(surface);
  const isFm = surface === "fm";
  const isSecurityRoot = folderObj.id === globalSecurityFolderId || folderObj.isSystem === "security";
  const isTrashRoot = folderObj.id === globalTrashFolderId || folderObj.isSystem === "trash";
  const isUnderTrash = !isTrashRoot && Boolean(opts.isUnderTrash);
  const isLockedSecurity = isSecurityRoot && (!isSecurityUnlocked || !currentSecKey);
  const isExpanded = !isLockedSecurity && st.expandedSet.has(folderObj.id);
  const isSystemFolder = Boolean(folderObj.isSystem);
  const isSelected = !st.isDriveSelected() && st.getSelectedFolderId() === folderObj.id;
  const isMultiSelected = isFm && isFmMultiSelectMode && !isSystemFolder && fmSelectedItems.has(folderObj.id);
  const isUnderSec = Boolean(opts.isUnderSecurity) || isSecurityRoot;
  const rowKey = `folder:${folderObj.id}`;
  const displayTitle = getFmFolderDisplayTitle(folderObj);

  const li = document.createElement("li");
  li.className = [
    "tree-row",
    "tree-row-folder",
    isExpanded ? "is-expanded" : "",
    isSelected ? "is-active-folder" : "",
    isMultiSelected ? "is-selected" : "",
    isSystemFolder ? "is-system-folder" : "",
    isLockedSecurity ? "is-locked" : "",
    isUnderSec ? "tree-under-security" : "",
    (isTrashRoot || isUnderTrash) && isUnderTrash ? "tree-in-trash" : "",
    st.getFocusedRowKey() === rowKey ? "is-kbd-focus" : "",
  ].filter(Boolean).join(" ");

  li.dataset.folderId = String(folderObj.id);
  li.dataset.rowKey = rowKey;
  if (opts.parentKey) li.dataset.parentKey = opts.parentKey;
  li.style.setProperty("--depth", String(Math.min(depth, 6)));
  li.title = displayTitle;

  let guidesHtml = "";
  const clampedDepth = Math.min(depth, 6);
  for (let i = 0; i < clampedDepth; i++) {
    guidesHtml += '<span class="tree-guide" aria-hidden="true"></span>';
  }

  let folderIconClass = isExpanded ? "fa-regular fa-folder-open" : "fa-regular fa-folder";
  let extraIconClass = "";
  if (folderObj.isSystem === "bh_official") {
    folderIconClass = "fa-solid fa-file-signature";
    extraIconClass = "is-bh-official";
  } else if (folderObj.isSystem === "bh_memo") {
    folderIconClass = "fa-regular fa-paper-plane";
    extraIconClass = "is-bh-memo";
  } else if (folderObj.isSystem === "bh_doc") {
    folderIconClass = "fa-regular fa-file-lines";
    extraIconClass = "is-bh-doc";
  } else if (folderObj.isSystem === "desktop") {
    folderIconClass = "fa-solid fa-inbox";
    extraIconClass = "is-desktop";
  } else if (isTrashRoot) {
    folderIconClass = "fa-solid fa-trash-can";
    extraIconClass = "is-trash";
  } else if (isSecurityRoot) {
    folderIconClass = isLockedSecurity ? "fa-solid fa-lock" : "fa-solid fa-lock-open";
    extraIconClass = isLockedSecurity ? "is-security" : "is-security-open";
  }

  let directCount = 0;
  if (isTrashRoot) {
    directCount = cache.trashTotalCount || 0;
  } else if (isUnderTrash) {
    directCount = (cache.trashChildrenFoldersByParent.get(folderObj.id) || []).length +
      (cache.trashChildrenNotesByParent.get(folderObj.id) || []).length;
  } else if (!isLockedSecurity) {
    directCount = (cache.childrenFoldersByParent.get(folderObj.id) || []).length +
      (cache.childrenNotesByParent.get(folderObj.id) || []).length;
  }

  const countOrLockHtml = isLockedSecurity
    ? '<span class="tree-lock-badge">잠금</span>'
    : (directCount > 0 ? `<span class="tree-folder-count">${directCount}</span>` : "");

  const checkboxHtml = (isFm && isFmMultiSelectMode && !isSystemFolder)
    ? `<i class="${fmSelectedItems.has(folderObj.id) ? "fa-solid fa-square-check is-checked" : "fa-regular fa-square"} fm-tree-checkbox" title="폴더 선택" aria-hidden="true"></i>`
    : "";

  const fmDateMeta = (isFm && !isSystemFolder)
    ? `<span class="fm-row-meta">${escapeTreeHtml(formatDateTime((isUnderTrash ? folderObj.deletedAt : folderObj.updatedAt) || folderObj.updatedAt || Date.now()))}</span>`
    : "";

  let folderActionsHtml = "";
  if (isUnderTrash) {
    if (isFm) {
      folderActionsHtml = `
        <button type="button" class="tree-act-btn tree-act-restore" title="복구하기"><i class="fa-solid fa-rotate-left"></i></button>
        <button type="button" class="tree-act-btn tree-act-harddel" title="영구 삭제"><i class="fa-solid fa-xmark"></i></button>
      `;
    }
    folderActionsHtml += '<button type="button" class="tree-act-btn tree-act-more" title="폴더 메뉴"><i class="fa-solid fa-ellipsis"></i></button>';
  } else if (isTrashRoot) {
    if (isFm) {
      folderActionsHtml += '<button type="button" class="tree-act-btn tree-act-empty-trash" title="휴지통 비우기"><i class="fa-solid fa-broom"></i></button>';
    }
    folderActionsHtml += '<button type="button" class="tree-act-btn tree-act-more" title="휴지통 메뉴"><i class="fa-solid fa-ellipsis"></i></button>';
  } else {
    if (!isLockedSecurity) {
      folderActionsHtml += `<button type="button" class="tree-act-btn tree-act-add" title="이 폴더에 새 노트"><i class="fa-solid fa-plus"></i></button>`;
      if (isFm) {
        folderActionsHtml += `<button type="button" class="tree-act-btn tree-act-newsub" title="하위 폴더 만들기"><i class="fa-solid fa-folder-plus"></i></button>`;
      }
    }
    if (isFm && isSecurityRoot && !isLockedSecurity) {
      folderActionsHtml += '<button type="button" class="tree-act-btn tree-act-locksec" title="지금 잠그기"><i class="fa-solid fa-lock"></i></button>';
    }
    if (isFm && !isSystemFolder) {
      folderActionsHtml += `
        <button type="button" class="tree-act-btn tree-act-rename" title="이름 바꾸기"><i class="fa-solid fa-pen"></i></button>
        <button type="button" class="tree-act-btn tree-act-delete" title="휴지통으로"><i class="fa-solid fa-trash-can"></i></button>
      `;
    }
    folderActionsHtml += '<button type="button" class="tree-act-btn tree-act-more" title="폴더 메뉴"><i class="fa-solid fa-ellipsis"></i></button>';
  }

  li.innerHTML = `
    ${guidesHtml}
    ${checkboxHtml}
    <i class="fa-solid fa-chevron-right tree-chevron" aria-hidden="true"></i>
    <i class="${folderIconClass} tree-folder-icon ${extraIconClass}" aria-hidden="true"></i>
    <span class="tree-folder-title">${escapeTreeHtml(displayTitle)}</span>
    ${countOrLockHtml}
    ${fmDateMeta}
    <span class="tree-row-actions">
      ${folderActionsHtml}
    </span>
  `;

  const bindBtn = (sel, fn) => {
    const b = li.querySelector(sel);
    if (b) b.onclick = (ev) => { ev.stopPropagation(); fn(ev); };
  };
  bindBtn(".tree-act-add", () => {
    closeSidebarContextMenu();
    if (isFm) {
      createNewMemoInFolder(folderObj.id);
      return;
    }
    st.setDriveSelected(false);
    st.setSelectedFolderId(folderObj.id);
    if (isUnderSec) st.expandInMemory(folderObj.id);
    else {
      st.expandedSet.add(folderObj.id);
      st.saveExpanded();
    }
    createNewMemo(folderObj.id);
  });
  bindBtn(".tree-act-newsub", () => createFolderInsideTarget(folderObj.id));
  bindBtn(".tree-act-locksec", () => lockSecurityFolderOnly());
  bindBtn(".tree-act-empty-trash", () => emptyTrash());
  bindBtn(".tree-act-restore", () => fmRestore(folderObj.id));
  bindBtn(".tree-act-harddel", () => fmHardDelete(folderObj.id));
  bindBtn(".tree-act-rename", () => fmRename(folderObj.id));
  bindBtn(".tree-act-delete", () => deleteSidebarFolderWithConfirm(folderObj.id));

  const moreBtn = li.querySelector(".tree-act-more");
  if (moreBtn) {
    moreBtn.onclick = (ev) => {
      openSidebarContextMenu(ev, isUnderTrash
        ? { kind: "trashFolder", id: folderObj.id, surface }
        : {
            kind: "folder",
            id: folderObj.id,
            sysType: folderObj.isSystem || "",
            surface,
          });
    };
  }

  li.onclick = (e) => {
    if (e.target && e.target.closest && e.target.closest(".tree-row-actions")) return;
    closeSidebarContextMenu();
    const clickedCheckbox = Boolean(e.target && e.target.closest && e.target.closest(".fm-tree-checkbox"));
    if (isFm && !isSystemFolder && ((isFmMultiSelectMode && (clickedCheckbox || e.ctrlKey || e.metaKey || e.shiftKey)) || (!isFmMultiSelectMode && (e.ctrlKey || e.metaKey || e.shiftKey)))) {
      st.setFocusedRowKey(rowKey);
      handleFmSelectableClick(folderObj, e);
      return;
    }

    st.setDriveSelected(false);
    st.setSelectedFolderId(folderObj.id);
    st.setFocusedRowKey(rowKey);

    if (isLockedSecurity) {
      st.setPendingSecurityExpand(true);
      const hasPw = localStorage.getItem("zen_sec_hash");
      openSecurityModal(hasPw ? "enter" : "setup");
      return;
    }

    if (!isFm) ensureSidebarExpandedInitialized();
    if (st.expandedSet.has(folderObj.id)) {
      st.expandedSet.delete(folderObj.id);
    } else {
      st.expandedSet.add(folderObj.id);
    }
    if (!isUnderSec && !isTrashRoot && !isUnderTrash) st.saveExpanded();
    st.rerender();
  };

  li.oncontextmenu = (e) => {
    openSidebarContextMenu(e, isUnderTrash
      ? { kind: "trashFolder", id: folderObj.id, surface }
      : {
          kind: "folder",
          id: folderObj.id,
          sysType: folderObj.isSystem || "",
          surface,
        });
  };

  if (!isSystemFolder && !isUnderTrash) {
    attachSidebarDragSource(li, { kind: "folder", id: folderObj.id }, surface);
  }
  if (!isUnderTrash) {
    attachSidebarFolderDropTarget(li, folderObj, isLockedSecurity, surface);
  }
  return li;
}

function renderExplorerTreeSurface(surface = "sidebar") {
  const isFm = surface === "fm";
  const st = getExplorerSurfaceState(surface);
  const list = document.getElementById(st.listId);
  if (!list) return;
  const cache = st.getCache();
  if (!cache) {
    list.innerHTML = "";
    return;
  }

  if (!isFm) {
    ensureSidebarExpandedInitialized();
    bindSidebarKeyboardNav();
    if (typeof syncMainSearchClearBtn === "function") syncMainSearchClearBtn();
  } else {
    bindFmKeyboardNav();
    syncFmSearchClearBtn();
    fmPath = buildFmBreadcrumbSteps(currentFmFolderId, cache);
    isCurrentInTrash = Boolean(currentFmFolderId && cache.isTrashDescendantSync(currentFmFolderId));
    renderFmBreadcrumbs();
  }

  const searchEl = document.getElementById(isFm ? "fm-search-input" : "list-search-input");
  const query = searchEl ? searchEl.value.trim().toLowerCase() : "";
  const savedScroll = list.scrollTop;

  const frag = document.createDocumentFragment();
  const visibleItems = [];

  if (query.length > 0) {
    const matchedFolders = [];
    const matchedNotes = [];
    cache.rawAll.forEach((m) => {
      if (!m || m.isDeleted || m.isPermanentlyDeleted) return;
      if (m.type === "folder") {
        if (!isFm) return;
        if (m.isSystem === "trash" || m.isSystem === "backup") return;
        if (cache.isUnderTrashSync(m.id)) return;
        if ((m.id === globalSecurityFolderId || cache.isUnderSecuritySync(m.id)) && (!isSecurityUnlocked || !currentSecKey)) return;
        const fTitle = getFmFolderDisplayTitle(m).toLowerCase();
        const pathStr = cache.getFolderPathString(m.parentId);
        if (fTitle.includes(query) || pathStr.toLowerCase().includes(query)) {
          matchedFolders.push({ item: m, pathStr });
        }
        return;
      }

      if (cache.isUnderTrashSync(m.parentId)) return;
      const isUnderSec = cache.isUnderSecuritySync(m.parentId);
      if (!isFm && isUnderSec) return;
      if (isUnderSec && (!isSecurityUnlocked || !currentSecKey)) return;
      if (String(m.plainText || "").startsWith("ZENENC::") || String(m.content || "").startsWith("ZENENC::")) return;

      const safeTitle = (m.title || "제목 없는 노트").toLowerCase();
      const safePlainText = m.plainText ? String(m.plainText).toLowerCase() : "";
      const pathStr = cache.getFolderPathString(m.parentId);
      if (safeTitle.includes(query) || safePlainText.includes(query) || pathStr.toLowerCase().includes(query)) {
        matchedNotes.push({ item: m, pathStr, isUnderSecurity: isUnderSec });
      }
    });

    matchedFolders.sort((a, b) => compareNaturalKorean(getFmFolderDisplayTitle(a.item), getFmFolderDisplayTitle(b.item)));
    matchedNotes.sort((a, b) => (b.item.updatedAt || 0) - (a.item.updatedAt || 0));

    const totalMatched = matchedFolders.length + matchedNotes.length;
    const header = document.createElement("li");
    header.className = "tree-section-header tree-search-status";
    header.textContent = totalMatched > 0 ? `검색 결과 ${totalMatched}건` : "일치하는 항목이 없습니다.";
    frag.appendChild(header);

    matchedFolders.forEach(({ item, pathStr }) => {
      visibleItems.push(item);
      const rowEl = createTreeFolderElement(item, 0, cache, {
        surface,
        isUnderSecurity: item.id === globalSecurityFolderId || cache.isUnderSecuritySync(item.id),
      });
      const titleWrap = rowEl.querySelector(".tree-folder-title");
      if (titleWrap && pathStr) {
        const sp = document.createElement("span");
        sp.className = "tree-search-path";
        sp.textContent = pathStr;
        titleWrap.parentNode.insertBefore(sp, titleWrap.nextSibling);
      }
      if (!isFmMultiSelectMode) {
        rowEl.onclick = () => {
          const si = document.getElementById("fm-search-input");
          if (si) si.value = "";
          syncFmSearchClearBtn();
          fmDriveCollapsed = false;
          let curr = item.parentId;
          const seen = new Set();
          while (curr !== null && curr !== undefined && !seen.has(curr)) {
            seen.add(curr);
            fmExpandedSet.add(curr);
            const pf = cache.folderMap.get(curr);
            curr = pf ? pf.parentId : null;
          }
          fmExpandedSet.add(item.id);
          currentFmFolderId = item.id;
          fmSelectedRowKey = `folder:${item.id}`;
          fmFocusedRowKey = fmSelectedRowKey;
          renderFmTreeFromCache();
        };
      }
      frag.appendChild(rowEl);
    });

    matchedNotes.forEach(({ item, pathStr, isUnderSecurity }) => {
      visibleItems.push(item);
      frag.appendChild(createTreeNoteElement(item, 0, cache, { surface, searchPath: pathStr, isUnderSecurity }));
    });

    if (isFm) {
      currentFmDisplayedItems = visibleItems;
      renderFmQuickActions(cache);
      updateFmBottomBar();
    } else {
      displayedMemos = visibleItems;
    }
    list.innerHTML = "";
    list.appendChild(frag);
    list.scrollTop = savedScroll;
    return;
  }

  // 1. 상단 고정 노트 구역 (왼쪽 사이드바 전용, 전체 폴더관리 창에서는 제외)
  if (!isFm) {
    const pinnedNotes = cache.rawAll.filter((m) => {
      if (!m || m.type === "folder" || m.isDeleted || m.isPermanentlyDeleted || !m.pinnedAt) return false;
      if (cache.isUnderTrashSync(m.parentId) || cache.isUnderSecuritySync(m.parentId)) return false;
      return true;
    });
    pinnedNotes.sort((a, b) => (a.pinnedAt || 0) - (b.pinnedAt || 0));

    if (pinnedNotes.length > 0) {
      const secHeader = document.createElement("li");
      secHeader.className = `tree-section-header is-collapsible${sidebarPinnedCollapsed ? "" : " is-expanded"}`;
      secHeader.innerHTML = `
        <i class="fa-solid fa-chevron-right tree-section-chevron" aria-hidden="true"></i>
        <span>고정 노트</span>
        <span class="tree-section-count">${pinnedNotes.length}</span>
      `;
      secHeader.onclick = () => {
        sidebarPinnedCollapsed = !sidebarPinnedCollapsed;
        localStorage.setItem(SIDEBAR_PINNED_COLLAPSED_KEY, sidebarPinnedCollapsed ? "true" : "false");
        renderSidebarTreeFromCache();
      };
      frag.appendChild(secHeader);

      if (!sidebarPinnedCollapsed) {
        pinnedNotes.forEach((m) => {
          visibleItems.push(m);
          frag.appendChild(createTreeNoteElement(m, 0, cache, { surface, inPinnedSection: true, isUnderSecurity: false }));
        });
      }

      const pinnedDiv = document.createElement("li");
      pinnedDiv.className = "tree-divider tree-pinned-divider";
      pinnedDiv.setAttribute("aria-hidden", "true");
      frag.appendChild(pinnedDiv);
    }
  }

  // 2. 가상 드라이브 -> 임시 폴더 + 사용자 폴더 + (루트 노트 잔재) + 휴지통 -> 구분선 -> 보안 폴더
  function appendFolderSubtree(folderObj, depth, isUnderSecurityBranch, parentKey = null) {
    const isSecRoot = folderObj.id === globalSecurityFolderId || folderObj.isSystem === "security";
    const branchUnderSec = isUnderSecurityBranch || isSecRoot;
    const isLockedSec = isSecRoot && (!isSecurityUnlocked || !currentSecKey);

    if (isFm && !folderObj.isSystem) visibleItems.push(folderObj);
    frag.appendChild(createTreeFolderElement(folderObj, depth, cache, { surface, isUnderSecurity: branchUnderSec, parentKey }));

    if (isLockedSec || !st.expandedSet.has(folderObj.id)) return;

    const rawSubFolders = (cache.childrenFoldersByParent.get(folderObj.id) || [])
      .slice()
      .sort((a, b) => compareNaturalKorean(a.title, b.title));
    const rawSubNotes = sortSidebarNotes(cache.childrenNotesByParent.get(folderObj.id) || []);
    const selfParentKey = `folder:${folderObj.id}`;

    rawSubFolders.forEach((sf) => appendFolderSubtree(sf, depth + 1, branchUnderSec, selfParentKey));
    rawSubNotes.forEach((sn) => {
      visibleItems.push(sn);
      frag.appendChild(createTreeNoteElement(sn, depth + 1, cache, { surface, isUnderSecurity: branchUnderSec, parentKey: selfParentKey }));
    });

    if (rawSubFolders.length === 0 && rawSubNotes.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = `tree-empty-hint${branchUnderSec ? " tree-under-security" : ""}`;
      emptyLi.style.setProperty("--depth", String(Math.min(depth + 1, 6)));
      emptyLi.textContent = "비어 있음";
      frag.appendChild(emptyLi);
    }
  }

  function appendTrashSubtree(folderObj, depth, isRootTrash, parentKey = null) {
    if (isFm && !isRootTrash) visibleItems.push(folderObj);
    frag.appendChild(createTreeFolderElement(folderObj, depth, cache, {
      surface,
      isUnderTrash: !isRootTrash,
      parentKey,
    }));

    if (!st.expandedSet.has(folderObj.id)) return;

    const subFolders = (isRootTrash ? cache.trashRootFolders : (cache.trashChildrenFoldersByParent.get(folderObj.id) || []))
      .slice()
      .sort((a, b) => compareNaturalKorean(a.title, b.title));
    const subNotes = (isRootTrash ? cache.trashRootNotes : (cache.trashChildrenNotesByParent.get(folderObj.id) || []))
      .slice()
      .sort((a, b) => (b.deletedAt || b.updatedAt || 0) - (a.deletedAt || a.updatedAt || 0));
    const selfParentKey = `folder:${folderObj.id}`;

    subFolders.forEach((tf) => appendTrashSubtree(tf, depth + 1, false, selfParentKey));
    subNotes.forEach((tn) => {
      visibleItems.push(tn);
      frag.appendChild(createTreeNoteElement(tn, depth + 1, cache, {
        surface,
        isUnderTrash: true,
        parentKey: selfParentKey,
      }));
    });

    if (subFolders.length === 0 && subNotes.length === 0) {
      const emptyLi = document.createElement("li");
      emptyLi.className = "tree-empty-hint tree-in-trash";
      emptyLi.style.setProperty("--depth", String(Math.min(depth + 1, 6)));
      emptyLi.textContent = "휴지통이 비어 있음";
      frag.appendChild(emptyLi);
    }
  }

  const rootFolders = (cache.childrenFoldersByParent.get(null) || []).slice();
  const bhOfficialFolder = rootFolders.find(
    (f) => f.isSystem === "bh_official" || f.syncId === "sys_bh_official" ||
      (typeof globalBhOfficialFolderId !== "undefined" && globalBhOfficialFolderId !== null && f.id === globalBhOfficialFolderId),
  );
  const bhMemoFolder = rootFolders.find(
    (f) => f.isSystem === "bh_memo" || f.syncId === "sys_bh_memo" ||
      (typeof globalBhMemoFolderId !== "undefined" && globalBhMemoFolderId !== null && f.id === globalBhMemoFolderId),
  );
  const bhDocFolder = rootFolders.find(
    (f) => f.isSystem === "bh_doc" || f.syncId === "sys_bh_doc" ||
      (typeof globalBhDocFolderId !== "undefined" && globalBhDocFolderId !== null && f.id === globalBhDocFolderId),
  );
  const desktopFolder = rootFolders.find((f) => f.id === globalDesktopFolderId || f.isSystem === "desktop");
  const securityFolder = rootFolders.find((f) => f.id === globalSecurityFolderId || f.isSystem === "security");
  const trashFolder = cache.trashFolderObj;
  const userRootFolders = rootFolders
    .filter(
      (f) =>
        !f.isSystem &&
        f.id !== globalDesktopFolderId &&
        f.id !== globalSecurityFolderId &&
        f.id !== globalTrashFolderId &&
        f.id !== globalBackupFolderId &&
        f.id !== globalBhOfficialFolderId &&
        f.id !== globalBhMemoFolderId &&
        f.id !== globalBhDocFolderId,
    )
    .sort((a, b) => compareNaturalKorean(a.title, b.title));
  const homeRootNotes = sortSidebarNotes(cache.childrenNotesByParent.get(null) || []);

  const driveChildCount =
    (bhOfficialFolder ? 1 : 0) +
    (bhMemoFolder ? 1 : 0) +
    (bhDocFolder ? 1 : 0) +
    (desktopFolder ? 1 : 0) +
    userRootFolders.length +
    homeRootNotes.length +
    (trashFolder ? 1 : 0);
  frag.appendChild(createTreeDriveElement(driveChildCount, surface));

  if (!st.isDriveCollapsed()) {
    if (bhOfficialFolder) appendFolderSubtree(bhOfficialFolder, 1, false, "drive:root");
    if (bhMemoFolder) appendFolderSubtree(bhMemoFolder, 1, false, "drive:root");
    if (bhDocFolder) appendFolderSubtree(bhDocFolder, 1, false, "drive:root");
    if (desktopFolder) appendFolderSubtree(desktopFolder, 1, false, "drive:root");
    userRootFolders.forEach((uf) => appendFolderSubtree(uf, 1, false, "drive:root"));
    homeRootNotes.forEach((hn) => {
      visibleItems.push(hn);
      frag.appendChild(createTreeNoteElement(hn, 1, cache, { surface, isUnderSecurity: false, parentKey: "drive:root" }));
    });
    if (trashFolder) appendTrashSubtree(trashFolder, 1, true, "drive:root");
  }

  if (securityFolder) {
    const divLi = document.createElement("li");
    divLi.className = "tree-divider";
    divLi.setAttribute("aria-hidden", "true");
    frag.appendChild(divLi);
    appendFolderSubtree(securityFolder, 0, true, null);
  }

  if (isFm) {
    currentFmDisplayedItems = visibleItems;
    renderFmQuickActions(cache);
    updateFmBottomBar();
  } else {
    displayedMemos = visibleItems;
  }

  list.innerHTML = "";
  list.appendChild(frag);
  list.scrollTop = savedScroll;
}

function renderSidebarTreeFromCache() {
  renderExplorerTreeSurface("sidebar");
}

function renderFmTreeFromCache() {
  renderExplorerTreeSurface("fm");
}

function loadMemoList(queryDB = true) {
  const list = document.getElementById("memo-list");
  if (!list) return;

  if (queryDB) {
    if (!db) return;
    const tx = db.transaction(["memos"], "readonly");
    tx.objectStore("memos").getAll().onsuccess = (e) => {
      const allData = e.target.result || [];
      window.__zenTreeDataCache = buildSidebarTreeCache(allData);
      renderSidebarTreeFromCache();
    };
  } else {
    if (window.__zenTreeDataCache) {
      renderSidebarTreeFromCache();
    } else {
      list.innerHTML = "";
    }
  }
}

window.compareNaturalKorean = compareNaturalKorean;
window.buildSidebarTreeCache = buildSidebarTreeCache;
window.saveSidebarExpandedState = saveSidebarExpandedState;
window.expandSidebarFolderInMemory = expandSidebarFolderInMemory;
window.collapseSidebarSecurityTree = collapseSidebarSecurityTree;
window.collapseFmSecurityTree = collapseFmSecurityTree;
window.lockSecurityFolderOnly = lockSecurityFolderOnly;
window.toggleAllSidebarFolders = toggleAllSidebarFolders;
window.setFmSubtreeExpanded = setFmSubtreeExpanded;
window.setFmAllUnderDriveExpanded = setFmAllUnderDriveExpanded;
window.toggleFmAllFolders = toggleFmAllFolders;
window.getSidebarNoteSortMode = getSidebarNoteSortMode;
window.setSidebarNoteSortMode = setSidebarNoteSortMode;
window.setSubtreeExpanded = setSubtreeExpanded;
window.setAllUnderDriveExpanded = setAllUnderDriveExpanded;
window.emptyTempFolder = emptyTempFolder;
window.createFolderInsideTarget = createFolderInsideTarget;
window.clearMainSearch = clearMainSearch;
window.clearFmSearch = clearFmSearch;
window.syncFmSearchClearBtn = syncFmSearchClearBtn;
window.deleteItemsToTrashWithUndo = deleteItemsToTrashWithUndo;
window.renderFmTreeFromCache = renderFmTreeFromCache;
window.createNewMemoSmart = createNewMemoSmart;
window.createSidebarFolder = createSidebarFolder;
window.createSidebarFolderFromHeader = createSidebarFolderFromHeader;
window.revealMemoInSidebarTree = revealMemoInSidebarTree;
window.openSidebarContextMenu = openSidebarContextMenu;
window.closeSidebarContextMenu = closeSidebarContextMenu;
window.toggleNotePinFromSidebar = toggleNotePinFromSidebar;
window.duplicateNoteFromSidebar = duplicateNoteFromSidebar;
window.deleteSidebarNoteWithConfirm = deleteSidebarNoteWithConfirm;
window.deleteSidebarFolderWithConfirm = deleteSidebarFolderWithConfirm;
window.getSidebarExpandedIds = () => Array.from(sidebarExpandedSet);

function loadTrashList() {
  const searchInp = document.getElementById("trash-search-input");
  const query = searchInp ? searchInp.value.toLowerCase() : "";
  const list = document.getElementById("trash-list");
  if (!list || !db) return;
  const savedScroll = list.scrollTop;

  const tx = db.transaction(["memos"], "readonly");
  displayedTrashMemos = [];

  tx.objectStore("memos").getAll().onsuccess = (e) => {
    const allData = e.target.result || [];

    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });

    function getOriginPath(parentId) {
      const driveLabel = getFmDriveRootTitle();
      if (parentId === null || parentId === undefined) return driveLabel;
      const parts = [];
      let curr = parentId;
      const visited = new Set();
      let includesSec = false;
      while (curr !== null && curr !== undefined) {
        if (visited.has(curr)) break;
        visited.add(curr);
        const pf = folderMap.get(curr);
        if (!pf) return parts.length > 0 ? parts.join(" > ") : "삭제된 폴더";
        if (pf.isSystem === "security") includesSec = true;
        parts.unshift(pf.isSystem === "desktop" ? "임시 폴더" : (pf.title || "폴더"));
        curr = pf.parentId;
      }
      if (parts.length === 0) return driveLabel;
      return includesSec ? parts.join(" > ") : `${driveLabel} > ${parts.join(" > ")}`;
    }

    const trashEntries = [];
    allData.forEach((m) => {
      const isFile = m.type === "file" || m.type === undefined;
      if (!m.isDeleted || m.isPermanentlyDeleted || !isFile) return;

      const isEncrypted = String(m.plainText || "").startsWith("ZENENC::") || String(m.content || "").startsWith("ZENENC::");
      const safeTitle = (m.title || "제목 없는 노트").toLowerCase();
      const safePlainText = (!isEncrypted && m.plainText) ? String(m.plainText).toLowerCase() : "";
      const originPath = getOriginPath(m.parentId);
      const matchQuery =
        safeTitle.includes(query) ||
        safePlainText.includes(query) ||
        originPath.toLowerCase().includes(query);

      if (matchQuery) {
        displayedTrashMemos.push(m);
        trashEntries.push({ memo: m, originPath });
      }
    });

    displayedTrashMemos.sort((a, b) => (b.deletedAt || b.updatedAt || 0) - (a.deletedAt || a.updatedAt || 0));
    trashEntries.sort((a, b) => (b.memo.deletedAt || b.memo.updatedAt || 0) - (a.memo.deletedAt || a.memo.updatedAt || 0));

    list.innerHTML = "";
    trashEntries.forEach(({ memo, originPath }) => {
      list.appendChild(createTrashElement(memo, originPath));
    });
    list.scrollTop = savedScroll;
  };
}

// 🎯 [수정] 날짜 형식 변경 (줄 맞춤을 위해 0을 채워 넣음)
function formatDateTime(timestamp) {
  const d = new Date(timestamp);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hr = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yr}.${mo}.${da}. ${hr}:${mi}`;
}

function createMemoElement(memo) {
  const cache = window.__zenTreeDataCache || buildSidebarTreeCache([]);
  return createTreeNoteElement(memo, 0, cache, { isUnderSecurity: false }, () => null);
}

function createTrashElement(memo, originPath = "") {
  const li = document.createElement("li");
  li.className = `memo-item ${selectedTrashMemos.has(memo.id) ? "active" : ""}`;
  const dateStr = formatDateTime(memo.deletedAt || memo.updatedAt);
  const subLabel = originPath ? `${dateStr} · ${originPath}` : dateStr;
  li.title = `${memo.title || "제목 없는 노트"}\n원래 위치: ${originPath || "알 수 없음"}`;
  li.innerHTML = `
                <div class="memo-info">
                    <span class="memo-title">${escapeTreeHtml(memo.title || "제목 없는 노트")}</span>
                    <span class="memo-date">${escapeTreeHtml(subLabel)}</span>
                </div>
                <div class="memo-actions-wrap">
                    <div class="memo-actions">
                        <i class="fa-solid fa-rotate-left btn-restore" onclick="restoreMemo(${memo.id}, event)"></i>
                        <i class="fa-solid fa-xmark btn-hard-delete" onclick="hardDeleteMemo(${memo.id}, event)"></i>
                    </div>
                    <i class="fa-solid fa-ellipsis-vertical btn-more mobile-only" onclick="toggleMemoMenu(event)"></i>
                </div>`;

  li.addEventListener("mousedown", (e) => startPress(e, memo.id, true));
  li.addEventListener("touchstart", (e) => startPress(e, memo.id, true), {
    passive: true,
  });
  li.addEventListener("mouseup", cancelPress);
  li.addEventListener("mouseleave", cancelPress);
  li.addEventListener("touchend", cancelPress);
  li.addEventListener("touchmove", cancelPress, { passive: true });

  li.onclick = (e) => {
    if (e.target.closest(".memo-actions-wrap")) return;

    if (isPressTriggered) {
      isPressTriggered = false;
      return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isTrashMultiSelectMode && !isCtrl && !isShift) {
      if (selectedTrashMemos.has(memo.id)) {
        selectedTrashMemos.delete(memo.id);
        if (selectedTrashMemos.size === 0) isTrashMultiSelectMode = false;
      } else {
        selectedTrashMemos.add(memo.id);
        lastSelectedTrashId = memo.id;
      }
      loadTrashList();
      return;
    }

    if (isShift && lastSelectedTrashId !== null) {
      const cIdx = displayedTrashMemos.findIndex((m) => m.id === memo.id);
      const lIdx = displayedTrashMemos.findIndex(
        (m) => m.id === lastSelectedTrashId,
      );

      if (cIdx !== -1 && lIdx !== -1) {
        const start = Math.min(cIdx, lIdx);
        const end = Math.max(cIdx, lIdx);
        if (!isCtrl) selectedTrashMemos.clear();
        for (let i = start; i <= end; i++)
          selectedTrashMemos.add(displayedTrashMemos[i].id);
      }
      loadTrashList();
    } else if (isCtrl) {
      if (selectedTrashMemos.has(memo.id)) selectedTrashMemos.delete(memo.id);
      else selectedTrashMemos.add(memo.id);
      lastSelectedTrashId = memo.id;
      loadTrashList();
    } else {
      selectedTrashMemos.clear();
      selectedTrashMemos.add(memo.id);
      lastSelectedTrashId = memo.id;
      isTrashMultiSelectMode = false;
      loadTrashList();
    }
  };
  return li;
}

// 🎯 [교정] 데이터 기반 핀 토글 (다중 선택 대응)
function togglePin(id, e) {
  if (e) e.stopPropagation();
  forceSaveImmediate();

  // 다중 선택 중이면 선택된 모든 항목, 아니면 클릭한 항목 하나만 대상
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
        // 🎯 핵심 교정: CSS 클래스가 아니라 데이터의 pinnedAt 존재 여부로 판단
        if (memo.pinnedAt) {
          delete memo.pinnedAt; // 이미 고정되어 있으면 해제
        } else {
          memo.pinnedAt = Date.now(); // 고정되어 있지 않으면 현재 시간으로 고정
        }
        store.put(memo);
      }
    };
  });

  tx.oncomplete = () => {
    loadMemoList(true); // 목록 새로고침
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 🚀 [보안 코어 1] 노트 불러오기 (복호화 검문소)
async function loadMemo(id) {
  guardSecurityCrudAutoLock(800);
  targetNewMemoFolderId = null; // 🎯 기존 노트를 열 때는 저장 타겟 폴더를 초기화합니다.
  if (currentMemoId === id) return; // 이미 열려있는 노트면 무시 (속도 향상)

  forceSaveImmediate(); // 이동 전 안전하게 저장
  const previousMemoId = currentMemoId;

  isLoading = true;

  // 🎯 [보안] 열려는 노트가 보안 폴더 소속인지 족보 검사
  const targetParentId = await getMemoParentIdDB(id);
  isEditingSecureMemo = await checkIsUnderSecurity(targetParentId);

  db.transaction(["memos"], "readonly").objectStore("memos").get(id).onsuccess =
    async (e) => {
      const m = e.target.result;
      if (m) {
        // 🚀 [리턴 방어막 1] 방금 동기화로 지워진 노트라면 절대 화면에 띄우지 않고 컷!
        if (m.isDeleted || m.isPermanentlyDeleted) {
          isLoading = false;
          return;
        }
        currentMemoId = m.id;
        document.getElementById("memo-title-input").value = m.title;
        document.title = m.title;

        let finalContent = m.content || "";

        // 🎯 [보안 복호화] 본문이 암호화되어 있다면 해독 시도
        if (isEditingSecureMemo && finalContent.startsWith("ZENENC::")) {
          if (!currentSecKey) {
            showToast("보안 세션이 만료되었습니다. 폴더를 다시 열어주세요.");
            closeFileManager();

            // 🚀 [최종 교정] 보안 만료 시, 가장 최근에 봤던 일반 노트 또는 1등 노트를 엽니다!
            const lastId = localStorage.getItem('zen_last_opened');
            if (lastId && lastId !== id.toString()) { // 방금 열려다 실패한 보안 노트가 아닐 때만
              loadMemo(Number(lastId));
            } else if (typeof openTopDesktopMemo === 'function') {
              openTopDesktopMemo();
            } else {
              createNewMemo();
            }
            return;
          }
          try {
            finalContent = await decryptData(finalContent, currentSecKey);
          } catch (err) {
            showToast("복호화에 실패했습니다. 데이터가 손상되었습니다.");
            finalContent =
              '<p style="color:var(--danger);">[보안 오류] 데이터를 해독할 수 없습니다.</p>';
          }
        }

        quill.root.innerHTML = finalContent;

        // 🎯 [V4.2.2] 성공적으로 열람(및 복호화)된 노트를 최근 노트 목록(최대 10개)에 기록
        if (typeof recordRecentNote === "function") {
          recordRecentNote(m.id, m.parentId, m.title, isEditingSecureMemo);
        }
        if (typeof updateLeftMenuCurrentFolderPath === "function") {
          updateLeftMenuCurrentFolderPath();
        }

        if (typeof checkAuthState === 'function') checkAuthState();

        if (previousMemoId) purgeMemoIfEmpty(previousMemoId);

        loadMemoList(false); // 목록 하이라이트 변경용 (가볍게)
        if (typeof revealMemoInSidebarTree === "function") {
          revealMemoInSidebarTree(m.id);
        }

        // 🎯 [추가] 다른 노트를 열 때 이전 노트의 Ctrl+Z 수정 기록을 완벽히 지움
        setTimeout(() => quill.history.clear(), 10);
        setTimeout(() => {
          isLoading = false;
        }, 10);
      }
    };
  localStorage.setItem('zen_last_opened', id);
  closeAllPanelsMobile();
}

function deleteMemo(id, e) {
  e.stopPropagation();
  guardSecurityCrudAutoLock(1000);
  const targets =
    selectedMemos.has(id) && selectedMemos.size > 1
      ? Array.from(selectedMemos)
      : [id];

  if (
    !confirm(
      targets.length > 1
        ? `선택한 ${targets.length}개의 노트를 휴지통으로 보냅니다.`
        : "휴지통으로 보내시겠습니까?",
    )
  )
    return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  targets.forEach((targetId) => {
    store.get(targetId).onsuccess = (ev) => {
      const memo = ev.target.result;
      if (memo) {
        memo.isDeleted = true;
        memo.deletedAt = Date.now();
        memo.updatedAt = Date.now();
        store.put(memo);
      }
    };
  });

  tx.oncomplete = () => {
    isMultiSelectMode = false;
    targets.forEach((targetId) => selectedMemos.delete(targetId));

    if (targets.includes(currentMemoId)) {
      // 🚀 [수정] 방금 지운 노트가 현재 화면에 띄워져 있던 노트라면, 새 노트 대신 1등 노트를 엽니다!
      if (typeof openTopDesktopMemo === 'function') openTopDesktopMemo();
      loadMemoList(true);
    } else {
      loadMemoList(true);
    }
    updateUnsyncedCount();
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

function restoreMemo(id, e) {
  if (e) e.stopPropagation();
  const targets =
    selectedTrashMemos.has(id) && selectedTrashMemos.size > 1
      ? Array.from(selectedTrashMemos)
      : [id];
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  store.getAll().onsuccess = (allEv) => {
    const allData = allEv.target.result || [];
    const folderMap = new Map();
    const byId = new Map();
    allData.forEach((item) => {
      byId.set(item.id, item);
      if (item.type === "folder") folderMap.set(item.id, item);
    });

    function isParentAlive(parentId) {
      if (parentId === null || parentId === undefined) return true;
      let curr = parentId;
      const visited = new Set();
      while (curr !== null && curr !== undefined) {
        if (visited.has(curr)) return false;
        visited.add(curr);
        if (typeof globalTrashFolderId !== "undefined" && globalTrashFolderId !== null && curr === globalTrashFolderId) {
          return false;
        }
        const pf = folderMap.get(curr);
        if (!pf || pf.isDeleted || pf.isPermanentlyDeleted || pf.isSystem === "trash") {
          return false;
        }
        curr = pf.parentId;
      }
      return true;
    }

    targets.forEach((targetId) => {
      const memo = byId.get(targetId);
      if (!memo) return;
      memo.isDeleted = false;
      delete memo.deletedAt;
      if (!isParentAlive(memo.parentId) && typeof globalDesktopFolderId !== "undefined" && globalDesktopFolderId !== null) {
        memo.parentId = globalDesktopFolderId;
        memo.parentSyncId = "sys_desktop";
      }
      memo.updatedAt = Date.now();
      store.put(memo);
    });
  };

  tx.oncomplete = () => {
    isTrashMultiSelectMode = false;
    targets.forEach((targetId) => selectedTrashMemos.delete(targetId));

    loadTrashList();
    loadMemoList(true);
    updateUnsyncedCount();
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

function hardDeleteMemo(id, e) {
  e.stopPropagation();
  guardSecurityCrudAutoLock(1000);
  const targets =
    selectedTrashMemos.has(id) && selectedTrashMemos.size > 1
      ? Array.from(selectedTrashMemos)
      : [id];
  if (
    !confirm(
      targets.length > 1
        ? `선택한 ${targets.length}개의 노트를 삭제하시겠습니까?`
        : "이 노트를 삭제하시겠습니까?",
    )
  )
    return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos"); // 🎯 추가됨

  // 🎯 삭제(delete) 대신 영구삭제 꼬리표(isPermanentlyDeleted)를 달아둠
  targets.forEach((targetId) => {
    store.get(targetId).onsuccess = (ev) => {
      const memo = ev.target.result;
      if (memo) {
        memo.isPermanentlyDeleted = true;
        memo.updatedAt = Date.now();
        store.put(memo);

        // 🚀 [추가] 지우는 대상이 폴더라면 자식들도 함께 영구 삭제 처리!
        if (memo.type === 'folder') {
          markDescendantsPermanentlyDeleted(store, memo.id);
        }
      }
    };
  });

  tx.oncomplete = () => {
    targets.forEach((targetId) => selectedTrashMemos.delete(targetId));
    loadTrashList();
    loadMemoList(true);
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") loadFileManager(currentFmFolderId);
    updateUnsyncedCount();
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 🎯 [교정] 휴지통 비우기 (DB 직접 조회로 깡통 버그 완벽 해결)
function emptyTrash() {
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  store.getAll().onsuccess = (e) => {
    const allData = e.target.result;
    const trashItems = allData.filter(
      (m) => m.isDeleted && !m.isPermanentlyDeleted,
    );

    if (trashItems.length === 0) {
      showToast("휴지통이 이미 비어있습니다.");
      return;
    }

    if (!confirm("휴지통의 모든 메모를 삭제합니다. 계속하시겠습니까?")) return;

    trashItems.forEach((memo) => {
      memo.isPermanentlyDeleted = true;
      memo.updatedAt = Date.now();
      store.put(memo);

      if (memo.type === 'folder') {
        markDescendantsPermanentlyDeleted(store, memo.id);
      }
    });

    tx.oncomplete = () => {
      selectedTrashMemos.clear();
      loadTrashList();
      loadMemoList(true);
      updateUnsyncedCount();
      showToast("휴지통이 완전히 비워졌습니다.");
      const fmPane = document.getElementById("file-manager-pane");
      if (fmPane && fmPane.style.display === "flex") loadFileManager(currentFmFolderId);
      if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
    };
  };
}

// 🎯 [교정] 일괄 복구 처리 (부모 폴더 유실 시 임시 폴더 구출 + FM/사이드바/휴지통 동기화)
function fmBatchRestore() {
  if (fmSelectedItems.size === 0) {
    showToast("복구할 항목을 선택해주세요.");
    return;
  }

  const targetIds = Array.from(fmSelectedItems);
  const count = targetIds.length;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.getAll().onsuccess = (e) => {
    const allData = e.target.result || [];
    const byId = new Map();
    allData.forEach((entry) => byId.set(entry.id, entry));

    targetIds.forEach((id) => {
      const m = byId.get(id);
      if (!m) return;
      m.isDeleted = false;
      delete m.deletedAt;
      if (m.parentId !== null && m.parentId !== undefined) {
        const p = byId.get(m.parentId);
        if (!p || p.isDeleted || p.isPermanentlyDeleted) {
          if (m.type === "folder") {
            m.parentId = null;
            delete m.parentSyncId;
          } else if (typeof globalDesktopFolderId !== "undefined" && globalDesktopFolderId !== null) {
            m.parentId = globalDesktopFolderId;
            m.parentSyncId = "sys_desktop";
          }
        }
      }
      m.updatedAt = Date.now();
      store.put(m);
    });
  };
  tx.oncomplete = () => {
    cancelFmMultiSelect();
    const trashPane = document.getElementById("trash-pane");
    if (trashPane && trashPane.classList.contains("is-open")) loadTrashList();
    loadMemoList(true);
    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") loadFileManager(currentFmFolderId);
    updateUnsyncedCount();
    showToast(`${count}개 항목이 복구되었습니다.`);
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 🎯 [신규] 현재 폴더 복원 (부모 폴더로 바운스)
function restoreCurrentFolder() {
  if (!confirm("이 폴더를 복원하시겠습니까?")) return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  // 폴더 껍데기만 복원하면, 그 안에 있는 자식들은 족보가 회복되어 자동으로 모두 복원됩니다!
  store.get(currentFmFolderId).onsuccess = (e) => {
    const m = e.target.result;
    if (m) {
      m.isDeleted = false;
      delete m.deletedAt;
      m.updatedAt = Date.now();
      store.put(m);
    }
  };

  tx.oncomplete = () => {
    showToast("폴더가 복원되었습니다.");
    document.getElementById("fm-global-menu").classList.remove("is-active");
    updateUnsyncedCount();
    history.back(); // 🎯 작업 완료 후 안전하게 부모 폴더로 되돌아갑니다.
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}

// 🎯 [신규] 현재 폴더 비우기 (영구 삭제 및 부모 폴더로 바운스)
function emptyCurrentFolder() {
  guardSecurityCrudAutoLock(1000);
  if (
    !confirm(
      "이 폴더를 비우시겠습니까? 폴더와 내부의 모든 항목이 영구 삭제됩니다.",
    )
  )
    return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  store.getAll().onsuccess = (e) => {
    const allData = e.target.result;
    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });

    function isDescendant(parentId) {
      let curr = parentId;
      while (curr) {
        if (curr === currentFmFolderId) return true;
        const pf = folderMap.get(curr);
        if (!pf) break;
        curr = pf.parentId;
      }
      return false;
    }

    // 1. 해당 폴더 영구 삭제
    const f = allData.find((m) => m.id === currentFmFolderId);
    if (f) {
      f.isPermanentlyDeleted = true;
      f.updatedAt = Date.now();
      store.put(f);
    }

    // 2. 내부 모든 자손 항목들 일괄 영구 삭제 (DB 찌꺼기 방지)
    allData.forEach((m) => {
      if (isDescendant(m.parentId) && !m.isPermanentlyDeleted) {
        m.isPermanentlyDeleted = true;
        m.updatedAt = Date.now();
        store.put(m);
      }
    });
  };

  tx.oncomplete = () => {
    showToast("폴더가 완전히 삭제되었습니다.");
    document.getElementById("fm-global-menu").classList.remove("is-active");
    updateUnsyncedCount();
    history.back(); // 🎯 작업 완료 후 안전하게 부모 폴더로 되돌아갑니다.
    if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
  };
}
