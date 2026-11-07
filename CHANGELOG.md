# ZenNotes V4.9.9 변경 이력 (2026-11-07)

### 🖼️ 이미지 상·하 기본 여백 제거(`margin: 0`) 및 좌우 텍스트 상단 정렬 일치화
- **원인 분석**:
  - `.ql-editor img`에 `margin: 8px 0`이 남아 있어, 이미지 좌우에 텍스트를 입력할 경우 이미지 상단 마진(`8px`)만큼 이미지가 아래로 내려가면서 옆의 글자가 이미지 위로 `8px` 튀어나와 보이는 현상 확인 (줄 간격은 이미 `.ql-editor p`의 `margin-bottom: 8px`가 담당).
- **조치 내역**:
  - 에디터 본문(`css/main.css`), 인쇄 미디어쿼리(`@media print`), PDF/HTML 내보내기(`js/io.js`)의 `.ql-editor img` 여백을 `margin: 0; vertical-align: top; box-sizing: border-box;`로 변경.
  - 이미지 좌우에 글을 작성할 때 이미지 상단과 글자 상단이 칼같이 일치하도록 정렬 개선.
