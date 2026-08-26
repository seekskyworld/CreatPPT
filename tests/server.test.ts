import { createServer as createHttpServer, request as httpRequest } from 'node:http'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createStarterDeck } from '@/demo/starter'
import { handleProjectRequest } from '@/server/handlers'

describe('local project API', () => {
  it('validates saves and blocks asset traversal', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'creatppt-server-'))
    await mkdir(resolve(root, 'assets'), { recursive: true })
    const deck = createStarterDeck('Server contract', 'signal', 3)
    await writeFile(resolve(root, 'deck.json'), `${JSON.stringify(deck)}\n`, 'utf8')
    await writeFile(resolve(root, 'assets', 'ok.txt'), 'asset', 'utf8')

    const server = createHttpServer(async (request, response) => {
      if (!(await handleProjectRequest(request, response, root))) {
        response.statusCode = 404
        response.end()
      }
    })
    await new Promise<void>(resolveReady => server.listen(0, '127.0.0.1', () => resolveReady()))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('server did not bind')
    const port = address.port

    try {
      const traversal = await requestText(port, '/deck-assets/..%2Fdeck.json')
      expect(traversal.status).toBe(403)

      const invalid = await requestJson(port, '/api/deck', { method: 'PUT', body: JSON.stringify({}) })
      expect(invalid.status).toBe(400)
      expect(JSON.parse(await readFile(resolve(root, 'deck.json'), 'utf8')).title).toBe('Server contract')

      const next = createStarterDeck('Updated server contract', 'editorial', 3)
      const saved = await requestJson(port, '/api/deck', { method: 'PUT', body: JSON.stringify(next) })
      expect(saved.status).toBe(200)
      expect(JSON.parse(await readFile(resolve(root, 'deck.json'), 'utf8')).title).toBe('Updated server contract')
    }
    finally {
      await new Promise<void>(resolveClose => server.close(() => resolveClose()))
    }
  })
})

async function requestText(port: number, path: string, options: { method?: string; body?: string } = {}) {
  return new Promise<{ status: number; body: string }>((resolveResponse, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port, path, method: options.method ?? 'GET', headers: options.body ? { 'Content-Type': 'application/json' } : undefined }, response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('end', () => resolveResponse({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', reject)
    if (options.body) request.write(options.body)
    request.end()
  })
}

async function requestJson(port: number, path: string, options: { method: string; body: string }) {
  return requestText(port, path, options)
}
