// 🎯 [추가] PDF 및 HTML 내보내기용 공통 화이트 테마 CSS (앱 디자인과 완벽 분리)
const exportThemeCSS = `
<style>
    .zen-export-wrapper { background: #ffffff; color: #000000; font-family: 'Pretendard', -apple-system, sans-serif; line-height: 1.65; word-break: keep-all; overflow-wrap: break-word; }
    .zen-export-wrapper p, .zen-export-wrapper h1, .zen-export-wrapper h2, .zen-export-wrapper h3, .zen-export-wrapper li { margin-bottom: 8px; }
    .zen-export-wrapper ul, .zen-export-wrapper ol { margin-bottom: 20px; }
    .zen-export-wrapper table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #cccccc; }
    .zen-export-wrapper td, .zen-export-wrapper th { border: 1px solid #cccccc; padding: 8px 12px; color: #000000; }
    .zen-export-wrapper th { background-color: #f5f5f5; font-weight: 600; }
    .zen-export-wrapper blockquote { border-left: 4px solid #78a9ff; background-color: #f9f9f9; margin: 16px 0; padding: 12px 16px; color: #333333; }
    .zen-export-wrapper .ql-code-block-container { position: relative; background-color: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1rem; margin: 1rem 0; white-space: pre-wrap; word-break: break-all; }
    .zen-export-wrapper .ql-code-block-container select.ql-ui,
    .zen-export-wrapper .ql-code-block-container .ql-ui { display: none !important;}
    .zen-export-wrapper .ql-code-block { background-color: transparent; color: #333333; white-space: pre-wrap; }
    .zen-export-wrapper .ql-strike-line-true { color: #999999; text-decoration: line-through; }
    .zen-export-wrapper a { color: #2563eb; text-decoration: underline; }
    .zen-export-wrapper img { max-width: 100%; height: auto; }
</style>
`;

const getTitle = () =>
  document.getElementById("memo-title-input").value || "Untitled";

// 🎯 공통: 패널을 스르륵 닫은 뒤, 0.3초 여유를 주고 무거운 작업을 실행하여 화면 멈춤(프리징) 방지
function exportHTML() {
  closeAllPanelsMobile();
  setTimeout(() => {
    // 🎯 exportThemeCSS 주입 및 브라우저에서 보기 좋게 중앙 정렬 레이아웃 적용
    const htmlContent = `<html><head><meta charset="UTF-8">${exportThemeCSS}</head><body class="zen-export-wrapper" style="padding: 40px;"><div style="max-width: 800px; margin: 0 auto;"><h1>${getTitle()}</h1><hr style="border: none; border-bottom: 1px solid #d4d4d4; margin: 0 0 20px 0;"><div id="zen-editor-content">${quill.root.innerHTML}</div></div></body></html>`;

    saveAs(
      new Blob([htmlContent], { type: "text/html;charset=utf-8" }),
      `${getTitle()}.html`,
    );
    showToast("HTML 파일이 저장되었습니다.\n(기기 다운로드 폴더 확인)");
  }, 300);
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

// 🎯 PDF는 굽는 데 시간이 걸리므로 진행 중 알림과 완료 알림을 따로 띄움
function exportPDF() {
  closeAllPanelsMobile();
  showToast("PDF 변환을 시작합니다...\n(잠시만 기다려주세요)");

  setTimeout(() => {
    const printContainer = document.createElement("div");
    const t = document.getElementById("memo-title-input").value || "제목 없는 노트";
    const c = quill.root.innerHTML;

    // 🎯 exportThemeCSS 주입 및 zen-export-wrapper 클래스 적용으로 완벽 싱크로율 달성
    printContainer.innerHTML = `
        ${exportThemeCSS}
        <div class="zen-export-wrapper" style="padding: 20px;">
            <div style="max-width: 800px; margin: 0 auto;">
                <div style="font-size: 32px; font-weight: 700; color: black; margin-bottom: 20px; letter-spacing: -0.5px;">${t}</div>
                <hr style="border: none; border-bottom: 1px solid #d4d4d4; margin: 0 0 20px 0;">
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
}

// 🎯 인쇄하기도 화면이 멈추지 않도록 시간차 적용
function handlePrint() {
  closeAllPanelsMobile();
  setTimeout(() => {
    window.print();
  }, 300);
}

// 🎯 [올인원 수입 엔진] 파일 하나로 모든 형식을 판단하여 처리합니다.
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
