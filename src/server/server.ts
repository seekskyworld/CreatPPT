import { createReadStream } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { handleProjectRequest } from './handlers'

export interface ServerOptions {
  projectDir: string
  clientDir: string
  host?: string
  port?: number
}

export async function startCreatPptServer(options: ServerOptions): Promise<{ server: Server; url: string }> {
  const host = options.host ?? '127.0.0.1'
  const server = createServer(async (request, response) => {
    try {
      if (await handleProjectRequest(request, response, options.projectDir)) return
      await serveClient(request.url || '/', response, options.clientDir)
    }
    catch (error) {
      response.statusCode = 500
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
    }
  })

  await new Promise<void>((resolveReady, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 4173, host, () => {
      server.off('error', reject)
      resolveReady()
    })
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : options.port ?? 4173
  return { server, url: `http://${host}:${port}` }
}

async function serveClient(urlValue: string, response: import('node:http').ServerResponse, clientDir: string) {
  const pathname = decodeURIComponent(new URL(urlValue, 'http://127.0.0.1').pathname)
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1)
  const target = resolve(clientDir, requested)
  const root = resolve(clientDir)
  if (!target.startsWith(`${root}/`) && target !== root) {
    response.statusCode = 403
    response.end('Forbidden')
    return
  }

  let finalTarget = target
  try {
    const targetStat = await stat(finalTarget)
    if (!targetStat.isFile()) finalTarget = resolve(clientDir, 'index.html')
  }
  catch {
    finalTarget = resolve(clientDir, 'index.html')
  }

  response.statusCode = 200
  response.setHeader('Content-Type', clientMimeType(finalTarget))
  if (finalTarget.endsWith('index.html')) response.setHeader('Cache-Control', 'no-cache')
  else response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  createReadStream(finalTarget).pipe(response)
}

function clientMimeType(path: string): string {
  const types: Record<string, string> = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
  }
  return types[extname(path).toLowerCase()] || 'application/octet-stream'
}
