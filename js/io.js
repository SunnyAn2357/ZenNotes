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
    // 6. 목록 (ul, ol)
    else if (tag === "ul" || tag === "ol") {
      const listItems = el.querySelectorAll("li");
      listItems.forEach((li, idx) => {
        const itemText = convertInline(li).trim();
        const listType = li.getAttribute("data-list");
        if (listType === "checked") {
          lines.push(`- [x] ${itemText}`);
        } else if (listType === "unchecked") {
          lines.push(`- [ ] ${itemText}`);
        } else if (tag === "ol" || listType === "ordered") {
          lines.push(`${idx + 1}. ${itemText}`);
        } else {
          lines.push(`- ${itemText}`);
        }
      });
    }
    // 7. Quill 단독 li 요소
    else if (tag === "li") {
      const itemText = convertInline(el).trim();
      const listType = el.getAttribute("data-list");
      if (listType === "checked") {
        lines.push(`- [x] ${itemText}`);
      } else if (listType === "unchecked") {
        lines.push(`- [ ] ${itemText}`);
      } else if (listType === "ordered") {
        lines.push(`1. ${itemText}`);
      } else {
        lines.push(`- ${itemText}`);
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
function exportMD() {
  closeAllPanelsMobile();
  setTimeout(() => {
    const mdContent = convertQuillToMarkdown();
    saveAs(
      new Blob([mdContent], { type: "text/markdown;charset=utf-8" }),
      `${getTitle()}.md`,
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
    // 5. 밑줄: __text__
    s = s.replace(/__(.+?)__/g, '<u>$1</u>');
    // 6. 취소선: ~~text~~
    s = s.replace(/~~(.+?)~~/g, '<s>$1</s>');
    // 7. 기울임꼴: *text* 또는 _text_
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/_([^_]+)_/g, '<em>$1</em>');

    // 이스케이프된 파이프 문자 원복
    s = s.replace(/\\\|/g, "|");

    return s;
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

    // E. 체크리스트 (- [ ] 또는 - [x] 또는 * [ ])
    if (/^(\*|-)\s+\[([ xX])\]\s+(.*)$/.test(line)) {
      while (i < lines.length && /^(\*|-)\s+\[([ xX])\]\s+(.*)$/.test(lines[i])) {
        const cm = lines[i].match(/^(\*|-)\s+\[([ xX])\]\s+(.*)$/);
        const isChecked = cm[2].toLowerCase() === "x";
        const text = parseInline(cm[3]);
        htmlParts.push(
          `<li data-list="${isChecked ? "checked" : "unchecked"}">${text || "<br>"}</li>`
        );
        i++;
      }
      continue;
    }

    // F. 번호 매기기 목록 (1. text)
    if (/^\d+\.\s+(.*)$/.test(line)) {
      while (i < lines.length && /^\d+\.\s+(.*)$/.test(lines[i])) {
        const om = lines[i].match(/^\d+\.\s+(.*)$/);
        const text = parseInline(om[1]);
        htmlParts.push(`<li data-list="ordered">${text || "<br>"}</li>`);
        i++;
      }
      continue;
    }

    // G. 글머리 기호 목록 (* text 또는 - text)
    if (/^(\*|-)\s+(.*)$/.test(line)) {
      while (
        i < lines.length &&
        /^(\*|-)\s+(.*)$/.test(lines[i]) &&
        !/^(\*|-)\s+\[([ xX])\]/.test(lines[i])
      ) {
        const bm = lines[i].match(/^(\*|-)\s+(.*)$/);
        const text = parseInline(bm[2]);
        htmlParts.push(`<li data-list="bullet">${text || "<br>"}</li>`);
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

// 🎯 [V3.3.2] PDF 단일 페이지 Canvas 렌더링 헬퍼 (초고화질 Scale 2.0, JPEG 95%)
async function renderPdfPageToBase64(pdf, pageNum) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 2.0 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.height = viewport.height;
  canvas.width = viewport.width;

  const renderContext = { canvasContext: ctx, viewport: viewport };
  await page.render(renderContext).promise;

  const base64Img = canvas.toDataURL("image/jpeg", 0.95);
  canvas.width = 0;
  canvas.height = 0;
  return base64Img;
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
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const totalPages = pdf.numPages;
        const baseTitle = file.name.replace(/\.[^/.]+$/, "");

        // 🎯 1. 30페이지 이하인 경우: 바로 전체 변환하여 새 노트 작성
        if (totalPages <= 30) {
          createNewMemo();
          isLoading = false;

          const titleInput = document.getElementById("memo-title-input");
          if (titleInput) titleInput.value = baseTitle;

          quill.focus();
          for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            showToast(`PDF 변환 중... (${pageNum} / ${totalPages}장)`);
            const base64Img = await renderPdfPageToBase64(pdf, pageNum);
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, "image", base64Img);
            quill.insertText(range.index + 1, "\n\n");
            quill.setSelection(range.index + 3);
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
          const range = quill.getSelection(true);
          quill.insertEmbed(range.index, "image", base64Img);
          quill.insertText(range.index + 1, "\n\n");
          quill.setSelection(range.index + 3);
        }
        await executeSave();
        showToast(`✅ PDF 변환 및 저장이 완료되었습니다! (${countToLoad}장)`);
      } catch (err) {
        console.error("PDF 파싱 에러:", err);
        alert("PDF 변환 중 오류가 발생했습니다.");
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
              // 🚀 [스파이 추가] 대규모 복원이 끝났으니 클라우드에 싹 다 올려줍니다!
              if (typeof triggerBackgroundSync === 'function') triggerBackgroundSync();
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
    // 🎯 📌 C. 마크다운(MD) 파일: 위지윅 HTML로 완벽 파싱하여 서식/표 복원
    else if (fileExt === "md") {
      createNewMemo();
      isLoading = false;
      document.getElementById("memo-title-input").value = fileName.replace(/\.md$/i, "");
      const parsedHtml = convertMarkdownToHTML(fileContent);
      quill.root.innerHTML = parsedHtml;
      executeSave();
      showToast("마크다운(MD) 문서를 불러왔습니다.");
    }
    // 🎯 📌 D. 일반 텍스트(TXT) 파일
    else if (fileExt === "txt") {
      createNewMemo();
      isLoading = false;
      document.getElementById("memo-title-input").value = fileName.replace(/\.txt$/i, "");
      quill.setText(fileContent); // 일반 텍스트로 주입
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
