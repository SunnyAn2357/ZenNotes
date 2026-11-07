# ZenNotes 변경 이력 (Personal PWA & 배포판)

---

## [v4.8.0] - 2026-11-07 12:20
### 1. 외부 파일 드래그앤드롭 스마트 액션 모달 (`#file-drop-action-modal`)
- **기능 개요**: 기존 노트(에디터 및 전체 창)에 외부 파일(이미지, PDF, 텍스트/MD 등)을 드래그앤드롭했을 때, `"여기에 삽입"`과 `"새 노트 열기"`를 사용자가 직관적으로 선택할 수 있는 젠 플로팅 선택 모달 추가.
- **키보드 및 네비게이션 제어**:
  - `Enter`: 기본 추천 액션인 **"여기에 삽입"** 즉시 실행 (캡처링 단계에서 인터셉트하여 에디터 불필요 엔터 개행 방지).
  - `Esc` / 모바일 뒤로가기(`popstate`): 취소 및 모달 닫기 (이탈 방지 연동).
  - 팝업 오픈 시 `drop-action-insert-btn` 자동 포커스.
- **파일 종류별 맞춤 안내**:
  - PDF/이미지/문서 파일별 아이콘 및 파일명, 크기(KB/MB 단위) 요약 표시.
  - 복수 파일 드롭 시 "첫 파일명 외 N개 (총 용량)" 요약 표출.

### 2. 에디터 툴바 'PDF/이미지 삽입' 버튼 기능 확장 (삽입 전용)
- **툴바 이미지 버튼(`.ql-image`) 파일 지원 확장**:
  - 파일 선택창(`accept`)에 `image/*,application/pdf,.pdf` 확장자 추가.
  - 툴팁 안내 문구를 `"PDF/이미지 삽입 (Ctrl+V 붙여넣기 지원)"`으로 부분 갱신.
- **삽입 전용 엔진 (`insertPdfIntoCurrentMemo`, `insertImagesIntoCurrentMemo`)**:
  - 이 버튼은 오직 '삽입 전용'으로서 현재 편집 중인 노트의 커서 위치에 바로 삽입.
  - PDF 1페이지: 확인 과정 없이 초고속으로 현재 커서 위치에 이미지 렌더링 및 개행 삽입 후 즉시 자동 저장.
  - PDF 2페이지 이상: 썸네일 그리드 페이지 선택 모달(`showPdfPageRangeModal`)을 띄워 사용자가 선택한 페이지만 현재 커서 위치에 순서대로 삽입.

### 3. PWA 캐시 갱신
- Service Worker 캐시 식별자 `zennotes-cache-v4.8.0`으로 갱신하여 최신 스크립트 및 모달 리소스 캐싱.

---

## [v4.7.7] - 2026-11-07 10:47
### 1. 외부 CDN 라이브러리 로컬 번들화 (`lib/`)
- Quill 2.0.3, highlight.js 11.9.0, html2pdf.js 0.10.1, FileSaver.js 2.0.5, Font Awesome Free 6.4.0(웹폰트 포함), Pretendard 1.3.9(woff2), pdf.js 4.10.38 (cmaps/standard_fonts 포함)을 앱 내부 `lib/` 폴더에 로컬 번들링.
- `index.html`: 외부 CDN 의존성을 모두 로컬 `lib/` 상대 경로로 교체. (Google 로그인 및 Firebase SDK 3종은 클라우드 동기화를 위해 정상 유지).
- `js/io.js`: pdf.js worker/cmaps/standard_fonts 경로를 로컬 `lib/pdfjs/`로 교체.
### 2. PWA 캐시 갱신
- Service Worker 캐시 식별자 `zennotes-cache-v4.7.7`로 갱신하여 신규 로컬 번들 리소스 즉시 캐싱.

---

## [v4.7.6] - 2026-11-05 20:43
### pdf.js 2.16.105 → 4.10.38 보안 업그레이드 (CVE-2024-4367 패치)
- `index.html`: pdf.js를 jsDelivr `pdfjs-dist@4.10.38/legacy` ES 모듈로 로드(`window.pdfjsLib`), 모바일 호환 legacy 빌드 사용.
- `js/io.js`: worker/cmaps/standard_fonts 경로 4.10.38로 교체. 그 외 변경 없음.

---

## [v4.7.5] - 2026-11-02
### 1. 개인용 Chrome PWA 최적화 & Firebase Hosting 배포 체계 구축
- **배포 플랫폼**: Firebase Hosting (`https://zennotes-ads.web.app`) 원스톱 배포 지원.
- **앱 명칭 복원 (Personal Identity)**:
  - 브라우저 상단 타이틀, PWA 매니페스트(`name`, `short_name`), 환경설정 버전 배지 등 겉으로 드러나는 모든 명칭을 **`ZenNotes`**로 복원.
- **오리지널 ZenNotes 아이콘 복원**:
  - 기존 동글동글한 ADS 이니셜 아이콘 대신 ZenNotes 오리지널 정체성을 지닌 고해상도 파비콘(`favicon.png`, `img192.png`, `img512.png`) 적용.

### 2. 밀양시 BI 5연타(5-tap) 시크릿 클라우드 로그인 트리거 장착
- **스텔스 모드 (1~4회 일반 클릭/터치)**:
  - 평상시나 공공장소/사내에서 1회 터치 시 기존과 동일하게 `"로그인(추후 지원)"` 안내 토스트 표출로 완벽 위장.
- **시크릿 모드 (2초 내 5연타 연속 클릭/터치)**:
  - 2초 이내에 5회 연속 탭 시 진동 피드백(모바일)과 함께 숨겨진 **구글 OAuth 로그인 및 Firestore 실시간 동기화 엔진(`handleCloudAuthLegacy`) 즉시 호출**.
  - 이미 로그인된 상태에서는 현재 연동된 이메일 계정 안내 및 안전한 로그아웃 분기 다이얼로그 제공.

### 3. PWA 캐시 및 최신 기능 통합
- V4.7.4의 모든 최신 UI/UX 기능(환경설정 모달 ESC/popstate 즉시 닫기, 최근 노트 표시 개수 설정, 세그먼트 버튼 젠 플로팅 스타일, 은행급 오토락 등) 100% 통합.
- PWA 서비스 워커 캐시 식별자 `zennotes-cache-v4.7.5` 갱신.
