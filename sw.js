/**
 * Service Worker for AI Instructor App
 * 提供基本的快取和離線功能
 */

const CACHE_NAME = 'ai-instructor-v3.0.6';
const STATIC_CACHE_URLS = [
  './',
  './index.html',
  './src/css/main.css',
  './src/css/components.css',
  './src/css/responsive.css',
  './src/js/app.js',
  './src/js/app-refactored.js',
  './src/js/config/prompt-manager.js',
  './src/js/services/gemini-service.js',
  './src/js/services/session-manager.js',
  './src/js/services/storage-service.js',
  './src/js/services/content-renderer.js',
  // 新的模組化文件
  './src/js/modules/event-bus.js',
  './src/js/modules/ui-manager.js',
  './src/js/modules/event-handler.js',
  './src/js/modules/voice-module.js',
  './src/js/modules/export-module.js',
  './src/js/modules/settings-manager.js',
  './src/js/modules/session-controller.js',
  './src/js/modules/ai-controller.js',
  // 練習UI模塊化文件
  './src/js/services/practice-ui.js',
  './src/js/services/practice-ui-modular.js',
  './src/js/services/practice-ui-base.js',
  './src/js/services/practice-ui-renderer.js',
  './src/js/services/practice-ui-interaction.js',
  './src/js/services/practice-ui-feedback.js',
  './src/js/services/practice-ui-completion.js',
  // 其他練習相關服務
  './src/js/services/practice-core.js',
  './src/js/services/practice-integration.js',
  './src/js/services/practice-session.js',
  './src/js/services/question-bank-service.js',
  './src/js/services/speech-service.js',
  './src/js/services/export-service.js',
  './src/config/ai-instructor-prompts.json',
  './manifest.json',
  './favicon.ico',
  // PWA 圖示
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png',
  './assets/icons/favicon-16x16.png',
  './assets/icons/favicon-32x32.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/app-icon.svg',
  // 第三方庫資源
  './vendor/js/markdown-it.min.js',
  './vendor/js/katex.min.js',
  './vendor/js/highlight.min.js',
  './vendor/css/katex.min.css',
  './vendor/css/highlight-github.min.css',
  // KaTeX 字體文件
  './vendor/fonts/KaTeX_Main-Regular.woff2',
  './vendor/fonts/KaTeX_Math-Italic.woff2',
  './vendor/fonts/KaTeX_Size1-Regular.woff2',
  './vendor/fonts/KaTeX_AMS-Regular.woff2'
];

// 安裝事件 - 快取靜態資源
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker: Installation complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// 啟動事件 - 清理舊快取
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activation complete');
        return self.clients.claim();
      })
  );
});

// 攔截網路請求
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // 只處理同源請求
  if (url.origin !== location.origin) {
    return;
  }
  
  // 對於導航請求，總是返回 index.html (SPA 路由)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html')
        .then((response) => {
          return response || fetch('./index.html');
        })
    );
    return;
  }
  
  // 對於其他請求，使用快取優先策略
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          console.log('Service Worker: Serving from cache', request.url);
          return response;
        }
        
        // 如果快取中沒有，嘗試從網路獲取
        return fetch(request)
          .then((response) => {
            // 檢查回應是否有效
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // 複製回應以便快取
            const responseToCache = response.clone();
            
            // 快取回應
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Fetch failed', error);
            
            // 如果是HTML請求且網路失敗，返回離線頁面
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            throw error;
          });
      })
  );
});

// 處理訊息
self.addEventListener('message', (event) => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({
        type: 'VERSION',
        version: CACHE_NAME
      });
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME)
        .then(() => {
          event.ports[0].postMessage({
            type: 'CACHE_CLEARED',
            success: true
          });
        })
        .catch((error) => {
          event.ports[0].postMessage({
            type: 'CACHE_CLEARED',
            success: false,
            error: error.message
          });
        });
      break;
      
    default:
      console.log('Service Worker: Unknown message type', data.type);
  }
});

// 推送通知處理 (未來功能)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received');
  
  const options = {
    body: event.data ? event.data.text() : 'AI教學助理有新訊息',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '查看訊息',
        icon: './icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: '關閉',
        icon: './icons/icon-192x192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('AI教學助理', options)
  );
});

// 通知點擊處理
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification click received');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

console.log('Service Worker: Script loaded'); 
