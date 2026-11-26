// 캐시 이름 (앱을 업데이트할 때마다 v2, v3... 로 숫자를 올려주세요!)
const CACHE_NAME = 'zennotes-cache-v1.8.11';

// 반드시 캐싱해야 할 내 서버의 기본 파일들
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/main.css?v=1.8.11',
    './js/globals.js?v=1.8.11',
    './js/db.js?v=1.8.11',
    './js/ui.js?v=1.8.11',
    './js/editor.js?v=1.8.11',
    './js/file_manager.js?v=1.8.11',
    './js/io.js?v=1.8.11',
    './js/auth.js?v=1.8.11',
    './js/zen_bridge.js?v=1.8.11',
    './img192.png',
    './img512.png',
    './miryang_bi.png'
];

// 1. 설치(Install) 이벤트: 새 버전 기본 파일을 캐싱하고 즉시 활성화 대기열에 진입합니다.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('✅ 워커: 기본 파일 캐싱 완료');
            return Promise.allSettled(
                STATIC_ASSETS.map(url => cache.add(url))
            );
        }).then(() => self.skipWaiting())
    );
});

// 2. 활성화(Activate) 이벤트: 구버전 캐시를 정리하고 즉시 열린 클라이언트를 인계받습니다.
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. 패치(Fetch) 이벤트: Stale-While-Revalidate + 오프라인 폴백
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    // 🎯 [V4.3.1] http/https 요청만 처리 (크롬 확장 프로그램 chrome-extension:// 등 캐시 불가 스키마 제외)
    if (!event.request.url.startsWith('http')) return;

    // 주의: 구글 로그인, Firebase(인증·Firestore), Timely AI API 등은 캐싱하면 에러가 납니다. 그대로 통과시킵니다.
    const reqUrl = event.request.url;
    if (reqUrl.includes('google') || reqUrl.includes('apis.com') || reqUrl.includes('firebase') || reqUrl.includes('gstatic.com') || reqUrl.includes('timelyai.io')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                // 캐시 응답을 즉시 제공하면서 백그라운드에서 최신 파일을 페치해 캐시 갱신
                fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            const fetchRequest = event.request.clone();
            return fetch(fetchRequest).then(networkResponse => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html').then(r => r || caches.match('./'));
                }
                console.log('❌ 워커: 오프라인 상태이며 캐시가 없습니다:', event.request.url);
                return new Response('', { status: 503, statusText: 'Offline' });
            });
        })
    );
});

// 4. 업데이트 강제 수신기: 즉시 새 워커로 교체합니다.
self.addEventListener('message', (event) => {
    if (event.data && (event.data.type === 'SKIP_WAITING' || event.data === 'skipWaiting')) {
        self.skipWaiting();
    }
});





