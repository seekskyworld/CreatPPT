import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createStarterDeck } from '../src/demo/starter'
import { startCreatPptServer } from '../src/server/server'

const projectDir = resolve('.tmp/e2e-deck')
const port = Number(process.env.CREATPPT_E2E_PORT ?? 4173)
await mkdir(projectDir, { recursive: true })
await rm(resolve(projectDir, 'assets'), { recursive: true, force: true })
await cp(resolve('starter/assets'), resolve(projectDir, 'assets'), { recursive: true })
await writeFile(
  resolve(projectDir, 'deck.json'),
  JSON.stringify(createStarterDeck('CreatPPT E2E', 'signal', 11), null, 2) + '\n',
  'utf8',
)

const { url } = await startCreatPptServer({
  projectDir,
  clientDir: resolve('dist/client'),
  host: '127.0.0.1',
  port,
})
console.log('CreatPPT built E2E workspace: ' + url)
