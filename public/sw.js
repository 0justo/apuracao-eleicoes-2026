/**
 * Service Worker de Resiliência Offline — Apuração 2º Turno 2026
 *
 * Estratégias:
 * 1. Snapshots JSON (/snapshots/* e /api/v1/*): Network-First com fallback automático
 *    para o último snapshot válido em cache (garante que o app nunca fique em branco
 *    se o TSE, o backend ou a rede móvel do usuário oscilar entre 17h e 22h).
 * 2. Malhas TopoJSON (/geo/*), Avatares (/avatars/*) e Ícones (/icons/*):
 *    Stale-While-Revalidate para carregamento instantâneo em 3G/4G.
 */

const STATIC_CACHE = 'apuracao-2t-static-v1'
const SNAPSHOT_CACHE = 'apuracao-2t-snapshots-v1'

const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/geo/br-ufs.topo.json',
  '/snapshots/catalog.json',
  '/snapshots/presidente/latest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => undefined))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== SNAPSHOT_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 1. Snapshots JSON e endpoints de API: Network-First com fallback para último snapshot válido
  if (
    url.pathname.startsWith('/snapshots/') ||
    url.pathname.startsWith('/api/')
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(SNAPSHOT_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          throw new Error('Offline and no cached snapshot available')
        }),
    )
    return
  }

  // 2. Malhas TopoJSON, Avatares e Assets Estáticos: Stale-While-Revalidate
  if (
    url.pathname.startsWith('/geo/') ||
    url.pathname.startsWith('/avatars/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const networkPromise = fetch(request)
          .then((response) => {
            if (response && response.ok) {
              cache.put(request, response.clone())
            }
            return response
          })
          .catch(() => cached)
        return cached || networkPromise
      }),
    )
  }
})
