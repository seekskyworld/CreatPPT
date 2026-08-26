import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'
import { createStarterDeck } from '../src/demo/starter'

const projectDir = resolve('.tmp/e2e-deck')
const port = Number(process.env.CREATPPT_E2E_PORT ?? 4173)
await mkdir(projectDir, { recursive: true })
await rm(resolve(projectDir, 'assets'), { recursive: true, force: true })
await cp(resolve('starter/assets'), resolve(projectDir, 'assets'), { recursive: true })
await writeFile(
  resolve(projectDir, 'deck.json'),
  `${JSON.stringify(createStarterDeck('CreatPPT E2E', 'signal', 11), null, 2)}\n`,
  'utf8',
)

process.env.CREATPPT_PROJECT = projectDir
const server = await createServer({ server: { host: '127.0.0.1', port } })
await server.listen()
server.printUrls()
