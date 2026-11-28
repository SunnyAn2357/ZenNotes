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

    function getSavedMyAiApiKey() {
        return (localStorage.getItem(MYAI_KEY_STORAGE_KEY) || "").trim();
    }

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

    function getLocalTodayCompact() {
        const d = new Date();
        return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
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
        const explicitMatch = combined.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?\s*(?:(?:\([일월화수목금토]\))|[일월화수목금토]요일)?\s*(?:\d{1,2}:\d{2})?\s*(?:까지|마감|기한|제출)/);
        if (explicitMatch) {
            return `${explicitMatch[1]}-${pad2(explicitMatch[2])}-${pad2(explicitMatch[3])}`;
        }
        const ymdMatch = combined.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
        if (ymdMatch) {
            return `${ymdMatch[1]}-${pad2(ymdMatch[2])}-${pad2(ymdMatch[3])}`;
        }
        return "";
    }

    function extractTimeTokenFromSnippet(snippet) {
        const text = String(snippet || "");
        if (!text) return "";
        const m = text.match(/(?:오전|오후)?\s*(?<!\d)(\d{1,2})\s*:\s*(\d{2})(?!\d)|(?:오전|오후)\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?/);
        if (!m) return "";
        let h = parseInt(m[1] || m[3], 10);
        const min = parseInt(m[2] || m[4] || "0", 10);
        if (isNaN(h) || isNaN(min) || min < 0 || min > 59) return "";
        if (/오후/.test(m[0]) && h >= 1 && h <= 11) h += 12;
        if (/오전/.test(m[0]) && h === 12) h = 0;
        if (h < 0 || h > 23) return "";
        return `${pad2(h)}:${pad2(min)}`;
    }

    function detectScheduleTimeFromNote(rootEl, plainText, detectedDate) {
        const timeHeaderRe = /^(?:일정\s*\/\s*기한|일시|기한|마감\s*일시|마감일|시간)$/;
        if (rootEl) {
            const tables = Array.from(rootEl.querySelectorAll("table"));
            for (const tbl of tables) {
                const rows = Array.from(tbl.querySelectorAll("tr"));
                for (let r = 0; r < rows.length; r++) {
                    const rowCells = Array.from(rows[r].querySelectorAll("td, th"));
                    for (let c = 0; c < rowCells.length; c++) {
                        const cell = rowCells[c];
                        const label = (cell.textContent || "").replace(/\s+/g, " ").trim();
                        if (!timeHeaderRe.test(label)) continue;

                        const nextRow = rows[r + 1];
                        const isColumnHeaderRow =
                            !!nextRow &&
                            (rowCells.length >= 3 || cell.tagName === "TH" || !!cell.querySelector("strong"));
                        if (isColumnHeaderRow) {
                            const belowCells = Array.from(nextRow.querySelectorAll("td, th"));
                            if (belowCells[c]) {
                                const t = extractTimeTokenFromSnippet(belowCells[c].textContent || "");
                                if (t) return t;
                            }
                            continue;
                        }

                        if (rowCells.length === 2 && c === 0 && rowCells[1]) {
                            const t = extractTimeTokenFromSnippet(rowCells[1].textContent || "");
                            if (t) return t;
                        }
                    }
                }
            }
        }

        if (!detectedDate) return "";

        const text = String(plainText || "");
        const afterDateMatch = text.match(/\d{4}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}일?(?:\s*(?:\([일월화수목금토]\)|[일월화수목금토]요일))?\s*(?:(?:오전|오후)\s*)?(?:(?<!\d)\d{1,2}\s*:\s*\d{2}(?!\d)|\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?)/);
        if (afterDateMatch) {
            const t = extractTimeTokenFromSnippet(afterDateMatch[0]);
            if (t) return t;
        }

        const labelMatch = text.match(/(?:일시|시간|마감|기한|개최|회의|제출)\s*[:：]\s*[^\r\n]{0,30}/);
        if (labelMatch) {
            const t = extractTimeTokenFromSnippet(labelMatch[0]);
            if (t) return t;
        }

        const deadlineMatch = text.match(/(?:(?:오전|오후)\s*)?(?:(?<!\d)\d{1,2}\s*:\s*\d{2}(?!\d)|\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?)\s*(?:까지|마감|시작|예정|개최|제출)/);
        if (deadlineMatch) {
            const t = extractTimeTokenFromSnippet(deadlineMatch[0]);
            if (t) return t;
        }

        return "";
    }

    function detectScheduleTimeFromText(plainText) {
        return detectScheduleTimeFromNote(null, plainText, "1");
    }

    function detectScheduleLocationFromNote(rootEl, plainText) {
        const locationLabelRe = /^(?:제출처|장소\s*\/\s*제출처|장소|수신처|제출\s*기관|담당\s*부서)$/;
        const headerIgnoreRe = /^(?:문서명|일정\s*\/\s*기한|핵심\s*내용|제출처|장소\s*\/\s*제출처|장소|수신처|제출\s*기관|담당\s*부서)$/;
        if (rootEl) {
            const tables = Array.from(rootEl.querySelectorAll("table"));
            for (const tbl of tables) {
                const rows = Array.from(tbl.querySelectorAll("tr"));
                for (let r = 0; r < rows.length; r++) {
                    const rowCells = Array.from(rows[r].querySelectorAll("td, th"));
                    for (let c = 0; c < rowCells.length; c++) {
                        const cell = rowCells[c];
                        const label = (cell.textContent || "").replace(/\s+/g, " ").trim();
                        if (!locationLabelRe.test(label)) continue;

                        const nextRow = rows[r + 1];
                        const isColumnHeaderRow =
                            !!nextRow &&
                            (rowCells.length >= 3 || cell.tagName === "TH" || !!cell.querySelector("strong"));
                        if (isColumnHeaderRow) {
                            const belowCells = Array.from(nextRow.querySelectorAll("td, th"));
                            if (belowCells[c]) {
                                const belowVal = (belowCells[c].textContent || "").replace(/\s+/g, " ").trim();
                                if (belowVal && belowVal !== "-" && !headerIgnoreRe.test(belowVal)) {
                                    return belowVal.slice(0, 80);
                                }
                            }
                            continue;
                        }

                        if (rowCells.length === 2 && c === 0 && rowCells[1]) {
                            const sideVal = (rowCells[1].textContent || "").replace(/\s+/g, " ").trim();
                            if (sideVal && sideVal !== "-" && !headerIgnoreRe.test(sideVal)) {
                                return sideVal.slice(0, 80);
                            }
                        }
                    }
                }
            }
        }
        const m = (plainText || "").match(/(?:제출처|장소\s*\/\s*제출처|장소|수신처|제출\s*기관)\s*[:：]\s*([^\r\n|]+)/);
        if (m && m[1]) {
            const cleaned = m[1].trim();
            if (cleaned && cleaned !== "-") return cleaned.slice(0, 80);
        }
        return "";
    }

    function formatIsoToKoreanScheduleDate(dateStr) {
        const s = String(dateStr || "").trim();
        if (!s) return "";
        let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (!m) m = s.match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
        if (!m) return s;
        return `${m[1]}년 ${pad2(parseInt(m[2], 10))}월 ${pad2(parseInt(m[3], 10))}일`;
    }

    function parseKoreanScheduleDateToIso(dateStr) {
        const s = String(dateStr || "").trim();
        if (!s) return "";
        let yyyy = 0, mm = 0, dd = 0;
        let m = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/);
        if (!m) m = s.match(/^(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})$/);
        if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (!m) return "";
        yyyy = parseInt(m[1], 10);
        mm = parseInt(m[2], 10);
        dd = parseInt(m[3], 10);
        if (yyyy < 1900 || yyyy > 2199 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
        const dt = new Date(yyyy, mm - 1, dd);
        if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return "";
        return `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
    }

    function normalizeSmartScheduleDateInput(el) {
        if (!el) return;
        const raw = String(el.value || "");
        const prev = String(el._prevDateVal || "");
        let digits = raw.replace(/\D/g, "").slice(0, 8);

        // 백스페이스로 '년'/'월'/'일'/공백 단위 문자가 지워졌을 때 직전 숫자도 함께 삭제해 삭제 막힘 방지
        if (raw.length < prev.length && digits.length > 0 && digits.length === prev.replace(/\D/g, "").length) {
            digits = digits.slice(0, -1);
        }

        let formatted = "";
        if (digits.length === 0) {
            formatted = "";
        } else if (digits.length < 4) {
            formatted = digits;
        } else if (digits.length === 4) {
            formatted = `${digits}년 `;
        } else if (digits.length < 6) {
            formatted = `${digits.slice(0, 4)}년 ${digits.slice(4)}`;
        } else if (digits.length === 6) {
            formatted = `${digits.slice(0, 4)}년 ${digits.slice(4, 6)}월 `;
        } else if (digits.length < 8) {
            formatted = `${digits.slice(0, 4)}년 ${digits.slice(4, 6)}월 ${digits.slice(6)}`;
        } else {
            formatted = `${digits.slice(0, 4)}년 ${digits.slice(4, 6)}월 ${digits.slice(6, 8)}일`;
        }

        if (el.value !== formatted) {
            el.value = formatted;
        }
        el._prevDateVal = formatted;
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

    function bindStsInputAutoSelectEvents() {
        const ids = ["sts-title-input", "sts-start-date", "sts-due-date", "sts-time-input", "sts-location-input"];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (!el || el._stsAutoSelectBound) return;
            el._stsAutoSelectBound = true;
            el.addEventListener("focus", () => {
                el._stsJustFocused = true;
                setTimeout(() => {
                    try { el.select(); } catch { }
                }, 0);
            });
            el.addEventListener("mouseup", (e) => {
                if (el._stsJustFocused) {
                    e.preventDefault();
                    el._stsJustFocused = false;
                    try { el.select(); } catch { }
                }
            });
            el.addEventListener("blur", () => {
                el._stsJustFocused = false;
            });
        });
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
                return;
            }

            const anchor = e.target.closest("a");
            if (!anchor) return;
            const rawHref = (anchor.getAttribute("href") || "").trim();
            if (!rawHref) return;

            e.preventDefault();
            e.stopPropagation();

            if (typeof openLocalOrExternalLink === "function" && openLocalOrExternalLink(rawHref)) {
                return;
            }
            if (isDesktopWebViewEnv()) {
                try {
                    window.chrome.webview.postMessage(JSON.stringify({ type: "openExternalUrl", url: rawHref }));
                } catch { }
                return;
            }
            if (/^(https?:\/\/|mailto:)/i.test(rawHref)) {
                window.open(rawHref, "_blank", "noopener,noreferrer");
                return;
            }
            if (typeof showToast === "function") {
                showToast("로컬 파일 및 폴더 열기는 데스크톱 MY 노트 앱에서 지원됩니다.");
            }
        });
    }

    function cancelPendingBlackHoleAutoSchedule() {
        if (bhAutoScheduleTimer) {
            clearTimeout(bhAutoScheduleTimer);
            bhAutoScheduleTimer = null;
        }
    }

    function openSendToScheduleModal() {
        cancelPendingBlackHoleAutoSchedule();
        if (typeof isAppScreenLocked === "function" && isAppScreenLocked()) {
            return;
        }
        const modal = document.getElementById("send-to-schedule-modal");
        if (!modal) return;

        bindStsRichEditorEvents();
        bindStsInputAutoSelectEvents();

        const titleInputEl = document.getElementById("memo-title-input");
        const rawTitle = (titleInputEl ? titleInputEl.value : "").trim() || "제목 없는 일정";
        const hasQuill = typeof quill !== "undefined" && quill && quill.root;
        const rawHtml = hasQuill ? getCleanQuillElementHtml(quill.root) : "";
        const plainText = hasQuill ? (quill.getText() || "").replace(/\n+$/, "") : "";
        const detectedDate = detectScheduleDateFromNote(rawTitle, plainText);
        const detectedTime = detectScheduleTimeFromNote(hasQuill ? quill.root : null, plainText, detectedDate);
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

        const curYearPh = `${new Date().getFullYear()}년 01월 01일`;
        const formattedDetectedDate = detectedDate ? formatIsoToKoreanScheduleDate(detectedDate) : "";

        if (elTitle) elTitle.value = rawTitle;
        if (elStart) {
            elStart.placeholder = curYearPh;
            elStart.value = formattedDetectedDate;
            elStart._prevDateVal = formattedDetectedDate;
        }
        if (elDue) {
            elDue.placeholder = curYearPh;
            elDue.value = formattedDetectedDate;
            elDue._prevDateVal = formattedDetectedDate;
        }
        if (elTime) {
            elTime.placeholder = "09:10";
            elTime.value = detectedTime;
        }
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
        const elStart = document.getElementById("sts-start-date");
        const elDue = document.getElementById("sts-due-date");
        const elTime = document.getElementById("sts-time-input");
        if (elStart) normalizeSmartScheduleDateInput(elStart);
        if (elDue) normalizeSmartScheduleDateInput(elDue);
        if (elTime) normalizeSmartScheduleTimeInput(elTime);

        const rawStart = (elStart?.value || "").trim();
        const rawDue = (elDue?.value || "").trim();
        const startDate = rawStart ? parseKoreanScheduleDateToIso(rawStart) : "";
        const dueDate = rawDue ? parseKoreanScheduleDateToIso(rawDue) : startDate;
        const time = (elTime?.value || "").trim();
        const location = (document.getElementById("sts-location-input")?.value || "").trim();
        const priority = document.getElementById("sts-priority-select")?.value || "Normal";
        const elMemoEditor = document.getElementById("sts-memo-editor");

        if (!title) {
            if (typeof showToast === "function") showToast("일정 제목을 입력해 주세요.");
            document.getElementById("sts-title-input")?.focus();
            return null;
        }
        if (rawStart && !startDate) {
            if (typeof showToast === "function") showToast("시작일 형식을 확인해 주세요. (예: 2026년 11월 22일)");
            elStart?.focus();
            return null;
        }
        if (!dueDate) {
            if (typeof showToast === "function") showToast("마감일을 올바르게 입력해 주세요. (예: 2026년 11월 22일)");
            elDue?.focus();
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

    // ========================================================================
    // 4-2. 데스크톱 C# 브릿지 요청/응답 Promise 헬퍼 & 온라인 일정관리 직접 등록
    // ========================================================================
    const pendingDesktopReqMap = new Map();

    function bindDesktopBridgeResponseListener() {
        if (!isDesktopWebViewEnv() || window._zenDesktopBridgeRespBound) return;
        window._zenDesktopBridgeRespBound = true;
        window.chrome.webview.addEventListener("message", (event) => {
            try {
                const payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
                if (!payload) return;

                if (payload.reqId) {
                    const entry = pendingDesktopReqMap.get(payload.reqId);
                    if (entry) {
                        clearTimeout(entry.timer);
                        pendingDesktopReqMap.delete(payload.reqId);
                        entry.resolve(payload);
                        return;
                    }
                }

                if (payload.type === "externalMemoDragState" && typeof handleExternalMemoDragStateEvent === "function") {
                    handleExternalMemoDragStateEvent(payload);
                } else if (payload.type === "miryangMemoCaptureStarted" && typeof handleMiryangMemoCaptureStartedEvent === "function") {
                    handleMiryangMemoCaptureStartedEvent(payload);
                } else if (payload.type === "miryangMemoCaptured" && typeof handleCapturedMiryangMemoPayload === "function") {
                    handleCapturedMiryangMemoPayload(payload);
                }
            } catch { }
        });
    }

    function callDesktopBridgeRequest(type, bodyObj, timeoutMs = 48000) {
        if (!isDesktopWebViewEnv()) {
            return Promise.resolve({ ok: false, error: "NOT_DESKTOP" });
        }
        bindDesktopBridgeResponseListener();
        const reqId = "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                pendingDesktopReqMap.delete(reqId);
                resolve({ ok: false, error: "TIMEOUT", message: "요청 시간이 초과되었습니다." });
            }, timeoutMs);
            pendingDesktopReqMap.set(reqId, { resolve, timer });
            try {
                window.chrome.webview.postMessage(
                    JSON.stringify(Object.assign({}, bodyObj, { type, reqId }))
                );
            } catch (err) {
                clearTimeout(timer);
                pendingDesktopReqMap.delete(reqId);
                resolve({ ok: false, error: String(err && err.message ? err.message : err) });
            }
        });
    }

    async function registerScheduleInBrowserMyTodoDB(ddayPayload) {
        try {
            const incomingTasks = Array.isArray(ddayPayload && ddayPayload.tasks) ? ddayPayload.tasks : [];
            if (incomingTasks.length === 0) return false;

            const activeStoreId = localStorage.getItem("todoCalendar.activeStoreId") || "default";
            const storeKey = activeStoreId === "default"
                ? "todoCalendar.v1"
                : `todoCalendar.store.${activeStoreId}`;

            let currentStoreObj = null;
            const rawLocal = localStorage.getItem(storeKey);
            if (rawLocal) {
                try {
                    currentStoreObj = JSON.parse(rawLocal);
                } catch { }
            }

            // MyTodoDB_V1 IndexedDB에서도 조회 및 동기화
            const idbStoreObj = await new Promise((resolve) => {
                try {
                    const req = indexedDB.open("MyTodoDB_V1", 1);
                    req.onupgradeneeded = (e) => {
                        const idb = e.target.result;
                        if (!idb.objectStoreNames.contains("kv")) idb.createObjectStore("kv");
                        if (!idb.objectStoreNames.contains("handles")) idb.createObjectStore("handles");
                    };
                    req.onsuccess = (e) => {
                        try {
                            const idb = e.target.result;
                            if (!idb.objectStoreNames.contains("kv")) {
                                resolve(null);
                                return;
                            }
                            const tx = idb.transaction("kv", "readonly");
                            const g = tx.objectStore("kv").get(storeKey);
                            g.onsuccess = () => {
                                try {
                                    const val = g.result;
                                    if (!val) resolve(null);
                                    else resolve(typeof val === "string" ? JSON.parse(val) : val);
                                } catch {
                                    resolve(null);
                                }
                            };
                            g.onerror = () => resolve(null);
                        } catch {
                            resolve(null);
                        }
                    };
                    req.onerror = () => resolve(null);
                } catch {
                    resolve(null);
                }
            });

            const baseStore = idbStoreObj || currentStoreObj || { version: 1, tasks: [], recurrings: [], holidays: {} };
            if (!Array.isArray(baseStore.tasks)) baseStore.tasks = [];

            incomingTasks.forEach((t) => {
                baseStore.tasks.push(Object.assign({}, t));
            });
            baseStore.updatedAt = new Date().toISOString();

            const serialized = JSON.stringify(baseStore);
            try {
                if (serialized.length < 200 * 1024) {
                    localStorage.setItem(storeKey, serialized);
                }
            } catch { }

            await new Promise((resolve) => {
                try {
                    const req = indexedDB.open("MyTodoDB_V1", 1);
                    req.onsuccess = (e) => {
                        try {
                            const idb = e.target.result;
                            const tx = idb.transaction("kv", "readwrite");
                            tx.objectStore("kv").put(serialized, storeKey);
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

            return true;
        } catch {
            return false;
        }
    }

    async function sendNoteToScheduleDirectStub() {
        const ddayPayload = collectSendToSchedulePayload();
        if (!ddayPayload) return;

        if (isDesktopWebViewEnv()) {
            const payloadJson = JSON.stringify(ddayPayload);
            const res = await callDesktopBridgeRequest("sendScheduleToMyTodo", { payloadJson }, 12000);
            if (res && res.ok) {
                closeSendToScheduleModal();
                if (typeof showToast === "function") {
                    showToast(res.message || "MY 일정관리에 일정이 등록되었습니다.");
                }
            } else {
                if (typeof showToast === "function") {
                    showToast((res && res.message) ? res.message : "MY 일정관리 전송 중 오류가 발생했습니다.");
                }
            }
            return;
        }

        // 온라인 / 브라우저 환경: 동일 브라우저 MyTodoDB_V1 / localStorage 직접 등록 후 안내
        const ok = await registerScheduleInBrowserMyTodoDB(ddayPayload);
        closeSendToScheduleModal();
        if (ok) {
            if (typeof showToast === "function") {
                showToast("일정관리에 일정이 등록되었습니다.");
            }
        } else {
            await exportNoteAsDdaySchedule();
        }
    }

    // ========================================================================
    // 5. 좌측 상단 블랙홀 버튼 + NASA 골드 블랙홀 등장/꿀꺽/퇴장 껍데기
    // ========================================================================
    const BH_DEFAULT_PROMPT = "";
    const BH_MODE_META = {
        official: {
            label: "공문 분석",
            defaultFolding: true,
            prompt: "",
            hint: "공문 본문만 AI 전송·분석합니다(첨부 제외)."
        },
        memo: {
            label: "쪽지 분석",
            defaultFolding: true,
            prompt: "쪽지 분석 중에는 '마우스·키보드'를 사용하지 마세요. AI가 사용하고 있습니다.",
            hint: "쪽지 본문만 AI 전송·분석합니다(첨부 제외)."
        },
        summary: {
            label: "문서 분석",
            defaultFolding: false,
            prompt: "요약하고 싶은 문서를 블랙홀에 던져 넣으세요(개인정보X, 비공개문서X).",
            hint: "AI가 문서를 요약해 줍니다."
        }
    };

    let bhCurrentMode = "official";
    let bhIsOpen = false;
    let bhRafId = null;
    let bhOrbitDots = [];
    let bhOuterStars = [];
    let bhParticles = [];
    let bhInfallBodies = [];
    let bhLastInfallSpawnTs = 0;
    let bhSwallowing = false;
    let bhSwallowBoost = 1.0;
    let bhFlashLevel = 0;
    let bhShockProgress = 0;
    let bhShockActive = false;
    let bhHoverLevel = 0;
    let bhTargetHover = 0;
    let bhSwallowTimer1 = null;
    let bhSwallowTimer2 = null;
    let bhRetractTimer = null;
    let bhCheerDelayTimer = null;
    let bhCheerIntervalTimer = null;
    let bhCheerFadeTimer = null;

    const BH_CHEER_IDX_KEY = "zen_bh_cheer_idx";
    const BH_CHEER_MESSAGES = [
        "언제나 당신을 응원합니다.",
        "지금 이 순간에도 묵묵히 해내고 있는 당신이 참 멋집니다.",
        "차근차근 쌓아 올린 노력이 결국 가장 든든한 힘이 됩니다.",
        "잠시 숨을 고르는 시간도 앞으로 나아가는 소중한 과정입니다.",
        "당신의 섬세함과 성실함이 문서 한 줄 한 줄에 고스란히 담깁니다.",
        "복잡해 보이는 일도 하나씩 풀어내다 보면 어느새 정리되어 있을 것입니다.",
        "맡은 자리에서 늘 최선을 다하는 당신에게 따뜻한 박수를 보냅니다.",
        "작은 진전 하나하나가 모여 큰 결실을 만들어 냅니다.",
        "바쁜 흐름 속에서도 중심을 잃지 않는 당신의 집중력이 빛납니다.",
        "완벽하지 않아도 괜찮습니다. 이미 충분히 잘 해내고 있습니다.",
        "당신이 기울이는 정성과 고민은 결코 헛되지 않습니다.",
        "어려운 과제일수록 해결했을 때의 성취감도 더 크게 돌아옵니다.",
        "한 걸음씩 꾸준히 걸어가는 사람에게 결국 좋은 결과가 찾아옵니다.",
        "스스로를 너무 다그치지 말고, 해낸 것들에 작은 칭찬을 건네 보세요.",
        "당신의 차분한 판단과 배려가 주변 사람들에게 큰 안정감을 줍니다.",
        "막막해 보이던 일도 정리가 시작되면 금세 윤곽이 드러납니다.",
        "지금의 노력이 앞으로의 당신을 한결 더 편안하고 단단하게 만들어 줄 것입니다.",
        "일의 속도가 조금 느려도 방향만 맞다면 분명히 목적지에 닿습니다.",
        "복잡하고 까다로운 내용을 꼼꼼히 살피는 당신의 눈빛이 참 든든합니다.",
        "잠깐의 물 한 모금이 지친 집중력을 부드럽게 되살려 줍니다.",
        "누구보다 성실하게 임하는 당신의 태도가 가장 큰 경쟁력입니다.",
        "지나온 시간보다 앞으로 펼쳐질 좋은 순간들이 훨씬 더 많습니다.",
        "지금 해결하고 있는 이 일도 곧 뿌듯한 완료 목록으로 남을 것입니다.",
        "어깨에 들어간 힘을 살짝 풀고 편안한 마음으로 호흡해 보세요.",
        "당신의 차분한 열정이 빈칸들을 근사하게 채워 가고 있습니다.",
        "보이지 않는 곳에서 쏟은 수고까지 모두 가치 있는 발자취입니다.",
        "세심하게 확인하는 습관이 더 큰 실수를 막아 주는 든든한 방패입니다.",
        "마음먹은 일들을 하나씩 매듭지어 가는 당신이 정말 대단합니다.",
        "예상치 못한 변수 앞에서도 흔들리지 않고 길을 찾아낼 수 있습니다.",
        "당신이 만들어 가는 결과물에는 늘 따뜻한 진심이 배어 있습니다.",
        "잠시 눈을 감고 어깨를 기지개 켜면 새로운 에너지가 차오릅니다.",
        "크고 거창한 변화보다 꾸준한 성실함이 삶을 가장 단단히 지킵니다.",
        "어려운 내용을 쉽게 풀어 정리하려는 당신의 노력이 빛을 발합니다.",
        "지금의 작은 배움과 정리가 다가올 실력을 한 뼘 더 키워 줍니다.",
        "혼자가 아닙니다. 언제든 기댈 수 있는 든든한 도구가 곁에 있습니다.",
        "해야 할 일이 많아 보일 때도 가장 중요한 것부터 차분히 다뤄 보세요.",
        "당신의 신중함과 책임감이 주변의 믿음을 단단하게 만듭니다.",
        "잠시 속도를 늦추고 쉬어 가도 목표는 사라지지 않고 그 자리에 있습니다.",
        "예전보다 조금 더 정돈된 지금의 자신이 스스로에게 주는 선물입니다.",
        "묵묵히 쌓아 둔 경험들이 결정적인 순간에 가장 빛나는 해답이 됩니다.",
        "고민이 깊어질수록 더 정확하고 설득력 있는 결과가 완성됩니다.",
        "복잡한 실타래도 첫 매듭을 찾으면 생각보다 술술 풀려 나갑니다.",
        "스스로의 페이스를 믿고 지금처럼 차분하게 나아가세요.",
        "늘 새로운 방법을 고민하고 더 나아지려 노력하는 모습이 아름답습니다.",
        "당신의 친절한 말 한마디와 세심한 정리 하나가 일을 훨씬 수월하게 합니다.",
        "지금 흘리는 작은 정성들이 머지않아 환한 웃음으로 돌아올 것입니다.",
        "가끔은 결과보다 여기까지 오기 위해 애쓴 과정을 더 많이 기억해 주세요.",
        "낯설고 까다로운 업무도 몇 번 마주하다 보면 금세 익숙한 영역이 됩니다.",
        "어떤 순간에도 스스로의 가치를 의심하지 마세요. 이미 충분히 빛납니다.",
        "할 수 있다는 믿음 하나만으로도 어려운 길의 절반은 건너온 셈입니다.",
        "깔끔하게 정돈되는 문서처럼 마음속 걱정도 하나씩 비워지길 바랍니다.",
        "당신의 손끝을 거친 자료는 언제나 보기 좋고 이해하기 쉽게 바뀝니다.",
        "무거운 책임감을 묵묵히 견뎌 내는 당신의 내면은 생각보다 훨씬 강합니다.",
        "잠깐 창밖 먼 곳을 바라보며 눈의 피로를 부드럽게 덜어 보세요.",
        "작은 디테일을 놓치지 않는 정교함이 결국 완성도의 차이를 만듭니다.",
        "서두르지 않아도 괜찮습니다. 정확한 한 걸음이 가장 빠른 길입니다.",
        "스스로 선택한 일에 책임을 다하려는 마음이 참 존경스럽습니다.",
        "지금의 집중력이 복잡한 업무를 가장 깔끔한 해답으로 이끌고 있습니다.",
        "지치는 순간이 찾아와도 당신 안의 회복력을 믿고 한 템포 쉬어 가세요.",
        "바쁘게 움직이는 손길 뒤에는 언제나 성실한 고민의 시간이 담겨 있습니다.",
        "한 줄을 정리할 때마다 해야 할 일의 무게도 조금씩 가벼워집니다.",
        "당신이 쏟은 진심 어린 노력은 반드시 제 빛을 내는 순간이 옵니다.",
        "작은 친절과 배려를 잃지 않는 당신 덕분에 주변 분위기가 따뜻합니다.",
        "눈앞의 과제가 끝없이 느껴져도 하나씩 비워 내다 보면 끝에 닿습니다.",
        "매 순간 최선을 찾으려는 당신의 자세 자체가 이미 훌륭한 성과입니다.",
        "잘 풀리지 않을 때는 잠시 거리를 두고 보면 의외로 쉬운 길이 보입니다.",
        "끊임없이 배우고 정돈하는 태도가 당신을 더욱 자유롭게 만듭니다.",
        "스스로를 아끼고 돌보는 시간 역시 일의 완성도를 높이는 비결입니다.",
        "꼼꼼하게 짚어 내는 통찰력 덕분에 놓치기 쉬운 부분까지 살아납니다.",
        "당신의 성실함은 유행처럼 사라지지 않는 가장 든든한 자산입니다.",
        "마음에 여유를 한 스푼 더하면 복잡한 일도 한결 부드럽게 풀립니다.",
        "지금까지 수많은 일을 해내 왔듯 이번 일 역시 멋지게 마칠 것입니다.",
        "따뜻한 차 한 잔과 같은 평온함이 당신의 일상에 함께하길 바랍니다.",
        "정직하게 쌓아 온 실력은 어떤 상황에서도 가장 큰 자신감이 됩니다.",
        "작은 성공의 기억들을 모아 두면 큰 도전을 앞두어도 두렵지 않습니다.",
        "지금 마주한 고민들이 훗날 누군가에게 건넬 소중한 지혜가 됩니다.",
        "묵직한 업무 속에서도 유머와 여유를 잃지 않는 당신이 멋집니다.",
        "누구와 비교하지 않아도 당신만의 속도와 결이 충분히 훌륭합니다.",
        "흩어져 있던 생각들이 반듯한 문장으로 모이는 즐거움을 느껴 보세요.",
        "궂은 일도 마다하지 않고 먼저 살피는 따뜻함에 늘 고마움을 느낍니다.",
        "스스로 만족할 만큼 정성을 들인 일은 결과가 어떻든 당당합니다.",
        "가끔은 아무 생각 없이 크게 숨을 들이마시고 길게 내쉬어 보세요.",
        "당신의 맑은 시선과 차분한 어조가 복잡한 문제의 열쇠가 됩니다.",
        "크고 작은 일들을 능숙하게 조율하는 능력이 차곡차곡 깊어지고 있습니다.",
        "잘하고 싶은 마음이 크기에 더 신중해지는 것일 뿐, 이미 잘하고 있습니다.",
        "깔끔하게 마무리될 결과를 떠올리며 조금만 더 힘을 내 보세요.",
        "당신의 손길이 닿는 곳마다 질서와 명쾌함이 자연스럽게 자리 잡습니다.",
        "어려운 조건 속에서도 최선의 답을 찾아내는 지혜가 참 돋보입니다.",
        "힘들 때는 잠시 멈춰 서서 스스로에게 따뜻한 응원을 건네도 좋습니다.",
        "당신의 꾸준한 발걸음이 더 단단하고 여유로운 미래를 열어 줍니다.",
        "세심한 정리 하나가 모두의 시간을 아껴 주는 큰 배려가 됩니다.",
        "정성껏 건넨 노력들이 삶에 기분 좋은 보람으로 오래 남을 것입니다.",
        "작은 실수는 고쳐 나가면 그만이고, 지금까지의 노력은 온전히 남습니다.",
        "복잡한 자료 너머의 핵심을 꿰뚫어 보는 당신의 집중력을 응원합니다.",
        "언제 어디서나 맡은 몫 이상을 해내는 당신의 저력을 믿습니다.",
        "차분하게 정리된 계획 하나가 막연한 불안을 기분 좋은 확신으로 바꿉니다.",
        "일과 마음의 균형을 지켜 나가는 당신만의 리듬을 소중히 응원합니다.",
        "조급함을 내려놓는 순간 오히려 가장 정확한 판단이 찾아옵니다.",
        "지금 들이는 정성이 결국 가장 믿음직한 결과로 빛나게 될 것입니다.",
        "당신의 수고와 진심을 기억하며, 언제나 한결같이 응원합니다."
    ];

    function setBlackHoleStatusPillText(text) {
        const pill = document.getElementById("zen-bh-status-pill");
        if (!pill) return;
        const s = String(text || "").trim();
        if (!s) {
            pill.textContent = "";
            pill.style.display = "none";
        } else {
            pill.style.display = "";
            pill.textContent = s;
        }
    }

    function stopBlackHoleCheerRotation() {
        clearTimeout(bhCheerDelayTimer);
        clearInterval(bhCheerIntervalTimer);
        clearTimeout(bhCheerFadeTimer);
        bhCheerDelayTimer = null;
        bhCheerIntervalTimer = null;
        bhCheerFadeTimer = null;
        const pill = document.getElementById("zen-bh-status-pill");
        if (pill) pill.classList.remove("is-cheer-fading");
    }

    function setBlackHoleStatusPillTextFade(text) {
        const pill = document.getElementById("zen-bh-status-pill");
        if (!pill) return;
        clearTimeout(bhCheerFadeTimer);
        pill.style.display = "";
        pill.classList.add("is-cheer-fading");
        bhCheerFadeTimer = setTimeout(() => {
            if (!bhIsOpen || !bhSwallowing) {
                pill.classList.remove("is-cheer-fading");
                return;
            }
            setBlackHoleStatusPillText(text);
            pill.classList.remove("is-cheer-fading");
        }, 240);
    }

    function startBlackHoleCheerRotation(initialStatusText, initialHoldMs = 3500, stepMs = 4000) {
        stopBlackHoleCheerRotation();
        const pill = document.getElementById("zen-bh-status-pill");
        if (pill && initialStatusText) {
            pill.classList.remove("is-cheer-fading");
            setBlackHoleStatusPillText(initialStatusText);
        }
        if (!Array.isArray(BH_CHEER_MESSAGES) || BH_CHEER_MESSAGES.length === 0) return;

        const showNextCheer = () => {
            if (!bhIsOpen || !bhSwallowing) {
                stopBlackHoleCheerRotation();
                return;
            }
            let idx = parseInt(localStorage.getItem(BH_CHEER_IDX_KEY) || "0", 10);
            if (!Number.isFinite(idx) || idx < 0 || idx >= BH_CHEER_MESSAGES.length) {
                idx = 0;
            }
            const msg = BH_CHEER_MESSAGES[idx];
            localStorage.setItem(BH_CHEER_IDX_KEY, String((idx + 1) % BH_CHEER_MESSAGES.length));
            setBlackHoleStatusPillTextFade(msg);
        };

        bhCheerDelayTimer = setTimeout(() => {
            if (!bhIsOpen || !bhSwallowing) return;
            showNextCheer();
            bhCheerIntervalTimer = setInterval(showNextCheer, stepMs);
        }, initialHoldMs);
    }

    function initBlackHoleParticles() {
        bhOrbitDots = [];
        for (let i = 0; i < 59; i++) {
            bhOrbitDots.push({
                angle: Math.random() * Math.PI * 2,
                radiusFactor: 0.36 + Math.random() * 0.72,
                speed: (0.008 + Math.random() * 0.015) * (0.72 + (1 - i / 59) * 0.58),
                size: 1.0 + Math.random() * 2.0,
                alpha: 0.32 + Math.random() * 0.65,
                hueMix: Math.random()
            });
        }
        bhOuterStars = [];
        for (let i = 0; i < 45; i++) {
            bhOuterStars.push({
                angle: Math.random() * Math.PI * 2,
                rxRatio: 0.42 + Math.random() * 0.62,
                ryRatio: 0.34 + Math.random() * 0.60,
                speed: (0.0018 + Math.random() * 0.0042) * (i % 2 === 0 ? 1 : 0.75),
                size: 0.8 + Math.random() * 1.5,
                alpha: 0.22 + Math.random() * 0.52,
                twinklePhase: Math.random() * Math.PI * 2,
                hueType: i % 5
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
        const cw = Math.max(160, Math.round(rect.width || 400));
        const ch = Math.max(160, Math.round(rect.height || 214));
        if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
            canvas.width = cw * dpr;
            canvas.height = ch * dpr;
        }
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const cx = cw / 2;
        const cy = ch / 2;
        const maxR = Math.min(cw, ch) * 0.44;
        const coreR = maxR * 0.27;
        const diskRx = Math.max(maxR * 1.65, Math.min(cw * 0.46, maxR * 1.95));
        const diskScaleY = 0.27;

        bhHoverLevel += (bhTargetHover - bhHoverLevel) * 0.14;
        bhSwallowBoost += ((bhSwallowing ? 3.1 : 1.0) - bhSwallowBoost) * 0.06;
        bhFlashLevel *= 0.91;

        ctx.clearRect(0, 0, cw, ch);
        const isLightTheme = !!(document.body && document.body.classList.contains("light-theme"));

        // 0. 캔버스 전역 외곽 배경 별무리 (넓은 우주 시야감)
        for (const st of bhOuterStars) {
            st.angle += st.speed * (1 + bhHoverLevel * 1.4 + (bhSwallowBoost - 1) * 1.1);
            const sx = cx + Math.cos(st.angle) * (cw * 0.48 * st.rxRatio);
            const sy = cy + Math.sin(st.angle) * (ch * 0.47 * st.ryRatio);
            if (Math.hypot(sx - cx, sy - cy) < coreR * 1.15) continue;
            const tw = 0.72 + 0.28 * Math.sin(ts * 0.003 + st.twinklePhase);
            const a = Math.min(0.9, st.alpha * tw * (bhSwallowing ? 1.18 : 1));
            if (isLightTheme) {
                ctx.fillStyle = st.hueType === 0
                    ? `rgba(180, 128, 44, ${a * 0.72})`
                    : st.hueType === 1
                        ? `rgba(59, 130, 246, ${a * 0.46})`
                        : `rgba(100, 116, 139, ${a * 0.45})`;
            } else {
                ctx.fillStyle = st.hueType === 0
                    ? `rgba(254, 243, 199, ${a * 0.85})`
                    : st.hueType === 1
                        ? `rgba(147, 197, 253, ${a * 0.72})`
                        : `rgba(226, 232, 240, ${a * 0.65})`;
            }
            ctx.beginPath();
            ctx.arc(sx, sy, st.size, 0, Math.PI * 2);
            ctx.fill();
        }

        // 1. 외곽 헤일로 (화이트 모드는 탁한 검은 안개를 걷어내고 맑은 샴페인 코로나 적용)
        const haloR = maxR * 1.42;
        const halo = ctx.createRadialGradient(cx, cy, coreR * 0.7, cx, cy, haloR);
        if (isLightTheme) {
            halo.addColorStop(0, "rgba(15, 23, 42, 0.10)");
            halo.addColorStop(0.42, `rgba(217, 165, 72, ${0.15 + bhHoverLevel * 0.08 + bhFlashLevel * 0.14})`);
            halo.addColorStop(0.74, `rgba(226, 200, 145, ${0.08 + bhHoverLevel * 0.05})`);
            halo.addColorStop(1, "rgba(255, 255, 255, 0)");
        } else {
            halo.addColorStop(0, "rgba(0, 0, 0, 0.94)");
            halo.addColorStop(0.42, "rgba(16, 18, 26, 0.72)");
            halo.addColorStop(0.74, `rgba(180, 130, 55, ${0.18 + bhHoverLevel * 0.1 + bhFlashLevel * 0.2})`);
            halo.addColorStop(1, "rgba(15, 23, 42, 0)");
        }
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
        ctx.fill();

        // 2. 후면 상/하 중력렌즈 아크
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.22);
        for (const side of [-1, 1]) {
            const lensGrad = ctx.createLinearGradient(-maxR * 0.56, 0, maxR * 0.56, 0);
            if (isLightTheme) {
                lensGrad.addColorStop(0, "rgba(180, 130, 50, 0)");
                lensGrad.addColorStop(0.5, `rgba(180, 128, 42, ${0.42 + bhHoverLevel * 0.2})`);
                lensGrad.addColorStop(1, "rgba(180, 130, 50, 0)");
            } else {
                lensGrad.addColorStop(0, "rgba(253, 230, 138, 0)");
                lensGrad.addColorStop(0.5, `rgba(254, 240, 138, ${0.38 + bhHoverLevel * 0.22})`);
                lensGrad.addColorStop(1, "rgba(253, 230, 138, 0)");
            }
            ctx.strokeStyle = lensGrad;
            ctx.lineWidth = isLightTheme ? 2.5 : 2.9;
            ctx.beginPath();
            ctx.arc(0, side * 1.4, coreR * 1.32, side > 0 ? 0.16 : Math.PI + 0.16, side > 0 ? Math.PI - 0.16 : Math.PI * 2 - 0.16);
            ctx.stroke();
        }
        ctx.restore();

        // 3. 넓게 펼쳐진 샴페인 골드 강착원반 & 궤도 입자
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.24);
        const speedBoost = (1 + bhHoverLevel * 1.8) * bhSwallowBoost;

        for (const p of bhOrbitDots) {
            p.angle += p.speed * speedBoost;
            const rDist = diskRx * p.radiusFactor;
            const px = Math.cos(p.angle) * rDist;
            const py = Math.sin(p.angle) * (rDist * diskScaleY);
            const isFront = Math.sin(p.angle) >= 0;
            if (!isFront && Math.hypot(px, py) < coreR * 1.05) continue;
            const bright = Math.min(1, p.alpha + bhFlashLevel * 0.35);
            if (isLightTheme) {
                ctx.fillStyle = p.hueMix > 0.42
                    ? `rgba(180, 128, 44, ${bright * 0.78})`
                    : `rgba(120, 113, 108, ${bright * 0.50})`;
            } else {
                ctx.fillStyle = p.hueMix > 0.42
                    ? `rgba(254, 243, 199, ${bright * 0.88})`
                    : `rgba(217, 165, 72, ${bright * 0.78})`;
            }
            ctx.beginPath();
            ctx.arc(px, py, p.size * (isFront ? 1.1 : 0.82), 0, Math.PI * 2);
            ctx.fill();
        }

        // 강착원반 밝은 2중 링 레이어 (넓은 외곽 + 코어 인접 광자띠)
        ctx.scale(1, diskScaleY);
        const diskRing = ctx.createRadialGradient(0, 0, coreR * 1.1, 0, 0, diskRx);
        if (isLightTheme) {
            diskRing.addColorStop(0, "rgba(217, 175, 95, 0)");
            diskRing.addColorStop(0.18, `rgba(217, 165, 72, ${0.46 + bhFlashLevel * 0.22})`);
            diskRing.addColorStop(0.48, `rgba(180, 130, 55, ${0.26 + bhHoverLevel * 0.14})`);
            diskRing.addColorStop(0.78, `rgba(217, 165, 72, ${0.11 + bhHoverLevel * 0.08})`);
            diskRing.addColorStop(1, "rgba(180, 130, 55, 0)");
        } else {
            diskRing.addColorStop(0, "rgba(254, 249, 195, 0)");
            diskRing.addColorStop(0.18, `rgba(254, 243, 199, ${0.58 + bhFlashLevel * 0.22})`);
            diskRing.addColorStop(0.48, `rgba(217, 155, 58, ${0.36 + bhHoverLevel * 0.16})`);
            diskRing.addColorStop(0.78, `rgba(180, 83, 9, ${0.14 + bhHoverLevel * 0.09})`);
            diskRing.addColorStop(1, "rgba(180, 83, 9, 0)");
        }
        ctx.fillStyle = diskRing;
        ctx.beginPath();
        ctx.arc(0, 0, diskRx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 3-2. 분석 중(bhSwallowing) 바깥에서 나선형으로 가속 회전하며 빨려 들어가는 행성 & 별
        if (bhSwallowing && (ts - bhLastInfallSpawnTs >= 360) && bhInfallBodies.length < 9) {
            bhLastInfallSpawnTs = ts;
            const kindRoll = Math.random();
            const bodyType = kindRoll < 0.34 ? "ringed" : kindRoll < 0.70 ? "planet" : "star";
            const palette = [
                { core: "#fde68a", glow: "rgba(217, 165, 72, 0.55)", ring: "#d97706" },
                { core: "#93c5fd", glow: "rgba(59, 130, 246, 0.45)", ring: "#60a5fa" },
                { core: "#fdba74", glow: "rgba(249, 115, 22, 0.45)", ring: "#fb923c" },
                { core: "#e2e8f0", glow: "rgba(148, 163, 184, 0.50)", ring: "#cbd5e1" }
            ];
            const pal = palette[Math.floor(Math.random() * palette.length)];
            const startR = Math.max(cw * 0.48, maxR * 1.82);
            bhInfallBodies.push({
                type: bodyType,
                pal,
                r: startR,
                startR,
                angle: Math.random() * Math.PI * 2,
                baseAngular: 0.032 + Math.random() * 0.022,
                infallSpeed: 1.05 + Math.random() * 0.55,
                size: bodyType === "star" ? 3.2 + Math.random() * 1.8 : 4.2 + Math.random() * 2.8,
                tilt: (Math.random() - 0.5) * 0.9,
                trail: []
            });
        }

        for (let i = bhInfallBodies.length - 1; i >= 0; i--) {
            const b = bhInfallBodies[i];
            const distRatio = Math.max(0.08, b.r / b.startR);
            const keplerBoost = 1 + Math.pow(maxR / Math.max(b.r, coreR), 1.15) * 0.9;
            b.angle += b.baseAngular * keplerBoost;
            b.r -= b.infallSpeed * (1.1 + (1 - distRatio) * 2.3);

            const bx = cx + Math.cos(b.angle) * b.r;
            const by = cy + Math.sin(b.angle) * (b.r * 0.56);
            b.trail.push({ x: bx, y: by });
            if (b.trail.length > 8) b.trail.shift();

            const scale = Math.max(0.26, Math.min(1, (b.r - coreR * 0.65) / (b.startR * 0.6)));
            const fadeAlpha = Math.min(0.95, Math.max(0, (b.r - coreR * 0.9) / (coreR * 0.7)));

            if (b.trail.length > 1) {
                for (let tIdx = 1; tIdx < b.trail.length; tIdx++) {
                    const p0 = b.trail[tIdx - 1];
                    const p1 = b.trail[tIdx];
                    const frac = tIdx / b.trail.length;
                    ctx.strokeStyle = isLightTheme
                        ? `rgba(180, 128, 44, ${fadeAlpha * frac * 0.42})`
                        : `rgba(254, 243, 199, ${fadeAlpha * frac * 0.52})`;
                    ctx.lineWidth = Math.max(0.8, b.size * scale * frac * 0.45);
                    ctx.beginPath();
                    ctx.moveTo(p0.x, p0.y);
                    ctx.lineTo(p1.x, p1.y);
                    ctx.stroke();
                }
            }

            const drawR = b.size * scale;
            ctx.save();
            ctx.translate(bx, by);
            ctx.globalAlpha = fadeAlpha;
            if (b.type === "star") {
                ctx.fillStyle = isLightTheme ? "#b45309" : "#fef3c7";
                ctx.beginPath();
                ctx.moveTo(0, -drawR * 1.45);
                ctx.lineTo(drawR * 0.42, -drawR * 0.42);
                ctx.lineTo(drawR * 1.45, 0);
                ctx.lineTo(drawR * 0.42, drawR * 0.42);
                ctx.lineTo(0, drawR * 1.45);
                ctx.lineTo(-drawR * 0.42, drawR * 0.42);
                ctx.lineTo(-drawR * 1.45, 0);
                ctx.lineTo(-drawR * 0.42, -drawR * 0.42);
                ctx.closePath();
                ctx.fill();
            } else {
                const grad = ctx.createRadialGradient(-drawR * 0.3, -drawR * 0.3, drawR * 0.1, 0, 0, drawR);
                grad.addColorStop(0, "#ffffff");
                grad.addColorStop(0.45, b.pal.core);
                grad.addColorStop(1, b.pal.ring);
                ctx.fillStyle = grad;
                ctx.shadowColor = b.pal.glow;
                ctx.shadowBlur = 7;
                ctx.beginPath();
                ctx.arc(0, 0, drawR, 0, Math.PI * 2);
                ctx.fill();

                if (b.type === "ringed") {
                    ctx.rotate(b.tilt);
                    ctx.strokeStyle = isLightTheme ? "rgba(180, 128, 44, 0.75)" : "rgba(254, 240, 138, 0.8)";
                    ctx.lineWidth = Math.max(1, drawR * 0.22);
                    ctx.beginPath();
                    ctx.ellipse(0, 0, drawR * 1.85, drawR * 0.52, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.restore();

            if (b.r <= coreR * 1.04) {
                bhInfallBodies.splice(i, 1);
                bhFlashLevel = Math.max(bhFlashLevel, 0.34);
            }
        }

        // 4. 사상의 지평선(중앙 블랙 코어) + 광자 링
        ctx.save();
        ctx.fillStyle = isLightTheme ? "#111827" : "#04060c";
        ctx.shadowColor = isLightTheme
            ? `rgba(180, 130, 50, ${0.48 + bhFlashLevel * 0.2})`
            : `rgba(254, 240, 138, ${0.65 + bhFlashLevel * 0.2})`;
        ctx.shadowBlur = (isLightTheme ? 12 : 15) + bhHoverLevel * 8 + bhFlashLevel * 14;
        ctx.beginPath();
        ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = isLightTheme
            ? `rgba(217, 165, 72, ${0.72 + bhFlashLevel * 0.2})`
            : `rgba(254, 243, 199, ${0.75 + bhFlashLevel * 0.18})`;
        ctx.lineWidth = 1.5;
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
                const sr = coreR + bhShockProgress * (maxR * 1.35 - coreR);
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
        const foldLabelEl = document.getElementById("zen-bh-folding-label");
        if (foldLabelEl) {
            foldLabelEl.textContent = bhCurrentMode === "official"
                ? "자동 폴더링(폴더를 만들어 공문 저장)"
                : bhCurrentMode === "memo"
                    ? "자동 폴더링(폴더를 만들어 쪽지 저장)"
                    : "자동 폴더링(폴더를 만들어 문서 저장)";
        }
        const hintEl = document.getElementById("zen-bh-mode-hint");
        if (hintEl) hintEl.textContent = meta.hint;
        if (!bhSwallowing) {
            stopBlackHoleCheerRotation();
            setBlackHoleStatusPillText(meta.prompt || BH_DEFAULT_PROMPT);
        }
        setBlackHoleSendingUi(bhSwallowing);
    }

    function clearBlackHoleTimers() {
        clearTimeout(bhSwallowTimer1);
        clearTimeout(bhSwallowTimer2);
        clearTimeout(bhRetractTimer);
        bhSwallowTimer1 = null;
        bhSwallowTimer2 = null;
        bhRetractTimer = null;
        stopBlackHoleCheerRotation();
    }

    function setBlackHoleSendingUi(isSending) {
        const sendBtn = document.getElementById("zen-bh-prompt-send-btn");
        if (!sendBtn) return;
        const isSummaryMode = bhCurrentMode === "summary";
        sendBtn.disabled = !!isSending || !isSummaryMode;
        sendBtn.title = isSummaryMode
            ? "문서 없이 프롬프트만 AI에 전송 (Ctrl+Enter)"
            : "문서 없이 프롬프트 전송은 '문서 분석' 탭에서 사용할 수 있습니다.";
    }

    function notifyDesktopBlackHolePortalState(isOpen) {
        if (!isDesktopWebViewEnv()) return;
        try {
            let rectObj = null;
            if (isOpen) {
                const shell = document.getElementById("zen-blackhole-portal-shell");
                if (shell) {
                    const r = shell.getBoundingClientRect();
                    if (r && r.width > 40 && r.height > 40) {
                        rectObj = { left: r.left, top: r.top, width: r.width, height: r.height };
                    }
                }
            }
            window.chrome.webview.postMessage(JSON.stringify({
                type: "blackHolePortalState",
                open: !!isOpen,
                rect: rectObj
            }));
        } catch { }
    }

    function openBlackHolePortal() {
        const layer = document.getElementById("zen-blackhole-portal-layer");
        const shell = document.getElementById("zen-blackhole-portal-shell");
        const btn = document.getElementById("zen-blackhole-btn");
        const dropZone = document.getElementById("zen-bh-orb-dropzone");
        if (!layer || !shell) return;

        bindDesktopBridgeResponseListener();
        clearBlackHoleTimers();
        if (bhOrbitDots.length === 0 || bhOuterStars.length === 0) initBlackHoleParticles();
        bhSwallowing = false;
        bhSwallowBoost = 1.0;
        bhParticles = [];
        bhInfallBodies = [];
        bhLastInfallSpawnTs = 0;
        bhFlashLevel = 0;
        bhShockActive = false;
        bhTargetHover = 0;
        if (dropZone) dropZone.classList.remove("is-drag-hover", "is-external-memo-hover");

        closeBlackHoleModelDropdown();
        syncBlackHoleModelPickerUI();
        syncTimelyAiLiveModels(false);
        setBlackHoleMode(bhCurrentMode || "official");
        setBlackHoleSendingUi(false);

        updateBlackHoleButtonOriginVars();
        shell.classList.remove("is-retracting");
        shell.classList.add("is-origin");
        layer.style.display = "flex";
        void shell.offsetWidth;
        shell.classList.remove("is-origin");

        bhIsOpen = true;
        if (btn) btn.classList.add("is-active");
        if (!bhRafId) bhRafId = requestAnimationFrame(renderBlackHoleCanvasFrame);

        notifyDesktopBlackHolePortalState(true);
        setTimeout(() => {
            if (bhIsOpen) notifyDesktopBlackHolePortalState(true);
        }, 320);

        try {
            history.pushState({ modal: "blackhole-portal" }, "");
        } catch { }
    }

    function closeBlackHolePortal(fromPopstate = false) {
        const layer = document.getElementById("zen-blackhole-portal-layer");
        const shell = document.getElementById("zen-blackhole-portal-shell");
        const btn = document.getElementById("zen-blackhole-btn");
        const dropZone = document.getElementById("zen-bh-orb-dropzone");
        if (!layer || layer.style.display === "none") return;

        closeBlackHoleModelDropdown();
        stopBlackHoleCheerRotation();
        clearTimeout(bhSwallowTimer1);
        clearTimeout(bhSwallowTimer2);
        bhSwallowTimer1 = null;
        bhSwallowTimer2 = null;
        bhSwallowing = false;
        bhSwallowBoost = 1.0;
        bhInfallBodies = [];
        setBlackHoleSendingUi(false);
        bhIsOpen = false;
        bhTargetHover = 0;
        if (dropZone) dropZone.classList.remove("is-drag-hover", "is-external-memo-hover");
        notifyDesktopBlackHolePortalState(false);

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

    // ========================================================================
    // 5-2. 블랙홀 AI 모델 선택 드롭다운 (디폴트: Gemini 3.8 Flash)
    // ========================================================================
    const MYAI_MODEL_STORAGE_KEY = "zen_myai_selected_model";
    const MYAI_DEFAULT_MODEL_ID = "gemini-3.8-flash";

    const MYAI_PROVIDER_ICONS = {
        upstage: `<svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="zen-solar-g" x1="5" y1="5" x2="19" y2="19" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="#38BDF8"/><stop offset="50%" stop-color="#6366F1"/><stop offset="100%" stop-color="#A855F7"/></linearGradient></defs><circle cx="12" cy="12" r="11" fill="#0B0F19"/><path d="M12 4.2L14.1 9.9L19.8 12L14.1 14.1L12 19.8L9.9 14.1L4.2 12L9.9 9.9L12 4.2Z" fill="url(#zen-solar-g)"/></svg>`,
        anthropic: `<svg viewBox="0 0 24 24" fill="none"><path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z" fill="#D97757" fill-rule="nonzero"/></svg>`,
        openai: `<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd"><path d="M9.205 8.658v-2.26c0-.19.072-.333.238-.428l4.543-2.616c.619-.357 1.356-.523 2.117-.523 2.854 0 4.662 2.212 4.662 4.566 0 .167 0 .357-.024.547l-4.71-2.759a.797.797 0 00-.856 0l-5.97 3.473zm10.609 8.8V12.06c0-.333-.143-.57-.429-.737l-5.97-3.473 1.95-1.118a.433.433 0 01.476 0l4.543 2.617c1.309.76 2.189 2.378 2.189 3.948 0 1.808-1.07 3.473-2.76 4.163zM7.802 12.703l-1.95-1.142c-.167-.095-.239-.238-.239-.428V5.899c0-2.545 1.95-4.472 4.591-4.472 1 0 1.927.333 2.712.928L8.23 5.067c-.285.166-.428.404-.428.737v6.898zM12 15.128l-2.795-1.57v-3.33L12 8.658l2.795 1.57v3.33L12 15.128zm1.796 7.23c-1 0-1.927-.332-2.712-.927l4.686-2.712c.285-.166.428-.404.428-.737v-6.898l1.974 1.142c.167.095.238.238.238.428v5.233c0 2.545-1.974 4.472-4.614 4.472zm-5.637-5.303l-4.544-2.617c-1.308-.761-2.188-2.378-2.188-3.948A4.482 4.482 0 014.21 6.327v5.423c0 .333.143.571.428.738l5.947 3.449-1.95 1.118a.432.432 0 01-.476 0zm-.262 3.9c-2.688 0-4.662-2.021-4.662-4.519 0-.19.024-.38.047-.57l4.686 2.71c.286.167.571.167.856 0l5.97-3.448v2.26c0 .19-.07.333-.237.428l-4.543 2.616c-.619.357-1.356.523-2.117.523zm5.899 2.83a5.947 5.947 0 005.827-4.756C22.287 18.339 24 15.84 24 13.296c0-1.665-.713-3.282-1.998-4.448.119-.5.19-.999.19-1.498 0-3.401-2.759-5.947-5.946-5.947-.642 0-1.26.095-1.88.31A5.962 5.962 0 0010.205 0a5.947 5.947 0 00-5.827 4.757C1.713 5.447 0 7.945 0 10.49c0 1.666.713 3.283 1.998 4.448-.119.5-.19 1-.19 1.499 0 3.401 2.759 5.946 5.946 5.946.642 0 1.26-.095 1.88-.309a5.96 5.96 0 004.162 1.713z"/></svg>`,
        google: `<svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="zen-gem-0" x1="7" x2="11" y1="15.5" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#08B962"/><stop offset="1" stop-color="#08B962" stop-opacity="0"/></linearGradient><linearGradient id="zen-gem-1" x1="8" x2="11.5" y1="5.5" y2="11" gradientUnits="userSpaceOnUse"><stop stop-color="#F94543"/><stop offset="1" stop-color="#F94543" stop-opacity="0"/></linearGradient><linearGradient id="zen-gem-2" x1="3.5" x2="17.5" y1="13.5" y2="12" gradientUnits="userSpaceOnUse"><stop stop-color="#FABC12"/><stop offset=".46" stop-color="#FABC12" stop-opacity="0"/></linearGradient></defs><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="#3186FF"/><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#zen-gem-0)"/><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#zen-gem-1)"/><path d="M20.616 10.835a14.147 14.147 0 01-4.45-3.001 14.111 14.111 0 01-3.678-6.452.503.503 0 00-.975 0 14.134 14.134 0 01-3.679 6.452 14.155 14.155 0 01-4.45 3.001c-.65.28-1.318.505-2.002.678a.502.502 0 000 .975c.684.172 1.35.397 2.002.677a14.147 14.147 0 014.45 3.001 14.112 14.112 0 013.679 6.453.502.502 0 00.975 0c.172-.685.397-1.351.677-2.003a14.145 14.145 0 013.001-4.45 14.113 14.113 0 016.453-3.678.503.503 0 000-.975 13.245 13.245 0 01-2.003-.678z" fill="url(#zen-gem-2)"/></svg>`,
        mistral: `<svg viewBox="0 0 24 24" fill="none"><path d="M3.428 3.4h3.429v3.428H3.428V3.4zm13.714 0h3.43v3.428h-3.43V3.4z" fill="#FFD800"/><path d="M3.428 6.828h6.857v3.429H3.429V6.828zm10.286 0h6.857v3.429h-6.857V6.828z" fill="#FFAF00"/><path d="M3.428 10.258h17.144v3.428H3.428v-3.428z" fill="#FF8205"/><path d="M3.428 13.686h3.429v3.428H3.428v-3.428zm6.858 0h3.429v3.428h-3.429v-3.428zm6.856 0h3.43v3.428h-3.43v-3.428z" fill="#FA500F"/><path d="M0 17.114h10.286v3.429H0v-3.429zm13.714 0H24v3.429H13.714v-3.429z" fill="#E10500"/></svg>`,
        kimi: `<svg viewBox="0 0 24 24" fill="none"><path d="M21.846 0a1.923 1.923 0 110 3.846H20.15a.226.226 0 01-.227-.226V1.923C19.923.861 20.784 0 21.846 0z" fill="#1783FF"/><path d="M11.065 11.199l7.257-7.2c.137-.136.06-.41-.116-.41H14.3a.164.164 0 00-.117.051l-7.82 7.756c-.122.12-.302.013-.302-.179V3.82c0-.127-.083-.23-.185-.23H3.186c-.103 0-.186.103-.186.23V19.77c0 .128.083.23.186.23h2.69c.103 0 .186-.102.186-.23v-3.25c0-.069.025-.135.069-.178l2.424-2.406a.158.158 0 01.205-.023l6.484 4.772a7.677 7.677 0 003.453 1.283c.108.012.2-.095.2-.23v-3.06c0-.117-.07-.212-.164-.227a5.028 5.028 0 01-2.027-.807l-5.613-4.064c-.117-.078-.132-.279-.028-.381z" fill="currentColor"/></svg>`,
        generic: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9.5" stroke="currentColor" stroke-width="1.6"/><path d="M12 6.5L13.6 10.4L17.5 12L13.6 13.6L12 17.5L10.4 13.6L6.5 12L10.4 10.4L12 6.5Z" fill="#3B82F6"/></svg>`
    };

    let myAiSvgGradSeq = 0;

    function getMyAiProviderIconSvg(provider) {
        const raw = MYAI_PROVIDER_ICONS[provider] || MYAI_PROVIDER_ICONS.generic;
        if (provider !== "upstage" && provider !== "google") {
            return raw;
        }
        const seq = ++myAiSvgGradSeq;
        if (provider === "upstage") {
            return raw
                .replace(/id="zen-solar-g"/g, `id="zen-solar-g-${seq}"`)
                .replace(/url\(#zen-solar-g\)/g, `url(#zen-solar-g-${seq})`);
        }
        return raw
            .replace(/id="zen-gem-0"/g, `id="zen-gem-0-${seq}"`)
            .replace(/url\(#zen-gem-0\)/g, `url(#zen-gem-0-${seq})`)
            .replace(/id="zen-gem-1"/g, `id="zen-gem-1-${seq}"`)
            .replace(/url\(#zen-gem-1\)/g, `url(#zen-gem-1-${seq})`)
            .replace(/id="zen-gem-2"/g, `id="zen-gem-2-${seq}"`)
            .replace(/url\(#zen-gem-2\)/g, `url(#zen-gem-2-${seq})`);
    }

    const MYAI_DEFAULT_MODELS = [
        {
            id: "gemini-3.8-flash",
            name: "Gemini 3.8 Flash",
            provider: "google",
            group: "기본 추천 모델",
            desc: "대용량 매뉴얼·PDF 초고속 분석 및 요약 (기본)"
        },
        {
            id: "claude-sonnet-5",
            name: "Claude Sonnet 5",
            provider: "anthropic",
            group: "추천 문서 분석 모델",
            desc: "정밀한 문서 맥락 파악 및 자연스러운 요약"
        },
        {
            id: "gpt-5.6-sol",
            name: "GPT-5.6 Sol",
            provider: "openai",
            group: "추천 문서 분석 모델",
            desc: "최신 모델 · 복합 문서 구조화 분석"
        },
        {
            id: "solar-pro4",
            name: "Solar Pro4",
            provider: "upstage",
            group: "추천 문서 분석 모델",
            desc: "한국어 공문·글쓰기 작업에 특화"
        },
        {
            id: "claude-sonnet-4-6",
            name: "Claude Sonnet 4.6",
            provider: "anthropic",
            group: "추천 문서 분석 모델",
            desc: "안정적인 공문서·보고서 핵심 추출"
        },
        {
            id: "gpt-5.5",
            name: "GPT-5.5",
            provider: "openai",
            group: "추천 문서 분석 모델",
            desc: "균형 잡힌 표준 행정·업무 문서 요약"
        },
        {
            id: "claude-haiku-4-5",
            name: "Claude Haiku 4.5",
            provider: "anthropic",
            group: "경량 고속 모델",
            desc: "빠르고 간결한 쪽지·단문 핵심 추출"
        },
        {
            id: "gpt-4.1-mini",
            name: "GPT-4.1 Mini",
            provider: "openai",
            group: "경량 고속 모델",
            desc: "경량·고속 실무 요약"
        }
    ];

    let myAiActiveModels = [...MYAI_DEFAULT_MODELS];
    let myAiModelsLastSyncAt = 0;
    let myAiModelsSyncPromise = null;

    function normalizeMyAiModelId(rawId) {
        let s = String(rawId || "").trim();
        if (!s) return MYAI_DEFAULT_MODEL_ID;
        s = s.replace(/^(upstage|anthropic|openai|google)\//i, "");
        if (s === "claude-sonnet-4.6") return "claude-sonnet-4-6";
        if (s === "claude-haiku-4.5") return "claude-haiku-4-5";
        if (s === "claude-opus-4.6") return "claude-opus-4-6";
        return s;
    }

    function resolveMyAiProvider(modelId) {
        const s = String(modelId || "").toLowerCase();
        if (s.includes("solar") || s.startsWith("upstage/")) return "upstage";
        if (s.includes("claude") || s.startsWith("anthropic/")) return "anthropic";
        if (s.includes("gemini") || s.startsWith("google/")) return "google";
        if (s.includes("mistral") || s.includes("mixtral") || s.includes("codestral")) return "mistral";
        if (s.includes("kimi") || s.includes("moonshot")) return "kimi";
        if (s.includes("gpt") || /^o[134]\b/.test(s) || s.startsWith("openai/")) return "openai";
        return "generic";
    }

    function formatLiveModelDisplayName(id) {
        const raw = String(id || "").trim();
        if (!raw) return "";
        if (/^gpt-/i.test(raw)) return raw.replace(/^gpt-/i, "GPT-").replace(/-([a-z])/g, (_, c) => ` ${c.toUpperCase()}`);
        if (/^claude-/i.test(raw)) {
            return raw
                .replace(/^claude-/i, "Claude ")
                .replace(/-(\d+)-(\d+)$/, " $1.$2")
                .replace(/-/g, " ")
                .replace(/\b[a-z]/g, (c) => c.toUpperCase());
        }
        if (/^gemini-/i.test(raw)) {
            return raw.replace(/^gemini-/i, "Gemini ").replace(/-/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
        }
        if (/^solar-/i.test(raw)) {
            return raw.replace(/^solar-/i, "Solar ").replace(/-/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());
        }
        return raw;
    }

    function applyLiveModelsCatalog(liveList) {
        if (!Array.isArray(liveList) || liveList.length === 0) return;
        const liveMap = new Map();
        liveList.forEach((item) => {
            if (!item || !item.id) return;
            const normId = normalizeMyAiModelId(item.id);
            if (!normId) return;
            // Responses API 전용 모델이나 비채팅/비요약 특수 모델 제외
            if (/^(gpt-5\.5-pro|gpt-5\.3-codex)$/i.test(normId) ||
                /embedding|whisper|tts|dall-e|moderation|realtime|audio|transcribe|search-preview|image-generation|imagen|veo|lyria|aqa|bison|gecko|computer-use|codex|sora|babbage|davinci/i.test(normId)) return;
            liveMap.set(normId, {
                id: normId,
                provider: item.provider || resolveMyAiProvider(normId),
                displayName: item.name || ""
            });
        });
        if (liveMap.size === 0) return;

        const merged = [];
        const usedIds = new Set();
        MYAI_DEFAULT_MODELS.forEach((def) => {
            if (liveMap.has(def.id)) {
                merged.push(def);
                usedIds.add(def.id);
            }
        });

        const providerLabel = { upstage: "Solar API", anthropic: "Claude API", openai: "OpenAI API", google: "Gemini API" };
        liveMap.forEach((entry, id) => {
            if (usedIds.has(id)) return;
            merged.push({
                id,
                name: entry.displayName && entry.displayName !== id ? entry.displayName : formatLiveModelDisplayName(id),
                provider: entry.provider,
                group: "실시간 API 지원 모델",
                desc: `${providerLabel[entry.provider] || "Direct API"} · 사용 가능`
            });
        });

        if (merged.length > 0) {
            myAiActiveModels = merged;
            const curSaved = normalizeMyAiModelId(localStorage.getItem(MYAI_MODEL_STORAGE_KEY) || MYAI_DEFAULT_MODEL_ID);
            if (!myAiActiveModels.some((m) => m.id === curSaved)) {
                localStorage.setItem(MYAI_MODEL_STORAGE_KEY, myAiActiveModels[0].id);
            }
            syncBlackHoleModelPickerUI();
        }
    }

    async function fetchLiveModelsInBrowser(apiKey) {
        const key = String(apiKey || "").trim();
        if (!key) return [];
        const collected = [];
        const tasks = [
            fetch("https://hello.timelyai.io/api/v2/chat/direct/upstage/v1/models", {
                headers: { "Authorization": `Bearer ${key}` }
            }).then(async (r) => {
                if (!r.ok) return;
                const d = await r.json().catch(() => null);
                (d?.data || []).forEach((m) => m?.id && collected.push({ id: m.id, provider: "upstage" }));
            }),
            fetch("https://hello.timelyai.io/api/v2/chat/direct/anthropic/v1/models", {
                headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }
            }).then(async (r) => {
                if (!r.ok) return;
                const d = await r.json().catch(() => null);
                (d?.data || []).forEach((m) => m?.id && collected.push({ id: m.id, provider: "anthropic", name: m.display_name || "" }));
            }),
            fetch("https://hello.timelyai.io/api/v2/chat/direct/openai/v1/models", {
                headers: { "Authorization": `Bearer ${key}` }
            }).then(async (r) => {
                if (!r.ok) return;
                const d = await r.json().catch(() => null);
                (d?.data || []).forEach((m) => m?.id && collected.push({ id: m.id, provider: "openai" }));
            }),
            fetch("https://hello.timelyai.io/api/v2/chat/direct/google/v1beta/models", {
                headers: { "x-goog-api-key": key }
            }).then(async (r) => {
                if (!r.ok) return;
                const d = await r.json().catch(() => null);
                (d?.models || []).forEach((m) => {
                    const id = String(m?.name || "").replace(/^models\//, "");
                    if (id) collected.push({ id, provider: "google", name: m.displayName || "" });
                });
            })
        ];
        await Promise.allSettled(tasks);
        return collected;
    }

    async function syncTimelyAiLiveModels(force = false) {
        const apiKey = getSavedMyAiApiKey();
        if (!apiKey) return;
        const now = Date.now();
        if (!force && myAiModelsLastSyncAt > 0 && now - myAiModelsLastSyncAt < 10 * 60 * 1000) {
            return;
        }
        if (myAiModelsSyncPromise) return myAiModelsSyncPromise;

        myAiModelsSyncPromise = (async () => {
            try {
                let list = [];
                if (isDesktopWebViewEnv()) {
                    const res = await callDesktopBridgeRequest("timelyAiListModelsRequest", { apiKey }, 15000);
                    if (res && res.ok && Array.isArray(res.models)) {
                        list = res.models;
                    }
                } else {
                    list = await fetchLiveModelsInBrowser(apiKey);
                }
                if (Array.isArray(list) && list.length > 0) {
                    myAiModelsLastSyncAt = Date.now();
                    applyLiveModelsCatalog(list);
                }
            } catch { }
            finally {
                myAiModelsSyncPromise = null;
            }
        })();
        return myAiModelsSyncPromise;
    }

    function getSelectedMyAiModelMeta() {
        const rawSaved = (localStorage.getItem(MYAI_MODEL_STORAGE_KEY) || "").trim();
        const savedId = normalizeMyAiModelId(rawSaved);
        if (rawSaved && savedId !== rawSaved) {
            localStorage.setItem(MYAI_MODEL_STORAGE_KEY, savedId);
        }
        const found = myAiActiveModels.find((m) => m.id === savedId);
        return found || myAiActiveModels[0] || MYAI_DEFAULT_MODELS[0];
    }

    function syncBlackHoleModelPickerUI() {
        const meta = getSelectedMyAiModelMeta();
        const btn = document.getElementById("zen-bh-model-btn");
        const iconEl = document.getElementById("zen-bh-model-btn-icon");
        const labelEl = document.getElementById("zen-bh-model-btn-label");
        if (iconEl) {
            iconEl.innerHTML = getMyAiProviderIconSvg(meta.provider);
        }
        if (labelEl) {
            labelEl.textContent = meta.name || "Gemini 3.8 Flash";
        }
        if (btn) {
            btn.title = `현재 선택된 AI 모델: ${meta.name} (${meta.desc})`;
        }

        const dropdown = document.getElementById("zen-bh-model-dropdown");
        if (!dropdown) return;

        let html = "";
        let lastGroup = "";
        myAiActiveModels.forEach((m) => {
            if (m.group !== lastGroup) {
                lastGroup = m.group;
                html += `<div class="zen-bh-model-section-label">${escapeHtmlStr(m.group)}</div>`;
            }
            const isSel = m.id === meta.id;
            const svg = getMyAiProviderIconSvg(m.provider);
            html += [
                `<button type="button" class="zen-bh-model-option${isSel ? " is-selected" : ""}" data-model-id="${escapeHtmlStr(m.id)}">`,
                `<span class="zen-bh-model-opt-icon">${svg}</span>`,
                `<span class="zen-bh-model-opt-text">`,
                `<span class="zen-bh-model-opt-name">${escapeHtmlStr(m.name)}</span>`,
                `<span class="zen-bh-model-opt-desc">${escapeHtmlStr(m.desc)}</span>`,
                `</span>`,
                `</button>`
            ].join("");
        });
        dropdown.innerHTML = html;
        dropdown.querySelectorAll(".zen-bh-model-option").forEach((optBtn) => {
            optBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = optBtn.getAttribute("data-model-id") || MYAI_DEFAULT_MODEL_ID;
                selectBlackHoleAiModel(id);
            });
        });
    }

    function selectBlackHoleAiModel(modelId) {
        const normId = normalizeMyAiModelId(modelId);
        const found = myAiActiveModels.find((m) => m.id === normId) || myAiActiveModels[0] || MYAI_DEFAULT_MODELS[0];
        localStorage.setItem(MYAI_MODEL_STORAGE_KEY, found.id);
        syncBlackHoleModelPickerUI();
        closeBlackHoleModelDropdown();
        if (typeof showToast === "function") {
            showToast(`AI 모델이 '${found.name}'(으)로 설정되었습니다.`);
        }
    }

    function toggleBlackHoleModelDropdown(event) {
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();
        const dropdown = document.getElementById("zen-bh-model-dropdown");
        if (!dropdown) return;
        const isOpen = dropdown.style.display !== "none";
        if (isOpen) {
            dropdown.style.display = "none";
        } else {
            syncBlackHoleModelPickerUI();
            dropdown.style.display = "flex";
            syncTimelyAiLiveModels(false);
        }
    }

    function closeBlackHoleModelDropdown() {
        const dropdown = document.getElementById("zen-bh-model-dropdown");
        if (dropdown) dropdown.style.display = "none";
    }

    // ========================================================================
    // 5-3. 파일 텍스트 추출 · 자동 폴더링 · 할루시네이션 0% AI 분석 엔진
    // ========================================================================
    function arrayBufferToBase64(buf) {
        const bytes = new Uint8Array(buf);
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    async function readFileAsBase64(fileObj) {
        if (!fileObj || typeof fileObj.arrayBuffer !== "function") return "";
        try {
            const buf = await fileObj.arrayBuffer();
            return arrayBufferToBase64(buf);
        } catch {
            return "";
        }
    }

    function base64ToUint8Array(base64Str) {
        const bin = atob(String(base64Str || ""));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
            bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
    }

    async function loadPdfDocumentWithLocalWorker(uint8Array) {
        if (!window.pdfjsLib || typeof window.pdfjsLib.getDocument !== "function") {
            try {
                const mod = await import(new URL("./lib/pdfjs/pdf.min.mjs", location.href).href);
                if (mod && typeof mod.getDocument === "function") {
                    window.pdfjsLib = mod;
                }
            } catch (importErr) {
                console.warn("[BlackHole pdf.js 동적 로드 실패]", importErr);
            }
        }
        const pdfLib = window.pdfjsLib;
        if (!pdfLib || typeof pdfLib.getDocument !== "function") {
            throw new Error("pdf.js 라이브러리가 로드되지 않았습니다.");
        }
        const basePdfUrl = new URL("./lib/pdfjs/", location.href).href;
        if (pdfLib.GlobalWorkerOptions) {
            pdfLib.GlobalWorkerOptions.workerSrc = `${basePdfUrl}pdf.worker.min.mjs`;
        }
        const loadingTask = pdfLib.getDocument({
            data: uint8Array.slice(),
            cMapUrl: `${basePdfUrl}cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `${basePdfUrl}standard_fonts/`,
            useSystemFonts: true
        });
        return await loadingTask.promise;
    }

    async function extractPdfTextMetaFromBytes(uint8Array, maxPages = 50) {
        if (!uint8Array || uint8Array.length === 0) return { text: "", totalPages: 0, textPageCount: 0 };
        try {
            const pdfDoc = await loadPdfDocumentWithLocalWorker(uint8Array);
            const totalPages = Math.max(1, Number(pdfDoc.numPages) || 1);
            const total = Math.min(totalPages, maxPages);
            const pageTexts = [];
            let totalLen = 0;
            let textPageCount = 0;
            for (let p = 1; p <= total; p++) {
                const page = await pdfDoc.getPage(p);
                const textContent = await page.getTextContent();
                const lineStr = (textContent.items || [])
                    .map((it) => (it && typeof it.str === "string" ? it.str : ""))
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();
                if (lineStr) {
                    textPageCount++;
                    pageTexts.push(`[${p}페이지] ${lineStr}`);
                    totalLen += lineStr.length;
                    if (totalLen >= 200000) break;
                }
            }
            return {
                text: pageTexts.join("\n").slice(0, 200000),
                totalPages,
                textPageCount
            };
        } catch (err) {
            console.warn("[BlackHole PDF 텍스트 추출 실패]", err);
            return { text: "", totalPages: 0, textPageCount: 0 };
        }
    }

    async function extractPdfTextFromBytes(uint8Array, maxPages = 50) {
        const meta = await extractPdfTextMetaFromBytes(uint8Array, maxPages);
        return meta.text;
    }

    async function extractPdfTextFromFile(fileObj) {
        if (!fileObj || typeof fileObj.arrayBuffer !== "function") return "";
        try {
            const buf = await fileObj.arrayBuffer();
            return await extractPdfTextFromBytes(new Uint8Array(buf), 50);
        } catch (err) {
            console.warn("[BlackHole PDF 파일 읽기 실패]", err);
            return "";
        }
    }

    async function extractDocumentTextForAi(firstItem) {
        if (!firstItem) return { text: "", embeddedPdfBase64: "", embeddedImages: [] };
        const rawFileName = String(firstItem.name || "").trim();
        const lower = rawFileName.toLowerCase();

        // 1. PDF 파일: 내장 pdf.js로 페이지 텍스트 추출
        if (lower.endsWith(".pdf")) {
            const pdfTxt = await extractPdfTextFromFile(firstItem);
            if (pdfTxt) return { text: pdfTxt, embeddedPdfBase64: "", embeddedImages: [] };
        }

        // 2. 일반 텍스트 계열 (.txt, .md, .csv, .json, .html, .xml)
        if (/\.(txt|md|csv|json|html|htm|xml|log)$/i.test(lower) && typeof firstItem.text === "function") {
            try {
                let txt = (await firstItem.text()) || "";
                if (/\.(html|htm|xml)$/i.test(lower)) {
                    const tmp = document.createElement("div");
                    tmp.innerHTML = txt;
                    txt = (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
                }
                if (txt.trim()) return { text: txt.trim().slice(0, 200000), embeddedPdfBase64: "", embeddedImages: [] };
            } catch { }
        }

        // 3. 데스크톱 C# 브릿지로 .docx / .hwpx / .xlsx / .pptx / .hwp / .zip 텍스트 및 동봉 PDF·이미지 추출
        if (isDesktopWebViewEnv() && typeof firstItem.arrayBuffer === "function") {
            try {
                const b64 = await readFileAsBase64(firstItem);
                if (b64) {
                    const res = await callDesktopBridgeRequest(
                        "extractBlackHoleFileText",
                        { fileName: rawFileName, base64: b64 },
                        25000
                    );
                    if (res && res.ok) {
                        return {
                            text: res.text ? String(res.text).trim().slice(0, 200000) : "",
                            embeddedPdfBase64: res.embeddedPdfBase64 ? String(res.embeddedPdfBase64) : "",
                            embeddedImages: Array.isArray(res.embeddedImages) ? res.embeddedImages : []
                        };
                    }
                }
            } catch (err) {
                console.warn("[BlackHole C# 추출 브릿지 실패]", err);
            }
        }

        // 4. 바이너리/압축 문서는 생바이트(PK...) 깨짐 방지를 위해 firstItem.text() 금지
        if (/\.(docx|hwpx|zip|pdf|hwp|xlsx|pptx|doc|xls|ppt|png|jpg|jpeg|gif|webp|bmp|exe|dll)$/i.test(lower)) {
            return { text: "", embeddedPdfBase64: "", embeddedImages: [] };
        }
        if (typeof firstItem.text === "function") {
            try {
                const fallbackTxt = (await firstItem.text()) || "";
                if (/^PK[\x03\x05\x07]/.test(fallbackTxt)) {
                    return { text: "", embeddedPdfBase64: "", embeddedImages: [] };
                }
                const cleaned = fallbackTxt.replace(/\0/g, "").trim();
                if (cleaned) return { text: cleaned.slice(0, 200000), embeddedPdfBase64: "", embeddedImages: [] };
            } catch { }
        }
        return { text: "", embeddedPdfBase64: "", embeddedImages: [] };
    }

    async function executeDiskAutoFoldering(list, modeKey, folderLabel) {
        const categoryName = modeKey === "official" ? "공문" : modeKey === "memo" ? "쪽지" : "문서";
        const defaultFolderPath = `D:\\MY_Apps\\${categoryName}\\${folderLabel}`;
        const firstName = (Array.isArray(list) && list[0] && list[0].name) ? String(list[0].name).trim() : "문서.txt";
        const defaultDocPath = `${defaultFolderPath}\\${firstName}`;

        if (!isDesktopWebViewEnv()) {
            return {
                folderPath: defaultFolderPath,
                docFilePath: defaultDocPath
            };
        }

        try {
            const filesPayload = [];
            const maxFiles = Math.min(Array.isArray(list) ? list.length : 0, 8);
            for (let i = 0; i < maxFiles; i++) {
                const item = list[i];
                const name = String((item && item.name) || `문서_${i + 1}.txt`).trim();
                const b64 = (item && typeof item.arrayBuffer === "function")
                    ? await readFileAsBase64(item)
                    : "";
                filesPayload.push({ name, base64: b64 });
            }

            const res = await callDesktopBridgeRequest(
                "saveBlackHoleAutoFoldering",
                {
                    modeKey,
                    folderLabel,
                    files: filesPayload
                },
                18000
            );
            if (res && res.ok && res.folderPath) {
                return {
                    folderPath: res.folderPath,
                    docFilePath: res.primaryFilePath || `${res.folderPath}\\${firstName}`
                };
            }
        } catch { }

        return {
            folderPath: defaultFolderPath,
            docFilePath: defaultDocPath
        };
    }

    async function ensureBlackHoleTargetNoteFolder(modeKey) {
        if (typeof db === "undefined" || !db) return null;
        const sysType = modeKey === "official" ? "bh_official" : modeKey === "memo" ? "bh_memo" : "bh_doc";
        const syncId = modeKey === "official" ? "sys_bh_official" : modeKey === "memo" ? "sys_bh_memo" : "sys_bh_doc";
        const folderTitle = modeKey === "official" ? "공문 분석" : modeKey === "memo" ? "쪽지 분석" : "문서 분석";
        const globalId = modeKey === "official"
            ? (typeof globalBhOfficialFolderId !== "undefined" ? globalBhOfficialFolderId : null)
            : modeKey === "memo"
                ? (typeof globalBhMemoFolderId !== "undefined" ? globalBhMemoFolderId : null)
                : (typeof globalBhDocFolderId !== "undefined" ? globalBhDocFolderId : null);

        return new Promise((resolve) => {
            try {
                const tx = db.transaction(["memos"], "readwrite");
                const store = tx.objectStore("memos");
                const req = store.getAll();
                let resolvedId = null;

                req.onsuccess = (e) => {
                    const all = Array.isArray(e.target.result) ? e.target.result : [];
                    const existing = all.find(
                        (m) =>
                            m &&
                            m.type === "folder" &&
                            !m.isDeleted &&
                            !m.isPermanentlyDeleted &&
                            (
                                m.isSystem === sysType ||
                                m.syncId === syncId ||
                                (globalId !== null && m.id === globalId) ||
                                (!m.isSystem && (m.parentId === null || m.parentId === undefined) && String(m.title || "").trim() === folderTitle)
                            )
                    );
                    if (existing && existing.id !== undefined && existing.id !== null) {
                        let changed = false;
                        if (existing.isSystem !== sysType) {
                            existing.isSystem = sysType;
                            changed = true;
                        }
                        if (existing.syncId !== syncId) {
                            existing.syncId = syncId;
                            changed = true;
                        }
                        if (existing.title !== folderTitle) {
                            existing.title = folderTitle;
                            changed = true;
                        }
                        if (changed) store.put(existing);
                        resolvedId = existing.id;
                        return;
                    }
                    const addReq = store.add({
                        title: folderTitle,
                        type: "folder",
                        isSystem: sysType,
                        parentId: null,
                        parentSyncId: null,
                        syncId,
                        updatedAt: Date.now(),
                        isDeleted: false
                    });
                    addReq.onsuccess = (ev) => {
                        resolvedId = ev.target.result;
                    };
                };

                tx.oncomplete = () => {
                    try {
                        if (resolvedId !== null && resolvedId !== undefined) {
                            if (modeKey === "official" && typeof globalBhOfficialFolderId !== "undefined") {
                                globalBhOfficialFolderId = resolvedId;
                            } else if (modeKey === "memo" && typeof globalBhMemoFolderId !== "undefined") {
                                globalBhMemoFolderId = resolvedId;
                            } else if (modeKey === "summary" && typeof globalBhDocFolderId !== "undefined") {
                                globalBhDocFolderId = resolvedId;
                            }
                            if (typeof ensureSidebarExpandedInitialized === "function") {
                                ensureSidebarExpandedInitialized();
                            }
                            if (typeof sidebarExpandedSet !== "undefined" && sidebarExpandedSet && typeof sidebarExpandedSet.add === "function") {
                                sidebarExpandedSet.add(resolvedId);
                            }
                            if (typeof saveSidebarExpandedState === "function") {
                                saveSidebarExpandedState();
                            }
                        }
                    } catch { }
                    resolve(resolvedId);
                };
                tx.onerror = () => resolve(null);
            } catch {
                resolve(null);
            }
        });
    }

    async function requestTimelyAiCompletion(apiKey, preferredModelId, systemPrompt, userPrompt, images = []) {
        const trimmedKey = (apiKey || "").trim();
        if (!trimmedKey) {
            return {
                ok: false,
                error: "환경설정 > MY AI 개인 API 키에 연동 키(tgpt_s...)가 저장되어 있지 않습니다."
            };
        }

        const imageList = Array.isArray(images)
            ? images.filter((img) => img && img.base64).map((img) => ({
                mimeType: img.mimeType || "image/jpeg",
                base64: String(img.base64)
            }))
            : [];
        const hasImages = imageList.length > 0;
        let chosenModel = normalizeMyAiModelId(preferredModelId || MYAI_DEFAULT_MODEL_ID);
        if (hasImages && resolveMyAiProvider(chosenModel) === "upstage") {
            chosenModel = "gemini-3.8-flash";
        }

        if (isDesktopWebViewEnv()) {
            const res = await callDesktopBridgeRequest(
                "timelyAiChatRequest",
                {
                    apiKey: trimmedKey,
                    model: chosenModel,
                    systemPrompt,
                    userPrompt,
                    images: imageList
                },
                210000
            );
            if (res && res.ok && res.content) {
                if (/종료되었습니다|DIRECT_API_GUIDE/i.test(res.content)) {
                    return { ok: false, error: "Timely API 엔드포인트 오류가 감지되었습니다. 관리자에게 문의해 주세요." };
                }
                return { ok: true, content: res.content, model: res.model || chosenModel };
            }
            return {
                ok: false,
                error: (res && (res.error || res.message)) || "Timely AI 호출에 실패했습니다."
            };
        }

        const candidateModels = [chosenModel];
        const fallbackPool = hasImages
            ? ["gemini-3.8-flash", "gpt-5.6-sol", "claude-sonnet-5"]
            : ["gemini-3.8-flash", "claude-sonnet-5", "gpt-5.6-sol", "solar-pro4"];
        for (const m of fallbackPool) {
            if (!candidateModels.includes(m)) candidateModels.push(m);
        }

        const supportsOpenAiTemp = (mId) => {
            const lm = String(mId || "").trim().toLowerCase();
            if (!lm) return true;
            if (lm.startsWith("gpt-5")) return false;
            if (/^o[134](?:\b|-)/.test(lm)) return false;
            return true;
        };

        let lastErr = "Timely AI 서버 응답 실패";
        for (const modelName of candidateModels) {
            const provider = resolveMyAiProvider(modelName);
            if (hasImages && provider === "upstage") continue;

            let omitTemp = provider !== "upstage" && !supportsOpenAiTemp(modelName);
            for (let tempAttempt = 0; tempAttempt < 2; tempAttempt++) {
                try {
                    let url = "";
                    let headers = { "Content-Type": "application/json" };
                    let payload = null;

                    if (provider === "anthropic") {
                        url = "https://hello.timelyai.io/api/v2/chat/direct/anthropic/v1/messages";
                        headers["x-api-key"] = trimmedKey;
                        headers["anthropic-version"] = "2023-06-01";
                        const userContent = hasImages
                            ? [
                                ...imageList.map((img) => ({
                                    type: "image",
                                    source: { type: "base64", media_type: img.mimeType, data: img.base64 }
                                })),
                                { type: "text", text: userPrompt }
                            ]
                            : userPrompt;
                        payload = {
                            model: modelName,
                            max_tokens: 8192,
                            temperature: 0.0,
                            system: systemPrompt,
                            messages: [{ role: "user", content: userContent }]
                        };
                    } else if (provider === "google") {
                        url = `https://hello.timelyai.io/api/v2/chat/direct/google/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
                        headers["x-goog-api-key"] = trimmedKey;
                        const parts = hasImages
                            ? [
                                ...imageList.map((img) => ({
                                    inlineData: { mimeType: img.mimeType, data: img.base64 }
                                })),
                                { text: userPrompt }
                            ]
                            : [{ text: userPrompt }];
                        payload = {
                            systemInstruction: { parts: [{ text: systemPrompt }] },
                            contents: [{ role: "user", parts }],
                            generationConfig: { temperature: 0.0 }
                        };
                    } else {
                        url = provider === "upstage"
                            ? "https://hello.timelyai.io/api/v2/chat/direct/upstage/v1/chat/completions"
                            : "https://hello.timelyai.io/api/v2/chat/direct/openai/v1/chat/completions";
                        headers["Authorization"] = `Bearer ${trimmedKey}`;
                        const userMsgContent = hasImages
                            ? [
                                { type: "text", text: userPrompt },
                                ...imageList.map((img) => ({
                                    type: "image_url",
                                    image_url: { url: `data:${img.mimeType};base64,${img.base64}` }
                                }))
                            ]
                            : userPrompt;
                        payload = {
                            model: modelName,
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userMsgContent }
                            ]
                        };
                        if (!omitTemp) {
                            payload.temperature = 0.0;
                        }
                    }

                    const resp = await fetch(url, {
                        method: "POST",
                        headers,
                        body: JSON.stringify(payload)
                    });
                    const data = await resp.json().catch(() => null);
                    let extractedText = "";
                    if (resp.ok && data) {
                        if (provider === "anthropic" && Array.isArray(data.content)) {
                            extractedText = data.content.filter((c) => c && c.type === "text").map((c) => c.text || "").join("\n");
                        } else if (provider === "google" && Array.isArray(data.candidates)) {
                            const parts = data.candidates[0]?.content?.parts || [];
                            extractedText = parts.map((p) => p?.text || "").join("\n");
                        } else if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
                            extractedText = data.choices[0].message.content;
                        }
                    }
                    if (extractedText && !/종료되었습니다|DIRECT_API_GUIDE/i.test(extractedText)) {
                        return {
                            ok: true,
                            content: extractedText,
                            model: modelName
                        };
                    }
                    if (data && data.error) {
                        lastErr = typeof data.error === "string" ? data.error : (data.error.message || lastErr);
                    }
                    if (!omitTemp && tempAttempt === 0 && (provider === "openai" || provider === "upstage") &&
                        resp.status === 400 && /temperature/i.test(lastErr)) {
                        omitTemp = true;
                        continue;
                    }
                    if (resp.status === 401 || resp.status === 402) return { ok: false, error: lastErr };
                    break;
                } catch (err) {
                    lastErr = String(err && err.message ? err.message : err);
                    break;
                }
            }
        }
        return { ok: false, error: lastErr };
    }

    function parseAiStructuredJson(rawContent) {
        if (!rawContent || typeof rawContent !== "string") return null;
        let text = rawContent.trim();
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced && fenced[1]) {
            text = fenced[1].trim();
        } else {
            const firstBrace = text.indexOf("{");
            const lastBrace = text.lastIndexOf("}");
            if (firstBrace >= 0 && lastBrace > firstBrace) {
                text = text.slice(firstBrace, lastBrace + 1);
            }
        }
        try {
            const obj = JSON.parse(text);
            return obj && typeof obj === "object" ? obj : null;
        } catch {
            return null;
        }
    }

    // 원문에 실제로 등장하는 날짜인지 검증하여 할루시네이션 날짜를 0%로 차단
    function verifyDateExistsInSourceText(candidateDateStr, rawSourceText) {
        const s = String(candidateDateStr || "").trim();
        if (!s || !rawSourceText) return "";
        if (/^(?:없음|미정|해당\s*없음|미기재|불명|null|none|n\/a|-)$/i.test(s)) return "";

        const m = s.match(/(?:(\d{4})\s*[.\-/년]\s*)?(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
        if (!m) {
            return rawSourceText.includes(s) ? s : "";
        }
        const monthNum = parseInt(m[2], 10);
        const dayNum = parseInt(m[3], 10);
        if (isNaN(monthNum) || isNaN(dayNum)) return "";

        const mmPad = pad2(monthNum);
        const ddPad = pad2(dayNum);
        const patterns = [
            new RegExp(`(?<!\\d)${monthNum}\\s*[.\\-/월]\\s*${dayNum}(?!\\d)`),
            new RegExp(`(?<!\\d)${mmPad}\\s*[.\\-/월]\\s*${ddPad}(?!\\d)`),
            new RegExp(`(?<!\\d)${mmPad}${ddPad}(?!\\d)`)
        ];
        const exists = patterns.some((re) => re.test(rawSourceText));
        return exists ? s : "";
    }

    function cleanHallucinatedPlaceholder(val) {
        const s = String(val || "").trim();
        if (!s) return "";
        if (/^(?:없음|미정|해당\s*없음|미기재|불명|명시되지\s*않음|확인\s*불가|자체\s*검토|null|none|n\/a|-)$/i.test(s)) {
            return "";
        }
        return s;
    }

    function extractCompactYmdFromVerifiedDate(verifiedDateStr) {
        if (!verifiedDateStr) return "";
        const m = String(verifiedDateStr).match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
        if (m) {
            return `${m[1]}${pad2(m[2])}${pad2(m[3])}`;
        }
        return "";
    }

    function normalizeVerifiedDateWithYear(verifiedDateStr, referenceYear) {
        const s = String(verifiedDateStr || "").trim();
        if (!s) return "";
        if (/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/.test(s)) return s;
        const m = s.match(/(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
        const yr = Number(referenceYear) > 2000 ? Number(referenceYear) : new Date().getFullYear();
        if (m) {
            const mo = parseInt(m[1], 10);
            const dy = parseInt(m[2], 10);
            if (!isNaN(mo) && !isNaN(dy) && mo >= 1 && mo <= 12 && dy >= 1 && dy <= 31) {
                return `${yr}-${pad2(mo)}-${pad2(dy)}`;
            }
        }
        return s;
    }

    function isModelSupportingVision(modelId) {
        return resolveMyAiProvider(modelId) !== "upstage";
    }

    function pickVisionPreferredModel(selectedModelId) {
        const normSel = normalizeMyAiModelId(selectedModelId || MYAI_DEFAULT_MODEL_ID);
        if (isModelSupportingVision(normSel)) {
            const m = myAiActiveModels.find((x) => x.id === normSel);
            return {
                id: normSel,
                name: (m && m.name) ? m.name : formatLiveModelDisplayName(normSel),
                switchedFrom: ""
            };
        }
        const preferredOrder = ["gemini-3.8-flash", "gpt-5.6-sol", "claude-sonnet-5", "gpt-5.5", "claude-sonnet-4-6"];
        let chosen = null;
        for (const pid of preferredOrder) {
            const found = myAiActiveModels.find((m) => m.id === pid);
            if (found) {
                chosen = found;
                break;
            }
        }
        if (!chosen) {
            chosen = myAiActiveModels.find((m) => isModelSupportingVision(m.id)) || {
                id: "gemini-3.8-flash",
                name: "Gemini 3.8 Flash"
            };
        }
        const prevMeta = myAiActiveModels.find((m) => m.id === normSel);
        return {
            id: chosen.id,
            name: chosen.name || formatLiveModelDisplayName(chosen.id),
            switchedFrom: (prevMeta && prevMeta.name) ? prevMeta.name : formatLiveModelDisplayName(normSel)
        };
    }

    function resizeImageDataUrlToPayload(dataUrl, preferredMime = "image/jpeg", maxDim = 2000, quality = 0.86) {
        return new Promise((resolve) => {
            try {
                const img = new Image();
                img.onload = () => {
                    try {
                        let w = img.naturalWidth || img.width || 0;
                        let h = img.naturalHeight || img.height || 0;
                        if (w <= 0 || h <= 0) {
                            resolve(null);
                            return;
                        }
                        if (Math.max(w, h) > maxDim) {
                            const scale = maxDim / Math.max(w, h);
                            w = Math.max(1, Math.round(w * scale));
                            h = Math.max(1, Math.round(h * scale));
                        }
                        const cvs = document.createElement("canvas");
                        cvs.width = w;
                        cvs.height = h;
                        const ctx = cvs.getContext("2d");
                        if (!ctx) {
                            resolve(null);
                            return;
                        }
                        if (preferredMime === "image/jpeg") {
                            ctx.fillStyle = "#ffffff";
                            ctx.fillRect(0, 0, w, h);
                        }
                        ctx.drawImage(img, 0, 0, w, h);
                        const outDataUrl = cvs.toDataURL(preferredMime, quality);
                        const commaIdx = outDataUrl.indexOf(",");
                        if (commaIdx < 0) {
                            resolve(null);
                            return;
                        }
                        resolve({
                            mimeType: preferredMime,
                            base64: outDataUrl.slice(commaIdx + 1)
                        });
                    } catch {
                        resolve(null);
                    }
                };
                img.onerror = () => resolve(null);
                img.src = dataUrl;
            } catch {
                resolve(null);
            }
        });
    }

    function readFileAsDataUrl(fileObj) {
        return new Promise((resolve) => {
            try {
                const reader = new FileReader();
                reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
                reader.onerror = () => resolve("");
                reader.readAsDataURL(fileObj);
            } catch {
                resolve("");
            }
        });
    }

    async function extractImagePayloadFromFile(fileObj, maxDim = 2000, quality = 0.86) {
        if (!fileObj) return null;
        const mime = /\.png$/i.test(fileObj.name || "") ? "image/png" : "image/jpeg";
        const objUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
            ? URL.createObjectURL(fileObj)
            : "";
        try {
            if (objUrl) {
                const payload = await resizeImageDataUrlToPayload(objUrl, mime, maxDim, quality);
                if (payload) return payload;
            }
            const dataUrl = await readFileAsDataUrl(fileObj);
            if (dataUrl) {
                return await resizeImageDataUrlToPayload(dataUrl, mime, maxDim, quality);
            }
            return null;
        } catch {
            return null;
        } finally {
            if (objUrl) {
                try { URL.revokeObjectURL(objUrl); } catch { }
            }
        }
    }

    async function extractImagesFromFileList(fileList, maxImages = 20) {
        const imgs = [];
        const targets = (Array.isArray(fileList) ? fileList : []).filter(
            (f) => f && /\.(png|jpe?g|webp|gif|bmp)$/i.test(String(f.name || ""))
        ).slice(0, maxImages);
        const isBulk = targets.length > 10;
        const maxDim = isBulk ? 1500 : 2000;
        const quality = isBulk ? 0.76 : 0.86;
        for (const f of targets) {
            const payload = await extractImagePayloadFromFile(f, maxDim, quality);
            if (payload) imgs.push(payload);
        }
        return imgs;
    }

    async function renderScannedPdfPagesToImages(fileOrBytes, maxPages = 20) {
        if (!fileOrBytes) return [];
        try {
            let uint8 = null;
            if (fileOrBytes instanceof Uint8Array) {
                uint8 = fileOrBytes;
            } else if (typeof fileOrBytes.arrayBuffer === "function") {
                const buf = await fileOrBytes.arrayBuffer();
                uint8 = new Uint8Array(buf);
            }
            if (!uint8 || uint8.length === 0) return [];

            const pdfDoc = await loadPdfDocumentWithLocalWorker(uint8);
            const total = Math.min(pdfDoc.numPages || 1, maxPages);
            const isLarge = total > 10;
            const scale = isLarge ? 1.25 : 1.5;
            const quality = isLarge ? 0.72 : 0.80;
            const results = [];
            for (let p = 1; p <= total; p++) {
                const page = await pdfDoc.getPage(p);
                const viewport = page.getViewport({ scale });
                const cvs = document.createElement("canvas");
                cvs.width = Math.max(1, Math.round(viewport.width));
                cvs.height = Math.max(1, Math.round(viewport.height));
                const ctx = cvs.getContext("2d");
                if (!ctx) continue;
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, cvs.width, cvs.height);
                await page.render({ canvasContext: ctx, viewport }).promise;
                const dataUrl = cvs.toDataURL("image/jpeg", quality);
                const commaIdx = dataUrl.indexOf(",");
                if (commaIdx >= 0) {
                    results.push({
                        mimeType: "image/jpeg",
                        base64: dataUrl.slice(commaIdx + 1)
                    });
                }
            }
            return results;
        } catch (err) {
            console.warn("[BlackHole 스캔 PDF 이미지 렌더링 실패]", err);
            return [];
        }
    }

    function isPdfTextTooSparse(pdfText, totalPages, textPageCount) {
        const pureChars = String(pdfText || "").replace(/\[\d+페이지\]/g, "").replace(/\s+/g, "");
        const headerCount = (String(pdfText || "").match(/\[\d+페이지\]/g) || []).length;
        const pages = Math.max(1, Number(totalPages) || headerCount || 1);
        const textPages = Number.isFinite(textPageCount) ? textPageCount : headerCount;
        return pureChars.length < Math.max(40, pages * 25) || (pages >= 2 && textPages < Math.ceil(pages * 0.5));
    }

    async function extractDocumentImagesAndTextForAi(itemsList) {
        const list = Array.isArray(itemsList) ? itemsList.filter(Boolean) : [itemsList].filter(Boolean);
        if (list.length === 0) return { text: "", images: [], isVisualInput: false, isScannedPdf: false };
        const firstItem = list[0];
        const rawFileName = String(firstItem.name || "").trim();
        const lower = rawFileName.toLowerCase();

        if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(lower)) {
            const imgs = await extractImagesFromFileList(list, 20);
            return { text: "", images: imgs, isVisualInput: true, isScannedPdf: false };
        }

        if (lower.endsWith(".pdf")) {
            let pdfBytes = null;
            try {
                if (typeof firstItem.arrayBuffer === "function") {
                    pdfBytes = new Uint8Array(await firstItem.arrayBuffer());
                }
            } catch (err) {
                console.warn("[BlackHole PDF 버퍼 읽기 실패]", err);
            }
            const meta = pdfBytes ? await extractPdfTextMetaFromBytes(pdfBytes, 50) : { text: "", totalPages: 0, textPageCount: 0 };
            if (isPdfTextTooSparse(meta.text, meta.totalPages, meta.textPageCount)) {
                const scannedImgs = pdfBytes ? await renderScannedPdfPagesToImages(pdfBytes, 20) : [];
                if (scannedImgs.length > 0) {
                    return { text: meta.text, images: scannedImgs, isVisualInput: true, isScannedPdf: true };
                }
            }
            return { text: meta.text, images: [], isVisualInput: false, isScannedPdf: false };
        }

        const docRes = await extractDocumentTextForAi(firstItem);
        let text = docRes.text || "";
        const images = [];

        if (docRes.embeddedPdfBase64 && text.replace(/\s+/g, "").length < 100) {
            try {
                const pdfBytes = base64ToUint8Array(docRes.embeddedPdfBase64);
                const meta = await extractPdfTextMetaFromBytes(pdfBytes, 50);
                if (meta.text) {
                    text = text ? `${text}\n\n${meta.text}` : meta.text;
                }
                if (isPdfTextTooSparse(meta.text, meta.totalPages, meta.textPageCount)) {
                    const scannedImgs = await renderScannedPdfPagesToImages(pdfBytes, 20);
                    if (scannedImgs.length > 0) {
                        return { text, images: scannedImgs, isVisualInput: true, isScannedPdf: true };
                    }
                }
            } catch (err) {
                console.warn("[BlackHole ZIP 동봉 PDF 추출 실패]", err);
            }
        }

        if (images.length === 0 && (!text || text.replace(/\s+/g, "").length < 40) && Array.isArray(docRes.embeddedImages) && docRes.embeddedImages.length > 0) {
            const rawImgs = docRes.embeddedImages.slice(0, 20);
            const isBulk = rawImgs.length > 10;
            for (const item of rawImgs) {
                if (!item || !item.base64) continue;
                const mime = item.mimeType || "image/jpeg";
                const dataUrl = `data:${mime};base64,${item.base64}`;
                const normalized = await resizeImageDataUrlToPayload(
                    dataUrl,
                    mime === "image/png" ? "image/png" : "image/jpeg",
                    isBulk ? 1500 : 2000,
                    isBulk ? 0.76 : 0.86
                );
                if (normalized) images.push(normalized);
            }
            if (images.length > 0) {
                return { text, images, isVisualInput: true, isScannedPdf: false };
            }
        }

        return { text, images: [], isVisualInput: false, isScannedPdf: false };
    }

    function buildOfficialOrMemoNoteHtml({
        headerBadge,
        docTitleText,
        verifiedDueDate,
        verifiedSubmitTarget,
        summaryLead,
        coreContent,
        keyPoints,
        copiedAttachments,
        docFilePath,
        folderPath,
        modeKey,
        foldChecked
    }) {
        const htmlParts = [
            `<p><strong>${escapeHtmlStr(headerBadge)}</strong></p>`
        ];

        if (summaryLead) {
            htmlParts.push(`<blockquote><span style="background-color: rgb(254, 240, 138);">${escapeHtmlStr(summaryLead)}</span></blockquote>`);
        }

        htmlParts.push(`<p><br></p>`);
        htmlParts.push([
            `<table><tbody>`,
            `<tr>`,
            `<td data-row="row-1"><strong>문서명</strong></td>`,
            `<td data-row="row-1"><strong>일정 / 기한</strong></td>`,
            `<td data-row="row-1"><strong>장소 / 제출처</strong></td>`,
            `<td data-row="row-1"><strong>핵심 내용</strong></td>`,
            `</tr>`,
            `<tr>`,
            `<td data-row="row-2">${escapeHtmlStr(docTitleText)}</td>`,
            `<td data-row="row-2">${escapeHtmlStr(verifiedDueDate)}</td>`,
            `<td data-row="row-2">${escapeHtmlStr(verifiedSubmitTarget)}</td>`,
            `<td data-row="row-2">${escapeHtmlStr(coreContent)}</td>`,
            `</tr>`,
            `</tbody></table>`
        ].join(""));

        if (Array.isArray(keyPoints) && keyPoints.length > 0) {
            const liHtml = keyPoints
                .map((pt) => `<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>${escapeHtmlStr(pt)}</li>`)
                .join("");
            htmlParts.push(`<p><br></p><p><strong>주요 내용</strong></p><ol>${liHtml}</ol>`);
        }

        if (Array.isArray(copiedAttachments) && copiedAttachments.length > 0) {
            const attLiHtml = copiedAttachments
                .map((fn) => `<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>${escapeHtmlStr(fn)}</li>`)
                .join("");
            htmlParts.push(`<p><br></p><p><strong>첨부파일 (원본 복사 보관)</strong></p><ol>${attLiHtml}</ol>`);
        }

        const linkLabel = modeKey === "official" ? "공문 열기" : modeKey === "memo" ? "쪽지 보기" : "문서 열기";
        if (foldChecked && folderPath) {
            htmlParts.push(`<p><br></p><p><strong>원본 및 폴더 바로가기</strong>: <a href="${escapeHtmlStr(docFilePath)}" target="_blank" rel="noopener noreferrer">${linkLabel}</a>  |  <a href="${escapeHtmlStr(folderPath)}" target="_blank" rel="noopener noreferrer">폴더 열기</a></p>`);
        }

        return htmlParts.join("");
    }

    function promptMemoTitleConfirmation({ draftTitle, folderDatePrefix, foldChecked, attachmentNames }) {
        return new Promise((resolve) => {
            const modal = document.getElementById("zen-memo-title-modal");
            const input = document.getElementById("zen-mt-title-input");
            const previewWrap = document.getElementById("zen-mt-folder-preview-wrap");
            const previewPath = document.getElementById("zen-mt-folder-preview");
            const attachWrap = document.getElementById("zen-mt-attach-wrap");
            const attachList = document.getElementById("zen-mt-attach-list");
            const confirmBtn = document.getElementById("zen-mt-confirm-btn");
            const cancelBtn = document.getElementById("zen-mt-cancel-btn");
            const closeBtn = document.getElementById("zen-mt-close-btn");

            const baseDraft = String(draftTitle || "").trim() || "새 쪽지";
            if (!modal || !input) {
                resolve(baseDraft);
                return;
            }

            const updatePreview = () => {
                if (!previewWrap || !previewPath) return;
                if (!foldChecked) {
                    previewWrap.style.display = "none";
                    return;
                }
                previewWrap.style.display = "block";
                const rawVal = (input.value || "").trim() || baseDraft;
                const safeFolderName = rawVal.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 48) || "쪽지";
                previewPath.textContent = `D:\\MY_Apps\\쪽지\\${folderDatePrefix}_${safeFolderName}\\`;
            };

            input.value = baseDraft;
            updatePreview();

            if (attachWrap && attachList) {
                const names = Array.isArray(attachmentNames) ? attachmentNames.filter(Boolean) : [];
                if (names.length > 0) {
                    attachWrap.style.display = "block";
                    attachList.innerHTML = names.map((nm, i) => `${i + 1}. ${escapeHtmlStr(nm)}`).join("<br>");
                } else {
                    attachWrap.style.display = "none";
                    attachList.innerHTML = "";
                }
            }

            modal.style.display = "flex";
            setTimeout(() => {
                try {
                    input.focus();
                    input.select();
                } catch { }
            }, 30);

            let settled = false;
            const cleanup = () => {
                input.removeEventListener("input", onInput);
                input.removeEventListener("keydown", onInputKeydown);
                document.removeEventListener("keydown", onDocKeydown, true);
                modal.removeEventListener("click", onOverlayClick);
                if (confirmBtn) confirmBtn.removeEventListener("click", onConfirm);
                if (cancelBtn) cancelBtn.removeEventListener("click", onCancel);
                if (closeBtn) closeBtn.removeEventListener("click", onCancel);
                modal.style.display = "none";
            };
            const finish = (val) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(val);
            };
            const onInput = () => updatePreview();
            const onConfirm = () => finish((input.value || "").trim() || baseDraft);
            const onCancel = () => finish(null);
            const onOverlayClick = (e) => {
                if (e.target === modal) onCancel();
            };
            const onInputKeydown = (e) => {
                if (e.isComposing) return;
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    onConfirm();
                }
            };
            const onDocKeydown = (e) => {
                if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    onCancel();
                }
            };

            input.addEventListener("input", onInput);
            input.addEventListener("keydown", onInputKeydown);
            document.addEventListener("keydown", onDocKeydown, true);
            modal.addEventListener("click", onOverlayClick);
            if (confirmBtn) confirmBtn.addEventListener("click", onConfirm);
            if (cancelBtn) cancelBtn.addEventListener("click", onCancel);
            if (closeBtn) closeBtn.addEventListener("click", onCancel);
        });
    }

    async function finalizeMemoSummaryAfterTitleConfirm(pendingRes, confirmedTitle) {
        const finalTitle = String(confirmedTitle || pendingRes?.draftTitle || "새 쪽지").trim() || "새 쪽지";
        const safeSubjForFolder = finalTitle
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, "_")
            .slice(0, 48) || "쪽지";
        const folderLabel = `${pendingRes.folderDatePrefix}_${safeSubjForFolder}`;

        let folderPath = "";
        let docFilePath = "";
        let targetNoteFolderId = null;

        if (pendingRes.foldChecked) {
            if (pendingRes.tucPayload && isDesktopWebViewEnv()) {
                const tuc = pendingRes.tucPayload;
                const attPaths = Array.isArray(tuc.attachments)
                    ? tuc.attachments.map((a) => a && a.fullPath).filter(Boolean)
                    : [];
                const diskRes = await callDesktopBridgeRequest(
                    "saveMiryangMemoAutoFoldering",
                    {
                        folderLabel,
                        senderLabel: tuc.senderLabel || "",
                        windowTitle: tuc.windowTitle || "",
                        sentAtText: tuc.sentAtText || tuc.capturedAtText || "",
                        capturedAtText: tuc.capturedAtText || "",
                        bodyText: tuc.bodyText || "",
                        bodyHtml: tuc.bodyHtml || "",
                        screenshotBase64: tuc.screenshotBase64 || "",
                        attachmentPaths: attPaths
                    },
                    25000
                );
                if (diskRes && diskRes.ok && diskRes.folderPath) {
                    folderPath = diskRes.folderPath;
                    docFilePath = diskRes.primaryFilePath || `${diskRes.folderPath}\\쪽지_원문.html`;
                } else {
                    folderPath = `D:\\MY_Apps\\쪽지\\${folderLabel}`;
                    docFilePath = `${folderPath}\\쪽지_원문.html`;
                }
            } else {
                const diskRes = await executeDiskAutoFoldering(pendingRes.list || [], "memo", folderLabel);
                folderPath = diskRes.folderPath;
                docFilePath = diskRes.docFilePath;
            }
            targetNoteFolderId = await ensureBlackHoleTargetNoteFolder("memo");
        }

        const attNames = pendingRes.tucPayload && Array.isArray(pendingRes.tucPayload.attachments)
            ? pendingRes.tucPayload.attachments.map((a) => a && a.name).filter(Boolean)
            : [];
        const noteTitle = pendingRes.compactDue ? `${finalTitle} (${pendingRes.compactDue}까지)` : finalTitle;
        const html = buildOfficialOrMemoNoteHtml({
            headerBadge: pendingRes.headerBadge,
            docTitleText: finalTitle,
            verifiedDueDate: pendingRes.verifiedDueDate,
            verifiedSubmitTarget: pendingRes.verifiedSubmitTarget,
            summaryLead: pendingRes.summaryLead,
            coreContent: pendingRes.coreContent,
            keyPoints: pendingRes.keyPoints,
            copiedAttachments: pendingRes.foldChecked ? attNames : [],
            docFilePath,
            folderPath,
            modeKey: "memo",
            foldChecked: pendingRes.foldChecked
        });

        return {
            title: noteTitle,
            html,
            targetFolderId: targetNoteFolderId,
            usedRealAi: true,
            modelName: pendingRes.displayModelBadge
        };
    }

    async function buildBlackHoleSummaryResult(list, modeKey, foldChecked, options = {}) {
        const preExtracted = (options && options.preExtracted) || null;
        const firstItem = (Array.isArray(list) && list[0]) ? list[0] : { name: "문서.txt" };
        const rawFileName = preExtracted
            ? String(preExtracted.rawFileName || "받은 쪽지").trim()
            : String(firstItem.name || "문서").trim();
        const baseName = preExtracted
            ? String(preExtracted.baseName || "새 쪽지").trim()
            : (rawFileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim() || "문서");
        const selectedModelMeta = getSelectedMyAiModelMeta();
        const conciseReportMode = !!(options && options.conciseChecked);
        const customUserPrompt = String((options && options.userPromptText) || "").trim();

        // 1. 문서 본문 텍스트 또는 이미지/스캔 PDF 추출 (다중 이미지·ZIP 내 PDF 포함 최대 20장)
        const extractedInput = preExtracted
            ? {
                text: preExtracted.rawFileText || "",
                images: Array.isArray(preExtracted.extractedImages) ? preExtracted.extractedImages : []
            }
            : await extractDocumentImagesAndTextForAi(list);
        const rawFileText = extractedInput.text || "";
        const extractedImages = Array.isArray(extractedInput.images) ? extractedInput.images : [];
        const hasImages = extractedImages.length > 0;
        const referenceYear = preExtracted && Number(preExtracted.referenceYear) > 2000
            ? Number(preExtracted.referenceYear)
            : new Date().getFullYear();
        const isForwardedMemo = modeKey === "memo" && (
            (preExtracted && preExtracted.isForwarded) ||
            /-{3,}\s*원본\s*내용\s*-{3,}/.test(rawFileText)
        );
        const savedApiKey = getSavedMyAiApiKey();

        let aiData = null;
        let aiErrorNotice = "";
        let targetModelId = selectedModelMeta.id;
        let resolvedModelName = selectedModelMeta.name;
        let autoSwitchedFrom = "";

        if (hasImages) {
            const visionPick = pickVisionPreferredModel(selectedModelMeta.id);
            targetModelId = visionPick.id;
            resolvedModelName = visionPick.name;
            autoSwitchedFrom = visionPick.switchedFrom;
        }

        if (!savedApiKey) {
            aiErrorNotice = "환경설정 > MY AI 개인 API 키에 연동 키(tgpt_s...)를 먼저 저장해 주세요.";
        } else if (!rawFileText && !hasImages) {
            aiErrorNotice = "이 문서 형식에서 텍스트 본문이나 이미지를 추출할 수 없습니다.";
        } else {
            const zeroHallucinationRules = [
                "[절대 불가침 할루시네이션 0% 규칙]",
                "1. 제공된 [문서 원문] 또는 첨부 이미지에 명시적으로 적혀 있는 사실만 100% 그대로 요약하세요.",
                "2. 문서/이미지에 없는 날짜, 시간, 기한, 마감일, 장소, 제출처, 부서명, 담당자, 지시사항을 절대로 추측하거나 임의로 만들어내지 마세요.",
                "3. 해당 정보가 없거나 판독이 불확실하면 반드시 빈 문자열(\"\")로 비워 두세요. ('없음', '미정', '자체 검토' 같은 임의 문구도 넣지 말고 완전히 빈 문자열 \"\"로 두세요.)",
                "4. 원문이 매뉴얼·안내서·참고자료인 경우 억지로 업무 지시나 과제처럼 바꾸지 말고, 문서 본래의 핵심 내용만 객관적으로 요약하세요."
            ].join("\n");

            const reportStyleRule = conciseReportMode
                ? "[보고서 작성 형식]\n- 하단 상세 내용(sections 또는 keyPoints)은 개조식(핵심 요점 나열)으로 1장 보고서 분량에 맞게 간결하고 구조화하여 작성하세요. 상단 핵심 요약(summaryLead/overview)은 1~2문장으로 유지하세요."
                : "[보고서 작성 형식]\n- 상단 인용구용 핵심 요지(summaryLead/overview)는 1~2문장으로 짧고 명확하게 유지하되, 보고서 하단의 상세 정리(sections 또는 keyPoints)에는 분량·줄 수·항목 수 제한을 두지 말고 원문에 담긴 핵심·세부 정보를 빠뜨리지 않도록 AI가 판단해 충실하고 자유롭게 정리하세요.";

            const memoExtraRules = modeKey === "memo"
                ? [
                    `[쪽지 제목 초안 작성 규칙] 쪽지 헤더 제목은 비어 있는 경우가 많으므로 기존 파일명·빈 제목에 의존하지 말고 쪽지 본문의 핵심 업무를 압축한 명확하고 간결한 제목 초안(title)을 25자 이내로 직접 작성하세요.`,
                    isForwardedMemo
                        ? `[전달 쪽지 처리 규칙] 이 쪽지는 전달된 쪽지입니다. '원본 내용' 구분선 아래의 원본 본문에서 핵심 일정·기한·제출처·요청사항을 우선 기준으로 추출하고, 상단 전달자의 추가 지시도 함께 반영하세요.`
                        : "",
                    `[기준 연도 안내] 이 쪽지의 발신·수신 기준 연도는 ${referenceYear}년입니다. 본문에 '11.23.(월)'처럼 연도가 생략된 날짜가 있으면 반드시 '${referenceYear}-MM-DD' 형식으로 표기하세요.`
                ].filter(Boolean).join("\n")
                : "";

            const systemPrompt = modeKey === "summary"
                ? [
                    "당신은 정확하고 신뢰할 수 있는 문서 요약 AI입니다.",
                    zeroHallucinationRules,
                    reportStyleRule,
                    "반드시 아래 JSON 스키마 형식으로만 응답하세요 (코드블록 없이 순수 JSON만 출력):",
                    "{",
                    '  "title": "원문에 기반한 문서 제목 (원문 제목이 있으면 그대로 사용)",',
                    '  "overview": "상단 인용구용 문서 전체 핵심 요지 (원문 사실만 1~2문장으로 간결히 기재)",',
                    '  "highlightSentence": "문서에서 가장 핵심이 되는 1문장 (원문 사실만 기재)",',
                    '  "sections": [',
                    '    { "heading": "주제/장절 제목", "points": ["원문에 근거한 세부 정리 내용..."] }',
                    "  ]",
                    "}"
                ].join("\n")
                : [
                    `당신은 대한민국 행정·업무 ${modeKey === "official" ? "공문서" : "쪽지"} 분석 AI입니다.`,
                    zeroHallucinationRules,
                    memoExtraRules,
                    reportStyleRule,
                    "반드시 아래 JSON 스키마 형식으로만 응답하세요 (코드블록 없이 순수 JSON만 출력):",
                    "{",
                    `  "title": "${modeKey === "memo" ? "쪽지 본문의 핵심 업무를 압축한 간결한 쪽지 제목 초안 (25자 이내)" : "원문에 명시된 공문 제목"}",`,
                    '  "dueDate": "원문에 명시된 제출/회신 마감일 또는 일시 (연도가 생략된 경우 기준 연도를 보정해 YYYY-MM-DD 형식 또는 원문 그대로 기재, 마감일/기한이 없으면 반드시 빈 문자열 \\"\\")",',
                    '  "submitTarget": "원문에 명시된 제출처/회신처/장소 (원문에 제출처나 장소가 없으면 반드시 빈 문자열 \\"\\")",',
                    '  "summaryLead": "상단 인용구용 핵심 요지 (원문에 있는 사실만 1~2문장으로 간결히 기재)",',
                    '  "coreContent": "표의 핵심 내용 칸에 들어갈 요지 (원문에 있는 사실만 기재)",',
                    '  "keyPoints": ["원문에 명시된 본문 내용, 세부 사항, 협조·조치 사항 등을 제한 없이 충실히 정리..."]',
                    "}"
                ].filter(Boolean).join("\n");

            const userPromptSections = [];
            if (customUserPrompt) {
                userPromptSections.push(`[사용자 추가 프롬프트 (할루시네이션 0% 원칙 범위 내에서 최우선 반영)]\n${customUserPrompt}`);
            }
            if (rawFileText && hasImages) {
                userPromptSections.push(`파일명: ${rawFileName}\n\n[문서 원문(일부 추출)]\n${rawFileText}`);
                userPromptSections.push(`[첨부 이미지/스캔 문서(${extractedImages.length}장)도 함께 정밀 판독하여 텍스트·표·도표 내용을 모두 반영해 위 JSON 스키마 형식으로 분석·요약하세요.]`);
            } else if (rawFileText) {
                userPromptSections.push(`파일명: ${rawFileName}\n\n[문서 원문]\n${rawFileText}`);
            } else {
                userPromptSections.push(`파일명: ${rawFileName}\n\n[첨부 이미지/스캔 문서(${extractedImages.length}장)를 직접 판독해 위 JSON 스키마 형식으로 분석·요약하세요.]`);
            }
            const userPrompt = userPromptSections.join("\n\n");
            const aiResp = await requestTimelyAiCompletion(savedApiKey, targetModelId, systemPrompt, userPrompt, extractedImages);

            if (aiResp && aiResp.ok && aiResp.content) {
                if (aiResp.model) {
                    const normRespId = normalizeMyAiModelId(aiResp.model);
                    const matched = myAiActiveModels.find((m) => m.id === normRespId);
                    resolvedModelName = (matched && matched.name) ? matched.name : formatLiveModelDisplayName(normRespId);
                    if (normRespId !== normalizeMyAiModelId(selectedModelMeta.id) && !autoSwitchedFrom) {
                        autoSwitchedFrom = selectedModelMeta.name;
                    }
                }
                aiData = parseAiStructuredJson(aiResp.content);
                if (!aiData) {
                    const cleanLines = aiResp.content
                        .replace(/```[\s\S]*?```/g, "")
                        .split(/\r?\n/)
                        .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
                        .filter(Boolean);
                    if (modeKey === "summary") {
                        aiData = {
                            title: baseName,
                            overview: cleanLines[0] || "",
                            highlightSentence: cleanLines[1] || cleanLines[0] || "",
                            sections: [{ heading: "주요 내용", points: cleanLines.slice(1) }]
                        };
                    } else {
                        aiData = {
                            title: baseName,
                            dueDate: "",
                            submitTarget: "",
                            summaryLead: cleanLines[0] || "",
                            coreContent: cleanLines[0] || "",
                            keyPoints: cleanLines.slice(1)
                        };
                    }
                }
            } else {
                aiErrorNotice = (aiResp && aiResp.error) || "AI 응답을 가져오지 못했습니다.";
            }
        }

        const displayModelBadge = autoSwitchedFrom
            ? `${autoSwitchedFrom} → ${resolvedModelName} 자동 전환`
            : resolvedModelName;

        // 2. 원문 대조를 통한 날짜·제출처 할루시네이션 2중 검증
        let verifiedDueDate = (aiData && aiData.dueDate)
            ? (rawFileText && !hasImages
                ? verifyDateExistsInSourceText(aiData.dueDate, rawFileText)
                : cleanHallucinatedPlaceholder(aiData.dueDate))
            : "";
        if (verifiedDueDate && modeKey === "memo") {
            verifiedDueDate = normalizeVerifiedDateWithYear(verifiedDueDate, referenceYear);
        }
        const verifiedSubmitTarget = (aiData && aiData.submitTarget)
            ? cleanHallucinatedPlaceholder(aiData.submitTarget)
            : "";
        const compactDue = extractCompactYmdFromVerifiedDate(verifiedDueDate);

        // 3. 날짜 접두어 & 초안 제목
        const folderDatePrefix = compactDue || getLocalTodayCompact();
        const rawSubj = cleanHallucinatedPlaceholder(aiData && aiData.title) || baseName;

        // 4. [쪽지 분석 모드] AI 성공 시 사용자 최종 제목 확정 모달을 띄운 뒤 자동 폴더링·노트 저장 실행
        if (modeKey === "memo" && aiData && !aiErrorNotice) {
            const summaryLead = cleanHallucinatedPlaceholder(aiData.summaryLead);
            const coreContent = cleanHallucinatedPlaceholder(aiData.coreContent);
            const keyPoints = Array.isArray(aiData.keyPoints)
                ? aiData.keyPoints.map((p) => cleanHallucinatedPlaceholder(p)).filter(Boolean)
                : [];
            return {
                needsMemoTitleConfirmation: true,
                draftTitle: rawSubj,
                modeKey: "memo",
                foldChecked: !!foldChecked,
                folderDatePrefix,
                compactDue,
                verifiedDueDate,
                verifiedSubmitTarget,
                displayModelBadge,
                headerBadge: `[MY AI 쪽지 분석 · ${displayModelBadge}]`,
                summaryLead,
                coreContent,
                keyPoints,
                rawFileName,
                list,
                tucPayload: preExtracted ? preExtracted.tucPayload : null,
                usedRealAi: true,
                modelName: displayModelBadge
            };
        }

        // 5. 자동 폴더링 실행 (공문 분석 / 문서 요약 / 오류 폴백)
        const safeSubjForFolder = rawSubj
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, "_")
            .slice(0, 48);
        const folderLabel = `${folderDatePrefix}_${safeSubjForFolder}`;

        let folderPath = "";
        let docFilePath = "";
        let targetNoteFolderId = null;

        if (foldChecked) {
            if (preExtracted && preExtracted.tucPayload && isDesktopWebViewEnv()) {
                const tuc = preExtracted.tucPayload;
                const attPaths = Array.isArray(tuc.attachments)
                    ? tuc.attachments.map((a) => a && a.fullPath).filter(Boolean)
                    : [];
                const diskRes = await callDesktopBridgeRequest(
                    "saveMiryangMemoAutoFoldering",
                    {
                        folderLabel,
                        senderLabel: tuc.senderLabel || "",
                        windowTitle: tuc.windowTitle || "",
                        sentAtText: tuc.sentAtText || tuc.capturedAtText || "",
                        capturedAtText: tuc.capturedAtText || "",
                        bodyText: tuc.bodyText || "",
                        bodyHtml: tuc.bodyHtml || "",
                        screenshotBase64: tuc.screenshotBase64 || "",
                        attachmentPaths: attPaths
                    },
                    25000
                );
                if (diskRes && diskRes.ok && diskRes.folderPath) {
                    folderPath = diskRes.folderPath;
                    docFilePath = diskRes.primaryFilePath || `${diskRes.folderPath}\\쪽지_원문.html`;
                }
            } else {
                const diskRes = await executeDiskAutoFoldering(list, modeKey, folderLabel);
                folderPath = diskRes.folderPath;
                docFilePath = diskRes.docFilePath;
            }
            targetNoteFolderId = await ensureBlackHoleTargetNoteFolder(modeKey);
        }

        const linkLabel = modeKey === "official" ? "공문 열기" : modeKey === "memo" ? "쪽지 보기" : "문서 열기";
        const linksHtml = foldChecked && folderPath
            ? `<p><br></p><p><strong>원본 및 폴더 바로가기</strong>: <a href="${escapeHtmlStr(docFilePath)}" target="_blank" rel="noopener noreferrer">${linkLabel}</a>  |  <a href="${escapeHtmlStr(folderPath)}" target="_blank" rel="noopener noreferrer">폴더 열기</a></p>`
            : "";

        // 6. [일반 문서 요약 모드] 억지 4칸 표(기한/제출처) 없이 문서 본연의 핵심만 깔끔하게 구성
        if (modeKey === "summary") {
            const noteTitle = rawSubj;
            if (!aiData) {
                const errHtml = [
                    `<p><strong>[MY AI 문서 분석 · ${escapeHtmlStr(displayModelBadge)}]</strong></p>`,
                    `<blockquote>${escapeHtmlStr(aiErrorNotice || "문서를 요약할 수 없습니다.")}</blockquote>`,
                    linksHtml
                ].join("");
                return { title: noteTitle, html: errHtml, targetFolderId: targetNoteFolderId, aiErrorNotice, modelName: displayModelBadge };
            }

            const overview = cleanHallucinatedPlaceholder(aiData.overview);
            const highlightSentence = cleanHallucinatedPlaceholder(aiData.highlightSentence);
            const htmlParts = [
                `<p><strong>[MY AI 문서 핵심 요약 · ${escapeHtmlStr(displayModelBadge)}]</strong></p>`
            ];

            if (overview || highlightSentence) {
                const qParts = [];
                if (overview) qParts.push(escapeHtmlStr(overview));
                if (highlightSentence && highlightSentence !== overview) {
                    qParts.push(`<span style="background-color: rgb(254, 240, 138);">${escapeHtmlStr(highlightSentence)}</span>`);
                } else if (qParts.length === 1) {
                    qParts[0] = `<span style="background-color: rgb(254, 240, 138);">${qParts[0]}</span>`;
                }
                htmlParts.push(`<blockquote>${qParts.join(" ")}</blockquote>`);
            }

            const sections = Array.isArray(aiData.sections) ? aiData.sections : [];
            sections.forEach((sec) => {
                if (!sec) return;
                const heading = cleanHallucinatedPlaceholder(sec.heading);
                const points = Array.isArray(sec.points)
                    ? sec.points.map((p) => cleanHallucinatedPlaceholder(p)).filter(Boolean)
                    : [];
                if (!heading && points.length === 0) return;
                htmlParts.push(`<p><br></p>`);
                if (heading) {
                    htmlParts.push(`<p><strong>${escapeHtmlStr(heading)}</strong></p>`);
                }
                if (points.length > 0) {
                    const liHtml = points
                        .map((pt) => `<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>${escapeHtmlStr(pt)}</li>`)
                        .join("");
                    htmlParts.push(`<ol>${liHtml}</ol>`);
                }
            });

            if (linksHtml) htmlParts.push(linksHtml);

            return {
                title: noteTitle,
                html: htmlParts.join(""),
                targetFolderId: targetNoteFolderId,
                usedRealAi: true,
                modelName: displayModelBadge
            };
        }

        // 7. [공문 분석 / 오류 폴백]
        const noteTitle = compactDue ? `${rawSubj} (${compactDue}까지)` : rawSubj;
        const headerBadge = modeKey === "official"
            ? `[MY AI 공문 분석 · ${displayModelBadge}]`
            : `[MY AI 쪽지 분석 · ${displayModelBadge}]`;

        if (!aiData) {
            const errHtml = [
                `<p><strong>${escapeHtmlStr(headerBadge)}</strong></p>`,
                `<blockquote>${escapeHtmlStr(aiErrorNotice || "문서를 분석할 수 없습니다.")}</blockquote>`,
                linksHtml
            ].join("");
            return { title: noteTitle, html: errHtml, targetFolderId: targetNoteFolderId, aiErrorNotice, modelName: displayModelBadge };
        }

        const summaryLead = cleanHallucinatedPlaceholder(aiData.summaryLead);
        const coreContent = cleanHallucinatedPlaceholder(aiData.coreContent);
        const keyPoints = Array.isArray(aiData.keyPoints)
            ? aiData.keyPoints.map((p) => cleanHallucinatedPlaceholder(p)).filter(Boolean)
            : [];

        const html = buildOfficialOrMemoNoteHtml({
            headerBadge,
            docTitleText: rawFileName,
            verifiedDueDate,
            verifiedSubmitTarget,
            summaryLead,
            coreContent,
            keyPoints,
            copiedAttachments: [],
            docFilePath,
            folderPath,
            modeKey,
            foldChecked
        });

        return {
            title: noteTitle,
            html,
            targetFolderId: targetNoteFolderId,
            usedRealAi: true,
            modelName: displayModelBadge
        };
    }

    function isSafePromptLinkHref(rawHref) {
        const val = String(rawHref || "").trim();
        if (!val) return false;
        const normalized = val.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
        if (
            normalized.startsWith("javascript:") ||
            normalized.startsWith("vbscript:") ||
            normalized.startsWith("data:")
        ) {
            return false;
        }
        return true;
    }

    function isSafePromptImageSrc(rawSrc) {
        const val = String(rawSrc || "").trim();
        if (!val) return false;
        const normalized = val.replace(/[\u0000-\u0020]+/g, "").toLowerCase();
        if (normalized.startsWith("javascript:") || normalized.startsWith("vbscript:")) {
            return false;
        }
        if (normalized.startsWith("data:")) {
            return /^data:image\/(png|jpeg|jpg|gif|webp);/i.test(val);
        }
        return /^https?:\/\//i.test(val);
    }

    function renderPromptMarkdownToQuillHtml(mdText) {
        const rawMd = String(mdText || "").trim();
        if (!rawMd) return "<p><br></p>";

        if (typeof convertMarkdownToHTML !== "function" || typeof DOMParser === "undefined") {
            return rawMd
                .split(/\r?\n/)
                .map((line) => `<p>${escapeHtmlStr(line) || "<br>"}</p>`)
                .join("");
        }

        const rawHtml = convertMarkdownToHTML(rawMd);
        const doc = new DOMParser().parseFromString(rawHtml || "", "text/html");
        const allowedTags = new Set([
            "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "DEL", "CODE", "PRE",
            "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE",
            "UL", "OL", "LI", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH",
            "HR", "A", "IMG", "DIV", "SPAN"
        ]);
        const dropTags = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "NOSCRIPT", "TEMPLATE"]);
        const allowedAttrs = new Set([
            "class", "data-language", "spellcheck", "data-row", "data-list",
            "href", "target", "rel", "src", "alt", "contenteditable"
        ]);

        function sanitizeElementTree(parent) {
            const children = Array.from(parent.childNodes || []);
            for (const node of children) {
                if (!node || node.nodeType !== 1) continue;
                const tag = String(node.tagName || "").toUpperCase();

                if (dropTags.has(tag)) {
                    node.remove();
                    continue;
                }

                sanitizeElementTree(node);

                if (!allowedTags.has(tag)) {
                    const frag = doc.createDocumentFragment();
                    while (node.firstChild) frag.appendChild(node.firstChild);
                    parent.replaceChild(frag, node);
                    continue;
                }

                for (const attr of Array.from(node.attributes || [])) {
                    const attrName = String(attr.name || "").toLowerCase();
                    if (!allowedAttrs.has(attrName) || attrName.startsWith("on")) {
                        node.removeAttribute(attr.name);
                    }
                }

                if (tag === "A") {
                    const href = node.getAttribute("href") || "";
                    if (!isSafePromptLinkHref(href)) {
                        const frag = doc.createDocumentFragment();
                        while (node.firstChild) frag.appendChild(node.firstChild);
                        parent.replaceChild(frag, node);
                        continue;
                    }
                    node.setAttribute("target", "_blank");
                    node.setAttribute("rel", "noopener noreferrer");
                } else if (tag === "IMG") {
                    const src = node.getAttribute("src") || "";
                    if (!isSafePromptImageSrc(src)) {
                        node.remove();
                        continue;
                    }
                }
            }
        }

        sanitizeElementTree(doc.body);

        // Quill 2 목록 일관성을 위해 연속된 <li> 요소를 <ol>로 래핑하고 .ql-ui 스팬 보장
        const bodyChildren = Array.from(doc.body.childNodes);
        const normalizedFrag = doc.createDocumentFragment();
        let activeListOl = null;
        let activeListIsQuote = false;

        function ensureQuillListUiSpan(liEl) {
            const firstEl = liEl.firstElementChild;
            if (!firstEl || !firstEl.classList || !firstEl.classList.contains("ql-ui")) {
                const uiSpan = doc.createElement("span");
                uiSpan.className = "ql-ui";
                uiSpan.setAttribute("contenteditable", "false");
                liEl.insertBefore(uiSpan, liEl.firstChild);
            }
        }

        for (const child of bodyChildren) {
            if (child.nodeType === 1 && String(child.tagName || "").toUpperCase() === "LI") {
                const isQuoteLi = child.classList && child.classList.contains("ql-quote-item");
                ensureQuillListUiSpan(child);
                if (!activeListOl || activeListIsQuote !== isQuoteLi) {
                    activeListOl = doc.createElement("ol");
                    activeListIsQuote = isQuoteLi;
                    normalizedFrag.appendChild(activeListOl);
                }
                activeListOl.appendChild(child);
            } else {
                activeListOl = null;
                if (child.nodeType === 1 && /^(OL|UL)$/i.test(child.tagName || "")) {
                    Array.from(child.children || []).forEach((li) => {
                        if (String(li.tagName || "").toUpperCase() === "LI") {
                            ensureQuillListUiSpan(li);
                        }
                    });
                }
                normalizedFrag.appendChild(child);
            }
        }

        doc.body.innerHTML = "";
        doc.body.appendChild(normalizedFrag);
        const out = (doc.body.innerHTML || "").trim();
        return out || "<p><br></p>";
    }

    function normalizePromptFallbackTitle(fallbackPrompt) {
        const firstLine = String(fallbackPrompt || "")
            .split(/\r?\n/)
            .map((l) => l.replace(/\s+/g, " ").trim())
            .find(Boolean) || "";
        if (!firstLine) return "MY AI 답변";
        return firstLine.length > 36 ? `${firstLine.slice(0, 36).trim()}...` : firstLine;
    }

    function parsePromptOnlyAiResponse(rawContent, fallbackPrompt) {
        let text = String(rawContent || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
        if (!text) {
            return {
                title: normalizePromptFallbackTitle(fallbackPrompt),
                markdownBody: ""
            };
        }

        // 전체가 단일 ```markdown / ```md 코드펜스로 감싸진 경우에만 외곽 펜스 해제
        const outerMdFence = text.match(/^```(?:markdown|md)\s*\n([\s\S]*?)\n```\s*$/i);
        if (outerMdFence && outerMdFence[1] !== undefined) {
            const inner = outerMdFence[1];
            const innerFenceCount = (inner.match(/^```/gm) || []).length;
            if (innerFenceCount % 2 === 0) {
                text = inner.trim();
            }
        }

        const lines = text.split("\n");
        const firstIdx = lines.findIndex((l) => l.trim().length > 0);
        let title = "";
        let bodyLines = lines;

        if (firstIdx >= 0) {
            const firstLine = lines[firstIdx].trim();
            const titlePrefixMatch = firstLine.match(/^TITLE\s*:\s*(.+)$/i);
            const h1Match = firstLine.match(/^#\s+(.+)$/);

            if (titlePrefixMatch && titlePrefixMatch[1]) {
                title = titlePrefixMatch[1].trim().replace(/^\*\*|\*\*$/g, "").trim();
                bodyLines = lines.slice(firstIdx + 1);
            } else if (h1Match && h1Match[1]) {
                title = h1Match[1].trim().replace(/^\*\*|\*\*$/g, "").trim();
                bodyLines = lines.slice(firstIdx + 1);
            }
        }

        let markdownBody = bodyLines.join("\n").trim();
        if (!title) {
            title = normalizePromptFallbackTitle(fallbackPrompt);
        } else if (!markdownBody) {
            markdownBody = title;
        }

        return { title, markdownBody };
    }

    async function buildBlackHolePromptOnlyResult(userPromptText, options = {}) {
        const trimmedPrompt = String(userPromptText || "").trim();
        const selectedModelMeta = getSelectedMyAiModelMeta();
        const conciseReportMode = !!(options && options.conciseChecked);
        const savedApiKey = getSavedMyAiApiKey();
        let resolvedModelName = selectedModelMeta.name;
        const fallbackTitle = normalizePromptFallbackTitle(trimmedPrompt);

        if (!savedApiKey) {
            const errMsg = "환경설정 > MY AI 개인 API 키에 연동 키(tgpt_s...)를 먼저 저장해 주세요.";
            return {
                title: fallbackTitle,
                html: `<p><strong>[MY AI 프롬프트 답변 · ${escapeHtmlStr(resolvedModelName)}]</strong></p><blockquote>${escapeHtmlStr(errMsg)}</blockquote>`,
                targetFolderId: null,
                aiErrorNotice: errMsg,
                modelName: resolvedModelName
            };
        }

        const styleInstruction = conciseReportMode
            ? "- 답변 형식: 개조식(핵심 요점 나열) 위주로 1장 보고서 분량에 맞게 간결하고 구조화하여 작성하세요."
            : "- 답변 형식: 문서 초안 작성, 설명, 질의응답 등 요청 성격에 맞게 분량 제한 없이 명확하고 충실하게 작성하세요.";

        const systemPrompt = [
            "당신은 정확하고 신뢰할 수 있는 한국어 업무 문서 작성 및 질의응답 AI입니다.",
            "사용자가 파일 없이 입력한 프롬프트를 바탕으로 문서 초안 작성, 자료 정리, 질문 답변을 수행하세요.",
            "- 억지 공문 양식이나 빈 표를 강제하지 말고 요청 목적에 가장 자연스러운 마크다운 구조를 사용하세요.",
            "- 사실 확인이 불가능하거나 불확실한 최신 수치·법령·근거는 임의로 지어내지 말고, 확인이 필요한 사항은 솔직하게 안내하세요.",
            styleInstruction,
            "출력 규칙:",
            "1. 첫 줄에는 반드시 `TITLE: 답변 내용을 대표하는 간결한 제목` 형식으로 적으세요.",
            "2. 둘째 줄은 빈 줄로 두고, 셋째 줄부터 깔끔한 마크다운(소제목 ##/###, 글머리 목록, 표, 코드블록 등)으로 본문을 작성하세요."
        ].join("\n");

        let autoSwitchedFromPrompt = "";
        const aiResp = await requestTimelyAiCompletion(savedApiKey, selectedModelMeta.id, systemPrompt, trimmedPrompt);
        if (aiResp && aiResp.ok && aiResp.content) {
            if (aiResp.model) {
                const normRespId = normalizeMyAiModelId(aiResp.model);
                const matched = myAiActiveModels.find((m) => m.id === normRespId);
                resolvedModelName = (matched && matched.name) ? matched.name : formatLiveModelDisplayName(normRespId);
                if (normRespId !== normalizeMyAiModelId(selectedModelMeta.id)) {
                    autoSwitchedFromPrompt = selectedModelMeta.name;
                }
            }
            const promptModelBadge = autoSwitchedFromPrompt
                ? `${autoSwitchedFromPrompt} → ${resolvedModelName} 자동 전환`
                : resolvedModelName;
            const parsed = parsePromptOnlyAiResponse(aiResp.content, trimmedPrompt);
            const bodyHtml = renderPromptMarkdownToQuillHtml(parsed.markdownBody);
            const fullHtml = [
                `<p><strong>[MY AI 프롬프트 답변 · ${escapeHtmlStr(promptModelBadge)}]</strong></p>`,
                `<p><br></p>`,
                bodyHtml
            ].join("");
            return {
                title: parsed.title || fallbackTitle,
                html: fullHtml,
                targetFolderId: null,
                usedRealAi: true,
                modelName: promptModelBadge
            };
        }

        const errNotice = (aiResp && aiResp.error) || "AI 응답을 가져오지 못했습니다.";
        return {
            title: fallbackTitle,
            html: `<p><strong>[MY AI 프롬프트 답변 · ${escapeHtmlStr(resolvedModelName)}]</strong></p><blockquote>${escapeHtmlStr(errNotice)}</blockquote>`,
            targetFolderId: null,
            aiErrorNotice: errNotice,
            modelName: resolvedModelName
        };
    }

    function openBlackHoleSummaryInNewNote(summaryResult) {
        if (!summaryResult) return;

        const fmPane = document.getElementById("file-manager-pane");
        if (fmPane && fmPane.style.display !== "none" && typeof closeFileManager === "function") {
            closeFileManager();
        }

        const hasTargetFolder = summaryResult.targetFolderId !== null && summaryResult.targetFolderId !== undefined;
        if (hasTargetFolder && typeof createNewMemo === "function") {
            createNewMemo(summaryResult.targetFolderId);
        } else if (typeof createNewMemoSmart === "function") {
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

    let bhExternalCaptureStartTs = 0;
    let bhExternalCaptureWatchdog = null;

    async function presentAndFinalizeBlackHoleResult(rawSummaryResult, activeMode) {
        const meta = BH_MODE_META[activeMode] || BH_MODE_META.official;
        const modelMeta = getSelectedMyAiModelMeta();
        let finalSummary = rawSummaryResult;

        if (rawSummaryResult && rawSummaryResult.needsMemoTitleConfirmation) {
            const attNames = rawSummaryResult.tucPayload && Array.isArray(rawSummaryResult.tucPayload.attachments)
                ? rawSummaryResult.tucPayload.attachments.map((a) => a && a.name).filter(Boolean)
                : [];
            const confirmedTitle = await promptMemoTitleConfirmation({
                draftTitle: rawSummaryResult.draftTitle,
                folderDatePrefix: rawSummaryResult.folderDatePrefix,
                foldChecked: rawSummaryResult.foldChecked,
                attachmentNames: attNames
            });
            if (!confirmedTitle) {
                if (typeof showToast === "function") {
                    showToast("쪽지 저장을 취소했습니다.");
                }
                return;
            }
            finalSummary = await finalizeMemoSummaryAfterTitleConfirm(rawSummaryResult, confirmedTitle);
        }

        openBlackHoleSummaryInNewNote(finalSummary);

        if (typeof showToast === "function") {
            if (finalSummary && finalSummary.aiErrorNotice) {
                showToast(`${meta.label}: ${finalSummary.aiErrorNotice}`);
            } else {
                const usedLabel = (finalSummary && finalSummary.modelName) || modelMeta.name;
                showToast(`[${usedLabel}] ${meta.label} 요약 노트가 생성되었습니다.`);
            }
        }

        // 공문 분석(official)과 쪽지 분석(memo)이 정상 완료되었을 때만 1.2초 후 'MY 일정관리로 보내기' 팝업 자동 실행
        if ((activeMode === "official" || activeMode === "memo") && finalSummary && finalSummary.usedRealAi && !finalSummary.aiErrorNotice) {
            bhAutoScheduleTimer = setTimeout(() => {
                bhAutoScheduleTimer = null;
                openSendToScheduleModal();
            }, 1200);
        }
    }

    function handleExternalMemoDragStateEvent(payload) {
        if (!bhIsOpen || bhSwallowing) return;
        const dropZone = document.getElementById("zen-bh-orb-dropzone");
        const pill = document.getElementById("zen-bh-status-pill");
        const isHover = !!(payload && payload.active && payload.isOver);

        if (isHover) {
            if (bhCurrentMode !== "memo") {
                setBlackHoleMode("memo");
            }
            bhTargetHover = 1;
            if (dropZone) dropZone.classList.add("is-drag-hover", "is-external-memo-hover");
            setBlackHoleStatusPillText("밀양 메신저 쪽지 감지 — 여기에 놓으면 블랙홀이 빨아들입니다!");
        } else {
            bhTargetHover = 0;
            if (dropZone) dropZone.classList.remove("is-drag-hover", "is-external-memo-hover");
            setBlackHoleStatusPillText((BH_MODE_META[bhCurrentMode] || BH_MODE_META.official).prompt);
        }
    }

    function handleMiryangMemoCaptureStartedEvent() {
        const dropZone = document.getElementById("zen-bh-orb-dropzone");
        if (!bhIsOpen) return;

        closeBlackHoleModelDropdown();
        clearTimeout(bhSwallowTimer1);
        clearTimeout(bhSwallowTimer2);
        clearTimeout(bhExternalCaptureWatchdog);
        if (bhAutoScheduleTimer) {
            clearTimeout(bhAutoScheduleTimer);
            bhAutoScheduleTimer = null;
        }

        bhTargetHover = 0;
        if (dropZone) dropZone.classList.remove("is-drag-hover", "is-external-memo-hover");
        if (bhCurrentMode !== "memo") {
            setBlackHoleMode("memo");
        }

        bhExternalCaptureStartTs = performance.now();
        bhSwallowing = true;
        setBlackHoleSendingUi(true);

        const nowTs = performance.now();
        for (let i = 0; i < 4; i++) {
            bhParticles.push({
                startTime: nowTs + i * 85,
                duration: 1200,
                startAngle: -2.35 + i * 0.85,
                startR: 138 + i * 10
            });
        }

        setBlackHoleStatusPillText("쪽지 본문 및 첨부파일을 자동 수집하고 있습니다...");

        bhExternalCaptureWatchdog = setTimeout(() => {
            if (bhSwallowing) {
                bhSwallowing = false;
                setBlackHoleSendingUi(false);
                setBlackHoleStatusPillText((BH_MODE_META[bhCurrentMode] || BH_MODE_META.memo).prompt);
                if (typeof showToast === "function") {
                    showToast("쪽지 수집 응답 시간이 초과되었습니다. 다시 시도해 주세요.");
                }
            }
        }, 25000);
    }

    async function handleCapturedMiryangMemoPayload(payload) {
        clearTimeout(bhExternalCaptureWatchdog);
        bhExternalCaptureWatchdog = null;

        if (!payload || !payload.ok) {
            bhSwallowing = false;
            setBlackHoleSendingUi(false);
            setBlackHoleStatusPillText((BH_MODE_META[bhCurrentMode] || BH_MODE_META.memo).prompt);
            if (typeof showToast === "function") {
                showToast((payload && payload.errorMessage) || "쪽지 창에서 내용을 수집할 수 없습니다.");
            }
            return;
        }

        const bodyTextClean = String(payload.bodyText || "").trim();
        if (!bodyTextClean) {
            bhSwallowing = false;
            setBlackHoleSendingUi(false);
            setBlackHoleStatusPillText((BH_MODE_META[bhCurrentMode] || BH_MODE_META.memo).prompt);
            if (typeof showToast === "function") {
                showToast("쪽지 본문이 비어 있어 AI 분석을 진행할 수 없습니다.");
            }
            return;
        }

        const modelMeta = getSelectedMyAiModelMeta();
        startBlackHoleCheerRotation(`${modelMeta.name} 모델이 쪽지 본문을 분석하고 있습니다...`, 3500, 4000);

        const foldChecked = !!document.getElementById("zen-bh-folding-toggle")?.checked;
        const conciseChecked = !!document.getElementById("zen-bh-concise-toggle")?.checked;
        const userPromptText = (document.getElementById("zen-bh-user-prompt")?.value || "").trim();
        const refYear = Number(payload.referenceYear) > 2000 ? Number(payload.referenceYear) : new Date().getFullYear();
        const sentAtText = String(payload.sentAtText || payload.capturedAtText || "").trim();

        const rawParts = [];
        if (payload.senderLabel) rawParts.push(`[보낸사람] ${payload.senderLabel}`);
        if (sentAtText) rawParts.push(`[발신일시] ${sentAtText} (본문에 연도가 생략된 날짜는 발신일시 기준 연도인 ${refYear}년으로 해석)`);
        rawParts.push(`[쪽지 본문]\n${bodyTextClean.slice(0, 140000)}`);

        const collectedImages = [];
        const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
        let primaryAttName = "";
        for (const att of attachments) {
            if (att && att.name) {
                primaryAttName = att.name;
                break;
            }
        }

        const combinedText = rawParts.join("\n\n").slice(0, 200000);

        let summaryResult = null;
        try {
            const elapsed = performance.now() - (bhExternalCaptureStartTs || 0);
            const remainWait = Math.max(0, 1600 - elapsed);
            const analysisPromise = buildBlackHoleSummaryResult([], "memo", foldChecked, {
                conciseChecked,
                userPromptText,
                preExtracted: {
                    rawFileText: combinedText,
                    extractedImages: collectedImages,
                    rawFileName: primaryAttName || payload.senderLabel || "받은 쪽지",
                    baseName: "새 쪽지",
                    referenceYear: refYear,
                    isForwarded: !!payload.isForwarded,
                    senderLabel: payload.senderLabel || "",
                    tucPayload: payload
                }
            });
            const waitPromise = new Promise((resolve) => setTimeout(resolve, remainWait));
            [summaryResult] = await Promise.all([analysisPromise, waitPromise]);
        } finally {
            stopBlackHoleCheerRotation();
            bhSwallowing = false;
            setBlackHoleSendingUi(false);
        }

        if (payload.attachmentWarning && typeof showToast === "function") {
            showToast(payload.attachmentWarning);
        }

        if (bhIsOpen) {
            closeBlackHolePortal();
            await new Promise((resolve) => setTimeout(resolve, 220));
        }
        await presentAndFinalizeBlackHoleResult(summaryResult, "memo");
    }

    async function triggerBlackHoleSwallow(items) {
        if (!bhIsOpen || bhSwallowing) return;
        const list = Array.isArray(items) ? items.filter(Boolean) : [];
        if (list.length === 0) return;

        const activeMode = bhCurrentMode || "official";
        const meta = BH_MODE_META[activeMode] || BH_MODE_META.official;
        const foldChecked = !!document.getElementById("zen-bh-folding-toggle")?.checked;
        const pill = document.getElementById("zen-bh-status-pill");
        const modelMeta = getSelectedMyAiModelMeta();

        closeBlackHoleModelDropdown();
        clearTimeout(bhSwallowTimer1);
        clearTimeout(bhSwallowTimer2);
        if (bhAutoScheduleTimer) {
            clearTimeout(bhAutoScheduleTimer);
            bhAutoScheduleTimer = null;
        }
        bhSwallowing = true;
        setBlackHoleSendingUi(true);
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

        setBlackHoleStatusPillText(`${firstName}${extra} 투입 중 (${meta.label} · ${modelMeta.name})`);

        const totalSwallowMs = duration + (count - 1) * stagger + 40;
        const minWaitMs = Math.max(2100, totalSwallowMs + 860);

        bhSwallowTimer1 = setTimeout(() => {
            if (!bhIsOpen) return;
            startBlackHoleCheerRotation(`${modelMeta.name} 모델이 문서를 분석·요약하고 있습니다...`, 3500, 4000);
        }, totalSwallowMs);

        const conciseChecked = !!document.getElementById("zen-bh-concise-toggle")?.checked;
        const userPromptText = (document.getElementById("zen-bh-user-prompt")?.value || "").trim();
        let summaryResult = null;
        try {
            const analysisPromise = buildBlackHoleSummaryResult(list, activeMode, foldChecked, {
                conciseChecked,
                userPromptText
            });
            const minWaitPromise = new Promise((resolve) => {
                bhSwallowTimer2 = setTimeout(resolve, minWaitMs);
            });

            [summaryResult] = await Promise.all([analysisPromise, minWaitPromise]);
        } finally {
            stopBlackHoleCheerRotation();
            bhSwallowing = false;
            setBlackHoleSendingUi(false);
        }
        if (!bhIsOpen) return;

        closeBlackHolePortal();
        if (summaryResult && summaryResult.needsMemoTitleConfirmation) {
            await new Promise((resolve) => setTimeout(resolve, 220));
        }
        await presentAndFinalizeBlackHoleResult(summaryResult, activeMode);
    }

    async function submitBlackHolePromptOnly() {
        if (!bhIsOpen || bhSwallowing) return;
        if (bhCurrentMode !== "summary") {
            if (typeof showToast === "function") {
                showToast("문서 없이 프롬프트 전송은 '문서 분석' 탭에서 사용할 수 있습니다.");
            }
            return;
        }

        const promptEl = document.getElementById("zen-bh-user-prompt");
        const userPromptText = (promptEl && promptEl.value ? promptEl.value : "").trim();
        if (!userPromptText) {
            if (typeof showToast === "function") {
                showToast("전송할 프롬프트를 먼저 입력해 주세요.");
            }
            if (promptEl) promptEl.focus();
            return;
        }

        const savedApiKey = getSavedMyAiApiKey();
        if (!savedApiKey) {
            if (typeof showToast === "function") {
                showToast("환경설정 > MY AI 개인 API 키에 연동 키(tgpt_s...)를 먼저 저장해 주세요.");
            }
            return;
        }

        const pill = document.getElementById("zen-bh-status-pill");
        const modelMeta = getSelectedMyAiModelMeta();
        const conciseChecked = !!document.getElementById("zen-bh-concise-toggle")?.checked;

        closeBlackHoleModelDropdown();
        clearTimeout(bhSwallowTimer1);
        clearTimeout(bhSwallowTimer2);
        if (bhAutoScheduleTimer) {
            clearTimeout(bhAutoScheduleTimer);
            bhAutoScheduleTimer = null;
        }

        bhSwallowing = true;
        setBlackHoleSendingUi(true);

        const nowTs = performance.now();
        const duration = 1200;
        bhParticles.push({
            startTime: nowTs,
            duration,
            startAngle: -2.15,
            startR: 140
        });

        setBlackHoleStatusPillText(`프롬프트 전송 중 (${modelMeta.name})`);

        const minWaitMs = 1800;
        bhSwallowTimer1 = setTimeout(() => {
            if (!bhIsOpen) return;
            startBlackHoleCheerRotation(`${modelMeta.name} 모델이 답변을 작성하고 있습니다...`, 3500, 4000);
        }, duration + 40);

        let promptResult = null;
        try {
            const promptPromise = buildBlackHolePromptOnlyResult(userPromptText, { conciseChecked });
            const minWaitPromise = new Promise((resolve) => {
                bhSwallowTimer2 = setTimeout(resolve, minWaitMs);
            });
            [promptResult] = await Promise.all([promptPromise, minWaitPromise]);
        } finally {
            stopBlackHoleCheerRotation();
            bhSwallowing = false;
            setBlackHoleSendingUi(false);
        }

        if (!bhIsOpen) return;

        closeBlackHolePortal();
        openBlackHoleSummaryInNewNote(promptResult);

        if (promptResult && !promptResult.aiErrorNotice && promptEl) {
            promptEl.value = "";
        }

        if (typeof showToast === "function") {
            if (promptResult && promptResult.aiErrorNotice) {
                showToast(`MY AI 프롬프트 전송 오류: ${promptResult.aiErrorNotice}`);
            } else {
                const usedLabel = (promptResult && promptResult.modelName) || modelMeta.name;
                showToast(`[${usedLabel}] 프롬프트 응답 노트가 생성되었습니다.`);
            }
        }
    }

    function handleBlackHoleDroppedFiles(files) {
        const arr = Array.from(files || []);
        if (arr.length === 0) return;
        triggerBlackHoleSwallow(arr);
    }

    function triggerBlackHoleFilePick() {
        if (bhSwallowing) return;
        const input = document.getElementById("zen-bh-file-input");
        if (input) {
            input.value = "";
            input.click();
        }
    }

    function bindBlackHoleEvents() {
        bindDesktopBridgeResponseListener();
        const dropZone = document.getElementById("zen-bh-orb-dropzone");
        const fileInput = document.getElementById("zen-bh-file-input");
        const shell = document.getElementById("zen-blackhole-portal-shell");
        if (shell && !shell._bhOutsideClickBound) {
            shell._bhOutsideClickBound = true;
            shell.addEventListener("click", (e) => {
                if (!e.target.closest(".zen-bh-model-picker-wrap")) {
                    closeBlackHoleModelDropdown();
                }
            });
        }
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
        const promptInput = document.getElementById("zen-bh-user-prompt");
        if (promptInput && !promptInput._bhKeyBound) {
            promptInput._bhKeyBound = true;
            promptInput.addEventListener("keydown", (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    submitBlackHolePromptOnly();
                }
            });
        }
        if (!window._zenBhResizeBound) {
            window._zenBhResizeBound = true;
            window.addEventListener("resize", () => {
                if (bhIsOpen) {
                    updateBlackHoleButtonOriginVars();
                    notifyDesktopBlackHolePortalState(true);
                }
            });
        }
        syncBlackHoleModelPickerUI();
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
    window.cancelPendingBlackHoleAutoSchedule = cancelPendingBlackHoleAutoSchedule;
    window.normalizeSmartScheduleDateInput = normalizeSmartScheduleDateInput;
    window.normalizeSmartScheduleTimeInput = normalizeSmartScheduleTimeInput;
    window.exportNoteAsDdaySchedule = exportNoteAsDdaySchedule;
    window.sendNoteToScheduleDirectStub = sendNoteToScheduleDirectStub;

    window.toggleBlackHolePortal = toggleBlackHolePortal;
    window.openBlackHolePortal = openBlackHolePortal;
    window.closeBlackHolePortal = closeBlackHolePortal;
    window.isBlackHolePortalOpen = isBlackHolePortalOpen;
    window.setBlackHoleMode = setBlackHoleMode;
    window.toggleBlackHoleModelDropdown = toggleBlackHoleModelDropdown;
    window.selectBlackHoleAiModel = selectBlackHoleAiModel;
    window.handleBlackHoleDroppedFiles = handleBlackHoleDroppedFiles;
    window.triggerBlackHoleFilePick = triggerBlackHoleFilePick;
    window.submitBlackHolePromptOnly = submitBlackHolePromptOnly;

    window.addEventListener("DOMContentLoaded", () => {
        bindBlackHoleEvents();
        initNotesAutoBackupScheduler();
    });
    if (document.readyState === "interactive" || document.readyState === "complete") {
        bindBlackHoleEvents();
        initNotesAutoBackupScheduler();
    }
})();
