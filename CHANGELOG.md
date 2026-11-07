# Release V4.9.15 (2026-11-07 19:15)

### 🚀 개선 및 최적화 (Firebase 배포 캐시 제어)
- **Firebase 호스팅 캐시 헤더 최적화 (`firebase.json`)**:
  - `sw.js` 및 `index.html`에 `Cache-Control: no-cache, no-store, must-revalidate` 헤더를 영구 적용.
  - 파이어베이스 배포 후 브라우저가 이전 버전의 서비스 워커(`sw.js`)를 1시간 동안 캐싱하여 구버전 토스트나 기능이 노출되던 현상 원천 차단.
  - 배포 즉시 실시간으로 최신 버전이 반영되도록 최적화 완료.
