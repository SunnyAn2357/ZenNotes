hljs.configure({
  languages: ["javascript", "python", "html", "css", "typescript", "bash"],
});

// Quill 커스텀 포맷 등록 (링크)
const Link = Quill.import("formats/link");
class CustomLink extends Link {
  static create(v) {
    return super.create(
      v && !/^https?:\/\//i.test(v) && !/^mailto:/i.test(v) ? "http://" + v : v,
    );
  }
}
Quill.register(CustomLink, true);

// Quill 커스텀 포맷 등록 (구분선)
const BlockEmbed = Quill.import("blots/block/embed");
class DividerBlot extends BlockEmbed {}
DividerBlot.blotName = "divider";
DividerBlot.tagName = "hr";
Quill.register(DividerBlot);

// Quill 커스텀 포맷 등록 (링크 카드)
class LinkCardBlot extends BlockEmbed {
  static create(data) {
    const node = super.create();
    node.setAttribute("contenteditable", "false");
    node.dataset.url = data.url;
    node.dataset.title = data.title;
    node.dataset.description = data.description;
    node.dataset.image = data.image;

    node.addEventListener("click", () => window.open(data.url, "_blank"));
    node.style.cssText =
      "display: flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin: 16px 0; background: var(--surface); cursor: pointer; transition: background 0.2s;";
    node.onmouseover = () => (node.style.background = "var(--surface-hover)");
    node.onmouseout = () => (node.style.background = "var(--surface)");

    let imgHTML = data.image
      ? `<img src="${data.image}" style="width: 75px; height: 75px; object-fit: cover; border-radius: 6px; margin: 0 16px 0 0; flex-shrink: 0; display: block;" alt="thumbnail">`
      : "";

    node.innerHTML = `
                    ${imgHTML}
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-size: 15px; font-weight: 600; color: var(--text-main); margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.title}</div>
                        <div style="font-size: 13px; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${data.description}</div>
                        <div style="font-size: 11px; color: var(--accent); margin-top: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.url}</div>
                    </div>
                `;
    return node;
  }
  static value(node) {
    return {
      url: node.dataset.url,
      title: node.dataset.title,
      description: node.dataset.description,
      image: node.dataset.image,
    };
  }
}
LinkCardBlot.blotName = "link-card";
LinkCardBlot.tagName = "div";
LinkCardBlot.className = "ql-link-card";
Quill.register(LinkCardBlot);

// Quill 커스텀 포맷 등록 (취소선)
const Parchment = Quill.import("parchment");
const StrikeLineStyle = new Parchment.Attributor.Class(
  "strike-line",
  "ql-strike-line",
  { scope: Parchment.Scope.INLINE },
);
Quill.register(StrikeLineStyle, true);

// 📝 에디터 초기화
const quill = new Quill("#editor", {
  theme: "snow",
  bounds: ".col-center",
  placeholder: "여기에 지식을 기록하세요...",
  modules: {
    syntax: true,
    history: { delay: 1000, maxStack: 100, userOnly: true },
    // 🎯 [신규 장착] 엔터 2번으로 블록을 깔끔하게 탈출하는 키보드 통제 엔진
    keyboard: {
      bindings: {
        // 인용구 탈출
        escapeBlockquote: {
          key: 13, // Enter 키
          empty: true, // 👈 [핵심] '현재 줄이 비어있을 때'만 작동 (즉, 이미 엔터를 한 번 쳐서 빈 줄인 상태)
          format: ["blockquote"], // 인용구 안에서만 발동
          handler: function (range, context) {
            // 현재 줄의 인용구 서식을 강제로 벗겨버립니다.
            this.quill.format("blockquote", false, Quill.sources.USER);
            return false; // 기본 엔터(단순 줄바꿈) 동작은 무시
          },
        },
      },
    },
    toolbar: {
      container: [
        ["undo", "redo"],
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        ["blockquote", "code-block", "divider", "strike-line"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["clean"],
        ["link", "image"],
      ],
      handlers: {
        undo: function () {
          this.quill.history.undo();
        },
        redo: function () {
          this.quill.history.redo();
        },
        image: function () {
          const input = document.createElement("input");
          input.setAttribute("type", "file");
          input.setAttribute("accept", "image/*");
          input.click();
          input.onchange = () => {
            if (input.files[0]) handleImageFiles([input.files[0]]);
          };
        },
        "strike-line": function () {
          const range = this.quill.getSelection();
          if (!range) return;
          const [line, offset] = this.quill.getLine(range.index);
          const lineIndex = this.quill.getIndex(line);
          const lineLength = line.length() - 1;

          const isStruck =
            lineLength === 0
              ? this.quill.getFormat(range)["strike-line"]
              : this.quill.getFormat(lineIndex, 1)["strike-line"];

          if (isStruck) {
            if (lineLength > 0)
              this.quill.formatText(
                lineIndex,
                lineLength,
                "strike-line",
                false,
                Quill.sources.USER,
              );
            this.quill.format("strike-line", false, Quill.sources.USER);
          } else {
            if (lineLength > 0) {
              this.quill.formatText(
                lineIndex,
                lineLength,
                "strike-line",
                true,
                Quill.sources.USER,
              );
              const lineEnd = lineIndex + lineLength;
              this.quill.insertText(lineEnd, "\u200B", Quill.sources.USER);
              this.quill.setSelection(lineEnd + 1, Quill.sources.SILENT);
              this.quill.format("strike-line", false, Quill.sources.USER);
            } else {
              this.quill.format("strike-line", true, Quill.sources.USER);
            }
          }
        },
        divider: function () {
          const range = this.quill.getSelection(true);
          const [line, offset] = this.quill.getLine(range.index);
          const isLineEmpty = line.length() <= 1;

          this.quill.insertEmbed(
            range.index,
            "divider",
            true,
            Quill.sources.USER,
          );
          let nextIndex = range.index + 1;

          if (isLineEmpty) {
            this.quill.deleteText(nextIndex, 1, Quill.sources.USER);
          }
          const length = this.quill.getLength();
          if (nextIndex >= length - 1) {
            this.quill.insertText(nextIndex, "\n", Quill.sources.USER);
          }

          this.quill.setSelection(nextIndex, Quill.sources.SILENT);
          this.quill.removeFormat(nextIndex, 1, Quill.sources.USER);
        },
      },
    },
  },
});

// 클립보드 붙여넣기 제어
quill.root.addEventListener(
  "paste",
  function (e) {
    const clipboard = e.clipboardData || window.clipboardData;
    if (!clipboard || !clipboard.files.length) return;
    const hasImageFile = Array.from(clipboard.files).some((file) =>
      file.type.startsWith("image/"),
    );

    if (hasImageFile) {
      e.preventDefault();
      e.stopImmediatePropagation();
      Array.from(clipboard.files).forEach((file) => {
        if (file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const range = quill.getSelection(true);
            const index = range ? range.index : 0;
            quill.insertEmbed(index, "image", event.target.result, "user");
          };
          reader.readAsDataURL(file);
        }
      });
    }
  },
  true,
);

// K-마크다운 엔진 (문자 입력 감지)
quill.on("text-change", function (delta, oldDelta, source) {
  if (source !== "user") return;
  const ops = delta.ops;
  if (!ops || ops.length < 2) return;
  const lastOp = ops[ops.length - 1];

  if (lastOp.insert === " ") {
    const range = quill.getSelection();
    if (!range) return;
    const [line, offset] = quill.getLine(range.index);
    if (!line || !line.domNode) return;
    const text = line.domNode.textContent.substring(0, offset);
    const lineStart = quill.getIndex(line);

    const blockMatch = text.match(/^(#{1,3}|>|\*|-|1\.|\-{3}|`{3})\s$/);
    if (blockMatch) {
      const prefix = blockMatch[1];
      const deleteLength = prefix.length + 1;
      const formatIndex = range.index - deleteLength;

      quill.deleteText(formatIndex, deleteLength, Quill.sources.USER);

      if (prefix === "#")
        quill.formatLine(formatIndex, 1, "header", 1, Quill.sources.USER);
      else if (prefix === "##")
        quill.formatLine(formatIndex, 1, "header", 2, Quill.sources.USER);
      else if (prefix === "###")
        quill.formatLine(formatIndex, 1, "header", 3, Quill.sources.USER);
      else if (prefix === ">")
        quill.formatLine(
          formatIndex,
          1,
          "blockquote",
          true,
          Quill.sources.USER,
        );
      else if (prefix === "*" || prefix === "-")
        quill.formatLine(formatIndex, 1, "list", "bullet", Quill.sources.USER);
      else if (prefix === "1.")
        quill.formatLine(formatIndex, 1, "list", "ordered", Quill.sources.USER);
      else if (prefix === "---") {
        quill.insertEmbed(formatIndex, "divider", true, Quill.sources.USER);
        quill.setSelection(formatIndex + 1, Quill.sources.SILENT);
        quill.removeFormat(formatIndex + 1, 1, Quill.sources.USER);
      } else if (prefix === "```")
        quill.formatLine(
          formatIndex,
          1,
          "code-block",
          true,
          Quill.sources.USER,
        );
      return;
    }

    const fullText = quill.getText(lineStart, offset);
    function applyInlineFormat(matchText, content, formatName) {
      const start = lineStart + offset - matchText.length;
      const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(content);
      setTimeout(() => {
        quill.deleteText(start, matchText.length, Quill.sources.USER);
        quill.insertText(
          start,
          content,
          { [formatName]: true },
          Quill.sources.USER,
        );
        if (hasKorean) {
          quill.insertText(
            start + content.length,
            "\u200B",
            { [formatName]: false },
            Quill.sources.USER,
          );
          const newCursorPos = start + content.length + 1;
          quill.setSelection(newCursorPos, Quill.sources.SILENT);
          quill.format(formatName, false, Quill.sources.USER);
        } else {
          quill.insertText(
            start + content.length,
            " ",
            { [formatName]: false },
            Quill.sources.USER,
          );
          const newCursorPos = start + content.length + 1;
          quill.setSelection(newCursorPos, Quill.sources.SILENT);
        }
      }, 10);
    }

    const boldMatch = fullText.match(/\*\*(.+?)\*\* $/);
    if (boldMatch) {
      applyInlineFormat(boldMatch[0], boldMatch[1], "bold");
      return;
    }
    const strikeMatch = fullText.match(/~~(.+?)~~ $/);
    if (strikeMatch) {
      applyInlineFormat(strikeMatch[0], strikeMatch[1], "strike");
      return;
    }
    const underMatch = fullText.match(/__(.+?)__ $/);
    if (underMatch) {
      applyInlineFormat(underMatch[0], underMatch[1], "underline");
      return;
    }
    const italicMatch = fullText.match(/(\*|_)(.+?)\1 $/);
    if (italicMatch) {
      applyInlineFormat(italicMatch[0], italicMatch[2], "italic");
      return;
    }
  }
});

// 모바일 툴바 잘림 방지 (옵저버)
const toolbarElement = document.querySelector(".ql-toolbar.ql-snow");
const headerPicker = document.querySelector(".ql-header.ql-picker");
if (headerPicker && toolbarElement) {
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.attributeName === "class") {
        if (window.innerWidth <= 768) {
          if (headerPicker.classList.contains("ql-expanded")) {
            toolbarElement.classList.add("ql-toolbar-dropdown-open");
          } else {
            toolbarElement.classList.remove("ql-toolbar-dropdown-open");
          }
        }
      }
    });
  });
  observer.observe(headerPicker, { attributes: true });
}

// 이미지 파일 삽입 제어기
const handleImageFiles = (files) => {
  Array.from(files).forEach((file) => {
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const range = quill.getSelection(true);
        quill.insertEmbed(range.index, "image", e.target.result, "user");
        quill.insertText(range.index + 1, "\n", "user");
        quill.setSelection(range.index + 1, Quill.sources.SILENT);
        if (typeof triggerAutoSave === "function") triggerAutoSave();
      };
      reader.readAsDataURL(file);
    }
  });
};

["dragover", "drop"].forEach((ev) => {
  quill.root.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
});
quill.root.addEventListener("drop", (e) => {
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    handleImageFiles(e.dataTransfer.files);
  }
});

// Tab 키 동작 방어
document.getElementById("memo-title-input").addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    quill.focus();
  }
});

// 커스텀 툴바 아이콘 삽입
const dividerBtn = document.querySelector(".ql-divider");
if (dividerBtn) {
  dividerBtn.innerHTML =
    '<i class="fa-solid fa-minus" style="font-size: 14px; color: var(--text-muted);"></i>';
}
const undoBtn = document.querySelector(".ql-undo");
if (undoBtn) {
  undoBtn.innerHTML =
    '<i class="fa-solid fa-rotate-left" style="font-size: 14px; color: var(--text-muted);"></i>';
}
const redoBtn = document.querySelector(".ql-redo");
if (redoBtn) {
  redoBtn.innerHTML =
    '<i class="fa-solid fa-rotate-right" style="font-size: 14px; color: var(--text-muted);"></i>';
}
const strikeLineBtn = document.querySelector(".ql-strike-line");
if (strikeLineBtn) {
  strikeLineBtn.innerHTML =
    '<i class="fa-solid fa-square-check" style="font-size: 14px; color: var(--text-muted);"></i>';
  strikeLineBtn.title = "완료 표시 (줄 전체 취소선)";
}

// 여백 클릭 시 에디터 포커스
document.querySelector(".col-center").addEventListener("click", (e) => {
  if (
    !e.target.closest(".editor-header") &&
    !e.target.closest(".ql-toolbar") &&
    !e.target.closest(".ql-editor") &&
    !e.target.closest(".file-manager-pane")
  ) {
    quill.focus();
  }
});

// 모바일 키보드 방어막 (블록 선택 시)
quill.on("selection-change", function (range, oldRange, source) {
  if (range) {
    if (range.length > 0) {
      const isKeyboardUp =
        window.visualViewport &&
        window.visualViewport.height < window.screen.height * 0.75;
      if (!isKeyboardUp) {
        quill.root.setAttribute("inputmode", "none");
      }
    } else {
      quill.root.removeAttribute("inputmode");
    }
  }
});

// 타이핑 시 자동 저장 트리거
quill.on("text-change", (delta, old, source) => {
  if (source === "user" && typeof triggerAutoSave === "function")
    triggerAutoSave();
});
document.getElementById("memo-title-input").addEventListener("input", () => {
  if (typeof triggerAutoSave === "function") triggerAutoSave();
});

// 검색창 이벤트 전파 차단
const fmSearchInput = document.getElementById("fm-search-input");
if (fmSearchInput) {
  ["keydown", "keyup", "keypress"].forEach((evName) => {
    fmSearchInput.addEventListener(evName, (e) => e.stopPropagation());
  });
}

let lastSelection = null;
quill.on("selection-change", (range) => {
  if (range) lastSelection = range;
});

// 🎯 [안전장치] 분리된 다른 js 파일들에서 에디터를 읽고 쓸 수 있도록 전역으로 열어줍니다.
window.quill = quill;
