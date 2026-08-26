import type { IncomingMessage, ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { access, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import { parseDeck } from '../domain/schema'

// Editable image data and scene metadata can make a deck substantially larger
// than the generated JSON. Keep a bounded limit, but leave room for normal
// browser editing and pasted assets.
const MAX_BODY_BYTES = 32 * 1024 * 1024

export async function handleProjectRequest(
  request: IncomingMessage,
  response: ServerResponse,
  projectDir: string,
): Promise<boolean> {
  const url = new URL(request.url || '/', 'http://127.0.0.1')

  if (url.pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { ok: true, projectDir })
    return true
  }

  if (url.pathname === '/api/deck' && request.method === 'GET') {
    try {
      const deck = parseDeck(JSON.parse(await readFile(resolve(projectDir, 'deck.json'), 'utf8')))
      sendJson(response, 200, deck)
    }
    catch (error) {
      sendJson(response, 500, { ok: false, error: getErrorMessage(error) })
    }
    return true
  }

  if (url.pathname === '/api/deck' && request.method === 'PUT') {
    try {
      const body = await readBody(request)
      const deck = parseDeck(JSON.parse(body))
      deck.updatedAt = new Date().toISOString()
      await mkdir(projectDir, { recursive: true })
      const target = resolve(projectDir, 'deck.json')
      const temporary = `${target}.tmp-${process.pid}-${Date.now()}`
      try {
        await writeFile(temporary, `${JSON.stringify(deck, null, 2)}\n`, 'utf8')
        await rename(temporary, target)
      }
      finally {
        await unlink(temporary).catch(() => undefined)
      }
      sendJson(response, 200, { ok: true, updatedAt: deck.updatedAt })
    }
    catch (error) {
      sendJson(response, 400, { ok: false, error: getErrorMessage(error) })
    }
    return true
  }

  if (url.pathname.startsWith('/deck-assets/') && request.method === 'GET') {
    const assetRoot = resolve(projectDir, 'assets')
    const relativePath = decodeURIComponent(url.pathname.slice('/deck-assets/'.length))
    const target = resolve(assetRoot, relativePath)
    if (!isWithin(assetRoot, target)) {
      sendJson(response, 403, { ok: false, error: 'Asset path is outside the project.' })
      return true
    }
    try {
      const targetStat = await stat(target)
      if (!targetStat.isFile()) throw new Error('Asset is not a file.')
      response.statusCode = 200
      response.setHeader('Content-Type', mimeType(target))
      response.setHeader('Cache-Control', 'no-cache')
      createReadStream(target).pipe(response)
    }
    catch {
      sendJson(response, 404, { ok: false, error: 'Asset not found.' })
    }
    return true
  }

  return false
}

export async function projectExists(projectDir: string): Promise<boolean> {
  try {
    await access(resolve(projectDir, 'deck.json'))
    return true
  }
  catch {
    return false
  }
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let length = 0
    request.on('data', chunk => {
      const buffer = Buffer.from(chunk)
      length += buffer.length
      if (length > MAX_BODY_BYTES) {
        reject(new Error('Request body exceeds 8 MB.'))
        request.destroy()
        return
      }
      chunks.push(buffer)
    })
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    request.on('error', reject)
  })
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(body))
}

function isWithin(root: string, target: string): boolean {
  const path = relative(root, target)
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !path.startsWith(sep))
}

function mimeType(path: string): string {
  const types: Record<string, string> = {
    '.avif': 'image/avif',
    '.gif': 'image/gif',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
  }
  return types[extname(path).toLowerCase()] || 'application/octet-stream'
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
