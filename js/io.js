const getTitle = () =>
  document.getElementById("memo-title-input").value || "Untitled";

// 🎯 공통: 패널을 스르륵 닫은 뒤, 0.3초 여유를 주고 무거운 작업을 실행하여 화면 멈춤(프리징) 방지
function exportHTML() {
  closeAllPanelsMobile();
  setTimeout(() => {
    // 🎯 오직 한글 깨짐 방지용 <meta charset="UTF-8">만 최소한으로 추가
    const htmlContent = `<html><head><meta charset="UTF-8"></head><body><h1>${getTitle()}</h1><hr>${quill.root.innerHTML}</body></html>`;

    // Blob 타입에도 charset 명시
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
  showToast("PDF 변환을 시작합니다...\n(잠시만 기다려주세요)"); // 시작 알림

  setTimeout(() => {
    const printContainer = document.createElement("div");
    const t =
      document.getElementById("memo-title-input").value || "제목 없는 노트";
    const c = quill.root.innerHTML;

    printContainer.innerHTML = `
                    <div style="background: white; color: black; padding: 20px; font-family: 'Pretendard', -apple-system, sans-serif;">
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
        showToast("PDF 파일 저장이 완료되었습니다."); // 👈 완료 알림 (Promise then 사용)
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

// 단일 메모 및 전체 저장 복구 로직 완벽 통합 + 영리한 중복 방지
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

  // 🎯 --- [Case 2] PDF 파일 처리 엔진 (스냅샷 추출 및 최적화)
  if (file.type === "application/pdf") {
    // 🎯 [완벽 해결] 기획자님의 만능 함수로 기존 문서 덮어쓰기 원천 차단!
    createNewMemo();
    isLoading = false; // 에디터 잠금 해제

    // 파일명을 새 노트의 제목으로 자동 세팅 (확장자 제거)
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

        // 🎯 30장으로 상향 조정
        const limitPages = Math.min(totalPages, 30);
        if (totalPages > 30) {
          alert(
            `안정적인 저장을 위해 처음 ${limitPages}장만 가져옵니다. (원본: ${totalPages}장)`,
          );
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

        // 🎯 [핵심 추가] 변환 완료 후 DB에 즉시 강제 저장
        // 이 코드가 실행되어야 목록에 즉시 나타납니다.
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

    // 📌 A. 기존 로직 완벽 보존: JSON 전체 백업 및 단일 노트 불러오기
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
                (existing) =>
                  existing.title === m.title && existing.content === m.content,
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
            // 🎯 자가 치유 엔진 유지
            healDatabase(() => {
              loadMemoList();
              alert(
                `복원이 완료되었습니다.\n(복원노트: ${restoredCount}개 / 중복제외: ${skippedCount}개)`,
              );
            });
          };
        } else if (parsed.type === "ZenMemo") {
          createNewMemo();
          isLoading = false;
          document.getElementById("memo-title-input").value =
            parsed.title || fileName.replace(/\.[^/.]+$/, "");
          quill.root.innerHTML = parsed.content || "";
          executeSave();
        } else {
          alert("지원하지 않는 JSON 형식입니다.");
        }
      } catch (err) {
        alert("파일 읽기 오류가 발생했습니다.");
      }
    }
    // 📌 B. HTML 파일: 서식을 유지하며 새 노트로 생성
    else if (fileExt === "html") {
      createNewMemo();
      isLoading = false;
      document.getElementById("memo-title-input").value = fileName.replace(
        ".html",
        "",
      );
      quill.root.innerHTML = fileContent; // HTML 서식 그대로 주입
      executeSave();
      showToast("HTML 파일을 새 노트로 불러왔습니다.");
    }
    // 📌 C. TXT 및 마크다운(MD) 파일
    else if (fileExt === "txt" || fileExt === "md") {
      createNewMemo();
      isLoading = false;
      document.getElementById("memo-title-input").value = fileName.replace(
        /\.(txt|md)$/i,
        "",
      );
      quill.setText(fileContent); // 일반 텍스트로 주입
      executeSave();
      showToast("텍스트 문서를 불러왔습니다.");
    }
    e.target.value = "";
  };

  // 텍스트 기반 파일 읽기 실행
  if (
    fileExt === "json" ||
    fileExt === "txt" ||
    fileExt === "html" ||
    fileExt === "md"
  ) {
    reader.readAsText(file);
  } else if (!isImage && !isPdf) {
    // 그 외 알 수 없는 파일일 경우
    alert("지원하지 않는 파일 형식입니다.");
    e.target.value = "";
  }
}
