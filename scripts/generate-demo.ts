import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createStarterDeck } from '../src/demo/starter'

const destination = resolve('examples/demo-deck')
await mkdir(destination, { recursive: true })
await rm(resolve(destination, 'assets'), { recursive: true, force: true })
await writeFile(
  resolve(destination, 'deck.json'),
  `${JSON.stringify(createStarterDeck('从指令到成品：CreatPPT Web-first', 'editorial', 11), null, 2)}\n`,
  'utf8',
)
await cp(resolve('starter/assets'), resolve(destination, 'assets'), { recursive: true })
