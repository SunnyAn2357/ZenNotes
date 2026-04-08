// 🎯 1. [PDF 전용] 라이트 테마 CSS (인쇄용 화이트 바탕 & 고정밀 팔레트)
const exportThemeCSS_Light = `
<style>
    .zen-export-wrapper { background: #ffffff; color: #000000; font-family: 'Pretendard', -apple-system, sans-serif; line-height: 1.65; word-break: keep-all; overflow-wrap: break-word; }
    .zen-export-wrapper p, .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3, .zen-export-wrapper li { margin-bottom: 8px; }
    .zen-export-wrapper ul, .zen-export-wrapper ol { margin-bottom: 20px; }
    .zen-export-wrapper table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #cccccc; }
    .zen-export-wrapper td, .zen-export-wrapper th { border: 1px solid #cccccc; padding: 8px 12px; color: #000000; }
    .zen-export-wrapper th { background-color: #f5f5f5; font-weight: 600; }
    .zen-export-wrapper blockquote { border-left: 4px solid #78a9ff; background-color: #f9f9f9; margin: 16px 0; padding: 12px 16px; color: #333333; }
    
    /* 🎯 PDF 다크 침범 방어 & 라벨 세팅 */
    .zen-export-wrapper .ql-code-block-container { position: relative !important; background-color: #f5f5f5 !important; border: 1px solid #e0e0e0 !important; border-radius: 8px !important; padding: 44px 16px 16px 16px !important; margin: 1rem 0 !important; }
    .zen-export-wrapper .ql-code-block-container select.ql-ui { display: block !important; position: absolute !important; top: 12px !important; left: 16px !important; background: transparent !important; color: #666666 !important; border: none !important; font-size: 12px !important; font-weight: 600 !important; text-transform: uppercase; appearance: none !important; -webkit-appearance: none !important; pointer-events: none !important; }
    .zen-export-wrapper .ql-code-block-container::before { content: '' !important; position: absolute !important; top: 38px !important; left: 0 !important; right: 0 !important; height: 1px !important; background-color: #e0e0e0 !important; display: block !important; }
    
    /* 🎯 폰트 및 구문 강조 팔레트 (인쇄용 명암비 적용) */
    .zen-export-wrapper .ql-code-block { background-color: transparent !important; color: #333333 !important; font-family: 'D2Coding', 'Consolas', monospace !important; font-size: 14px !important; line-height: 1.6 !important; white-space: pre-wrap !important; }
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

// 🎯 2. [HTML 전용] 다크 테마 CSS (뚱뚱한 외부 링크 없이, 에디터 원본 다크 테마 100% 이식)
const exportThemeCSS_Dark = `
<style>
    /* -------------------------------------------------------------------------
       🖥️ 1. 웹 브라우저 화면용 (다크 테마 & 에디터 감성 100% 일치)
    ------------------------------------------------------------------------- */
    .zen-export-wrapper { background: #131314; color: #e3e3e3; font-family: 'Pretendard', -apple-system, sans-serif; line-height: 1.65; word-break: keep-all; overflow-wrap: break-word; }
    .zen-export-wrapper p, .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3, .zen-export-wrapper li { margin-bottom: 8px; }
    .zen-export-wrapper ul, .zen-export-wrapper ol { margin-bottom: 20px; }
    .zen-export-wrapper table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #444746; }
    .zen-export-wrapper td, .zen-export-wrapper th { border: 1px solid #444746; padding: 8px 12px; color: #e3e3e3; }
    .zen-export-wrapper th { background-color: #2e2e32; font-weight: 600; }
    .zen-export-wrapper blockquote { border-left: 4px solid #78a9ff; background-color: #1e1e20; margin: 16px 0; padding: 12px 16px; color: #c4c7c5; }
    /* 🎯 본문 내부의 투박한 구분선을 에디터처럼 1px로 얇고 깔끔하게 튜닝 */
    #zen-editor-content hr { border: none !important; border-bottom: 1px solid #444746 !important; margin: 20px 0 !important; }
    
    /* 🎯 HTML 코드 블록 라벨 세팅 */
    .zen-export-wrapper .ql-code-block-container { position: relative !important; background-color: #1e222a !important; border: 1px solid #444746 !important; border-radius: 8px !important; padding: 44px 16px 16px 16px !important; margin: 1rem 0 !important; display: block !important; }
    .zen-export-wrapper .ql-code-block-container select.ql-ui { display: block !important; position: absolute !important; top: 12px !important; left: 16px !important; background: transparent !important; color: #9da5b4 !important; border: none !important; font-size: 12px !important; font-weight: 600 !important; text-transform: uppercase; appearance: none !important; -webkit-appearance: none !important; pointer-events: none !important; }
    .zen-export-wrapper .ql-code-block-container::before { content: '' !important; position: absolute !important; top: 38px !important; left: 0 !important; right: 0 !important; height: 1px !important; background-color: rgba(255, 255, 255, 0.08) !important; display: block !important; pointer-events: none !important; }
    
    /* 🎨 [고정밀 팔레트 확장] 기획자님의 main.css에서 직접 추출해 온 진짜 다크 테마 */
    .zen-export-wrapper .ql-code-block { background-color: transparent !important; color: #abb2bf !important; font-family: 'D2Coding', 'Fira Code', 'Consolas', monospace !important; font-size: 14px !important; line-height: 1.6 !important; white-space: pre-wrap !important; }
    .zen-export-wrapper .hljs-comment, .zen-export-wrapper .hljs-quote { color: #7f848e !important; font-style: italic; }
    .zen-export-wrapper .hljs-operator, .zen-export-wrapper .hljs-punctuation { color: #abb2bf !important; }
    .zen-export-wrapper .hljs-keyword, .zen-export-wrapper .hljs-selector-tag, .zen-export-wrapper .hljs-doctag, .zen-export-wrapper .hljs-meta, .zen-export-wrapper .hljs-meta .hljs-keyword, .zen-export-wrapper .hljs-preprocess { color: #c678dd !important; font-weight: 600; }
    .zen-export-wrapper .hljs-function, .zen-export-wrapper .hljs-title, .zen-export-wrapper .hljs-title.class_, .zen-export-wrapper .hljs-title.function_, .zen-export-wrapper .hljs-bullet, .zen-export-wrapper .hljs-symbol, .zen-export-wrapper .hljs-link { color: #61afef !important; }
    .zen-export-wrapper .hljs-string, .zen-export-wrapper .hljs-regexp, .zen-export-wrapper .hljs-meta .hljs-string, .zen-export-wrapper .hljs-addition { color: #98c379 !important; }
    .zen-export-wrapper .hljs-number, .zen-export-wrapper .hljs-literal, .zen-export-wrapper .hljs-constant, .zen-export-wrapper .hljs-type, .zen-export-wrapper .hljs-built_in { color: #d19a66 !important; }
    .zen-export-wrapper .hljs-name, .zen-export-wrapper .hljs-tag, .zen-export-wrapper .hljs-selector-id, .zen-export-wrapper .hljs-selector-class, .zen-export-wrapper .hljs-section, .zen-export-wrapper .hljs-deletion { color: #e06c75 !important; }
    .zen-export-wrapper .hljs-attr, .zen-export-wrapper .hljs-attribute, .zen-export-wrapper .hljs-params, .zen-export-wrapper .hljs-variable, .zen-export-wrapper .hljs-template-variable { color: #56b6c2 !important; }
    .zen-export-wrapper .hljs-strong { font-weight: bold; }
    .zen-export-wrapper .hljs-emphasis { font-style: italic; }
    .zen-export-wrapper .hljs-deletion { background-color: rgba(224, 108, 117, 0.15) !important; }
    .zen-export-wrapper .hljs-addition { background-color: rgba(152, 195, 121, 0.15) !important; }
    .zen-export-wrapper .ql-strike-line-true { color: #6b7280; text-decoration: line-through; }
    .zen-export-wrapper a { color: #78a9ff; text-decoration: underline; }
    
    .zen-export-wrapper img { max-width: 100%; height: auto; }

    /* -------------------------------------------------------------------------
       🖨️ 2. HTML 브라우저 인쇄용 (@media print) - 컬러 보존 & 라이트 전환
    ------------------------------------------------------------------------- */
    @media print {
        html, body { height: auto !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
        body.zen-export-wrapper, .zen-export-wrapper { background: #ffffff !important; color: #000000 !important; padding: 0 !important; }
        .zen-export-wrapper h1, .zen-export-wrapper p, .zen-export-wrapper li { color: #000000 !important; }
        .zen-export-wrapper hr { border-bottom-color: #000000 !important; }
        .zen-export-wrapper .ql-code-block-container { background-color: #f5f5f5 !important; border-color: #e0e0e0 !important; }
        .zen-export-wrapper .ql-code-block-container select.ql-ui { color: #666666 !important; }
        .zen-export-wrapper .ql-code-block-container::before { background-color: #e0e0e0 !important; }

        /* 종이 인쇄용 라이트 컬러 팔레트 */
        .zen-export-wrapper .ql-code-block { color: #333333 !important; }
        .zen-export-wrapper .hljs-comment, .zen-export-wrapper .hljs-quote { color: #6a737d !important; }
        .zen-export-wrapper .hljs-keyword, .zen-export-wrapper .hljs-selector-tag, .zen-export-wrapper .hljs-type { color: #d73a49 !important; }
        .zen-export-wrapper .hljs-title, .zen-export-wrapper .hljs-title.function_, .zen-export-wrapper .hljs-function { color: #005cc5 !important; }
        .zen-export-wrapper .hljs-name, .zen-export-wrapper .hljs-section, .zen-export-wrapper .hljs-tag { color: #22863a !important; }
        .zen-export-wrapper .hljs-attr, .zen-export-wrapper .hljs-attribute, .zen-export-wrapper .hljs-params { color: #e36209 !important; }
        .zen-export-wrapper .hljs-string, .zen-export-wrapper .hljs-regexp { color: #032f62 !important; }
        .zen-export-wrapper .hljs-number, .zen-export-wrapper .hljs-literal, .zen-export-wrapper .hljs-variable { color: #005cc5 !important; }
        .zen-export-wrapper .hljs-built_in, .zen-export-wrapper .hljs-class { color: #e36209 !important; }
        .zen-export-wrapper table, .zen-export-wrapper th, .zen-export-wrapper td { border-color: #cccccc !important; }
        .zen-export-wrapper th { background-color: #f5f5f5 !important; color: #000000 !important; }
        .zen-export-wrapper blockquote { background-color: #f9f9f9 !important; color: #333333 !important; }
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

function exportHTML() {
  closeAllPanelsMobile();
  setTimeout(() => {
    // 🎯 여백 축소(margin-bottom: 4px) & 구분선(2px solid #444746) & 드롭다운 상태 캡처
    // 💡 변경점: div 태그 안에 class="ql-editor" 와 style="padding: 0;" 을 추가했습니다.
    const htmlContent = `<html><head><meta charset="UTF-8">${exportThemeCSS_Dark}</head><body class="zen-export-wrapper" style="padding: 40px; background-color: #131314;"><div style="max-width: 800px; margin: 0 auto;"><h1 style="color: #e3e3e3; margin-bottom: 4px;">${getTitle()}</h1><hr style="border: none; border-bottom: 2px solid #444746; margin: 0 0 24px 0;"><div id="zen-editor-content" class="ql-editor" style="padding: 0;">${getHtmlWithSelectState()}</div></div></body></html>`;

    saveAs(
      new Blob([htmlContent], { type: "text/html;charset=utf-8" }),
      `${getTitle()}.html`,
    );
    showToast("HTML 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
  }, 300);
}

// 🎯 PDF는 굽는 데 시간이 걸리므로 진행 중 알림과 완료 알림을 따로 띄움
function exportPDF() {
  // 🎯 1. PDF 굽기 직전: 다이어트 모드 ON (여백 쫙 빼기)
  document.body.classList.add('is-pdf-exporting');
  closeAllPanelsMobile();
  showToast("PDF 변환을 시작합니다...\n(잠시만 기다려주세요)");

  setTimeout(() => {
    const printContainer = document.createElement("div");
    const t = document.getElementById("memo-title-input").value || "제목 없는 노트";

    // 🎯 드롭다운 상태 캡처 적용!
    const c = getHtmlWithSelectState();

    // 🎯 여백 축소(margin-bottom: 4px) & 구분선(2px solid #444746)
    printContainer.innerHTML = `
        ${exportThemeCSS_Light}
        <div class="zen-export-wrapper" style="padding: 20px; background-color: #ffffff;">
            <div style="max-width: 800px; margin: 0 auto;">
                <div style="font-size: 32px; font-weight: 700; color: black; margin-bottom: 4px; letter-spacing: -0.5px;">${t}</div>
                <hr style="border: none; border-bottom: 2px solid #444746; margin: 0 0 24px 0;">
                <div class="ql-snow">
                    <div class="ql-editor" style="padding: 0; color: black; overflow: visible; height: auto;">${c}</div>
                </div>
            </div>
        </div>`;

    html2pdf()
      .set({
        margin: 10,
        filename: `${getTitle()}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(printContainer)
      .save()
      .then(() => {
        showToast("PDF 파일 저장이 완료되었습니다.");
      });
  }, 300);

  // 🎯 2. PDF 생성이 완료된 후: 다이어트 모드 OFF (다시 화면 원복)
  // 주의: html2pdf 같은 라이브러리를 쓰신다면, .then() 안이나 setTimeout을 이용해 
  // PDF가 완전히 구워진 '직후'에 클래스를 빼주셔야 화면이 정상으로 돌아옵니다.
  setTimeout(() => {
    document.body.classList.remove('is-pdf-exporting');
  }, 1000); // PDF 생성에 걸리는 시간 고려 (필요시 조절)
}

function exportTXT() {
  closeAllPanelsMobile();
  setTimeout(() => {
    saveAs(
      new Blob([quill.getText()], { type: "text/plain" }),
      `${getTitle()}.txt`,
    );
    showToast("TXT 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
  }, 300);
}

function exportJSON() {
  closeAllPanelsMobile();
  setTimeout(() => {
    saveAs(
      new Blob(
        [
          JSON.stringify({
            type: "ZenMemo",
            title: getTitle(),
            content: quill.root.innerHTML,
            plainText: quill.getText(),
            updatedAt: Date.now(),
          }),
        ],
        { type: "application/json" },
      ),
      `${getTitle()}.json`,
    );
    showToast("JSON 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
  }, 300);
}

// 🎯 인쇄하기도 화면이 멈추지 않도록 시간차 적용
function handlePrint() {
  closeAllPanelsMobile();
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
          new Blob([JSON.stringify({ type: "ZenBackup", data: activeMemos })], {
            type: "application/json",
          }),
          `Zen_Backup_${Date.now()}.json`,
        );
        showToast("전체 백업 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
      };
  }, 300);
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

  // 🎯 --- [Case 2] PDF 파일 처리 엔진 (스냅샷 추출 및 최적화) ---
  if (isPdf) {
    createNewMemo();
    isLoading = false;

    const titleInput = document.getElementById("memo-title-input");
    if (titleInput) titleInput.value = file.name.replace(/\.[^/.]+$/, "");

    showToast("A4 기준 약 30페지만 불러올 수 있습니다.");
    setTimeout(() => {
      showToast("PDF 문서를 해독하고 있습니다... (잠시만 기다려주세요)");
    }, 500);

    const reader = new FileReader();
    reader.onload = async function () {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const totalPages = pdf.numPages;

        const limitPages = Math.min(totalPages, 30);
        if (totalPages > 30) {
          alert(`안정적인 저장을 위해 처음 ${limitPages}장만 가져옵니다. (원본: ${totalPages}장)`);
        }

        quill.focus();

        for (let pageNum = 1; pageNum <= limitPages; pageNum++) {
          showToast(`PDF 변환 중... (${pageNum} / ${limitPages}장)`);

          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = { canvasContext: ctx, viewport: viewport };
          await page.render(renderContext).promise;

          const base64Img = canvas.toDataURL("image/jpeg", 0.8);
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, "image", base64Img);
          quill.insertText(range.index + 1, "\n\n");
          quill.setSelection(range.index + 3);

          canvas.width = 0;
          canvas.height = 0;
        }
        await executeSave();
        showToast("✅ PDF 변환 및 저장이 완료되었습니다!");
      } catch (err) {
        console.error("PDF 파싱 에러:", err);
        alert("PDF 변환 중 오류가 발생했습니다.");
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
            });
          };
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
    // 🎯 📌 C. TXT 및 마크다운(MD) 파일 (먹통 현상 완벽 복구)
    else if (fileExt === "txt" || fileExt === "md") {
      createNewMemo();
      isLoading = false;
      document.getElementById("memo-title-input").value = fileName.replace(/\.(txt|md)$/i, "");
      quill.setText(fileContent); // 일반 텍스트로 주입
      executeSave();
      showToast(`${fileExt.toUpperCase()} 문서를 불러왔습니다.`);
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
