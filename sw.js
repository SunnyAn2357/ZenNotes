// 캐시 이름 (앱을 업데이트할 때마다 v2, v3... 로 숫자를 올려주세요!)
const CACHE_NAME = 'zennotes-cache-v1.8';

// 반드시 캐싱해야 할 내 서버의 기본 파일들
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './img192.png',
    './img512.png'
];

// 1. 설치(Install) 이벤트: 워커가 설치될 때 기본 파일들을 미리 저장합니다.
self.addEventListener('install', event => {
    // 🎯 [수정됨] self.skipWaiting(); 제거! (사용자가 알림창 버튼을 누를 때까지 얌전히 대기하도록 만듭니다)
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('✅ 워커: 기본 파일 캐싱 완료');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// 2. 활성화(Activate) 이벤트: 새로운 버전(v2, v3..)이 나오면 옛날 캐시 쓰레기를 비워줍니다.
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
        })
    );
});

// 3. 패치(Fetch) 이벤트: 앱이 무언가를 요청할 때 워커가 중간에 가로챕니다. (핵심 로직)
self.addEventListener('fetch', event => {
    // 주의: 구글 로그인, 구글 드라이브 API 등은 캐싱하면 에러가 납니다. 그대로 통과시킵니다.
    if (event.request.url.includes('google') || event.request.url.includes('apis.com')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // 3-1. 캐시에 이미 저장된 파일이 있으면 인터넷을 거치지 않고 바로 줍니다. (오프라인 작동!)
            if (cachedResponse) {
                return cachedResponse;
            }

            // 3-2. 캐시에 없는 새로운 요청이면 실제 인터넷(네트워크)으로 요청을 보냅니다.
            const fetchRequest = event.request.clone();
            return fetch(fetchRequest).then(networkResponse => {
                // 정상적인 응답이 아니면 캐싱하지 않고 그냥 반환합니다.
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // 정상적으로 인터넷에서 가져왔다면, 다음 오프라인 때를 대비해 캐시에 복사본을 몰래 넣어둡니다.
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // 오프라인 상태인데 캐시에도 파일이 없을 때 이리로 빠집니다.
                console.log('❌ 워커: 오프라인 상태이며 캐시가 없습니다:', event.request.url);
            });
        })
    );
});

// 4. 업데이트 강제 수신기: index.html의 알림창에서 '새로고침' 버튼을 누르면 이 신호를 받습니다.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting(); // 🎯 이때 비로소 이전 버전을 밀어내고 새 버전으로 강제 교체합니다!
    }
});