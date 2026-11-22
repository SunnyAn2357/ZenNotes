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
                    if (val && val !== "-") return val.slice(0, 80);
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

    function normalizeSmartScheduleDateInput(el) {
        if (!el) return;
        const raw = String(el.value || "");
        const digits = raw.replace(/\D/g, "").slice(0, 8);
        if (digits.length === 8) {
            const yyyy = parseInt(digits.slice(0, 4), 10);
            const mm = parseInt(digits.slice(4, 6), 10);
            const dd = parseInt(digits.slice(6, 8), 10);
            if (yyyy >= 1900 && yyyy <= 2199 && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
                const dt = new Date(yyyy, mm - 1, dd);
                if (dt.getFullYear() === yyyy && dt.getMonth() === mm - 1 && dt.getDate() === dd) {
                    el.value = `${yyyy}-${pad2(mm)}-${pad2(dd)}`;
                    return;
                }
            }
        }
        if (/[^\d-]/.test(raw)) {
            el.value = raw.replace(/[^\d-]/g, "");
        }
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
        bindStsInputAutoSelectEvents();

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
        if (elStart) elStart.value = detectedDate || "";
        if (elDue) elDue.value = detectedDate || "";
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
        const elStart = document.getElementById("sts-start-date");
        const elDue = document.getElementById("sts-due-date");
        const elTime = document.getElementById("sts-time-input");
        if (elStart) normalizeSmartScheduleDateInput(elStart);
        if (elDue) normalizeSmartScheduleDateInput(elDue);
        if (elTime) normalizeSmartScheduleTimeInput(elTime);

        const startDate = (elStart?.value || "").trim();
        const dueDate = (elDue?.value || "").trim() || startDate;
        const time = (elTime?.value || "").trim();
        const location = (document.getElementById("sts-location-input")?.value || "").trim();
        const priority = document.getElementById("sts-priority-select")?.value || "Normal";
        const elMemoEditor = document.getElementById("sts-memo-editor");

        if (!title) {
            if (typeof showToast === "function") showToast("일정 제목을 입력해 주세요.");
            document.getElementById("sts-title-input")?.focus();
            return null;
        }
        if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
            if (typeof showToast === "function") showToast("시작일은 8자리 숫자(예: 20261122) 또는 YYYY-MM-DD 형식으로 입력해 주세요.");
            elStart?.focus();
            return null;
        }
        if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            if (typeof showToast === "function") showToast("마감일은 8자리 숫자(예: 20261122) 또는 YYYY-MM-DD 형식으로 입력해 주세요.");
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
                if (!payload || !payload.reqId) return;
                const entry = pendingDesktopReqMap.get(payload.reqId);
                if (entry) {
                    clearTimeout(entry.timer);
                    pendingDesktopReqMap.delete(payload.reqId);
                    entry.resolve(payload);
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
        const isLightTheme = !!(document.body && document.body.classList.contains("light-theme"));

        // 1. 외곽 헤일로 (화이트 모드는 탁한 검은 안개를 걷어내고 맑은 샴페인 코로나 적용)
        const halo = ctx.createRadialGradient(cx, cy, maxR * 0.24, cx, cy, maxR);
        if (isLightTheme) {
            halo.addColorStop(0, "rgba(15, 23, 42, 0.12)");
            halo.addColorStop(0.45, `rgba(217, 165, 72, ${0.14 + bhHoverLevel * 0.08 + bhFlashLevel * 0.14})`);
            halo.addColorStop(0.76, `rgba(226, 200, 145, ${0.08 + bhHoverLevel * 0.05})`);
            halo.addColorStop(1, "rgba(255, 255, 255, 0)");
        } else {
            halo.addColorStop(0, "rgba(0, 0, 0, 0.94)");
            halo.addColorStop(0.48, "rgba(16, 18, 26, 0.78)");
            halo.addColorStop(0.76, `rgba(180, 130, 55, ${0.16 + bhHoverLevel * 0.1 + bhFlashLevel * 0.2})`);
            halo.addColorStop(1, "rgba(15, 23, 42, 0)");
        }
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
            if (isLightTheme) {
                lensGrad.addColorStop(0, "rgba(180, 130, 50, 0)");
                lensGrad.addColorStop(0.5, `rgba(180, 128, 42, ${0.38 + bhHoverLevel * 0.2})`);
                lensGrad.addColorStop(1, "rgba(180, 130, 50, 0)");
            } else {
                lensGrad.addColorStop(0, "rgba(253, 230, 138, 0)");
                lensGrad.addColorStop(0.5, `rgba(254, 240, 138, ${0.34 + bhHoverLevel * 0.22})`);
                lensGrad.addColorStop(1, "rgba(253, 230, 138, 0)");
            }
            ctx.strokeStyle = lensGrad;
            ctx.lineWidth = isLightTheme ? 2.6 : 3.0;
            ctx.beginPath();
            ctx.arc(0, side * 1.5, maxR * 0.42, side > 0 ? 0.18 : Math.PI + 0.18, side > 0 ? Math.PI - 0.18 : Math.PI * 2 - 0.18);
            ctx.stroke();
        }
        ctx.restore();

        // 3. 기울어진 샴페인 골드 강착원반 & 궤도 입자
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
            const bright = Math.min(1, p.alpha + bhFlashLevel * 0.35);
            if (isLightTheme) {
                ctx.fillStyle = p.hueMix > 0.42
                    ? `rgba(180, 128, 44, ${bright * 0.78})`
                    : `rgba(120, 113, 108, ${bright * 0.52})`;
            } else {
                ctx.fillStyle = p.hueMix > 0.42
                    ? `rgba(254, 243, 199, ${bright * 0.88})`
                    : `rgba(217, 165, 72, ${bright * 0.78})`;
            }
            ctx.beginPath();
            ctx.arc(px, py, p.size * (isFront ? 1.1 : 0.82), 0, Math.PI * 2);
            ctx.fill();
        }

        // 강착원반 밝은 링 레이어
        ctx.scale(1, diskScaleY);
        const diskRing = ctx.createRadialGradient(0, 0, maxR * 0.36, 0, 0, maxR * 0.9);
        if (isLightTheme) {
            diskRing.addColorStop(0, "rgba(217, 175, 95, 0)");
            diskRing.addColorStop(0.24, `rgba(217, 165, 72, ${0.44 + bhFlashLevel * 0.22})`);
            diskRing.addColorStop(0.55, `rgba(180, 130, 55, ${0.24 + bhHoverLevel * 0.14})`);
            diskRing.addColorStop(1, "rgba(180, 130, 55, 0)");
        } else {
            diskRing.addColorStop(0, "rgba(254, 249, 195, 0)");
            diskRing.addColorStop(0.24, `rgba(254, 243, 199, ${0.56 + bhFlashLevel * 0.22})`);
            diskRing.addColorStop(0.55, `rgba(217, 155, 58, ${0.34 + bhHoverLevel * 0.16})`);
            diskRing.addColorStop(1, "rgba(180, 83, 9, 0)");
        }
        ctx.fillStyle = diskRing;
        ctx.beginPath();
        ctx.arc(0, 0, maxR * 0.92, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 4. 사상의 지평선(중앙 블랙 코어) + 광자 링
        const coreR = maxR * 0.33;
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
        const foldLabelEl = document.getElementById("zen-bh-folding-label");
        if (foldLabelEl) {
            foldLabelEl.textContent = bhCurrentMode === "official"
                ? "자동 폴더링(폴더를 만들고 공문과 첨부 문서 저장)"
                : bhCurrentMode === "memo"
                    ? "자동 폴더링(폴더를 만들고 쪽지와 첨부 문서 저장)"
                    : "자동 폴더링(폴더를 만들고 문서 저장)";
        }
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

        closeBlackHoleModelDropdown();
        syncBlackHoleModelPickerUI();
        syncTimelyAiLiveModels(false);
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

        closeBlackHoleModelDropdown();
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

    // ========================================================================
    // 5-2. 블랙홀 AI 모델 선택 드롭다운 (디폴트: Solar Pro4, 문서 작업 특화)
    // ========================================================================
    const MYAI_MODEL_STORAGE_KEY = "zen_myai_selected_model";
    const MYAI_DEFAULT_MODEL_ID = "solar-pro4";

    const MYAI_PROVIDER_ICONS = {
        upstage: `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" fill="#0f172a" stroke="#a855f7" stroke-width="1.2"/><path d="M10 3.2L11.7 8.3L16.8 10L11.7 11.7L10 16.8L8.3 11.7L3.2 10L8.3 8.3L10 3.2Z" fill="#c084fc"/></svg>`,
        anthropic: `<svg viewBox="0 0 20 20" fill="none"><g stroke="#ea580c" stroke-width="1.65" stroke-linecap="round"><line x1="10" y1="2.5" x2="10" y2="17.5"/><line x1="2.5" y1="10" x2="17.5" y2="10"/><line x1="4.7" y1="4.7" x2="15.3" y2="15.3"/><line x1="15.3" y1="4.7" x2="4.7" y2="15.3"/><line x1="6.8" y1="3.1" x2="13.2" y2="16.9"/><line x1="13.2" y1="3.1" x2="6.8" y2="16.9"/></g></svg>`,
        openai: `<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.2" stroke="#e2e8f0" stroke-width="1.5"/><path d="M10 2.8C12.8 2.8 15 5 15 7.8C15 10.6 12.8 12.8 10 12.8C7.2 12.8 5 10.6 5 7.8M10 17.2C7.2 17.2 5 15 5 12.2C5 9.4 7.2 7.2 10 7.2C12.8 7.2 15 9.4 15 12.2" stroke="#e2e8f0" stroke-width="1.35" stroke-linecap="round"/></svg>`,
        google: `<svg viewBox="0 0 20 20" fill="none"><path d="M10 2.2L12.1 7.9L17.8 10L12.1 12.1L10 17.8L7.9 12.1L2.2 10L7.9 7.9L10 2.2Z" fill="#38bdf8" stroke="#fbbf24" stroke-width="0.9"/></svg>`
    };

    const MYAI_DEFAULT_MODELS = [
        {
            id: "solar-pro4",
            name: "Solar Pro4",
            provider: "upstage",
            group: "기본 추천 모델",
            desc: "공문·글쓰기·한국어 문서 작업에 최적화 (기본)"
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
            id: "gemini-3.8-flash",
            name: "Gemini 3.8 Flash",
            provider: "google",
            group: "추천 문서 분석 모델",
            desc: "대용량 매뉴얼·긴 문서 초고속 분석 및 요약"
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
        return "openai";
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
            // Responses API 전용 모델이나 비채팅 모델 제외
            if (/^(gpt-5\.5-pro|gpt-5\.3-codex)$/i.test(normId) || /embedding|whisper|tts|dall-e|moderation/i.test(normId)) return;
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
            iconEl.innerHTML = MYAI_PROVIDER_ICONS[meta.provider] || MYAI_PROVIDER_ICONS.upstage;
        }
        if (labelEl) {
            labelEl.textContent = "AI 선택";
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
            const svg = MYAI_PROVIDER_ICONS[m.provider] || MYAI_PROVIDER_ICONS.upstage;
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

    async function extractPdfTextFromFile(fileObj) {
        if (!fileObj || typeof fileObj.arrayBuffer !== "function") return "";
        const pdfLib = window.pdfjsLib;
        if (!pdfLib || typeof pdfLib.getDocument !== "function") return "";
        try {
            const buf = await fileObj.arrayBuffer();
            const loadingTask = pdfLib.getDocument({ data: new Uint8Array(buf) });
            const pdfDoc = await loadingTask.promise;
            const maxPages = Math.min(pdfDoc.numPages || 1, 25);
            const pageTexts = [];
            let totalLen = 0;
            for (let p = 1; p <= maxPages; p++) {
                const page = await pdfDoc.getPage(p);
                const textContent = await page.getTextContent();
                const lineStr = (textContent.items || [])
                    .map((it) => (it && typeof it.str === "string" ? it.str : ""))
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();
                if (lineStr) {
                    pageTexts.push(`[${p}페이지] ${lineStr}`);
                    totalLen += lineStr.length;
                    if (totalLen >= 18000) break;
                }
            }
            return pageTexts.join("\n").slice(0, 18000);
        } catch {
            return "";
        }
    }

    async function extractDocumentTextForAi(firstItem) {
        if (!firstItem) return "";
        const rawFileName = String(firstItem.name || "").trim();
        const lower = rawFileName.toLowerCase();

        // 1. PDF 파일: 내장 pdf.js로 페이지 텍스트 추출
        if (lower.endsWith(".pdf")) {
            const pdfTxt = await extractPdfTextFromFile(firstItem);
            if (pdfTxt) return pdfTxt;
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
                if (txt.trim()) return txt.trim().slice(0, 18000);
            } catch { }
        }

        // 3. 데스크톱 C# 브릿지로 .docx / .hwpx / .zip / 기타 파일 텍스트 추출
        if (isDesktopWebViewEnv() && typeof firstItem.arrayBuffer === "function") {
            try {
                const b64 = await readFileAsBase64(firstItem);
                if (b64) {
                    const res = await callDesktopBridgeRequest(
                        "extractBlackHoleFileText",
                        { fileName: rawFileName, base64: b64 },
                        15000
                    );
                    if (res && res.ok && res.text && String(res.text).trim()) {
                        return String(res.text).trim().slice(0, 18000);
                    }
                }
            } catch { }
        }

        // 4. 바이너리/압축 문서는 생바이트(PK...) 깨짐 방지를 위해 firstItem.text() 금지
        if (/\.(docx|hwpx|zip|pdf|hwp|xlsx|pptx|doc|xls|ppt|png|jpg|jpeg|gif|webp|bmp|exe|dll)$/i.test(lower)) {
            return "";
        }
        if (typeof firstItem.text === "function") {
            try {
                const fallbackTxt = (await firstItem.text()) || "";
                if (/^PK[\x03\x05\x07]/.test(fallbackTxt)) return "";
                const cleaned = fallbackTxt.replace(/\0/g, "").trim();
                if (cleaned) return cleaned.slice(0, 18000);
            } catch { }
        }
        return "";
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
        const folderTitle = modeKey === "official" ? "공문" : modeKey === "memo" ? "쪽지" : "문서";

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
                            !m.isSystem &&
                            (m.parentId === null || m.parentId === undefined) &&
                            String(m.title || "").trim() === folderTitle
                    );
                    if (existing && existing.id !== undefined && existing.id !== null) {
                        resolvedId = existing.id;
                        return;
                    }
                    const addReq = store.add({
                        title: folderTitle,
                        type: "folder",
                        parentId: null,
                        parentSyncId: null,
                        syncId: typeof generateSyncId === "function" ? generateSyncId() : Date.now().toString(36),
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

    async function requestTimelyAiCompletion(apiKey, preferredModelId, systemPrompt, userPrompt) {
        const trimmedKey = (apiKey || "").trim();
        if (!trimmedKey) {
            return {
                ok: false,
                error: "환경설정 > MY AI 개인 API 키에 연동 키(tgpt_s...)가 저장되어 있지 않습니다."
            };
        }

        const chosenModel = normalizeMyAiModelId(preferredModelId || MYAI_DEFAULT_MODEL_ID);

        if (isDesktopWebViewEnv()) {
            const res = await callDesktopBridgeRequest(
                "timelyAiChatRequest",
                {
                    apiKey: trimmedKey,
                    model: chosenModel,
                    systemPrompt,
                    userPrompt
                },
                48000
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
        for (const m of ["solar-pro4", "claude-sonnet-5", "gpt-5.6-sol", "gemini-3.8-flash"]) {
            if (!candidateModels.includes(m)) candidateModels.push(m);
        }

        let lastErr = "Timely AI 서버 응답 실패";
        for (const modelName of candidateModels) {
            try {
                const provider = resolveMyAiProvider(modelName);
                let url = "";
                let headers = { "Content-Type": "application/json" };
                let payload = null;

                if (provider === "anthropic") {
                    url = "https://hello.timelyai.io/api/v2/chat/direct/anthropic/v1/messages";
                    headers["x-api-key"] = trimmedKey;
                    headers["anthropic-version"] = "2023-06-01";
                    payload = {
                        model: modelName,
                        max_tokens: 4096,
                        temperature: 0.0,
                        system: systemPrompt,
                        messages: [{ role: "user", content: userPrompt }]
                    };
                } else if (provider === "google") {
                    url = `https://hello.timelyai.io/api/v2/chat/direct/google/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
                    headers["x-goog-api-key"] = trimmedKey;
                    payload = {
                        systemInstruction: { parts: [{ text: systemPrompt }] },
                        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
                        generationConfig: { temperature: 0.0 }
                    };
                } else {
                    url = provider === "upstage"
                        ? "https://hello.timelyai.io/api/v2/chat/direct/upstage/v1/chat/completions"
                        : "https://hello.timelyai.io/api/v2/chat/direct/openai/v1/chat/completions";
                    headers["Authorization"] = `Bearer ${trimmedKey}`;
                    payload = {
                        model: modelName,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt }
                        ],
                        temperature: 0.0
                    };
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
                if (resp.status === 401 || resp.status === 402) break;
            } catch (err) {
                lastErr = String(err && err.message ? err.message : err);
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
            new RegExp(`${monthNum}\\s*[.\\-/월]\\s*${dayNum}`),
            new RegExp(`${mmPad}\\s*[.\\-/월]\\s*${ddPad}`),
            new RegExp(`${mmPad}${ddPad}`)
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

    async function buildBlackHoleSummaryResult(list, modeKey, foldChecked) {
        const firstItem = (Array.isArray(list) && list[0]) ? list[0] : { name: "문서.txt" };
        const rawFileName = String(firstItem.name || "문서").trim();
        const baseName = rawFileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim() || "문서";
        const selectedModelMeta = getSelectedMyAiModelMeta();

        // 1. 문서 본문 텍스트 추출
        const rawFileText = await extractDocumentTextForAi(firstItem);
        const savedApiKey = (localStorage.getItem(MYAI_KEY_STORAGE_KEY) || "").trim();

        let aiData = null;
        let aiErrorNotice = "";

        if (!savedApiKey) {
            aiErrorNotice = "환경설정 > MY AI 개인 API 키에 연동 키(tgpt_s...)를 먼저 저장해 주세요.";
        } else if (!rawFileText) {
            aiErrorNotice = "이 문서 형식에서 텍스트 본문을 추출할 수 없습니다.";
        } else {
            const zeroHallucinationRules = [
                "[절대 불가침 할루시네이션 0% 규칙]",
                "1. 제공된 [문서 원문]에 명시적으로 적혀 있는 사실만 100% 그대로 요약하세요.",
                "2. 원문에 없는 날짜, 시간, 기한, 마감일, 장소, 제출처, 부서명, 담당자, 지시사항을 절대로 추측하거나 임의로 만들어내지 마세요.",
                "3. 원문에 해당 정보가 없거나 불확실하면 반드시 빈 문자열(\"\")로 비워 두세요. ('없음', '미정', '자체 검토' 같은 임의 문구도 넣지 말고 완전히 빈 문자열 \"\"로 두세요.)",
                "4. 원문이 매뉴얼·안내서·참고자료인 경우 억지로 업무 지시나 과제처럼 바꾸지 말고, 문서 본래의 핵심 내용만 객관적으로 요약하세요."
            ].join("\n");

            const systemPrompt = modeKey === "summary"
                ? [
                    "당신은 정확하고 신뢰할 수 있는 문서 요약 AI입니다.",
                    zeroHallucinationRules,
                    "반드시 아래 JSON 스키마 형식으로만 응답하세요 (코드블록 없이 순수 JSON만 출력):",
                    "{",
                    '  "title": "원문에 기반한 문서 제목 (원문 제목이 있으면 그대로 사용)",',
                    '  "overview": "문서 전체의 핵심 목적과 내용을 1~2문장으로 요약 (원문 사실만 기재)",',
                    '  "highlightSentence": "문서에서 가장 핵심이 되는 1문장 (원문 사실만 기재)",',
                    '  "sections": [',
                    '    { "heading": "핵심 주제/장절 제목", "points": ["원문에 있는 세부 핵심 내용 1", "세부 핵심 내용 2"] }',
                    "  ]",
                    "}"
                ].join("\n")
                : [
                    `당신은 대한민국 행정·업무 ${modeKey === "official" ? "공문서" : "쪽지"} 분석 AI입니다.`,
                    zeroHallucinationRules,
                    "반드시 아래 JSON 스키마 형식으로만 응답하세요 (코드블록 없이 순수 JSON만 출력):",
                    "{",
                    '  "title": "원문에 명시된 공문/쪽지 제목",',
                    '  "dueDate": "원문에 명시된 제출/회신 마감일 또는 일시 (원문에 적힌 그대로 기재하되, 원문에 마감일/기한이 없으면 반드시 빈 문자열 \\"\\")",',
                    '  "submitTarget": "원문에 명시된 제출처/회신처/장소 (원문에 제출처나 장소가 없으면 반드시 빈 문자열 \\"\\")",',
                    '  "summaryLead": "공문/쪽지의 핵심 요지 (원문에 있는 사실만 1~2문장)",',
                    '  "coreContent": "핵심 내용 한 줄 요약 (원문에 있는 사실만 기재)",',
                    '  "keyPoints": ["원문에 명시된 세부 내용 또는 협조/조치 사항 1", "항목 2"]',
                    "}"
                ].join("\n");

            const userPrompt = `파일명: ${rawFileName}\n\n[문서 원문]\n${rawFileText}`;
            const aiResp = await requestTimelyAiCompletion(savedApiKey, selectedModelMeta.id, systemPrompt, userPrompt);

            if (aiResp && aiResp.ok && aiResp.content) {
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

        // 2. 원문 대조를 통한 날짜·제출처 할루시네이션 2중 검증 (원문에 없는 날짜는 즉시 폐기)
        const verifiedDueDate = (aiData && aiData.dueDate)
            ? verifyDateExistsInSourceText(aiData.dueDate, rawFileText)
            : "";
        const verifiedSubmitTarget = (aiData && aiData.submitTarget)
            ? cleanHallucinatedPlaceholder(aiData.submitTarget)
            : "";
        const compactDue = extractCompactYmdFromVerifiedDate(verifiedDueDate);

        // 3. 자동 폴더링 실행 (원문에 기한이 있으면 기한 날짜, 없으면 오늘 보관일자로 폴더 생성)
        const folderDatePrefix = compactDue || getLocalTodayCompact();
        const rawSubj = cleanHallucinatedPlaceholder(aiData && aiData.title) || baseName;
        const safeSubjForFolder = rawSubj
            .replace(/[\\/:*?"<>|]/g, "_")
            .replace(/\s+/g, "_")
            .slice(0, 48);
        const folderLabel = `${folderDatePrefix}_${safeSubjForFolder}`;

        let folderPath = "";
        let docFilePath = "";
        let targetNoteFolderId = null;

        if (foldChecked) {
            const diskRes = await executeDiskAutoFoldering(list, modeKey, folderLabel);
            folderPath = diskRes.folderPath;
            docFilePath = diskRes.docFilePath;
            targetNoteFolderId = await ensureBlackHoleTargetNoteFolder(modeKey);
        }

        const linkLabel = modeKey === "official" ? "공문 열기" : modeKey === "memo" ? "쪽지 열기" : "문서 열기";
        const linksHtml = foldChecked && folderPath
            ? `<p><br></p><p><strong>원본 및 폴더 바로가기</strong>: <a href="${escapeHtmlStr(docFilePath)}" target="_blank" rel="noopener noreferrer">${linkLabel}</a>  |  <a href="${escapeHtmlStr(folderPath)}" target="_blank" rel="noopener noreferrer">폴더 열기</a></p>`
            : "";

        // 4. [일반 문서 요약 모드] 억지 4칸 표(기한/제출처) 없이 문서 본연의 핵심만 깔끔하게 구성
        if (modeKey === "summary") {
            const noteTitle = rawSubj;
            if (!aiData) {
                const errHtml = [
                    `<p><strong>[MY AI 문서 요약 · ${escapeHtmlStr(selectedModelMeta.name)}]</strong></p>`,
                    `<blockquote>${escapeHtmlStr(aiErrorNotice || "문서를 요약할 수 없습니다.")}</blockquote>`,
                    linksHtml
                ].join("");
                return { title: noteTitle, html: errHtml, targetFolderId: targetNoteFolderId, aiErrorNotice };
            }

            const overview = cleanHallucinatedPlaceholder(aiData.overview);
            const highlightSentence = cleanHallucinatedPlaceholder(aiData.highlightSentence);
            const htmlParts = [
                `<p><strong>[MY AI 문서 핵심 요약 · ${escapeHtmlStr(selectedModelMeta.name)}]</strong></p>`
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
                usedRealAi: true
            };
        }

        // 5. [공문 분석 / 쪽지 분석 모드] 원문에 있는 사실만 표기하고, 없는 항목은 빈칸("")으로 유지
        const noteTitle = compactDue ? `${rawSubj} (${compactDue}까지)` : rawSubj;
        const headerBadge = modeKey === "official"
            ? `[MY AI 공문 분석 · ${selectedModelMeta.name}]`
            : `[MY AI 쪽지 분석 · ${selectedModelMeta.name}]`;

        if (!aiData) {
            const errHtml = [
                `<p><strong>${escapeHtmlStr(headerBadge)}</strong></p>`,
                `<blockquote>${escapeHtmlStr(aiErrorNotice || "문서를 분석할 수 없습니다.")}</blockquote>`,
                linksHtml
            ].join("");
            return { title: noteTitle, html: errHtml, targetFolderId: targetNoteFolderId, aiErrorNotice };
        }

        const summaryLead = cleanHallucinatedPlaceholder(aiData.summaryLead);
        const coreContent = cleanHallucinatedPlaceholder(aiData.coreContent);
        const keyPoints = Array.isArray(aiData.keyPoints)
            ? aiData.keyPoints.map((p) => cleanHallucinatedPlaceholder(p)).filter(Boolean)
            : [];

        const htmlParts = [
            `<p><strong>${escapeHtmlStr(headerBadge)}</strong></p>`
        ];

        if (summaryLead) {
            htmlParts.push(`<blockquote><span style="background-color: rgb(254, 240, 138);">${escapeHtmlStr(summaryLead)}</span></blockquote>`);
        }

        htmlParts.push(`<p><br></p>`);
        htmlParts.push([
            `<table><tbody>`,
            `<tr><td><strong>문서명</strong></td><td>${escapeHtmlStr(rawFileName)}</td></tr>`,
            `<tr><td><strong>일정 / 기한</strong></td><td>${escapeHtmlStr(verifiedDueDate)}</td></tr>`,
            `<tr><td><strong>장소 / 제출처</strong></td><td>${escapeHtmlStr(verifiedSubmitTarget)}</td></tr>`,
            `<tr><td><strong>핵심 내용</strong></td><td>${escapeHtmlStr(coreContent)}</td></tr>`,
            `</tbody></table>`
        ].join(""));

        if (keyPoints.length > 0) {
            const liHtml = keyPoints
                .map((pt) => `<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>${escapeHtmlStr(pt)}</li>`)
                .join("");
            htmlParts.push(`<p><br></p><p><strong>주요 내용</strong></p><ol>${liHtml}</ol>`);
        }

        if (linksHtml) htmlParts.push(linksHtml);

        return {
            title: noteTitle,
            html: htmlParts.join(""),
            targetFolderId: targetNoteFolderId,
            usedRealAi: true
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
            pill.textContent = `${firstName}${extra} 투입 중 (${meta.label} · ${modelMeta.name})`;
        }

        const totalSwallowMs = duration + (count - 1) * stagger + 40;
        const minWaitMs = Math.max(2100, totalSwallowMs + 860);

        bhSwallowTimer1 = setTimeout(() => {
            if (!bhIsOpen) return;
            if (pill) {
                pill.textContent = `${modelMeta.name} 모델이 문서를 분석·요약하고 있습니다...`;
            }
        }, totalSwallowMs);

        const analysisPromise = buildBlackHoleSummaryResult(list, activeMode, foldChecked);
        const minWaitPromise = new Promise((resolve) => {
            bhSwallowTimer2 = setTimeout(resolve, minWaitMs);
        });

        const [summaryResult] = await Promise.all([analysisPromise, minWaitPromise]);
        if (!bhIsOpen) return;

        bhSwallowing = false;
        closeBlackHolePortal();
        openBlackHoleSummaryInNewNote(summaryResult);

        if (typeof showToast === "function") {
            if (summaryResult && summaryResult.aiErrorNotice) {
                showToast(`${meta.label}: ${summaryResult.aiErrorNotice}`);
            } else {
                showToast(`[${modelMeta.name}] ${meta.label} 요약 노트가 생성되었습니다.`);
            }
        }

        // 공문 분석(official)과 쪽지 분석(memo)일 때만 1.2초 후 'MY 일정관리로 보내기' 팝업 자동 실행 (일반 문서 요약은 띄우지 않음)
        if (activeMode === "official" || activeMode === "memo") {
            bhAutoScheduleTimer = setTimeout(() => {
                bhAutoScheduleTimer = null;
                openSendToScheduleModal();
            }, 1200);
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
        window.addEventListener("resize", () => {
            if (bhIsOpen) updateBlackHoleButtonOriginVars();
        });
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

    window.addEventListener("DOMContentLoaded", () => {
        bindBlackHoleEvents();
        initNotesAutoBackupScheduler();
    });
    if (document.readyState === "interactive" || document.readyState === "complete") {
        bindBlackHoleEvents();
        initNotesAutoBackupScheduler();
    }
})();
