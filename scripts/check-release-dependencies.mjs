import { readFile } from 'node:fs/promises'

const lockfile = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'))
const packages = lockfile.packages ?? {}
const allowedRuntimeDependencies = ['commander']
const runtimeDependencies = Object.keys(packages['']?.dependencies ?? {}).sort()

if (JSON.stringify(runtimeDependencies) !== JSON.stringify(allowedRuntimeDependencies)) {
  console.error(`Unexpected runtime dependency set: ${runtimeDependencies.join(', ') || '<empty>'}`)
  process.exit(1)
}

const blocked = Object.entries(packages)
  .filter(([path, metadata]) => {
    const packageName = metadata?.name
    return packageName === 'image-size' || path === 'node_modules/image-size' || path.endsWith('/node_modules/image-size')
  })
  .map(([path, metadata]) => `${path || '<root>'}@${metadata?.version ?? 'unknown'}`)

if (blocked.length) {
  console.error(`Blocked vulnerable image parser dependency found: ${blocked.join(', ')}`)
  process.exit(1)
}

console.log('Release dependency policy passed: runtime=commander; image-size is absent from the lockfile.')
