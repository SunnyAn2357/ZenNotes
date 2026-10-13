// 🎯 1. [PDF 전용] 라이트 테마 CSS (인쇄용 화이트 바탕 & 페이지 절단 방어 & 고정밀 팔레트)
const exportThemeCSS_Light = `
<style>
    .zen-export-wrapper { background: #ffffff; color: #111111; font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.65; word-break: keep-all; overflow-wrap: break-word; }
    .zen-export-wrapper p, .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3, .zen-export-wrapper li { margin-bottom: 8px; }
    .zen-export-wrapper ul, .zen-export-wrapper ol { margin-bottom: 20px; }
    
    /* 🎯 페이지 분할 방어 (Page-Break Defense) */
    .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3 { page-break-after: avoid !important; break-after: avoid !important; }
    .zen-export-wrapper p, .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3 { page-break-inside: avoid !important; break-inside: avoid !important; orphans: 3; widows: 3; }
    .zen-export-wrapper table, .zen-export-wrapper tr, .zen-export-wrapper td, .zen-export-wrapper th { page-break-inside: avoid !important; break-inside: avoid !important; }
    .zen-export-wrapper .ql-code-block-container { page-break-inside: avoid !important; break-inside: avoid !important; }
    .zen-export-wrapper blockquote { page-break-inside: avoid !important; break-inside: avoid !important; }
    .zen-export-wrapper li { page-break-inside: avoid !important; break-inside: avoid !important; }
    .zen-export-wrapper img { max-width: 100%; height: auto; page-break-inside: avoid !important; break-inside: avoid !important; }

    .zen-export-wrapper table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #cccccc; }
    .zen-export-wrapper td, .zen-export-wrapper th { border: 1px solid #cccccc; padding: 8px 12px; color: #000000; }
    .zen-export-wrapper th { background-color: #f5f5f5 !important; font-weight: 600 !important; }
    .zen-export-wrapper blockquote,
    .zen-export-wrapper .ql-editor blockquote {
        border-left: 4px solid #78a9ff !important;
        background-color: #f9f9f9 !important;
        margin: 16px 0 !important;
        padding: 12px 16px !important;
        color: #333333 !important;
        font-style: normal !important;
        border-radius: 0 8px 8px 0 !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }
    .zen-export-wrapper code,
    .zen-export-wrapper .ql-editor code {
        background-color: rgba(120, 169, 255, 0.1) !important;
        color: #0056b3 !important;
        padding: 2px 6px !important;
        border-radius: 4px !important;
        font-family: 'D2Coding', 'Consolas', monospace !important;
    }
    
    /* 🎯 PDF 다크 침범 방어 & 라벨 세팅 */
    .zen-export-wrapper .ql-code-block-container { position: relative !important; background-color: #f5f5f5 !important; border: 1px solid #e0e0e0 !important; border-radius: 8px !important; padding: 44px 16px 16px 16px !important; margin: 1rem 0 !important; }
    .zen-export-wrapper .ql-code-block-container select.ql-ui { display: block !important; position: absolute !important; top: 12px !important; left: 16px !important; background: transparent !important; color: #666666 !important; border: none !important; font-size: 12px !important; font-weight: 600 !important; text-transform: uppercase; appearance: none !important; -webkit-appearance: none !important; pointer-events: none !important; }
    .zen-export-wrapper .ql-code-block-container::before { content: '' !important; position: absolute !important; top: 38px !important; left: 0 !important; right: 0 !important; height: 1px !important; background-color: #e0e0e0 !important; display: block !important; }
    
    /* 🎯 폰트 및 구문 강조 팔레트 (인쇄용 명암비 적용) */
    .zen-export-wrapper .ql-code-block { background-color: transparent !important; color: #333333 !important; font-family: 'D2Coding', 'Consolas', monospace !important; font-size: 13px !important; line-height: 1.6 !important; white-space: pre-wrap !important; }
    .zen-export-wrapper .hljs-comment, .zen-export-wrapper .hljs-quote { color: #6a737d !important; font-style: italic !important; }
    .zen-export-wrapper .hljs-keyword, .zen-export-wrapper .hljs-selector-tag, .zen-export-wrapper .hljs-type { color: #d73a49 !important; font-weight: 600 !important; }
    .zen-export-wrapper .hljs-title, .zen-export-wrapper .hljs-title.function_, .zen-export-wrapper .hljs-function { color: #005cc5 !important; }
    .zen-export-wrapper .hljs-name, .zen-export-wrapper .hljs-section, .zen-export-wrapper .hljs-tag { color: #22863a !important; }
    .zen-export-wrapper .hljs-attr, .zen-export-wrapper .hljs-attribute, .zen-export-wrapper .hljs-params { color: #e36209 !important; }
    .zen-export-wrapper .hljs-string, .zen-export-wrapper .hljs-regexp { color: #032f62 !important; }
    .zen-export-wrapper .hljs-number, .zen-export-wrapper .hljs-literal, .zen-export-wrapper .hljs-variable { color: #005cc5 !important; }
    .zen-export-wrapper .hljs-built_in, .zen-export-wrapper .hljs-class { color: #e36209 !important; }
    
    .zen-export-wrapper .ql-strike-line-true { color: #999999; text-decoration: line-through; }
    .zen-export-wrapper a { color: #2563eb; text-decoration: underline; }
    .zen-export-wrapper img { max-width: 100%; height: auto; }
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
        margin-bottom: 24px;
    }
    .zen-doc-title {
        font-size: 28px;
        font-weight: 700;
        color: var(--zen-text);
        margin: 0 0 10px 0;
        letter-spacing: -0.5px;
        line-height: 1.3;
    }
    .zen-doc-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        font-size: 12px;
        color: var(--zen-meta-text);
        margin-bottom: 14px;
    }
    .zen-meta-item {
        display: inline-flex;
        align-items: center;
    }
    .zen-doc-divider {
        border: none;
        border-bottom: 2px solid var(--zen-border);
        margin: 0;
    }

    /* 에디터 본문 타이포그래피 */
    .ql-editor { padding: 0; }
    .ql-editor p, .ql-editor h1, .ql-editor h2, .ql-editor h3, .ql-editor li { margin-bottom: 8px; }
    .ql-editor ul, .ql-editor ol { margin-bottom: 20px; }
    .ql-editor hr { border: none !important; border-bottom: 1px solid var(--zen-border) !important; margin: 20px 0 !important; }

    /* 표 (Table) */
    .ql-editor table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid var(--zen-border); }
    .ql-editor td, .ql-editor th { border: 1px solid var(--zen-border); padding: 8px 12px; color: var(--zen-text); }
    .ql-editor th { background-color: var(--zen-th-bg); font-weight: 600; }

    /* 인용구 (Blockquote) */
    .ql-editor blockquote { border-left: 4px solid var(--zen-accent); background-color: var(--zen-quote-bg); margin: 16px 0; padding: 12px 16px; color: var(--zen-quote-text); border-radius: 0 8px 8px 0; font-style: normal; }

    /* 링크 및 서식 */
    .ql-editor a { color: var(--zen-accent); text-decoration: underline; }
    .ql-editor img { max-width: 100%; height: auto; border-radius: 4px; }
    .ql-editor .ql-strike-line-true { text-decoration: line-through; opacity: 0.6; }

    /* 코드 블록 공통 구조 */
    .ql-editor .ql-code-block-container {
        position: relative !important;
        background-color: var(--zen-code-bg) !important;
        border: 1px solid var(--zen-border) !important;
        border-radius: 8px !important;
        padding: 44px 16px 16px 16px !important;
        margin: 1rem 0 !important;
        display: block !important;
    }
    .ql-editor .ql-code-block-container select.ql-ui {
        display: block !important;
        position: absolute !important;
        top: 12px !important;
        left: 16px !important;
        background: transparent !important;
        color: var(--zen-meta-text) !important;
        border: none !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        text-transform: uppercase;
        appearance: none !important;
        -webkit-appearance: none !important;
        pointer-events: none !important;
    }
    .ql-editor .ql-code-block-container::before {
        content: '' !important;
        position: absolute !important;
        top: 38px !important;
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

    /* 문서 하단 푸터 */
    .zen-doc-footer {
        margin-top: 48px;
        padding-top: 14px;
        border-top: 1px solid var(--zen-border);
        font-size: 11px;
        color: var(--zen-meta-text);
        text-align: right;
    }

    /* 🖨️ 인쇄 시 화이트 강제 & 불필요 버튼 숨김 */
    @page { size: A4; margin: 15mm 12mm; }
    @media print {
        .zen-theme-switch-btn { display: none !important; }
        body.zen-export-body { background: #ffffff !important; color: #000000 !important; padding: 0 !important; }
        .ql-editor p, .ql-editor h1, .ql-editor h2, .ql-editor h3, .ql-editor li, .ql-editor blockquote, .ql-editor tr, .ql-editor img, .ql-editor .ql-code-block-container { page-break-inside: avoid !important; break-inside: avoid !important; }
        .ql-editor p, .ql-editor li { orphans: 3; widows: 3; }
        .ql-editor h1, .ql-editor h2, .ql-editor h3 { page-break-after: avoid !important; break-after: avoid !important; }
        .zen-doc-title { color: #000000 !important; }
        .zen-doc-divider { border-bottom-color: #000000 !important; }
        .ql-editor table, .ql-editor th, .ql-editor td { border-color: #cccccc !important; color: #000000 !important; }
        .ql-editor th { background-color: #f5f5f5 !important; }
        .ql-editor blockquote { background-color: #f9f9f9 !important; color: #333333 !important; border-left: 4px solid #78a9ff !important; font-style: normal !important; border-radius: 0 8px 8px 0 !important; }
        .ql-editor .ql-code-block-container { background-color: #f5f5f5 !important; border-color: #e0e0e0 !important; }
        .ql-editor .ql-code-block { color: #24292e !important; }
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

// 🎯 [V3.4.5] 문서 내보내기용 일시 포맷터 (YYYY-MM-DD HH:mm:ss)
function formatExportDate(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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


// 🎯 [V3.4.5] HTML 파일 내보내기 (Pretendard 웹폰트 + 다크/라이트 듀얼 테마 전환 + 메타 헤더)
async function exportHTML() {
  closeAllPanelsMobile();
  const meta = await getCurrentMemoDetails();
  const t = getTitle();
  const c = getHtmlWithSelectState();
  const createdAtStr = formatExportDate(meta.createdAt);
  const updatedAtStr = formatExportDate(meta.updatedAt);
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);
  const tagPills = tags.length > 0
    ? `<span class="zen-meta-item">🏷️ ${tags.map((tag) => '#' + escapeHtml(tag)).join(' ')}</span>`
    : '';

  setTimeout(() => {
    const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(t)} - ZenNotes</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/joungkyun/font-d2coding/d2coding.css">
    ${exportThemeCSS_Dual}
</head>
<body class="zen-export-body">
    <button class="zen-theme-switch-btn" id="theme-btn" onclick="toggleExportTheme()" title="다크 / 라이트 모드 전환">
        <span id="theme-icon">☀️</span> <span id="theme-label">라이트 모드</span>
    </button>
    <div class="zen-doc-container">
        <header class="zen-doc-header">
            <h1 class="zen-doc-title">${escapeHtml(t)}</h1>
            <div class="zen-doc-meta">
                <span class="zen-meta-item">📁 ${escapeHtml(meta.folderPath)}</span>
                <span class="zen-meta-item">🕒 작성: ${createdAtStr}</span>
                <span class="zen-meta-item">✏️ 수정: ${updatedAtStr}</span>
                ${tagPills}
            </div>
            <hr class="zen-doc-divider">
        </header>
        <main id="zen-editor-content" class="ql-editor">${c}</main>
        <footer class="zen-doc-footer">
            <span>ZenNotes · ${updatedAtStr}</span>
        </footer>
    </div>
    <script>
        function toggleExportTheme() {
            const isLight = document.body.classList.toggle('light-theme');
            const icon = document.getElementById('theme-icon');
            const label = document.getElementById('theme-label');
            if (isLight) {
                icon.textContent = '🌙';
                label.textContent = '다크 모드';
            } else {
                icon.textContent = '☀️';
                label.textContent = '라이트 모드';
            }
            try { localStorage.setItem('zen_export_theme', isLight ? 'light' : 'dark'); } catch(e){}
        }
        (function() {
            try {
                if (localStorage.getItem('zen_export_theme') === 'light') {
                    document.body.classList.add('light-theme');
                    document.getElementById('theme-icon').textContent = '🌙';
                    document.getElementById('theme-label').textContent = '다크 모드';
                }
            } catch(e){}
        })();
    </script>
</body>
</html>`;

    saveAs(
      new Blob([htmlContent], { type: "text/html;charset=utf-8" }),
      `${t}.html`
    );
    showToast("HTML 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
  }, 300);
}

// 🎯 [V3.4.5] PDF 파일 내보내기 (고해상도 + 페이지 절단 방어 + 문서 메타 헤더)
async function exportPDF() {
  document.body.classList.add('is-pdf-exporting');
  closeAllPanelsMobile();
  showToast("PDF 변환을 시작합니다...\n(잠시만 기다려주세요)");

  const meta = await getCurrentMemoDetails();
  const t = getTitle();
  const c = getHtmlWithSelectState();
  const createdAtStr = formatExportDate(meta.createdAt);
  const updatedAtStr = formatExportDate(meta.updatedAt);
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);
  const tagStr = tags.length > 0 ? ` · 🏷️ ${tags.map((tg) => '#' + escapeHtml(tg)).join(' ')}` : '';

  setTimeout(() => {
    const printContainer = document.createElement("div");
    printContainer.innerHTML = `
        ${exportThemeCSS_Light}
        <div class="zen-export-wrapper" style="padding: 24px; background-color: #ffffff;">
            <div style="max-width: 800px; margin: 0 auto;">
                <div style="font-size: 26px; font-weight: 700; color: #111111; margin-bottom: 4px; letter-spacing: -0.5px;">${escapeHtml(t)}</div>
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #666666; margin-bottom: 8px;">
                    <span>📁 ${escapeHtml(meta.folderPath)}${tagStr}</span>
                    <span>작성: ${createdAtStr} · 수정: ${updatedAtStr}</span>
                </div>
                <hr style="border: none; border-bottom: 2px solid #333333; margin: 0 0 20px 0;">
                <div class="ql-snow">
                    <div class="ql-editor" style="padding: 0; color: #111111; overflow: visible; height: auto;">${c}</div>
                </div>
                <div style="margin-top: 32px; padding-top: 8px; border-top: 1px solid #e0e0e0; font-size: 10px; color: #888888; text-align: right;">
                    ZenNotes Document · ${createdAtStr}
                </div>
            </div>
        </div>`;

    html2pdf()
      .set({
        margin: [12, 10, 12, 10],
        filename: `${t}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['p', 'h1', 'h2', 'h3', 'li', 'blockquote', 'tr', 'img', '.ql-code-block-container'] }
      })
      .from(printContainer)
      .save()
      .then(() => {
        showToast("PDF 파일 저장이 완료되었습니다.");
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

// 🎯 [V3.4.5] TXT 파일 내보내기 (UTF-8 BOM + 제목/폴더/작성일 메타 헤더 배너)
async function exportTXT() {
  closeAllPanelsMobile();
  const meta = await getCurrentMemoDetails();
  const t = getTitle();
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);
  const tagsLine = tags.length > 0 ? `[태그] ${tags.map((tag) => '#' + tag).join(' ')}\n` : '';

  const divider = "============================================================";
  const header = `${divider}\n[제목] ${t}\n[폴더] ${meta.folderPath}\n[작성일시] ${formatExportDate(meta.createdAt)}\n[수정일시] ${formatExportDate(meta.updatedAt)}\n${tagsLine}${divider}\n\n`;

  const fullText = "\uFEFF" + header + plainText.trim() + "\n";

  setTimeout(() => {
    saveAs(
      new Blob([fullText], { type: "text/plain;charset=utf-8" }),
      `${t}.txt`
    );
    showToast("TXT 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
  }, 300);
}

// 🎯 [V3.4.5] JSON 파일 내보내기 (표준 Schema 2.0 + 전체 메타데이터 보존 + 2칸 가독성 포맷팅)
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
    folderPath: meta.folderPath,
    tags: tags,
    isPinned: meta.isPinned,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    exportedAt: Date.now(),
    content: quill.root.innerHTML,
    plainText: plainText
  };

  const jsonString = JSON.stringify(jsonPayload, null, 2);

  setTimeout(() => {
    saveAs(
      new Blob([jsonString], { type: "application/json;charset=utf-8" }),
      `${meta.title}.json`
    );
    showToast("JSON 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
  }, 300);
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
      return innerText ? `__${innerText}__` : "";
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

    if (listType === "checked") {
      Object.keys(counters).forEach((k) => {
        if (parseInt(k, 10) >= indentLvl) delete counters[k];
      });
      return `${indentSpaces}- [x] ${itemText}`;
    } else if (listType === "unchecked") {
      Object.keys(counters).forEach((k) => {
        if (parseInt(k, 10) >= indentLvl) delete counters[k];
      });
      return `${indentSpaces}- [ ] ${itemText}`;
    } else if (
      listType === "ordered" ||
      (li.parentElement && li.parentElement.tagName.toLowerCase() === "ol" && !listType)
    ) {
      counters[indentLvl] = (counters[indentLvl] || 0) + 1;
      Object.keys(counters).forEach((k) => {
        if (parseInt(k, 10) > indentLvl) delete counters[k];
      });
      return `${indentSpaces}${counters[indentLvl]}. ${itemText}`;
    } else {
      Object.keys(counters).forEach((k) => {
        if (parseInt(k, 10) >= indentLvl) delete counters[k];
      });
      return `${indentSpaces}- ${itemText}`;
    }
  }

  const lines = [];
  const children = Array.from(container.children);

  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    const tag = el.tagName.toLowerCase();

    // 1. 제목 (H1, H2, H3)
    if (tag === "h1") {
      lines.push(`# ${convertInline(el).trim()}`);
    } else if (tag === "h2") {
      lines.push(`## ${convertInline(el).trim()}`);
    } else if (tag === "h3") {
      lines.push(`### ${convertInline(el).trim()}`);
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
      if (codeBlocks.length > 0) {
        codeBlocks.forEach((cb) => codeLines.push(cb.textContent));
      } else {
        codeLines.push(el.textContent);
      }
      lines.push("```\n" + codeLines.join("\n") + "\n```");
    }
    // 4. 단일 코드 블록 행
    else if (el.classList.contains("ql-code-block")) {
      const codeLines = [el.textContent];
      while (i + 1 < children.length && children[i + 1].classList.contains("ql-code-block")) {
        i++;
        codeLines.push(children[i].textContent);
      }
      lines.push("```\n" + codeLines.join("\n") + "\n```");
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

// 🎯 [V3.3.3] 마크다운(.md) 파일 내보내기
// 🎯 [V3.4.5] 마크다운(.md) 파일 내보내기 (YAML Frontmatter + 태그/폴더 메타 표준)
async function exportMD() {
  closeAllPanelsMobile();
  const meta = await getCurrentMemoDetails();
  const t = getTitle();
  const plainText = quill.getText();
  const tags = extractHashTags(plainText);
  const mdContent = convertQuillToMarkdown();

  let frontmatter = `---\ntitle: "${t.replace(/"/g, '\\"')}"\ncreated: "${formatExportDate(meta.createdAt)}"\nupdated: "${formatExportDate(meta.updatedAt)}"\nfolder: "${meta.folderPath.replace(/"/g, '\\"')}"\n`;
  if (tags.length > 0) {
    frontmatter += `tags:\n${tags.map((tag) => `  - "${tag.replace(/"/g, '\\"')}"`).join('\n')}\n`;
  }
  frontmatter += `---\n\n`;

  const finalMd = frontmatter + mdContent;

  setTimeout(() => {
    saveAs(
      new Blob([finalMd], { type: "text/markdown;charset=utf-8" }),
      `${t}.md`
    );
    showToast("MD 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
  }, 300);
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
        .map((cl) => `<div class="ql-code-block">${cl || "<br>"}</div>`)
        .join("");
      htmlParts.push(
        `<div class="ql-code-block-container" spellcheck="false">${codeHtml}</div>`
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

    // C. 제목 (# H1, ## H2, ### H3)
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      htmlParts.push(`<h${level}>${parseInline(headerMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // D. 인용구 (> text)
    if (/^>\s?(.*)$/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?(.*)$/.test(lines[i])) {
        const qm = lines[i].match(/^>\s?(.*)$/);
        quoteLines.push(parseInline(qm[1]));
        i++;
      }
      htmlParts.push(`<blockquote>${quoteLines.join("<br>")}</blockquote>`);
      continue;
    }

    // E. 체크리스트 (- [ ] 또는 - [x] 또는 * [ ]) - 🎯 [V3.4.4] 들여쓰기 지원
    if (/^\s*(\*|-)\s+\[([ xX])\]\s*(.*)$/.test(line)) {
      while (i < lines.length && /^\s*(\*|-)\s+\[([ xX])\]\s*(.*)$/.test(lines[i])) {
        const cm = lines[i].match(/^(\s*)(\*|-)\s+\[([ xX])\]\s*(.*)$/);
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

    // G. 글머리 기호 목록 (* text 또는 - text) - 🎯 [V3.4.4] 들여쓰기 지원
    if (/^\s*(\*|-)\s+(.*)$/.test(line) && !/^\s*(\*|-)\s+\[([ xX])\]/.test(line)) {
      while (
        i < lines.length &&
        /^\s*(\*|-)\s+(.*)$/.test(lines[i]) &&
        !/^\s*(\*|-)\s+\[([ xX])\]/.test(lines[i])
      ) {
        const bm = lines[i].match(/^(\s*)(\*|-)\s+(.*)$/);
        const indentLvl = getLeadingIndent(bm[1]);
        const text = parseInline(bm[3]);
        const indentClass = indentLvl > 0 ? ` class="ql-indent-${indentLvl}"` : "";
        htmlParts.push(`<li data-list="bullet"${indentClass}>${text || "<br>"}</li>`);
        i++;
      }
      continue;
    }

    // H. 가로 구분선 (--- 또는 ***)
    if (/^(\-{3,}|\*{3,})$/.test(line.trim())) {
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

// 🎯 인쇄하기도 화면이 멈추지 않도록 시간차 적용
// 🎯 [V3.4.5] 인쇄하기 (종이 인쇄 메타 헤더/푸터 주입 및 A4 고품질 렌더링)
async function handlePrint() {
  closeAllPanelsMobile();
  try {
    const meta = await getCurrentMemoDetails();
    const plainText = quill.getText();
    const tags = extractHashTags(plainText);
    const tagStr = tags.length > 0 ? ` · 🏷️ ${tags.map((t) => '#' + escapeHtml(t)).join(' ')}` : '';

    const metaElem = document.getElementById("print-meta-sub");
    if (metaElem) {
      metaElem.innerHTML = `<span>📁 ${escapeHtml(meta.folderPath)}${tagStr}</span><span>작성: ${formatExportDate(meta.createdAt)} · 수정: ${formatExportDate(meta.updatedAt)}</span>`;
    }
    const footerElem = document.getElementById("print-doc-footer");
    if (footerElem) {
      footerElem.textContent = `ZenNotes Document · ${formatExportDate(Date.now())}`;
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
          `Zen_Backup_${Date.now()}.json`,
        );
        showToast("전체 백업 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
      };
  }, 300);
}

// 🎯 [V3.3.3] 모든 데이터 초기화 (IndexedDB + Google Drive 클라우드 파일 영구 삭제)
async function resetAllData() {
  closeAllPanelsMobile();

  // 1. 1차 경고 확인
  const firstConfirm = confirm(
    "⚠️ [경고] 모든 데이터 초기화\n\n로컬 저장소(IndexedDB)의 모든 노트와 폴더가 영구 삭제됩니다.\n정말로 초기화를 진행하시겠습니까?"
  );
  if (!firstConfirm) return;

  // 2. 구글 드라이브 연결 상태 확인
  let isDriveConnected = false;
  try {
    if (typeof ensureValidToken === "function") {
      isDriveConnected = await ensureValidToken();
    }
  } catch (e) {
    isDriveConnected = false;
  }

  // 3. 2차 상세 확인
  let confirmMsg = "";
  if (isDriveConnected) {
    confirmMsg =
      "⚠️ [구글 드라이브 연결 상태]\n\n" +
      "로컬 데이터뿐만 아니라 구글 드라이브에 동기화된 모든 클라우드 데이터(ZenNotes_Sync_Data 폴더 및 백업 파일)가 영구 삭제됩니다.\n\n" +
      "삭제된 데이터는 절대 복구할 수 없습니다.\n정말로 모든 데이터를 영구 삭제하시겠습니까?";
  } else {
    confirmMsg =
      "ℹ️ [로그아웃 상태]\n\n" +
      "현재 기기의 로컬 데이터만 초기화됩니다.\n\n" +
      "※ 중요: 나중에 구글 드라이브에 다시 로그인하면, 클라우드에 보관된 데이터가 현재 기기로 자동 복구됩니다.\n\n" +
      "※ 구글 드라이브의 클라우드 데이터까지 완전히 삭제하려면, 먼저 상단 구글 드라이브에 로그인한 후 초기화를 진행해 주세요.\n\n" +
      "현재 기기의 로컬 데이터를 초기화하시겠습니까?";
  }

  const secondConfirm = confirm(confirmMsg);
  if (!secondConfirm) return;

  // 4. 진행 중인 자동 저장 및 동기화 타이머 차단
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

  // 5. 구글 드라이브 파일 영구 삭제 (연결된 경우)
  if (isDriveConnected && typeof gapi !== "undefined" && gapi.client && gapi.client.drive) {
    try {
      // A. ZenNotes_Sync_Data 폴더 및 내부 파일들 삭제
      const folderRes = await gapi.client.drive.files.list({
        q: "name = 'ZenNotes_Sync_Data' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: "files(id, name)",
      });

      const folders = folderRes.result.files || [];
      for (const folder of folders) {
        const insideRes = await gapi.client.drive.files.list({
          q: `'${folder.id}' in parents and trashed = false`,
          fields: "files(id, name)",
          pageSize: 1000,
        });
        const insideFiles = insideRes.result.files || [];
        for (const file of insideFiles) {
          try {
            await gapi.client.drive.files.delete({ fileId: file.id });
          } catch (err) {
            console.warn("드라이브 파일 삭제 오류:", file.name, err);
          }
        }
        try {
          await gapi.client.drive.files.delete({ fileId: folder.id });
        } catch (err) {
          console.warn("드라이브 폴더 삭제 오류:", folder.id, err);
        }
      }

      // B. 레거시 백업 파일 삭제
      const backupRes = await gapi.client.drive.files.list({
        q: "(name = 'ZenNotes_Backup.json' or name = 'ZenNotes_Backup_OLD_V2.json') and trashed = false",
        fields: "files(id, name)",
      });
      const backupFiles = backupRes.result.files || [];
      for (const bFile of backupFiles) {
        try {
          await gapi.client.drive.files.delete({ fileId: bFile.id });
        } catch (err) {
          console.warn("드라이브 백업 파일 삭제 오류:", bFile.name, err);
        }
      }
      console.log("✅ 구글 드라이브 동기화 데이터 삭제 완료");
    } catch (driveErr) {
      console.error("구글 드라이브 삭제 중 에러 발생:", driveErr);
    }
  }

  // 6. IndexedDB 데이터 완전 삭제
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

  // 7. localStorage 청소 (마지막 열람 노트, 동기화 시점, 보안 폴더 비밀번호 등)
  localStorage.removeItem("zen_last_opened");
  localStorage.removeItem("zen_last_sync_time");
  localStorage.removeItem("zen_sec_hash");

  // 8. 에디터 비우기 및 새로고침
  if (typeof quill !== "undefined" && quill) quill.setText("");
  const titleInput = document.getElementById("memo-title-input");
  if (titleInput) titleInput.value = "";

  showToast("모든 데이터가 성공적으로 초기화되었습니다.\n앱을 새로고침합니다.");
  setTimeout(() => {
    location.reload();
  }, 1200);
}

// 🎯 [V3.3.2] PDF 페이지 범위 선택 커스텀 모달 프로미스 리졸버
function showPdfPageRangeModal(totalPages) {
  return new Promise((resolve) => {
    const modal = document.getElementById("pdf-import-modal");
    const infoSpan = document.getElementById("pdf-modal-file-info");
    const input = document.getElementById("pdf-page-range-input");
    const confirmBtn = document.getElementById("pdf-modal-confirm-btn");
    const cancelBtn = document.getElementById("pdf-modal-cancel-btn");
    const closeIcon = document.getElementById("pdf-modal-close-icon");
    const splitAllBtn = document.getElementById("pdf-split-all-btn");

    if (!modal) {
      const res = prompt(
        `30페이지 이하로 불러올 수 있습니다. (현재파일: ${totalPages}페이지)\n불러올 페이지를 입력하세요.`,
        "1-30"
      );
      resolve(res ? { action: "range", range: res } : { action: "cancel" });
      return;
    }

    if (infoSpan) infoSpan.textContent = `(현재파일: ${totalPages}페이지)`;
    if (input) {
      input.value = "";
      input.placeholder = "입력 예: 1-30, 1~30";
    }
    modal.style.display = "flex";
    if (window.innerWidth <= 768) {
      history.pushState({ modal: "pdf-import" }, "");
    }

    setTimeout(() => {
      if (input) input.focus();
    }, 100);

    function cleanup() {
      modal.style.display = "none";
      if (confirmBtn) confirmBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (closeIcon) closeIcon.onclick = null;
      if (splitAllBtn) splitAllBtn.onclick = null;
      modal.onclick = null;
      if (input) input.onkeydown = null;
      if (window.innerWidth <= 768 && window.history.state && window.history.state.modal === "pdf-import") {
        if (typeof programmaticBackCount !== 'undefined') programmaticBackCount++;
        history.back();
      }
    }

    function doConfirm() {
      const val = (input && input.value.trim()) ? input.value.trim() : "1-30";
      cleanup();
      resolve({ action: "range", range: val });
    }

    function doCancel() {
      cleanup();
      resolve({ action: "cancel" });
    }

    function doSplitAll() {
      cleanup();
      resolve({ action: "split-all" });
    }

    if (confirmBtn) confirmBtn.onclick = doConfirm;
    if (cancelBtn) cancelBtn.onclick = doCancel;
    if (closeIcon) closeIcon.onclick = doCancel;
    if (splitAllBtn) splitAllBtn.onclick = doSplitAll;

    modal.onclick = (e) => {
      if (e.target === modal) doCancel();
    };

    if (input) {
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doConfirm();
        } else if (e.key === "Escape") {
          e.preventDefault();
          doCancel();
        }
      };
    }
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

  // 2. 파일명에서 타임스탬프 추출 (예: Zen_Backup_1720000000000.json)
  if (!timestamp && file && file.name) {
    const match = file.name.match(/Zen_Backup_(\d{10,13})/i);
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
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
        const typedarray = new Uint8Array(this.result);
        const loadingTask = pdfjsLib.getDocument({
          data: typedarray,
          cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/standard_fonts/"
        });
        const pdf = await loadingTask.promise;
        const totalPages = pdf.numPages;
        const baseTitle = file.name.replace(/\.[^/.]+$/, "");

        // 🎯 1. 30페이지 이하인 경우: 바로 전체 변환하여 새 노트 작성
        if (totalPages <= 30) {
          createNewMemo();
          isLoading = false;

          const titleInput = document.getElementById("memo-title-input");
          if (titleInput) titleInput.value = baseTitle;

          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            showToast(`PDF 변환 중... (${pageNum} / ${totalPages}장)`);
            const base64Img = await renderPdfPageToBase64(pdf, pageNum);
            const insertIdx = Math.max(0, quill.getLength() - 1);
            quill.insertEmbed(insertIdx, "image", base64Img, Quill.sources.USER);
            quill.insertText(insertIdx + 1, "\n\n", Quill.sources.USER);
          }
          await executeSave();
          showToast(`✅ PDF 변환 및 저장이 완료되었습니다! (${totalPages}장)`);
          return;
        }

        // 🎯 2. 30페이지 초과 시: 세련된 커스텀 모달 호출
        const modalRes = await showPdfPageRangeModal(totalPages);

        if (modalRes.action === "cancel") {
          showToast("PDF 불러오기가 취소되었습니다.");
          return;
        }

        // 🚀 A. [30페이지씩 전체 열기] 모드
        if (modalRes.action === "split-all") {
          const chunkCount = Math.ceil(totalPages / 30);
          showToast(`전체 ${totalPages}페이지를 ${chunkCount}개 노트로 자동 분할 생성합니다...`);

          const createdMemoIds = [];
          const now = Date.now();

          for (let c = 1; c <= chunkCount; c++) {
            const startP = (c - 1) * 30 + 1;
            const endP = Math.min(c * 30, totalPages);
            const chunkTitle = `${baseTitle} (p.${startP}-${endP})`;

            let htmlContent = "";
            for (let pageNum = startP; pageNum <= endP; pageNum++) {
              const currentInChunk = pageNum - startP + 1;
              const totalInChunk = endP - startP + 1;
              showToast(`PDF 변환 중... [노트 ${c}/${chunkCount}] (${currentInChunk}/${totalInChunk}장, p.${pageNum})`);

              const base64Img = await renderPdfPageToBase64(pdf, pageNum);
              htmlContent += `<p><img src="${base64Img}"></p><p><br></p>`;
            }

            // 🎯 최신순 정렬 시 1번 노트가 맨 위에 오도록 시차 부여
            const chunkTime = now + (chunkCount - c) * 1000;
            const newMemoId = await saveNewMemoDirect(chunkTitle, htmlContent, "", chunkTime);
            createdMemoIds.push(newMemoId);
          }

          // 목록 갱신 및 첫 번째 파트 노트(p.1-30) 에디터에 즉시 열기
          loadMemoList(true);
          updateUnsyncedCount();

          if (createdMemoIds.length > 0 && typeof loadMemo === "function") {
            await loadMemo(createdMemoIds[0]);
          }

          showToast(`✅ 전체 PDF가 ${chunkCount}개의 노트로 분할 저장되었습니다!`);
          return;
        }

        // 🚀 B. [지정 범위 불러오기] 모드 (modalRes.action === 'range')
        const cleaned = modalRes.range.trim().replace(/~/g, "-").replace(/,/g, "-");
        const parts = cleaned.split("-").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));

        let startPage = 1;
        let endPage = Math.min(totalPages, 30);

        if (parts.length === 1) {
          startPage = Math.max(1, Math.min(parts[0], totalPages));
          endPage = startPage;
        } else if (parts.length >= 2) {
          startPage = Math.max(1, Math.min(parts[0], parts[1]));
          endPage = Math.min(totalPages, Math.max(parts[0], parts[1]));
        } else {
          alert("입력 형식을 인식할 수 없어 처음 30페이지를 불러옵니다.");
          startPage = 1;
          endPage = Math.min(totalPages, 30);
        }

        if (endPage < startPage) {
          const temp = startPage;
          startPage = endPage;
          endPage = temp;
        }

        if (endPage - startPage + 1 > 30) {
          alert(`한 번에 최대 30페이지만 불러올 수 있습니다.\n(${startPage}페이지부터 ${startPage + 29}페이지까지 30장만 불러옵니다)`);
          endPage = startPage + 29;
        }

        createNewMemo();
        isLoading = false;

        const titleInput = document.getElementById("memo-title-input");
        if (titleInput) {
          titleInput.value =
            startPage === endPage
              ? `${baseTitle} (p.${startPage})`
              : `${baseTitle} (p.${startPage}-${endPage})`;
        }

        quill.focus();

        const countToLoad = endPage - startPage + 1;
        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          const currentIdx = pageNum - startPage + 1;
          showToast(`PDF 변환 중... (${currentIdx} / ${countToLoad}장, p.${pageNum})`);

          const base64Img = await renderPdfPageToBase64(pdf, pageNum);
          const insertIdx = Math.max(0, quill.getLength() - 1);
          quill.insertEmbed(insertIdx, "image", base64Img, Quill.sources.USER);
          quill.insertText(insertIdx + 1, "\n\n", Quill.sources.USER);
        }
        await executeSave();
        showToast(`✅ PDF 변환 및 저장이 완료되었습니다! (${countToLoad}장)`);
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
      const headerMatch = txtBody.match(/^={20,}\r?\n\[제목\]\s*(.+?)\r?\n[\s\S]*?={20,}\r?\n\r?\n?/);
      if (headerMatch) {
        document.getElementById("memo-title-input").value = headerMatch[1].trim();
        txtBody = txtBody.substring(headerMatch[0].length);
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
 * 드롭된 파일이 ZenNotes에서 지원하는 형식인지 판별합니다.
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
    const headerMatch = txtBody.match(/^={20,}\r?\n\[제목\]\s*(.+?)\r?\n[\s\S]*?={20,}\r?\n\r?\n?/);
    if (headerMatch) {
      title = headerMatch[1].trim();
      txtBody = txtBody.substring(headerMatch[0].length);
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
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
          const arrayBuf = await item.file.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuf),
            cMapUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/cmaps/",
            cMapPacked: true,
            standardFontDataUrl: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/standard_fonts/"
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

