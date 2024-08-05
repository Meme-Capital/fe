"use strict";
(() => {
  // worker/cache.ts
  var cacheVersions = {
    static: 28
  };
  var getCacheName = (name) => `${name}-${cacheVersions[name]}`;
  var cacheNames = {};
  Object.keys(cacheVersions).forEach(
    (key) => cacheNames[key] = getCacheName(key)
  );
  var cacheUrls = [
    "/",
    "https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Nunito:wght@200..900",
    "https://fonts.gstatic.com/s/nunito/v26/XRXV3I6Li01BKofINeaBTMnFcQ.woff2",
    "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
  ];
  var cacheApp = async () => {
    const cache = await caches.open(cacheNames.static);
    await cache.addAll(
      cacheUrls.map((u) => new Request(u, { cache: "reload" }))
    );
  };
  var deleteCache = async (force) => {
    const cacheNames2 = await caches.keys();
    for (const name of cacheNames2) {
      if (!force && Object.keys(cacheNames2).some((n) => n === name))
        continue;
      await caches.delete(name);
    }
  };

  // worker/cacheMethods.ts
  function cacheFirst(e, cacheName, options, req) {
    e.respondWith(
      caches.match(req || e.request, options).then((cachedResponse) => {
        if (cachedResponse)
          return cachedResponse;
        return fetch(req || e.request).then((res) => {
          const clone = res.clone();
          caches.open(cacheName).then((c) => c.put(req || e.request, clone));
          return res;
        });
      })
    );
  }

  // worker/push.ts
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
      self.clients.openWindow(
        `${self.location.origin}/ticker/${event.notification.data}`
      )
    );
  });
  self.addEventListener("push", (event) => {
    const data = event.data?.json();
    event.waitUntil(
      self.registration.showNotification(data?.title ?? "meme.fun", {
        body: data?.message,
        renotify: true,
        tag: data?.tickerId,
        timestamp: data ? data.timestamp : Date.now(),
        data: data?.tickerId,
        icon: data?.icon || "/images/logo192.png"
      })
    );
  });

  // worker/sendMessage.ts
  var sendMessage = async (message) => {
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.postMessage(message));
  };

  // worker/worker.ts
  self.addEventListener("install", (event) => {
    event.waitUntil(cacheApp());
  });
  self.addEventListener("message", (e) => {
    if (e.data?.type === "refresh") {
      e.waitUntil(
        (async () => {
          try {
            await deleteCache(true);
            await cacheApp();
            await sendMessage({ type: "refresh_complete" });
          } catch (e2) {
            console.error(e2);
            await sendMessage({ type: "refresh_failed" });
          }
        })()
      );
    }
  });
  self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET")
      return;
    const shouldServeIndexHtml = event.request.mode === "navigate" && !event.request.url.includes("/assets/") && !event.request.url.includes("terms.pdf");
    if (shouldServeIndexHtml) {
      return event.respondWith(fetch("/"));
    }
    if (event.request.url.includes("/assets/")) {
      cacheFirst(event, cacheNames.static);
      return;
    }
    if (event.request.url.includes("/images/") || event.request.url.includes("fonts.gstatic.com")) {
      cacheFirst(event, cacheNames.static, { ignoreSearch: true });
      return;
    }
    return event.respondWith(fetch(event.request));
  });
})();
