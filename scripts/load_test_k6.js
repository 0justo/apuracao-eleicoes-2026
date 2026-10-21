/**
 * Script k6 de Teste de Carga — Apuração 2º Turno 2026 (Pico 17h–22h)
 *
 * Execução:
 *   k6 run -e BASE_URL=http://127.0.0.1:8000 scripts/load_test_k6.js
 */
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '15s', target: 100 }, // Rampa de subida às 17h00
    { duration: '30s', target: 250 }, // Pico sustentado de consultas a snapshots estáticos
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<80', 'p(99)<180'],
    http_req_failed: ['rate<0.005'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:8000'
const ENDPOINTS = [
  '/snapshots/catalog.json',
  '/snapshots/presidente/latest.json',
  '/snapshots/governador-ac/latest.json',
  '/snapshots/governador-am/latest.json',
  '/snapshots/governador-df/latest.json',
  '/snapshots/governador-es/latest.json',
  '/snapshots/governador-rn/latest.json',
  '/snapshots/governador-to/latest.json',
  '/geo/br-ufs.topo.json',
]

export default function () {
  const path = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)]
  const res = http.get(`${BASE_URL}${path}`, {
    headers: { 'Accept-Encoding': 'br, gzip' },
  })

  check(res, {
    'status is 200': (r) => r.status === 200,
    'has Cache-Control header': (r) =>
      (r.headers['Cache-Control'] || r.headers['cache-control'] || '').includes(
        'max-age=30',
      ),
  })

  sleep(0.2)
}
