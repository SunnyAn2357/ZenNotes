// ============================================================================
// [V1.6.0] Zen Bridge: 1시간 무소음 자동 백업, MY AI API 키, 일정관리 보내기, 블랙홀 포털 껍데기
// ============================================================================

(function () {
    "use strict";

    // ========================================================================
    // 1. 공통 환경 판별 유틸리티
    // ========================================================================
    function isDesktopWebViewEnv() {
        return !!(window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === "function");
    }

    function isMobileBrowserEnv() {
        if (isDesktopWebViewEnv()) return false;
        const ua = (navigator.userAgent || "").toLowerCase();
        if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/.test(ua)) return true;
        return !!(navigator.maxTouchPoints > 1 && window.innerWidth <= 900);
    }

    function pad2(n) {
        return String(n).padStart(2, "0");
    }

    function escapeHtmlStr(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // ========================================================================
    // 2. 1시간 주기 조용한 자동 전체 백업 (D:\MY_Apps\Backups\mynotes\ & 30일 자동 정리)
    // ========================================================================
    const AUTO_BACKUP_HANDLE_KEY = "auto_backup_dir";
    const AUTO_BACKUP_HASH_STORAGE_KEY = "zen_auto_backup_last_hash";
    const AUTO_BACKUP_TIME_STORAGE_KEY = "zen_auto_backup_last_at";
    const AUTO_BACKUP_INTERVAL_MS = 60 * 60 * 1000;
    const AUTO_BACKUP_RETENTION_DAYS = 30;

    let cachedAutoBackupDirHandle = null;
    let autoBackupInFlight = false;
    let pendingAutoBackupHash = "";
    let notesAutoBackupTimer = null;

    async function getStoredAutoBackupDirHandle() {
        if (cachedAutoBackupDirHandle) return cachedAutoBackupDirHandle;
        return new Promise((resolve) => {
            try {
                const req = indexedDB.open("zen_fs_db", 1);
                req.onupgradeneeded = (e) => {
                    const idb = e.target.result;
                    if (!idb.objectStoreNames.contains("handles")) {
                        idb.createObjectStore("handles");
                    }
                };
                req.onsuccess = (e) => {
                    try {
                        const idb = e.target.result;
                        const tx = idb.transaction("handles", "readonly");
                        const getReq = tx.objectStore("handles").get(AUTO_BACKUP_HANDLE_KEY);
                        getReq.onsuccess = () => {
                            cachedAutoBackupDirHandle = getReq.result || null;
                            resolve(cachedAutoBackupDirHandle);
                        };
                        getReq.onerror = () => resolve(null);
                    } catch {
                        resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    async function storeAutoBackupDirHandle(handle) {
        cachedAutoBackupDirHandle = handle || null;
        return new Promise((resolve) => {
            try {
                const req = indexedDB.open("zen_fs_db", 1);
                req.onupgradeneeded = (e) => {
                    const idb = e.target.result;
                    if (!idb.objectStoreNames.contains("handles")) {
                        idb.createObjectStore("handles");
                    }
                };
                req.onsuccess = (e) => {
                    try {
                        const idb = e.target.result;
                        const tx = idb.transaction("handles", "readwrite");
                        if (handle) {
                            tx.objectStore("handles").put(handle, AUTO_BACKUP_HANDLE_KEY);
                        } else {
                            tx.objectStore("handles").delete(AUTO_BACKUP_HANDLE_KEY);
                        }
                        tx.oncomplete = () => resolve(true);
                        tx.onerror = () => resolve(false);
                    } catch {
                        resolve(false);
                    }
                };
                req.onerror = () => resolve(false);
            } catch {
                resolve(false);
            }
        });
    }

    async function buildDeterministicNotesAutoBackupPayload() {
        if (typeof db === "undefined" || !db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(["memos"], "readonly");
                const store = tx.objectStore("memos");
                const req = store.getAll();
                req.onsuccess = (e) => {
                    const all = Array.isArray(e.target.result) ? e.target.result : [];
                    const activeMemos = all.filter((m) => m && !m.isDeleted && !m.isPermanentlyDeleted);
                    const itemById = new Map();
                    activeMemos.forEach((m) => {
                        if (m.id !== undefined && m.id !== null) itemById.set(m.id, m);
                    });

                    let latestUpdatedAt = 0;
                    const enriched = activeMemos
                        .map((m) => {
                            const clone = Object.assign({}, m);
                            if (clone.parentId !== null && clone.parentId !== undefined) {
                                const p = itemById.get(clone.parentId);
                                if (p && p.syncId && !clone.parentSyncId) {
                                    clone.parentSyncId = p.syncId;
                                }
                            }
                            const ts = Number(clone.updatedAt || clone.timestamp || 0);
                            if (Number.isFinite(ts) && ts > latestUpdatedAt) latestUpdatedAt = ts;
                            return clone;
                        })
                        .sort((a, b) => {
                            const ka = String(a.syncId || a.id || "");
                            const kb = String(b.syncId || b.id || "");
                            return ka.localeCompare(kb);
                        });

                    resolve({
                        type: "ZenBackup",
                        schemaVersion: 2,
                        backupSource: "auto",
                        latestUpdatedAt: latestUpdatedAt,
                        data: enriched
                    });
                };
                req.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    async function computeNotesSha256Hex(text) {
        try {
            if (window.crypto && window.crypto.subtle && typeof TextEncoder !== "undefined") {
                const buf = new TextEncoder().encode(text);
                const digest = await window.crypto.subtle.digest("SHA-256", buf);
                return Array.from(new Uint8Array(digest))
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            }
        } catch { }
        let h1 = 0x811c9dc5;
        let h2 = 0x01000193;
        for (let i = 0; i < text.length; i++) {
            const ch = text.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
            h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
        }
        return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0") + "_" + text.length;
    }

    function formatNotesBackupTime(rawMs) {
        const ts = Number(rawMs);
        if (!Number.isFinite(ts) || ts <= 0) return "기록 없음";
        const d = new Date(ts);
        if (isNaN(d.getTime())) return "기록 없음";
        return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}. ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }

    async function runNotesAutoBackupInBrowserDir(dirHandle, payloadJson, payloadHash, force) {
        const existing = [];
        for await (const [name, entry] of dirHandle.entries()) {
            if (entry.kind === "file" && /^mynotes_backup_.*\.json$/i.test(name)) {
                try {
                    const file = await entry.getFile();
                    existing.push({ name, entry, lastModified: file.lastModified || 0 });
                } catch { }
            }
        }
        existing.sort((a, b) => (b.lastModified - a.lastModified) || b.name.localeCompare(a.name));

        if (!force && existing.length > 0) {
            const savedHash = localStorage.getItem(AUTO_BACKUP_HASH_STORAGE_KEY) || "";
            if (savedHash && savedHash === payloadHash) {
                return { ok: true, saved: false, reason: "unchanged" };
            }
            try {
                const latestText = await (await existing[0].entry.getFile()).text();
                const latestHash = await computeNotesSha256Hex(latestText);
                if (latestHash === payloadHash) {
                    localStorage.setItem(AUTO_BACKUP_HASH_STORAGE_KEY, payloadHash);
                    return { ok: true, saved: false, reason: "unchanged" };
                }
            } catch { }
        }

        const now = new Date();
        const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}_${pad2(now.getHours())}${pad2(now.getMinutes())}`;
        let fileName = `mynotes_backup_${stamp}.json`;
        const used = new Set(existing.map((x) => x.name));
        if (used.has(fileName)) {
            fileName = `mynotes_backup_${stamp}_${pad2(now.getSeconds())}${String(now.getMilliseconds()).padStart(3, "0")}.json`;
        }

        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(new Blob([payloadJson], { type: "application/json;charset=utf-8" }));
        await writable.close();

        const cutoff = Date.now() - AUTO_BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000;
        // 최신 생성본은 유지하고 나머지 중 30일 경과 백업만 삭제
        for (let i = 0; i < existing.length; i++) {
            const f = existing[i];
            if (f.lastModified > 0 && f.lastModified < cutoff) {
                try {
                    await dirHandle.removeEntry(f.name);
                } catch { }
            }
        }

        return { ok: true, saved: true };
    }

    async function runNotesSilentAutoBackup(force = false) {
        if (autoBackupInFlight) return { ok: false, skipped: true, reason: "busy" };
        if (!isDesktopWebViewEnv() && isMobileBrowserEnv()) {
            return { ok: false, skipped: true, reason: "mobile" };
        }
        if (typeof isAppScreenLocked === "function" && isAppScreenLocked()) {
            return { ok: false, skipped: true, reason: "locked" };
        }

        autoBackupInFlight = true;
        try {
            const payloadObj = await buildDeterministicNotesAutoBackupPayload();
            if (!payloadObj) return { ok: false, skipped: true, reason: "db_not_ready" };
            if (!Array.isArray(payloadObj.data) || payloadObj.data.length === 0) {
                return { ok: true, saved: false, reason: "empty" };
            }

            const payloadJson = JSON.stringify(payloadObj);
            const payloadHash = await computeNotesSha256Hex(payloadJson);
            const lastHash = localStorage.getItem(AUTO_BACKUP_HASH_STORAGE_KEY) || "";

            if (!force && lastHash && lastHash === payloadHash) {
                return { ok: true, saved: false, reason: "unchanged" };
            }

            if (isDesktopWebViewEnv()) {
                pendingAutoBackupHash = payloadHash;
                window.chrome.webview.postMessage(
                    JSON.stringify({
                        type: "autoBackupSnapshot",
                        payload: payloadJson,
                        manual: !!force
                    })
                );
                return { ok: true, pending: true };
            }

            if (typeof window.showDirectoryPicker !== "function") {
                if (force && typeof showToast === "function") {
                    showToast("이 브라우저는 폴더 자동 백업을 지원하지 않습니다. Export 또는 백업을 이용해 주세요.");
                }
                return { ok: false, skipped: true, reason: "unsupported" };
            }

            const dirHandle = await getStoredAutoBackupDirHandle();
            if (!dirHandle) {
                if (force && typeof showToast === "function") {
                    showToast("먼저 자동 백업 폴더를 선택해 주세요.");
                }
                return { ok: false, skipped: true, reason: "no_handle" };
            }

            let perm = "prompt";
            try {
                perm = await dirHandle.queryPermission({ mode: "readwrite" });
                if (perm !== "granted" && force) {
                    perm = await dirHandle.requestPermission({ mode: "readwrite" });
                }
            } catch {
                perm = "denied";
            }
            if (perm !== "granted") {
                if (force && typeof showToast === "function") {
                    showToast("자동 백업 폴더 쓰기 권한이 필요합니다. 폴더를 다시 선택해 주세요.");
                }
                return { ok: false, skipped: true, reason: "permission" };
            }

            const result = await runNotesAutoBackupInBrowserDir(dirHandle, payloadJson, payloadHash, force);
            localStorage.setItem(AUTO_BACKUP_HASH_STORAGE_KEY, payloadHash);
            if (result.saved) {
                localStorage.setItem(AUTO_BACKUP_TIME_STORAGE_KEY, String(Date.now()));
                if (force && typeof showToast === "function") {
                    showToast("자동 전체 백업 파일이 저장되었습니다.");
                }
            } else if (force && typeof showToast === "function") {
                showToast("변경 사항이 없어 기존 최신 백업이 유지됩니다.");
            }
            refreshNotesAutoBackupSettingsUI();
            return result;
        } catch (err) {
            if (force && typeof showToast === "function") {
                showToast("자동 백업 실행 중 오류가 발생했습니다.");
            }
            return { ok: false, error: String(err && err.message ? err.message : err) };
        } finally {
            autoBackupInFlight = false;
        }
    }

    async function pickNotesAutoBackupDirectory() {
        if (typeof window.showDirectoryPicker !== "function") {
            if (typeof showToast === "function") showToast("현재 브라우저에서는 폴더 지정 기능을 지원하지 않습니다.");
            return;
        }
        try {
            const handle = await window.showDirectoryPicker({ mode: "readwrite" });
            if (handle) {
                await storeAutoBackupDirHandle(handle);
                await refreshNotesAutoBackupSettingsUI();
                await runNotesSilentAutoBackup(true);
            }
        } catch (e) {
            if (e && e.name !== "AbortError" && typeof showToast === "function") {
                showToast("백업 폴더를 선택할 수 없습니다.");
            }
        }
    }

    function openNotesAutoBackupFolder() {
        if (isDesktopWebViewEnv()) {
            window.chrome.webview.postMessage(JSON.stringify({ type: "openAutoBackupFolder" }));
        } else {
            pickNotesAutoBackupDirectory();
        }
    }

    function runNotesAutoBackupNow() {
        return runNotesSilentAutoBackup(true);
    }

    async function refreshNotesAutoBackupSettingsUI() {
        const lastTimeEl = document.getElementById("setting-auto-backup-last-at");
        if (lastTimeEl) {
            lastTimeEl.textContent = "최근: " + formatNotesBackupTime(localStorage.getItem(AUTO_BACKUP_TIME_STORAGE_KEY));
        }

        const desktopControls = document.getElementById("setting-auto-backup-desktop-row");
        const browserControls = document.getElementById("setting-auto-backup-browser-row");
        const mobileNote = document.getElementById("setting-auto-backup-mobile-note");
        const statusBadge = document.getElementById("setting-auto-backup-folder-status");

        const isDesktop = isDesktopWebViewEnv();
        const isMobile = !isDesktop && isMobileBrowserEnv();

        if (desktopControls) desktopControls.style.display = isDesktop ? "flex" : "none";
        if (browserControls) browserControls.style.display = !isDesktop && !isMobile ? "flex" : "none";
        if (mobileNote) mobileNote.style.display = isMobile ? "block" : "none";

        if (!isDesktop && !isMobile && statusBadge) {
            const h = await getStoredAutoBackupDirHandle();
            if (!h) {
                statusBadge.textContent = "폴더 미지정 (선택 필요)";
            } else {
                let perm = "prompt";
                try {
                    perm = await h.queryPermission({ mode: "readwrite" });
                } catch { }
                statusBadge.textContent = perm === "granted"
                    ? `연결됨: ${h.name}`
                    : `${h.name} (권한 확인 필요)`;
            }
        }
    }

    function bindDesktopAutoBackupListener() {
        if (!isDesktopWebViewEnv() || window._zenAutoBackupMsgBound) return;
        window._zenAutoBackupMsgBound = true;
        window.chrome.webview.addEventListener("message", (event) => {
            try {
                const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                if (!payload || payload.type !== "autoBackupResult") return;
                if (payload.ok) {
                    if (pendingAutoBackupHash) {
                        localStorage.setItem(AUTO_BACKUP_HASH_STORAGE_KEY, pendingAutoBackupHash);
                    }
                    if (payload.saved) {
                        localStorage.setItem(AUTO_BACKUP_TIME_STORAGE_KEY, String(payload.timestamp || Date.now()));
                        if (payload.manual && typeof showToast === "function") {
                            showToast("자동 전체 백업이 완료되었습니다. (D:\\MY_Apps\\Backups\\mynotes)");
                        }
                    } else if (payload.manual && typeof showToast === "function") {
                        showToast("변경 사항이 없어 기존 최신 백업이 유지됩니다.");
                    }
                    refreshNotesAutoBackupSettingsUI();
                } else if (payload.manual && typeof showToast === "function") {
                    showToast("자동 백업 오류: " + (payload.message || "알 수 없는 오류"));
                }
            } catch { }
        });
    }

    function initNotesAutoBackupScheduler() {
        bindDesktopAutoBackupListener();
        if (notesAutoBackupTimer) return;

        setTimeout(() => {
            runNotesSilentAutoBackup(false);
        }, 15000);

        notesAutoBackupTimer = setInterval(() => {
            runNotesSilentAutoBackup(false);
        }, AUTO_BACKUP_INTERVAL_MS);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") {
                const last = Number(localStorage.getItem(AUTO_BACKUP_TIME_STORAGE_KEY) || 0);
                if (!last || Date.now() - last >= AUTO_BACKUP_INTERVAL_MS) {
                    runNotesSilentAutoBackup(false);
                }
            }
        });
    }

    // ========================================================================
    // 3. 환경설정 - MY AI (TimelyGPT) 개인 API 키 입력/저장
    // ========================================================================
    const MYAI_KEY_STORAGE_KEY = "zen_myai_api_key";

    function syncMyAiApiKeySettingsUI() {
        const input = document.getElementById("setting-myai-api-key");
        const statusEl = document.getElementById("setting-myai-key-status");
        const val = localStorage.getItem(MYAI_KEY_STORAGE_KEY) || "";
        if (input) {
            input.value = val;
            input.type = "password";
        }
        const eyeBtn = document.getElementById("setting-myai-key-eye-btn");
        if (eyeBtn) {
            eyeBtn.innerHTML = '<i class="fa-regular fa-eye"></i>';
            eyeBtn.title = "API 키 보기";
        }
        if (statusEl) {
            statusEl.textContent = val ? "저장됨" : "미입력";
            statusEl.classList.toggle("is-saved", !!val);
        }
    }

    function toggleMyAiApiKeyVisibility() {
        const input = document.getElementById("setting-myai-api-key");
        const eyeBtn = document.getElementById("setting-myai-key-eye-btn");
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        if (eyeBtn) {
            eyeBtn.innerHTML = show ? '<i class="fa-regular fa-eye-slash"></i>' : '<i class="fa-regular fa-eye"></i>';
            eyeBtn.title = show ? "API 키 숨기기" : "API 키 보기";
        }
    }

    function saveMyAiApiKey() {
        const input = document.getElementById("setting-myai-api-key");
        if (!input) return;
        const cleaned = (input.value || "").trim();
        if (!cleaned) {
            localStorage.removeItem(MYAI_KEY_STORAGE_KEY);
            syncMyAiApiKeySettingsUI();
            if (typeof showToast === "function") showToast("MY AI 개인 API 키가 비워졌습니다.");
            return;
        }
        localStorage.setItem(MYAI_KEY_STORAGE_KEY, cleaned);
        syncMyAiApiKeySettingsUI();
        if (typeof showToast === "function") showToast("MY AI 개인 API 키가 저장되었습니다.");
    }

    // ========================================================================
    // 4. MY 일정관리로 보내기 모달 (노트 본문 표 · 그림 · 코드블록 · 인용구 100% 그대로 복사/전송)
    // ========================================================================
    let stsSnapshot = null;
    let bhAutoScheduleTimer = null;

    function getLocalTodayIso() {
        const d = new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    }

    function getOffsetDateParts(daysOffset = 5) {
        const d = new Date();
        d.setDate(d.getDate() + daysOffset);
        const yyyy = String(d.getFullYear());
        const mm = pad2(d.getMonth() + 1);
        const dd = pad2(d.getDate());
        const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
        const wk = weekdays[d.getDay()];
        return {
            iso: `${yyyy}-${mm}-${dd}`,
            compact: `${yyyy}${mm}${dd}`,
            zenDate: `${yyyy}.${mm}.${dd}.(${wk})`
        };
    }

    function getCleanQuillElementHtml(rootEl) {
        if (!rootEl) return "";
        const clone = rootEl.cloneNode(true);
        clone.querySelectorAll("img.zen-img-multi-selected").forEach((img) => {
            img.classList.remove("zen-img-multi-selected");
            if (img.classList.length === 0) img.removeAttribute("class");
        });
        clone.querySelectorAll("select.ql-ui").forEach((sel) => {
            const val = sel.value;
            sel.querySelectorAll("option").forEach((opt) => {
                if (opt.value === val) opt.setAttribute("selected", "selected");
                else opt.removeAttribute("selected");
            });
        });
        return clone.innerHTML;
    }

    function detectScheduleDateFromNote(title, plainText) {
        const deadlineTag = (title || "").match(/\((\d{4})(\d{2})(\d{2})까지\)/);
        if (deadlineTag) {
            return `${deadlineTag[1]}-${deadlineTag[2]}-${deadlineTag[3]}`;
        }
        const combined = `${title || ""}\n${plainText || ""}`;
        const explicitMatch = combined.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?\s*(?:([일월화수목금토])\))?\s*(?:\d{1,2}:\d{2})?\s*(?:까지|마감|기한|제출)/);
        if (explicitMatch) {
            return `${explicitMatch[1]}-${pad2(explicitMatch[2])}-${pad2(explicitMatch[3])}`;
        }
        const ymdMatch = combined.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
        if (ymdMatch) {
            return `${ymdMatch[1]}-${pad2(ymdMatch[2])}-${pad2(ymdMatch[3])}`;
        }
        return getLocalTodayIso();
    }

    function detectScheduleTimeFromText(plainText) {
        const m = (plainText || "").match(/(?:오전|오후)?\s*(\d{1,2})\s*:\s*(\d{2})|(?:오전|오후)\s*(\d{1,2})\s*시\s*(\d{1,2})?분?/);
        if (!m) return "";
        let h = parseInt(m[1] || m[3], 10);
        const min = parseInt(m[2] || m[4] || "0", 10);
        if (isNaN(h) || isNaN(min) || min < 0 || min > 59) return "";
        if (/오후/.test(m[0]) && h >= 1 && h <= 11) h += 12;
        if (/오전/.test(m[0]) && h === 12) h = 0;
        if (h < 0 || h > 23) return "";
        return `${pad2(h)}:${pad2(min)}`;
    }

    function detectScheduleLocationFromNote(rootEl, plainText) {
        if (rootEl) {
            const cells = Array.from(rootEl.querySelectorAll("td, th"));
            for (let i = 0; i < cells.length - 1; i++) {
                const label = (cells[i].textContent || "").replace(/\s+/g, " ").trim();
                if (/^(?:제출처|장소\s*\/\s*제출처|장소|수신처|제출\s*기관|담당\s*부서)$/.test(label)) {
                    const val = (cells[i + 1].textContent || "").replace(/\s+/g, " ").trim();
                    if (val) return val.slice(0, 80);
                }
            }
        }
        const m = (plainText || "").match(/(?:제출처|장소\s*\/\s*제출처|장소|수신처|제출\s*기관)\s*[:：]\s*([^\r\n|]+)/);
        if (m && m[1]) {
            return m[1].trim().slice(0, 80);
        }
        return "";
    }

    function normalizeSmartScheduleTimeInput(el) {
        if (!el) return;
        const digits = (el.value || "").replace(/\D/g, "").slice(0, 4);
        if (digits.length === 4) {
            const hh = parseInt(digits.slice(0, 2), 10);
            const mm = parseInt(digits.slice(2, 4), 10);
            if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
                el.value = `${pad2(hh)}:${pad2(mm)}`;
            }
        }
    }

    function bindStsRichEditorEvents() {
        const elMemoEditor = document.getElementById("sts-memo-editor");
        if (!elMemoEditor || elMemoEditor._stsBound) return;
        elMemoEditor._stsBound = true;
        elMemoEditor.addEventListener("click", (e) => {
            const uiSpan = e.target.closest("li[data-list] > .ql-ui");
            if (uiSpan) {
                const li = uiSpan.parentElement;
                const cur = li.getAttribute("data-list");
                if (cur === "checked" || cur === "unchecked") {
                    li.setAttribute("data-list", cur === "checked" ? "unchecked" : "checked");
                    e.preventDefault();
                }
            }
        });
    }

    function openSendToScheduleModal() {
        if (bhAutoScheduleTimer) {
            clearTimeout(bhAutoScheduleTimer);
            bhAutoScheduleTimer = null;
        }
        const modal = document.getElementById("send-to-schedule-modal");
        if (!modal) return;

        bindStsRichEditorEvents();

        const titleInputEl = document.getElementById("memo-title-input");
        const rawTitle = (titleInputEl ? titleInputEl.value : "").trim() || "제목 없는 일정";
        const hasQuill = typeof quill !== "undefined" && quill && quill.root;
        const rawHtml = hasQuill ? getCleanQuillElementHtml(quill.root) : "";
        const plainText = hasQuill ? (quill.getText() || "").replace(/\n+$/, "") : "";
        const detectedDate = detectScheduleDateFromNote(rawTitle, plainText);
        const detectedTime = detectScheduleTimeFromText(plainText);
        const detectedLocation = detectScheduleLocationFromNote(hasQuill ? quill.root : null, plainText);

        stsSnapshot = {
            rawTitle,
            rawHtml,
            plainText
        };

        const elTitle = document.getElementById("sts-title-input");
        const elStart = document.getElementById("sts-start-date");
        const elDue = document.getElementById("sts-due-date");
        const elTime = document.getElementById("sts-time-input");
        const elLoc = document.getElementById("sts-location-input");
        const elPri = document.getElementById("sts-priority-select");
        const elMemoEditor = document.getElementById("sts-memo-editor");

        if (elTitle) elTitle.value = rawTitle;
        if (elStart) elStart.value = getLocalTodayIso();
        if (elDue) elDue.value = detectedDate;
        if (elTime) elTime.value = detectedTime;
        if (elLoc) elLoc.value = detectedLocation;
        if (elPri) elPri.value = "Normal";
        if (elMemoEditor) {
            elMemoEditor.innerHTML = rawHtml && rawHtml.trim() ? rawHtml : "<p><br></p>";
            const wrap = elMemoEditor.parentElement;
            if (wrap) wrap.scrollTop = 0;
        }

        modal.querySelectorAll('input[name="sts-rem"]').forEach((chk) => {
            const v = chk.value;
            chk.checked = (v === "h2" || v === "h1");
        });

        modal.style.display = "flex";
        try {
            history.pushState({ modal: "send-to-schedule" }, "");
        } catch { }
        setTimeout(() => {
            if (elTitle) elTitle.focus();
        }, 40);
    }

    function closeSendToScheduleModal(fromPopstate = false) {
        if (bhAutoScheduleTimer) {
            clearTimeout(bhAutoScheduleTimer);
            bhAutoScheduleTimer = null;
        }
        const modal = document.getElementById("send-to-schedule-modal");
        if (modal && modal.style.display === "flex") {
            modal.style.display = "none";
            if (!fromPopstate && window.history.state && window.history.state.modal === "send-to-schedule") {
                if (typeof programmaticBackCount !== "undefined") programmaticBackCount++;
                try {
                    window.history.back();
                } catch { }
            }
        }
    }

    function collectSendToSchedulePayload() {
        const title = (document.getElementById("sts-title-input")?.value || "").trim();
        const startDate = (document.getElementById("sts-start-date")?.value || "").trim();
        const dueDate = (document.getElementById("sts-due-date")?.value || "").trim() || startDate;
        const time = (document.getElementById("sts-time-input")?.value || "").trim();
        const location = (document.getElementById("sts-location-input")?.value || "").trim();
        const priority = document.getElementById("sts-priority-select")?.value || "Normal";
        const elMemoEditor = document.getElementById("sts-memo-editor");

        if (!title) {
            if (typeof showToast === "function") showToast("일정 제목을 입력해 주세요.");
            document.getElementById("sts-title-input")?.focus();
            return null;
        }
        if (!dueDate) {
            if (typeof showToast === "function") showToast("마감일을 선택해 주세요.");
            document.getElementById("sts-due-date")?.focus();
            return null;
        }

        const effectiveStart = startDate && startDate <= dueDate ? startDate : dueDate;
        const reminders = [];
        document.querySelectorAll('#send-to-schedule-modal input[name="sts-rem"]:checked').forEach((chk) => {
            const v = chk.value;
            if (v === "3" || v === "5") reminders.push(parseInt(v, 10));
            else reminders.push(v);
        });

        // 노트 본문(표, 그림, 코드블록, 인용구, 형광펜, 체크리스트, 링크)을 단순화 없이 100% 그대로 복사
        let finalMemo = "";
        if (elMemoEditor) {
            finalMemo = getCleanQuillElementHtml(elMemoEditor);
        } else if (stsSnapshot && stsSnapshot.rawHtml) {
            finalMemo = stsSnapshot.rawHtml;
        }

        const nowIso = new Date().toISOString();
        return {
            tasks: [
                {
                    id: "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
                    title,
                    startDate: effectiveStart,
                    dueDate,
                    time,
                    location,
                    priority,
                    ddayMode: "workday",
                    reminders,
                    tags: [],
                    memo: finalMemo,
                    completed: false,
                    order: 0,
                    createdAt: nowIso,
                    updatedAt: nowIso
                }
            ],
            recurrings: [],
            updatedAt: nowIso
        };
    }

    async function exportNoteAsDdaySchedule() {
        const ddayPayload = collectSendToSchedulePayload();
        if (!ddayPayload) return;
        const task = ddayPayload.tasks[0];
        const safeTitle = (task.title || "일정")
            .replace(/[\\/:*?"<>|]/g, "_")
            .slice(0, 60)
            .trim() || "일정";
        const fileName = `${safeTitle}_${task.dueDate}.dday`;
        const jsonString = JSON.stringify(ddayPayload, null, 2);
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });

        if (typeof saveExportBlob === "function") {
            await saveExportBlob(blob, fileName, "application/json", "MY 일정관리 파일 (*.dday)", ".dday");
        } else if (typeof saveAs === "function") {
            saveAs(blob, fileName);
            if (typeof showToast === "function") showToast(`일정 파일(${fileName})이 저장되었습니다.`);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            if (typeof showToast === "function") showToast(`일정 파일(${fileName})이 저장되었습니다.`);
        }
        closeSendToScheduleModal();
    }

    function sendNoteToScheduleDirectStub() {
        const ddayPayload = collectSendToSchedulePayload();
        if (!ddayPayload) return;
        if (typeof showToast === "function") {
            showToast("MY 일정관리 직접 등록 연동은 3단계에서 연결될 예정입니다.");
        }
    }

    // ========================================================================
    // 5. 좌측 상단 블랙홀 버튼 + NASA 골드 블랙홀 등장/꿀꺽/퇴장 껍데기
    // ========================================================================
    const BH_DEFAULT_PROMPT = "다운 받은 공문(zip파일), 쪽지, 요약하고 싶은 문서를 블랙홀에 던져 넣으세요.";
    const BH_MODE_META = {
        official: {
            label: "공문 분석",
            defaultFolding: true,
            hint: "공문 본문만 AI 전송·분석합니다(첨부 제외)."
        },
        memo: {
            label: "쪽지 분석",
            defaultFolding: true,
            hint: "쪽지 본문만 AI 전송·분석합니다(첨부 제외)."
        },
        summary: {
            label: "문서 요약",
            defaultFolding: false,
            hint: "AI가 문서를 요약해 줍니다."
        }
    };

    let bhCurrentMode = "official";
    let bhIsOpen = false;
    let bhRafId = null;
    let bhOrbitDots = [];
    let bhParticles = [];
    let bhSwallowing = false;
    let bhFlashLevel = 0;
    let bhShockProgress = 0;
    let bhShockActive = false;
    let bhHoverLevel = 0;
    let bhTargetHover = 0;
    let bhSwallowTimer1 = null;
    let bhSwallowTimer2 = null;
    let bhRetractTimer = null;

    function initBlackHoleParticles() {
        bhOrbitDots = [];
        for (let i = 0; i < 64; i++) {
            bhOrbitDots.push({
                angle: Math.random() * Math.PI * 2,
                radius: 0.43 + Math.random() * 0.42,
                speed: (0.008 + Math.random() * 0.016) * (0.7 + (1 - i / 64) * 0.6),
                size: 1.0 + Math.random() * 1.9,
                alpha: 0.35 + Math.random() * 0.65,
                hueMix: Math.random()
            });
        }
    }

    function updateBlackHoleButtonOriginVars() {
        const btn = document.getElementById("zen-blackhole-btn");
        const shell = document.getElementById("zen-blackhole-portal-shell");
        if (!shell) return;
        if (!btn) {
            shell.style.setProperty("--bh-origin-x", "-240px");
            shell.style.setProperty("--bh-origin-y", "-200px");
            return;
        }
        const rect = btn.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.round(cx - window.innerWidth / 2);
        const dy = Math.round(cy - window.innerHeight / 2);
        shell.style.setProperty("--bh-origin-x", `${dx}px`);
        shell.style.setProperty("--bh-origin-y", `${dy}px`);
    }

    function drawBlackHoleDocPacket(ctx, w, h, alpha) {
        const hw = w / 2;
        const hh = h / 2;
        const fold = Math.min(w, h) * 0.24;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(-hw, -hh);
        ctx.lineTo(hw - fold, -hh);
        ctx.lineTo(hw, -hh + fold);
        ctx.lineTo(hw, hh);
        ctx.lineTo(-hw, hh);
        ctx.closePath();
        ctx.fillStyle = "#fef9c3";
        ctx.fill();
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = Math.max(1.5, w * 0.028);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hw - fold, -hh);
        ctx.lineTo(hw - fold, -hh + fold);
        ctx.lineTo(hw, -hh + fold);
        ctx.fillStyle = "#fde047";
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = "rgba(180, 83, 9, 0.55)";
        ctx.lineWidth = Math.max(1.1, h * 0.032);
        ctx.lineCap = "round";
        const padX = w * 0.18;
        const ys = [-hh * 0.28, 0, hh * 0.28, hh * 0.54];
        ys.forEach((yy, idx) => {
            ctx.beginPath();
            ctx.moveTo(-hw + padX, yy);
            ctx.lineTo(hw - padX * (idx === 0 ? 1.8 : idx === 3 ? 1.5 : 1), yy);
            ctx.stroke();
        });
        ctx.restore();
    }

    function renderBlackHoleCanvasFrame(now) {
        const canvas = document.getElementById("zen-bh-canvas");
        if (!canvas || !bhIsOpen) {
            bhRafId = null;
            return;
        }
        const ts = typeof now === "number" ? now : performance.now();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const cw = Math.max(300, Math.round(rect.width || 400));
        const ch = Math.max(260, Math.round(rect.height || 284));
        if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
            canvas.width = cw * dpr;
            canvas.height = ch * dpr;
        }
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const cx = cw / 2;
        const cy = ch / 2;
        const maxR = Math.min(cw, ch) * 0.44;

        bhHoverLevel += (bhTargetHover - bhHoverLevel) * 0.14;
        bhFlashLevel *= 0.91;

        ctx.clearRect(0, 0, cw, ch);

        // 1. 외곽 깊은 우주 헤일로
        const halo = ctx.createRadialGradient(cx, cy, maxR * 0.24, cx, cy, maxR);
        halo.addColorStop(0, "rgba(0, 0, 0, 0.96)");
        halo.addColorStop(0.45, "rgba(18, 12, 5, 0.86)");
        halo.addColorStop(0.75, `rgba(217, 119, 6, ${0.24 + bhHoverLevel * 0.14 + bhFlashLevel * 0.28})`);
        halo.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
        ctx.fill();

        // 2. 후면 상/하 중력렌즈 아크
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.22);
        for (const side of [-1, 1]) {
            const lensGrad = ctx.createLinearGradient(-maxR * 0.55, 0, maxR * 0.55, 0);
            lensGrad.addColorStop(0, "rgba(251, 191, 36, 0)");
            lensGrad.addColorStop(0.5, `rgba(253, 224, 71, ${0.44 + bhHoverLevel * 0.25})`);
            lensGrad.addColorStop(1, "rgba(251, 191, 36, 0)");
            ctx.strokeStyle = lensGrad;
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.arc(0, side * 1.5, maxR * 0.42, side > 0 ? 0.18 : Math.PI + 0.18, side > 0 ? Math.PI - 0.18 : Math.PI * 2 - 0.18);
            ctx.stroke();
        }
        ctx.restore();

        // 3. 기울어진 NASA 골드 강착원반 & 궤도 입자
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.26);
        const diskScaleY = 0.31;
        const speedBoost = 1 + bhHoverLevel * 1.9 + (bhSwallowing ? 1.4 : 0);

        for (const p of bhOrbitDots) {
            p.angle += p.speed * speedBoost;
            const px = Math.cos(p.angle) * (maxR * p.radius);
            const py = Math.sin(p.angle) * (maxR * p.radius * diskScaleY);
            const isFront = Math.sin(p.angle) >= 0;
            if (!isFront && Math.hypot(px, py) < maxR * 0.34) continue;
            const bright = Math.min(1, p.alpha + bhFlashLevel * 0.4);
            ctx.fillStyle = p.hueMix > 0.38
                ? `rgba(253, 224, 71, ${bright})`
                : `rgba(245, 158, 11, ${bright * 0.9})`;
            ctx.beginPath();
            ctx.arc(px, py, p.size * (isFront ? 1.15 : 0.85), 0, Math.PI * 2);
            ctx.fill();
        }

        // 강착원반 밝은 링 레이어
        ctx.scale(1, diskScaleY);
        const diskRing = ctx.createRadialGradient(0, 0, maxR * 0.36, 0, 0, maxR * 0.9);
        diskRing.addColorStop(0, "rgba(254, 240, 138, 0)");
        diskRing.addColorStop(0.24, `rgba(254, 243, 199, ${0.72 + bhFlashLevel * 0.25})`);
        diskRing.addColorStop(0.55, `rgba(245, 158, 11, ${0.46 + bhHoverLevel * 0.18})`);
        diskRing.addColorStop(1, "rgba(180, 83, 9, 0)");
        ctx.fillStyle = diskRing;
        ctx.beginPath();
        ctx.arc(0, 0, maxR * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 4. 사상의 지평선(중앙 블랙 코어) + 광자 링
        const coreR = maxR * 0.33;
        ctx.save();
        ctx.fillStyle = "#03050a";
        ctx.shadowColor = `rgba(253, 224, 71, ${0.85 + bhFlashLevel * 0.15})`;
        ctx.shadowBlur = 16 + bhHoverLevel * 10 + bhFlashLevel * 18;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(254, 240, 138, ${0.88 + bhFlashLevel * 0.12})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR + 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 5. 투입 문서 (시작 5배: 80x100 -> 끝 2배: 32x40, 1.2초, 2차함수 t^2 가속)
        for (let i = bhParticles.length - 1; i >= 0; i--) {
            const pk = bhParticles[i];
            if (ts < pk.startTime) continue;
            const elapsed = ts - pk.startTime;
            const t = Math.min(1, Math.max(0, elapsed / pk.duration));
            const eased = t * t;
            const r = pk.startR * (1 - eased);
            const a = pk.startAngle + eased * Math.PI * 2.15;
            const px = cx + Math.cos(a) * r;
            const py = cy + Math.sin(a) * r * 0.72;
            const docW = 80 - (80 - 32) * eased;
            const docH = 100 - (100 - 40) * eased;
            const alpha = t < 0.88 ? 0.96 : Math.max(0, 0.96 * (1 - (t - 0.88) / 0.12));

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(eased * 1.45 - 0.18);
            drawBlackHoleDocPacket(ctx, docW, docH, alpha);
            ctx.restore();

            if (t >= 1) {
                bhParticles.splice(i, 1);
                bhFlashLevel = 1.0;
                bhShockActive = true;
                bhShockProgress = 0;
            }
        }

        // 6. 충격파 링
        if (bhShockActive) {
            bhShockProgress += 0.038;
            if (bhShockProgress >= 1) {
                bhShockActive = false;
            } else {
                const sr = coreR + bhShockProgress * (maxR - coreR);
                ctx.strokeStyle = `rgba(254, 240, 138, ${(1 - bhShockProgress) * 0.75})`;
                ctx.lineWidth = 2.4 * (1 - bhShockProgress) + 0.6;
                ctx.beginPath();
                ctx.arc(cx, cy, sr, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        bhRafId = requestAnimationFrame(renderBlackHoleCanvasFrame);
    }

    function setBlackHoleMode(modeKey) {
        const meta = BH_MODE_META[modeKey] || BH_MODE_META.official;
        bhCurrentMode = BH_MODE_META[modeKey] ? modeKey : "official";

        const layer = document.getElementById("zen-blackhole-portal-layer");
        if (!layer) return;
        layer.querySelectorAll(".zen-bh-mode-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.getAttribute("data-bh-mode") === bhCurrentMode);
        });
        const foldToggle = document.getElementById("zen-bh-folding-toggle");
        if (foldToggle) foldToggle.checked = !!meta.defaultFolding;
        const hintEl = document.getElementById("zen-bh-mode-hint");
        if (hintEl) hintEl.textContent = meta.hint;
    }

    function clearBlackHoleTimers() {
        clearTimeout(bhSwallowTimer1);
        clearTimeout(bhSwallowTimer2);
        clearTimeout(bhRetractTimer);
        bhSwallowTimer1 = null;
        bhSwallowTimer2 = null;
        bhRetractTimer = null;
    }

    function openBlackHolePortal() {
        const layer = document.getElementById("zen-blackhole-portal-layer");
        const shell = document.getElementById("zen-blackhole-portal-shell");
        const btn = document.getElementById("zen-blackhole-btn");
        if (!layer || !shell) return;

        clearBlackHoleTimers();
        if (bhOrbitDots.length === 0) initBlackHoleParticles();
        bhSwallowing = false;
        bhParticles = [];
        bhFlashLevel = 0;
        bhShockActive = false;
        bhTargetHover = 0;

        setBlackHoleMode(bhCurrentMode || "official");
        const pill = document.getElementById("zen-bh-status-pill");
        if (pill) pill.textContent = BH_DEFAULT_PROMPT;

        updateBlackHoleButtonOriginVars();
        shell.classList.remove("is-retracting");
        shell.classList.add("is-origin");
        layer.style.display = "flex";
        void shell.offsetWidth;
        shell.classList.remove("is-origin");

        bhIsOpen = true;
        if (btn) btn.classList.add("is-active");
        if (!bhRafId) bhRafId = requestAnimationFrame(renderBlackHoleCanvasFrame);

        try {
            history.pushState({ modal: "blackhole-portal" }, "");
        } catch { }
    }

    function closeBlackHolePortal(fromPopstate = false) {
        const layer = document.getElementById("zen-blackhole-portal-layer");
        const shell = document.getElementById("zen-blackhole-portal-shell");
        const btn = document.getElementById("zen-blackhole-btn");
        if (!layer || layer.style.display === "none") return;

        clearTimeout(bhSwallowTimer1);
        clearTimeout(bhSwallowTimer2);
        bhSwallowTimer1 = null;
        bhSwallowTimer2 = null;
        bhSwallowing = false;
        bhIsOpen = false;
        if (bhRafId) {
            cancelAnimationFrame(bhRafId);
            bhRafId = null;
        }
        if (btn) btn.classList.remove("is-active");

        if (shell) {
            updateBlackHoleButtonOriginVars();
            shell.classList.add("is-retracting");
            clearTimeout(bhRetractTimer);
            bhRetractTimer = setTimeout(() => {
                if (!bhIsOpen) {
                    layer.style.display = "none";
                    shell.classList.remove("is-retracting");
                }
            }, 560);
        } else {
            layer.style.display = "none";
        }

        if (!fromPopstate && window.history.state && window.history.state.modal === "blackhole-portal") {
            if (typeof programmaticBackCount !== "undefined") programmaticBackCount++;
            try {
                window.history.back();
            } catch { }
        }
    }

    function toggleBlackHolePortal() {
        if (bhIsOpen) closeBlackHolePortal();
        else openBlackHolePortal();
    }

    function isBlackHolePortalOpen() {
        return !!bhIsOpen;
    }

    async function buildBlackHoleSummaryResult(list, modeKey, foldChecked, isDemo) {
        const firstItem = (Array.isArray(list) && list[0]) ? list[0] : { name: "온나라_공문_시연.zip" };
        const rawFileName = String(firstItem.name || "문서").trim();
        const baseName = rawFileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim() || "문서";
        const dParts = getOffsetDateParts(5);

        let rawFileText = "";
        try {
            if (!isDemo && firstItem && typeof firstItem.text === "function" && /\.(txt|md|html|csv|json)$/i.test(rawFileName)) {
                rawFileText = (await firstItem.text()) || "";
            }
        } catch { }

        const folderBasePath = modeKey === "memo" ? "D:\\MY_Apps\\쪽지\\" : "D:\\MY_Apps\\공문\\";
        const folderPath = `${folderBasePath}${dParts.compact}_${baseName.replace(/\s+/g, "_")}`;
        const docFilePath = `${folderPath}\\${rawFileName}`;

        if (modeKey === "official") {
            const docSubject = isDemo
                ? "2026년 하반기 정보보안 및 개인정보 보호 점검 결과 제출"
                : baseName;
            const noteTitle = `${docSubject} (${dParts.compact}까지)`;
            const submitTarget = "행정과 정보통신담당 (온나라 공문 회신)";
            const html = [
                `<p><strong>[MY AI 공문 분석 요약]</strong></p>`,
                `<blockquote>전 부서 업무용 PC 및 내부망 단말기에 대한 <span style="background-color: rgb(254, 240, 138);">하반기 정보보안 점검 결과를 ${escapeHtmlStr(dParts.zenDate)} 18:00까지 제출</span> 요청하는 공문입니다.</blockquote>`,
                `<p><br></p>`,
                `<table><tbody>`,
                `<tr><td><strong>문서 구분</strong></td><td>정식 공문 (${escapeHtmlStr(rawFileName)})</td></tr>`,
                `<tr><td><strong>제출 기한</strong></td><td>${escapeHtmlStr(dParts.zenDate)} 18:00까지</td></tr>`,
                `<tr><td><strong>제출처</strong></td><td>${escapeHtmlStr(submitTarget)}</td></tr>`,
                `<tr><td><strong>핵심 과제</strong></td><td>부서별 점검표(붙임1) 작성 및 미비 사항 조치 결과 회신</td></tr>`,
                `</tbody></table>`,
                `<p><br></p>`,
                `<p><strong>주요 실무 조치 사항</strong></p>`,
                `<ol>`,
                `<li data-list="unchecked"><span class="ql-ui" contenteditable="false"></span>백신 실시간 감시 및 최신 엔진 업데이트 상태 확인</li>`,
                `<li data-list="unchecked"><span class="ql-ui" contenteditable="false"></span>화면보호기 자동 잠금(10분 이내) 및 부팅 암호 설정 점검</li>`,
                `<li data-list="unchecked"><span class="ql-ui" contenteditable="false"></span>점검표 취합 후 기한 내 온나라 공문 회신</li>`,
                `</ol>`,
                foldChecked
                    ? `<p><br></p><p><strong>원본 및 폴더 바로가기</strong>: <a href="${escapeHtmlStr(docFilePath)}" target="_blank" rel="noopener noreferrer">공문 열기</a>  |  <a href="${escapeHtmlStr(folderPath)}" target="_blank" rel="noopener noreferrer">폴더 열기</a></p>`
                    : ""
            ].join("");
            return { title: noteTitle, html };
        }

        if (modeKey === "memo") {
            const memoSubject = isDemo
                ? "주간 주요업무 추진실적 및 계획 자료 협조 요청"
                : baseName;
            const noteTitle = `${memoSubject} (${dParts.compact}까지)`;
            const submitTarget = "기획감사담당관 기획담당 (내부 메신저 쪽지 회신)";
            const excerpt = rawFileText
                ? escapeHtmlStr(rawFileText.trim().split(/\r?\n/).slice(0, 3).join(" "))
                : "부서별 주간 주요업무 추진실적 및 차주 계획 핵심 항목을 서식에 맞춰 회신 요청합니다.";
            const html = [
                `<p><strong>[MY AI 수신 쪽지 분석 요약]</strong></p>`,
                `<blockquote>${excerpt} <span style="background-color: rgb(254, 240, 138);">마감 기한은 ${escapeHtmlStr(dParts.zenDate)} 14:00까지</span>입니다.</blockquote>`,
                `<p><br></p>`,
                `<table><tbody>`,
                `<tr><td><strong>문서 구분</strong></td><td>수신 쪽지 (${escapeHtmlStr(rawFileName)})</td></tr>`,
                `<tr><td><strong>제출 기한</strong></td><td>${escapeHtmlStr(dParts.zenDate)} 14:00까지</td></tr>`,
                `<tr><td><strong>제출처</strong></td><td>${escapeHtmlStr(submitTarget)}</td></tr>`,
                `<tr><td><strong>핵심 과제</strong></td><td>부서 주간 추진실적 3건 이내 요약 작성 및 쪽지 회신</td></tr>`,
                `</tbody></table>`,
                `<p><br></p>`,
                `<p><strong>체크리스트</strong></p>`,
                `<ol>`,
                `<li data-list="unchecked"><span class="ql-ui" contenteditable="false"></span>금주 추진실적 수치 및 일자 현행화</li>`,
                `<li data-list="unchecked"><span class="ql-ui" contenteditable="false"></span>담당자 검토 후 기한 내 회신 완료</li>`,
                `</ol>`,
                foldChecked
                    ? `<p><br></p><p><strong>원본 및 폴더 바로가기</strong>: <a href="${escapeHtmlStr(docFilePath)}" target="_blank" rel="noopener noreferrer">쪽지 열기</a>  |  <a href="${escapeHtmlStr(folderPath)}" target="_blank" rel="noopener noreferrer">폴더 열기</a></p>`
                    : ""
            ].join("");
            return { title: noteTitle, html };
        }

        // summary (문서 요약)
        const sumSubject = isDemo
            ? "2026년 스마트 행정업무 효율화 추진계획 요약"
            : `${baseName} 요약`;
        const noteTitle = `${sumSubject} (${dParts.compact}까지)`;
        const submitTarget = "스마트행정추진단 (검토 보고)";
        const html = [
            `<p><strong>[MY AI 문서 핵심 요약]</strong></p>`,
            `<blockquote>반복적인 공문·쪽지 분류와 일정 등록 업무를 <span style="background-color: rgb(254, 240, 138);">MY 노트 · MY 일정관리 · MY AI 연동으로 자동화</span>하여 행정 처리 시간을 단축하는 계획입니다.</blockquote>`,
            `<p><br></p>`,
            `<table><tbody>`,
            `<tr><td><strong>대상 문서</strong></td><td>${escapeHtmlStr(rawFileName)}</td></tr>`,
            `<tr><td><strong>검토 기한</strong></td><td>${escapeHtmlStr(dParts.zenDate)} 18:00까지</td></tr>`,
            `<tr><td><strong>제출처</strong></td><td>${escapeHtmlStr(submitTarget)}</td></tr>`,
            `<tr><td><strong>핵심 요약</strong></td><td>자동 폴더링 · 본문 AI 요약 · 일정관리 원클릭 연계</td></tr>`,
            `</tbody></table>`,
            `<p><br></p>`,
            `<p><strong>핵심 포인트</strong></p>`,
            `<ol>`,
            `<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>공문 및 쪽지 원본·첨부 자동 분류 보관으로 문서 탐색 시간 단축</li>`,
            `<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>본문 중심 AI 요약 후 새 노트 즉시 생성 및 일정관리 자동 연계</li>`,
            `</ol>`,
            foldChecked
                ? `<p><br></p><p><strong>원본 및 폴더 바로가기</strong>: <a href="${escapeHtmlStr(docFilePath)}" target="_blank" rel="noopener noreferrer">문서 열기</a>  |  <a href="${escapeHtmlStr(folderPath)}" target="_blank" rel="noopener noreferrer">폴더 열기</a></p>`
                : ""
        ].join("");
        return { title: noteTitle, html };
    }

    function openBlackHoleSummaryInNewNote(summaryResult) {
        if (!summaryResult) return;

        const fmPane = document.getElementById("file-manager-pane");
        if (fmPane && fmPane.style.display !== "none" && typeof closeFileManager === "function") {
            closeFileManager();
        }

        if (typeof createNewMemoSmart === "function") {
            createNewMemoSmart();
        } else if (typeof createNewMemo === "function") {
            const fallbackFolder = typeof globalDesktopFolderId !== "undefined" ? globalDesktopFolderId : null;
            createNewMemo(fallbackFolder);
        }

        const applyContent = () => {
            if (typeof isLoading !== "undefined") isLoading = false;
            const titleInput = document.getElementById("memo-title-input");
            if (titleInput) titleInput.value = summaryResult.title || "AI 요약 노트";
            document.title = summaryResult.title || "AI 요약 노트";

            if (typeof quill !== "undefined" && quill && quill.root) {
                quill.root.innerHTML = summaryResult.html || "<p><br></p>";
                if (quill.history && typeof quill.history.clear === "function") {
                    quill.history.clear();
                }
            }
            if (typeof executeSave === "function") {
                executeSave();
            }
        };

        applyContent();
        setTimeout(applyContent, 35);
    }

    async function triggerBlackHoleSwallow(items, isDemo = false) {
        if (!bhIsOpen || bhSwallowing) return;
        const list = Array.isArray(items) && items.length > 0 ? items : [{ name: "테스트_공문.zip" }];
        const meta = BH_MODE_META[bhCurrentMode] || BH_MODE_META.official;
        const foldChecked = !!document.getElementById("zen-bh-folding-toggle")?.checked;
        const pill = document.getElementById("zen-bh-status-pill");

        clearTimeout(bhSwallowTimer1);
        clearTimeout(bhSwallowTimer2);
        if (bhAutoScheduleTimer) {
            clearTimeout(bhAutoScheduleTimer);
            bhAutoScheduleTimer = null;
        }
        bhSwallowing = true;
        const firstName = list[0] && list[0].name ? list[0].name : "문서";
        const extra = list.length > 1 ? ` 외 ${list.length - 1}건` : "";

        const count = Math.min(list.length, 5);
        const nowTs = performance.now();
        const duration = 1200;
        const stagger = 90;
        for (let i = 0; i < count; i++) {
            bhParticles.push({
                startTime: nowTs + i * stagger,
                duration,
                startAngle: -2.35 + i * 0.85,
                startR: 138 + i * 10
            });
        }

        if (pill) {
            pill.textContent = `${firstName}${extra} 투입 중 (${meta.label} · 폴더링 ${foldChecked ? "ON" : "OFF"})`;
        }

        const totalSwallowMs = duration + (count - 1) * stagger + 40;
        // AI 응답이 일찍 도착하더라도 문서 흡수(1.2초) + 코어 분석 연출을 위한 기본 대기 시간 보장
        const minWaitMs = Math.max(2100, totalSwallowMs + 860);

        bhSwallowTimer1 = setTimeout(() => {
            if (!bhIsOpen) return;
            if (pill) {
                pill.textContent = `${meta.label} AI 응답 수신 및 요약 노트 생성 중...`;
            }
        }, totalSwallowMs);

        const analysisPromise = buildBlackHoleSummaryResult(list, bhCurrentMode, foldChecked, isDemo);
        const minWaitPromise = new Promise((resolve) => {
            bhSwallowTimer2 = setTimeout(resolve, minWaitMs);
        });

        const [summaryResult] = await Promise.all([analysisPromise, minWaitPromise]);
        if (!bhIsOpen) return;

        bhSwallowing = false;
        closeBlackHolePortal();
        openBlackHoleSummaryInNewNote(summaryResult);

        if (typeof showToast === "function") {
            const prefix = isDemo ? "[블랙홀 시연] " : "";
            showToast(`${prefix}${meta.label} 요약 노트가 생성되었습니다.`);
        }

        // 새 요약 문서가 나타난 뒤 정확히 1.2초 후에 'MY 일정관리로 보내기' 팝업 자동 실행
        bhAutoScheduleTimer = setTimeout(() => {
            bhAutoScheduleTimer = null;
            openSendToScheduleModal();
        }, 1200);
    }

    function handleBlackHoleDroppedFiles(files) {
        const arr = Array.from(files || []);
        if (arr.length === 0) return;
        triggerBlackHoleSwallow(arr, false);
    }

    function triggerBlackHoleFilePick() {
        if (bhSwallowing) return;
        const input = document.getElementById("zen-bh-file-input");
        if (input) {
            input.value = "";
            input.click();
        }
    }

    function demoBlackHoleSwallow() {
        const sampleName =
            bhCurrentMode === "official"
                ? "온나라_공문_시연.zip"
                : bhCurrentMode === "memo"
                    ? "수신쪽지_시연.txt"
                    : "업무계획서_요약시연.pdf";
        triggerBlackHoleSwallow([{ name: sampleName }], true);
    }

    function bindBlackHoleEvents() {
        const dropZone = document.getElementById("zen-bh-orb-dropzone");
        const fileInput = document.getElementById("zen-bh-file-input");
        if (dropZone && !dropZone._bhBound) {
            dropZone._bhBound = true;
            dropZone.addEventListener("dragenter", (e) => {
                e.preventDefault();
                bhTargetHover = 1;
                dropZone.classList.add("is-drag-hover");
            });
            dropZone.addEventListener("dragover", (e) => {
                e.preventDefault();
                bhTargetHover = 1;
                dropZone.classList.add("is-drag-hover");
            });
            dropZone.addEventListener("dragleave", () => {
                bhTargetHover = 0;
                dropZone.classList.remove("is-drag-hover");
            });
            dropZone.addEventListener("drop", (e) => {
                e.preventDefault();
                e.stopPropagation();
                bhTargetHover = 0;
                dropZone.classList.remove("is-drag-hover");
                const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
                if (files.length > 0) handleBlackHoleDroppedFiles(files);
            });
        }
        if (fileInput && !fileInput._bhBound) {
            fileInput._bhBound = true;
            fileInput.addEventListener("change", (e) => {
                const files = e.target && e.target.files ? Array.from(e.target.files) : [];
                if (files.length > 0) handleBlackHoleDroppedFiles(files);
            });
        }
        window.addEventListener("resize", () => {
            if (bhIsOpen) updateBlackHoleButtonOriginVars();
        });
    }

    // 전역 노출
    window.runNotesSilentAutoBackup = runNotesSilentAutoBackup;
    window.pickNotesAutoBackupDirectory = pickNotesAutoBackupDirectory;
    window.openNotesAutoBackupFolder = openNotesAutoBackupFolder;
    window.runNotesAutoBackupNow = runNotesAutoBackupNow;
    window.refreshNotesAutoBackupSettingsUI = refreshNotesAutoBackupSettingsUI;

    window.syncMyAiApiKeySettingsUI = syncMyAiApiKeySettingsUI;
    window.toggleMyAiApiKeyVisibility = toggleMyAiApiKeyVisibility;
    window.saveMyAiApiKey = saveMyAiApiKey;

    window.openSendToScheduleModal = openSendToScheduleModal;
    window.closeSendToScheduleModal = closeSendToScheduleModal;
    window.normalizeSmartScheduleTimeInput = normalizeSmartScheduleTimeInput;
    window.exportNoteAsDdaySchedule = exportNoteAsDdaySchedule;
    window.sendNoteToScheduleDirectStub = sendNoteToScheduleDirectStub;

    window.toggleBlackHolePortal = toggleBlackHolePortal;
    window.openBlackHolePortal = openBlackHolePortal;
    window.closeBlackHolePortal = closeBlackHolePortal;
    window.isBlackHolePortalOpen = isBlackHolePortalOpen;
    window.setBlackHoleMode = setBlackHoleMode;
    window.handleBlackHoleDroppedFiles = handleBlackHoleDroppedFiles;
    window.triggerBlackHoleFilePick = triggerBlackHoleFilePick;
    window.demoBlackHoleSwallow = demoBlackHoleSwallow;

    window.addEventListener("DOMContentLoaded", () => {
        bindBlackHoleEvents();
        initNotesAutoBackupScheduler();
    });
    if (document.readyState === "interactive" || document.readyState === "complete") {
        bindBlackHoleEvents();
        initNotesAutoBackupScheduler();
    }
})();
