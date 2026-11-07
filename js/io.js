// ============================================================================
// 📁 [V4.7.1] Export 기본 저장 폴더 및 File System Access API 엔진
// ============================================================================

let cachedExportDirHandle = null;

// IndexedDB에서 디렉토리 핸들 가져오기
async function getStoredExportDirHandle() {
  if (cachedExportDirHandle) return cachedExportDirHandle;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('zen_fs_db', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('handles', 'readonly');
        const getReq = tx.objectStore('handles').get('export_dir');
        getReq.onsuccess = () => {
          cachedExportDirHandle = getReq.result || null;
          resolve(cachedExportDirHandle);
        };
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// IndexedDB에 디렉토리 핸들 저장하기
async function storeExportDirHandle(handle) {
  cachedExportDirHandle = handle;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('zen_fs_db', 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction('handles', 'readwrite');
        if (handle) {
          tx.objectStore('handles').put(handle, 'export_dir');
        } else {
          tx.objectStore('handles').delete('export_dir');
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// 🎯 [V4.7.1] 기본(다운로드) / 바탕화면 모드 변경
function setExportLocationMode(mode) {
  localStorage.setItem('zen_export_mode', mode);
  updateExportLocationUI(mode);
  if (typeof showToast === 'function') {
    if (mode === 'desktop') {
      showToast('Export 기본 저장 위치가 [바탕화면]으로 설정되었습니다.');
    } else {
      showToast('Export 기본 저장 위치가 [다운로드] 기본값으로 설정되었습니다.');
    }
  }
}

// 🎯 [V4.7.1] 사용자 지정 폴더 선택
async function chooseCustomExportDirectory() {
  if (!window.showDirectoryPicker) {
    if (typeof showToast === 'function') {
      showToast('현재 브라우저에서는 폴더 선택 기능을 지원하지 않습니다.');
    }
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'documents'
    });
    if (handle && handle.name) {
      await storeExportDirHandle(handle);
      localStorage.setItem('zen_export_mode', 'custom');
      localStorage.setItem('zen_export_dir_name', handle.name);
      updateExportLocationUI('custom', handle.name);
      if (typeof showToast === 'function') {
        showToast(`Export 기본 저장 위치가 [${handle.name}] 폴더로 설정되었습니다.`);
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('폴더 선택 취소 또는 오류:', err);
    }
  }
}

// 🎯 [V4.7.1] 초기화 (다운로드 기본값 복귀)
async function resetExportDirectory() {
  await storeExportDirHandle(null);
  localStorage.removeItem('zen_export_mode');
  localStorage.removeItem('zen_export_dir_name');
  updateExportLocationUI('download');
  if (typeof showToast === 'function') {
    showToast('Export 저장 위치가 기본값(다운로드)으로 초기화되었습니다.');
  }
}

// 🎯 [V4.7.1] 환경설정 UI 상태 동기화 헬퍼
function updateExportLocationUI(mode, customName) {
  const currentMode = mode || localStorage.getItem('zen_export_mode') || 'download';
  const customDirName = customName || localStorage.getItem('zen_export_dir_name') || '';

  // 1. 세그먼트 버튼 활성 상태 갱신
  const container = document.getElementById('setting-export-segmented');
  if (container) {
    const btns = container.querySelectorAll('.zen-segmented-btn');
    btns.forEach(btn => {
      const val = btn.getAttribute('data-value');
      if (val === currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // 2. 현재 상태 라벨 텍스트 갱신
  const labelEl = document.getElementById('setting-export-dir-current');
  if (labelEl) {
    if (currentMode === 'desktop') {
      labelEl.textContent = '현재: 바탕화면';
      labelEl.style.color = 'var(--accent)';
    } else if (currentMode === 'custom' && customDirName) {
      labelEl.textContent = `현재: ${customDirName}`;
      labelEl.style.color = 'var(--accent)';
    } else {
      labelEl.textContent = '현재: 기본(다운로드)';
      labelEl.style.color = 'var(--text-muted)';
    }
  }
}

// 🎯 [핵심] 공통 파일 저장 함수 (showSaveFilePicker 연동)
async function saveExportBlob(blob, defaultFilename, mimeType, description, extension) {
  const mode = localStorage.getItem('zen_export_mode') || 'download';

  // 1. File System Access API 지원 시 -> 원하는 폴더 지정 대화상자 호출
  if (window.showSaveFilePicker) {
    try {
      const pickerOptions = {
        suggestedName: defaultFilename,
        types: [{
          description: description || '문서 파일',
          accept: { [mimeType]: [extension] }
        }]
      };

      // 🎯 [V4.7.1] 모드에 따른 기본 시작 경로 분기
      if (mode === 'desktop') {
        pickerOptions.startIn = 'desktop'; // 바탕화면에서 즉시 오픈!
      } else if (mode === 'custom') {
        const startDirHandle = await getStoredExportDirHandle();
        if (startDirHandle) {
          pickerOptions.startIn = startDirHandle; // 지정된 사용자 폴더에서 오픈!
        } else {
          pickerOptions.startIn = 'documents';
        }
      } else {
        pickerOptions.startIn = 'downloads'; // 기본 다운로드 폴더에서 오픈!
      }

      const fileHandle = await window.showSaveFilePicker(pickerOptions);
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();

      if (typeof showToast === 'function') {
        showToast(`[${fileHandle.name}] 파일 저장이 완료되었습니다.`);
      }
      return true;
    } catch (err) {
      // 사용자가 저장을 취소한 경우 (Esc 또는 취소 버튼)
      if (err.name === 'AbortError') {
        if (typeof showToast === 'function') {
          showToast('저장이 취소되었습니다.');
        }
        return false;
      }
      console.warn('showSaveFilePicker 실패, 기본 다운로드로 전환:', err);
    }
  }

  // 2. 미지원 환경 또는 에러 시 fallback: 기존 saveAs (다운로드 폴더 저장)
  if (typeof saveAs === 'function') {
    saveAs(blob, defaultFilename);
    if (typeof showToast === 'function') {
      showToast(`${defaultFilename} 파일이 저장되었습니다.\n(다운로드 폴더 확인)`);
    }
  }
  return true;
}

window.setExportLocationMode = setExportLocationMode;
window.chooseCustomExportDirectory = chooseCustomExportDirectory;
window.resetExportDirectory = resetExportDirectory;
window.updateExportLocationUI = updateExportLocationUI;
window.saveExportBlob = saveExportBlob;

// 🎯 1. [PDF 전용] 라이트 테마 CSS (인쇄용 화이트 바탕 & 페이지 절단 방어 & 고정밀 팔레트)
const exportThemeCSS_Light = `
<style>
    .zen-export-wrapper { background: #ffffff; color: #111111; font-family: 'Pretendard', 'Nanum Gothic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.65; word-break: keep-all; overflow-wrap: break-word; }
    .zen-export-wrapper p, .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3, .zen-export-wrapper li { margin-bottom: 8px; }
    .zen-export-wrapper ul, .zen-export-wrapper ol { margin-bottom: 16px; padding-left: 1.5em; }
    
    /* 🎯 페이지 분할 방어 (Page-Break Defense) */
    .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3 { page-break-after: avoid !important; break-after: avoid !important; }
    .zen-export-wrapper p, .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3 { page-break-inside: avoid !important; break-inside: avoid !important; orphans: 3; widows: 3; }
    .zen-export-wrapper table, .zen-export-wrapper tr, .zen-export-wrapper td, .zen-export-wrapper th { page-break-inside: avoid !important; break-inside: avoid !important; }
    .zen-export-wrapper .ql-code-block-container { page-break-inside: avoid !important; break-inside: avoid !important; }
    .zen-export-wrapper blockquote { page-break-inside: avoid !important; break-inside: avoid !important; }
    .zen-export-wrapper li { page-break-inside: avoid !important; break-inside: avoid !important; }

    /* 🎯 [V4.5.5] 제목 위의 상단 여백(약 19mm)과 이미지 하단 여백(약 20mm)이 대칭을 이루며 [제목+이미지] 전체가 종이 정중앙에 오도록 max-height: 238mm 설정 */
    .zen-export-wrapper img { max-width: 100% !important; max-height: 238mm !important; width: auto !important; height: auto !important; display: block !important; margin: 4px auto !important; object-fit: contain !important; page-break-inside: avoid !important; break-inside: avoid !important; }
    .zen-export-wrapper p:has(> img:only-child) { margin: 2px 0 !important; }

    /* 🎯 [V4.5.3] 체크리스트(checked/unchecked) 및 인용구 리스트 PDF 렌더링 지원 */
    .zen-export-wrapper li[data-list="checked"],
    .zen-export-wrapper li[data-list="unchecked"] { list-style-type: none !important; position: relative; }
    .zen-export-wrapper li[data-list="checked"] > .ql-ui,
    .zen-export-wrapper li[data-list="unchecked"] > .ql-ui { display: none !important; }
    .zen-export-wrapper li[data-list="unchecked"]::before { content: '☐' !important; color: #555555 !important; font-weight: 600 !important; margin-left: -1.5em !important; margin-right: 0.5em !important; display: inline-block !important; width: 1em !important; text-align: right !important; }
    .zen-export-wrapper li[data-list="checked"]::before { content: '☑' !important; color: #2563eb !important; font-weight: 600 !important; margin-left: -1.5em !important; margin-right: 0.5em !important; display: inline-block !important; width: 1em !important; text-align: right !important; }
    .zen-export-wrapper li[data-list="checked"] { color: #888888 !important; text-decoration: line-through !important; }

    .zen-export-wrapper table { border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #d1d5db; }
    .zen-export-wrapper td, .zen-export-wrapper th { border: 1px solid #d1d5db; padding: 8px 12px; color: #111111; }
    .zen-export-wrapper th { background-color: #f3f4f6 !important; font-weight: 600 !important; }
    .zen-export-wrapper blockquote,
    .zen-export-wrapper .ql-editor blockquote,
    .zen-export-wrapper .ql-editor li.ql-quote-item,
    .zen-export-wrapper .ql-editor li.ql-quote-item-true {
        border-left: 3px solid #60a5fa !important;
        background-color: #f8fafc !important;
        margin: 12px 0 !important;
        padding: 10px 16px !important;
        color: #334155 !important;
        font-style: normal !important;
        border-radius: 0 6px 6px 0 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
    .zen-export-wrapper code,
    .zen-export-wrapper .ql-editor code {
        background-color: #f1f5f9 !important;
        color: #0f172a !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        font-family: 'D2Coding', 'Consolas', monospace !important;
    }
    
    /* 🎯 PDF 다크 침범 방어 & 라벨 세팅 */
    .zen-export-wrapper .ql-code-block-container { position: relative !important; background-color: #f8fafc !important; border: 1px solid #e2e8f0 !important; border-radius: 8px !important; padding: 40px 16px 14px 16px !important; margin: 12px 0 !important; }
    .zen-export-wrapper .ql-code-block-container select.ql-ui { display: block !important; position: absolute !important; top: 10px !important; left: 16px !important; background: transparent !important; color: #64748b !important; border: none !important; font-size: 11.5px !important; font-weight: 600 !important; text-transform: uppercase; appearance: none !important; -webkit-appearance: none !important; pointer-events: none !important; }
    .zen-export-wrapper .ql-code-block-container::before { content: '' !important; position: absolute !important; top: 34px !important; left: 0 !important; right: 0 !important; height: 1px !important; background-color: #e2e8f0 !important; display: block !important; }
    
    /* 🎯 폰트 및 구문 강조 팔레트 (인쇄용 명암비 적용) */
    .zen-export-wrapper .ql-code-block { background-color: transparent !important; color: #1e293b !important; font-family: 'D2Coding', 'Consolas', monospace !important; font-size: 13px !important; line-height: 1.6 !important; white-space: pre-wrap !important; }
    .zen-export-wrapper .hljs-comment, .zen-export-wrapper .hljs-quote { color: #6a737d !important; font-style: italic !important; }
    .zen-export-wrapper .hljs-keyword, .zen-export-wrapper .hljs-selector-tag, .zen-export-wrapper .hljs-type { color: #d73a49 !important; font-weight: 600 !important; }
    .zen-export-wrapper .hljs-title, .zen-export-wrapper .hljs-title.function_, .zen-export-wrapper .hljs-function { color: #005cc5 !important; }
    .zen-export-wrapper .hljs-name, .zen-export-wrapper .hljs-section, .zen-export-wrapper .hljs-tag { color: #22863a !important; }
    .zen-export-wrapper .hljs-attr, .zen-export-wrapper .hljs-attribute, .zen-export-wrapper .hljs-params { color: #e36209 !important; }
    .zen-export-wrapper .hljs-string, .zen-export-wrapper .hljs-regexp { color: #032f62 !important; }
    .zen-export-wrapper .hljs-number, .zen-export-wrapper .hljs-literal, .zen-export-wrapper .hljs-variable { color: #005cc5 !important; }
    .zen-export-wrapper .hljs-built_in, .zen-export-wrapper .hljs-class { color: #e36209 !important; }
    
    .zen-export-wrapper .ql-strike-line-true { color: #94a3b8; text-decoration: line-through; }
    .zen-export-wrapper a { color: #2563eb; text-decoration: underline; }
</style>
`;

// 🎯 2. [HTML 전용] 듀얼 테마 CSS (다크 기본 + 라이트 모드 전환 지원 + 인쇄 최적화)
const exportThemeCSS_Dual = `
<style>
    :root {
        --zen-bg: #131314;
        --zen-text: #e3e3e3;
        --zen-border: #444746;
        --zen-code-bg: #1e222a;
        --zen-code-header-border: rgba(255, 255, 255, 0.08);
        --zen-th-bg: #2e2e32;
        --zen-quote-bg: #1e1e20;
        --zen-quote-text: #c4c7c5;
        --zen-accent: #78a9ff;
        --zen-meta-text: #8e9196;
        --zen-card-bg: #1e1e20;
    }

    body.light-theme {
        --zen-bg: #ffffff;
        --zen-text: #1c1c1e;
        --zen-border: #e0e0e0;
        --zen-code-bg: #f6f8fa;
        --zen-code-header-border: #e1e4e8;
        --zen-th-bg: #f2f3f5;
        --zen-quote-bg: #f9f9f9;
        --zen-quote-text: #333333;
        --zen-accent: #78a9ff;
        --zen-meta-text: #6c7078;
        --zen-card-bg: #f9f9fb;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    
    body.zen-export-body {
        background-color: var(--zen-bg);
        color: var(--zen-text);
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        line-height: 1.65;
        word-break: keep-all;
        overflow-wrap: break-word;
        transition: background-color 0.2s ease, color 0.2s ease;
        padding: 40px 20px;
    }

    .zen-doc-container {
        max-width: 820px;
        margin: 0 auto;
    }

    /* 플로팅 테마 스위치 버튼 */
    .zen-theme-switch-btn {
        position: fixed;
        top: 20px;
        right: 24px;
        z-index: 1000;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 20px;
        border: 1px solid var(--zen-border);
        background: var(--zen-card-bg);
        color: var(--zen-text);
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        transition: all 0.2s ease;
    }
    .zen-theme-switch-btn:hover {
        transform: translateY(-1px);
        opacity: 0.9;
    }

    /* 문서 헤더 및 메타데이터 */
    .zen-doc-header {
        margin-bottom: 22px;
    }
    .zen-doc-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--zen-text);
        margin: 0 0 8px 0;
        letter-spacing: -0.4px;
        line-height: 1.35;
    }
    .zen-doc-meta {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        font-size: 12.5px;
        color: var(--zen-meta-text);
        margin-bottom: 12px;
    }
    .zen-meta-item {
        display: inline-flex;
        align-items: center;
    }
    .zen-doc-divider {
        border: none;
        border-bottom: 1px solid var(--zen-border);
        margin: 0;
    }

    /* 에디터 본문 타이포그래피 */
    .ql-editor { padding: 0; }
    .ql-editor p, .ql-editor h1, .ql-editor h2, .ql-editor h3, .ql-editor li { margin-bottom: 8px; }
    .ql-editor ul, .ql-editor ol { margin-bottom: 16px; padding-left: 1.5em; }
    .ql-editor hr { border: none !important; border-bottom: 1px solid var(--zen-border) !important; margin: 20px 0 !important; }

    /* 🎯 [V4.5.3] 체크리스트(checked/unchecked) HTML 렌더링 지원 */
    .ql-editor li[data-list="checked"],
    .ql-editor li[data-list="unchecked"] { list-style-type: none !important; position: relative; }
    .ql-editor li[data-list="checked"] > .ql-ui,
    .ql-editor li[data-list="unchecked"] > .ql-ui { display: none !important; }
    .ql-editor li[data-list="unchecked"]::before { content: '☐' !important; color: var(--zen-meta-text) !important; font-weight: 600 !important; margin-left: -1.5em !important; margin-right: 0.5em !important; display: inline-block !important; width: 1em !important; text-align: right !important; }
    .ql-editor li[data-list="checked"]::before { content: '☑' !important; color: var(--zen-accent) !important; font-weight: 600 !important; margin-left: -1.5em !important; margin-right: 0.5em !important; display: inline-block !important; width: 1em !important; text-align: right !important; }
    .ql-editor li[data-list="checked"] { color: var(--zen-meta-text) !important; text-decoration: line-through !important; }

    /* 표 (Table) */
    .ql-editor table { border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid var(--zen-border); }
    .ql-editor td, .ql-editor th { border: 1px solid var(--zen-border); padding: 8px 12px; color: var(--zen-text); }
    .ql-editor th { background-color: var(--zen-th-bg); font-weight: 600; }

    /* 인용구 (Blockquote) 및 인용구 리스트 */
    .ql-editor blockquote,
    .ql-editor li.ql-quote-item,
    .ql-editor li.ql-quote-item-true { border-left: 3px solid var(--zen-accent); background-color: var(--zen-quote-bg); margin: 12px 0; padding: 10px 16px; color: var(--zen-quote-text); border-radius: 0 6px 6px 0; font-style: normal; }

    /* 링크 및 서식 */
    .ql-editor a { color: var(--zen-accent); text-decoration: underline; }
    .ql-editor img { max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 6px 0; }
    .ql-editor .ql-strike-line-true { text-decoration: line-through; opacity: 0.6; }

    /* 코드 블록 공통 구조 */
    .ql-editor .ql-code-block-container {
        position: relative !important;
        background-color: var(--zen-code-bg) !important;
        border: 1px solid var(--zen-border) !important;
        border-radius: 8px !important;
        padding: 40px 16px 14px 16px !important;
        margin: 12px 0 !important;
        display: block !important;
    }
    .ql-editor .ql-code-block-container select.ql-ui {
        display: block !important;
        position: absolute !important;
        top: 10px !important;
        left: 16px !important;
        background: transparent !important;
        color: var(--zen-meta-text) !important;
        border: none !important;
        font-size: 11.5px !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        appearance: none !important;
        -webkit-appearance: none !important;
        pointer-events: none !important;
    }
    .ql-editor .ql-code-block-container::before {
        content: '' !important;
        position: absolute !important;
        top: 34px !important;
        left: 0 !important;
        right: 0 !important;
        height: 1px !important;
        background-color: var(--zen-code-header-border) !important;
        display: block !important;
        pointer-events: none !important;
    }
    .ql-editor .ql-code-block {
        background-color: transparent !important;
        font-family: 'D2Coding', 'Consolas', monospace !important;
        font-size: 13.5px !important;
        line-height: 1.6 !important;
        white-space: pre-wrap !important;
    }

    /* 🎨 [V3.4.7] 다크 테마 코드 신택스 (One Dark Pro Vivid) */
    body:not(.light-theme) .ql-code-block { color: #d7dae0 !important; }
    body:not(.light-theme) .hljs-comment, body:not(.light-theme) .hljs-quote { color: #6d7688 !important; font-style: italic; }
    body:not(.light-theme) .hljs-keyword, body:not(.light-theme) .hljs-selector-tag, body:not(.light-theme) .hljs-doctag { color: #e06c75 !important; font-weight: 600; }
    body:not(.light-theme) .hljs-meta, body:not(.light-theme) .hljs-preprocess { color: #c678dd !important; font-weight: 600; }
    body:not(.light-theme) .hljs-title, body:not(.light-theme) .hljs-title.function_, body:not(.light-theme) .hljs-function { color: #61afef !important; }
    body:not(.light-theme) .hljs-type, body:not(.light-theme) .hljs-built_in, body:not(.light-theme) .hljs-class .hljs-title { color: #e5c07b !important; font-weight: 600; }
    body:not(.light-theme) .hljs-string, body:not(.light-theme) .hljs-regexp { color: #98c379 !important; }
    body:not(.light-theme) .hljs-number, body:not(.light-theme) .hljs-literal, body:not(.light-theme) .hljs-constant { color: #ff9e64 !important; }
    body:not(.light-theme) .hljs-name, body:not(.light-theme) .hljs-tag, body:not(.light-theme) .hljs-section { color: #f7768e !important; }
    body:not(.light-theme) .hljs-attr, body:not(.light-theme) .hljs-attribute, body:not(.light-theme) .hljs-params, body:not(.light-theme) .hljs-variable { color: #56b6c2 !important; }

    /* 🎨 라이트 테마 코드 신택스 */
    body.light-theme .ql-code-block { color: #24292e !important; }
    body.light-theme .hljs-comment, body.light-theme .hljs-quote { color: #6a737d !important; font-style: italic; }
    body.light-theme .hljs-keyword, body.light-theme .hljs-selector-tag, body.light-theme .hljs-type { color: #d73a49 !important; font-weight: 600; }
    body.light-theme .hljs-title, body.light-theme .hljs-title.function_, body.light-theme .hljs-function { color: #005cc5 !important; }
    body.light-theme .hljs-string, body.light-theme .hljs-regexp { color: #032f62 !important; }
    body.light-theme .hljs-number, body.light-theme .hljs-literal, body.light-theme .hljs-variable { color: #005cc5 !important; }
    body.light-theme .hljs-name, body.light-theme .hljs-tag, body.light-theme .hljs-section { color: #22863a !important; }
    body.light-theme .hljs-attr, body.light-theme .hljs-attribute, body.light-theme .hljs-params { color: #e36209 !important; }

    /* 🖨️ 인쇄 시 화이트 강제 & [제목+이미지] 상하 여백 균형 배치 */
    @page { size: A4; margin: 18mm 10mm 10mm 10mm; }
    @media print {
        .zen-theme-switch-btn { display: none !important; }
        body.zen-export-body { background: #ffffff !important; color: #000000 !important; padding: 4px 2px 0 2px !important; }
        .ql-editor p, .ql-editor h1, .ql-editor h2, .ql-editor h3, .ql-editor li, .ql-editor blockquote, .ql-editor tr, .ql-editor img, .ql-editor .ql-code-block-container { page-break-inside: avoid !important; break-inside: avoid !important; }
        .ql-editor img { max-width: 100% !important; max-height: 238mm !important; width: auto !important; height: auto !important; display: block !important; margin: 4px auto !important; object-fit: contain !important; }
        .ql-editor p, .ql-editor li { orphans: 3; widows: 3; }
        .ql-editor h1, .ql-editor h2, .ql-editor h3 { page-break-after: avoid !important; break-after: avoid !important; }
        .zen-doc-title { color: #000000 !important; }
        .zen-doc-divider { border-bottom-color: #d1d5db !important; }
        .ql-editor table, .ql-editor th, .ql-editor td { border-color: #d1d5db !important; color: #000000 !important; }
        .ql-editor th { background-color: #f3f4f6 !important; }
        .ql-editor blockquote { background-color: #f8fafc !important; color: #334155 !important; border-left: 3px solid #60a5fa !important; font-style: normal !important; border-radius: 0 6px 6px 0 !important; }
        .ql-editor .ql-code-block-container { background-color: #f8fafc !important; border-color: #e2e8f0 !important; }
        .ql-editor .ql-code-block { color: #1e293b !important; }
    }
</style>
`;

const getTitle = () =>
  document.getElementById("memo-title-input").value || "제목 없는 노트";

// 🎯 [신규 추가] 드롭다운의 현재 선택 값을 HTML 속성(selected)으로 강제 고정하는 함수
function getHtmlWithSelectState() {
  const selects = quill.root.querySelectorAll('select.ql-ui');
  selects.forEach(select => {
    const selectedValue = select.value;
    const options = select.querySelectorAll('option');
    options.forEach(opt => {
      if (opt.value === selectedValue) {
        opt.setAttribute('selected', 'selected');
      } else {
        opt.removeAttribute('selected');
      }
    });
  });
  return quill.root.innerHTML;
}

// 🎯 [V3.4.5] HTML 특수문자 이스케이프 헬퍼
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 🎯 [V4.5.3] 문서 내보내기용 일시 포맷터 (ZenNotes 표준 규격: YYYY.MM.DD.(요일) HH:mm)
function formatExportDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}.(${days[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 🎯 [V3.4.5] 본문 텍스트 내 해시태그(#태그) 자동 추출
function extractHashTags(text) {
  if (!text) return [];
  const matches = text.match(/#[^\s#]+/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((t) => t.replace(/^#/, "").trim()))).filter(Boolean);
}

// 🎯 [V3.4.5] 현재 활성화된 노트의 상세 메타데이터 비동기 수집 (폴더 경로, 생성/수정일시 등)
async function getCurrentMemoDetails() {
  const title = getTitle();
  const now = Date.now();

  return new Promise((resolve) => {
    if (!currentMemoId || !db) {
      resolve({
        id: null,
        syncId: null,
        title,
        folderPath: "바탕 화면",
        createdAt: now,
        updatedAt: now,
        isPinned: false,
      });
      return;
    }

    try {
      const tx = db.transaction(["memos"], "readonly");
      const store = tx.objectStore("memos");
      store.getAll().onsuccess = (e) => {
        const all = e.target.result || [];
        const memo = all.find((m) => m.id === currentMemoId);
        if (!memo) {
          resolve({
            id: currentMemoId,
            syncId: null,
            title,
            folderPath: "바탕 화면",
            createdAt: now,
            updatedAt: now,
            isPinned: false,
          });
          return;
        }

        const folderMap = new Map();
        all.forEach((m) => {
          if (m.type === "folder") folderMap.set(m.id, m);
        });

        let path = [];
        let curr = memo.parentId;
        while (curr) {
          const f = folderMap.get(curr);
          if (!f) break;
          path.unshift(f.title);
          curr = f.parentId;
        }
        const folderPath = path.length > 0 ? path.join(" / ") : "바탕 화면";

        resolve({
          id: memo.id,
          syncId: memo.syncId || null,
          title,
          folderPath,
          createdAt: memo.createdAt || memo.updatedAt || now,
          updatedAt: memo.updatedAt || now,
          isPinned: !!memo.pinnedAt,
        });
      };
      store.getAll().onerror = () => {
        resolve({
          id: currentMemoId,
          syncId: null,
          title,
          folderPath: "바탕 화면",
          createdAt: now,
          updatedAt: now,
          isPinned: false,
        });
      };
    } catch (err) {
      resolve({
        id: currentMemoId,
        syncId: null,
        title,
        folderPath: "바탕 화면",
        createdAt: now,
        updatedAt: now,
        isPinned: false,
      });
    }
  });
}


// 🎯 [V4.5.3] HTML 파일 내보내기 (내부 폴더 경로 제거 & 단정한 Zen 스타일 헤더)
async function exportHTML() {
  closeAllPanelsMobile();
  const meta = await getCurrentMemoDetails();
  const t = getTitle();
  const c = getHtmlWithSelectState();
  const updatedAtStr = formatExportDate(meta.updatedAt || meta.createdAt);
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);
  const tagPills = tags.length > 0
    ? `<span class="zen-meta-item">${tags.map((tag) => '#' + escapeHtml(tag)).join(' ')}</span>`
    : '<span></span>';

  setTimeout(async () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(t)}</title>
    ${exportThemeCSS_Dual}
</head>
<body class="zen-export-body">
    <button class="zen-theme-switch-btn" id="theme-btn" onclick="toggleExportTheme()" title="다크 / 라이트 모드 전환">
        <span id="theme-label">라이트 모드</span>
    </button>
    <div class="zen-doc-container">
        <header class="zen-doc-header">
            <h1 class="zen-doc-title">${escapeHtml(t)}</h1>
            <div class="zen-doc-meta">
                ${tagPills}
                <span class="zen-meta-item">${updatedAtStr}</span>
            </div>
            <hr class="zen-doc-divider">
        </header>
        <main id="zen-editor-content" class="ql-editor">${c}</main>
    </div>
    <script>
        function toggleExportTheme() {
            const isLight = document.body.classList.toggle('light-theme');
            const label = document.getElementById('theme-label');
            if (label) label.textContent = isLight ? '다크 모드' : '라이트 모드';
            try { localStorage.setItem('zen_export_theme', isLight ? 'light' : 'dark'); } catch(e){}
        }
        (function() {
            try {
                if (localStorage.getItem('zen_export_theme') === 'light') {
                    document.body.classList.add('light-theme');
                    const label = document.getElementById('theme-label');
                    if (label) label.textContent = '다크 모드';
                }
            } catch(e){}
        })();
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    await saveExportBlob(blob, `${t}.html`, "text/html", "HTML 웹 페이지 (*.html)", ".html");
  }, 100);
}

// 🎯 [V4.5.3] & [V4.7.0] PDF 파일 내보내기 (저장 폴더 지정 연동)
async function exportPDF() {
  document.body.classList.add('is-pdf-exporting');
  closeAllPanelsMobile();
  showToast("PDF 변환을 시작합니다...\n(잠시만 기다려주세요)");

  const meta = await getCurrentMemoDetails();
  const t = getTitle();
  const c = getHtmlWithSelectState();
  const updatedAtStr = formatExportDate(meta.updatedAt || meta.createdAt);
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);
  const tagStr = tags.length > 0 ? tags.map((tg) => '#' + escapeHtml(tg)).join(' ') : '';

  setTimeout(() => {
    const printContainer = document.createElement("div");
    printContainer.innerHTML = `
        ${exportThemeCSS_Light}
        <div class="zen-export-wrapper" style="padding: 4px 2px 0 2px; background-color: #ffffff;">
            <div style="max-width: 800px; margin: 0 auto;">
                <div style="font-size: 22px; font-weight: 700; color: #111111; margin-bottom: 4px; letter-spacing: -0.4px; line-height: 1.35;">${escapeHtml(t)}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; margin-bottom: 8px;">
                    <span>${tagStr}</span>
                    <span>${updatedAtStr}</span>
                </div>
                <hr style="border: none; border-bottom: 1px solid #d1d5db; margin: 0 0 12px 0;">
                <div class="ql-snow">
                    <div class="ql-editor" style="padding: 0; color: #111111; overflow: visible; height: auto;">${c}</div>
                </div>
            </div>
        </div>`;

    // 🎯 [V4.5.3] 문서 끝에 붙은 불필요한 빈 문단(<p><br></p>)을 정리하여 빈 페이지 넘김 원천 차단
    const clonedEditor = printContainer.querySelector(".ql-editor");
    if (clonedEditor) {
      while (clonedEditor.children.length > 1) {
        const lastEl = clonedEditor.lastElementChild;
        if (
          lastEl &&
          lastEl.tagName === "P" &&
          !lastEl.querySelector("img, iframe, table") &&
          lastEl.textContent.trim() === ""
        ) {
          lastEl.remove();
        } else {
          break;
        }
      }
    }

    html2pdf()
      .set({
        margin: [18, 10, 10, 10],
        filename: `${t}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['p', 'h1', 'h2', 'h3', 'li', 'blockquote', 'tr', 'img', '.ql-code-block-container'] }
      })
      .from(printContainer)
      .outputPdf('blob')
      .then(async (pdfBlob) => {
        await saveExportBlob(pdfBlob, `${t}.pdf`, "application/pdf", "PDF 문서 (*.pdf)", ".pdf");
      })
      .catch((err) => {
        console.error("PDF 생성 오류:", err);
        showToast("PDF 저장 중 오류가 발생했습니다.");
      })
      .finally(() => {
        document.body.classList.remove('is-pdf-exporting');
      });
  }, 300);
}

// 🎯 [V4.5.3] & [V4.7.0] TXT 파일 내보내기 (저장 폴더 지정 연동)
async function exportTXT() {
  closeAllPanelsMobile();
  const meta = await getCurrentMemoDetails();
  const t = getTitle();
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);
  const updatedAtStr = formatExportDate(meta.updatedAt || meta.createdAt);
  const tagsSuffix = tags.length > 0 ? `  ${tags.map((tag) => '#' + tag).join(' ')}` : '';

  const divider = "────────────────────────────────────────────────────────────";
  const header = `${t}\n${updatedAtStr}${tagsSuffix}\n${divider}\n\n`;

  const fullText = "\uFEFF" + header + plainText.trim() + "\n";

  setTimeout(async () => {
    const blob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
    await saveExportBlob(blob, `${t}.txt`, "text/plain", "텍스트 문서 (*.txt)", ".txt");
  }, 100);
}

// 🎯 [V4.5.3] & [V4.7.0] JSON 파일 내보내기 (저장 폴더 지정 연동)
async function exportJSON() {
  closeAllPanelsMobile();
  const meta = await getCurrentMemoDetails();
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);

  const jsonPayload = {
    schemaVersion: "2.0",
    type: "ZenMemo",
    id: meta.id,
    syncId: meta.syncId,
    title: meta.title,
    tags: tags,
    isPinned: meta.isPinned,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    exportedAt: Date.now(),
    content: quill.root.innerHTML,
    plainText: plainText
  };

  const jsonString = JSON.stringify(jsonPayload, null, 2);

  setTimeout(async () => {
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
    await saveExportBlob(blob, `${meta.title}.json`, "application/json", "JSON 데이터 (*.json)", ".json");
  }, 100);
}

// 🎯 [V3.3.3] HTML/Quill 에디터 내용을 깔끔한 마크다운(.md) 문법으로 변환
function convertQuillToMarkdown() {
  const container = document.createElement("div");
  container.innerHTML = quill.root.innerHTML;

  // 인라인 노드들을 마크다운 기호로 재귀 변환
  function convertInline(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue || "";
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tag = node.tagName.toLowerCase();

    // 빈 개행이나 softbreak 처리
    if (tag === "br") {
      return "\n";
    }

    // 자식 인라인 텍스트 먼저 변환
    let innerText = "";
    node.childNodes.forEach((child) => {
      innerText += convertInline(child);
    });

    if (tag === "strong" || tag === "b") {
      return innerText ? `**${innerText}**` : "";
    }
    if (tag === "em" || tag === "i") {
      return innerText ? `*${innerText}*` : "";
    }
    if (tag === "u") {
      // 🎯 [V4.3.4] 마크다운 표준 밑줄 호환성: Obsidian, GitHub, Notion 표준 규격인 <u> 태그로 내보내기
      return innerText ? `<u>${innerText}</u>` : "";
    }
    if (tag === "s" || tag === "del" || node.classList.contains("ql-strike-line")) {
      return innerText ? `~~${innerText}~~` : "";
    }
    if (tag === "code") {
      return innerText ? `\`${innerText}\`` : "";
    }
    if (tag === "a") {
      const href = node.getAttribute("href") || "";
      return `[${innerText || href}](${href})`;
    }
    if (tag === "img") {
      const alt = node.getAttribute("alt") || "image";
      const src = node.getAttribute("src") || "";
      return `![${alt}](${src})`;
    }

    return innerText;
  }

  // 🎯 [V3.4.4] 목록 아이템을 마크다운 표준 들여쓰기 규격(2스페이스 단위)으로 변환
  function formatListItem(li, counters) {
    const match = (li.className || "").match(/ql-indent-(\d+)/);
    const indentLvl = match ? parseInt(match[1], 10) : 0;
    const indentSpaces = "  ".repeat(indentLvl);
    const itemText = convertInline(li).trim();
    const listType = li.getAttribute("data-list");
    const isQuoted = li.classList.contains("ql-quote-item") || li.classList.contains("ql-quote-item-true");
    const qPrefix = isQuoted ? "> " : "";

    if (listType === "checked") {
      Object.keys(counters).forEach((k) => {
        if (parseInt(k, 10) >= indentLvl) delete counters[k];
      });
      return `${qPrefix}${indentSpaces}- [x] ${itemText}`;
    } else if (listType === "unchecked" || listType === "check") {
      Object.keys(counters).forEach((k) => {
        if (parseInt(k, 10) >= indentLvl) delete counters[k];
      });
      return `${qPrefix}${indentSpaces}- [ ] ${itemText}`;
    } else if (
      listType === "ordered" ||
      (li.parentElement && li.parentElement.tagName.toLowerCase() === "ol" && !listType)
    ) {
      counters[indentLvl] = (counters[indentLvl] || 0) + 1;
      Object.keys(counters).forEach((k) => {
        if (parseInt(k, 10) > indentLvl) delete counters[k];
      });
      return `${qPrefix}${indentSpaces}${counters[indentLvl]}. ${itemText}`;
    } else {
      Object.keys(counters).forEach((k) => {
        if (parseInt(k, 10) >= indentLvl) delete counters[k];
      });
      return `${qPrefix}${indentSpaces}- ${itemText}`;
    }
  }

  const lines = [];
  const children = Array.from(container.children);

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const tag = el.tagName.toLowerCase();

    // 1. 제목 (H1 ~ H6)
    if (tag === "h1") {
      lines.push(`# ${convertInline(el).trim()}`);
    } else if (tag === "h2") {
      lines.push(`## ${convertInline(el).trim()}`);
    } else if (tag === "h3") {
      lines.push(`### ${convertInline(el).trim()}`);
    } else if (tag === "h4") {
      lines.push(`#### ${convertInline(el).trim()}`);
    } else if (tag === "h5") {
      lines.push(`##### ${convertInline(el).trim()}`);
    } else if (tag === "h6") {
      lines.push(`###### ${convertInline(el).trim()}`);
    }
    // 2. 인용구
    else if (tag === "blockquote") {
      const quoteText = convertInline(el).trim();
      const quoteLines = quoteText.split("\n").map((l) => `> ${l}`).join("\n");
      lines.push(quoteLines);
    }
    // 3. 코드 블록 컨테이너
    else if (el.classList.contains("ql-code-block-container") || tag === "pre") {
      const codeLines = [];
      const codeBlocks = el.querySelectorAll(".ql-code-block");
      // 🎯 [V4.3.4] 코드 블록 언어 태그 추출 (GFM 표준 호환)
      let lang = "";
      if (codeBlocks.length > 0) {
        lang = codeBlocks[0].getAttribute("data-language") || "";
        codeBlocks.forEach((cb) => codeLines.push(cb.textContent));
      } else {
        codeLines.push(el.textContent);
      }
      if (!lang) {
        lang = el.getAttribute("data-language") || el.querySelector("select.ql-ui")?.value || "";
      }
      if (lang === "plain") lang = "";
      lines.push("```" + lang + "\n" + codeLines.join("\n") + "\n```");
    }
    // 4. 단일 코드 블록 행
    else if (el.classList.contains("ql-code-block")) {
      let lang = el.getAttribute("data-language") || "";
      if (lang === "plain") lang = "";
      const codeLines = [el.textContent];
      while (i + 1 < children.length && children[i + 1].classList.contains("ql-code-block")) {
        i++;
        codeLines.push(children[i].textContent);
      }
      lines.push("```" + lang + "\n" + codeLines.join("\n") + "\n```");
    }
    // 5. 구분선 (HR)
    else if (tag === "hr") {
      lines.push("---");
    }
    // 6. 목록 (ul, ol, 또는 단독 li) - 🎯 [V3.4.4] 들여쓰기 보존 및 연속 목록 단일 블록 연결
    else if (tag === "ul" || tag === "ol" || tag === "li") {
      const counters = {};
      const listLines = [];

      const processListContainer = (targetEl) => {
        if (targetEl.tagName.toLowerCase() === "li") {
          listLines.push(formatListItem(targetEl, counters));
        } else {
          const items = Array.from(targetEl.querySelectorAll("li"));
          items.forEach((item) => listLines.push(formatListItem(item, counters)));
        }
      };

      processListContainer(el);

      // 다음 형제들도 연속된 목록 요소(ul, ol, li)라면 하나의 연속된 마크다운 목록 블록(\n)으로 결합
      while (
        i + 1 < children.length &&
        ["ul", "ol", "li"].includes(children[i + 1].tagName.toLowerCase())
      ) {
        i++;
        processListContainer(children[i]);
      }

      if (listLines.length > 0) {
        lines.push(listLines.join("\n"));
      }
    }
    // 8. 표 (Table)
    else if (tag === "table") {
      const rows = Array.from(el.querySelectorAll("tr"));
      if (rows.length > 0) {
        const mdTable = [];
        rows.forEach((row, rIdx) => {
          const cells = Array.from(row.querySelectorAll("th, td"));
          const cellTexts = cells.map((c) => {
            // 표 셀 내부의 줄바꿈은 마크다운 행 분리 방지를 위해 <br>로 치환
            let text = convertInline(c).trim();
            text = text.replace(/\r?\n/g, "<br>");
            return text.replace(/\|/g, "\\|");
          });
          mdTable.push(`| ${cellTexts.join(" | ")} |`);

          // 첫 번째 행 뒤에 구분선 헤더 추가
          if (rIdx === 0) {
            const separator = cells.map(() => "---").join(" | ");
            mdTable.push(`| ${separator} |`);
          }
        });
        lines.push(mdTable.join("\n"));
      }
    }
    // 9. 일반 문단 및 기타
    else {
      const pText = convertInline(el).trim();
      lines.push(pText);
    }
  }

  // 앞뒤 및 연속 불필요 공백 정리 (최대 2줄 연속 빈 줄 허용)
  return lines.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

// 🎯 [V4.5.3] & [V4.7.0] 마크다운(.md) 파일 내보내기 (저장 폴더 지정 연동)
async function exportMD() {
  closeAllPanelsMobile();
  const meta = await getCurrentMemoDetails();
  const t = getTitle();
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);
  const mdContent = convertQuillToMarkdown();

  let frontmatter = `---\ntitle: "${t.replace(/"/g, '\\"')}"\nupdated: "${formatExportDate(meta.updatedAt || meta.createdAt)}"\n`;
  if (tags.length > 0) {
    frontmatter += `tags:\n${tags.map((tag) => `  - "${tag.replace(/"/g, '\\"')}"`).join('\n')}\n`;
  }
  frontmatter += `---\n\n`;

  const finalMd = frontmatter + mdContent;

  setTimeout(async () => {
    const blob = new Blob([finalMd], { type: "text/markdown;charset=utf-8" });
    await saveExportBlob(blob, `${t}.md`, "text/markdown", "마크다운 문서 (*.md)", ".md");
  }, 100);
}

// 🎯 [V3.3.3] 마크다운(.md) 텍스트를 위지윅(Quill) HTML로 변환하는 파서
function convertMarkdownToHTML(mdText) {
  if (!mdText) return "";

  // 줄바꿈 정규화
  const lines = mdText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const htmlParts = [];
  let i = 0;
  // 🎯 [V3.4.5] YAML Frontmatter (--- ... ---) 검출 및 제목 파싱
  window.__lastParsedMdTitle = null;
  if (lines.length > 0 && lines[0].trim() === "---") {
    let endFmIdx = -1;
    for (let j = 1; j < lines.length; j++) {
      if (lines[j].trim() === "---") {
        endFmIdx = j;
        break;
      }
    }
    if (endFmIdx !== -1) {
      for (let j = 1; j < endFmIdx; j++) {
        const fmMatch = lines[j].match(/^title:\s*["']?(.*?)["']?$/i);
        if (fmMatch && fmMatch[1]) {
          window.__lastParsedMdTitle = fmMatch[1].trim();
        }
      }
      i = endFmIdx + 1; // Frontmatter 블록 전체 건너뛰기
    }
  }

  // 인라인 서식 변환 헬퍼 (XSS 방어 및 마크다운 기호 -> 태그)
  function parseInline(raw) {
    let s = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 표 셀 내부 <br> 줄바꿈 태그 원복 (Quill 2의 SoftBreakBlot 클래스 부여하여 보존)
    s = s.replace(/&lt;br\s*\/?&gt;/gi, '<br class="ql-softbreak">');

    // 1. 이미지: ![alt](url)
    s = s.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1">');
    // 2. 링크: [text](url)
    s = s.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    // 3. 인라인 코드: `code`
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // 4. 굵게: **text**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // 5. 밑줄: __text__ 또는 <u>text</u> 또는 <ins>text</ins>
    s = s.replace(/__(.+?)__/g, '<u>$1</u>');
    s = s.replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/gi, '<u>$1</u>');
    s = s.replace(/&lt;ins&gt;(.*?)&lt;\/ins&gt;/gi, '<u>$1</u>');
    // 6. 취소선: ~~text~~
    s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
    // 7. 기울임꼴: *text* 또는 _text_
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/_([^_]+)_/g, '<em>$1</em>');

    // 이스케이프된 파이프 문자 원복
    s = s.replace(/\\\|/g, "|");

    return s;
  }

  // 🎯 [V3.4.4] 마크다운 줄 앞의 공백(스페이스/탭)을 분석하여 Quill 들여쓰기 레벨(1~8)로 변환
  function getLeadingIndent(str) {
    if (!str) return 0;
    const spaces = str.replace(/\t/g, "  ").length;
    return Math.min(8, Math.floor(spaces / 2));
  }

  while (i < lines.length) {
    const line = lines[i];

    // A. 코드 블록 (``` ~ ```)
    if (/^```/.test(line.trim())) {
      // 🎯 [V4.3.4] 코드 블록 언어 태그 파싱 (GFM: ```javascript, ```python 등)
      const langMatch = line.trim().match(/^```([a-zA-Z0-9_\-+]+)?/);
      let lang = (langMatch && langMatch[1]) ? langMatch[1].toLowerCase().trim() : "plain";
      if (lang === "js") lang = "javascript";
      else if (lang === "ts") lang = "typescript";
      else if (lang === "py") lang = "python";
      else if (lang === "sh" || lang === "shell" || lang === "zsh") lang = "bash";
      else if (lang === "c++") lang = "cpp";
      else if (lang === "c#") lang = "csharp";
      else if (lang === "yml") lang = "yaml";
      else if (lang === "md") lang = "markdown";
      else if (lang === "htm") lang = "html";

      const dataLangAttr = (lang && lang !== "plain") ? ` data-language="${lang}"` : "";

      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(
          lines[i]
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
        );
        i++;
      }
      i++; // 닫는 ``` 건너뜀
      // Quill의 code-block 클래스 컨테이너와 동기화
      const codeHtml = codeLines
        .map((cl) => `<div class="ql-code-block"${dataLangAttr}>${cl || "<br>"}</div>`)
        .join("");
      htmlParts.push(
        `<div class="ql-code-block-container" spellcheck="false"${dataLangAttr}>${codeHtml}</div>`
      );
      continue;
    }

    // B. 표 (Markdown Table: | col | col |)
    if (/^\|(.+)\|$/.test(line.trim())) {
      const rows = [];
      while (i < lines.length && /^\|(.+)\|$/.test(lines[i].trim())) {
        const curLine = lines[i].trim();
        // 구분선 행 (| --- | :---: | --- |) 건너뜀
        if (/^\|(\s*[-:]+[-|\s:]*)\|$/.test(curLine)) {
          i++;
          continue;
        }
        // \|를 임시 토큰으로 치환 후 split하여 열 개수 오염 방지
        const safeLine = curLine.slice(1, -1).replace(/\\\|/g, "___ZEN_PIPE___");
        const cells = safeLine
          .split("|")
          .map((c) => c.replace(/___ZEN_PIPE___/g, "\\|").trim());
        rows.push(cells);
        i++;
      }

      if (rows.length > 0) {
        let tableHtml = "<table><tbody>";
        rows.forEach((r, rIdx) => {
          // 🎯 Quill 2.0 엔진은 <th>를 미인식하여 파괴하며, 고유한 data-row 속성이 없으면 모든 행을 1개 행으로 병합합니다.
          const rowId = `row-${Math.random().toString(36).slice(2, 8)}`;
          tableHtml += "<tr>";
          r.forEach((cell) => {
            const cellContent = parseInline(cell) || "<br>";
            tableHtml += `<td data-row="${rowId}">${cellContent}</td>`;
          });
          tableHtml += "</tr>";
        });
        tableHtml += "</tbody></table>";
        htmlParts.push(tableHtml);
      }
      continue;
    }

    // C. 제목 (# H1 ~ ###### H6) - 🎯 [V4.3.6] H1-H6 완전 지원
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      htmlParts.push(`<h${level}>${parseInline(headerMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // D. 인용구 (> text) - 🎯 [V4.2.0] 인용구 내부 글머리 기호, 번호, 체크리스트 지원 & [V4.3.6] + 지원
    if (/^>\s?(.*)$/.test(line)) {
      while (i < lines.length && /^>\s?(.*)$/.test(lines[i])) {
        const qm = lines[i].match(/^>\s?(.*)$/);
        const innerLine = qm[1] || "";
        const checkMatch = innerLine.match(/^\s*(?:(\*|-|\+)\s+)?\[([ xX])\]\s*(.*)$/);
        const orderedMatch = innerLine.match(/^\s*(\d+)\.\s+(.*)$/);
        const bulletMatch = innerLine.match(/^\s*(\*|-|\+)\s+(.*)$/);

        if (checkMatch) {
          const isChecked = checkMatch[2].toLowerCase() === "x";
          htmlParts.push(`<li data-list="${isChecked ? "checked" : "unchecked"}" class="ql-quote-item">${parseInline(checkMatch[3]) || "<br>"}</li>`);
        } else if (orderedMatch) {
          htmlParts.push(`<li data-list="ordered" class="ql-quote-item">${parseInline(orderedMatch[2]) || "<br>"}</li>`);
        } else if (bulletMatch) {
          htmlParts.push(`<li data-list="bullet" class="ql-quote-item">${parseInline(bulletMatch[2]) || "<br>"}</li>`);
        } else {
          htmlParts.push(`<blockquote>${parseInline(innerLine) || "<br>"}</blockquote>`);
        }
        i++;
      }
      continue;
    }

    // E. 체크리스트 (- [ ], - [x], * [ ], + [ ], [ ] 등) - 🎯 [V3.4.4] 들여쓰기 & [V4.3.3] 강화 & [V4.3.6] + 지원
    if (/^\s*(?:(\*|-|\+)\s+)?\[([ xX])\]\s*(.*)$/.test(line)) {
      while (i < lines.length && /^\s*(?:(\*|-|\+)\s+)?\[([ xX])\]\s*(.*)$/.test(lines[i])) {
        const cm = lines[i].match(/^(\s*)(?:(\*|-|\+)\s+)?\[([ xX])\]\s*(.*)$/);
        const indentLvl = getLeadingIndent(cm[1]);
        const isChecked = cm[3].toLowerCase() === "x";
        const text = parseInline(cm[4]);
        const indentClass = indentLvl > 0 ? ` class="ql-indent-${indentLvl}"` : "";
        htmlParts.push(
          `<li data-list="${isChecked ? "checked" : "unchecked"}"${indentClass}>${text || "<br>"}</li>`
        );
        i++;
      }
      continue;
    }

    // F. 번호 매기기 목록 (1. text) - 🎯 [V3.4.4] 들여쓰기 지원
    if (/^\s*\d+\.\s+(.*)$/.test(line)) {
      while (i < lines.length && /^\s*\d+\.\s+(.*)$/.test(lines[i])) {
        const om = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
        const indentLvl = getLeadingIndent(om[1]);
        const text = parseInline(om[2]);
        const indentClass = indentLvl > 0 ? ` class="ql-indent-${indentLvl}"` : "";
        htmlParts.push(`<li data-list="ordered"${indentClass}>${text || "<br>"}</li>`);
        i++;
      }
      continue;
    }

    // G. 글머리 기호 목록 (* text, - text, + text) - 🎯 [V3.4.4] 들여쓰기 지원 & [V4.3.6] + 지원
    if (/^\s*(\*|-|\+)\s+(.*)$/.test(line) && !/^\s*(\*|-|\+)\s+\[([ xX])\]/.test(line)) {
      while (
        i < lines.length &&
        /^\s*(\*|-|\+)\s+(.*)$/.test(lines[i]) &&
        !/^\s*(\*|-|\+)\s+\[([ xX])\]/.test(lines[i])
      ) {
        const bm = lines[i].match(/^(\s*)(\*|-|\+)\s+(.*)$/);
        const indentLvl = getLeadingIndent(bm[1]);
        const text = parseInline(bm[3]);
        const indentClass = indentLvl > 0 ? ` class="ql-indent-${indentLvl}"` : "";
        htmlParts.push(`<li data-list="bullet"${indentClass}>${text || "<br>"}</li>`);
        i++;
      }
      continue;
    }

    // H. 가로 구분선 (--- 또는 *** 또는 ___) - 🎯 [V4.3.6] ___ 지원
    if (/^(\-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      htmlParts.push("<hr>");
      i++;
      continue;
    }

    // I. 빈 줄
    if (line.trim() === "") {
      i++;
      continue;
    }

    // J. 일반 문단 (p)
    htmlParts.push(`<p>${parseInline(line)}</p>`);
    i++;
  }

  return htmlParts.join("");
}

// 🎯 [V4.5.3] 인쇄하기 (내부 폴더 제거 + 단정한 Zen 헤더 + 불필요 푸터 비표시)
async function handlePrint() {
  closeAllPanelsMobile();
  try {
    const meta = await getCurrentMemoDetails();
    const plainText = quill.getText();
    const tags = extractHashTags(plainText);
    const tagStr = tags.length > 0 ? tags.map((t) => '#' + escapeHtml(t)).join(' ') : '';
    const updatedAtStr = formatExportDate(meta.updatedAt || meta.createdAt);

    const metaElem = document.getElementById("print-meta-sub");
    if (metaElem) {
      metaElem.innerHTML = `<span>${tagStr}</span><span>${updatedAtStr}</span>`;
    }
    const footerElem = document.getElementById("print-doc-footer");
    if (footerElem) {
      footerElem.textContent = "";
    }
  } catch (err) {
    console.error("인쇄 메타 준비 오류:", err);
  }

  setTimeout(() => {
    window.print();
  }, 300);
}

function backupAllData() {
  closeAllPanelsMobile();
  setTimeout(() => {
    db
      .transaction(["memos"], "readonly")
      .objectStore("memos")
      .getAll().onsuccess = (e) => {
        const activeMemos = e.target.result.filter((m) => !m.isDeleted);
        saveAs(
          new Blob([JSON.stringify({ type: "ZenBackup", timestamp: Date.now(), data: activeMemos })], {
            type: "application/json",
          }),
          `MY_Notes_Backup_${Date.now()}.json`,
        );
        showToast("전체 백업 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
      };
  }, 300);
}

// ============================================================================
// 🎯 [V4.5.6] 모든 데이터 초기화 (보안 폴더 내용 정밀 검사 & Zen 경고 모달 연동)
// ============================================================================
async function getSecurityFolderContentStats() {
  if (!db || !globalSecurityFolderId) return { noteCount: 0, folderCount: 0, totalCount: 0 };
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(["memos"], "readonly");
      const store = tx.objectStore("memos");
      store.getAll().onsuccess = (e) => {
        const allData = e.target.result || [];
        const fMap = new Map();
        allData.forEach((item) => {
          if (item.type === "folder" && !item.isPermanentlyDeleted && !item.isTrash) {
            fMap.set(item.id, item);
          }
        });

        const isUnderSec = (pId) => {
          let curr = pId;
          while (curr) {
            if (curr === globalSecurityFolderId) return true;
            const p = fMap.get(curr);
            if (!p) break;
            curr = p.parentId;
          }
          return false;
        };

        let noteCount = 0;
        let folderCount = 0;

        allData.forEach((item) => {
          if (item.isPermanentlyDeleted || item.isTrash) return;
          if (item.id === globalSecurityFolderId) return; // 보안 폴더 자체는 제외
          if (item.parentId === globalSecurityFolderId || isUnderSec(item.parentId)) {
            if (item.type === "folder") folderCount++;
            else noteCount++;
          }
        });

        resolve({ noteCount, folderCount, totalCount: noteCount + folderCount });
      };
      store.getAll().onerror = () => resolve({ noteCount: 0, folderCount: 0, totalCount: 0 });
    } catch (err) {
      resolve({ noteCount: 0, folderCount: 0, totalCount: 0 });
    }
  });
}

function closeResetConfirmModal() {
  const modal = document.getElementById("reset-confirm-modal");
  if (modal) modal.style.display = "none";
}

// 🎯 [V4.5.6] 초기화 클릭 시 실행 (보안 폴더 검사 후 전용 모달 호출)
async function resetAllData() {
  closeAllPanelsMobile();

  const secStats = await getSecurityFolderContentStats();
  const modal = document.getElementById("reset-confirm-modal");
  if (!modal) {
    // 모달 DOM 누락 시 방어적 폴백
    if (secStats.totalCount > 0) {
      if (!confirm(`⚠️ [보안 폴더 경고]\n\n보안 폴더에 ${secStats.noteCount}개의 보안 노트가 보관되어 있습니다.\n초기화 시 보안 자료도 모두 영구 삭제됩니다.\n계속하시겠습니까?`)) return;
    }
    proceedResetAllData();
    return;
  }

  const secBox = document.getElementById("reset-security-warning-box");
  const secCountDesc = document.getElementById("reset-security-count-desc");
  const cloudDesc = document.getElementById("reset-cloud-desc");
  const isDriveConnected = typeof window.isZenOnline === "function" && window.isZenOnline();

  // 1. 보안 폴더 내부 자료 존재 시 강조 경고 표시
  if (secStats.totalCount > 0) {
    if (secBox) secBox.style.display = "block";
    if (secCountDesc) {
      secCountDesc.innerHTML = `현재 암호화된 <strong>보안 노트 ${secStats.noteCount}개</strong>${secStats.folderCount > 0 ? `, <strong>보안 폴더 ${secStats.folderCount}개</strong>` : ""}가 보관되어 있습니다.`;
    }
  } else {
    if (secBox) secBox.style.display = "none";
  }

  // 2. 클라우드 연동 상태에 따른 안내
  if (cloudDesc) {
    if (isDriveConnected) {
      cloudDesc.innerHTML = `☁️ <strong>클라우드 연동 상태</strong>: 로컬 데이터뿐만 아니라 클라우드(Firebase)에 동기화된 모든 백업 자료도 함께 영구 삭제됩니다.`;
    } else {
      cloudDesc.innerHTML = `ℹ️ <strong>로컬 전용 초기화</strong>: 현재 기기의 데이터만 초기화됩니다. (나중에 동일 계정으로 클라우드 로그인 시 백업 자료가 다시 동기화될 수 있습니다.)`;
    }
  }

  modal.style.display = "flex";
}

// 🎯 [V4.5.6] 모달에서 '모두 영구 삭제' 클릭 시 실제 초기화 수행
async function proceedResetAllData() {
  closeResetConfirmModal();

  // 1. 진행 중인 자동 저장 및 동기화 타이머 차단
  if (typeof backgroundSyncTimer !== "undefined" && backgroundSyncTimer) {
    clearTimeout(backgroundSyncTimer);
    backgroundSyncTimer = null;
  }
  if (typeof saveTimer !== "undefined" && saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (typeof isSaving !== "undefined") isSaving = false;

  showToast("데이터를 초기화하는 중입니다. 잠시만 기다려주세요...");

  const isDriveConnected = typeof window.isZenOnline === "function" && window.isZenOnline();

  // 2. 🔥 [V4.3.0] Firestore 클라우드 데이터 영구 삭제 (연결된 경우)
  if (isDriveConnected && typeof deleteAllCloudData === "function") {
    try {
      await deleteAllCloudData();
    } catch (cloudErr) {
      console.error("클라우드 데이터 삭제 중 에러 발생:", cloudErr);
    }
  }
  // 동기화 커서 초기화
  if (typeof clearFirestoreSyncCursors === "function") clearFirestoreSyncCursors();

  // 3. IndexedDB 데이터 완전 삭제
  try {
    if (db) {
      const tx = db.transaction(["memos"], "readwrite");
      tx.objectStore("memos").clear();
      await new Promise((res) => {
        tx.oncomplete = res;
        tx.onerror = res;
      });
      db.close();
    }
  } catch (dbErr) {
    console.warn("IndexedDB 스토어 비우기 오류:", dbErr);
  }

  try {
    await new Promise((resolve) => {
      const delReq = indexedDB.deleteDatabase("ZenMemoDB_Ultimate");
      delReq.onsuccess = () => resolve();
      delReq.onerror = () => resolve();
      delReq.onblocked = () => setTimeout(resolve, 500);
    });
  } catch (e) {
    console.warn("deleteDatabase 오류:", e);
  }

  // 4. 보안 키 메모리 파기 및 localStorage 청소
  if (typeof currentSecKey !== "undefined") currentSecKey = null;
  if (typeof isSecurityUnlocked !== "undefined") isSecurityUnlocked = false;

  localStorage.removeItem("zen_last_opened");
  localStorage.removeItem("zen_last_sync_time");
  localStorage.removeItem("zen_sec_hash");
  localStorage.removeItem("zen_recent_notes");

  // 5. 에디터 비우기 및 새로고침
  if (typeof quill !== "undefined" && quill) quill.setText("");
  const titleInput = document.getElementById("memo-title-input");
  if (titleInput) titleInput.value = "";

  showToast("모든 데이터가 성공적으로 초기화되었습니다.\n앱을 새로고침합니다.");
  setTimeout(() => {
    location.reload();
  }, 1200);
}

// 🎯 ESC 키로 초기화 경고 모달 닫기
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const rModal = document.getElementById("reset-confirm-modal");
    if (rModal && rModal.style.display === "flex") {
      closeResetConfirmModal();
    }
  }
});

// 🎯 [V3.3.2] PDF 페이지 범위 선택 커스텀 모달 프로미스 리졸버
// 🎯 [V4.5.0] Zen PDF 썸네일 그리드 선택 모달 (눈으로 직접 보며 선택하는 인터페이스)
function showPdfPageRangeModal(pdf, totalPages, baseTitle) {
  return new Promise((resolve) => {
    const modal = document.getElementById("pdf-import-modal");
    const titleText = document.getElementById("pdf-modal-title-text");
    const gridContainer = document.getElementById("pdf-thumb-grid");
    const selectAllCheck = document.getElementById("pdf-select-all-check");
    const countBadge = document.getElementById("pdf-selected-count-badge");
    const rangeInput = document.getElementById("pdf-page-range-input");
    const rangeApplyBtn = document.getElementById("pdf-range-apply-btn");
    const confirmBtn = document.getElementById("pdf-modal-confirm-btn");
    const confirmLabel = document.getElementById("pdf-confirm-btn-label");
    const cancelBtn = document.getElementById("pdf-modal-cancel-btn");
    const closeIcon = document.getElementById("pdf-modal-close-icon");

    if (!modal) {
      const res = prompt(`총 ${totalPages}페이지 중 불러올 페이지를 입력하세요 (예: 1, 3-5):`, `1-${Math.min(totalPages, 30)}`);
      resolve(res ? { action: "pages", pages: [1] } : { action: "cancel" });
      return;
    }

    if (titleText) {
      titleText.textContent = `PDF 페이지 선택 (${baseTitle}.pdf - 총 ${totalPages}장)`;
    }

    // 🎯 [V4.5.1] 기본 상태는 아무것도 선택되지 않은 빈 상태로 시작!
    const selectedPages = new Set();

    let isClosed = false;

    // 모달 표시
    modal.style.display = "flex";
    if (window.innerWidth <= 768) {
      history.pushState({ modal: "pdf-import" }, "");
    }

    // 범위 파서 헬퍼: "1, 3-5, 8" -> [1, 3, 4, 5, 8]
    function parseRangeString(str) {
      const pages = new Set();
      const parts = str.split(/[,\s]+/);
      parts.forEach((part) => {
        part = part.trim();
        if (!part) return;
        const match = part.match(/^(\d+)[~\-](\d+)$/);
        if (match) {
          const s = parseInt(match[1], 10);
          const e = parseInt(match[2], 10);
          if (!isNaN(s) && !isNaN(e)) {
            const start = Math.max(1, Math.min(s, e));
            const end = Math.min(totalPages, Math.max(s, e));
            for (let p = start; p <= end; p++) pages.add(p);
          }
        } else {
          const num = parseInt(part, 10);
          if (!isNaN(num) && num >= 1 && num <= totalPages) {
            pages.add(num);
          }
        }
      });
      return pages;
    }

    // UI 동기화 함수
    function updateUI() {
      if (countBadge) {
        countBadge.textContent = `(${selectedPages.size} / ${totalPages}장 선택됨)`;
      }
      if (selectAllCheck) {
        selectAllCheck.checked = selectedPages.size === totalPages;
        selectAllCheck.indeterminate = selectedPages.size > 0 && selectedPages.size < totalPages;
      }
      if (confirmLabel) {
        confirmLabel.textContent = "페이지 불러오기";
      }
      if (confirmBtn) {
        confirmBtn.style.opacity = selectedPages.size === 0 ? "0.5" : "1";
        confirmBtn.style.pointerEvents = selectedPages.size === 0 ? "none" : "auto";
      }

      // 카드 하이라이트 동기화
      if (gridContainer) {
        const cards = gridContainer.querySelectorAll(".pdf-thumb-card");
        cards.forEach((card) => {
          const pageNum = parseInt(card.getAttribute("data-page"), 10);
          const isSelected = selectedPages.has(pageNum);
          card.classList.toggle("is-selected", isSelected);
          const chk = card.querySelector(".pdf-thumb-check");
          if (chk) chk.checked = isSelected;
        });
      }
    }

    // 썸네일 그리드 스켈레톤 카드 생성 및 비동기 렌더링
    if (gridContainer) {
      gridContainer.innerHTML = "";
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const card = document.createElement("div");
        card.className = `pdf-thumb-card ${selectedPages.has(pageNum) ? "is-selected" : ""}`;
        card.setAttribute("data-page", pageNum);

        card.innerHTML = `
          <div class="pdf-thumb-header">
            <input type="checkbox" class="pdf-thumb-check" ${selectedPages.has(pageNum) ? "checked" : ""}>
            <span class="pdf-thumb-badge">#${pageNum}</span>
          </div>
          <div class="pdf-thumb-canvas-wrap" id="pdf-thumb-wrap-${pageNum}">
            <div class="pdf-thumb-loading"><i class="fa-solid fa-spinner fa-spin"></i> 로딩...</div>
          </div>
        `;

        // 카드 및 체크박스 클릭 핸들러
        card.onclick = (e) => {
          if (e.target.tagName && e.target.tagName.toLowerCase() === "input") {
            if (e.target.checked) selectedPages.add(pageNum);
            else selectedPages.delete(pageNum);
          } else {
            if (selectedPages.has(pageNum)) selectedPages.delete(pageNum);
            else selectedPages.add(pageNum);
          }
          updateUI();
        };

        gridContainer.appendChild(card);
      }

      // 비동기 순차 썸네일 렌더링 (저해상도 scale로 매우 가볍게)
      (async function renderAllThumbs() {
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          if (isClosed) break;
          const wrap = document.getElementById(`pdf-thumb-wrap-${pageNum}`);
          if (!wrap) continue;

          try {
            const page = await pdf.getPage(pageNum);
            if (isClosed) break;

            const viewport = page.getViewport({ scale: 0.22 });
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport }).promise;
            if (isClosed) break;

            wrap.innerHTML = "";
            wrap.appendChild(canvas);
          } catch (err) {
            console.warn(`PDF 썸네일 ${pageNum} 렌더 실패:`, err);
            if (wrap) wrap.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">미리보기 불가</span>`;
          }
        }
      })();
    }

    updateUI();

    // 전체 선택 이벤트
    if (selectAllCheck) {
      selectAllCheck.onchange = () => {
        if (selectAllCheck.checked) {
          for (let i = 1; i <= totalPages; i++) selectedPages.add(i);
        } else {
          selectedPages.clear();
        }
        updateUI();
      };
    }

    // 범위 지정 적용 버튼 이벤트
    function applyRangeInput() {
      if (!rangeInput || !rangeInput.value.trim()) return;
      const parsed = parseRangeString(rangeInput.value.trim());
      if (parsed.size > 0) {
        selectedPages.clear();
        parsed.forEach((p) => selectedPages.add(p));
        updateUI();
      } else {
        showToast("유효한 페이지 번호를 입력하세요 (예: 1, 3-5)");
      }
    }

    if (rangeApplyBtn) rangeApplyBtn.onclick = applyRangeInput;
    if (rangeInput) {
      rangeInput.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyRangeInput();
        }
      };
    }

    function cleanup() {
      isClosed = true;
      modal.style.display = "none";
      if (confirmBtn) confirmBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (closeIcon) closeIcon.onclick = null;
      if (selectAllCheck) selectAllCheck.onchange = null;
      if (rangeApplyBtn) rangeApplyBtn.onclick = null;
      modal.onclick = null;
      if (window.innerWidth <= 768 && window.history.state && window.history.state.modal === "pdf-import") {
        if (typeof programmaticBackCount !== 'undefined') programmaticBackCount++;
        history.back();
      }
    }

    function doConfirm() {
      if (selectedPages.size === 0) {
        showToast("최소 1개 이상의 페이지를 선택해 주세요.");
        return;
      }
      const pageList = Array.from(selectedPages).sort((a, b) => a - b);
      cleanup();
      resolve({ action: "pages", pages: pageList });
    }

    function doCancel() {
      cleanup();
      resolve({ action: "cancel" });
    }

    if (confirmBtn) confirmBtn.onclick = doConfirm;
    if (cancelBtn) cancelBtn.onclick = doCancel;
    if (closeIcon) closeIcon.onclick = doCancel;

    modal.onclick = (e) => {
      if (e.target === modal) doCancel();
    };
  });
}

// 🎯 [V3.4.4] PDF 단일 페이지 Canvas 렌더링 헬퍼 (초고화질 Scale 최적화, JPEG 92%)
async function renderPdfPageToBase64(pdf, pageNum) {
  try {
    const page = await pdf.getPage(pageNum);
    const scale = window.innerWidth <= 768 ? 1.6 : 2.0;
    const viewport = page.getViewport({ scale: scale });
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = { canvasContext: ctx, viewport: viewport };
    await page.render(renderContext).promise;

    const base64Img = canvas.toDataURL("image/jpeg", 0.92);
    canvas.width = 0;
    canvas.height = 0;
    return base64Img;
  } catch (err) {
    console.error(`PDF ${pageNum}페이지 렌더링 실패:`, err);
    throw err;
  }
}

// 🎯 [V3.3.2] 새 노트를 IndexedDB에 직접 고속 저장하는 헬퍼
function saveNewMemoDirect(title, htmlContent, plainTextContent = "", updatedAt = Date.now()) {
  return new Promise((resolve, reject) => {
    const parentId =
      typeof targetNewMemoFolderId !== "undefined" && targetNewMemoFolderId !== null
        ? targetNewMemoFolderId
        : (typeof globalDesktopFolderId !== "undefined" ? globalDesktopFolderId : null);

    const memoData = {
      title: title || "제목 없는 노트",
      content: htmlContent,
      plainText: plainTextContent,
      updatedAt: updatedAt,
      isDeleted: false,
      type: "file",
      syncId: typeof generateSyncId === "function" ? generateSyncId() : Date.now().toString(36),
      parentId: parentId,
    };

    const tx = db.transaction(["memos"], "readwrite");
    const store = tx.objectStore("memos");
    let newId = null;
    const req = store.add(memoData);
    req.onsuccess = (e) => {
      newId = e.target.result;
    };
    tx.oncomplete = () => {
      resolve(newId);
    };
    tx.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

// 🎯 [V4.1.6] 백업 JSON 데이터 및 파일 정보로부터 백업 일시(YYYY-MM-DD HH:mm)를 추출합니다.
function extractBackupDate(parsed, file) {
  let timestamp = null;

  // 1. JSON 내부에 기록된 타임스탬프
  if (parsed && parsed.timestamp) {
    timestamp = parsed.timestamp;
  } else if (parsed && parsed.date) {
    timestamp = new Date(parsed.date).getTime();
  }

  // 2. 파일명에서 타임스탬프 추출 (예: MY_Notes_Backup_1720000000000.json 또는 Zen_Backup_...)
  if (!timestamp && file && file.name) {
    const match = file.name.match(/(?:Zen|MY_Notes)_Backup_(\d{10,13})/i);
    if (match) {
      let num = parseInt(match[1], 10);
      if (match[1].length === 10) num *= 1000;
      timestamp = num;
    }
  }

  // 3. 백업 데이터 내부 메모들의 가장 최신 updatedAt 확인
  if (!timestamp && parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
    const maxUpdated = Math.max(...parsed.data.map((m) => m.updatedAt || 0));
    if (maxUpdated > 0) {
      timestamp = maxUpdated;
    }
  }

  // 4. file.lastModified 활용
  if (!timestamp && file && file.lastModified) {
    timestamp = file.lastModified;
  }

  // 날짜 포맷 변환 (YYYY-MM-DD HH:mm)
  if (timestamp) {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, "0");
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const min = pad(d.getMinutes());
      return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    }
  }

  return "알 수 없는 날짜";
}

// 🎯 [V4.1.6] ZenBackup 전체 데이터를 IndexedDB에 복원하는 공용 엔진
function restoreZenBackupData(parsed, onCompleteCallback) {
  const tx = db.transaction(["memos"], "readwrite");
  const store = tx.objectStore("memos");
  let restoredCount = 0;
  let skippedCount = 0;

  store.getAll().onsuccess = (event) => {
    const currentMemos = event.target.result;
    const existingMap = new Map();
    currentMemos.forEach((m) => {
      if (m.syncId) existingMap.set(m.syncId, m);
    });

    parsed.data.forEach((m) => {
      if (m.syncId && existingMap.has(m.syncId)) {
        const localMemo = existingMap.get(m.syncId);
        if (localMemo.isDeleted) {
          localMemo.isDeleted = false;
          delete localMemo.deletedAt;
          localMemo.updatedAt = Date.now();
          store.put(localMemo);
          restoredCount++;
        } else {
          skippedCount++;
        }
        return;
      }
      const isDuplicateContent = currentMemos.some(
        (existing) => existing.title === m.title && existing.content === m.content
      );
      if (isDuplicateContent) {
        skippedCount++;
        return;
      }
      delete m.id;
      if (!m.syncId) m.syncId = generateSyncId();
      store.add(m);
      restoredCount++;
    });
  };

  tx.oncomplete = () => {
    healDatabase(() => {
      loadMemoList();
      alert(`복원이 완료되었습니다.\n(복원노트: ${restoredCount}개 / 중복제외: ${skippedCount}개)`);
      if (typeof triggerBackgroundSync === "function") triggerBackgroundSync();
      if (typeof onCompleteCallback === "function") onCompleteCallback();
    });
  };
}

// 🎯 [올인원 불러오기 엔진] 파일 하나로 모든 형식을 판단하여 처리합니다.
function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const fileName = file.name;
  const fileExt = fileName.split(".").pop().toLowerCase();
  const isImage = file.type.startsWith("image/");
  const isPdf = fileExt === "pdf";

  // --- [Case 1] 이미지 파일일 때: 현재 편집 중인 노트 본문에 바로 삽입 ---
  if (isImage) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const range = quill.getSelection(true);
      quill.insertEmbed(
        range.index,
        "image",
        ev.target.result,
        Quill.sources.USER,
      );
      quill.insertText(range.index + 1, "\n", Quill.sources.USER);
      quill.setSelection(range.index + 2, Quill.sources.SILENT);
      triggerAutoSave();
      showToast("이미지를 노트에 삽입했습니다.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    return;
  }

  // 🎯 --- [Case 2] PDF 파일 처리 엔진 (스냅샷 추출 및 최적화, 범위 분할/전체 분할 지원) ---
  if (isPdf) {
    showToast("PDF 문서를 분석하고 있습니다...");

    const reader = new FileReader();
    reader.onload = async function () {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          new URL("./lib/pdfjs/", location.href).href + "pdf.worker.min.mjs";
        const typedarray = new Uint8Array(this.result);
        const loadingTask = pdfjsLib.getDocument({
          data: typedarray,
          cMapUrl: new URL("./lib/pdfjs/", location.href).href + "cmaps/",
          cMapPacked: true,
          standardFontDataUrl: new URL("./lib/pdfjs/", location.href).href + "standard_fonts/"
        });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        const baseTitle = file.name.replace(/\.[^/.]+$/, "");

        // 🎯 [V4.4.7] 단 1페이지인 경우: 불필요한 질문 없이 즉시 변환
        if (totalPages === 1) {
          createNewMemo();
          isLoading = false;

          const titleInput = document.getElementById("memo-title-input");
          if (titleInput) titleInput.value = baseTitle;

          const base64Img = await renderPdfPageToBase64(pdf, 1);
          const insertIdx = Math.max(0, quill.getLength() - 1);
          quill.insertEmbed(insertIdx, "image", base64Img, Quill.sources.USER);
          quill.insertText(insertIdx + 1, "\n", Quill.sources.USER); // 🎯 [V4.4.7] MD 표준 단일 개행

          await executeSave();
          showToast(`✅ PDF 변환 및 저장이 완료되었습니다! (1장)`);
          return;
        }

        // 🎯 [V4.4.7] 2페이지 이상인 모든 PDF: 원하는 페이지만 골라 담을 수 있도록 페이지 선택 모달 표출
        const modalRes = await showPdfPageRangeModal(pdf, totalPages, baseTitle);

        if (modalRes.action === "cancel" || !modalRes.pages || modalRes.pages.length === 0) {
          showToast("PDF 불러오기가 취소되었습니다.");
          return;
        }

        const selectedPages = modalRes.pages;
        const countToLoad = selectedPages.length;

        // 🎯 [Case A] 30페이지 이하인 경우: 단일 새 노트에 깔끔하게 저장
        if (countToLoad <= 30) {
          createNewMemo();
          isLoading = false;

          const titleInput = document.getElementById("memo-title-input");
          if (titleInput) {
            titleInput.value =
              countToLoad === 1
                ? `${baseTitle} (p.${selectedPages[0]})`
                : `${baseTitle} (${countToLoad}장)`;
          }

          quill.focus();

          for (let idx = 0; idx < countToLoad; idx++) {
            const pageNum = selectedPages[idx];
            showToast(`PDF 변환 중... (${idx + 1} / ${countToLoad}장, p.${pageNum})`);

            const base64Img = await renderPdfPageToBase64(pdf, pageNum);
            const insertIdx = Math.max(0, quill.getLength() - 1);
            quill.insertEmbed(insertIdx, "image", base64Img, Quill.sources.USER);
            quill.insertText(insertIdx + 1, "\n", Quill.sources.USER); // 🎯 [V4.5.0] MD 표준 단일 개행
          }
          await executeSave();
          showToast(countToLoad === 1 ? `✅ 1개 페이지를 노트에 추가했습니다!` : `✅ 선택한 ${countToLoad}개 페이지를 노트에 추가했습니다!`);
          return;
        }

        // 🎯 [Case B, V4.5.3] 30페이지 초과(또는 전체) 선택 시: 30페이지씩 자동 분할 저장 후 토스트 안내 (saveNewMemoDirect & loadMemo 정상 호출로 교정)
        const chunkCount = Math.ceil(countToLoad / 30);
        showToast(`30페이지씩 분할하여 ${chunkCount}개의 노트로 저장하고 있습니다...`);

        const createdMemoIds = [];
        const now = Date.now();

        for (let c = 1; c <= chunkCount; c++) {
          const startIdx = (c - 1) * 30;
          const endIdx = Math.min(c * 30, countToLoad);
          const chunkPages = selectedPages.slice(startIdx, endIdx);
          const chunkTitle = `${baseTitle} (${c}/${chunkCount})`;

          let htmlContent = "";
          for (let i = 0; i < chunkPages.length; i++) {
            const pageNum = chunkPages[i];
            const currentTotalIdx = startIdx + i + 1;
            showToast(`PDF 변환 중... [노트 ${c}/${chunkCount}] (${currentTotalIdx}/${countToLoad}장, p.${pageNum})`);

            const base64Img = await renderPdfPageToBase64(pdf, pageNum);
            htmlContent += `<p><img src="${base64Img}"></p>`;
          }

          const newId = await saveNewMemoDirect(chunkTitle, htmlContent, "", now + c * 10);
          if (newId) createdMemoIds.push(newId);
        }

        loadMemoList(true);
        updateUnsyncedCount();
        if (createdMemoIds.length > 0 && typeof loadMemo === "function") {
          loadMemo(createdMemoIds[0]);
        }
        showToast(`✅ 30페이지씩 분할하여 ${chunkCount}개의 노트로 저장했습니다.`);
      } catch (err) {
        console.error("PDF 파싱 에러:", err);
        alert(`PDF 변환 중 오류가 발생했습니다.\n(${err.message || err})`);
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
    return;
  }

  // --- [Case 3] 텍스트 기반 파일들 (JSON, TXT, HTML, MD) ---
  const reader = new FileReader();
  reader.onload = (ev) => {
    const fileContent = ev.target.result;

    // 📌 A. JSON 전체 백업 및 단일 노트 불러오기
    if (fileExt === "json") {
      try {
        const parsed = JSON.parse(fileContent);
        if (parsed.type === "ZenBackup") {
          const backupDateStr = extractBackupDate(parsed, file);
          const isConfirmed = confirm(`${backupDateStr}에 백업한 파일을 복원하시겠습니까?`);
          if (!isConfirmed) {
            showToast("백업 복원이 취소되었습니다.");
            e.target.value = "";
            return;
          }
          restoreZenBackupData(parsed, () => {
            e.target.value = "";
          });
          return;
        } else if (parsed.type === "ZenMemo") {
          createNewMemo();
          isLoading = false;
          document.getElementById("memo-title-input").value = parsed.title || fileName.replace(/\.[^/.]+$/, "");
          quill.root.innerHTML = parsed.content || "";
          executeSave();
        } else {
          alert("지원하지 않는 JSON 형식입니다.");
        }
      } catch (err) {
        alert("파일 읽기 오류가 발생했습니다.");
      }
    }
    // 📌 B. HTML 파일: 디자인 파괴 방어막(DOMParser)을 거쳐 본문만 쏙 빼내기
    else if (fileExt === "html") {
      createNewMemo();
      isLoading = false;
      document.getElementById("memo-title-input").value = fileName.replace(".html", "");

      const parser = new DOMParser();
      const doc = parser.parseFromString(fileContent, "text/html");
      const contentDiv = doc.getElementById("zen-editor-content");

      if (contentDiv) {
        quill.root.innerHTML = contentDiv.innerHTML;
      } else {
        const bodyContent = doc.body.innerHTML;
        quill.root.innerHTML = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
      }
      executeSave();
      showToast("HTML 파일을 새 노트로 불러왔습니다.");
    }
    // 🎯 📌 C. 마크다운(MD) 파일: 위지윅 HTML로 완벽 파싱하여 서식/표 복원
    else if (fileExt === "md") {
      createNewMemo();
      isLoading = false;
      const parsedHtml = convertMarkdownToHTML(fileContent);
      document.getElementById("memo-title-input").value =
        window.__lastParsedMdTitle || fileName.replace(/\.md$/i, "");
      quill.root.innerHTML = parsedHtml;
      executeSave();
      showToast("마크다운(MD) 문서를 불러왔습니다.");
    }
    // 🎯 📌 D. 일반 텍스트(TXT) 파일
    else if (fileExt === "txt") {
      createNewMemo();
      isLoading = false;
      let txtBody = fileContent.replace(/^\uFEFF/, ""); // BOM 제거
      const zenHeaderMatch = txtBody.match(/^([^\r\n]+)\r?\n\d{4}\.\d{2}\.\d{2}\.\([일월화수목금토]\)\s+\d{2}:\d{2}[^\r\n]*\r?\n─{20,}\r?\n\r?\n?/);
      const legacyHeaderMatch = txtBody.match(/^={20,}\r?\n\[제목\]\s*(.+?)\r?\n[\s\S]*?={20,}\r?\n\r?\n?/);
      if (zenHeaderMatch) {
        document.getElementById("memo-title-input").value = zenHeaderMatch[1].trim();
        txtBody = txtBody.substring(zenHeaderMatch[0].length);
      } else if (legacyHeaderMatch) {
        document.getElementById("memo-title-input").value = legacyHeaderMatch[1].trim();
        txtBody = txtBody.substring(legacyHeaderMatch[0].length);
      } else {
        document.getElementById("memo-title-input").value = fileName.replace(/\.txt$/i, "");
      }
      quill.setText(txtBody);
      executeSave();
      showToast("TXT 문서를 불러왔습니다.");
    }

    e.target.value = ""; // 다음 파일 선택을 위해 초기화
  };

  // 텍스트 기반 파일 읽기 실행 명령 (배열 includes 방식으로 깔끔하게 정리)
  if (["json", "txt", "html", "md"].includes(fileExt)) {
    reader.readAsText(file);
  } else if (!isImage && !isPdf) {
    alert("지원하지 않는 파일 형식입니다.");
    e.target.value = "";
  }
}

// ============================================================================
// 🎯 [V4.1.5] 데스크톱 전역 파일 드래그 앤 드롭 엔진 (Global Drag & Drop Engine)
// 윈도우 탐색기/바탕화면에서 파일을 앱 어디든 드롭 시 새 노트로 일괄 자동 생성
// ============================================================================

/**
 * 드롭된 파일이 MY Notes에서 지원하는 형식인지 판별합니다.
 */
function isImportableFile(file) {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  const ext = (file.name || "").split(".").pop().toLowerCase();
  return ["html", "htm", "txt", "md", "markdown", "pdf", "json", "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
}

/**
 * 단일 파일 내용을 파싱하여 새 노트 데이터 { title, html, plainText, isPdf, file } 객체를 반환합니다.
 */
async function parseImportableFile(file) {
  const fileName = file.name || "제목 없는 파일";
  const ext = fileName.split(".").pop().toLowerCase();
  const isImage = (file.type && file.type.startsWith("image/")) || ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);

  // 1. PDF 파일
  if (ext === "pdf") {
    return { isPdf: true, file: file, title: fileName.replace(/\.pdf$/i, "") };
  }

  // 2. 이미지 파일
  if (isImage) {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const title = fileName.replace(/\.[^/.]+$/, "");
    const html = `<p><img src="${base64Data}"></p><p><br></p>`;
    return { title, html, plainText: "" };
  }

  // 3. 텍스트 계열 파일 읽기
  const fileContent = await file.text();

  // 3-A. HTML 문서
  if (ext === "html" || ext === "htm") {
    const title = fileName.replace(/\.(html|htm)$/i, "");
    const parser = new DOMParser();
    const doc = parser.parseFromString(fileContent, "text/html");
    const contentDiv = doc.getElementById("zen-editor-content");
    let html = "";
    if (contentDiv) {
      html = contentDiv.innerHTML;
    } else {
      html = doc.body.innerHTML.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    }
    return { title, html, plainText: "" };
  }

  // 3-B. 마크다운 (MD) 문서
  if (ext === "md" || ext === "markdown") {
    const parsedHtml = convertMarkdownToHTML(fileContent);
    const title = window.__lastParsedMdTitle || fileName.replace(/\.(md|markdown)$/i, "");
    return { title, html: parsedHtml, plainText: fileContent };
  }

  // 3-C. 일반 텍스트 (TXT) 문서
  if (ext === "txt") {
    let txtBody = fileContent.replace(/^\uFEFF/, ""); // BOM 제거
    let title = fileName.replace(/\.txt$/i, "");
    const zenHeaderMatch = txtBody.match(/^([^\r\n]+)\r?\n\d{4}\.\d{2}\.\d{2}\.\([일월화수목금토]\)\s+\d{2}:\d{2}[^\r\n]*\r?\n─{20,}\r?\n\r?\n?/);
    const legacyHeaderMatch = txtBody.match(/^={20,}\r?\n\[제목\]\s*(.+?)\r?\n[\s\S]*?={20,}\r?\n\r?\n?/);
    if (zenHeaderMatch) {
      title = zenHeaderMatch[1].trim();
      txtBody = txtBody.substring(zenHeaderMatch[0].length);
    } else if (legacyHeaderMatch) {
      title = legacyHeaderMatch[1].trim();
      txtBody = txtBody.substring(legacyHeaderMatch[0].length);
    }
    // Quill 문단 변환
    const lines = txtBody.split(/\r?\n/);
    const html = lines.map((line) => {
      const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<p>${escaped || "<br>"}</p>`;
    }).join("");
    return { title, html, plainText: txtBody };
  }

  // 3-D. JSON 파일
  if (ext === "json") {
    try {
      const parsed = JSON.parse(fileContent);
      if (parsed.type === "ZenBackup") {
        return {
          isZenBackup: true,
          file: file,
          parsed: parsed,
          title: fileName
        };
      }
      if (parsed.type === "ZenMemo") {
        return {
          title: parsed.title || fileName.replace(/\.json$/i, ""),
          html: parsed.content || "",
          plainText: ""
        };
      }
      // 일반 JSON
      const formatted = JSON.stringify(parsed, null, 2);
      const lines = formatted.split("\n");
      const html = lines.map((l) => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") || "<br>"}</p>`).join("");
      return { title: fileName.replace(/\.json$/i, ""), html, plainText: formatted };
    } catch (e) {
      return null;
    }
  }

  return null;
}

/**
 * 드롭된 여러 파일들을 순차 분석하여 각각 새 노트를 생성하고 즉시 엽니다.
 */
async function processDroppedFiles(files) {
  if (!files || files.length === 0) return;

  const supportedFiles = [];
  const unsupportedFileNames = [];

  for (const f of files) {
    if (isImportableFile(f)) {
      supportedFiles.push(f);
    } else {
      unsupportedFileNames.push(f.name);
    }
  }

  // 지원하지 않는 일반 확장자 파일 안내 토스트
  if (unsupportedFileNames.length > 0) {
    const listStr = unsupportedFileNames.slice(0, 3).join(", ") + (unsupportedFileNames.length > 3 ? ` 외 ${unsupportedFileNames.length - 3}개` : "");
    showToast(`지원하지 않는 파일 (${unsupportedFileNames.length}개 제외): ${listStr}`);
  }

  if (supportedFiles.length === 0) return;

  // 파일 파싱 실행
  const parsedItems = [];
  for (const f of supportedFiles) {
    try {
      const parsed = await parseImportableFile(f);
      if (parsed) {
        parsedItems.push(parsed);
      } else {
        unsupportedFileNames.push(f.name);
      }
    } catch (err) {
      console.error(`파일 [${f.name}] 파싱 에러:`, err);
    }
  }

  // 🎯 [V4.1.6] 로컬 백업 파일(ZenBackup) 분리 식별
  const backupItems = parsedItems.filter((item) => item.isZenBackup);
  const noteItems = parsedItems.filter((item) => !item.isZenBackup);

  // 🎯 [Case A] 로컬 백업 파일 단독 1개만 드롭된 경우: 확인 컨펌 후 복원 진행
  if (backupItems.length === 1 && noteItems.length === 0) {
    const backupItem = backupItems[0];
    const backupDateStr = extractBackupDate(backupItem.parsed, backupItem.file);
    const isConfirmed = confirm(`${backupDateStr}에 백업한 파일을 복원하시겠습니까?`);
    if (isConfirmed) {
      restoreZenBackupData(backupItem.parsed);
    } else {
      showToast("백업 복원이 취소되었습니다.");
    }
    return;
  }

  // 🎯 [Case B] 로컬 백업 파일이 여러 개이거나 다른 일반 파일들과 함께 섞여 있는 경우: 제외 안내 토스트
  if (backupItems.length > 0) {
    const backupNames = backupItems.map((b) => b.file.name).join(", ");
    showToast(`로컬 백업 파일은 일괄 불러오기에서 제외되었습니다: ${backupNames}`);
  }

  // 생성할 일반 노트 아이템이 없으면 종료
  if (noteItems.length === 0) return;

  // 🎯 단일 PDF 파일인 경우: 기존 정밀 PDF 임포트 핸들러(범위 선택 모달 지원)로 연결
  if (noteItems.length === 1 && noteItems[0].isPdf) {
    handleFileImport({ target: { files: [noteItems[0].file], value: "" } });
    return;
  }

  // 현재 열려있는 노트가 있다면 안전하게 즉시 저장
  if (typeof forceSaveImmediate === "function") {
    forceSaveImmediate();
  }

  const itemsToCreate = [];
  for (const item of noteItems) {
    if (item.isPdf) {
      // 멀티 파일 중 PDF가 포함된 경우: 간이 PDF 렌더링 (최대 30페이지)
      try {
        if (typeof pdfjsLib !== "undefined") {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            new URL("./lib/pdfjs/", location.href).href + "pdf.worker.min.mjs";
          const arrayBuf = await item.file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuf),
            cMapUrl: new URL("./lib/pdfjs/", location.href).href + "cmaps/",
            cMapPacked: true,
            standardFontDataUrl: new URL("./lib/pdfjs/", location.href).href + "standard_fonts/"
          });
          const pdf = await loadingTask.promise;
          const pagesToRender = Math.min(pdf.numPages, 30);
          let pdfHtml = "";
          for (let p = 1; p <= pagesToRender; p++) {
            const base64Img = await renderPdfPageToBase64(pdf, p);
            pdfHtml += `<p><img src="${base64Img}"></p><p><br></p>`;
          }
          const pageSuffix = pdf.numPages > 30 ? " (p.1-30)" : "";
          itemsToCreate.push({
            title: item.title + pageSuffix,
            html: pdfHtml,
            plainText: ""
          });
        }
      } catch (pdfErr) {
        console.error("멀티 파일 중 PDF 파싱 실패:", pdfErr);
      }
    } else {
      itemsToCreate.push(item);
    }
  }

  if (itemsToCreate.length === 0) return;

  const createdMemoIds = [];
  const now = Date.now();

  // 첫 번째 드롭 파일이 목록 최상단에 오도록 시차(역순 타임스탬프) 적용
  for (let i = 0; i < itemsToCreate.length; i++) {
    const item = itemsToCreate[i];
    const itemTime = now + (itemsToCreate.length - 1 - i) * 1000;
    try {
      const newMemoId = await saveNewMemoDirect(item.title, item.html, item.plainText || "", itemTime);
      createdMemoIds.push(newMemoId);
    } catch (dbErr) {
      console.error("새 노트 DB 저장 실패:", dbErr);
    }
  }

  // 목록 갱신 및 첫 번째 생성된 새 노트 즉시 열기
  if (typeof loadMemoList === "function") loadMemoList(true);
  if (typeof updateUnsyncedCount === "function") updateUnsyncedCount();

  if (createdMemoIds.length > 0 && typeof loadMemo === "function") {
    await loadMemo(createdMemoIds[0]);
  }

  if (itemsToCreate.length === 1) {
    showToast(`✅ 새 노트를 생성하여 불러왔습니다. (${itemsToCreate[0].title})`);
  } else {
    showToast(`✅ ${itemsToCreate.length}개의 새 노트를 생성하여 불러왔습니다!`);
  }

  // 클라우드 백그라운드 동기화 트리거
  if (typeof triggerBackgroundSync === "function") {
    triggerBackgroundSync();
  }
}

/**
 * 윈도우 전역 파일 드래그 앤 드롭 이벤트 리스너 초기화
 */
function initGlobalFileDragAndDrop() {
  const overlay = document.getElementById("drop-zone-overlay");
  let dragCounter = 0;

  function hasFiles(e) {
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    if (!types) return false;
    return types.includes ? types.includes("Files") : Array.from(types).indexOf("Files") !== -1;
  }

  function showOverlay() {
    if (overlay) overlay.classList.add("is-active");
  }

  function hideOverlay() {
    if (overlay) overlay.classList.remove("is-active");
  }

  // 1. dragenter (캡처링 단계)
  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
      showOverlay();
    }
  }, true);

  // 2. dragover (캡처링 단계)
  window.addEventListener("dragover", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, true);

  // 3. dragleave (캡처링 단계)
  window.addEventListener("dragleave", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounter = Math.max(0, dragCounter - 1);
    if (dragCounter === 0) {
      hideOverlay();
    }
  }, true);

  // 4. drop (캡처링 단계 - Quill 등의 하위 요소 캡처보다 먼저 인터셉트)
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    hideOverlay();

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      processDroppedFiles(files);
    }
  }, true);

  // 5. ESC 키 또는 창 벗어남 시 방어적 리셋
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dragCounter = 0;
      hideOverlay();
    }
  });

  document.addEventListener("mouseleave", () => {
    dragCounter = 0;
    hideOverlay();
  });
}

// DOM 로드 완료 시 전역 드래그 앤 드롭 바인딩
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGlobalFileDragAndDrop);
} else {
  initGlobalFileDragAndDrop();
}

