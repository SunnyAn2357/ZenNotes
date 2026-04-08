let fmSearchTimer = null;
function triggerFmSearch() {
  if (fmSearchTimer) clearTimeout(fmSearchTimer);
  fmSearchTimer = setTimeout(() => loadFileManager(currentFmFolderId), 300);
}

// 🎯 [신규] 스크롤 감지 시 다중 선택 하단 바 숨기기 / 멈추면 보이기
let fmScrollTimer = null;
document.querySelector(".fm-body").addEventListener("scroll", () => {
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

// 🎯 [No.006] 파일 관리창 전역 변수 및 렌더링 함수
let currentFmFolderId = null;
let isCurrentInTrash = false; // 👈 휴지통 내부(루트 및 하위) 감지 센서
let fmPath = [{ id: null, title: "Home" }]; // 빵부스러기 경로 저장용 배열

function loadFileManager(folderId = null) {
  currentFmFolderId = folderId;
  const list = document.getElementById("fm-list");

  // 1. 경로(Breadcrumb) 업데이트 로직
  const crumbIndex = fmPath.findIndex((p) => p.id === folderId);
  if (crumbIndex !== -1) {
    fmPath = fmPath.slice(0, crumbIndex + 1);
  }
  renderFmBreadcrumbs();

  // 2. DB에서 현재 폴더에 속한 아이템 불러오기
  const tx = db.transaction(["memos"], "readonly");
  const store = tx.objectStore("memos");

  store.getAll().onsuccess = (e) => {
    list.innerHTML = ""; // 🎯 해결: DB 데이터를 모두 가져오고, 화면에 그리기 직전에 싹 비웁니다!

    const allData = e.target.result;
    const query = document
      .getElementById("fm-search-input")
      .value.toLowerCase();

    // 폴더 가계도(족보) 추적용 맵 생성
    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });

    function getTopSystem(parentId) {
      let curr = parentId;
      while (curr) {
        const folder = folderMap.get(curr);
        if (!folder) return null;
        if (folder.isSystem) return folder.isSystem;
        curr = folder.parentId;
      }
      return null;
    }

    // 🎯 [최종 강화] 현재 폴더가 휴지통 구역인지 무한 추적 (깊이 제한 없음)
    function checkDeepInTrash(folderId) {
      if (!folderId) return false;
      if (folderId === globalTrashFolderId) return true;

      let currId = folderId;
      while (currId) {
        if (currId === globalTrashFolderId) return true; // 휴지통 루트 발견

        const folder = folderMap.get(currId);
        if (!folder) break;

        // 조상 중 하나라도 '삭제됨' 상태거나 시스템 휴지통이면 휴지통 구역으로 확정
        if (folder.isDeleted === true || folder.isSystem === "trash")
          return true;

        currId = folder.parentId; // 한 단계 더 위 조상으로 이동
      }
      return false;
    }

    isCurrentInTrash = checkDeepInTrash(currentFmFolderId);

    let items = [];

    // 🎯 [추가] 특정 폴더의 하위(자식, 손자 등) 폴더 소속인지 끝까지 추적하는 함수
    function isDescendantOf(itemParentId, targetFolderId) {
      let curr = itemParentId;
      while (curr) {
        if (curr === targetFolderId) return true;
        const parentFolder = folderMap.get(curr);
        if (!parentFolder) break;
        curr = parentFolder.parentId;
      }
      return false;
    }

    if (query) {
      // 🎯 스마트 검색 스코프(범위) 분기 처리
      if (currentFmFolderId === null) {
        // ① Home: 휴지통, 보안폴더 제외 전역 검색
        items = allData.filter(
          (m) =>
            !m.isDeleted &&
            !m.isPermanentlyDeleted &&
            m.isSystem !== "security" &&
            getTopSystem(m.parentId) !== "security" &&
            m.isSystem !== "trash" &&
            getTopSystem(m.parentId) !== "trash" &&
            m.title.toLowerCase().includes(query),
        );
      } else if (currentFmFolderId === globalTrashFolderId) {
        // ② 휴지통 내부: 지워진 항목 중에서만 검색
        items = allData.filter(
          (m) =>
            m.isDeleted &&
            !m.isPermanentlyDeleted &&
            m.title.toLowerCase().includes(query),
        );
      } else {
        // ③ 특정 폴더 내부: 현재 폴더 및 "그 아래에 있는 모든 하위 폴더" 내용물까지 싹 다 검색
        items = allData.filter(
          (m) =>
            isDescendantOf(m.parentId, currentFmFolderId) &&
            !m.isDeleted &&
            !m.isPermanentlyDeleted &&
            m.title.toLowerCase().includes(query),
        );
      }
    } else if (currentFmFolderId === globalTrashFolderId) {
      items = allData.filter((m) => m.isDeleted && !m.isPermanentlyDeleted);
    } else {
      items = allData.filter(
        (m) =>
          m.parentId === currentFmFolderId &&
          !m.isDeleted &&
          !m.isPermanentlyDeleted,
      );
    }

    items.sort((a, b) => {
      if (currentFmFolderId === null && !query) {
        const order = { desktop: 1, security: 2, trash: 3, backup: 4 };
        const aOrder = order[a.isSystem] || 99;
        const bOrder = order[b.isSystem] || 99;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      return b.updatedAt - a.updatedAt;
    });

    items.forEach((m) => {
      const li = document.createElement("li");

      // 🎯 선택 모드일 때 선택된 항목이면 CSS 클래스(파란색 배경) 추가
      const isSelected = isFmMultiSelectMode && fmSelectedItems.has(m.id);
      li.className = `fm-item ${isSelected ? "active fm-selected" : ""}`;

      // 🎯 2. 소속(족보)에 따른 색상 동기화 (4대장 무한 추적 엔진)
      function getEffectiveSystemType(item) {
        if (item.isDeleted) return "trash"; // 본인이 삭제됐으면 휴지통
        if (item.isSystem) return item.isSystem; // 본인이 4대장이면 그 색깔

        let curr = item.parentId;
        while (curr) {
          if (curr === globalTrashFolderId) return "trash";
          const parentFolder = folderMap.get(curr);
          if (!parentFolder) break;

          // 조상 중 하나라도 삭제되었거나 휴지통 소속이면 무조건 휴지통 색상!
          if (parentFolder.isDeleted || parentFolder.isSystem === "trash")
            return "trash";
          // 다른 4대장 조상을 만나면 그 색상!
          if (parentFolder.isSystem) return parentFolder.isSystem;

          curr = parentFolder.parentId;
        }
        return "normal"; // 4대장이 아닌 일반 폴더 소속이면 기본값
      }

      const effectiveSys = getEffectiveSystemType(m);
      let iconColorStyle = "color: var(--text-muted);"; // 일반 폴더/파일은 틔미한 회색 유지

      if (effectiveSys === "trash") {
        iconColorStyle = "color: var(--danger);";
      } else if (effectiveSys === "security") {
        iconColorStyle = "color: #f59e0b;";
      } else if (effectiveSys === "desktop") {
        iconColorStyle = "color: var(--accent);";
      } else if (effectiveSys === "backup") {
        iconColorStyle = "color: #8ba888;";
      }

      // 🎯 3. 아이콘 모양 (모양은 그대로 유지)
      let iconClass = "fa-regular fa-file-lines";
      if (m.type === "folder") {
        iconClass = "fa-solid fa-folder";
        if (m.isSystem === "desktop") iconClass = "fa-solid fa-desktop";
        if (m.isSystem === "security") iconClass = "fa-solid fa-lock";
        if (m.isSystem === "trash") iconClass = "fa-solid fa-trash-can";
        if (m.isSystem === "backup") iconClass = "fa-solid fa-box-archive";
      }

      // 🎯 폴더도 날짜를 표시하여 레이아웃 붕괴 방지 및 시각적 구분선 역할 수행
      const dateHtml = formatDateTime(m.updatedAt);

      // 🎯 3대장도 뼈대 통일을 위해 삼점 버튼을 부여함
      const isTrashMode = isCurrentInTrash || m.isDeleted; // 👈 센서 적용
      const sysType = m.isSystem || ""; // 시스템 폴더 종류 전달
      let moreBtnHtml = `
                        <div class="memo-actions-wrap">
                            <i class="fa-solid fa-ellipsis-vertical fm-item-more" onclick="openFmItemMenu(event, ${m.id}, '${m.type}', ${isTrashMode}, '${sysType}')"></i>
                        </div>`;

      li.innerHTML = `
                        <div class="fm-item-info">
                            <i class="${iconClass} fm-item-icon" style="${iconColorStyle}"></i>
                            <span class="fm-item-title">${m.title}</span>
                        </div>
                        <div class="fm-item-date">${dateHtml}</div>
                        ${moreBtnHtml}
                    `;

      // 🎯 [신규] 롱프레스 이벤트 센서 달기
      li.addEventListener("mousedown", (e) => startFmPress(e, m));
      li.addEventListener("touchstart", (e) => startFmPress(e, m), {
        passive: true,
      });
      li.addEventListener("mouseup", cancelPress);
      li.addEventListener("mouseleave", cancelPress);
      li.addEventListener("touchend", cancelPress);
      li.addEventListener("touchmove", cancelPress, { passive: true });

      li.onclick = (e) => {
        if (e.target.closest(".memo-actions-wrap")) return;

        // 🎯 꾹 눌러서 다중 선택이 켜진 직후에 딸려오는 단순 '클릭(onclick)' 무시
        if (isPressTriggered) {
          isPressTriggered = false;
          return;
        }

        // 🎯 다중 선택 모드일 때 클릭하면 (파일 여는 대신) 선택 체크/해제
        if (isFmMultiSelectMode) {
          if (
            m.isSystem === "desktop" ||
            m.isSystem === "security" ||
            m.isSystem === "trash" ||
            m.isSystem === "backup"
          ) {
            showToast("시스템 폴더는 선택할 수 없습니다.");
            return;
          }

          if (fmSelectedItems.has(m.id)) fmSelectedItems.delete(m.id);
          else fmSelectedItems.add(m.id);

          updateFmBottomBar();
          loadFileManager(currentFmFolderId); // 🎯 다시 그려서 파란 줄 입히기
          return;
        }

        if (m.type === "folder") {
          if (m.isSystem === "security") {
            if (isSecurityUnlocked) {
              enterSecurityFolder(); // 이미 풀려있으면 바로 진입
            } else {
              const hasPw = localStorage.getItem("zen_sec_hash");
              openSecurityModal(hasPw ? "enter" : "setup"); // 비밀번호 유무에 따라 팝업 분기
            }
            return;
          }
          // 🎯 폴더 진입 시 히스토리 기록
          fmPath.push({ id: m.id, title: m.title });
          history.pushState(
            { fmOpen: true, fmFolderId: m.id, fmPath: fmPath },
            "",
          );
          loadFileManager(m.id);
        } else {
          // 🎯 삭제된 노트거나, 휴지통 내부 어디든 있으면 아예 열리지 않도록 차단
          if (m.isDeleted || isCurrentInTrash) return; // 👈 센서 적용

          closeFileManager();
          loadMemo(m.id);
        }
      };

      list.appendChild(li);
    });
  };
}

// 🎯 [신규] 텔레포트(타임머신) 작동 전 UI 찌꺼기 강제 청소
function forceCleanFmUI() {
  isFmMultiSelectMode = false;
  fmSelectedItems.clear();
  updateFmBottomBar();

  const globalMenu = document.getElementById("fm-global-menu");
  const itemMenu = document.getElementById("fm-item-menu");
  const moveModal = document.getElementById("fm-move-modal");
  const securityModal = document.getElementById("fm-security-modal");

  if (globalMenu) globalMenu.classList.remove("is-active");
  if (itemMenu) itemMenu.classList.remove("is-active");
  if (moveModal) moveModal.style.display = "none";
  if (securityModal) securityModal.style.display = "none";
  movingItemIds = [];
}

// 경로(Breadcrumb)를 HTML로 그려주는 함수
function renderFmBreadcrumbs() {
  const container = document.getElementById("fm-breadcrumbs");
  container.innerHTML = "";
  fmPath.forEach((p, index) => {
    const isLast = index === fmPath.length - 1;
    const span = document.createElement("span");
    span.className = `fm-crumb ${isLast ? "active" : ""}`;
    span.innerHTML =
      p.id === null
        ? `<i class="fa-solid fa-house" style="margin-right:6px;"></i>${p.title}`
        : p.title;

    span.onclick = () => {
      if (isLast) return; // 🎯 클릭한 곳이 현재 위치면 헛도는 것 방지

      const si = document.getElementById("fm-search-input");
      if (si && si.value !== "") si.value = "";

      // 🎯 popstate가 엉뚱한 걸 가로채지 못하게 UI부터 즉시 멸균 청소
      forceCleanFmUI();

      // 🎯 타임머신 작동 (목표 층수 - 현재 층수 = 음수값)
      const steps = index + 1 - fmPath.length;
      history.go(steps); // 브라우저 스택을 단번에 롤백! (popstate가 자동 실행되며 화면을 그려줌)
    };

    container.appendChild(span);

    if (!isLast) {
      const sep = document.createElement("i");
      sep.className = "fa-solid fa-chevron-right fm-crumb-sep";
      container.appendChild(sep);
    }
  });
}

// 🎯 [완벽 교정] 위치에 따라 이름과 기능이 바뀌는 지능형 글로벌 메뉴
function toggleFmGlobalMenu(e) {
  e.stopPropagation();
  cancelFmMultiSelect();
  const menu = document.getElementById("fm-global-menu");
  let html = "";

  // 🚨 [핵심 교정] 현재 위치가 '바탕 화면' 족보인지 빵부스러기(fmPath)로 정확히 검사합니다!
  // fmPath[0]은 항상 Home이므로, fmPath[1]이 바탕화면 ID라면 그 하위 폴더임이 증명됩니다.
  const isDesktopRoot = currentFmFolderId === globalDesktopFolderId;
  const isUnderDesktop =
    fmPath.length > 1 && fmPath[1].id === globalDesktopFolderId;

  if (currentFmFolderId === globalTrashFolderId) {
    html = `
                    <div class="fm-dropdown-item" onclick="emptyTrash()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> 비우기</div>
                    <div class="fm-dropdown-item" onclick="startFmMultiSelect()"><i class="fa-solid fa-check-double"></i> 다중 선택</div>
                `;
  } else if (isCurrentInTrash) {
    html = `
                    <div class="fm-dropdown-item" onclick="openMoveModal(currentFmFolderId)"><i class="fa-solid fa-arrows-up-down-left-right"></i> 폴더 이동하기</div>
                    <div class="fm-dropdown-item" onclick="emptyCurrentFolder()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> 폴더 비우기</div>
                    <div class="fm-dropdown-item" onclick="startFmMultiSelect()"><i class="fa-solid fa-check-double"></i> 다중 선택</div>
                `;
  } else if (currentFmFolderId === null) {
    // 🏠 파일관리창 진짜 Home(0층)
    html = `
                    <div class="fm-dropdown-item" onclick="createNewFolder()"><i class="fa-solid fa-folder-plus"></i> 새 폴더</div>
                    <div class="fm-dropdown-item" onclick="startFmMultiSelect()"><i class="fa-solid fa-check-double"></i> 다중 선택</div>
                `;
  } else {
    // 📁 4대장 루트 또는 일반 폴더 내부
    const isSystemTop =
      currentFmFolderId === globalDesktopFolderId ||
      currentFmFolderId === globalSecurityFolderId ||
      currentFmFolderId === globalBackupFolderId;

    // 🎯 오직 '바탕 화면' 루트에 있을 때만 노출!
    if (isDesktopRoot) {
      html += `<div class="fm-dropdown-item" onclick="backupDesktop()"><i class="fa-solid fa-box-archive" style="color: #8ba888;"></i> 쓸어 담기로</div>`;
    }
    // 그 외 4대장이 아닌 일반 하위 폴더일 때
    else if (!isSystemTop) {
      html += `<div class="fm-dropdown-item" onclick="openMoveModal(${currentFmFolderId})"><i class="fa-solid fa-arrows-up-down-left-right"></i> 폴더 이동하기</div>`;

      // 🎯 오직 조상 폴더가 '바탕 화면'일 때만 "이 폴더를 쓸어 담기" 노출!
      if (isUnderDesktop) {
        html += `<div class="fm-dropdown-item" onclick="backupThisFolder()"><i class="fa-solid fa-box-archive" style="color: #8ba888;"></i> 쓸어 담기로</div>`;
      }
    }

    html += `
                    <div class="fm-dropdown-item" onclick="createNewMemoInFolder(${currentFmFolderId})"><i class="fa-solid fa-pen-to-square"></i> 새 노트</div>
                    <div class="fm-dropdown-item" onclick="createNewFolder()"><i class="fa-solid fa-folder-plus"></i> 새 폴더</div>
                    <div class="fm-dropdown-item" onclick="startFmMultiSelect()"><i class="fa-solid fa-check-double"></i> 다중 선택</div>
                `;
  }

  menu.innerHTML = html;
  menu.style.top = `${e.clientY + 10}px`;
  menu.style.left = `${e.clientX - 120}px`;
  menu.classList.toggle("is-active");
  document.getElementById("fm-item-menu").classList.remove("is-active");
}

// 🎯 특정 폴더에 새 노트 작성 후 즉시 열기
function createNewMemoInFolder(folderId) {
  closeFileManager();
  createNewMemo(folderId); // 타겟 폴더 ID를 넘겨줍니다.
  document.getElementById("fm-global-menu").classList.remove("is-active");
}

// 🎯 파라미터에 sysType 추가 및 3대장 메뉴 분기
function openFmItemMenu(e, id, type, isTrashMode, sysType) {
  e.stopPropagation();
  document.getElementById("fm-global-menu").classList.remove("is-active");

  const menu = document.getElementById("fm-item-menu");
  let html = "";

  // 🎯 기획하신 4대장 전용 메뉴 세팅!
  if (sysType === "desktop") {
    html = `
                    <div class="fm-dropdown-item" onclick="backupDesktop()"><i class="fa-solid fa-box-archive"></i> 쓸어 담기로</div>
                `;
  } else if (sysType === "backup") {
    html = `<div class="fm-dropdown-item" onclick="alert('\\n바탕 화면의 모든 항목을 정리하기 전, \\n한꺼번에 쓸어 담는 임시 창고입니다. \\n\\n바탕 화면의 삼점을 눌러서 \\n쓸어 담기로 이동해 보세요.')"><i class="fa-solid fa-circle-info"></i> 쓸어 담기 정보</div>`;
  } else if (sysType === "security") {
    html = `
                    <div class="fm-dropdown-item" onclick="handleSecurityMenuChange()"><i class="fa-solid fa-key"></i> 비번 변경</div>
                    <div class="fm-dropdown-item" onclick="emergencyDeleteSecurity()"><i class="fa-solid fa-skull" style="color: var(--danger);"></i> 비상 삭제</div>
                `;
  } else if (sysType === "trash") {
    html = `<div class="fm-dropdown-item" onclick="emptyTrash()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> 비우기</div>`;
  } else if (isTrashMode) {
    html = `
                    <div class="fm-dropdown-item" onclick="openMoveModal(${id})"><i class="fa-solid fa-arrows-up-down-left-right"></i> 이동하기</div>
                    <div class="fm-dropdown-item" onclick="fmHardDelete(${id})"><i class="fa-solid fa-xmark" style="color: var(--danger);"></i> 영구 삭제</div>
                `;
  } else {
    html = `
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

// 1. 새 폴더 생성
function createNewFolder() {
  const name = prompt("새 폴더 이름을 입력하세요:", "새 폴더");
  if (!name || name.trim() === "") return;

  // 🎯 바탕화면 강제 배정 삭제! 현재 위치(Home이면 null)에 그대로 생성됨
  const parent = currentFmFolderId;
  const tx = db.transaction(["memos"], "readwrite");
  tx.objectStore("memos").add({
    title: name.trim(),
    type: "folder",
    parentId: parent,
    updatedAt: Date.now(),
    isDeleted: false,
  });
  // 🎯 확실히 DB 저장이 끝난 뒤(oncomplete) 화면 새로고침
  tx.oncomplete = () => loadFileManager(currentFmFolderId);
}

// 2. 이름 바꾸기
function fmRename(id) {
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m) return;
    const newName = prompt("새 이름을 입력하세요:", m.title);
    if (!newName || newName.trim() === "" || newName === m.title) return;

    m.title = newName.trim();
    m.updatedAt = Date.now();
    store.put(m);
  };
  tx.oncomplete = () => {
    loadFileManager(currentFmFolderId);
    loadMemoList(true);
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
  };
}

// 4. 휴지통으로 이동
function fmDelete(id) {
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m) return;
    m.isDeleted = true;
    m.deletedAt = Date.now();
    m.updatedAt = Date.now();
    store.put(m);
  };
  tx.oncomplete = () => {
    loadFileManager(currentFmFolderId);
    loadMemoList(true);
    updateUnsyncedCount();
    // 🎯 삭제 완료 후 토스트에 복구용 기억(payload) 전달
    showToast("휴지통으로 이동되었습니다.", [{ id: id, action: "restore" }]);
  };
}

// 5. 복구하기
function fmRestore(id) {
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  store.get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m) return;
    m.isDeleted = false;
    delete m.deletedAt;
    m.updatedAt = Date.now();
    store.put(m);
  };
  tx.oncomplete = () => {
    loadFileManager(currentFmFolderId);
    loadMemoList(true);
    updateUnsyncedCount();
  };
}

// 6. 영구 삭제
function fmHardDelete(id) {
  if (!confirm("이 항목을 삭제하시겠습니까?")) return;
  const tx = db.transaction(["memos"], "readwrite");
  tx.objectStore("memos").get(id).onsuccess = (e) => {
    const m = e.target.result;
    if (!m) return;
    m.isPermanentlyDeleted = true;
    m.updatedAt = Date.now();
    tx.objectStore("memos").put(m);
  };
  tx.oncomplete = () => {
    loadFileManager(currentFmFolderId);
    updateUnsyncedCount();
  };
}

// 🎯 [No.016] 다중 선택 및 이동/삭제 통합 로직
let movingItemIds = []; // 단일/다중 이동을 모두 담는 배열로 업그레이드!
let selectedDestId = null;

let isFmMultiSelectMode = false;

// 🎯 [No.020] 보안 폴더 전용 변수 및 해시 엔진
let securityMode = "enter"; // 'setup', 'enter', 'change'
let tempSecPassword = ""; // 👈 [신규] 2번 입력할 때 처음 입력한 비번을 기억할 변수

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
  if (document.getElementById("fm-security-modal").style.display === "none")
    return;
  document.getElementById("fm-security-modal").style.display = "none";

  // 모달이 닫힐 때 유령 방어막 청소
  if (!fromPopstate) {
    programmaticBackCount++; // 스위치 켜기 대신 숫자를 1 올림
    history.back();
  }
}

// 🎯 비밀번호 제출 및 마스터키/2중 검증 로직
async function submitSecurityPassword() {
  const input = document.getElementById("sec-password-input");
  const desc = document.getElementById("sec-modal-desc");
  const btn = document.getElementById("sec-confirm-btn");
  const pw = input.value.trim();

  if (!pw) {
    showToast("비밀번호를 입력하세요.");
    return;
  }

  const savedHash = localStorage.getItem("zen_sec_hash");
  const step = input.dataset.step;

  // ----------------------------------------------------
  // 1. 잠금 해제 (Enter) & 마스터키 로직
  // ----------------------------------------------------
  if (securityMode === "enter") {
    // 🚨 마스터키 감지 (최우선 실행)
    if (pw === "abcde12345") {
      showToast("마스터키가 확인되었습니다. 새 비밀번호를 설정해주세요.");
      openSecurityModal("setup"); // 새 비번 설정 창으로 즉시 전환
      return;
    }

    const hash = await hashPassword(pw);
    if (hash === savedHash) {
      isSecurityUnlocked = true;
      currentSecKey = await getCryptoKey(pw); // 🚀 [핵심] 암호화 열쇠 획득!
      document.getElementById("fm-security-modal").style.display = "none";
      enterSecurityFolder(); // 이 안에서 replaceState가 작동!
    } else {
      showToast("비밀번호가 일치하지 않습니다.");
      input.value = "";
      input.focus();
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
      desc.innerHTML = "<b>1번 더 입력하세요.</b>"; // UI 문구 변경
      btn.innerText = "설정 완료";
      input.focus();
    } else if (step === "2") {
      if (pw === tempSecPassword) {
        const hash = await hashPassword(pw);
        localStorage.setItem("zen_sec_hash", hash);
        showToast("비밀번호가 안전하게 설정되었습니다.");

        isSecurityUnlocked = true;
        currentSecKey = await getCryptoKey(pw); // 🚀 [핵심] 암호화 열쇠 획득!
        document.getElementById("fm-security-modal").style.display = "none";
        enterSecurityFolder();
      } else {
        showToast("비밀번호가 일치하지 않습니다. 처음부터 다시 입력해주세요.");
        openSecurityModal("setup"); // 1단계로 강제 초기화
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
        input.focus();
      } else {
        showToast("현재 비밀번호가 틀렸습니다.");
        input.value = "";
        input.focus();
      }
    } else if (step === "2") {
      tempSecPassword = pw; // 새 비번 1차 입력값 기억
      input.dataset.step = "3";
      input.value = "";
      desc.innerHTML = "<b>1번 더 입력하세요.</b>"; // UI 문구 변경
      btn.innerText = "변경 완료";
      input.focus();
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
        input.focus();
      }
    }
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
      // 보안폴더 직속이거나 하위 자손이면 가차 없이 DB에서 완전 삭제!
      if (
        m.parentId === globalSecurityFolderId ||
        isDescendantOfSec(m.parentId)
      ) {
        store.delete(m.id);
      }
    });
  };

  tx.oncomplete = () => {
    localStorage.removeItem("zen_sec_hash"); // 비번 초기화
    isSecurityUnlocked = false; // 잠금 상태 초기화
    currentSecKey = null; // 🚀 열쇠 분쇄
    showToast("보안 폴더 데이터가 삭제되고 비밀 번호가 초기화되었습니다.");
    resetFmToHome(); // 무조건 안전한 홈으로 쫓아냄
  };
}

let fmSelectedItems = new Set();
// 🎯 [완벽 교정] 여러 겹의 방어막을 동시에 해제할 수 있도록 카운터로 업그레이드!
let programmaticBackCount = 0;

// 🎯 [신규] 파일 관리창 전용 롱프레스(길게 누르기) 다중 선택 진입
function startFmPress(e, m) {
  if (e.target.closest(".memo-actions-wrap")) return; // 메뉴 터치 시 무시
  if (e.type === "touchstart" && e.touches.length > 1) return; // 멀티터치 무시

  isPressTriggered = false;

  // 🎯 4대장(시스템 폴더)은 롱프레스 다중 선택에서 제외
  if (
    m.isSystem === "desktop" ||
    m.isSystem === "security" ||
    m.isSystem === "trash" ||
    m.isSystem === "backup"
  )
    return;

  pressTimer = setTimeout(() => {
    isPressTriggered = true;
    if (navigator.vibrate) navigator.vibrate(50); // 햅틱 피드백

    if (!isFmMultiSelectMode) {
      fmSelectedItems.clear();
      isFmMultiSelectMode = true;
      history.pushState({ mode: "multi" }, ""); // 👈 3. 파일관리창 방어막 추가!
    }

    fmSelectedItems.add(m.id); // 꾹 누른 녀석을 첫 번째로 선택
    document.getElementById("fm-global-menu").classList.remove("is-active");

    updateFmBottomBar();
    loadFileManager(currentFmFolderId); // 체크박스 렌더링
  }, 500); // 0.5초 꾹 누르면 발동
}

// 🎯 위치에 따라 하단 바 버튼 세팅을 다르게 렌더링
function updateFmBottomBar() {
  const bar = document.getElementById("fm-bottom-bar");
  const countLabel = document.getElementById("fm-selected-count");
  const btnGroup = document.getElementById("fm-bottom-btn-group");
  const fmBody = document.querySelector(".fm-body"); // 🎯 목록 영역 선택

  if (isFmMultiSelectMode) {
    bar.classList.add("is-visible");
    if (fmBody) fmBody.classList.add("has-bottom-bar"); // 🎯 목록 여백 추가

    countLabel.innerText = `${fmSelectedItems.size}개 선택됨`;

    // 🎯 휴지통 루트이거나 그 하위 폴더일 때 (휴지통 모드)
    if (currentFmFolderId === globalTrashFolderId || isCurrentInTrash) {
      btnGroup.innerHTML = `
                        <button class="fm-bottom-btn" onclick="fmBatchRestore()"><i class="fa-solid fa-rotate-left" style="color: var(--accent);"></i> <span style="color: var(--accent);">복구</span></button>
                        <button class="fm-bottom-btn" onclick="fmBatchDelete()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> <span style="color: var(--danger);">영구 삭제</span></button>
                    `;
    } else {
      // 🎯 일반 바탕화면 폴더일 때
      btnGroup.innerHTML = `
                        <button class="fm-bottom-btn" onclick="openFmBatchMoveModal()"><i class="fa-solid fa-arrows-up-down-left-right" style="color: var(--accent);"></i> <span style="color: var(--accent);">이동</span></button>
                        <button class="fm-bottom-btn" onclick="fmBatchDelete()"><i class="fa-solid fa-trash-can" style="color: var(--danger);"></i> <span style="color: var(--danger);">휴지통으로</span></button>
                    `;
    }
  } else {
    bar.classList.remove("is-visible");
    // 🎯 [고스트 해결] 스크롤 숨김 클래스까지 싹 지워야 딸려 올라오지 않습니다.
    bar.classList.remove("is-hidden-by-scroll");

    if (fmBody) fmBody.classList.remove("has-bottom-bar"); // 🎯 목록 여백 제거
  }
}

// 🎯 [완벽 교정] 위치에 따른 다중 선택 삭제 분기 로직
function fmBatchHardDelete() {
  if (fmSelectedItems.size === 0) {
    showToast("삭제할 항목을 선택해주세요.");
    return;
  }

  // 현재 위치가 휴지통인지 확인 (루트이거나 내부 하위 폴더이거나)
  const isInsideTrash =
    currentFmFolderId === globalTrashFolderId || isCurrentInTrash;
  const confirmMsg = isInsideTrash
    ? `선택한 ${fmSelectedItems.size}개 항목을 영구 삭제(복구 불가) 하시겠습니까?`
    : `선택한 ${fmSelectedItems.size}개 항목을 휴지통으로 보낼까요?`;

  if (!confirm(confirmMsg)) return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  const undoPayload = [];

  fmSelectedItems.forEach((id) => {
    store.get(id).onsuccess = (e) => {
      const m = e.target.result;
      // 시스템 폴더(4대장)는 절대 지워지지 않도록 방어막 유지
      if (
        m &&
        m.isSystem !== "desktop" &&
        m.isSystem !== "security" &&
        m.isSystem !== "trash" &&
        m.isSystem !== "backup"
      ) {
        if (isInsideTrash) {
          // 1. 휴지통 안에서 삭제 시 -> 영구 삭제 꼬리표 (툼스톤)
          m.isPermanentlyDeleted = true;
        } else {
          // 2. 휴지통 밖에서 삭제 시 -> 휴지통 이동 (1단계)
          m.isDeleted = true;
          m.deletedAt = Date.now();
          undoPayload.push({ id: m.id, action: "restore" }); // 바탕화면 삭제일 때만 '실행 취소' 기능 활성화
        }
        m.updatedAt = Date.now();
        store.put(m);
      }
    };
  });

  tx.oncomplete = () => {
    const count = fmSelectedItems.size;
    cancelFmMultiSelect();
    loadMemoList(true); // 좌측 메인 목록 동기화
    updateUnsyncedCount();

    if (isInsideTrash) {
      showToast(`${count}개 항목이 영구 삭제 되었습니다.`);
    } else {
      showToast(`${count}개 항목이 휴지통으로 이동되었습니다.`, undoPayload);
    }
    loadFileManager(currentFmFolderId); // 파일 관리창 렌더링 갱신
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
  updateFmBottomBar();
  loadFileManager(currentFmFolderId);
}

// 🎯 [완벽 교정]
function cancelFmMultiSelect(fromPopstate = false) {
  if (!isFmMultiSelectMode) return;
  isFmMultiSelectMode = false;
  fmSelectedItems.clear();

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
  selectedDestId = null;

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
  selectedDestId = null;
  history.pushState({ mode: "modal" }, ""); // 👈 추가: 다중선택 위에 모달이 뜨므로 방어막 1장 추가!
  document.getElementById("fm-move-modal").style.display = "flex";
  renderDestFolders();
}

// 🎯 [완벽 교정] 위치에 따른 다중 선택 삭제 분기 로직
function fmBatchDelete() {
  if (fmSelectedItems.size === 0) {
    showToast("삭제할 항목을 선택해주세요.");
    return;
  }

  // 현재 위치가 휴지통인지 확인
  const isInsideTrash =
    currentFmFolderId === globalTrashFolderId || isCurrentInTrash;
  const confirmMsg = isInsideTrash
    ? `선택한 ${fmSelectedItems.size}개 항목을 영구 삭제하시겠습니까?`
    : `선택한 ${fmSelectedItems.size}개 항목을 휴지통으로 보낼까요?`;

  if (!confirm(confirmMsg)) return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  const undoPayload = [];

  fmSelectedItems.forEach((id) => {
    store.get(id).onsuccess = (e) => {
      const m = e.target.result;
      if (
        m &&
        m.isSystem !== "desktop" &&
        m.isSystem !== "security" &&
        m.isSystem !== "trash"
      ) {
        if (isInsideTrash) {
          // 1. 휴지통 안에서 삭제 시 -> 영구 삭제 꼬리표 (툼스톤)
          m.isPermanentlyDeleted = true;
        } else {
          // 2. 휴지통 밖에서 삭제 시 -> 휴지통 이동 (1단계)
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
    const count = fmSelectedItems.size;
    cancelFmMultiSelect();
    loadMemoList(true);
    updateUnsyncedCount();

    if (isInsideTrash) {
      showToast(`${count}개 항목이 영구 삭제(숨김) 되었습니다.`);
      loadFileManager(currentFmFolderId);
    } else {
      showToast(`${count}개 항목이 휴지통으로 이동되었습니다.`, undoPayload);
      loadFileManager(currentFmFolderId);
    }
  };
}

// 🎯 [완벽 교정]
function closeMoveModal(fromPopstate = false) {
  if (document.getElementById("fm-move-modal").style.display === "none") return;
  document.getElementById("fm-move-modal").style.display = "none";
  movingItemIds = [];

  // 모달이 닫힐 때 유령 방어막 청소
  if (!fromPopstate) {
    programmaticBackCount++; // 숫자를 1 올림
    history.back();
  }
}

function renderDestFolders() {
  const container = document.getElementById("fm-dest-list");
  container.innerHTML =
    '<div style="padding:10px; font-size:12px; color:var(--text-muted);">이동할 위치를 선택하세요:</div>';

  const tx = db.transaction(["memos"], "readonly");
  tx.objectStore("memos").getAll().onsuccess = (e) => {
    const allData = e.target.result;

    // 🎯 1. 폴더 가계도 생성
    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });

    // 🎯 2. 목적지 자격 검사 (휴지통 소속이거나, 영구삭제(유령)이거나, 선택한 항목의 자식이면 안됨)
    function isValidDestination(folderId) {
      if (folderId === currentFmFolderId) return false; // 현재 내가 서 있는 폴더는 목적지 후보에서 아예 제외합니다!
      if (movingItemIds.includes(folderId)) return false; // 내 자신에게 이동 불가

      let curr = folderId;
      while (curr) {
        if (movingItemIds.includes(curr)) return false; // 내 자식 폴더들 안으로도 이동 불가

        const f = folderMap.get(curr);
        if (!f) break;

        // 🎯 [완벽 교정] 조상 중에 하나라도 휴지통 소속이거나, 일반 삭제됐거나, '영구 삭제된 유령(isPermanentlyDeleted)'이면 절대 불가!
        if (f.isDeleted || f.isPermanentlyDeleted || f.isSystem === "trash")
          return false;

        curr = f.parentId;
      }
      return true;
    }

    // 🎯 3. 전체 경로 텍스트 다이어트 (군더더기 접두사 제거)
    function getFolderPath(folderId) {
      if (folderId === null) return "Home";
      let path = [];
      let curr = folderId;
      while (curr) {
        const f = folderMap.get(curr);
        if (!f) break;
        path.unshift(f.title);
        curr = f.parentId;
      }
      return path.join(" / "); // 앞에 붙던 Home / 제거
    }

    // 🎯 4. 상단 고정 4대장 리스트업 (텍스트 다이어트 완료)
    const systemItems = [
      { id: null, title: "Home", icon: "fa-house", color: "var(--text-main)" },
      {
        id: globalDesktopFolderId,
        title: "바탕 화면",
        icon: "fa-desktop",
        color: "var(--accent)",
      },
      {
        id: globalSecurityFolderId,
        title: "보안 폴더",
        icon: "fa-lock",
        color: "#f59e0b",
      },
      {
        id: globalBackupFolderId,
        title: "쓸어 담기",
        icon: "fa-box-archive",
        color: "#8ba888",
      },
    ];

    systemItems.forEach((sys) => {
      if (isValidDestination(sys.id)) {
        container.appendChild(
          createDestItem(sys.id, sys.title, sys.icon, sys.color),
        );
      }
    });

    container.appendChild(document.createElement("hr")).style.cssText =
      "margin:8px 0; border:none; border-top:1px solid var(--border);";

    // 🎯 5. 유령 폴더를 제외한 '진짜 일반 폴더들' 전체 경로로 출력
    // [완벽 교정] 본인 스스로가 지워졌거나(isDeleted) 영구 삭제된 유령(isPermanentlyDeleted)인 경우도 1차로 깐깐하게 걸러냅니다!
    const validFolders = allData.filter(
      (m) =>
        m.type === "folder" &&
        !m.isSystem &&
        !m.isDeleted &&
        !m.isPermanentlyDeleted &&
        isValidDestination(m.id),
    );

    // 보기 좋게 이름(경로) 알파벳 순으로 정렬
    validFolders.sort((a, b) =>
      getFolderPath(a.id).localeCompare(getFolderPath(b.id)),
    );

    validFolders.forEach((f) => {
      container.appendChild(
        createDestItem(
          f.id,
          getFolderPath(f.id),
          "fa-folder",
          "var(--text-main)",
        ),
      );
    });
  };
}

// 🎯 6. 아이콘 색상 및 긴 글자 자동 줄바꿈 적용
function createDestItem(id, title, icon, colorStyle) {
  const div = document.createElement("div");
  div.className = `fm-dest-item ${selectedDestId === id ? "active" : ""}`;
  div.innerHTML = `<i class="fa-solid ${icon}" style="color: ${colorStyle}; width: 20px; text-align: center; flex-shrink: 0;"></i> <span style="line-height: 1.4; word-break: break-all;">${title}</span>`;
  div.onclick = () => {
    selectedDestId = id;
    document
      .querySelectorAll(".fm-dest-item")
      .forEach((el) => el.classList.remove("active"));
    div.classList.add("active");
  };
  return div;
}

// 🎯 [완벽 교정] 스마트 이동 엔진 (자동 암복호화 탑재)
document.getElementById("fm-move-confirm-btn").onclick = async () => {
  if (selectedDestId === undefined) {
    alert("이동할 위치를 선택해주세요.");
    return;
  }

  // 1. 목적지가 보안 폴더 구역인지 확인
  const isDestSecure = await checkIsUnderSecurity(selectedDestId);

  // 2. 비동기 처리를 위해 이동할 데이터를 먼저 모두 RAM으로 끌어올립니다.
  const itemsToMove = [];
  await new Promise((resolve) => {
    const getTx = db.transaction(["memos"], "readonly");
    const getStore = getTx.objectStore("memos");
    let processed = 0;

    if (movingItemIds.length === 0) resolve();

    movingItemIds.forEach((id) => {
      getStore.get(id).onsuccess = (e) => {
        const m = e.target.result;
        if (
          m &&
          m.isSystem !== "desktop" &&
          m.isSystem !== "security" &&
          m.isSystem !== "trash" &&
          m.isSystem !== "backup"
        ) {
          if (m.parentId !== selectedDestId) itemsToMove.push(m);
        }
        processed++;
        if (processed === movingItemIds.length) resolve();
      };
    });
  });

  if (itemsToMove.length === 0) {
    closeMoveModal();
    return;
  }

  // 3. 국경(일반<->보안)을 넘는 파일이 있는지 검사하고, 열쇠가 있는지 확인합니다.
  let needsCrypto = false;
  for (const m of itemsToMove) {
    const isItemSecure = await checkIsUnderSecurity(m.parentId);
    if (isItemSecure !== isDestSecure) needsCrypto = true;
  }

  if (needsCrypto && !currentSecKey) {
    alert(
      "보안 구역으로 넣거나 빼려면, 먼저 보안 폴더를 한 번 열어서(잠금 해제) 열쇠를 활성화해야 합니다.",
    );
    closeMoveModal();
    return;
  }

  // 4. 변환 작업 (외계어 씌우기 or 벗기기)
  let actualMoveCount = 0;
  let undoPayload = [];

  showToast("데이터를 변환하며 이동 중입니다...\n(잠시만 기다려주세요)");

  for (const m of itemsToMove) {
    const isItemSecure = await checkIsUnderSecurity(m.parentId);
    undoPayload.push({ id: m.id, action: "moveBack", oldParentId: m.parentId });

    if (!isItemSecure && isDestSecure) {
      // 일반 -> 보안 (암호화)
      m.content = await encryptData(m.content, currentSecKey);
      m.plainText = await encryptData(m.plainText, currentSecKey);
    } else if (isItemSecure && !isDestSecure) {
      // 보안 -> 일반 (복호화)
      m.content = await decryptData(m.content, currentSecKey);
      m.plainText = await decryptData(m.plainText, currentSecKey);
    }

    m.parentId = selectedDestId;
    m.updatedAt = Date.now();
    if (m.isDeleted) {
      m.isDeleted = false;
      delete m.deletedAt;
      delete m.isPermanentlyDeleted;
    }
    actualMoveCount++;
  }

  // 5. 변환이 끝난 데이터를 다시 DB에 꽂아 넣습니다.
  const putTx = db.transaction(["memos"], "readwrite");
  const putStore = putTx.objectStore("memos");
  itemsToMove.forEach((m) => putStore.put(m));

  putTx.oncomplete = () => {
    let stepsToPop = 0; // 🎯 벗길 방어막 개수

    // 1. 이동 팝업창 닫기
    document.getElementById("fm-move-modal").style.display = "none";
    movingItemIds = [];
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
      // 🚨 [대참사 원인 해결!]
      // history.go(-N)은 N칸을 점프해도 popstate 이벤트를 무조건 딱 "1번"만 발생시킵니다!
      // 따라서 카운터를 stepsToPop만큼 올리면 안 되고, 무조건 1만 올려야 합니다!!
      isProgrammaticBack = true;
      //programmaticBackCount += 1;
      history.go(-stepsToPop);
    }

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
    loadFileManager(currentFmFolderId);
  };
};

// 🎯 [수정] 파일 관리창 열기/닫기 (에디터 강제 초기화 및 완벽 잠금)
function openFileManager() {
  if (document.activeElement) document.activeElement.blur();
  closeAllMemoMenus();
  forceSaveImmediate();

  // 🎯 진입 시 에디터를 '새 노트'로 강제 초기화 (기존 빈 노트 폭파 로직 자동 탑재됨)
  createNewMemo();

  closeAllPanelsMobile();

  isMultiSelectMode = false;
  selectedMemos.clear();
  isTrashMultiSelectMode = false;
  selectedTrashMemos.clear();
  loadMemoList(false);

  document.getElementById("col-left").style.display = "none";
  document.getElementById("col-right").style.display = "none";
  document.getElementById("mobile-left-menu-btn").style.display = "none";
  document.getElementById("global-menu-btn").style.display = "none";

  document.getElementById("file-manager-pane").style.display = "flex";

  document.getElementById("fm-search-input").value = ""; // 🎯 진입 시 검색창 초기화
  fmPath = [{ id: null, title: "Home" }];
  history.pushState({ fmOpen: true, fmFolderId: null, fmPath: fmPath }, "");
  loadFileManager(null);

  // 🎯 에디터 완벽 비활성화 (검색창 타이핑 시 글자 새는 현상 2차 원천 차단)
  quill.blur();
  quill.disable();
}

function closeFileManager() {
  document.getElementById("file-manager-pane").style.display = "none";

  document.getElementById("col-left").style.display = "";
  document.getElementById("col-right").style.display = "";
  document.getElementById("mobile-left-menu-btn").style.display = "";
  // 왼쪽 창 자동 열기 로직 삭제 및 우측 메뉴 버튼 복구
  document.getElementById("global-menu-btn").style.display = "flex";

  history.pushState({ page: "main" }, "");

  // 🎯 창을 닫으면 다시 글을 쓸 수 있도록 에디터 잠금 해제
  quill.enable();
  cancelFmMultiSelect();
}

// 🎯 [완벽 교정] 어떤 폴더(특히 보안폴더)에서도 Home으로 안전하게 복귀하는 타임머신
function resetFmToHome() {
  const searchInput = document.getElementById("fm-search-input");
  if (searchInput) searchInput.value = "";

  if (typeof forceCleanFmUI === "function") forceCleanFmUI();

  // 🎯 핵심: fmPath가 1개(Home) 이상일 때만 뒤로가기 실행
  if (fmPath.length > 1) {
    const steps = 1 - fmPath.length;
    history.go(steps);
  } else {
    // 이미 Home이라면 렌더링만 다시 해서 갇힘 방지
    fmPath = [{ id: null, title: "Home" }];
    loadFileManager(null);
  }
}

// 🎯 [수정됨] 파일 매니저 삼선 버튼: 폴더 위치 상관없이 즉시 에디터로 복귀
function handleFmHamburger() {
  closeFileManager(); // 군더더기 없이 바로 창 닫기!
}

function createNewMemo(folderId = null) {
  forceSaveImmediate();
  targetNewMemoFolderId = folderId; // 🎯 새 노트가 저장될 특정 폴더 위치 기억

  const previousMemoId = currentMemoId;
  if (previousMemoId) purgeMemoIfEmpty(previousMemoId);

  currentMemoId = null;
  selectedMemos.clear();
  lastSelectedId = null;
  document.getElementById("memo-title-input").value = "";
  document.title = "새 노트";

  isLoading = true;
  quill.root.innerHTML = "";
  updateUIState("idle");

  loadMemoList(false);
  closeAllPanelsMobile();

  // 🎯 [추가] 새 노트를 열 때 기존 노트의 Ctrl+Z 수정 기록을 완벽히 지움
  setTimeout(() => quill.history.clear(), 10);
  setTimeout(() => {
    isLoading = false;
  }, 10);
}

function loadMemoList(queryDB = true) {
  const query = document
    .getElementById("list-search-input")
    .value.toLowerCase();
  const list = document.getElementById("memo-list");
  const savedScroll = list.scrollTop;

  if (queryDB) {
    const tx = db.transaction(["memos"], "readonly");

    tx.objectStore("memos").getAll().onsuccess = (e) => {
      const allData = e.target.result;
      let pinnedMemos = [],
        normalMemos = [];

      // 🎯 폴더 가계도 파악 (바탕화면 아래에 있는 모든 하위 폴더 찾기)
      const folderMap = new Map();
      allData.forEach((m) => {
        if (m.type === "folder") folderMap.set(m.id, m);
      });

      // 🎯 유령 파일 퇴마: 조상 폴더가 휴지통에 가 있는지 꼼꼼히 확인
      function isUnderDesktop(parentId) {
        let curr = parentId;
        while (curr) {
          if (curr === globalDesktopFolderId) return true;
          const parentFolder = folderMap.get(curr);
          // 🎯 조상 폴더가 없거나, 지워졌거나, 휴지통이면 바탕화면 출입 금지!
          if (
            !parentFolder ||
            parentFolder.isDeleted ||
            parentFolder.isSystem === "trash"
          )
            return false;
          curr = parentFolder.parentId;
        }
        return false;
      }

      allData.forEach((m) => {
        // 🎯 바탕화면 소속(직접+간접) 파일만 싹 다 평탄화(Flatten)해서 가져옴
        if (m.type === "folder" || m.isDeleted || m.isPermanentlyDeleted)
          return;
        if (!isUnderDesktop(m.parentId)) return;

        // 🚀 [보안 폴더 검색 차단] 암호화된 외계어 텍스트는 검색에서 제외시킵니다.
        const safePlainText =
          m.plainText && !m.plainText.startsWith("ZENENC::")
            ? m.plainText.toLowerCase()
            : "";
        const matchQuery =
          m.title.toLowerCase().includes(query) ||
          safePlainText.includes(query);

        if (matchQuery) {
          if (m.pinnedAt) pinnedMemos.push(m);
          else normalMemos.push(m);
        }
      });

      // 🎯 최신순 정렬
      pinnedMemos.sort((a, b) => a.pinnedAt - b.pinnedAt);
      normalMemos.sort((a, b) => b.updatedAt - a.updatedAt);

      displayedMemos = [...pinnedMemos, ...normalMemos];
      list.innerHTML = "";
      displayedMemos.forEach((m) => list.appendChild(createMemoElement(m)));
      list.scrollTop = savedScroll;
    };
  } else {
    // 🎯 [버그 복구] DB 조회 없이 UI(체크박스)만 즉시 새로고침하는 기능 부활!
    list.innerHTML = "";
    displayedMemos.forEach((m) => list.appendChild(createMemoElement(m)));
    list.scrollTop = savedScroll;
  }
}

function loadTrashList() {
  const query = document
    .getElementById("trash-search-input")
    .value.toLowerCase();
  const list = document.getElementById("trash-list");
  const savedScroll = list.scrollTop;

  const tx = db.transaction(["memos"], "readonly");
  displayedTrashMemos = [];

  // 🎯 1. 전체 데이터를 가져와서 가계도(족보)를 파악합니다.
  tx.objectStore("memos").getAll().onsuccess = (e) => {
    const allData = e.target.result;

    const folderMap = new Map();
    allData.forEach((m) => {
      if (m.type === "folder") folderMap.set(m.id, m);
    });

    // 🎯 2. 조상 중에 '바탕 화면'이 있는지 끝까지 추적하는 전용 함수
    // (삭제된 폴더 안에 있던 파일이더라도 뿌리만 맞으면 통과시킵니다)
    function isUnderDesktop(parentId) {
      let curr = parentId;
      while (curr) {
        if (curr === globalDesktopFolderId) return true;
        const parentFolder = folderMap.get(curr);
        if (!parentFolder) return false;
        curr = parentFolder.parentId;
      }
      return false;
    }

    // 🎯 3. 조건에 맞는 파일만 필터링
    allData.forEach((m) => {
      const isFile = m.type === "file" || m.type === undefined;
      // 🚀 [보안 폴더 검색 차단] 암호화된 외계어 텍스트는 검색에서 제외시킵니다.
      const safePlainText =
        m.plainText && !m.plainText.startsWith("ZENENC::")
          ? m.plainText.toLowerCase()
          : "";
      const matchQuery =
        m.title.toLowerCase().includes(query) || safePlainText.includes(query);

      // 지워진 상태이면서, 영구삭제되지 않은 '파일'이고, 검색어에 맞을 때
      if (m.isDeleted && !m.isPermanentlyDeleted && isFile && matchQuery) {
        // 🎯 오직 '바탕 화면' 소속이었던 파일만 휴지통 창에 전시합니다!
        if (isUnderDesktop(m.parentId)) {
          displayedTrashMemos.push(m);
        }
      }
    });

    // 🎯 4. 최신 삭제(업데이트) 순서대로 정렬
    displayedTrashMemos.sort((a, b) => b.updatedAt - a.updatedAt);

    // 🎯 5. 화면에 그리기
    list.innerHTML = "";
    displayedTrashMemos.forEach((m) => list.appendChild(createTrashElement(m)));
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
  const li = document.createElement("li");

  const isActive = isMultiSelectMode
    ? selectedMemos.has(memo.id)
    : currentMemoId === memo.id || selectedMemos.has(memo.id);
  li.className = `memo-item ${isActive ? "active" : ""}`;

  li.innerHTML = `
                <div class="memo-info">
                    <span class="memo-title">${memo.title}</span>
                    <span class="memo-date">${formatDateTime(memo.updatedAt)}</span>
                </div>
                <div class="memo-actions-wrap ${memo.pinnedAt ? "is-pinned-state" : ""}">
                    <div class="memo-actions">
                        <i class="fa-solid fa-thumbtack btn-pin ${memo.pinnedAt ? "is-pinned" : ""}" onclick="handlePinClick(${memo.id}, ${!!memo.pinnedAt}, event)"></i>
                        <i class="fa-solid fa-trash-can btn-delete" onclick="deleteMemo(${memo.id}, event)"></i>
                    </div>
                    <i class="fa-solid fa-ellipsis-vertical btn-more mobile-only" onclick="toggleMemoMenu(event)"></i>
                </div>`;

  li.addEventListener("mousedown", (e) => startPress(e, memo.id, false));
  li.addEventListener("touchstart", (e) => startPress(e, memo.id, false), {
    passive: true,
  });
  li.addEventListener("mouseup", cancelPress);
  li.addEventListener("mouseleave", cancelPress);
  li.addEventListener("touchend", cancelPress);
  li.addEventListener("touchmove", cancelPress, { passive: true });

  li.onclick = (e) => {
    if (document.querySelector(".memo-actions-wrap.is-menu-open")) {
      closeAllMemoMenus();
      return;
    }
    if (e.target.closest(".memo-actions-wrap")) return;

    if (isPressTriggered) {
      isPressTriggered = false;
      return;
    }

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isMultiSelectMode && !isCtrl && !isShift) {
      if (selectedMemos.has(memo.id)) {
        selectedMemos.delete(memo.id);
        if (selectedMemos.size === 0) isMultiSelectMode = false;
      } else {
        selectedMemos.add(memo.id);
        lastSelectedId = memo.id;
      }
      loadMemoList(false);
      return;
    }

    forceSaveImmediate();

    if (isShift && lastSelectedId !== null) {
      const cIdx = displayedMemos.findIndex((m) => m.id === memo.id);
      const lIdx = displayedMemos.findIndex((m) => m.id === lastSelectedId);

      if (cIdx !== -1 && lIdx !== -1) {
        const start = Math.min(cIdx, lIdx);
        const end = Math.max(cIdx, lIdx);
        if (!isCtrl) selectedMemos.clear();
        for (let i = start; i <= end; i++)
          selectedMemos.add(displayedMemos[i].id);
      }
      loadMemoList(false);
    } else if (isCtrl) {
      if (selectedMemos.has(memo.id)) selectedMemos.delete(memo.id);
      else selectedMemos.add(memo.id);
      lastSelectedId = memo.id;
      loadMemoList(false);
    } else {
      selectedMemos.clear();
      selectedMemos.add(memo.id);
      lastSelectedId = memo.id;
      isMultiSelectMode = false;
      loadMemo(memo.id);
    }
  };
  return li;
}

function createTrashElement(memo) {
  const li = document.createElement("li");
  li.className = `memo-item ${selectedTrashMemos.has(memo.id) ? "active" : ""}`;
  li.innerHTML = `
                <div class="memo-info">
                    <span class="memo-title">${memo.title}</span>
                    <span class="memo-date">${formatDateTime(memo.deletedAt || memo.updatedAt)}</span>
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
  };
}

// 🚀 [보안 코어 1] 노트 불러오기 (복호화 검문소)
async function loadMemo(id) {
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
        currentMemoId = m.id;
        document.getElementById("memo-title-input").value = m.title;
        document.title = m.title;

        let finalContent = m.content || "";

        // 🎯 [보안 복호화] 본문이 암호화되어 있다면 해독 시도
        if (isEditingSecureMemo && finalContent.startsWith("ZENENC::")) {
          if (!currentSecKey) {
            showToast("보안 세션이 만료되었습니다. 폴더를 다시 열어주세요.");
            closeFileManager();
            createNewMemo();
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

        updateUIState("idle"); // 조용히 대기 상태 유지

        if (previousMemoId) purgeMemoIfEmpty(previousMemoId);

        loadMemoList(false); // 목록 하이라이트 변경용 (가볍게)

        // 🎯 [추가] 다른 노트를 열 때 이전 노트의 Ctrl+Z 수정 기록을 완벽히 지움
        setTimeout(() => quill.history.clear(), 10);
        setTimeout(() => {
          isLoading = false;
        }, 10);
      }
    };
  closeAllPanelsMobile();
}

function deleteMemo(id, e) {
  e.stopPropagation();
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
    // 🎯 버그 수정: 다중 선택 모드 확실히 끄기
    isMultiSelectMode = false;
    targets.forEach((targetId) => selectedMemos.delete(targetId));

    if (targets.includes(currentMemoId)) {
      createNewMemo();
      loadMemoList(true); // 🎯 버그 수정: 잔상이 남지 않도록 무조건 DB 강제 새로고침
    } else {
      loadMemoList(true);
    }
    updateUnsyncedCount();
  };
}

function restoreMemo(id, e) {
  e.stopPropagation();
  const targets =
    selectedTrashMemos.has(id) && selectedTrashMemos.size > 1
      ? Array.from(selectedTrashMemos)
      : [id];
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  targets.forEach((targetId) => {
    store.get(targetId).onsuccess = (ev) => {
      const memo = ev.target.result;
      if (memo) {
        memo.isDeleted = false;
        delete memo.deletedAt;
        memo.updatedAt = Date.now();
        store.put(memo);
      }
    };
  });

  tx.oncomplete = () => {
    // 🎯 버그 수정: 다중 선택 모드 확실히 끄기
    isTrashMultiSelectMode = false;
    targets.forEach((targetId) => selectedTrashMemos.delete(targetId));

    loadTrashList();
    loadMemoList(true); // 🎯 버그 수정: 제가 함부로 지웠던 메인 목록 새로고침 부활!
    updateUnsyncedCount();
  };
}

function hardDeleteMemo(id, e) {
  e.stopPropagation();
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
      }
    };
  });

  tx.oncomplete = () => {
    targets.forEach((targetId) => selectedTrashMemos.delete(targetId));
    loadTrashList();
    updateUnsyncedCount(); // 🎯 삭제했다는 사실도 동기화해야 하므로 카운트 업데이트
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

    // DB를 직접 뒤져서 지울 게 하나도 없으면 그때 토스트를 띄웁니다.
    if (trashItems.length === 0) {
      showToast("휴지통이 이미 비어있습니다.");
      return;
    }

    if (!confirm("휴지통의 모든 메모를 삭제합니다. 계속하시겠습니까?")) return;

    trashItems.forEach((memo) => {
      memo.isPermanentlyDeleted = true;
      memo.updatedAt = Date.now();
      store.put(memo);
    });

    tx.oncomplete = () => {
      selectedTrashMemos.clear();
      loadTrashList();
      updateUnsyncedCount();
      showToast("휴지통이 완전히 비워졌습니다.");
      // 🎯 현재 휴지통 폴더 안이라면 리스트를 즉시 새로고침합니다.
      loadFileManager(currentFmFolderId);
    };
  };
}

// 🎯 [교정] 일괄 복구 처리 (개수가 0개로 나오는 현상 해결)
function fmBatchRestore() {
  if (fmSelectedItems.size === 0) {
    showToast("복구할 항목을 선택해주세요.");
    return;
  }

  const count = fmSelectedItems.size; // 🎯 선택 초기화 전에 개수를 미리 피신시킵니다!

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  fmSelectedItems.forEach((id) => {
    store.get(id).onsuccess = (e) => {
      const m = e.target.result;
      if (m) {
        m.isDeleted = false;
        delete m.deletedAt;
        m.updatedAt = Date.now();
        store.put(m);
      }
    };
  });
  tx.oncomplete = () => {
    cancelFmMultiSelect();
    loadTrashList();
    loadMemoList(true);
    updateUnsyncedCount();
    showToast(`${count}개 항목이 복구되었습니다.`);
  };
}

// 🎯 [신규] 바탕 화면 일괄 백업 함수
function backupDesktop() {
  if (!confirm("바탕 화면의 모든 항목을 쓸어 담기로 이동하시겠습니까?"))
    return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  // 1. 현재 일시로 새로운 백업 폴더 생성
  const folderName = formatDateTime(Date.now());
  const newFolder = {
    title: folderName,
    type: "folder",
    parentId: globalBackupFolderId, // 백업 시스템 폴더 아래에 생성
    updatedAt: Date.now(),
    isDeleted: false,
  };

  store.add(newFolder).onsuccess = (e) => {
    const newBackupFolderId = e.target.result;

    // 2. 바탕 화면에 있는 모든 항목을 방금 만든 폴더로 이동
    store.getAll().onsuccess = (ev) => {
      const allData = ev.target.result;
      allData.forEach((m) => {
        if (
          m.parentId === globalDesktopFolderId &&
          !m.isDeleted &&
          !m.isPermanentlyDeleted
        ) {
          m.parentId = newBackupFolderId;
          m.updatedAt = Date.now();
          store.put(m);
        }
      });
    };
  };

  tx.oncomplete = () => {
    showToast("바탕 화면이 백업되었습니다.");
    loadFileManager(currentFmFolderId); // 현재 바탕화면이면 깨끗해진 화면 렌더링
    loadMemoList(true); // 왼쪽 메인 창도 깨끗하게 동기화
  };
}

// 🎯 [신규] 특정 폴더 하나만 통째로 '쓸어 담기'로 보내는 기능
function backupThisFolder() {
  if (!currentFmFolderId) return;
  if (!confirm("이 폴더를 쓸어 담기로 이동하시겠습니까?"))
    return;

  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");

  store.get(currentFmFolderId).onsuccess = (e) => {
    const folder = e.target.result;
    if (folder) {
      folder.parentId = globalBackupFolderId; // 🎯 백업 폴더로 족보 변경
      folder.updatedAt = Date.now();
      store.put(folder);
    }
  };

  tx.oncomplete = () => {
    showToast("폴더가 쓸어 담기로 안전하게 이동되었습니다.");
    document.getElementById("fm-global-menu").classList.remove("is-active");
    updateUnsyncedCount();
    history.back(); // 🎯 이동 후 즉시 상위 폴더(바탕 화면)로 자동 복귀!
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
  };
}

// 🎯 [신규] 현재 폴더 비우기 (영구 삭제 및 부모 폴더로 바운스)
function emptyCurrentFolder() {
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
  };
}
