import http from 'node:http'
import { createServer as createViteServer } from 'vite'

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '127.0.0.1'

async function start() {
  const httpServer = http.createServer()

  const vite = await createViteServer({
    configFile: './vite.config.ts',
    server: {
      middlewareMode: true,
      hmr: {
        server: httpServer,
      },
    },
    appType: 'spa',
  })

  httpServer.on('request', (req, res) => {
    vite.middlewares(req, res)
  })

  httpServer.listen(PORT, HOST, () => {
    console.log(`  ➜  Vite Frontend (Apuração 2º Turno) rodando em: http://${HOST}:${PORT}/`)
  })
}

start().catch((err) => {
  console.error('Erro ao iniciar servidor Vite:', err)
  process.exit(1)
})
