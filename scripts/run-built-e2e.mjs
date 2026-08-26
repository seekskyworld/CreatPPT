import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const playwrightCli = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url))
const child = spawn(process.execPath, [playwrightCli, 'test'], {
  env: { ...process.env, CREATPPT_E2E_BUILT: '1' },
  stdio: 'inherit',
})

child.on('error', error => {
  console.error(error)
  process.exitCode = 1
})
child.on('close', code => {
  process.exitCode = code ?? 1
})
