






hljs.configure({ languages: ['javascript', 'python', 'html', 'css', 'typescript', 'bash'] });

const Link = Quill.import('formats/link');
class CustomLink extends Link {
    static create(v) {
        return super.create(v && !/^https?:\/\//i.test(v) && !/^mailto:/i.test(v) ? 'http://' + v : v);
    }
}
Quill.register(CustomLink, true);

const BlockEmbed = Quill.import('blots/block/embed');
class DividerBlot extends BlockEmbed { }
DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';
Quill.register(DividerBlot);

// 🎯 [추가] 노션 스타일의 '링크 카드' 커스텀 블록 등록
class LinkCardBlot extends BlockEmbed {
    static create(data) {
        const node = super.create();
        node.setAttribute('contenteditable', 'false'); // 카드 안쪽은 타이핑 방지
        node.dataset.url = data.url;
        node.dataset.title = data.title;
        node.dataset.description = data.description;
        node.dataset.image = data.image;

        // 클릭 시 새 창으로 열리게 설정
        node.addEventListener('click', () => window.open(data.url, '_blank'));

        // 카드의 예쁜 CSS 디자인 (다크 테마에 찰떡같이 맞춤)
        node.style.cssText = 'display: flex; align-items: center; border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin: 16px 0; background: var(--surface); cursor: pointer; transition: background 0.2s;';
        node.onmouseover = () => node.style.background = 'var(--surface-hover)';
        node.onmouseout = () => node.style.background = 'var(--surface)';

        let imgHTML = data.image ? `<img src="${data.image}" style="width: 75px; height: 75px; object-fit: cover; border-radius: 6px; margin: 0 16px 0 0; flex-shrink: 0; display: block;" alt="thumbnail">` : '';

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
            image: node.dataset.image
        };
    }
}
LinkCardBlot.blotName = 'link-card';
LinkCardBlot.tagName = 'div';
LinkCardBlot.className = 'ql-link-card';
Quill.register(LinkCardBlot);

// 🎯 [사용자님 통찰력 적용] 취소선 단위를 문단이 아닌 일반 글자(Inline)로 변경!
const Parchment = Quill.import('parchment');
const StrikeLineStyle = new Parchment.Attributor.Class('strike-line', 'ql-strike-line', {
    scope: Parchment.Scope.INLINE // 👈 BLOCK에서 INLINE으로 수정!
});
Quill.register(StrikeLineStyle, true);

// [2] 에디터 본체 설정 (조절 기능 포함)
const quill = new Quill('#editor', {
    theme: 'snow',
    bounds: '.col-center',
    placeholder: '여기에 지식을 기록하세요...',
    modules: {
        syntax: true,
        history: { delay: 1000, maxStack: 100, userOnly: true }, // 🎯 1. 에디터 뇌(기억력) 활성화

        // 🎯 [신규 장착] 엔터 2번으로 블록을 깔끔하게 탈출하는 키보드 통제 엔진
        keyboard: {
            bindings: {
                // 1. 인용구 탈출
                escapeBlockquote: {
                    key: 13, // Enter 키
                    empty: true, // 👈 [핵심] '현재 줄이 비어있을 때'만 작동 (즉, 이미 엔터를 한 번 쳐서 빈 줄인 상태)
                    format: ['blockquote'], // 인용구 안에서만 발동
                    handler: function (range, context) {
                        // 현재 줄의 인용구 서식을 강제로 벗겨버립니다.
                        this.quill.format('blockquote', false, Quill.sources.USER);
                        return false; // 기본 엔터(단순 줄바꿈) 동작은 무시
                    }
                }
            }
        },

        toolbar: {
            container: [
                ['undo', 'redo'], // 🎯 2. 맨 앞줄에 취소/복구 버튼 신설
                // 1. 제목 그룹
                [{ 'header': [1, 2, 3, false] }],
                // 2. 글자 서식 그룹
                ['bold', 'italic', 'underline', 'strike'],
                // 3. 블록 서식 그룹 (인용구, 코드, 구분선, 완료선 추가!)
                ['blockquote', 'code-block', 'divider', 'strike-line'],
                // 4. 리스트 그룹
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                // 5. 서식 지우기
                ['clean'],
                // 6. 미디어 삽입 그룹 (링크, 이미지를 가장 오른쪽으로 독립!)
                ['link', 'image']
            ],
            handlers: {
                // 🎯 3. 취소/복구 버튼 눌렀을 때 작동할 명령 연결
                'undo': function () { this.quill.history.undo(); },
                'redo': function () { this.quill.history.redo(); },
                'image': function () {
                    const input = document.createElement('input');
                    input.setAttribute('type', 'file');
                    input.setAttribute('accept', 'image/*');
                    input.click();
                    input.onchange = () => {
                        if (input.files[0]) handleImageFiles([input.files[0]]);
                    };
                },

                // 🎯 [완벽 교정] 줄 전체 글자(Inline)에 취소선을 긋고 투명 방어막 전개
                'strike-line': function () {
                    const range = this.quill.getSelection();
                    if (!range) return;

                    // 1. 현재 커서가 있는 '줄'의 시작점과 글자수를 알아냅니다.
                    const [line, offset] = this.quill.getLine(range.index);
                    const lineIndex = this.quill.getIndex(line);
                    const lineLength = line.length() - 1; // 엔터 제외

                    // 2. 현재 줄의 첫 글자가 속성을 가졌는지 확인
                    const isStruck = lineLength === 0 ? this.quill.getFormat(range)['strike-line'] : this.quill.getFormat(lineIndex, 1)['strike-line'];

                    if (isStruck) {
                        // 끄기: 줄 전체 글자의 취소선 속성 제거
                        if (lineLength > 0) this.quill.formatText(lineIndex, lineLength, 'strike-line', false, Quill.sources.USER);
                        this.quill.format('strike-line', false, Quill.sources.USER);
                    } else {
                        // 켜기:
                        if (lineLength > 0) {
                            // 1) 글자가 있으면 줄 전체 글자에 속성을 쫙 바르고
                            this.quill.formatText(lineIndex, lineLength, 'strike-line', true, Quill.sources.USER);

                            // 2) 🎯 사용자님의 K-마크다운 방어막 전개!
                            const lineEnd = lineIndex + lineLength;
                            this.quill.insertText(lineEnd, '\u200B', Quill.sources.USER); // 끝에 투명 문자 삽입
                            this.quill.setSelection(lineEnd + 1, Quill.sources.SILENT);   // 그 뒤로 커서 피신
                            this.quill.format('strike-line', false, Quill.sources.USER);  // 서식 강제 해제!
                        } else {
                            // 빈 줄이면 그냥 커서에만 켬
                            this.quill.format('strike-line', true, Quill.sources.USER);
                        }
                    }
                },

                // 🎯 [완벽 교정] 스마트 가로 구분선 (불필요한 줄바꿈 방지)
                'divider': function () {
                    const range = this.quill.getSelection(true);

                    // 1. 현재 커서가 있는 줄이 '빈 줄'인지 확인합니다.
                    const [line, offset] = this.quill.getLine(range.index);
                    const isLineEmpty = line.length() <= 1;

                    // 2. 구분선을 삽입합니다.
                    this.quill.insertEmbed(range.index, 'divider', true, Quill.sources.USER);

                    let nextIndex = range.index + 1;

                    // 3. 빈 줄에 구분선을 넣었을 때 Quill이 오지랖으로 만들어낸 불필요한 \n(엔터) 하나를 강제로 지워버립니다.
                    if (isLineEmpty) {
                        this.quill.deleteText(nextIndex, 1, Quill.sources.USER);
                    }

                    // 4. 불필요한 엔터를 지운 후, 문서의 최신 전체 길이를 측정합니다.
                    const length = this.quill.getLength();

                    // 5. 기획자님 요구사항: "구분선 밑에 아무것도 없을 때(문서 맨 끝일 때)만 강제 줄바꿈 한 줄 추가"
                    if (nextIndex >= length - 1) {
                        this.quill.insertText(nextIndex, '\n', Quill.sources.USER);
                    }

                    // 6. 커서를 구분선 바로 밑으로 부드럽게 이동시킵니다.
                    this.quill.setSelection(nextIndex, Quill.sources.SILENT);
                    this.quill.removeFormat(nextIndex, 1, Quill.sources.USER);
                }
            }
        }
    }
});

// 🎯 [최종보안] 사진이 있으면 HTML은 버리고, '사용자'가 넣은 것으로 간주해 자동 저장 실행!
quill.root.addEventListener('paste', function (e) {
    const clipboard = e.clipboardData || window.clipboardData;
    if (!clipboard || !clipboard.files.length) return;

    const hasImageFile = Array.from(clipboard.files).some(file => file.type.startsWith('image/'));

    if (hasImageFile) {
        e.preventDefault();
        e.stopImmediatePropagation();

        Array.from(clipboard.files).forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = event => {
                    const range = quill.getSelection(true);
                    const index = range ? range.index : 0;
                    quill.insertEmbed(index, 'image', event.target.result, 'user');
                };
                reader.readAsDataURL(file);
            }
        });
    }
}, true);

// 🎯 [Pro 통합 버전] 마크다운 자동 변환 엔진 (밑줄, 취소선, 코드블록 추가)
quill.on('text-change', function (delta, oldDelta, source) {
    if (source !== 'user') return;

    const ops = delta.ops;
    if (!ops || ops.length < 2) return;
    const lastOp = ops[ops.length - 1];

    if (lastOp.insert === ' ') {
        const range = quill.getSelection();
        if (!range) return;

        const [line, offset] = quill.getLine(range.index);
        if (!line || !line.domNode) return;

        const text = line.domNode.textContent.substring(0, offset);
        const lineStart = quill.getIndex(line);

        // --- [A. 블록 포맷 감지: H1-H3, 인용구, 리스트, 구분선, 코드블록] ---
        // 정규식 매칭 ( `{3} 즉, 백틱 3개 조건 추가)
        const blockMatch = text.match(/^(#{1,3}|>|\*|-|1\.|\-{3}|`{3})\s$/);

        if (blockMatch) {
            const prefix = blockMatch[1];
            const deleteLength = prefix.length + 1;
            const formatIndex = range.index - deleteLength;

            quill.deleteText(formatIndex, deleteLength, Quill.sources.USER);

            if (prefix === '#') quill.formatLine(formatIndex, 1, 'header', 1, Quill.sources.USER);
            else if (prefix === '##') quill.formatLine(formatIndex, 1, 'header', 2, Quill.sources.USER);
            else if (prefix === '###') quill.formatLine(formatIndex, 1, 'header', 3, Quill.sources.USER);
            else if (prefix === '>') quill.formatLine(formatIndex, 1, 'blockquote', true, Quill.sources.USER);
            else if (prefix === '*' || prefix === '-') quill.formatLine(formatIndex, 1, 'list', 'bullet', Quill.sources.USER);
            else if (prefix === '1.') quill.formatLine(formatIndex, 1, 'list', 'ordered', Quill.sources.USER);
            else if (prefix === '---') {
                quill.insertEmbed(formatIndex, 'divider', true, Quill.sources.USER);
                quill.setSelection(formatIndex + 1, Quill.sources.SILENT);
                quill.removeFormat(formatIndex + 1, 1, Quill.sources.USER);
            }
            // 🎯 코드블록 추가
            else if (prefix === '```') quill.formatLine(formatIndex, 1, 'code-block', true, Quill.sources.USER);

            return;
        }

        // --- [B. 인라인 포맷 감지: 굵게, 밑줄, 취소선, 기울임] ---
        const fullText = quill.getText(lineStart, offset);

        // 🎯 [K-마크다운 하이브리드 엔진] 스페이스 역주행 및 커서 튕김 완벽 해결 버전
        function applyInlineFormat(matchText, content, formatName) {
            const start = lineStart + offset - matchText.length;
            const hasKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(content);

            // 비동기 처리(10ms)를 통해 브라우저가 한글 조합을 끝낼 시간을 줍니다.
            setTimeout(() => {
                // 1. 기존 마크다운 기호 및 트리거 공백 삭제
                quill.deleteText(start, matchText.length, Quill.sources.USER);

                // 2. 본문 삽입 및 서식 적용
                quill.insertText(start, content, { [formatName]: true }, Quill.sources.USER);

                if (hasKorean) {
                    // [한국어 전용 로직]
                    // 역주행 방지용 투명 방어막(\u200B) 삽입 (서식은 끔)
                    quill.insertText(start + content.length, '\u200B', { [formatName]: false }, Quill.sources.USER);

                    // 커서를 투명 방어막 바로 뒤로 이동
                    const newCursorPos = start + content.length + 1;
                    quill.setSelection(newCursorPos, Quill.sources.SILENT);

                    // 다음 입력(조사 등)에 서식이 전염되지 않도록 강제 해제
                    quill.format(formatName, false, Quill.sources.USER);
                } else {
                    // [영어/글로벌 로직] 상용 앱 표준(공백 한 칸 유지)
                    quill.insertText(start + content.length, ' ', { [formatName]: false }, Quill.sources.USER);
                    const newCursorPos = start + content.length + 1;
                    quill.setSelection(newCursorPos, Quill.sources.SILENT);
                }
            }, 10);
        }

        // 1. 굵게 (**내용**)
        const boldMatch = fullText.match(/\*\*(.+?)\*\* $/);
        if (boldMatch) { applyInlineFormat(boldMatch[0], boldMatch[1], 'bold'); return; }

        // 2. 취소선 (~~내용~~)
        const strikeMatch = fullText.match(/~~(.+?)~~ $/);
        if (strikeMatch) { applyInlineFormat(strikeMatch[0], strikeMatch[1], 'strike'); return; }

        // 3. 밑줄 (__내용__)
        const underMatch = fullText.match(/__(.+?)__ $/);
        if (underMatch) { applyInlineFormat(underMatch[0], underMatch[1], 'underline'); return; }

        // 4. 기울임 (*내용* 또는 _내용_)
        const italicMatch = fullText.match(/(\*|_)(.+?)\1 $/);
        if (italicMatch) { applyInlineFormat(italicMatch[0], italicMatch[2], 'italic'); return; }
    }
});

// [수정] 모바일 툴바 헤더 드롭다운 메뉴 잘림 방지 로직 (MutationObserver 적용)
const toolbarElement = document.querySelector('.ql-toolbar.ql-snow');
const headerPicker = document.querySelector('.ql-header.ql-picker');

if (headerPicker && toolbarElement) {
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.attributeName === 'class') {
                if (window.innerWidth <= 768) {
                    if (headerPicker.classList.contains('ql-expanded')) {
                        toolbarElement.classList.add('ql-toolbar-dropdown-open');
                    } else {
                        toolbarElement.classList.remove('ql-toolbar-dropdown-open');
                    }
                }
            }
        });
    });
    // 헤더 픽커의 클래스 변화만 조용히 감시합니다.
    observer.observe(headerPicker, { attributes: true });
}

// [3] 이미지 파일 처리 함수
const handleImageFiles = (files) => {
    Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const range = quill.getSelection(true); // 현재 커서 위치 파악

                // 1. 이미지 삽입 (1칸 차지)
                quill.insertEmbed(range.index, 'image', e.target.result, Quill.sources.USER);

                // 2. 🎯 추가됨: 이미지 바로 뒤에 엔터(\n) 강제 삽입 (1칸 차지)
                quill.insertText(range.index + 1, '\n', Quill.sources.USER);

                // 3. 🎯 수정됨: 커서를 이미지(1칸) + 엔터(1칸) = 총 1칸 뒤인 '새로운 줄'로 이동
                quill.setSelection(range.index + 1, Quill.sources.SILENT);

                triggerAutoSave(); // 자동 저장 강제 실행
            };
            reader.readAsDataURL(file);
        }
    });
};

// [4] 붙여넣기(Ctrl+V/모바일) 핸들러
quill.root.addEventListener('paste', (e) => {
    const data = (e.clipboardData || e.originalEvent.clipboardData);
    if (!data) return;
    const items = data.items;
    for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
            handleImageFiles([item.getAsFile()]);
        }
    }
});

// [5] 드래그 앤 드롭 핸들러
['dragover', 'drop'].forEach(ev => {
    quill.root.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
});

quill.root.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleImageFiles(e.dataTransfer.files);
    }
});

document.getElementById('memo-title-input').addEventListener('keydown', e => {
    if (e.key === 'Tab') {
        e.preventDefault();
        quill.focus();
    }
});

const dividerBtn = document.querySelector('.ql-divider');
if (dividerBtn) {
    dividerBtn.innerHTML = '<i class="fa-solid fa-minus" style="font-size: 14px; color: var(--text-muted);"></i>';
}

// 🎯 [신규] 취소/복구 버튼에 FontAwesome 아이콘 예쁘게 입히기
const undoBtn = document.querySelector('.ql-undo');
if (undoBtn) {
    undoBtn.innerHTML = '<i class="fa-solid fa-rotate-left" style="font-size: 14px; color: var(--text-muted);"></i>';
}
const redoBtn = document.querySelector('.ql-redo');
if (redoBtn) {
    redoBtn.innerHTML = '<i class="fa-solid fa-rotate-right" style="font-size: 14px; color: var(--text-muted);"></i>';
}

// 🎯 [추가] 줄 전체 취소선 버튼에 FontAwesome '체크박스' 아이콘 입히기 (수정)
const strikeLineBtn = document.querySelector('.ql-strike-line');
if (strikeLineBtn) {
    strikeLineBtn.innerHTML = '<i class="fa-solid fa-square-check" style="font-size: 14px; color: var(--text-muted);"></i>'; // 👈 아이콘 변경됨
    strikeLineBtn.title = "완료 표시 (줄 전체 취소선)";
}

document.querySelector('.col-center').addEventListener('click', e => {
    // 🎯 [수정] 파일 관리창(.file-manager-pane)을 클릭했을 때는 에디터가 포커스를 훔쳐가지 못하게 철벽 방어!
    if (!e.target.closest('.editor-header') && !e.target.closest('.ql-toolbar') && !e.target.closest('.ql-editor') && !e.target.closest('.file-manager-pane')) {
        quill.focus();
    }
});


// 🎯 [안전장치] 분리된 다른 js 파일들에서 에디터를 읽고 쓸 수 있도록 전역으로 열어줍니다.
window.quill = quill;







// 🎯 [신규] 블록 지정 시 가상 키보드 스마트 통제 엔진
quill.on("selection-change", function (range, oldRange, source) {
    if (range) {
        if (range.length > 0) {
            // 1. 블록이 잡혔을 때 (드래그 했을 때)
            // 🎯 기존에 만들어둔 Visual Viewport 센서로 현재 키보드가 켜져 있는지 확인합니다.
            const isKeyboardUp =
                window.visualViewport &&
                window.visualViewport.height < window.screen.height * 0.75;

            if (!isKeyboardUp) {
                // 💡 기획자님 시나리오 A: "키보드가 안 올라온 상태면 안 올라온 그대로 있게 해라"
                // 브라우저에게 "나 지금 모바일 키보드 안 쓸 거니까 올리지 마!" 라고 속입니다.
                quill.root.setAttribute("inputmode", "none");
            }
            // 💡 기획자님 시나리오 B: "키보드가 올라온 상태면 올라온 그대로 둬라"
            // (isKeyboardUp이 true이면 inputmode를 건드리지 않으므로 키보드가 유지됩니다!)
        } else {
            // 2. 단일 커서(클릭)일 때
            // 블록을 풀고 글자 사이 특정 위치를 콕 터치했다면 타자를 칠 확률이 높으므로, 차단막을 즉시 해제합니다.
            quill.root.removeAttribute("inputmode");
        }
    }
});

quill.on("text-change", (delta, old, source) => {
    if (source === "user") triggerAutoSave();
});

document
    .getElementById("memo-title-input")
    .addEventListener("input", triggerAutoSave);

// 🎯 [추가] 파일 관리창 검색창 입력 시 에디터로 이벤트가 새나가지 않도록 차단
const fmSearchInput = document.getElementById("fm-search-input");
if (fmSearchInput) {
    ["keydown", "keyup", "keypress"].forEach((evName) => {
        fmSearchInput.addEventListener(evName, (e) => e.stopPropagation());
    });
}

/* ==========================================
           1. 헬퍼 함수: 가상 클릭 및 스마트 탈출
           ========================================== */

// [기존 유지] 인용구/코드블록 탈출 (공백 추가 로직)
function escapeFormattingBlock() {
    const range = quill.getSelection(true);
    if (!range) return false;
    const formats = quill.getFormat(range.index);
    if (formats.blockquote || formats["code-block"]) {
        let [line, offset] = quill.getLine(range.index);
        while (line && line.next) {
            let nextIdx = quill.getIndex(line.next);
            let nextFmt = quill.getFormat(nextIdx);
            if (!nextFmt.blockquote && !nextFmt["code-block"]) break;
            line = line.next;
        }
        if (line && line.next) {
            quill.setSelection(quill.getIndex(line.next), 0, Quill.sources.USER);
        } else {
            let escapeIndex = quill.getIndex(line) + line.length();
            quill.insertText(escapeIndex, "\n", Quill.sources.USER);
            quill.setSelection(escapeIndex, Quill.sources.SILENT);
            quill.removeFormat(escapeIndex, 1);
        }
        return true;
    }
    return false;
}

let lastSelection = null;
quill.on("selection-change", (range) => {
    if (range) lastSelection = range;
});

/* ==========================================
           2. 전 환경: ESC 키 및 뒤로가기 통합 제어 허브
           ========================================== */
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        // [0순위] 에디터 툴팁 및 일반 노트 메뉴 닫기 (히스토리를 쓰지 않는 순수 UI)
        const tooltip = document.querySelector(".ql-tooltip");
        if (tooltip && !tooltip.classList.contains("ql-hidden")) {
            tooltip.classList.add("ql-hidden");
            return;
        }
        const openMenus = document.querySelectorAll(
            ".memo-actions-wrap.is-menu-open",
        );
        if (openMenus.length > 0) {
            closeAllMemoMenus();
            return;
        }

        // [1순위] 입력창(검색창, 비번창) 포커스 및 내용 초기화
        const activeId = document.activeElement ? document.activeElement.id : "";
        if (
            activeId.includes("search-input") ||
            activeId.includes("sec-password")
        ) {
            if (document.activeElement.value !== "") {
                document.activeElement.value = "";
                document.activeElement.dispatchEvent(new Event("input"));
                return; // 글자만 지우고 커서 유지 (창 안 닫힘)
            } else {
                document.activeElement.blur(); // 빈칸이면 커서 빼고 창 닫기로 직행
                return;
            }
        }

        // [1.5순위] 파일관리창 팝업 메뉴 수동 닫기 (히스토리를 남기지 않는 UI)
        const globalMenu = document.getElementById("fm-global-menu");
        const itemMenu = document.getElementById("fm-item-menu");
        if (
            (globalMenu && globalMenu.classList.contains("is-active")) ||
            (itemMenu && itemMenu.classList.contains("is-active"))
        ) {
            if (globalMenu) globalMenu.classList.remove("is-active");
            if (itemMenu) itemMenu.classList.remove("is-active");
            return;
        }

        // 🎯 [핵심] 화면에 열려있는 UI가 '히스토리 스택(뒤로가기 기록)'을 사용하는지 판별
        const fmPane = document.getElementById("file-manager-pane");
        const isFmOpen = fmPane && fmPane.style.display === "flex"; // 파일관리창이 열려있으면 모두 히스토리 지배를 받음

        // 메인/휴지통 창 다중선택
        const inMainMulti = isMultiSelectMode || selectedMemos.size > 1;
        const inTrashMulti = isTrashMultiSelectMode || selectedTrashMemos.size > 1;

        // 모바일 전용 사이드 패널 열림 상태
        const isMobile = window.innerWidth <= 768;
        const isMobilePanelOpen =
            isMobile &&
            (document
                .getElementById("col-left")
                .classList.contains("is-mobile-open") ||
                !document.getElementById("col-right").classList.contains("is-closed") ||
                document.getElementById("trash-pane").classList.contains("is-open"));

        // 🎯 1. 히스토리를 쓰는 UI라면? ESC 키 = 물리적 뒤로가기 버튼 강제 실행! (통합 엔진 작동)
        if (
            isFmOpen ||
            (isMobile && (inMainMulti || inTrashMulti || isMobilePanelOpen))
        ) {
            if (document.activeElement) document.activeElement.blur();
            history.back(); // 우리가 공들여 만든 popstate 엔진으로 처리를 토스합니다.
            return;
        }

        // 🎯 2. 히스토리를 쓰지 않는 PC 전용 UI들 수동 닫기
        if (!isMobile) {
            if (inMainMulti || inTrashMulti) {
                if (inMainMulti) {
                    isMultiSelectMode = false;
                    selectedMemos.clear();
                    if (currentMemoId) selectedMemos.add(currentMemoId);
                    loadMemoList(false);
                }
                if (inTrashMulti) {
                    isTrashMultiSelectMode = false;
                    selectedTrashMemos.clear();
                    loadTrashList();
                }
                if (document.activeElement) document.activeElement.blur();
                return;
            }
            const trashPane = document.getElementById("trash-pane");
            const rightPane = document.getElementById("col-right");

            if (trashPane.classList.contains("is-open")) {
                toggleTrashPane();
                return;
            } else if (!rightPane.classList.contains("is-closed")) {
                toggleRightPane();
                return;
            }
        }

        // 🎯 3. 에디터 서식 블록(인용구 등) 탈출
        if (escapeFormattingBlock()) {
            return;
        }
    }
});

/* ==========================================
           3. 모바일 환경: 뒤로가기(popstate) 통합 제어
           ========================================== */
window.addEventListener("popstate", (e) => {
    // 🎯 1. 강제 뒤로가기 카운터 처리 (클릭 씹힘 방지)
    if (programmaticBackCount > 0) {
        programmaticBackCount--;
        return;
    }

    const fmPane = document.getElementById("file-manager-pane");
    if (fmPane && fmPane.style.display === "flex") {
        const searchInput = document.getElementById("fm-search-input");
        const isSearching = searchInput && searchInput.value !== "";

        // 🎯 2. 순서 교정 1순위: 화면 최상단 팝업/메뉴부터 닫기
        const globalMenu = document.getElementById("fm-global-menu");
        const itemMenu = document.getElementById("fm-item-menu");
        const moveModal = document.getElementById("fm-move-modal");
        const securityModal = document.getElementById("fm-security-modal");

        const isMenuOpen =
            (globalMenu && globalMenu.classList.contains("is-active")) ||
            (itemMenu && itemMenu.classList.contains("is-active"));
        const isModalOpen =
            (moveModal && moveModal.style.display === "flex") ||
            (securityModal && securityModal.style.display === "flex");

        if (isMenuOpen || isModalOpen) {
            if (globalMenu) globalMenu.classList.remove("is-active");
            if (itemMenu) itemMenu.classList.remove("is-active");

            if (moveModal && moveModal.style.display === "flex") closeMoveModal(true);
            if (securityModal && securityModal.style.display === "flex")
                closeSecurityModal(true);
            return; // 팝업만 닫고 멈춤
        }

        // 🎯 3. 순서 교정 2순위: 팝업이 닫혀있다면 다중 선택 바 닫기
        if (isFmMultiSelectMode) {
            cancelFmMultiSelect(true);
            return;
        }

        // 4. 검색 중일 때 뒤로가기
        if (isSearching) {
            resetFmToHome();
            return;
        }

        // 5. 평상시 폴더 탐색 중일 때 뒤로가기
        if (e.state && e.state.fmOpen) {
            fmPath = e.state.fmPath || [{ id: null, title: "Home" }];
            loadFileManager(e.state.fmFolderId);
            return;
        } else {
            // 6. Home 상태라면 파일관리창 닫기
            closeFileManager();
            return;
        }
    }

    const trashPane = document.getElementById("trash-pane");
    const rightPane = document.getElementById("col-right");
    const leftPane = document.getElementById("col-left");
    const activeId = document.activeElement ? document.activeElement.id : "";

    // [0순위] 에디터 내부 팝업 닫기
    const tooltip = document.querySelector(".ql-tooltip");
    if (tooltip && !tooltip.classList.contains("ql-hidden")) {
        tooltip.classList.add("ql-hidden");
        return;
    }

    // [1순위] 검색창 처리
    if (activeId.includes("search-input")) {
        if (document.activeElement.value !== "") {
            document.activeElement.value = "";
            document.activeElement.dispatchEvent(new Event("input"));
            return;
        } else {
            document.activeElement.blur();
        }
    }

    // [2순위] 메인/휴지통 다중 선택 모드 해제
    const inMainMulti = isMultiSelectMode || selectedMemos.size > 1;
    const inTrashMulti = isTrashMultiSelectMode || selectedTrashMemos.size > 1;

    if (inMainMulti || inTrashMulti) {
        if (inMainMulti) {
            isMultiSelectMode = false;
            selectedMemos.clear();
            if (currentMemoId) selectedMemos.add(currentMemoId);
            loadMemoList(false);
        }
        if (inTrashMulti) {
            isTrashMultiSelectMode = false;
            selectedTrashMemos.clear();
            loadTrashList();
        }
        if (document.activeElement) document.activeElement.blur();
        return;
    }

    // [3순위] 패널 닫기 (휴지통 -> 우측/좌측)
    if (trashPane.classList.contains("is-open")) {
        trashPane.classList.remove("is-open");
        if (rightPane.classList.contains("is-closed")) {
            document.getElementById("mobile-overlay").classList.remove("is-active");
        }
        return;
    }
    if (
        !rightPane.classList.contains("is-closed") ||
        leftPane.classList.contains("is-mobile-open")
    ) {
        closeAllPanelsMobile();
        return;
    }

    // [4순위] 서식 블록 탈출
    if (escapeFormattingBlock()) {
        return;
    }

    // [5순위] 앱 종료 방어
    if (window.innerWidth <= 768) {
        const now = Date.now();
        if (now - backPressTimer < 2000) {
            if (typeof purgeEmptyMemos === "function") purgeEmptyMemos();
            if (typeof executeSave === "function") executeSave();
            history.back();
        } else {
            backPressTimer = now;
            if (document.activeElement) document.activeElement.blur();
            if (window.quill && quill.hasFocus()) quill.blur();

            showToast(
                "뒤로가기 버튼을 한 번 더 누르면 종료됩니다.\n(온라인 동기화: 다음 로그인 시)",
            );
            history.pushState({ page: "main" }, "");
        }
    }
});

if (window.visualViewport) {
    const toolbar = document.querySelector(".ql-toolbar.ql-snow");
    let isDocked = false;

    // 🎯 [추가] 프레임 동기화 타이머 (울렁거림 방지용)
    let viewportHandler = null;

    const updateToolbarPosition = () => {
        // 🎯 애니메이션 프레임 동기화: 브라우저 주사율(60Hz/120Hz)에 맞춰 부드럽게 렌더링
        if (viewportHandler) cancelAnimationFrame(viewportHandler);
        viewportHandler = requestAnimationFrame(() => {
            if (window.innerWidth > 768 || !toolbar) {
                if (isDocked) {
                    toolbar.style.cssText = "";
                    isDocked = false;
                }
                return;
            }

            const isTyping =
                quill.hasFocus() ||
                document.activeElement === document.getElementById("memo-title-input");
            const isKeyboardUp =
                isTyping && window.visualViewport.height < window.screen.height * 0.75;

            if (isKeyboardUp) {
                // 🚀 [틈새 방어 마법] 계산된 위치에 '+ 2'를 더해 키보드 안쪽으로 2px 밀어 넣습니다.
                // (OS 가상 키보드가 웹 브라우저보다 무조건 위에 뜨기 때문에 깔끔하게 틈새만 밀봉됩니다!)
                const topPosition =
                    window.visualViewport.offsetTop +
                    window.visualViewport.height -
                    toolbar.offsetHeight +
                    2;

                toolbar.style.setProperty("position", "fixed", "important");
                toolbar.style.setProperty("top", `${topPosition}px`, "important");
                toolbar.style.setProperty("bottom", "auto", "important");
                toolbar.style.setProperty("z-index", "9999", "important");

                // 🚀 [울렁거림 방어 마법] GPU 하드웨어 가속 강제 가동 & 틈새 메꿈용 그림자
                toolbar.style.setProperty(
                    "box-shadow",
                    "0 4px 0 var(--bg)",
                    "important",
                ); // 밑단에 배경색 그림자를 덧대어 철통 방어
                toolbar.style.setProperty("transform", "translateZ(0)", "important"); // GPU 가동!
                toolbar.style.setProperty("transition", "none", "important");

                isDocked = true;
            } else {
                if (isDocked) {
                    toolbar.style.cssText = "";
                    isDocked = false;
                }
            }
        });
    };

    // 화면 줌, 텍스트 스크롤, 키보드 애니메이션 등 '시야'가 변하는 모든 순간을 1밀리초 단위로 감지
    window.visualViewport.addEventListener("resize", updateToolbarPosition);
    window.visualViewport.addEventListener("scroll", updateToolbarPosition);

    // 사용자가 글씨를 쓰려고 화면을 터치하는 순간 즉각 반응
    quill.root.addEventListener("focus", updateToolbarPosition);
    document
        .getElementById("memo-title-input")
        .addEventListener("focus", updateToolbarPosition);

    // 키보드가 닫히는 애니메이션 시간을 고려해 0.1초 뒤에 복귀(천장에 다시 붙임) 계산
    quill.root.addEventListener("blur", () =>
        setTimeout(updateToolbarPosition, 100),
    );
    document
        .getElementById("memo-title-input")
        .addEventListener("blur", () => setTimeout(updateToolbarPosition, 100));
}
